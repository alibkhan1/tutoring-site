// Mobile nav toggle
document.addEventListener("DOMContentLoaded", async () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }

  // Highlight current page in nav
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === path || (path === "" && href === "index.html")) {
      a.classList.add("active");
    }
  });

  // Hero slider ("Upcoming")
  if (window.siteContentReady) await window.siteContentReady;
  const slides = document.querySelectorAll(".slide");
  const dotsWrap = document.querySelector(".slider-dots");
  if (slides.length) {
    let idx = 0;
    slides.forEach((s, i) => {
      const dot = document.createElement("button");
      if (i === 0) dot.classList.add("active");
      dot.addEventListener("click", () => show(i));
      dotsWrap.appendChild(dot);
    });
    const dots = dotsWrap.querySelectorAll("button");

    function show(i) {
      slides[idx].classList.remove("active");
      dots[idx].classList.remove("active");
      idx = i;
      slides[idx].classList.add("active");
      dots[idx].classList.add("active");
    }

    let timer;
    const startSlider = () => {
      clearInterval(timer);
      timer = setInterval(() => show((idx + 1) % slides.length), 5000);
    };
    startSlider();
    const track = document.querySelector(".slider-track");
    if (track) {
      track.addEventListener("mouseenter", () => clearInterval(timer));
      track.addEventListener("mouseleave", startSlider);
    }
  }

  // Auto-moving photo carousels used by STEM Fair and Pi Day.
  document.querySelectorAll(".media-carousel").forEach((carousel) => {
    const mediaSlides = [...carousel.querySelectorAll(".media-slide")];
    const dotsWrap = carousel.querySelector(".media-dots");
    if (mediaSlides.length < 2 || !dotsWrap) return;
    let index = 0;
    let timer;
    const show = (nextIndex) => {
      mediaSlides[index].classList.remove("active");
      dotsWrap.children[index]?.classList.remove("active");
      index = nextIndex;
      mediaSlides[index].classList.add("active");
      dotsWrap.children[index]?.classList.add("active");
    };
    mediaSlides.forEach((_, slideIndex) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `Show photo ${slideIndex + 1}`);
      if (slideIndex === 0) dot.classList.add("active");
      dot.addEventListener("click", () => show(slideIndex));
      dotsWrap.appendChild(dot);
    });
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => show((index + 1) % mediaSlides.length), Number(carousel.dataset.interval) || 4500);
    };
    start();
    carousel.addEventListener("mouseenter", () => clearInterval(timer));
    carousel.addEventListener("mouseleave", start);
  });

  // Send footer contact forms to the board inbox in the officer portal.
  const contactForm = document.querySelector("footer form");
  if (contactForm) {
    const nameInput = contactForm.querySelector('input[type="text"]');
    const emailInput = contactForm.querySelector('input[type="email"]');
    const messageInput = contactForm.querySelector("textarea");
    const submitButton = contactForm.querySelector('button[type="submit"]');
    [nameInput, emailInput, messageInput].forEach((field) => {
      if (field) field.required = true;
    });
    if (nameInput) nameInput.maxLength = 100;
    if (emailInput) emailInput.maxLength = 254;
    if (messageInput) messageInput.maxLength = 2000;

    const honeypot = document.createElement("input");
    honeypot.type = "text";
    honeypot.tabIndex = -1;
    honeypot.autocomplete = "off";
    honeypot.setAttribute("aria-hidden", "true");
    honeypot.style.display = "none";
    contactForm.appendChild(honeypot);

    const status = document.createElement("p");
    status.className = "form-msg contact-form-msg";
    status.setAttribute("role", "status");
    contactForm.appendChild(status);

    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (honeypot.value || !nameInput || !emailInput || !messageInput || !submitButton) return;
      if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        status.textContent = "Messaging is temporarily unavailable. Please try again later.";
        status.className = "form-msg err contact-form-msg";
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "Sending…";
      status.textContent = "";
      const contactClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      const { error } = await contactClient.from("contact_messages").insert({
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        message: messageInput.value.trim(),
        page_path: location.pathname.split("/").pop() || "index.html",
        status: "new"
      });

      submitButton.disabled = false;
      submitButton.textContent = "Send";
      if (error) {
        console.error("Contact message failed:", error);
        status.textContent = "Your message couldn't be sent. Please try again.";
        status.className = "form-msg err contact-form-msg";
        return;
      }
      contactForm.reset();
      status.textContent = "Message sent to the Math NHS board.";
      status.className = "form-msg ok contact-form-msg";
    });
  }
});
