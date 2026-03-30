document.addEventListener("DOMContentLoaded", () => {
  // ============================================
  // DATA-DRIVEN RENDERING
  // ============================================

  // Social icon SVG templates
  const socialIcons = {
    twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>',
    github: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>',
    linkedin: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>',
    instagram: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>'
  };

  async function loadPortfolioData() {
    try {
      // Fetch directly from the JSON file to support GitHub Pages static hosting
      const res = await fetch('./data/portfolio.json');
      if (!res.ok) throw new Error('Failed to load data');
      const data = await res.json();
      
      // Filter out hidden/draft items on the frontend for static hosting
      return {
        ...data,
        sections: (data.sections || [])
          .filter(s => s.visible)
          .sort((a, b) => a.order - b.order),
        projects: (data.projects || [])
          .filter(p => p.status === 'published')
          .sort((a, b) => a.order - b.order)
      };
    } catch (err) {
      console.warn('Data unavailable.', err);
      return null;
    }
  }

  function renderPortfolio(data) {
    if (!data) return;

    const container = document.getElementById('sections-container');
    const navLinksContainer = document.getElementById('nav-links-container');
    const navPreview = document.getElementById('nav-preview');
    const sections = data.sections;
    const projects = data.projects;
    const site = data.site;

    // Update site logo
    const logo = document.getElementById('site-logo');
    if (logo && site.logo) logo.textContent = site.logo;

    // Update title
    if (site.title) document.title = site.title;

    // Build sections HTML
    let sectionsHTML = '';
    let navLinksHTML = '';
    let navPreviewHTML = '';

    sections.forEach((section, index) => {
      // Nav link
      navLinksHTML += `<a href="#${section.id}" data-index="${index}" class="hover-target nav-item">${escHtml(section.navLabel)}</a>`;

      // Nav preview
      if (section.type === 'hero') {
        navPreviewHTML += `<div class="nav-preview-content" data-index="${index}"><span class="solid">${escHtml(site.heroName?.line1 || 'MIRZA')}</span><br/><span class="outline italic">${escHtml(site.heroName?.line2 || 'MUDABBIR')}</span></div>`;
      } else if (section.type === 'about') {
        navPreviewHTML += `<div class="nav-preview-content mega-text" data-index="${index}"><span class="solid">${escHtml(site.logo || 'M.')}</span></div>`;
      } else if (section.type === 'work') {
        navPreviewHTML += `<div class="nav-preview-content" data-index="${index}"><span class="solid">PROJECTS</span></div>`;
      } else if (section.type === 'contact') {
        const contactContent = section.content || {};
        const socialLinks = contactContent.socialLinks || [];
        navPreviewHTML += `<div class="nav-preview-content nav-socials" data-index="${index}">${socialLinks.map(s => socialIcons[s.icon] || '').join('')}</div>`;
      } else {
        navPreviewHTML += `<div class="nav-preview-content" data-index="${index}"><span class="solid">${escHtml(section.navLabel)}</span></div>`;
      }

      // Section HTML
      if (section.type === 'hero') {
        sectionsHTML += `
          <section class="section sec-hero ${index === 0 ? 'active' : ''}" id="${section.id}">
            <div class="hero-top-tag">${escHtml(site.tagline)}</div>
            <div class="hero-text-container">
              <div class="hero-blob"></div>
              <h1 class="hero-title">
                <span class="solid">${escHtml(site.heroName?.line1 || 'MIRZA')}</span><br/>
                <span class="outline italic">${escHtml(site.heroName?.line2 || 'MUDABBIR')}</span>
              </h1>
            </div>
            <div class="hero-footer">
              <p>${escHtml(site.heroDescription)}</p>
            </div>
          </section>
        `;
      } else if (section.type === 'about') {
        const c = section.content || {};
        sectionsHTML += `
          <section class="section sec-about" id="${section.id}">
            <div class="about-grid">
              <div class="about-left">
                <h2 class="about-title">
                  ${escHtml(c.heading || 'ABOUT')}<br/><span class="outline italic">${escHtml(c.headingOutline || '')}</span>
                </h2>
                <p class="about-body">${escHtml(c.body || '')}</p>
                <div class="stats-row">
                  ${(c.stats || []).map(s => `
                    <div class="stat">
                      <div class="stat-number">${escHtml(s.title)}</div>
                      <div class="stat-label">${escHtml(s.label)}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
              <div class="about-right skills-grid ${(c.skillCards || []).length <= 2 ? 'two-cards' : ''}">
                ${(c.skillCards || []).map(sk => `
                  <div class="skill-card hover-target">
                    <div class="skill-connect">${escHtml(sk.connect)}</div>
                    <h3 class="skill-title">${escHtml(sk.title)}</h3>
                    <p class="skill-desc">${escHtml(sk.description)}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>
        `;
      } else if (section.type === 'work') {
        sectionsHTML += `
          <section class="section sec-work" id="${section.id}">
            <h2 class="work-title">PROJECTS</h2>
            <div class="work-grid">
              ${projects.map(p => `
                <a href="${escHtml(p.link)}" ${p.linkTarget === '_blank' ? 'target="_blank" rel="noopener noreferrer"' : ''} class="work-card hover-target">
                  <img src="${escHtml(p.image)}" alt="${escHtml(p.title)}" />
                  <div class="work-overlay">
                    <h3 class="work-card-title">${escHtml(p.title)}</h3>
                    <span class="work-card-cat">${escHtml(p.category)}</span>
                  </div>
                </a>
              `).join('')}
            </div>
          </section>
        `;
      } else if (section.type === 'contact') {
        const c = section.content || {};
        const socialLinks = c.socialLinks || [];
        sectionsHTML += `
          <section class="section sec-contact" id="${section.id}">
            <div class="contact-content">
              <h2 class="contact-title hover-target">${escHtml(c.heading || "LET'S CONNECT")}</h2>
              <div class="social-icons">
                ${socialLinks.map(s => `
                  <a href="${escHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="social-icon hover-target" data-tooltip="${escHtml(s.platform)}">
                    ${socialIcons[s.icon] || ''}
                  </a>
                `).join('')}
              </div>
            </div>
            <div class="footer-line">${escHtml(site.footerText)}</div>
          </section>
        `;
      } else if (section.type === 'content') {
        const c = section.content || {};
        sectionsHTML += `
          <section class="section sec-about" id="${section.id}">
            <div class="about-grid">
              <div class="about-left" style="max-width: 700px; width: 100%;">
                <h2 class="about-title" style="margin-bottom: 2rem;">
                  ${escHtml(c.heading || '')}<br/><span class="outline italic">${escHtml(c.subheading || '')}</span>
                </h2>
                <p class="about-body" style="white-space: pre-wrap; font-size: 1.1rem; color: var(--text-secondary);">${escHtml(c.body || '')}</p>
              </div>
              <div class="about-right" style="display: flex; align-items: center; justify-content: center;">
                ${c.image ? `<img src="${escHtml(c.image)}" alt="Content image" style="width: 100%; border-radius: 8px; object-fit: cover; max-height: 60vh;" />` : ''}
              </div>
            </div>
          </section>
        `;
      } else if (section.type === 'gallery') {
        const c = section.content || {};
        sectionsHTML += `
          <section class="section sec-work" id="${section.id}">
            <h2 class="work-title">${escHtml(c.heading || 'GALLERY')}</h2>
            <div class="work-grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
              ${(c.images || []).map(img => `
                <div class="work-card hover-target" style="height: 350px;">
                  <img src="${escHtml(img)}" alt="Gallery image" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
              `).join('')}
            </div>
          </section>
        `;
      } else if (section.type === 'text') {
        const c = section.content || {};
        sectionsHTML += `
          <section class="section sec-hero" id="${section.id}" style="align-items: center; justify-content: center; text-align: center; display: flex;">
            <div style="max-width: 900px; width: 100%; padding: 0 5vw;">
              <h2 style="font-family: var(--font-display); font-size: clamp(2.5rem, 5vw, 4.5rem); line-height: 1.1; margin-bottom: 2.5rem; text-transform: uppercase;">
                ${escHtml(c.heading || '')}
              </h2>
              <p style="font-size: clamp(1.1rem, 2vw, 1.5rem); color: var(--text-secondary); white-space: pre-wrap; font-family: var(--font-mono);">${escHtml(c.body || '')}</p>
            </div>
          </section>
        `;
      } else if (section.type === 'cta') {
        const c = section.content || {};
        sectionsHTML += `
          <section class="section sec-hero" id="${section.id}" style="align-items: center; justify-content: center; text-align: center; display: flex;">
            <div style="max-width: 800px; width: 100%; padding: 0 5vw; display: flex; flex-direction: column; align-items: center;">
              <h2 style="font-family: var(--font-display); font-size: clamp(3rem, 6vw, 5rem); line-height: 1; margin-bottom: 1.5rem; text-transform: uppercase;">
                <span class="solid">${escHtml(c.heading || '')}</span>
              </h2>
              <p style="font-size: 1.25rem; color: var(--text-secondary); margin-bottom: 3rem; white-space: pre-wrap;">${escHtml(c.body || '')}</p>
              <a href="${escHtml(c.buttonUrl || '#')}" class="hover-target" style="display: inline-flex; align-items: center; justify-content: center; padding: 1.25rem 3rem; border: 1px solid var(--text); border-radius: 4px; font-family: var(--font-mono); font-size: 1rem; color: var(--bg); background-color: var(--text); text-decoration: none; text-transform: uppercase; transition: all 0.3s ease;">
                ${escHtml(c.buttonText || 'Learn More')}
              </a>
            </div>
          </section>
        `;
      }
    });

    container.innerHTML = sectionsHTML;
    navLinksContainer.innerHTML = navLinksHTML;
    navPreview.innerHTML = navPreviewHTML;

    // Update progress total
    document.getElementById('prog-total').textContent = `0${sections.length}`;

    // Initialize all interactions after render
    initInteractions();
  }

  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================
  // INTERACTIONS (preserved from original)
  // ============================================
  function initInteractions() {
    const cursor = document.getElementById("cursor");
    const hoverTargets = document.querySelectorAll(".hover-target, a, button");
    const blobs = [
      { el: document.querySelector(".blob-1"), depth: 0.5 },
      { el: document.querySelector(".blob-2"), depth: 1.0 },
      { el: document.querySelector(".blob-3"), depth: 1.5 }
    ];
    const navOverlay = document.getElementById("nav-overlay");
    const menuBtn = document.getElementById("menu-btn");
    const navItems = document.querySelectorAll(".nav-item");
    const navPreviewContainer = document.getElementById("nav-preview");
    const navPreviewContents = document.querySelectorAll(".nav-preview-content");
    const sections = document.querySelectorAll(".section");
    const progCurrent = document.querySelector(".prog-current");

    let currentSectionIndex = 0;
    let isAnimating = false;
    let menuOpen = false;

    // --- Custom Cursor ---
    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let mouseX = cursorX;
    let mouseY = cursorY;

    window.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      const xPos = (mouseX / window.innerWidth - 0.5) * 40;
      const yPos = (mouseY / window.innerHeight - 0.5) * 40;

      blobs.forEach(blob => {
        if (blob.el) {
          gsap.to(blob.el, {
            x: xPos * blob.depth,
            y: yPos * blob.depth,
            duration: 1,
            ease: "power2.out"
          });
        }
      });
    });

    gsap.ticker.add(() => {
      cursorX += (mouseX - cursorX) * 0.2;
      cursorY += (mouseY - cursorY) * 0.2;
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
    });

    hoverTargets.forEach(target => {
      target.addEventListener("mouseenter", () => cursor.classList.add("hovered"));
      target.addEventListener("mouseleave", () => cursor.classList.remove("hovered"));
    });

    // --- Menu Logic ---
    menuBtn.addEventListener("click", () => {
      menuOpen = !menuOpen;
      if (menuOpen) {
        navOverlay.classList.add("open");
        document.querySelector(".menu-label").innerText = "CLOSE";
      } else {
        navOverlay.classList.remove("open");
        document.querySelector(".menu-label").innerText = "MENU";
      }
    });

    navItems.forEach((item, index) => {
      item.addEventListener("mouseenter", () => {
        navPreviewContents.forEach(c => c.classList.remove("active"));
        if (navPreviewContents[index]) {
          navPreviewContents[index].classList.add("active");
        }
        navPreviewContainer.classList.add("show");
      });
      item.addEventListener("mouseleave", () => {
        navPreviewContainer.classList.remove("show");
      });
      item.addEventListener("click", (e) => {
        e.preventDefault();
        menuBtn.click();
        const targetIndex = parseInt(item.getAttribute("data-index"));
        if (window.innerWidth <= 768) {
          document.getElementById(item.getAttribute("href").substring(1)).scrollIntoView({ behavior: "smooth" });
        } else {
          if (targetIndex !== currentSectionIndex) {
            goToSection(targetIndex);
          }
        }
      });
    });

    // --- Section Transitions ---
    function goToSection(index) {
      if (window.innerWidth <= 768) return;
      if (isAnimating || index < 0 || index >= sections.length) return;
      isAnimating = true;

      const currentSection = sections[currentSectionIndex];
      const nextSection = sections[index];
      const isScrollingDown = index > currentSectionIndex;

      progCurrent.innerText = `0${index + 1}`;

      currentSection.classList.remove("active");

      gsap.to(currentSection, {
        scale: isScrollingDown ? 0.95 : 1.05,
        opacity: 0,
        duration: 1,
        ease: "cubic-bezier(0.23, 1, 0.32, 1)"
      });

      nextSection.classList.add("active");
      gsap.fromTo(nextSection, {
        scale: isScrollingDown ? 1.05 : 0.95,
        opacity: 0
      }, {
        scale: 1,
        opacity: 1,
        duration: 1,
        ease: "cubic-bezier(0.23, 1, 0.32, 1)",
        onComplete: () => {
          isAnimating = false;
          currentSectionIndex = index;
        }
      });
    }

    // Wheel and Touch Logic
    let touchStartY = 0;
    window.addEventListener("wheel", (e) => {
      if (window.innerWidth <= 768 || menuOpen) return;
      if (Math.abs(e.deltaY) > 30) {
        if (e.deltaY > 0) {
          goToSection(currentSectionIndex + 1);
        } else {
          goToSection(currentSectionIndex - 1);
        }
      }
    });

    window.addEventListener("touchstart", e => {
      if (window.innerWidth <= 768) return;
      touchStartY = e.changedTouches[0].screenY;
    });

    window.addEventListener("touchend", e => {
      if (window.innerWidth <= 768 || menuOpen) return;
      const touchEndY = e.changedTouches[0].screenY;
      if (touchStartY - touchEndY > 50) {
        goToSection(currentSectionIndex + 1);
      } else if (touchEndY - touchStartY > 50) {
        goToSection(currentSectionIndex - 1);
      }
    });

    // Hero entry animations
    gsap.from(".hero-title span", {
      y: 100,
      opacity: 0,
      stagger: 0.1,
      duration: 1.2,
      delay: 0.2,
      ease: "power4.out"
    });
    gsap.from(".hero-footer, .hero-top-tag", {
      y: 20,
      opacity: 0,
      duration: 1,
      delay: 0.5,
      ease: "power4.out"
    });
  }

  // ============================================
  // LOADER (unchanged)
  // ============================================
  const loader = document.getElementById("loader");
  const counterEl = document.getElementById("loader-counter");
  let loadProgress = 0;

  const loadInterval = setInterval(() => {
    loadProgress += Math.floor(Math.random() * 10) + 5;
    if (loadProgress >= 100) {
      loadProgress = 100;
      clearInterval(loadInterval);
      setTimeout(hideLoader, 500);
    }
    counterEl.innerText = loadProgress.toString().padStart(2, "0");
  }, 100);

  async function hideLoader() {
    // Load and render data before showing
    const data = await loadPortfolioData();
    if (data) {
      renderPortfolio(data);
    }

    gsap.to(loader, {
      yPercent: -100,
      duration: 1,
      ease: "power4.inOut",
      onComplete: () => {
        loader.style.display = "none";
        document.body.classList.remove("loading");
      }
    });
  }

});
