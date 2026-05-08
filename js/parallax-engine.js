// ===== Parallax Scroll Effects Engine =====
// Multi-layer depth-based scroll effects for the Priya & Arjun wedding website.
// Integrates with existing GSAP 3.12 + ScrollTrigger + Lenis stack.
// All ScrollTrigger instances use the "parallax-" prefix for independent cleanup.

(function () {
  'use strict';

  // =====================================================================
  // CONFIGURATION CONSTANTS
  // =====================================================================

  /**
   * Per-section layer definitions with speed factors and selectors.
   * Speed factors determine vertical offset: offset = speedFactor × scrollDistance
   */
  var LAYER_CONFIGS = {
    hero: {
      background: { speedFactor: 0.3, selector: '.hero', property: 'yPercent' },
      midground: { speedFactor: 0.4, selector: '.hero-bommalu', property: 'yPercent', scale: [1.0, 1.08] },
      foreground: { speedFactor: 0.7, selector: '.hero-inner', property: 'yPercent', opacity: [1.0, 0.0] }
    },
    story: {
      background: { speedFactor: 0.2, selector: '.story-bg-bommalu', property: 'yPercent' },
      midground: { speedFactor: 0.6, selector: null },
      foreground: { speedFactor: 1.2, selector: null }
    },
    ceremonies: {
      background: { speedFactor: 0.25, selector: '.ceremony-diya', property: 'y', oscillate: { amplitude: 15, period: 4 } },
      foreground: { speedFactor: 1.3, selector: '.ceremony-particles', property: 'y' }
    },
    gallery: {
      background: { speedFactor: -0.2, selector: '#bommalu-showcase', property: 'backgroundPositionY' }
    },
    rsvp: {
      background: { speedFactor: 0.3, selector: '#rsvp::before, #rsvp::after', property: 'x', direction: 'outward' }
    }
  };

  /**
   * Floating decorative element configuration.
   * maxVisible: hard cap across all active sections.
   * opacityRange/speedRange: per-element randomized bounds.
   * lateralDriftMax: max horizontal drift in px per 100vh scroll.
   * recycleOffset: px beyond viewport edge for repositioning recycled elements.
   */
  var FLOAT_CONFIG = {
    motifTypes: {
      petal: { width: 20, height: 20, sections: ['hero'] },
      rangoli: { width: 8, height: 8, sections: ['story'] },
      diya: { width: 14, height: 18, sections: ['ceremonies'] },
      particle: { width: 4, height: 4, sections: ['ceremonies'] }
    },
    maxVisible: 12,
    opacityRange: [0.08, 0.25],
    speedRange: [0.1, 0.5],
    lateralDriftMax: 30,
    recycleOffset: 50
  };

  /**
   * Mobile/responsive configuration.
   * breakpoint: px threshold for mobile mode.
   * layerCount: max active layers on mobile.
   * speedFactorMultiplier: applied to all speed factors on mobile.
   */
  var MOBILE_CONFIG = {
    breakpoint: 700,
    layerCount: 2,
    speedFactorMultiplier: 0.5,
    floatingElements: false,
    depthTransitionBlur: false,
    ceremoniesPinning: false
  };

  /**
   * Performance monitoring thresholds.
   * targetFps: minimum acceptable frame rate.
   * degradeThreshold: ms below target before triggering degradation.
   * recoverThreshold: ms above target before restoring quality.
   * sampleWindow: number of frames to average for fps calculation.
   * scrubSmoothing: GSAP ScrollTrigger scrub value (range 0.3–0.8).
   */
  var PERF_CONFIG = {
    targetFps: 55,
    degradeThreshold: 3000,
    recoverThreshold: 2000,
    sampleWindow: 60,
    scrubSmoothing: 0.5
  };

  // ScrollTrigger naming convention: parallax-{section}-{layer}
  var ST_PREFIX = 'parallax-';

  // =====================================================================
  // MEDIA QUERY CHECKS
  // =====================================================================

  // prefers-reduced-motion MediaQueryList
  var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  // 700px breakpoint MediaQueryList
  var mobileBreakpointQuery = window.matchMedia('(max-width: ' + MOBILE_CONFIG.breakpoint + 'px)');

  // =====================================================================
  // INTERNAL COMPONENT STUBS
  // =====================================================================

  /**
   * SectionParallax — Per-section controller that owns layers and
   * section-specific behavior (hero, story, ceremonies, gallery, RSVP).
   * Uses IntersectionObserver to activate/deactivate layers based on
   * viewport visibility (≥1px activates, 0px deactivates).
   * @param {HTMLElement} sectionEl - The section DOM element
   * @param {Object} config - Section configuration object
   */
  function SectionParallax(sectionEl, config) {
    this.sectionEl = sectionEl;
    this.config = config;
    this.layers = [];
    this.isActive = false;
    this._observer = null;
    this._currentIsMobile = mobileBreakpointQuery.matches;

    // Store the original config layers for rebuild purposes
    this._originalLayers = config.layers ? config.layers.slice() : [];

    // Create IntersectionObserver to detect section visibility
    var self = this;
    this._observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          self.activate();
        } else {
          self.deactivate();
        }
      });
    }, {
      threshold: 0,
      rootMargin: '0px'
    });

    // Start observing the section element
    this._observer.observe(this.sectionEl);
  }

  /**
   * Activates the section's parallax layers.
   * Creates LayerController instances and ScrollTriggers for each valid layer.
   * Only activates if not already active.
   */
  SectionParallax.prototype.activate = function () {
    if (this.isActive) {
      return;
    }
    this.isActive = true;

    var self = this;
    var layersConfig = this.config.layers || [];

    layersConfig.forEach(function (layerConfig) {
      // Skip layers without a valid selector or element
      if (!layerConfig.selector) {
        return;
      }

      var el = document.querySelector(layerConfig.selector);
      if (!el) {
        return;
      }

      // Determine depth identifier from the layer config
      var depth = layerConfig.depth || 'bg';

      // Apply mobile speed factor multiplier if on mobile
      var speedFactor = layerConfig.speedFactor;
      if (self._currentIsMobile) {
        speedFactor = speedFactor * MOBILE_CONFIG.speedFactorMultiplier;
      }

      // Create a LayerController for this layer
      var controller = new LayerController(el, depth, speedFactor, self.config.id || '');

      // Create the ScrollTrigger with the section as trigger
      controller.createTrigger(self.sectionEl, 'top bottom', 'bottom top');

      self.layers.push(controller);
    });
  };

  /**
   * Deactivates the section's parallax layers.
   * Kills all ScrollTriggers and clears the layers array.
   * Only deactivates if currently active.
   */
  SectionParallax.prototype.deactivate = function () {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;

    // Kill each LayerController
    this.layers.forEach(function (controller) {
      controller.kill();
    });

    // Clear the layers array
    this.layers = [];
  };

  /**
   * Rebuilds the section for a breakpoint change.
   * On mobile: filters to background + foreground layers only (skips midground),
   * and halves all speed factors using MOBILE_CONFIG.speedFactorMultiplier.
   * Then re-observes the section so IntersectionObserver will re-activate if visible.
   * @param {boolean} isMobile - Whether the current viewport is mobile (≤700px)
   */
  SectionParallax.prototype.rebuild = function (isMobile) {
    // Deactivate current layers first
    this.deactivate();

    // Update mobile state
    this._currentIsMobile = isMobile;

    if (isMobile) {
      // Filter config to only background + foreground layers (skip midground)
      var filteredLayers = this._originalLayers.filter(function (layer) {
        return layer.depth === 'bg' || layer.depth === 'fg';
      });

      // Halve all speed factors for mobile
      this.config.layers = filteredLayers.map(function (layer) {
        var mobileLayer = {};
        for (var key in layer) {
          if (layer.hasOwnProperty(key)) {
            mobileLayer[key] = layer[key];
          }
        }
        mobileLayer.speedFactor = layer.speedFactor * MOBILE_CONFIG.speedFactorMultiplier;
        return mobileLayer;
      });
    } else {
      // Restore original layers for desktop
      this.config.layers = this._originalLayers.slice();
    }

    // Re-observe the section — the IntersectionObserver will
    // re-activate if the section is currently visible
    this._observer.unobserve(this.sectionEl);
    this._observer.observe(this.sectionEl);
  };

  /**
   * Destroys the section parallax completely.
   * Deactivates layers and disconnects the IntersectionObserver.
   */
  SectionParallax.prototype.destroy = function () {
    this.deactivate();

    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  };

  /**
   * LayerController — Manages a single depth layer's DOM element,
   * speed factor, and ScrollTrigger instance.
   * @param {HTMLElement} el - The layer DOM element
   * @param {string} depth - Layer depth identifier ('bg', 'mid', 'fg')
   * @param {number} speedFactor - Movement multiplier
   * @param {string} sectionId - Parent section identifier
   */
  function LayerController(el, depth, speedFactor, sectionId) {
    this.el = el;
    this.depth = depth;
    this.speedFactor = speedFactor;
    this.sectionId = sectionId;
    this.scrollTrigger = null;
    // Store trigger params for recreation in updateSpeedFactor
    this._triggerEl = null;
    this._start = null;
    this._end = null;
  }

  /**
   * Creates a namespaced ScrollTrigger for this layer.
   * Applies will-change: transform via the .parallax-active class on activation.
   * Returns early if reduced motion is active to prevent new ScrollTrigger creation.
   * @param {HTMLElement} triggerEl - The element that triggers the scroll animation
   * @param {string} start - ScrollTrigger start position (e.g., 'top bottom')
   * @param {string} end - ScrollTrigger end position (e.g., 'bottom top')
   */
  LayerController.prototype.createTrigger = function (triggerEl, start, end) {
    // Guard: prevent new ScrollTrigger creation when reduced motion is active
    if (_isReduced) {
      return;
    }

    // Store params for potential recreation
    this._triggerEl = triggerEl;
    this._start = start;
    this._end = end;

    // Apply will-change: transform via CSS class on activation
    this.el.classList.add('parallax-active');

    // Create the GSAP animation with ScrollTrigger
    var triggerId = ST_PREFIX + this.sectionId + '-' + this.depth;
    var scrubValue = PERF_CONFIG.scrubSmoothing;

    this.scrollTrigger = gsap.to(this.el, {
      yPercent: this.speedFactor * 100,
      ease: 'none',
      scrollTrigger: {
        id: triggerId,
        trigger: triggerEl,
        start: start,
        end: end,
        scrub: scrubValue
      }
    });
  };

  /**
   * Kills the ScrollTrigger instance and cleans up the element.
   * Removes will-change via .parallax-active class and resets transforms.
   */
  LayerController.prototype.kill = function () {
    if (this.scrollTrigger) {
      // Get the ScrollTrigger instance from the tween
      var st = this.scrollTrigger.scrollTrigger;
      if (st) {
        st.kill();
      }
      // Kill the tween itself
      this.scrollTrigger.kill();
      this.scrollTrigger = null;
    }

    // Remove will-change: transform by removing the CSS class
    this.el.classList.remove('parallax-active');

    // Reset the element's transform
    gsap.set(this.el, { clearProps: 'all' });
  };

  /**
   * Updates the speed factor and recreates the ScrollTrigger if one exists.
   * Used for mobile halving of speed factors.
   * @param {number} factor - The new speed factor value
   */
  LayerController.prototype.updateSpeedFactor = function (factor) {
    this.speedFactor = factor;

    // If a ScrollTrigger exists, kill and recreate with new speed factor
    if (this.scrollTrigger) {
      var triggerEl = this._triggerEl;
      var start = this._start;
      var end = this._end;

      this.kill();
      this.createTrigger(triggerEl, start, end);
    }
  };

  /**
   * FloatingElementPool — Object pool for recycling decorative elements
   * across sections.
   * @param {number} maxVisible - Hard cap on visible elements (default 12)
   */
  function FloatingElementPool(maxVisible) {
    this._pool = [];
    this._active = new Set();
    this._maxVisible = maxVisible || FLOAT_CONFIG.maxVisible;
    this._originalMax = this._maxVisible;
    this._reducedMax = null;
  }

  /**
   * Returns the current effective maximum visible elements.
   * @returns {number}
   */
  FloatingElementPool.prototype._currentMax = function () {
    return this._reducedMax !== null ? this._reducedMax : this._maxVisible;
  };

  /**
   * Creates the inline SVG/CSS visual for a given motif type.
   * @param {string} motifType - One of 'petal', 'rangoli', 'diya'
   * @param {HTMLElement} el - The element to style
   */
  FloatingElementPool.prototype._applyMotifVisual = function (motifType, el) {
    var config = FLOAT_CONFIG.motifTypes[motifType];
    if (!config) return;

    el.style.width = config.width + 'px';
    el.style.height = config.height + 'px';

    switch (motifType) {
      case 'petal':
        // Flower petal shape using CSS border-radius
        el.style.background = 'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)';
        el.style.borderRadius = '50% 0 50% 0';
        el.style.transform = 'rotate(45deg)';
        el.innerHTML = '';
        break;

      case 'rangoli':
        // Small circular dot using radial-gradient
        el.style.background = 'radial-gradient(circle, #e8a838 0%, #c44569 70%, transparent 100%)';
        el.style.borderRadius = '50%';
        el.innerHTML = '';
        break;

      case 'diya':
        // Diya flame shape using inline SVG
        el.style.background = 'none';
        el.style.borderRadius = '0';
        el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 18" width="14" height="18">' +
          '<ellipse cx="7" cy="15" rx="6" ry="3" fill="#c44569" opacity="0.8"/>' +
          '<path d="M7 1 C4 6, 3 10, 7 13 C11 10, 10 6, 7 1Z" fill="#e8a838"/>' +
          '<path d="M7 3 C5.5 6, 5 9, 7 11 C9 9, 8.5 6, 7 3Z" fill="#ffcc02"/>' +
          '</svg>';
        break;

      default:
        el.style.background = 'var(--gold, #e8a838)';
        el.style.borderRadius = '50%';
        el.innerHTML = '';
        break;
    }
  };

  /**
   * Generates a random number within a range [min, max].
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  FloatingElementPool.prototype._randomInRange = function (min, max) {
    return min + Math.random() * (max - min);
  };

  /**
   * Acquires a floating element from the pool or creates a new one.
   * Returns null if the max visible cap is reached.
   * @param {string} motifType - One of 'petal', 'rangoli', 'diya'
   * @param {string} section - The section identifier
   * @returns {HTMLElement|null}
   */
  FloatingElementPool.prototype.acquire = function (motifType, section) {
    // Enforce max visible cap
    if (this._active.size >= this._currentMax()) {
      return null;
    }

    var el = null;

    // Check pool for a reusable element of the same motifType
    for (var i = 0; i < this._pool.length; i++) {
      if (this._pool[i]._parallaxData && this._pool[i]._parallaxData.motifType === motifType) {
        el = this._pool.splice(i, 1)[0];
        break;
      }
    }

    // If no reusable element found, create a new one
    if (!el) {
      el = document.createElement('div');
      el.className = 'parallax-float';
      el.style.position = 'fixed';
      el.style.pointerEvents = 'none';
      el.setAttribute('aria-hidden', 'true');
      this._applyMotifVisual(motifType, el);
    }

    // Configure the element
    var opacity = this._randomInRange(FLOAT_CONFIG.opacityRange[0], FLOAT_CONFIG.opacityRange[1]);
    var speedFactor = this._randomInRange(FLOAT_CONFIG.speedRange[0], FLOAT_CONFIG.speedRange[1]);

    el.style.opacity = opacity;
    el.style.display = 'block';
    el.style.top = '-50px';
    el.style.left = Math.random() * (window.innerWidth - 30) + 'px';

    // Store metadata on the element
    el._parallaxData = {
      motifType: motifType,
      speedFactor: speedFactor,
      lateralOffset: 0,
      section: section
    };

    // Add to active set
    this._active.add(el);

    // Append to document body
    document.body.appendChild(el);

    return el;
  };

  /**
   * Releases an element back to the pool, hiding it.
   * @param {HTMLElement} el - The element to release
   */
  FloatingElementPool.prototype.release = function (el) {
    if (!el) return;

    // Remove from active set
    this._active.delete(el);

    // Hide the element
    el.style.display = 'none';

    // Add back to pool for reuse
    this._pool.push(el);
  };

  /**
   * Recycles an element by repositioning it beyond the viewport edge
   * in the scroll direction, ready for re-entry from the opposite side.
   * @param {HTMLElement} el - The element to recycle
   * @param {string} scrollDirection - 'down' or 'up'
   */
  FloatingElementPool.prototype.recycle = function (el, scrollDirection) {
    if (!el) return;

    var offset = FLOAT_CONFIG.recycleOffset; // 50px minimum beyond viewport edge
    var viewportHeight = window.innerHeight;
    var viewportWidth = window.innerWidth;
    var elHeight = el.offsetHeight || 20;

    if (scrollDirection === 'down') {
      // Scrolling down: place element above viewport for re-entry from top
      el.style.top = -(elHeight + offset) + 'px';
    } else {
      // Scrolling up: place element below viewport for re-entry from bottom
      el.style.top = (viewportHeight + offset) + 'px';
    }

    // Randomize horizontal position
    el.style.left = Math.random() * (viewportWidth - 30) + 'px';

    // Reset lateral offset
    if (el._parallaxData) {
      el._parallaxData.lateralOffset = 0;
    }
  };

  /**
   * Reduces the maximum visible elements by half for performance degradation.
   * Releases excess elements until active count is within the new limit.
   */
  FloatingElementPool.prototype.reduceByHalf = function () {
    this._reducedMax = Math.floor(this._active.size / 2);

    // Release excess elements
    var excess = this._active.size - this._reducedMax;
    if (excess > 0) {
      var toRelease = [];
      var iterator = this._active.values();
      for (var i = 0; i < excess; i++) {
        var next = iterator.next();
        if (!next.done) {
          toRelease.push(next.value);
        }
      }
      for (var j = 0; j < toRelease.length; j++) {
        this.release(toRelease[j]);
      }
    }
  };

  /**
   * Restores the maximum visible elements to the original value.
   * Called when performance recovers.
   */
  FloatingElementPool.prototype.restore = function () {
    this._reducedMax = null;
  };

  /**
   * Destroys all elements, removing them from the DOM and clearing all state.
   */
  FloatingElementPool.prototype.destroyAll = function () {
    // Release all active elements
    var activeArr = [];
    this._active.forEach(function (el) {
      activeArr.push(el);
    });
    for (var i = 0; i < activeArr.length; i++) {
      this._active.delete(activeArr[i]);
      if (activeArr[i].parentNode) {
        activeArr[i].parentNode.removeChild(activeArr[i]);
      }
    }

    // Remove all pool elements from DOM
    for (var j = 0; j < this._pool.length; j++) {
      if (this._pool[j].parentNode) {
        this._pool[j].parentNode.removeChild(this._pool[j]);
      }
    }

    // Clear both arrays/sets
    this._pool = [];
    this._active = new Set();
  };

  /**
   * PerformanceMonitor — Frame-rate sampler that triggers quality
   * degradation/recovery.
   *
   * Samples frame times using requestAnimationFrame, computes a rolling
   * average FPS over a 60-frame window, and triggers degradation when
   * FPS < targetFps for 3 consecutive seconds or recovery when FPS > targetFps
   * for 2 consecutive seconds after degradation.
   *
   * @param {number} targetFps - Minimum acceptable fps (default 55)
   * @param {Function} degradeCallback - Called when fps drops below target for degradeThreshold
   * @param {Function} recoverCallback - Called when fps recovers above target for recoverThreshold
   */
  function PerformanceMonitor(targetFps, degradeCallback, recoverCallback) {
    this._targetFps = targetFps || PERF_CONFIG.targetFps;
    this._degradeCallback = degradeCallback || null;
    this._recoverCallback = recoverCallback || null;
    this._samples = [];
    this._isDegraded = false;
    this._degradedAt = null;
    this._belowTargetSince = null;
    this._aboveTargetSince = null;
    this._rafId = null;
    this._running = false;
    this._lastTimestamp = null;
    this._currentFps = 0;
  }

  /**
   * Starts the performance monitoring loop.
   * Sets _running to true and begins the rAF sampling loop.
   */
  PerformanceMonitor.prototype.start = function () {
    this._running = true;
    var self = this;
    this._rafId = requestAnimationFrame(function (ts) {
      self.sample(ts);
    });
  };

  /**
   * Stops the performance monitoring loop.
   * Cancels the rAF, resets all timing state.
   */
  PerformanceMonitor.prototype.stop = function () {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    // Reset all timing state
    this._lastTimestamp = null;
    this._samples = [];
    this._belowTargetSince = null;
    this._aboveTargetSince = null;
    this._currentFps = 0;
  };

  /**
   * Samples a frame timestamp, computes rolling average FPS, and checks
   * whether to trigger degradation or recovery.
   *
   * Called each rAF frame. Skips the first frame (no delta available).
   * Maintains a rolling window of PERF_CONFIG.sampleWindow (60) frame times.
   *
   * @param {number} timestamp - The DOMHighResTimeStamp from requestAnimationFrame
   */
  PerformanceMonitor.prototype.sample = function (timestamp) {
    if (!this._running) {
      return;
    }

    // Calculate frame time (skip first frame — no previous timestamp)
    if (this._lastTimestamp !== null) {
      var frameTime = timestamp - this._lastTimestamp;

      // Push frame time to samples array
      this._samples.push(frameTime);

      // Maintain rolling window of sampleWindow (60) frames
      if (this._samples.length > PERF_CONFIG.sampleWindow) {
        this._samples.shift();
      }

      // Compute rolling average FPS once we have enough samples
      if (this._samples.length >= PERF_CONFIG.sampleWindow) {
        var sum = 0;
        for (var i = 0; i < this._samples.length; i++) {
          sum += this._samples[i];
        }
        var avgFrameTime = sum / this._samples.length;
        this._currentFps = 1000 / avgFrameTime;

        // Check degrade or recover based on current state
        if (!this._isDegraded) {
          this._checkDegrade();
        } else {
          this._checkRecover();
        }
      }
    }

    // Store timestamp for next frame's delta calculation
    this._lastTimestamp = timestamp;

    // Schedule next frame
    var self = this;
    this._rafId = requestAnimationFrame(function (ts) {
      self.sample(ts);
    });
  };

  /**
   * Checks whether FPS has been below target for degradeThreshold (3000ms).
   * If already degraded, returns immediately.
   * If FPS < targetFps:
   *   - Records when it first dropped below (belowTargetSince)
   *   - If below for >= degradeThreshold ms, triggers degradation
   * If FPS >= targetFps:
   *   - Resets belowTargetSince (fps recovered before threshold)
   */
  PerformanceMonitor.prototype._checkDegrade = function () {
    if (this._isDegraded) {
      return;
    }

    if (this._currentFps < this._targetFps) {
      // FPS is below target
      if (this._belowTargetSince === null) {
        this._belowTargetSince = Date.now();
      }

      // Check if below target for >= degradeThreshold (3000ms)
      if (Date.now() - this._belowTargetSince >= PERF_CONFIG.degradeThreshold) {
        this._isDegraded = true;
        this._degradedAt = Date.now();
        this._belowTargetSince = null;

        // Invoke degradation callback
        if (this._degradeCallback) {
          this._degradeCallback();
        }
      }
    } else {
      // FPS recovered before threshold — reset timer
      this._belowTargetSince = null;
    }
  };

  /**
   * Checks whether FPS has been above target for recoverThreshold (2000ms).
   * If not degraded, returns immediately.
   * If FPS > targetFps:
   *   - Records when it first rose above (aboveTargetSince)
   *   - If above for >= recoverThreshold ms, triggers recovery
   * If FPS <= targetFps:
   *   - Resets aboveTargetSince (fps dropped again)
   */
  PerformanceMonitor.prototype._checkRecover = function () {
    if (!this._isDegraded) {
      return;
    }

    if (this._currentFps > this._targetFps) {
      // FPS is above target
      if (this._aboveTargetSince === null) {
        this._aboveTargetSince = Date.now();
      }

      // Check if above target for >= recoverThreshold (2000ms)
      if (Date.now() - this._aboveTargetSince >= PERF_CONFIG.recoverThreshold) {
        this._isDegraded = false;
        this._aboveTargetSince = null;

        // Invoke recovery callback
        if (this._recoverCallback) {
          this._recoverCallback();
        }
      }
    } else {
      // FPS dropped again — reset timer
      this._aboveTargetSince = null;
    }
  };

  /**
   * DepthTransition — Handles cross-section scale/opacity/blur transitions
   * at boundaries. Creates a ScrollTrigger spanning the boundary between two
   * adjacent sections (last 15% of exit section + first 15% of enter section).
   *
   * Animates:
   *   Exit section:  scale 1.0→0.96, opacity 1.0→0.9, blur 0→1px (desktop only)
   *   Enter section: scale 1.03→1.0, opacity 0.9→1.0
   *
   * The scrub mechanism automatically handles reverse scrolling (proportional reversal).
   * Blur is disabled on mobile (≤700px) per MOBILE_CONFIG.depthTransitionBlur.
   *
   * @param {HTMLElement} exitSection - The section being scrolled out of
   * @param {HTMLElement} enterSection - The section being scrolled into
   *
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   */
  function DepthTransition(exitSection, enterSection) {
    this.exitSection = exitSection;
    this.enterSection = enterSection;
    this.scrollTrigger = null;
    this._timeline = null;
    this._blurEnabled = !_isMobile;
    this._exitId = exitSection.id || exitSection.className.split(' ')[0] || 'section';
    this._enterId = enterSection.id || enterSection.className.split(' ')[0] || 'section';
  }

  /**
   * Creates the ScrollTrigger and GSAP timeline for the depth transition.
   * The trigger spans the boundary zone: last 15% of exit section through
   * first 15% of enter section.
   *
   * Uses the exit section as the trigger element with calculated start/end
   * positions that cover the transition zone. The scrub value from
   * PERF_CONFIG.scrubSmoothing ensures proportional reversal on backward scroll.
   */
  DepthTransition.prototype.createTrigger = function () {
    var gsapLib = window.gsap;
    if (!gsapLib || !window.ScrollTrigger) return;

    var exitSection = this.exitSection;
    var enterSection = this.enterSection;
    var self = this;

    // Calculate the transition zone using pixel-based positions.
    // The zone spans: last 15% of exit section height + first 15% of enter section height.
    var exitHeight = exitSection.offsetHeight;
    var enterHeight = enterSection.offsetHeight;

    // The transition zone in scroll distance
    var exitZone = exitHeight * 0.15;  // last 15% of exit section
    var enterZone = enterHeight * 0.15; // first 15% of enter section
    var totalZone = exitZone + enterZone;

    // Create a GSAP timeline for the transition
    var tl = gsapLib.timeline({ paused: true });

    // Exit section tween: scale 1.0→0.96, opacity 1.0→0.9
    var exitTweenVars = {
      scale: 0.96,
      opacity: 0.9,
      ease: 'none',
      duration: 1
    };

    // Add blur for desktop only
    if (this._blurEnabled) {
      exitTweenVars.filter = 'blur(1px)';
    }

    tl.fromTo(exitSection,
      { scale: 1.0, opacity: 1.0, filter: 'blur(0px)' },
      exitTweenVars,
      0 // start at position 0
    );

    // Enter section tween: scale 1.03→1.0, opacity 0.9→1.0
    tl.fromTo(enterSection,
      { scale: 1.03, opacity: 0.9 },
      { scale: 1.0, opacity: 1.0, ease: 'none', duration: 1 },
      0 // start at same position (parallel)
    );

    // Create the ScrollTrigger that drives the timeline.
    // Trigger on the exit section:
    //   start: when the bottom of exit section minus 15% reaches the bottom of viewport
    //          i.e., the last 15% of exit section begins entering from below
    //   end: calculated to cover the full transition zone (exit 15% + enter 15%)
    var triggerId = ST_PREFIX + 'transition-' + this._exitId + '-' + this._enterId;

    this.scrollTrigger = window.ScrollTrigger.create({
      id: triggerId,
      trigger: exitSection,
      start: 'bottom-=' + Math.round(exitZone) + ' bottom',
      end: '+=' + Math.round(totalZone),
      scrub: PERF_CONFIG.scrubSmoothing,
      animation: tl
    });

    this._timeline = tl;
  };

  /**
   * Kills the ScrollTrigger and timeline, resets both sections to default state.
   * Clears scale, opacity, and filter on both exit and enter sections.
   */
  DepthTransition.prototype.kill = function () {
    var gsapLib = window.gsap;

    if (this.scrollTrigger) {
      this.scrollTrigger.kill();
      this.scrollTrigger = null;
    }

    if (this._timeline) {
      this._timeline.kill();
      this._timeline = null;
    }

    // Reset both sections to their default state
    if (gsapLib) {
      gsapLib.set(this.exitSection, { scale: 1, opacity: 1, filter: 'blur(0px)', clearProps: 'scale,opacity,filter' });
      gsapLib.set(this.enterSection, { scale: 1, opacity: 1, clearProps: 'scale,opacity' });
    }
  };

  /**
   * Disables blur on the exit section transition.
   * Called on mobile (≤700px) where blur effects are disabled per Req 6.6.
   * If a trigger already exists, updates the exit section's filter to none
   * and rebuilds the timeline without blur.
   */
  DepthTransition.prototype.disableBlur = function () {
    this._blurEnabled = false;

    if (this._timeline && this.scrollTrigger) {
      // Kill and recreate without blur
      var progress = this.scrollTrigger.progress;
      this.kill();
      this.createTrigger();
      // Restore scroll position progress
      if (this.scrollTrigger && typeof progress === 'number') {
        this.scrollTrigger.scroll(this.scrollTrigger.start + progress * (this.scrollTrigger.end - this.scrollTrigger.start));
      }
    }
  };

  /**
   * Enables blur on the exit section transition.
   * Called on desktop (>700px) to re-enable the blur animation.
   * If a trigger already exists, rebuilds the timeline with blur.
   */
  DepthTransition.prototype.enableBlur = function () {
    this._blurEnabled = true;

    if (this._timeline && this.scrollTrigger) {
      // Kill and recreate with blur
      var progress = this.scrollTrigger.progress;
      this.kill();
      this.createTrigger();
      // Restore scroll position progress
      if (this.scrollTrigger && typeof progress === 'number') {
        this.scrollTrigger.scroll(this.scrollTrigger.start + progress * (this.scrollTrigger.end - this.scrollTrigger.start));
      }
    }
  };

  // =====================================================================
  // PARALLAX ENGINE (ORCHESTRATOR)
  // =====================================================================

  var _sections = [];
  var _pool = null;
  var _monitor = null;
  var _transitions = [];
  var _isMobile = mobileBreakpointQuery.matches;
  var _isReduced = reducedMotionQuery.matches;
  var _lenisInstance = null;
  var _initialized = false;
  var _lenisScrollHandler = null;
  var _previousLenisScroll = 0;

  /**
   * Handles breakpoint changes (crossing 700px threshold).
   * Rebuilds all sections for mobile/desktop configuration.
   */
  function _onBreakpointChange(e) {
    _isMobile = e.matches;
    _sections.forEach(function (section) {
      section.rebuild(_isMobile);
    });

    if (_isMobile) {
      // Disable floating elements and depth transition blur on mobile
      if (_pool) {
        _pool.destroyAll();
      }
      _transitions.forEach(function (t) {
        t.disableBlur();
      });
    } else {
      // Restore floating elements and blur on desktop
      if (_pool) {
        _pool.restore();
      }
      _transitions.forEach(function (t) {
        t.enableBlur();
      });
    }
  }

  /**
   * Handles prefers-reduced-motion changes.
   * Enables/disables all parallax within 100ms.
   */
  function _onMotionPrefChange(e) {
    _isReduced = e.matches;

    if (_isReduced) {
      // Kill all parallax ScrollTriggers and reset elements
      _destroy();
    } else {
      // Reinitialize parallax effects
      _initialize();
    }
  }

  // =====================================================================
  // HERO SECTION PARALLAX
  // =====================================================================

  /**
   * Initializes hero-specific parallax effects.
   * Creates ScrollTrigger animations for the three hero layers:
   * - Background (.hero): z-index 0, Speed_Factor 0.3, progressive blur 50%-100%
   * - Midground (.hero-bommalu): z-index 1, Speed_Factor 0.4, yPercent only (existing code handles scale)
   * - Foreground (.hero-inner): z-index 2, Speed_Factor 0.7, opacity 1→0 only (existing code handles yPercent)
   *
   * Waits for the curtain-parting animation to complete before activating.
   * Coexists with existing hero scroll animations in script.js.
   */
  function _initHeroParallax() {
    // Guard: skip all parallax effects when reduced motion is active
    if (_isReduced) return;

    var gsap = window.gsap;
    if (!gsap || !window.ScrollTrigger) return;

    var heroEl = document.querySelector('.hero');
    var bommaluEl = document.querySelector('.hero-bommalu');
    var heroInnerEl = document.querySelector('.hero-inner');

    // Guard: skip if hero elements are missing
    if (!heroEl) {
      console.warn('[ParallaxEngine] Hero section not found. Skipping hero parallax.');
      return;
    }

    var scrubValue = PERF_CONFIG.scrubSmoothing;

    // Determine when to activate: wait for curtain animation to complete.
    // The existing hero timeline holds Lenis (scroll is stopped) until it completes.
    // Once Lenis starts, the user can scroll. Our ScrollTriggers use start: 'top top'
    // which means they only fire once the user actually scrolls past the hero top.
    // Additionally, check for window.heroTimeline completion as a safety measure.
    function _createHeroTriggers() {
      // --- Background layer: .hero element, z-index 0, Speed_Factor 0.3 ---
      // Apply yPercent parallax offset
      if (heroEl) {
        heroEl.style.position = 'relative';
        heroEl.style.zIndex = '0';
        heroEl.classList.add('parallax-active');

        gsap.to(heroEl, {
          yPercent: LAYER_CONFIGS.hero.background.speedFactor * 100,
          ease: 'none',
          scrollTrigger: {
            id: ST_PREFIX + 'hero-bg',
            trigger: heroEl,
            start: 'top top',
            end: 'bottom top',
            scrub: scrubValue
          }
        });
      }

      // --- Background layer blur: progressive blur 0→3px from 50%–100% scroll progress ---
      if (heroEl) {
        gsap.fromTo(heroEl,
          { filter: 'blur(0px)' },
          {
            filter: 'blur(3px)',
            ease: 'none',
            scrollTrigger: {
              id: ST_PREFIX + 'hero-blur',
              trigger: heroEl,
              start: 'center top', // 50% of hero section scroll progress
              end: 'bottom top',   // 100% of hero section scroll progress
              scrub: scrubValue
            }
          }
        );
      }

      // --- Midground layer: .hero-bommalu, z-index 1, Speed_Factor 0.4 ---
      // Only apply yPercent (vertical parallax offset) — existing script.js handles scale
      if (bommaluEl) {
        bommaluEl.style.position = 'relative';
        bommaluEl.style.zIndex = '1';
        bommaluEl.classList.add('parallax-active');

        gsap.to(bommaluEl, {
          yPercent: LAYER_CONFIGS.hero.midground.speedFactor * 100,
          ease: 'none',
          scrollTrigger: {
            id: ST_PREFIX + 'hero-mid',
            trigger: heroEl,
            start: 'top top',
            end: 'bottom top',
            scrub: scrubValue
          }
        });
      }

      // --- Foreground layer: .hero-inner, z-index 2, Speed_Factor 0.7 ---
      // Only apply opacity 1→0 — existing script.js handles yPercent
      if (heroInnerEl) {
        heroInnerEl.style.position = 'relative';
        heroInnerEl.style.zIndex = '2';
        heroInnerEl.classList.add('parallax-active');

        gsap.fromTo(heroInnerEl,
          { opacity: 1 },
          {
            opacity: 0,
            ease: 'none',
            scrollTrigger: {
              id: ST_PREFIX + 'hero-fg',
              trigger: heroEl,
              start: 'top top',
              end: 'bottom top',
              scrub: scrubValue
            }
          }
        );
      }
    }

    // Wait for curtain animation to complete before creating triggers.
    // The existing code creates a hero timeline that calls lenis.start() on complete.
    // We check if heroTimeline exists on window; if so, wait for it.
    // Otherwise, use a small delay to ensure the curtain animation has finished.
    if (window.heroTimeline && window.heroTimeline.isActive && window.heroTimeline.isActive()) {
      // Timeline is still running — wait for completion
      window.heroTimeline.eventCallback('onComplete', function () {
        _createHeroTriggers();
      });
    } else {
      // Timeline already completed or doesn't exist on window — create immediately.
      // The ScrollTriggers use start: 'top top' so they won't fire until user scrolls,
      // which can only happen after Lenis is started (i.e., after curtain completes).
      _createHeroTriggers();
    }
  }

  // =====================================================================
  // FLOATING ELEMENT SCROLL UPDATE (rAF-batched)
  // =====================================================================

  // Pending scroll delta accumulated between frames
  var _pendingScrollDelta = 0;
  // Cumulative total scroll distance for lateral drift calculation
  var _cumulativeScroll = 0;
  // rAF ID for the floating element update loop
  var _floatRafId = null;
  // Whether a rAF frame is already scheduled
  var _floatFrameScheduled = false;

  /**
   * Processes the pending scroll delta on the next animation frame.
   * Batches DOM reads before writes to prevent layout thrashing.
   * Recycles elements that exit the viewport.
   */
  function _processFloatFrame() {
    _floatFrameScheduled = false;

    // Early exit if mobile — floating elements disabled on mobile (≤700px)
    if (_isMobile) {
      _pendingScrollDelta = 0;
      return;
    }

    // Early exit if no pool or no active elements
    if (!_pool || _pool._active.size === 0) {
      _pendingScrollDelta = 0;
      return;
    }

    var scrollDelta = _pendingScrollDelta;
    _pendingScrollDelta = 0;

    if (scrollDelta === 0) {
      return;
    }

    // Update cumulative scroll for lateral drift calculation
    _cumulativeScroll += Math.abs(scrollDelta);

    // Determine scroll direction for recycling
    var scrollDirection = scrollDelta > 0 ? 'down' : 'up';

    // --- BATCH DOM READS ---
    var viewportHeight = window.innerHeight;
    var viewportWidth = window.innerWidth;

    // Read current positions of all active elements
    // Positions are tracked via _parallaxData.currentY (transform-based, no layout reads)
    var elementsData = [];
    _pool._active.forEach(function (el) {
      if (!el._parallaxData) return;

      var data = el._parallaxData;
      // Initialize currentY if not set (first frame)
      if (typeof data.currentY === 'undefined') {
        data.currentY = 0;
      }

      elementsData.push({
        el: el,
        data: data,
        height: el.offsetHeight || 20
      });
    });

    // --- COMPUTE TRANSFORMS ---
    var toRecycle = [];

    for (var i = 0; i < elementsData.length; i++) {
      var item = elementsData[i];
      var data = item.data;
      var el = item.el;

      // Calculate vertical offset: scrollDelta * element's speedFactor
      var verticalOffset = scrollDelta * data.speedFactor;
      data.currentY += verticalOffset;

      // Calculate lateral drift: sinusoidal, capped at lateralDriftMax (30px) per 100vh
      // Use cumulative scroll to drive the sine wave for smooth continuous drift
      var driftPhase = (_cumulativeScroll / viewportHeight) * Math.PI * 2;
      // Each element gets a unique phase offset based on its speedFactor for variety
      var elementPhase = driftPhase * (0.5 + data.speedFactor);
      var maxDrift = FLOAT_CONFIG.lateralDriftMax; // 30px per 100vh

      // Lateral offset bounded by sin [-1, 1] scaled to [-maxDrift, maxDrift]
      data.lateralOffset = Math.sin(elementPhase) * maxDrift;

      // Check if element has exited the viewport
      // Element's effective top = CSS top + transform currentY
      var elTop = parseFloat(el.style.top) || 0;
      var effectiveTop = elTop + data.currentY;
      var effectiveBottom = effectiveTop + item.height;

      if (effectiveTop > viewportHeight + 10 || effectiveBottom < -10) {
        toRecycle.push(el);
      }
    }

    // --- BATCH DOM WRITES ---
    for (var j = 0; j < elementsData.length; j++) {
      var writeItem = elementsData[j];
      var writeData = writeItem.data;
      var writeEl = writeItem.el;

      // Apply transform using translate3d for GPU acceleration
      writeEl.style.transform = 'translate3d(' +
        writeData.lateralOffset.toFixed(1) + 'px, ' +
        writeData.currentY.toFixed(1) + 'px, 0)';
    }

    // --- RECYCLE EXITED ELEMENTS ---
    for (var k = 0; k < toRecycle.length; k++) {
      var recycleEl = toRecycle[k];
      // Reset cumulative Y position and lateral offset on recycle
      if (recycleEl._parallaxData) {
        recycleEl._parallaxData.currentY = 0;
        recycleEl._parallaxData.lateralOffset = 0;
      }
      _pool.recycle(recycleEl, scrollDirection);
    }
  }

  /**
   * Updates floating elements based on scroll delta.
   * Accumulates delta and schedules a rAF frame for batched processing.
   * On mobile (≤700px), returns immediately (floating elements disabled).
   *
   * @param {number} scrollDelta - The scroll distance since last update (positive = down)
   */
  function _updateFloatingElements(scrollDelta) {
    // Early exit on mobile — floating elements disabled per Req 9.4
    if (_isMobile) {
      return;
    }

    // Early exit when reduced motion is active — no floating element animation
    if (_isReduced) {
      return;
    }

    // Accumulate scroll delta for rAF batching
    _pendingScrollDelta += scrollDelta;

    // Schedule a rAF frame if not already scheduled
    if (!_floatFrameScheduled) {
      _floatFrameScheduled = true;
      _floatRafId = requestAnimationFrame(_processFloatFrame);
    }
  }

  // Expose as _updateFloats for wiring in task 14.1
  var _updateFloats = _updateFloatingElements;

  // =====================================================================
  // HERO FLOATING PETALS
  // =====================================================================

  /**
   * Initializes 8–15 floating flower petal elements in the hero section.
   * Each petal is acquired from the FloatingElementPool with random Speed_Factor
   * [0.1, 0.5] and opacity [0.08, 0.25]. Petals are distributed randomly across
   * the hero section viewport area with random initial Y positions spread across
   * the viewport height (not all at top).
   *
   * The scroll-driven movement is handled by _updateFloatingElements() — petals
   * drift downward with scroll. Petals that exit the viewport are recycled by
   * _processFloatFrame() via _pool.recycle().
   *
   * On mobile (≤700px), petals are automatically disabled because
   * _updateFloatingElements checks _isMobile.
   *
   * Requirements: 2.4, 7.1, 7.3, 7.4, 7.6
   */
  function _initHeroPetals() {
    // Guard: if pool is null or mobile, return early
    if (!_pool || _isMobile) {
      return;
    }

    // Generate random count between 8 and 15 (inclusive)
    var petalCount = Math.floor(Math.random() * 8) + 8; // 8 to 15

    var viewportHeight = window.innerHeight;
    var viewportWidth = window.innerWidth;

    for (var i = 0; i < petalCount; i++) {
      // Acquire a petal element from the pool
      // acquire() assigns random speedFactor [0.1, 0.5] and opacity [0.08, 0.25]
      var el = _pool.acquire('petal', 'hero');

      // If pool is exhausted (max visible reached), stop creating petals
      if (!el) {
        break;
      }

      // Distribute petals randomly across the viewport area
      // Random X position within viewport width (accounting for petal width 20px)
      var randomX = Math.random() * (viewportWidth - 20);
      el.style.left = randomX + 'px';

      // Random Y position spread across the full viewport height
      // This ensures petals aren't all clustered at the top
      var randomY = Math.random() * viewportHeight;
      el.style.top = randomY + 'px';

      // Initialize currentY tracking for scroll-driven movement
      if (el._parallaxData) {
        el._parallaxData.currentY = 0;
      }
    }
  }

  // =====================================================================
  // STORY SECTION PARALLAX
  // =====================================================================

  /**
   * Initializes story section parallax effects:
   * 1. Horizontal movement for story items (left-column from -40px→0px,
   *    right-column from 40px→0px) scrubbed to each item's scroll progress
   * 2. Background bommalu illustrations translating upward at Speed_Factor 0.2
   * 3. 3–6 floating rangoli elements at Speed_Factor 0.15
   * 4. Scale 0.97→1.0 and opacity 0.85→1.0 when item center is within 10%
   *    of viewport center
   *
   * Coexists with existing mangalsutra thread scrub and story item reveal
   * animations in script.js (those use once:true triggers and different properties).
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 11.1
   */
  function _initStoryParallax() {
    // Guard: skip all parallax effects when reduced motion is active
    if (_isReduced) return;

    var gsap = window.gsap;
    if (!gsap || !window.ScrollTrigger) return;

    var storySection = document.querySelector('#story');
    if (!storySection) {
      console.warn('[ParallaxEngine] Story section not found. Skipping story parallax.');
      return;
    }

    var scrubValue = PERF_CONFIG.scrubSmoothing;

    // --- 1. Horizontal movement for story items ---
    // The story-grid has two .story-col elements:
    //   - First .story-col (left column) items translate from x: -40 → 0
    //   - Second .story-col (right column) items translate from x: 40 → 0
    var storyCols = storySection.querySelectorAll('.story-col');
    var itemIndex = 0;

    storyCols.forEach(function (col, colIndex) {
      var items = col.querySelectorAll('.story-item');
      var isLeftColumn = (colIndex === 0);

      items.forEach(function (item) {
        var fromX = isLeftColumn ? -40 : 40;
        var triggerId = ST_PREFIX + 'story-item-' + itemIndex;

        // Horizontal translation scrubbed to item's scroll progress
        // (entering bottom of viewport → fully within viewport)
        item.classList.add('parallax-active');

        gsap.fromTo(item, {
          x: fromX
        }, {
          x: 0,
          ease: 'none',
          scrollTrigger: {
            id: triggerId,
            trigger: item,
            start: 'top bottom',   // item enters from bottom
            end: 'top center',     // item reaches center of viewport
            scrub: scrubValue
          }
        });

        itemIndex++;
      });
    });

    // --- 2. Scale and opacity effect when item center is within 10% of viewport center ---
    // Uses a separate ScrollTrigger with a narrow trigger range
    var allStoryItems = storySection.querySelectorAll('.story-item');
    var focusIndex = 0;

    allStoryItems.forEach(function (item) {
      var focusTriggerId = ST_PREFIX + 'story-focus-' + focusIndex;

      gsap.fromTo(item, {
        scale: 0.97,
        opacity: 0.85
      }, {
        scale: 1.0,
        opacity: 1.0,
        ease: 'none',
        scrollTrigger: {
          id: focusTriggerId,
          trigger: item,
          // 10% of viewport center means the trigger zone is narrow:
          // start when item center is 10% below viewport center,
          // end when item center is 10% above viewport center
          start: 'center 60%',  // item center at 60% of viewport (10% below center)
          end: 'center 40%',    // item center at 40% of viewport (10% above center)
          scrub: scrubValue
        }
      });

      focusIndex++;
    });

    // --- 3. Background bommalu illustrations translating upward at Speed_Factor 0.2 ---
    var bgBommalu = storySection.querySelectorAll('.story-bg-bommalu');
    var bgIndex = 0;

    bgBommalu.forEach(function (el) {
      var bgTriggerId = ST_PREFIX + 'story-bg-' + bgIndex;

      el.classList.add('parallax-active');

      gsap.to(el, {
        yPercent: -(LAYER_CONFIGS.story.background.speedFactor * 100), // -20% (upward)
        ease: 'none',
        scrollTrigger: {
          id: bgTriggerId,
          trigger: storySection,
          start: 'top bottom',
          end: 'bottom top',
          scrub: scrubValue
        }
      });

      bgIndex++;
    });

    // --- 4. Floating rangoli elements (3–6 at Speed_Factor 0.15) ---
    _initStoryRangoli();
  }

  /**
   * Initializes 3–6 floating rangoli elements in the story section.
   * Each rangoli is acquired from the FloatingElementPool with Speed_Factor 0.15
   * and positioned within the story section area.
   *
   * Requirements: 3.3
   */
  function _initStoryRangoli() {
    // Guard: if pool is null or mobile, return early
    if (!_pool || _isMobile) {
      return;
    }

    var storySection = document.querySelector('#story');
    if (!storySection) return;

    // Generate random count between 3 and 6 (inclusive)
    var rangoliCount = Math.floor(Math.random() * 4) + 3; // 3 to 6

    var viewportHeight = window.innerHeight;
    var viewportWidth = window.innerWidth;

    // Get story section bounds for positioning
    var storyRect = storySection.getBoundingClientRect();
    var storyTop = storyRect.top + window.scrollY;

    for (var i = 0; i < rangoliCount; i++) {
      // Acquire a rangoli element from the pool
      var el = _pool.acquire('rangoli', 'story');

      // If pool is exhausted (max visible reached), stop creating
      if (!el) {
        break;
      }

      // Override the speed factor to 0.15 for story rangoli
      if (el._parallaxData) {
        el._parallaxData.speedFactor = 0.15;
      }

      // Position rangoli elements randomly within the story section area
      var randomX = Math.random() * (viewportWidth - 10);
      el.style.left = randomX + 'px';

      // Distribute across the story section height (using viewport-relative positioning)
      var randomY = Math.random() * viewportHeight;
      el.style.top = randomY + 'px';

      // Initialize currentY tracking for scroll-driven movement
      if (el._parallaxData) {
        el._parallaxData.currentY = 0;
      }
    }
  }

  // =====================================================================
  // CEREMONIES SECTION PINNED PARALLAX
  // =====================================================================

  // Store references for cleanup
  var _ceremoniesTweens = [];
  var _ceremoniesDiyaTimelines = [];
  var _ceremoniesParticleEls = [];

  /**
   * Initializes ceremonies section pinned parallax.
   * On viewports >700px:
   *   - Pins the section and scrubs ceremony cards through
   *   - Scroll distance = card count × 100vh
   *   - Card entry: 3D rotation -15deg→0deg X-axis, translateY 50px→0px, 1s, stagger 150ms
   * On viewports ≤700px:
   *   - Skip pinning entirely (static stacked layout)
   * Also creates:
   *   - Decorative diya elements (Speed_Factor 0.25, 15px oscillation, 4s period)
   *   - Gold particle drift (Speed_Factor 1.3, 15–25 particles, max 4px, max 0.35 opacity)
   *
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
   */
  function _initCeremoniesParallax() {
    // Guard: skip all parallax effects when reduced motion is active
    if (_isReduced) return;

    var gsapLib = window.gsap;
    if (!gsapLib || !window.ScrollTrigger) return;

    var ceremoniesSection = document.querySelector('#ceremonies');
    if (!ceremoniesSection) {
      console.warn('[ParallaxEngine] Ceremonies section not found. Skipping ceremonies parallax.');
      return;
    }

    var cards = ceremoniesSection.querySelectorAll('.ceremony-card');
    if (!cards || cards.length === 0) {
      console.warn('[ParallaxEngine] No ceremony cards found. Skipping ceremonies parallax.');
      return;
    }

    var scrubValue = PERF_CONFIG.scrubSmoothing;

    // --- SKIP PINNING ON MOBILE (≤700px) ---
    if (_isMobile) {
      // On mobile, no pinning — static stacked layout, no decorative effects
      return;
    }

    // --- DESKTOP PINNING (>700px) ---
    var cardCount = cards.length;
    var viewportHeight = window.innerHeight;
    var scrollDistance = cardCount * viewportHeight;

    // Ensure ceremonies section has relative positioning for absolute children
    ceremoniesSection.style.position = 'relative';
    ceremoniesSection.style.overflow = 'hidden';

    // Pin the ceremonies section over the calculated scroll distance
    var pinTrigger = window.ScrollTrigger.create({
      id: ST_PREFIX + 'ceremonies-pin',
      trigger: ceremoniesSection,
      start: 'top top',
      end: '+=' + scrollDistance,
      pin: true,
      scrub: scrubValue,
      pinSpacing: true
    });
    _ceremoniesTweens.push(pinTrigger);

    // --- CARD ENTRY ANIMATIONS ---
    // Each card animates in with 3D rotation and translateY, scrubbed to scroll progress
    // Stagger: each successive card starts 150ms equivalent later
    // Over 1s equivalent in scroll distance, with 150ms stagger between cards
    for (var i = 0; i < cardCount; i++) {
      var card = cards[i];

      // Calculate the scroll range for this card within the pinned section
      // Each card occupies one viewport height of scroll distance
      // Stagger offset: 150ms / 1000ms = 0.15 of one card's scroll range
      var staggerPx = (150 / 1000) * viewportHeight;
      var cardStart = (i * viewportHeight) + (i * staggerPx);
      var cardEnd = cardStart + viewportHeight;

      // Set perspective on the card for 3D transforms
      card.style.perspective = '1000px';
      card.style.transformStyle = 'preserve-3d';
      card.classList.add('parallax-active');

      var cardTween = gsapLib.fromTo(card,
        {
          rotateX: -15,
          y: 50,
          opacity: 0
        },
        {
          rotateX: 0,
          y: 0,
          opacity: 1,
          duration: 1,
          ease: 'power2.out',
          scrollTrigger: {
            id: ST_PREFIX + 'ceremonies-card-' + i,
            trigger: ceremoniesSection,
            start: 'top+=' + cardStart + ' top',
            end: 'top+=' + cardEnd + ' top',
            scrub: scrubValue
          }
        }
      );
      _ceremoniesTweens.push(cardTween);
    }

    // --- DECORATIVE DIYA ELEMENTS ---
    _initCeremoniesDiyas(ceremoniesSection);

    // --- GOLD PARTICLE DRIFT ---
    _initCeremoniesParticles(ceremoniesSection);
  }

  /**
   * Creates decorative diya elements in the ceremonies section background.
   * Speed_Factor 0.25, 15px horizontal oscillation, 4s period, ease-in-out.
   * @param {HTMLElement} ceremoniesSection - The ceremonies section element
   */
  function _initCeremoniesDiyas(ceremoniesSection) {
    var gsapLib = window.gsap;
    if (!gsapLib) return;

    // Create 3-5 diya elements
    var diyaCount = Math.floor(Math.random() * 3) + 3; // 3 to 5
    var viewportWidth = window.innerWidth;
    var sectionHeight = ceremoniesSection.offsetHeight || window.innerHeight;

    for (var i = 0; i < diyaCount; i++) {
      // Create diya element
      var diya = document.createElement('div');
      diya.className = 'parallax-float ceremony-diya';
      diya.style.position = 'absolute';
      diya.style.pointerEvents = 'none';
      diya.setAttribute('aria-hidden', 'true');
      diya.style.zIndex = '0';
      diya.style.width = '14px';
      diya.style.height = '18px';

      // Apply diya visual (inline SVG)
      diya.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 18" width="14" height="18">' +
        '<ellipse cx="7" cy="15" rx="6" ry="3" fill="#c44569" opacity="0.8"/>' +
        '<path d="M7 1 C4 6, 3 10, 7 13 C11 10, 10 6, 7 1Z" fill="#e8a838"/>' +
        '<path d="M7 3 C5.5 6, 5 9, 7 11 C9 9, 8.5 6, 7 3Z" fill="#ffcc02"/>' +
        '</svg>';

      // Random opacity in decorative range
      diya.style.opacity = (0.15 + Math.random() * 0.15).toFixed(2);

      // Position randomly within the section
      var randomX = Math.random() * (viewportWidth - 30);
      var randomY = Math.random() * sectionHeight;
      diya.style.left = randomX + 'px';
      diya.style.top = randomY + 'px';

      // Append to ceremonies section
      ceremoniesSection.appendChild(diya);

      // Create horizontal oscillation timeline
      // 15px amplitude, 4s period, ease-in-out, infinite repeat
      // yoyo: true means it goes 0→15→0→-15→0 etc. with 2s each direction = 4s total
      var oscillationTl = gsapLib.timeline({ repeat: -1, yoyo: true });
      oscillationTl.to(diya, {
        x: 15,
        duration: 2, // Half period (4s total = 2s each way with yoyo)
        ease: 'power1.inOut' // ease-in-out
      });

      _ceremoniesDiyaTimelines.push(oscillationTl);

      // Apply vertical parallax at Speed_Factor 0.25 via ScrollTrigger
      var diyaParallax = gsapLib.to(diya, {
        y: LAYER_CONFIGS.ceremonies.background.speedFactor * window.innerHeight,
        ease: 'none',
        scrollTrigger: {
          id: ST_PREFIX + 'ceremonies-diya-' + i,
          trigger: ceremoniesSection,
          start: 'top bottom',
          end: 'bottom top',
          scrub: PERF_CONFIG.scrubSmoothing
        }
      });
      _ceremoniesTweens.push(diyaParallax);
    }
  }

  /**
   * Creates gold particle drift elements in the ceremonies section foreground.
   * Speed_Factor 1.3, 15–25 particles, max 4px diameter, max 0.35 opacity.
   * @param {HTMLElement} ceremoniesSection - The ceremonies section element
   */
  function _initCeremoniesParticles(ceremoniesSection) {
    var gsapLib = window.gsap;
    if (!gsapLib) return;

    // Create 15-25 particles
    var particleCount = Math.floor(Math.random() * 11) + 15; // 15 to 25
    var viewportWidth = window.innerWidth;
    var sectionHeight = ceremoniesSection.offsetHeight || window.innerHeight;

    for (var i = 0; i < particleCount; i++) {
      // Create particle element
      var particle = document.createElement('div');
      particle.className = 'parallax-float ceremony-particle';
      particle.style.position = 'absolute';
      particle.style.pointerEvents = 'none';
      particle.setAttribute('aria-hidden', 'true');
      particle.style.zIndex = '10'; // Foreground layer

      // Random size: 1-4px diameter (max 4px)
      var size = Math.floor(Math.random() * 4) + 1;
      particle.style.width = size + 'px';
      particle.style.height = size + 'px';
      particle.style.borderRadius = '50%';

      // Gold color
      particle.style.background = 'var(--gold, #e8a838)';

      // Random opacity: 0.1 to 0.35 max
      var opacity = (0.1 + Math.random() * 0.25).toFixed(2);
      particle.style.opacity = opacity;

      // Random position within the section
      var randomX = Math.random() * viewportWidth;
      var randomY = Math.random() * sectionHeight;
      particle.style.left = randomX + 'px';
      particle.style.top = randomY + 'px';

      // Append to ceremonies section
      ceremoniesSection.appendChild(particle);
      _ceremoniesParticleEls.push(particle);

      // Apply vertical parallax at Speed_Factor 1.3 (moves faster than scroll)
      var particleParallax = gsapLib.to(particle, {
        y: LAYER_CONFIGS.ceremonies.foreground.speedFactor * window.innerHeight,
        ease: 'none',
        scrollTrigger: {
          id: ST_PREFIX + 'ceremonies-particle-' + i,
          trigger: ceremoniesSection,
          start: 'top bottom',
          end: 'bottom top',
          scrub: PERF_CONFIG.scrubSmoothing
        }
      });
      _ceremoniesTweens.push(particleParallax);
    }
  }

  // =====================================================================
  // GALLERY SECTION PARALLAX
  // =====================================================================

  /**
   * Linear interpolation helper.
   * @param {number} a - Start value
   * @param {number} b - End value
   * @param {number} t - Interpolation factor [0, 1]
   * @returns {number}
   */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Store reference to gallery ScrollTrigger instances for cleanup
  var _gallerySlotsTrigger = null;
  var _galleryBgTween = null;

  /**
   * Initializes gallery-specific parallax effects.
   * Creates distance-based scale/opacity/box-shadow interpolation for each
   * .bommalu-slot element, and a background counter-scroll at Speed_Factor -0.2.
   *
   * When the gallery section is not visible (deactivated), all slots are set to:
   * - scale: 0.85
   * - opacity: 0.7
   * - box-shadow: 0 0 0 0px rgba(232, 168, 56, 0)
   *
   * Coexists with existing bommalu-slot reveal animations by using
   * overwrite: 'auto' on gsap.set() calls.
   *
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 11.1
   */
  function _initGalleryParallax() {
    // Guard: skip all parallax effects when reduced motion is active
    if (_isReduced) return;

    var gsapLib = window.gsap;
    if (!gsapLib || !window.ScrollTrigger) return;

    var gallerySection = document.querySelector('#bommalu-showcase');
    if (!gallerySection) {
      console.warn('[ParallaxEngine] Gallery section (#bommalu-showcase) not found. Skipping gallery parallax.');
      return;
    }

    var slots = gallerySection.querySelectorAll('.bommalu-slot');
    if (!slots || slots.length === 0) {
      console.warn('[ParallaxEngine] No .bommalu-slot elements found. Skipping gallery parallax.');
      return;
    }

    var scrubValue = PERF_CONFIG.scrubSmoothing;
    var speedFactor = LAYER_CONFIGS.gallery.background.speedFactor; // -0.2

    // --- Background pattern counter-scroll ---
    // Translate the gallery section's background position in the opposite direction
    // of scroll (Speed_Factor -0.2 means it moves opposite to scroll direction).
    _galleryBgTween = gsapLib.to(gallerySection, {
      backgroundPositionY: (speedFactor * 100) + '%',
      ease: 'none',
      scrollTrigger: {
        id: ST_PREFIX + 'gallery-bg',
        trigger: gallerySection,
        start: 'top bottom',
        end: 'bottom top',
        scrub: scrubValue
      }
    });

    // --- Distance-based interpolation for .bommalu-slot elements ---
    // Use a single ScrollTrigger with onUpdate to compute per-slot effects
    // based on each slot's distance from the viewport center.
    var slotsArray = Array.prototype.slice.call(slots);

    // Set initial state for all slots (gallery not yet in view)
    slotsArray.forEach(function (slot) {
      gsapLib.set(slot, {
        scale: 0.85,
        opacity: 0.7,
        boxShadow: '0 0 0 0px rgba(232, 168, 56, 0)',
        overwrite: 'auto'
      });
    });

    // Create a ScrollTrigger on the gallery section that runs the
    // distance-based calculation on every scroll frame while active.
    _gallerySlotsTrigger = window.ScrollTrigger.create({
      id: ST_PREFIX + 'gallery-scale',
      trigger: gallerySection,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: function () {
        var viewportHeight = window.innerHeight;
        var viewportCenter = viewportHeight / 2;
        var maxD = viewportHeight / 2;

        slotsArray.forEach(function (slot) {
          // Get the element's bounding rect to find its vertical center
          var rect = slot.getBoundingClientRect();
          var elementCenter = rect.top + rect.height / 2;

          // Distance from element center to viewport center
          var d = Math.abs(elementCenter - viewportCenter);

          // Normalized distance factor [0, 1]
          var t = Math.min(d / maxD, 1);

          // Scale: lerp(1.0, 0.85, t) — closer to center = larger
          var scale = lerp(1.0, 0.85, t);

          // Opacity: lerp(1.0, 0.7, t) — closer to center = more opaque
          var opacity = lerp(1.0, 0.7, t);

          // Box-shadow: if d ≤ 50px, spread = lerp(20, 0, d/50); else spread = 0
          var spread = 0;
          if (d <= 50) {
            spread = lerp(20, 0, d / 50);
          }

          // Apply using gsap.set() for immediate updates
          // overwrite: 'auto' ensures coexistence with existing reveal animations
          gsapLib.set(slot, {
            scale: scale,
            opacity: opacity,
            boxShadow: '0 4px ' + spread.toFixed(1) + 'px rgba(232, 168, 56, ' + (spread > 0 ? 0.3 : 0) + ')',
            overwrite: 'auto'
          });
        });
      },
      onLeave: function () {
        // Gallery scrolled past — set to minimum state
        slotsArray.forEach(function (slot) {
          gsapLib.set(slot, {
            scale: 0.85,
            opacity: 0.7,
            boxShadow: '0 0 0 0px rgba(232, 168, 56, 0)',
            overwrite: 'auto'
          });
        });
      },
      onLeaveBack: function () {
        // Gallery scrolled above — set to minimum state
        slotsArray.forEach(function (slot) {
          gsapLib.set(slot, {
            scale: 0.85,
            opacity: 0.7,
            boxShadow: '0 0 0 0px rgba(232, 168, 56, 0)',
            overwrite: 'auto'
          });
        });
      }
    });
  }

  // =====================================================================
  // RSVP SECTION PARALLAX FOCUS EFFECT
  // =====================================================================

  // Store references for RSVP cleanup
  var _rsvpTriggers = [];
  var _rsvpVignetteEl = null;

  /**
   * Initializes RSVP section parallax focus effect:
   * 1. Decorative element parting: translates left (#rsvp::before) further left
   *    and right (#rsvp::after) further right by up to 40px at Speed_Factor 0.3
   *    as the form approaches viewport center. Uses CSS custom property
   *    --parallax-decor-offset on #rsvp that the pseudo-elements reference.
   * 2. Form scale/box-shadow: scales .rsvp-wrap from 0.98→1.0 with box-shadow
   *    spread 0→8px when at viewport center.
   * 3. Vignette overlay: opacity gradient at section edges that intensifies
   *    as the form approaches viewport center.
   * 4. Reduced motion: if active, display form at scale 1.0 with box-shadow 8px,
   *    skip all animations.
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4
   */
  function _initRsvpParallax() {
    // Guard: skip all parallax effects when reduced motion is active
    if (_isReduced) return;

    var gsapLib = window.gsap;
    if (!gsapLib || !window.ScrollTrigger) return;

    var rsvpSection = document.querySelector('#rsvp');
    if (!rsvpSection) {
      console.warn('[ParallaxEngine] RSVP section not found. Skipping RSVP parallax.');
      return;
    }

    var rsvpWrap = rsvpSection.querySelector('.rsvp-wrap');
    if (!rsvpWrap) {
      console.warn('[ParallaxEngine] .rsvp-wrap not found. Skipping RSVP parallax.');
      return;
    }

    // --- REDUCED MOTION: static fallback ---
    if (_isReduced) {
      // Display form at final state: scale 1.0, box-shadow 8px
      gsapLib.set(rsvpWrap, {
        scale: 1.0,
        boxShadow: '0 4px 8px rgba(232, 168, 56, 0.3)'
      });
      // Set decor offset to 0 (no parting)
      rsvpSection.style.setProperty('--parallax-decor-offset', '0px');
      return;
    }

    var scrubValue = PERF_CONFIG.scrubSmoothing;
    var speedFactor = LAYER_CONFIGS.rsvp.background.speedFactor; // 0.3

    // --- 1. Decorative element parting via CSS custom property ---
    // Set initial value for the custom property
    rsvpSection.style.setProperty('--parallax-decor-offset', '0px');

    // Create a ScrollTrigger that updates --parallax-decor-offset based on
    // how close the form is to the viewport center.
    // At start (section enters viewport from bottom): offset = 0
    // At center (form at viewport center): offset = 40px
    // At end (section exits viewport from top): offset = 0
    var decorTrigger = window.ScrollTrigger.create({
      id: ST_PREFIX + 'rsvp-decor',
      trigger: rsvpSection,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: function (self) {
        // Progress goes 0→1 as section scrolls through viewport.
        // We want max offset at progress ~0.5 (section center at viewport center).
        // Use a triangle function: offset = maxOffset * (1 - |2*progress - 1|)
        var progress = self.progress;
        var triangleFactor = 1 - Math.abs(2 * progress - 1);
        var maxOffset = 40 * speedFactor / 0.3; // 40px at Speed_Factor 0.3
        var offset = triangleFactor * maxOffset;

        rsvpSection.style.setProperty('--parallax-decor-offset', offset.toFixed(1) + 'px');
      }
    });
    _rsvpTriggers.push(decorTrigger);

    // --- 2. Form scale and box-shadow ---
    // Scale .rsvp-wrap from 0.98→1.0 and box-shadow spread 0→8px
    // as the form approaches viewport center (scrubbed).
    rsvpWrap.classList.add('parallax-active');

    // Use a fromTo with scrub that peaks at center.
    // We'll use a ScrollTrigger with onUpdate for precise center-based interpolation.
    var formTrigger = window.ScrollTrigger.create({
      id: ST_PREFIX + 'rsvp-focus',
      trigger: rsvpWrap,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: function () {
        // Calculate distance of .rsvp-wrap center from viewport center
        var rect = rsvpWrap.getBoundingClientRect();
        var viewportHeight = window.innerHeight;
        var viewportCenter = viewportHeight / 2;
        var elementCenter = rect.top + rect.height / 2;
        var distance = Math.abs(elementCenter - viewportCenter);
        var maxDistance = viewportHeight / 2;

        // Normalized factor: 0 = at center, 1 = at edge
        var t = Math.min(distance / maxDistance, 1);

        // Scale: lerp(1.0, 0.98, t) — at center = 1.0, at edge = 0.98
        var scale = lerp(1.0, 0.98, t);

        // Box-shadow spread: lerp(8, 0, t) — at center = 8px, at edge = 0px
        var spread = lerp(8, 0, t);

        gsapLib.set(rsvpWrap, {
          scale: scale,
          boxShadow: '0 4px ' + spread.toFixed(1) + 'px rgba(232, 168, 56, ' + (spread > 0 ? 0.3 : 0) + ')',
          overwrite: 'auto'
        });
      },
      onLeave: function () {
        gsapLib.set(rsvpWrap, {
          scale: 0.98,
          boxShadow: '0 4px 0px rgba(232, 168, 56, 0)',
          overwrite: 'auto'
        });
      },
      onLeaveBack: function () {
        gsapLib.set(rsvpWrap, {
          scale: 0.98,
          boxShadow: '0 4px 0px rgba(232, 168, 56, 0)',
          overwrite: 'auto'
        });
      }
    });
    _rsvpTriggers.push(formTrigger);

    // --- 3. Vignette overlay ---
    // Create a div with gradient overlay positioned over the RSVP section.
    // Opacity increases as form approaches viewport center.
    var vignette = document.createElement('div');
    vignette.className = 'rsvp-vignette';
    vignette.setAttribute('aria-hidden', 'true');
    vignette.style.position = 'absolute';
    vignette.style.inset = '0';
    vignette.style.pointerEvents = 'none';
    vignette.style.zIndex = '1';
    vignette.style.opacity = '0';
    // Linear gradient: dark at top/bottom edges, transparent at center
    vignette.style.background = 'linear-gradient(to bottom, rgba(30, 20, 10, 0.4) 0%, transparent 25%, transparent 75%, rgba(30, 20, 10, 0.4) 100%)';

    rsvpSection.appendChild(vignette);
    _rsvpVignetteEl = vignette;

    // Animate vignette opacity based on form proximity to viewport center
    var vignetteTrigger = window.ScrollTrigger.create({
      id: ST_PREFIX + 'rsvp-vignette',
      trigger: rsvpSection,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: function (self) {
        // Vignette intensity increases as form approaches center
        // Use triangle function: max at progress 0.5
        var progress = self.progress;
        var triangleFactor = 1 - Math.abs(2 * progress - 1);
        // Max opacity of the vignette overlay: 0.4 at section edges when form is centered
        vignette.style.opacity = (triangleFactor * 0.4).toFixed(3);
      },
      onLeave: function () {
        vignette.style.opacity = '0';
      },
      onLeaveBack: function () {
        vignette.style.opacity = '0';
      }
    });
    _rsvpTriggers.push(vignetteTrigger);
  }

  /**
   * Internal initialization logic (separated for re-init on motion pref change).
   * Returns early if reduced motion is active to prevent ScrollTrigger creation.
   */
  function _initialize() {
    // Guard: do not initialize any parallax effects when reduced motion is active
    if (_isReduced) {
      return;
    }

    // Initialize the floating element pool if not already created
    if (!_pool) {
      _pool = new FloatingElementPool(FLOAT_CONFIG.maxVisible);
    }

    // Initialize the performance monitor with degradation/recovery callbacks
    if (!_monitor) {
      _monitor = new PerformanceMonitor(
        PERF_CONFIG.targetFps,
        // Degradation callback: reduce floating elements by half, disable depth transitions
        function () {
          if (_pool) {
            _pool.reduceByHalf();
          }
          // Disable depth transitions by killing them
          _transitions.forEach(function (t) {
            t.kill();
          });
        },
        // Recovery callback: restore floating elements, re-enable depth transitions
        function () {
          if (_pool) {
            _pool.restore();
          }
          // Re-enable depth transitions by recreating them
          _transitions.forEach(function (t) {
            t.createTrigger();
          });
        }
      );
    }
    _monitor.start();

    // Initialize hero section parallax
    _initHeroParallax();

    // Initialize hero floating petals
    _initHeroPetals();

    // Initialize story section parallax
    _initStoryParallax();

    // Initialize ceremonies section pinned parallax
    _initCeremoniesParallax();

    // Initialize gallery section parallax
    _initGalleryParallax();

    // Initialize RSVP section parallax focus effect
    _initRsvpParallax();

    // Initialize depth transitions between adjacent sections
    _initDepthTransitions();

    // Wire Lenis scroll callback to drive floating element updates
    // Lenis provides { scroll, limit, velocity, direction, progress } on each scroll event.
    // We compute delta from the difference between current and previous scroll positions.
    if (_lenisInstance && _lenisInstance.on) {
      _previousLenisScroll = _lenisInstance.scroll || 0;

      _lenisScrollHandler = function (e) {
        var currentScroll = e.scroll !== undefined ? e.scroll : (e.animatedScroll !== undefined ? e.animatedScroll : 0);
        var delta = currentScroll - _previousLenisScroll;
        _previousLenisScroll = currentScroll;

        if (delta !== 0) {
          _updateFloatingElements(delta);
        }
      };

      _lenisInstance.on('scroll', _lenisScrollHandler);
    }
  }

  /**
   * Creates DepthTransition instances between adjacent main sections.
   * Adjacent pairs: hero→story, story→ceremonies, ceremonies→gallery, gallery→rsvp.
   * On mobile, blur is automatically disabled via the DepthTransition constructor
   * which checks _isMobile.
   *
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   */
  function _initDepthTransitions() {
    // Guard: skip all depth transitions when reduced motion is active
    if (_isReduced) return;

    // Define adjacent section pairs by their selectors
    var sectionPairs = [
      { exit: '.hero', enter: '#story' },
      { exit: '#story', enter: '#ceremonies' },
      { exit: '#ceremonies', enter: '#bommalu-showcase' },
      { exit: '#bommalu-showcase', enter: '#rsvp' }
    ];

    // Clear any existing transitions
    _transitions.forEach(function (t) {
      t.kill();
    });
    _transitions = [];

    sectionPairs.forEach(function (pair) {
      var exitEl = document.querySelector(pair.exit);
      var enterEl = document.querySelector(pair.enter);

      if (!exitEl || !enterEl) {
        console.warn('[ParallaxEngine] Depth transition skipped: missing section ' + pair.exit + ' or ' + pair.enter);
        return;
      }

      var transition = new DepthTransition(exitEl, enterEl);
      transition.createTrigger();
      _transitions.push(transition);
    });
  }

  /**
   * Internal teardown logic.
   * Kills all parallax- ScrollTriggers, resets all managed elements to
   * opacity 1 / transform none / filter none, and cleans up resources.
   */
  function _destroy() {
    // Kill all ScrollTrigger instances with parallax- prefix
    if (window.ScrollTrigger) {
      var allTriggers = window.ScrollTrigger.getAll();
      allTriggers.forEach(function (trigger) {
        if (trigger.vars && trigger.vars.id && trigger.vars.id.indexOf(ST_PREFIX) === 0) {
          trigger.kill();
        }
      });
    }

    // Reset all elements with .parallax-active class to their default visual state
    // This ensures opacity 1, transform none, filter none when reduced motion activates
    var activeElements = document.querySelectorAll('.parallax-active');
    if (activeElements && activeElements.length > 0) {
      activeElements.forEach(function (el) {
        el.style.opacity = '';
        el.style.transform = '';
        el.style.filter = '';
        // Use GSAP clearProps if available for thorough cleanup
        if (window.gsap) {
          window.gsap.set(el, { clearProps: 'transform,opacity,filter,scale,x,y,yPercent,xPercent,rotateX,boxShadow' });
        }
        el.classList.remove('parallax-active');
      });
    }

    // Deactivate all sections
    _sections.forEach(function (section) {
      section.deactivate();
    });

    // Destroy floating element pool
    if (_pool) {
      _pool.destroyAll();
    }

    // Stop performance monitor
    if (_monitor) {
      _monitor.stop();
      _monitor = null;
    }

    // Kill depth transitions
    _transitions.forEach(function (t) {
      t.kill();
    });

    // Clean up ceremonies-specific resources
    _ceremoniesDiyaTimelines.forEach(function (tl) {
      if (tl && tl.kill) tl.kill();
    });
    _ceremoniesDiyaTimelines = [];

    _ceremoniesParticleEls.forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    _ceremoniesParticleEls = [];

    _ceremoniesTweens.forEach(function (tween) {
      if (tween && tween.kill) tween.kill();
    });
    _ceremoniesTweens = [];

    // Clean up RSVP-specific resources
    _rsvpTriggers.forEach(function (trigger) {
      if (trigger && trigger.kill) trigger.kill();
    });
    _rsvpTriggers = [];

    if (_rsvpVignetteEl && _rsvpVignetteEl.parentNode) {
      _rsvpVignetteEl.parentNode.removeChild(_rsvpVignetteEl);
    }
    _rsvpVignetteEl = null;

    // Reset RSVP custom property
    var rsvpSection = document.querySelector('#rsvp');
    if (rsvpSection) {
      rsvpSection.style.removeProperty('--parallax-decor-offset');
    }

    // Remove Lenis scroll listener
    if (_lenisInstance && _lenisScrollHandler && _lenisInstance.off) {
      _lenisInstance.off('scroll', _lenisScrollHandler);
    }
    _lenisScrollHandler = null;
    _previousLenisScroll = 0;
  }

  // =====================================================================
  // PUBLIC API
  // =====================================================================

  var ParallaxEngine = {
    /**
     * Initialize the parallax engine.
     * Called after existing animations; receives shared Lenis instance.
     * @param {Object} lenisInstance - The shared Lenis smooth scroll instance
     */
    init: function (lenisInstance) {
      // Guard: check for required dependencies
      if (typeof window.gsap === 'undefined') {
        console.warn('[ParallaxEngine] GSAP not found. Parallax effects disabled.');
        return;
      }
      if (typeof window.ScrollTrigger === 'undefined') {
        console.warn('[ParallaxEngine] ScrollTrigger not found. Parallax effects disabled.');
        return;
      }

      // Early return if prefers-reduced-motion is active
      if (_isReduced) {
        console.info('[ParallaxEngine] Reduced motion preference detected. Parallax effects disabled.');
        // Still register the motion pref listener for live changes
        if (reducedMotionQuery.addEventListener) {
          reducedMotionQuery.addEventListener('change', _onMotionPrefChange);
        } else if (reducedMotionQuery.addListener) {
          reducedMotionQuery.addListener(_onMotionPrefChange);
        }
        return;
      }

      _lenisInstance = lenisInstance || null;
      _initialized = true;

      // Register media query listeners
      if (reducedMotionQuery.addEventListener) {
        reducedMotionQuery.addEventListener('change', _onMotionPrefChange);
      } else if (reducedMotionQuery.addListener) {
        reducedMotionQuery.addListener(_onMotionPrefChange);
      }

      if (mobileBreakpointQuery.addEventListener) {
        mobileBreakpointQuery.addEventListener('change', _onBreakpointChange);
      } else if (mobileBreakpointQuery.addListener) {
        mobileBreakpointQuery.addListener(_onBreakpointChange);
      }

      // Initialize internal components (implemented in later tasks)
      _initialize();
    },

    /**
     * Destroy the parallax engine.
     * Kills all "parallax-" ScrollTriggers, removes DOM elements,
     * and cleans up event listeners.
     */
    destroy: function () {
      _destroy();

      // Remove media query listeners
      if (reducedMotionQuery.removeEventListener) {
        reducedMotionQuery.removeEventListener('change', _onMotionPrefChange);
      } else if (reducedMotionQuery.removeListener) {
        reducedMotionQuery.removeListener(_onMotionPrefChange);
      }

      if (mobileBreakpointQuery.removeEventListener) {
        mobileBreakpointQuery.removeEventListener('change', _onBreakpointChange);
      } else if (mobileBreakpointQuery.removeListener) {
        mobileBreakpointQuery.removeListener(_onBreakpointChange);
      }

      _sections = [];
      _pool = null;
      _monitor = null;
      _transitions = [];
      _lenisInstance = null;
      _lenisScrollHandler = null;
      _previousLenisScroll = 0;
      _initialized = false;

      // Cancel any pending floating element rAF
      if (_floatRafId) {
        cancelAnimationFrame(_floatRafId);
        _floatRafId = null;
      }
      _floatFrameScheduled = false;
      _pendingScrollDelta = 0;
      _cumulativeScroll = 0;
    },

    /**
     * Update floating elements based on scroll delta.
     * Called from Lenis scroll callback or ScrollTrigger onUpdate.
     * @param {number} scrollDelta - Scroll distance since last update (positive = down)
     */
    updateFloats: function (scrollDelta) {
      _updateFloats(scrollDelta);
    },

    // Expose configuration for testing and external access
    LAYER_CONFIGS: LAYER_CONFIGS,
    FLOAT_CONFIG: FLOAT_CONFIG,
    MOBILE_CONFIG: MOBILE_CONFIG,
    PERF_CONFIG: PERF_CONFIG,
    ST_PREFIX: ST_PREFIX
  };

  // Expose on window
  window.ParallaxEngine = ParallaxEngine;

})();
