document.addEventListener("DOMContentLoaded", () => {
  // Elements
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

  // --- Loader Logic ---
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

  function hideLoader() {
    gsap.to(loader, {
      yPercent: -100,
      duration: 1,
      ease: "power4.inOut",
      onComplete: () => {
        loader.style.display = "none";
        document.body.classList.remove("loading");
      }
    });

    // Animate Hero Elements In
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

  // --- Custom Cursor ---
  let cursorX = window.innerWidth / 2;
  let cursorY = window.innerHeight / 2;
  let mouseX = cursorX;
  let mouseY = cursorY;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Magnetic Blobs
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

  // GSAP loop for smooth cursor tracking
  gsap.ticker.add(() => {
    // Lerp for smooth cursor
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

    // Update Progress indicator
    progCurrent.innerText = `0${index + 1}`;

    // Reset classes
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

  // Wheel and Touch Logic for scrolling sections
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

});
