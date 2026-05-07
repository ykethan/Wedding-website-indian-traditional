// ===== Wedding Website JavaScript =====

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initCountdown();
    initScrollAnimations();
    initRSVPForm();
    initSmoothScroll();
});

// ===== Navigation =====
function initNavigation() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Scroll effect on navbar
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Update active nav link based on scroll position
        updateActiveNavLink();
    });

    // Mobile menu toggle
    navToggle.addEventListener('click', function() {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close mobile menu on link click
    navLinks.forEach(function(link) {
        link.addEventListener('click', function() {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    // Close mobile menu on outside click
    document.addEventListener('click', function(e) {
        if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
        }
    });
}

// Update active navigation link based on scroll position
function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    let currentSection = '';

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
}

// ===== Countdown Timer =====
function initCountdown() {
    // Set wedding date - February 15, 2025
    var weddingDate = new Date('2025-02-15T09:00:00').getTime();

    function updateCountdown() {
        var now = new Date().getTime();
        var distance = weddingDate - now;

        if (distance < 0) {
            // Wedding day has passed
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

    // Update immediately and then every second
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// ===== Scroll Animations =====
function initScrollAnimations() {
    var animatedElements = document.querySelectorAll('[data-animate]');

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var animationType = entry.target.getAttribute('data-animate');
                entry.target.classList.add('animate-in', animationType);
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    animatedElements.forEach(function(el) {
        el.style.opacity = '0';
        observer.observe(el);
    });
}

// ===== RSVP Form =====
function initRSVPForm() {
    var form = document.getElementById('rsvp-form');
    var successMessage = document.getElementById('rsvp-success');

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Gather form data
        var formData = {
            name: document.getElementById('guest-name').value,
            email: document.getElementById('guest-email').value,
            phone: document.getElementById('guest-phone').value,
            guests: document.getElementById('guest-count').value,
            events: getCheckedEvents(),
            message: document.getElementById('guest-message').value,
            attendance: getSelectedAttendance()
        };

        // Validate required fields
        if (!formData.name || !formData.email || !formData.attendance) {
            showFormError('Please fill in all required fields.');
            return;
        }

        // Validate email format
        if (!isValidEmail(formData.email)) {
            showFormError('Please enter a valid email address.');
            return;
        }

        // Simulate form submission
        var submitBtn = form.querySelector('.btn-submit');
        submitBtn.innerHTML = '<span>Sending...</span> <i class="fas fa-spinner fa-spin"></i>';
        submitBtn.disabled = true;

        setTimeout(function() {
            // Show success message
            form.style.display = 'none';
            successMessage.style.display = 'block';
            successMessage.style.animation = 'fadeInUp 0.6s ease';

            // Log form data (in production, send to server)
            console.log('RSVP Submitted:', formData);
        }, 1500);
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

function getSelectedAttendance() {
    var selected = document.querySelector('input[name="attendance"]:checked');
    return selected ? selected.value : null;
}

function isValidEmail(email) {
    var regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function showFormError(message) {
    // Remove any existing error
    var existingError = document.querySelector('.form-error');
    if (existingError) {
        existingError.remove();
    }

    var errorDiv = document.createElement('div');
    errorDiv.className = 'form-error';
    errorDiv.style.cssText = 'background: rgba(196, 30, 58, 0.2); border: 1px solid rgba(196, 30, 58, 0.5); color: #ff6b6b; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; font-size: 0.9rem; text-align: center;';
    errorDiv.textContent = message;

    var form = document.getElementById('rsvp-form');
    form.insertBefore(errorDiv, form.firstChild);

    // Auto-remove after 4 seconds
    setTimeout(function() {
        if (errorDiv.parentNode) {
            errorDiv.style.opacity = '0';
            errorDiv.style.transition = 'opacity 0.3s ease';
            setTimeout(function() {
                errorDiv.remove();
            }, 300);
        }
    }, 4000);
}

// ===== Smooth Scroll =====
function initSmoothScroll() {
    var links = document.querySelectorAll('a[href^="#"]');

    links.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            var targetId = this.getAttribute('href');
            var targetElement = document.querySelector(targetId);

            if (targetElement) {
                var offsetTop = targetElement.offsetTop - 70;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}
