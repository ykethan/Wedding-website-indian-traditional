// ===== Priya & Arjun Wedding Website - JavaScript =====

document.addEventListener('DOMContentLoaded', function() {
  initScrollReveal();
  initLanguageToggle();
  initRSVP();
});

// ===== Scroll Reveal =====
function initScrollReveal() {
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(function(el) {
    observer.observe(el);
  });
}

// ===== Language Toggle (English / Telugu) =====
function initLanguageToggle() {
  document.querySelectorAll('.lang-toggle button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setLang(btn.dataset.lang);
    });
  });

  // Restore saved language preference
  try {
    var saved = localStorage.getItem('weddingLang');
    if (saved === 'te') setLang('te');
  } catch(e) {}
}

function setLang(lang) {
  document.body.classList.toggle('lang-te', lang === 'te');
  document.documentElement.lang = lang;

  // Update text content for all elements with data-en/data-te attributes
  document.querySelectorAll('[data-en]').forEach(function(el) {
    var text = el.dataset[lang];
    if (text === undefined) return;
    // Allow simple <em> tags for emphasis in headings
    if (text.indexOf('<em>') !== -1 || text.indexOf('&lt;em&gt;') !== -1) {
      el.innerHTML = text.replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>');
    } else {
      el.textContent = text;
    }
  });

  // Update placeholders
  document.querySelectorAll('[data-en-ph]').forEach(function(el) {
    el.placeholder = el.dataset[lang + 'Ph'] || el.placeholder;
  });

  // Update active state on toggle buttons
  document.querySelectorAll('.lang-toggle button').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // Save preference
  try { localStorage.setItem('weddingLang', lang); } catch(e) {}
}

// ===== RSVP Form Submit =====
function initRSVP() {
  var submitBtn = document.querySelector('.btn-submit');
  if (!submitBtn) return;

  submitBtn.addEventListener('click', function() {
    var nameInput = document.querySelector('#rsvp input[type="text"]');
    var name = nameInput ? nameInput.value.trim() : '';
    var isTe = document.body.classList.contains('lang-te');

    if (!name) {
      alert(isTe ? 'దయచేసి మీ పేరు నమోదు చేయండి.' : 'Please enter your name.');
      return;
    }

    if (isTe) {
      alert('🪷 ధన్యవాదాలు, ' + name + '! మీ స్పందన అందింది. మీతో కలిసి జరుపుకోవడానికి ఎదురుచూస్తున్నాము!');
    } else {
      alert('🪷 Dhanyavadalu, ' + name + '! Your RSVP has been received. We look forward to celebrating with you!');
    }
  });
}
