(function () {
  const readyForDom = document.readyState === "loading"
    ? new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }))
    : Promise.resolve();

  window.siteContentReady = (async () => {
    await readyForDom;
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return;
    const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const { data, error } = await client.from("site_content").select("*").eq("id", 1).maybeSingle();
    if (error || !data) {
      if (error) console.warn("Using built-in site content:", error.message);
      return;
    }

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
      if (typeof data.points_tracker_url === "string" && data.points_tracker_url.startsWith("https://")) {
        link.href = data.points_tracker_url;
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
      posterDue: poster.due,
    };
    Object.entries(posterFields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element && typeof value === "string" && value) element.textContent = value;
    });
  })();
})();
