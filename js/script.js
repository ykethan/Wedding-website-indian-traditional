// ===== Priya & Arjun Wedding Website - JavaScript =====
// Animations layered as progressive enhancement:
//   1. Lenis smooth scroll
//   2. Hero curtain unveil + staggered name reveal
//   3. Bommalu SVG self-drawing on scroll
//   4. Mangalsutra thread scrub in story timeline
//   5. Ceremony card 3D unfurl
//   6. Scroll progress thread with swaying pendant

(function () {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined';
  var hasST   = hasGSAP && typeof window.ScrollTrigger !== 'undefined';
  var hasLenis = typeof window.Lenis !== 'undefined';

  document.addEventListener('DOMContentLoaded', function () {
    // Always-on features
    initLanguageToggle();
    initCountdown();
    initMobileNav();

    if (prefersReduced || !hasGSAP || !hasST) {
      // Fallback: use the original IntersectionObserver reveal
      initLegacyReveal();
      return;
    }

    // JS is taking over — switch gating class
    document.body.classList.remove('no-js');
    document.body.classList.add('js-ready');

    window.gsap.registerPlugin(window.ScrollTrigger);

    initSmoothScroll();
    initBommaluDraw();
    initHeroTimeline();
    initStoryTimeline();
    initCeremonyCards();
    initGenericReveal();
    initScrollThread();
    initParallax();
  });

  // =====================================================================
  // 1. LENIS SMOOTH SCROLL
  // =====================================================================
  var lenis = null;
  function initSmoothScroll() {
    if (!hasLenis) return;

    lenis = new window.Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4
    });

    // Drive Lenis from GSAP's ticker for perfect sync with ScrollTrigger
    lenis.on('scroll', window.ScrollTrigger.update);
    window.gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    window.gsap.ticker.lagSmoothing(0);

    // Smooth anchor navigation
    document.querySelectorAll('nav a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var target = document.querySelector(link.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -60, duration: 1.4 });
      });
    });
  }

  // =====================================================================
  // 2. HERO TIMELINE (curtains + staggered reveal)
  // =====================================================================
  function initHeroTimeline() {
    var gsap = window.gsap;

    // Split name spans into per-character spans for stagger
    document.querySelectorAll('.hero-name').forEach(function (el) {
      wrapChars(el);
    });

    // Re-wrap when language toggles (Telugu chars are different length)
    window.addEventListener('wedding-lang-change', function () {
      // Wait one frame so setLang's textContent update lands first
      requestAnimationFrame(function () {
        document.querySelectorAll('.hero-name').forEach(function (el) {
          wrapChars(el);
          // After re-wrap, chars are hidden again — animate them back in
          window.gsap.to(el.querySelectorAll('.char'), {
            opacity: 1, y: 0, filter: 'blur(0px)',
            duration: 0.7, stagger: 0.03, ease: 'power3.out'
          });
        });
      });
    });

    // Hold scroll while intro plays (only if Lenis is active)
    if (lenis) lenis.stop();

    var tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: function () { if (lenis) lenis.start(); }
    });

    // Curtains part
    tl.to('.curtain-left',  { xPercent: -105, duration: 1.6, ease: 'power4.inOut' }, 0.1)
      .to('.curtain-right', { xPercent:  105, duration: 1.6, ease: 'power4.inOut' }, 0.1)

      // Badge fades up first
      .fromTo('.hero-badge',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.8 }, 0.6)

      // Corner ornaments settle in
      .fromTo('.corner',
        { opacity: 0, scale: 0.85 },
        { opacity: 0.6, scale: 1, duration: 0.9 }, 0.7)

      // Names draw character-by-character (rise + blur→focus)
      .to('.hero-name .char',
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.045 }, 0.85)

      // Divider
      .fromTo('.hero-divider',
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.7 }, 1.35)

      // Date + location
      .fromTo(['.hero-date', '.hero-location'],
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 }, 1.55)

      // Hero bommalu draws itself in parallel (triggered manually below)
      .add(function () { drawBommalu(document.querySelector('.hero-bommalu'), 1.6); }, 0.2)
      .add(function () {
        drawBommalu(document.querySelector('.side-bommalu.left'), 1.4);
        drawBommalu(document.querySelector('.side-bommalu.right'), 1.4);
      }, 0.4);

    // Scroll-linked: hero subtly zooms + fades as you scroll past it
    gsap.to('.hero-inner', {
      yPercent: -12,
      opacity: 0.7,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });

    gsap.to('.hero-bommalu', {
      yPercent: 14,
      scale: 1.05,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  }

  function wrapChars(el) {
    var text = el.textContent;
    el.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var span = document.createElement('span');
      span.className = 'char';
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      frag.appendChild(span);
    }
    el.appendChild(frag);
  }

  // =====================================================================
  // 3. BOMMALU SELF-DRAW
  // =====================================================================
  function initBommaluDraw() {
    var svgs = document.querySelectorAll('.bommalu-draw');
    if (!svgs.length) return;

    svgs.forEach(function (svg) {
      // Inline the symbol's children into this SVG so each copy owns its own
      // animatable paths (getTotalLength doesn't traverse <use> shadow trees).
      var useEl = svg.querySelector('use');
      if (useEl) {
        var href = useEl.getAttribute('href') || useEl.getAttribute('xlink:href');
        if (href && href.charAt(0) === '#') {
          var symbol = document.getElementById(href.slice(1));
          if (symbol) {
            // Copy viewBox from symbol if the SVG doesn't have one
            if (!svg.getAttribute('viewBox') && symbol.getAttribute('viewBox')) {
              svg.setAttribute('viewBox', symbol.getAttribute('viewBox'));
            }
            // Clone children (skip the <use>)
            var frag = document.createDocumentFragment();
            for (var i = 0; i < symbol.children.length; i++) {
              frag.appendChild(symbol.children[i].cloneNode(true));
            }
            svg.replaceChild(frag, useEl);
          }
        }
      }

      // Prepare each stroked element for the draw effect.
      // Solid-fill circles/ellipses (bindi, eyes, jewelry dots) are NOT drawn;
      // they're faded in via CSS after strokes finish.
      var paths = svg.querySelectorAll(
        'path, ellipse:not([fill="currentColor"]), circle:not([fill="currentColor"])'
      );
      var lengths = [];
      paths.forEach(function (p) {
        var len;
        try { len = p.getTotalLength(); } catch (e) { len = 0; }
        if (!len || !isFinite(len)) { lengths.push(0); return; }
        p.style.strokeDasharray  = len;
        p.style.strokeDashoffset = len;
        lengths.push(len);
      });
      svg._paths = paths;
      svg._lengths = lengths;
    });

    // Hero bommalu are drawn manually by the hero timeline; the rest
    // draw when they scroll into view.
    document.querySelectorAll('.bommalu-draw').forEach(function (svg) {
      if (svg.classList.contains('hero-bommalu') ||
          svg.classList.contains('side-bommalu')) return;

      window.ScrollTrigger.create({
        trigger: svg,
        start: 'top 88%',
        once: true,
        onEnter: function () {
          var rect = svg.getBoundingClientRect();
          var duration = rect.height > 200 ? 1.8 : 1.1;
          drawBommalu(svg, duration);
        }
      });
    });
  }

  function drawBommalu(svg, duration) {
    if (!svg || !svg._paths) return;
    svg.classList.add('is-drawing');
    var gsap = window.gsap;

    // Animate each path's dashoffset to 0; small overlap for organic feel
    var paths = svg._paths;
    var baseDelay = 0;
    paths.forEach(function (p, i) {
      if (!p.style.strokeDasharray) return;
      gsap.to(p, {
        strokeDashoffset: 0,
        duration: duration * 0.7,
        delay: baseDelay,
        ease: 'power2.inOut'
      });
      baseDelay += (duration * 0.3) / paths.length;
    });

    // When strokes are (approximately) done, reveal fills + mark drawn
    gsap.delayedCall(duration * 0.85, function () {
      svg.classList.remove('is-drawing');
      svg.classList.add('is-drawn');
    });
  }

  // =====================================================================
  // 4. STORY TIMELINE (mangalsutra thread scrub + item reveals)
  // =====================================================================
  function initStoryTimeline() {
    var gsap = window.gsap;
    var divider = document.querySelector('.story-divider-mid');

    if (divider) {
      // Inject the scrub-controlled thread element if not present
      if (!divider.querySelector('.mangalsutra-thread')) {
        var thread = document.createElement('div');
        thread.className = 'mangalsutra-thread';
        divider.insertBefore(thread, divider.firstChild);
      }
      var thread = divider.querySelector('.mangalsutra-thread');
      var pendant = divider.querySelector('.mangalsutra-pendant');

      // Reveal pendant once the story enters
      window.ScrollTrigger.create({
        trigger: '#story',
        start: 'top 70%',
        onEnter: function () { if (pendant) pendant.style.opacity = '1'; }
      });

      // Scrub thread height + pendant position while scrolling through story
      gsap.to(thread, {
        height: '100%',
        ease: 'none',
        scrollTrigger: {
          trigger: '#story',
          start: 'top 75%',
          end: 'bottom 55%',
          scrub: 0.6
        }
      });

      gsap.fromTo(pendant,
        { y: 0 },
        {
          y: function () { return divider.offsetHeight - 24; },
          ease: 'none',
          scrollTrigger: {
            trigger: '#story',
            start: 'top 75%',
            end: 'bottom 55%',
            scrub: 0.6,
            invalidateOnRefresh: true
          }
        });
    }

    // Stagger-reveal each story-item with year slide + text rise
    document.querySelectorAll('.story-item').forEach(function (item) {
      gsap.to(item, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: item,
          start: 'top 82%',
          once: true,
          onEnter: function () { item.classList.add('is-revealed'); }
        }
      });
      gsap.to(item.querySelector('.year'), {
        opacity: 1,
        x: 0,
        duration: 0.7,
        delay: 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: item, start: 'top 82%', once: true }
      });
    });
  }

  // =====================================================================
  // 5. CEREMONY CARDS (3D unfurl + shimmer)
  // =====================================================================
  function initCeremonyCards() {
    var gsap = window.gsap;
    var cards = document.querySelectorAll('.ceremony-card');
    if (!cards.length) return;

    // Inject the shimmer sweep element
    cards.forEach(function (card) {
      if (!card.querySelector('.card-sweep')) {
        var sweep = document.createElement('div');
        sweep.className = 'card-sweep';
        card.appendChild(sweep);
      }
    });

    // Trigger the whole row together for a cascading fan effect
    window.ScrollTrigger.create({
      trigger: '.ceremonies-grid',
      start: 'top 78%',
      once: true,
      onEnter: function () {
        gsap.to(cards, {
          opacity: 1,
          rotateX: 0,
          y: 0,
          duration: 1.1,
          ease: 'back.out(1.2)',
          stagger: 0.12,
          onStart: function () {
            cards.forEach(function (c, i) {
              setTimeout(function () { c.classList.add('is-revealed'); }, i * 120 + 100);
            });
          }
        });
      }
    });
  }

  // =====================================================================
  // 6. GENERIC .reveal HANDLING (section headers, rsvp, etc.)
  // =====================================================================
  function initGenericReveal() {
    var gsap = window.gsap;
    document.querySelectorAll('.reveal').forEach(function (el) {
      // Skip ones handled by more specific timelines
      if (el.classList.contains('story-col') ||
          el.classList.contains('ceremony-card') ||
          el.classList.contains('bommalu-slot')) {
        // story-col / cards handled elsewhere; make sure bommalu-slot wrapper reveals
        if (el.classList.contains('bommalu-slot')) {
          gsap.to(el, {
            opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 85%', once: true }
          });
        }
        return;
      }
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    });

    // story-col children are handled per-item; make sure the col itself is visible
    document.querySelectorAll('.story-col.reveal').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  // =====================================================================
  // 7. SCROLL PROGRESS THREAD
  // =====================================================================
  function initScrollThread() {
    var fill = document.querySelector('.scroll-thread-fill');
    var pendant = document.querySelector('.scroll-thread-pendant');
    if (!fill || !pendant) return;

    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? window.scrollY / max : 0;
      p = Math.max(0, Math.min(1, p));
      fill.style.height = (p * 100) + '%';
      // Pendant rides on top of the fill
      var trackH = document.querySelector('.scroll-thread').clientHeight;
      pendant.style.transform = 'translate(-50%, ' + (p * trackH - 4) + 'px)';
    }

    if (lenis) {
      lenis.on('scroll', update);
    } else {
      window.addEventListener('scroll', update, { passive: true });
    }
    window.addEventListener('resize', update);
    update();
  }

  // =====================================================================
  // 8. PATTERN BG PARALLAX
  // =====================================================================
  function initParallax() {
    var gsap = window.gsap;
    gsap.to('.pattern-bg', {
      yPercent: 30,
      ease: 'none',
      scrollTrigger: {
        trigger: 'body',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });

    // Initialize the Parallax_Engine after existing parallax setup
    if (window.ParallaxEngine) {
      window.ParallaxEngine.init(lenis);
    }
  }

  // =====================================================================
  // LEGACY FALLBACK (no GSAP / reduced motion)
  // =====================================================================
  function initLegacyReveal() {
    // Keep no-js class so CSS baseline applies (everything visible by default)
    // but still run the original IntersectionObserver for the subtle reveal.
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });
  }

  // =====================================================================
  // LANGUAGE TOGGLE (unchanged + broadcasts event for hero re-wrap)
  // =====================================================================
  function initLanguageToggle() {
    document.querySelectorAll('.lang-toggle button').forEach(function (btn) {
      btn.addEventListener('click', function () { setLang(btn.dataset.lang); });
    });
    try {
      var saved = localStorage.getItem('weddingLang');
      if (saved === 'te') setLang('te');
    } catch (e) {}
  }

  function setLang(lang) {
    document.body.classList.toggle('lang-te', lang === 'te');
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-en]').forEach(function (el) {
      var text = el.dataset[lang];
      if (text === undefined) return;
      if (text.indexOf('<em>') !== -1 || text.indexOf('&lt;em&gt;') !== -1) {
        el.innerHTML = text.replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>');
      } else {
        el.textContent = text;
      }
    });

    document.querySelectorAll('[data-en-ph]').forEach(function (el) {
      el.placeholder = el.dataset[lang + 'Ph'] || el.placeholder;
    });

    document.querySelectorAll('.lang-toggle button').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    try { localStorage.setItem('weddingLang', lang); } catch (e) {}

    // Notify the hero timeline so it can re-wrap hero-name chars
    window.dispatchEvent(new Event('wedding-lang-change'));
  }

  // =====================================================================
  // MOBILE NAV
  // =====================================================================
  function initMobileNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav    = document.querySelector('nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });

    nav.querySelectorAll('ul a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
      });
    });
  }

  // =====================================================================
  // COUNTDOWN TIMER
  // =====================================================================
  function initCountdown() {
    var target  = new Date('2026-08-23T11:30:00+05:30').getTime();
    var wrap    = document.getElementById('countdown');
    var married = document.getElementById('countdown-married');
    var daysEl  = document.getElementById('cd-days');
    var hoursEl = document.getElementById('cd-hours');
    var minsEl  = document.getElementById('cd-mins');
    var secsEl  = document.getElementById('cd-secs');

    if (!wrap) return;

    function pad(n) { return String(n).padStart(2, '0'); }

    function tick() {
      var diff = target - Date.now();

      if (diff <= 0) {
        wrap.hidden = true;
        if (married) married.hidden = false;
        return;
      }

      daysEl.textContent  = pad(Math.floor(diff / 86400000));
      hoursEl.textContent = pad(Math.floor((diff % 86400000) / 3600000));
      minsEl.textContent  = pad(Math.floor((diff % 3600000)  / 60000));
      secsEl.textContent  = pad(Math.floor((diff % 60000)    / 1000));

      setTimeout(tick, 1000);
    }

    tick();
  }
})();
