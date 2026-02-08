document.addEventListener('DOMContentLoaded', () => {
    // Marvel Style Intro Logic
    const intro = document.querySelector('.intro-overlay');
    const marvelTexts = document.querySelectorAll('.marvel-text');
    const marvelFinal = document.querySelector('.marvel-final');
    const body = document.body;

    if (intro) {
        // Activate blur
        setTimeout(() => {
            intro.classList.add('active');
        }, 10);

        let delay = 0;
        const wordDuration = 250; // Increased from 100 for longer visibility

        // Animate each word
        marvelTexts.forEach((text, index) => {
            setTimeout(() => {
                text.style.animation = `flicker ${wordDuration * 1.5}ms ease-out forwards`;
            }, delay);
            delay += wordDuration;
        });

        // Show final logo
        setTimeout(() => {
            marvelFinal.style.opacity = '1';
            marvelFinal.style.animation = 'finalReveal 0.8s cubic-bezier(0.2, 1, 0.3, 1) forwards';
        }, delay + 200);

        // Start exit transition (Wait longer for the logo to stay)
        setTimeout(() => {
            intro.classList.add('exit');
            
            // Allow scrolling and cleanup
            setTimeout(() => {
                body.classList.remove('loading');
                intro.classList.add('finished');
                // Trigger hero animations after intro
                document.querySelectorAll('.hero .fade-in').forEach((el, index) => {
                    setTimeout(() => {
                        el.style.opacity = '1';
                        el.style.transform = 'translateY(0)';
                    }, index * 200);
                });
            }, 1000); // Wait for CSS transition (1s) to finish
        }, delay + 3500); // Logo stays for ~3.5 seconds
    }

    // Navbar Scroll Effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile Menu Toggle
    const burger = document.querySelector('.burger');
    const nav = document.querySelector('.nav-links');
    const navLinks = document.querySelectorAll('.nav-links li');

    burger.addEventListener('click', () => {
        // Toggle Nav
        nav.classList.toggle('nav-active');

        // Animate Links
        navLinks.forEach((link, index) => {
            if (link.style.animation) {
                link.style.animation = '';
            } else {
                link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
            }
        });

        // Burger Animation
        burger.classList.toggle('toggle');
    });

    // Close mobile menu when a link is clicked
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('nav-active');
            burger.classList.remove('toggle');
            navLinks.forEach(link => link.style.animation = '');
        });
    });

    // Smooth Scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Reveal Animations on Scroll
    const revealElements = document.querySelectorAll('.blog-card, .about-grid, .contact-box, .section-header');
    
    const revealOnScroll = () => {
        const triggerBottom = window.innerHeight * 0.8;

        revealElements.forEach(el => {
            const elTop = el.getBoundingClientRect().top;

            if (elTop < triggerBottom) {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }
        });
    };

    // Initial styles for reveal animation
    revealElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.8s ease-out';
    });

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Run once on load

    // Form Submission Handling
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Get form values
            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());
            
            // Simple visual feedback
            const btn = contactForm.querySelector('button');
            const originalText = btn.textContent;
            
            btn.textContent = 'Gönderiliyor...';
            btn.disabled = true;
            
            setTimeout(() => {
                alert('Mesajınız başarıyla gönderildi! (Bu bir demodur)');
                btn.textContent = originalText;
                btn.disabled = false;
                contactForm.reset();
            }, 1500);
        });
    }
});

// Add keyframes for nav links fade in CSS dynamically or in style.css
const style = document.createElement('style');
style.textContent = `
    @keyframes navLinkFade {
        from {
            opacity: 0;
            transform: translateX(50px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    .burger.toggle .line1 {
        transform: rotate(-45deg) translate(-5px, 6px);
    }
    .burger.toggle .line2 {
        opacity: 0;
    }
    .burger.toggle .line3 {
        transform: rotate(45deg) translate(-5px, -6px);
    }
`;
document.head.appendChild(style);
