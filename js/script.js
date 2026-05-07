// ===== Pelli Pandiri - Wedding Website JavaScript =====

document.addEventListener('DOMContentLoaded', function() {
  initScrollReveal();
  initCountdown();
  initLanguageToggle();
  initNavigation();
  initRSVPForm();
});

// ===== Scroll Reveal Animations =====
function initScrollReveal() {
  var revealElements = document.querySelectorAll('.reveal');
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12 });

  revealElements.forEach(function(el) {
    observer.observe(el);
  });
}

// ===== Countdown Timer =====
function initCountdown() {
  // Wedding date: December 14, 2024 at 7:15 AM (Muhurtham)
  var weddingDate = new Date('2024-12-14T07:15:00').getTime();

  function updateCountdown() {
    var now = new Date().getTime();
    var distance = weddingDate - now;

    if (distance < 0) {
      document.getElementById('days').textContent = '00';
      document.getElementById('hours').textContent = '00';
      document.getElementById('minutes').textContent = '00';
      document.getElementById('seconds').textContent = '00';
      return;
    }

    var days = Math.floor(distance / (1000 * 60 * 60 * 24));
    var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((distance % (1000 * 60)) / 1000);

    document.getElementById('days').textContent = String(days).padStart(2, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
}

// ===== Language Toggle (English / Telugu) =====
function initLanguageToggle() {
  var buttons = document.querySelectorAll('.lang-toggle button');

  function setLang(lang) {
    // Toggle body class for Telugu font mode
    document.body.classList.toggle('lang-te', lang === 'te');
    document.documentElement.lang = lang;

    // Update all elements with data-en / data-te attributes
    document.querySelectorAll('[data-en]').forEach(function(el) {
      var text = el.getAttribute('data-' + lang);
      if (text === null) return;
      // Allow <em> tags for emphasis in headings
      if (text.indexOf('<em>') !== -1) {
        el.innerHTML = text;
      } else {
        el.textContent = text;
      }
    });

    // Update placeholders
    document.querySelectorAll('[data-en-ph]').forEach(function(el) {
      var ph = el.getAttribute('data-' + lang + '-ph');
      if (ph) el.placeholder = ph;
    });

    // Update select options
    document.querySelectorAll('select option[data-en]').forEach(function(opt) {
      var text = opt.getAttribute('data-' + lang);
      if (text) opt.textContent = text;
    });

    // Update active button state
    buttons.forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    // Save preference
    try { localStorage.setItem('weddingLang', lang); } catch(e) {}
  }

  // Bind click events
  buttons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      setLang(btn.getAttribute('data-lang'));
    });
  });

  // Restore saved preference
  try {
    var saved = localStorage.getItem('weddingLang');
    if (saved === 'te') setLang('te');
  } catch(e) {}
}

// ===== Navigation =====
function initNavigation() {
  var navLinks = document.querySelectorAll('.nav-link');

  // Smooth scroll for nav links
  navLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var targetId = this.getAttribute('href');
      var targetElement = document.querySelector(targetId);
      if (targetElement) {
        var offsetTop = targetElement.offsetTop - 60;
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
      }
    });
  });

  // Update active nav link on scroll
  window.addEventListener('scroll', function() {
    var sections = document.querySelectorAll('section[id]');
    var currentSection = '';

    sections.forEach(function(section) {
      var sectionTop = section.offsetTop - 100;
      var sectionHeight = section.offsetHeight;
      if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
        currentSection = section.getAttribute('id');
      }
    });

    navLinks.forEach(function(link) {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + currentSection) {
        link.classList.add('active');
      }
    });
  });
}

// ===== RSVP Form =====
function initRSVPForm() {
  var form = document.getElementById('rsvp-form');
  var successEl = document.getElementById('rsvp-success');

  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    var name = document.getElementById('guest-name').value.trim();
    var email = document.getElementById('guest-email').value.trim();
    var isTelugu = document.body.classList.contains('lang-te');

    // Validate
    if (!name) {
      alert(isTelugu ? 'దయచేసి మీ పేరు నమోదు చేయండి.' : 'Please enter your name.');
      return;
    }
    if (!email || !isValidEmail(email)) {
      alert(isTelugu ? 'దయచేసి చెల్లుబాటు అయ్యే ఇమెయిల్ నమోదు చేయండి.' : 'Please enter a valid email address.');
      return;
    }

    // Gather form data
    var formData = {
      name: name,
      email: email,
      guests: document.getElementById('guest-count').value,
      events: getCheckedEvents(),
      dietary: document.getElementById('guest-message').value.trim()
    };

    // Simulate submission
    var submitBtn = form.querySelector('.btn-submit');
    var originalText = submitBtn.textContent;
    submitBtn.textContent = isTelugu ? 'పంపుతోంది...' : 'Sending...';
    submitBtn.disabled = true;

    setTimeout(function() {
      form.style.display = 'none';
      successEl.style.display = 'block';
      console.log('RSVP Submitted:', formData);
    }, 1200);
  });
}

function getCheckedEvents() {
  var checkboxes = document.querySelectorAll('input[name="events"]:checked');
  var events = [];
  checkboxes.forEach(function(cb) {
    events.push(cb.value);
  });
  return events;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
