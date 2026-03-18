"use strict";

document.addEventListener("DOMContentLoaded", loadEventsList);

/* ═══════════════════════════════════════════
   CREATE EVENT
   NOTE: Cannot use "createEvent" — it is a
   reserved browser DOM method name.
   Using "submitEvent" instead.
═══════════════════════════════════════════ */
function submitEvent() {
  const msg = document.getElementById("eventMsg");

  const title       = (document.getElementById("eTitle")     ?.value || "").trim();
  const description = (document.getElementById("eDesc")      ?.value || "").trim();
  const category    = (document.getElementById("eCategory")  ?.value || "General");
  const event_date  = (document.getElementById("eDate")      ?.value || "").trim();
  const event_time  = (document.getElementById("eTime")      ?.value || "").trim();
  const venue       = (document.getElementById("eVenue")     ?.value || "").trim();
  const organizer   = (document.getElementById("eOrganizer") ?.value || "").trim();
  const seats       = (document.getElementById("eSeats")     ?.value || "").trim();

  console.log("[EVENTS] submitEvent called:", { title, category, event_date });

  if (!title) {
    msg.style.color = "red";
    msg.innerText   = "⚠️ Event title is required";
    document.getElementById("eTitle")?.focus();
    return;
  }
  if (!event_date) {
    msg.style.color = "red";
    msg.innerText   = "⚠️ Event date is required";
    return;
  }

  msg.style.color = "#6366f1";
  msg.innerText   = "⏳ Creating event…";

  fetch("/admin/event", {
    method:      "POST",
    credentials: "include",
    headers:     { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description: description || null,
      category,
      event_date,
      event_time:  event_time  || null,
      venue:       venue       || null,
      organizer:   organizer   || null,
      seats:       seats       || null
    })
  })
  .then(r => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  })
  .then(d => {
    console.log("[EVENTS] Response:", d);
    if (d.success) {
      msg.style.color = "green";
      msg.innerText   = "✅ Event created!";

      ["eTitle","eDesc","eDate","eTime","eVenue","eOrganizer","eSeats"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });

      loadEventsList();
      setTimeout(() => { msg.innerText = ""; }, 4000);
    } else {
      msg.style.color = "red";
      msg.innerText   = "❌ " + (d.message || "Failed");
    }
  })
  .catch(err => {
    console.error("[EVENTS] Error:", err);
    msg.style.color = "red";
    msg.innerText   = "❌ " + err.message;
  });
}

/* ═══════════════════════════════════════════
   LOAD EVENTS LIST
═══════════════════════════════════════════ */
function loadEventsList() {
  const el = document.getElementById("eventList");
  if (!el) return;
  el.innerHTML = "<p style='color:#6b7280;font-size:14px;'>Loading…</p>";

  fetch("/admin/events/list", { credentials: "include" })
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(data => {
      const events = Array.isArray(data) ? data : [];
      if (!events.length) {
        el.innerHTML = "<p style='color:#6b7280;font-size:14px;'>No events yet. Create one above!</p>";
        return;
      }
      el.innerHTML = events.map(e => `
        <div style="padding:16px;border-radius:12px;background:#eef2ff;
          border-left:4px solid #6366f1;margin-bottom:4px;">
          <div style="display:flex;justify-content:space-between;
            align-items:flex-start;gap:8px;flex-wrap:wrap;">
            <div style="flex:1;min-width:0;">
              <strong style="font-size:15px;">${esc(e.title)}</strong>
              <p style="font-size:13px;color:#6b7280;margin-top:4px;">
                📅 ${e.event_date ? String(e.event_date).slice(0,10) : "—"}
                ${e.event_time ? " · " + String(e.event_time).slice(0,5) : ""}
                ${e.venue      ? " · 📍 " + esc(e.venue) : ""}
              </p>
              <p style="font-size:12px;color:#6b7280;margin-top:2px;">
                ${esc(e.category || "General")} ·
                <strong>👥 ${e.reg_count || 0} registered</strong>
                ${e.seats ? " / " + e.seats + " seats" : ""}
              </p>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
              <button onclick="viewRegistrations(${e.id},'${escJs(e.title)}')"
                style="padding:7px 12px;border-radius:8px;border:none;
                  background:#6366f1;color:white;font-size:12px;
                  font-weight:600;cursor:pointer;">
                👥 Registrations
              </button>
              <button onclick="removeEvent(${e.id})"
                style="padding:7px 12px;border-radius:8px;border:none;
                  background:#fee2e2;color:#dc2626;font-size:12px;
                  font-weight:600;cursor:pointer;">
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      `).join("");
    })
    .catch(err => {
      el.innerHTML = `<p style='color:red;font-size:14px;'>Error: ${err.message}</p>`;
    });
}

/* ═══════════════════════════════════════════
   VIEW REGISTRATIONS
═══════════════════════════════════════════ */
function viewRegistrations(eventId, title) {
  const panel = document.getElementById("regPanel");
  if (!panel) return;
  document.getElementById("regTitle").innerText = title;
  document.getElementById("regList").innerHTML  = "<p style='color:#6b7280;'>Loading…</p>";
  document.getElementById("regCount").innerText = "";
  panel.style.display = "block";
  panel.scrollIntoView({ behavior: "smooth" });

  fetch("/admin/event-registrations/" + eventId, { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      const regs = Array.isArray(data) ? data : [];
      document.getElementById("regCount").innerText =
        regs.length + " registration" + (regs.length !== 1 ? "s" : "");

      const el = document.getElementById("regList");
      if (!regs.length) {
        el.innerHTML = "<p style='color:#6b7280;'>No registrations yet</p>";
        return;
      }
      el.innerHTML = regs.map(r => `
        <div style="padding:12px 16px;border-radius:10px;background:#eef2ff;
          border:1px solid #e0e7ff;min-width:200px;">
          <strong>${esc(r.username||"—")}</strong>
          <p style="font-size:12px;color:#6b7280;margin-top:4px;">${esc(r.email||"—")}</p>
          ${r.prn        ? `<p style="font-size:12px;color:#9ca3af;">PRN: ${esc(r.prn)}</p>` : ""}
          ${r.class_name ? `<p style="font-size:12px;color:#9ca3af;">${esc(r.class_name)}</p>` : ""}
        </div>
      `).join("");
    })
    .catch(err => {
      document.getElementById("regList").innerHTML =
        `<p style='color:red;'>Failed: ${err.message}</p>`;
    });
}

/* ═══════════════════════════════════════════
   DELETE EVENT
   Also renamed: removeEvent (not deleteEvent
   which could conflict with browser APIs)
═══════════════════════════════════════════ */
function removeEvent(event_id) {
  if (!confirm("Delete this event and all registrations?\nThis cannot be undone.")) return;

  fetch("/admin/event/delete", {
    method:      "POST",
    credentials: "include",
    headers:     { "Content-Type": "application/json" },
    body:        JSON.stringify({ event_id })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      loadEventsList();
      const panel = document.getElementById("regPanel");
      if (panel) panel.style.display = "none";
    } else {
      alert("Failed: " + (d.message || "Unknown error"));
    }
  })
  .catch(err => alert("Network error: " + err.message));
}

/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function escJs(str) {
  if (str == null) return "";
  return String(str).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
}