/* ============================================================
   COMMON EVENTS MODULE — public/common/events/events.js
   Reusable by all dashboards
============================================================ */

const Events = (() => {

  /* Load all upcoming events into a container element */
  function loadEvents(containerId, opts = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let url = "/events";
    if (opts.category) url += "?category=" + encodeURIComponent(opts.category);

    container.innerHTML = `<p style="color:var(--muted);">Loading events...</p>`;

    fetch(url, { credentials: "include" })
      .then(r => r.json())
      .then(events => {
        if (!events.length) {
          container.innerHTML = `<p style="color:var(--muted);">No upcoming events</p>`;
          return;
        }
        container.innerHTML = events.map(e => `
          <div class="snap-card" style="min-width:240px; max-width:300px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <h3 style="font-size:15px; font-weight:700;">${e.title}</h3>
              ${e.category ? `<span style="font-size:11px; background:var(--bg); padding:3px 8px; border-radius:20px; color:var(--primary);">${e.category}</span>` : ""}
            </div>
            <p style="color:var(--muted); font-size:13px; margin:8px 0;">📅 ${e.event_date ? e.event_date.slice(0,10) : "—"} ${e.event_time ? "· " + e.event_time.slice(0,5) : ""}</p>
            ${e.venue ? `<p style="font-size:13px; color:var(--muted);">📍 ${e.venue}</p>` : ""}
            ${e.description ? `<p style="font-size:13px; margin:8px 0; color:var(--text);">${e.description.slice(0,80)}${e.description.length>80?"...":""}</p>` : ""}
            ${opts.showRegister ? `<button onclick="Events.register(${e.id}, this)" style="margin-top:10px; padding:8px 16px; border-radius:8px; border:none; background:var(--primary); color:white; font-size:13px; cursor:pointer; font-weight:600;">Register</button>` : ""}
          </div>
        `).join("");
      })
      .catch(() => { container.innerHTML = `<p style="color:var(--muted);">Failed to load events</p>`; });
  }

  /* Register for an event */
  function register(eventId, btn) {
    fetch("/events/register", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId })
    })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        if (btn) { btn.innerText = "✅ Registered"; btn.disabled = true; btn.style.background = "#22c55e"; }
      } else {
        alert(d.message || "Registration failed");
      }
    });
  }

  /* Load user's registered events */
  function loadMyEvents(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    fetch("/events/my/registered", { credentials: "include" })
      .then(r => r.json())
      .then(events => {
        if (!events.length) { container.innerHTML = `<li>No registered events</li>`; return; }
        container.innerHTML = events.map(e =>
          `<li style="padding:8px 0; border-bottom:1px solid var(--border);">
            🎯 <strong>${e.title}</strong> — ${e.event_date ? e.event_date.slice(0,10) : "—"}
            <button onclick="Events.cancel(${e.id}, this)" style="float:right; padding:4px 10px; border-radius:6px; border:1px solid var(--danger); color:var(--danger); background:white; cursor:pointer; font-size:12px;">Cancel</button>
           </li>`
        ).join("");
      });
  }

  /* Cancel registration */
  function cancel(eventId, btn) {
    if (!confirm("Cancel registration?")) return;
    fetch("/events/cancel", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId })
    })
    .then(r => r.json())
    .then(d => {
      if (d.success && btn) btn.closest("li").remove();
    });
  }

  return { loadEvents, register, loadMyEvents, cancel };
})();

window.Events = Events;