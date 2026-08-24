(function () {
  const readyForDom = document.readyState === "loading"
    ? new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }))
    : Promise.resolve();

  const EVENT_DEFAULTS = {
    visible: false,
    nav_label: "Upcoming Events",
    status: "Coming soon",
    kicker: "Featured event",
    title: "Upcoming event",
    summary: "",
    date: "",
    time: "",
    location: "",
    points: "",
    signup_label: "Sign up",
    signup_url: "",
    hero_url: "",
    poster_url: "",
    details: "",
    contact: "",
    requirements: [],
    schedule: [],
    sections: { overview: true, requirements: true, poster: false, schedule: false }
  };

  function safeHttpsUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""));
      return url.protocol === "https:" ? url.toString() : "";
    } catch {
      return "";
    }
  }

  function safeAssetUrl(rawUrl) {
    const value = String(rawUrl || "").trim();
    if (/^assets\/[a-zA-Z0-9/_\-.]+$/.test(value)) return value;
    return safeHttpsUrl(value);
  }

  function eventData(raw) {
    const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    return {
      ...EVENT_DEFAULTS,
      ...value,
      visible: value.visible === true,
      nav_label: String(value.nav_label || EVENT_DEFAULTS.nav_label).slice(0, 40),
      sections: { ...EVENT_DEFAULTS.sections, ...(value.sections && typeof value.sections === "object" ? value.sections : {}) },
      requirements: Array.isArray(value.requirements) ? value.requirements : [],
      schedule: Array.isArray(value.schedule) ? value.schedule : []
    };
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = String(value || "");
    });
  }

  function setImage(kind, rawUrl, allowed = true) {
    const image = document.querySelector(`[data-event-${kind}-image]`);
    const wrap = document.querySelector(`[data-event-${kind}-wrap]`);
    if (!image || !wrap) return;
    const url = safeAssetUrl(rawUrl);
    if (!url) {
      image.removeAttribute("src");
      image.alt = "";
      wrap.hidden = true;
      return;
    }
    image.onload = () => { wrap.hidden = !allowed; };
    image.onerror = () => {
      image.removeAttribute("src");
      image.alt = "";
      wrap.hidden = true;
    };
    image.alt = "";
    image.src = url;
  }

  function renderUpcomingEvent(rawEvent) {
    const event = eventData(rawEvent);
    document.querySelectorAll("[data-upcoming-nav], [data-upcoming-home]").forEach((element) => {
      element.hidden = !event.visible;
    });
    setText("[data-upcoming-label]", event.nav_label);

    if (!document.body.hasAttribute("data-upcoming-event-page")) return;
    if (!event.visible) {
      location.replace("index.html");
      return;
    }

    document.title = `${event.title || "Upcoming event"} — BVSW Math NHS`;
    setText("[data-event-status]", event.status);
    setText("[data-event-kicker]", event.kicker);
    setText("[data-event-title]", event.title);
    setText("[data-event-summary]", event.summary);
    setText("[data-event-date]", event.date);
    setText("[data-event-time]", event.time);
    setText("[data-event-location]", event.location);
    setText("[data-event-points]", event.points);
    setText("[data-event-details]", event.details);
    setText("[data-event-contact]", event.contact);

    document.querySelectorAll("[data-event-meta]").forEach((item) => {
      const value = item.querySelector("[data-event-date], [data-event-time], [data-event-location], [data-event-points]")?.textContent.trim();
      item.hidden = !value;
    });

    const signup = document.querySelector("[data-event-signup]");
    if (signup) {
      const url = safeHttpsUrl(event.signup_url);
      signup.hidden = !url;
      if (url) {
        signup.href = url;
        signup.target = "_blank";
        signup.rel = "noopener";
        signup.textContent = String(event.signup_label || "Sign up").slice(0, 50);
      }
    }

    setImage("hero", event.hero_url);
    setImage("poster", event.poster_url, event.sections.poster === true);

    Object.entries(event.sections).forEach(([name, visible]) => {
      document.querySelectorAll(`[data-upcoming-section="${name}"]`).forEach((section) => {
        section.hidden = visible !== true;
      });
    });

    const requirements = document.querySelector("[data-event-requirements]");
    if (requirements) {
      requirements.replaceChildren();
      event.requirements.filter((item) => String(item || "").trim()).forEach((item) => {
        const li = document.createElement("li");
        li.textContent = String(item).slice(0, 240);
        requirements.appendChild(li);
      });
      const section = requirements.closest('[data-upcoming-section="requirements"]');
      if (section && !requirements.children.length) section.hidden = true;
    }

    const schedule = document.querySelector("[data-event-schedule]");
    if (schedule) {
      schedule.replaceChildren();
      event.schedule.forEach((item) => {
        if (!item || (!item.time && !item.label)) return;
        const row = document.createElement("div");
        row.className = "event-schedule-row";
        const time = document.createElement("span");
        time.className = "event-schedule-time";
        time.textContent = String(item.time || "");
        const label = document.createElement("span");
        label.textContent = String(item.label || "");
        row.append(time, label);
        schedule.appendChild(row);
      });
      const section = schedule.closest('[data-upcoming-section="schedule"]');
      if (section && !schedule.children.length) section.hidden = true;
    }

    const requirementGrid = document.querySelector(".upcoming-requirement-grid");
    if (requirementGrid) requirementGrid.classList.toggle("single", event.sections.poster !== true || !safeAssetUrl(event.poster_url));
  }

  function safeSiteLink(rawUrl) {
    const value = String(rawUrl || "").trim();
    if (/^[a-zA-Z0-9_-]+\.html(?:[#?].*)?$/.test(value)) return value;
    return safeHttpsUrl(value);
  }

  function renderEventsPoints(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const textFields = {
      pointsPageEyebrow: raw.points_eyebrow,
      pointsPageTitle: raw.points_title,
      pointsPageIntro: raw.points_intro,
      eventsSectionEyebrow: raw.events_eyebrow,
      eventsSectionTitle: raw.events_title,
      eventsSectionIntro: raw.events_intro
    };
    Object.entries(textFields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element && typeof value === "string" && value.trim()) element.textContent = value;
    });

    const tableBody = document.getElementById("pointsTableBody");
    if (tableBody && Array.isArray(raw.opportunities)) {
      tableBody.replaceChildren();
      raw.opportunities.forEach((item) => {
        if (!item || (!item.opportunity && !item.details && !item.points)) return;
        const row = document.createElement("tr");
        [item.opportunity, item.details, item.points].forEach((value, index) => {
          const cell = document.createElement("td");
          if (index === 2) cell.className = "pts";
          cell.textContent = String(value || "").slice(0, index === 1 ? 240 : 120);
          row.appendChild(cell);
        });
        tableBody.appendChild(row);
      });
    }

    const grid = document.getElementById("eventsGrid");
    if (!grid || !Array.isArray(raw.events)) return;
    grid.replaceChildren();
    raw.events.forEach((item, index) => {
      if (!item || (!item.title && !item.description)) return;
      const images = (Array.isArray(item.images) ? item.images : []).map(safeAssetUrl).filter(Boolean).slice(0, 8);
      const card = document.createElement("article");
      card.className = `event-card${index === 0 && images.length ? " event-card-wide" : ""}${images.length ? "" : " event-card-text"}`;
      if (images.length === 1) {
        const media = document.createElement("div");
        media.className = "event-media";
        const image = document.createElement("img");
        image.src = images[0];
        image.alt = "";
        media.appendChild(image);
        card.appendChild(media);
      } else if (images.length > 1) {
        const carousel = document.createElement("div");
        carousel.className = "media-carousel";
        carousel.dataset.interval = "4500";
        carousel.setAttribute("aria-label", `${String(item.title || "Event").slice(0, 120)} photos`);
        images.forEach((url, imageIndex) => {
          const slide = document.createElement("div");
          slide.className = `media-slide${imageIndex === 0 ? " active" : ""}`;
          const image = document.createElement("img");
          image.src = url;
          image.alt = "";
          slide.appendChild(image);
          carousel.appendChild(slide);
        });
        const dots = document.createElement("div");
        dots.className = "media-dots";
        carousel.appendChild(dots);
        card.appendChild(carousel);
      }

      const copy = document.createElement("div");
      copy.className = "event-copy";
      const kicker = document.createElement("span");
      kicker.className = "event-kicker";
      kicker.textContent = String(item.kicker || "Event").slice(0, 80);
      const title = document.createElement("h3");
      title.textContent = String(item.title || "Event").slice(0, 160);
      const description = document.createElement("p");
      description.textContent = String(item.description || "").slice(0, 1200);
      copy.append(kicker, title, description);
      const linkUrl = safeSiteLink(item.link_url);
      if (linkUrl && item.link_label) {
        const link = document.createElement("a");
        link.className = "text-link";
        link.href = linkUrl;
        link.textContent = String(item.link_label).slice(0, 100);
        if (linkUrl.startsWith("https://")) {
          link.target = "_blank";
          link.rel = "noopener";
        }
        copy.appendChild(link);
      }
      card.appendChild(copy);
      grid.appendChild(card);
    });
  }

  window.siteContentReady = (async () => {
    await readyForDom;
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      renderUpcomingEvent(EVENT_DEFAULTS);
      return;
    }
    const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const { data, error } = await client.from("site_content").select("*").eq("id", 1).maybeSingle();
    if (error || !data) {
      if (error) console.warn("Using built-in site content:", error.message);
      renderUpcomingEvent(EVENT_DEFAULTS);
      return;
    }

    renderUpcomingEvent(data.upcoming_event);
    renderEventsPoints(data.events_points);

    const slider = document.getElementById("upcomingSlider");
    if (slider && Array.isArray(data.announcements) && data.announcements.length) {
      slider.replaceChildren();
      data.announcements.forEach((item, index) => {
        const slide = document.createElement("div");
        slide.className = `slide${index === 0 ? " active" : ""}`;
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = item.tag || "Update";
        const body = document.createElement("div");
        body.className = "body";
        const title = document.createElement("h3");
        title.textContent = item.title || "Club update";
        const description = document.createElement("p");
        description.textContent = item.description || "";
        body.append(title, description);
        slide.append(tag, body);
        slider.appendChild(slide);
      });
    }

    document.querySelectorAll("[data-points-tracker]").forEach((link) => {
      const url = safeHttpsUrl(data.points_tracker_url);
      if (url) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
      }
    });

    const boardYear = document.getElementById("boardYear");
    if (boardYear && data.board_year) boardYear.textContent = data.board_year;
    const officers = document.getElementById("officersList");
    if (officers && Array.isArray(data.board_members)) {
      officers.replaceChildren();
      if (!data.board_members.length) {
        const empty = document.createElement("div");
        empty.className = "card board-empty";
        const heading = document.createElement("h3");
        heading.textContent = "New board roster coming soon";
        const copy = document.createElement("p");
        copy.textContent = "Officer names will be posted once this year’s list is finalized.";
        empty.append(heading, copy);
        officers.appendChild(empty);
      } else {
        data.board_members.forEach((member) => {
          const card = document.createElement("div");
          card.className = "officer";
          const role = document.createElement("span");
          role.className = "role";
          role.textContent = member.role || "Board member";
          const name = document.createElement("span");
          name.className = "name";
          name.textContent = member.name || "";
          card.append(role, name);
          officers.appendChild(card);
        });
      }
    }

    const poster = data.poster && typeof data.poster === "object" ? data.poster : {};
    const posterFields = {
      posterMonth: poster.month,
      posterTheme: poster.theme,
      posterDescription: poster.description,
      posterDue: poster.due
    };
    Object.entries(posterFields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element && typeof value === "string" && value) element.textContent = value;
    });
  })();
})();
