"use strict";

document.addEventListener("DOMContentLoaded", loadEvents);

function createEvent() {
  const title = document.getElementById("eTitle").value;
  const description = document.getElementById("eDesc").value;
  const category = document.getElementById("eCategory").value;
  const event_date = document.getElementById("eDate").value;
  const event_time = document.getElementById("eTime").value;
  const venue = document.getElementById("eVenue").value;
  const seats = document.getElementById("eSeats").value;
  const msg = document.getElementById("eventMsg");

  if (!title || !event_date) {
    msg.style.color = "red"; 
    msg.innerText = "Title and date required"; 
    return;
  }

  fetch("/club/events/create", {
    method: "POST", 
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      title, 
      description, 
      category, 
      event_date, 
      event_time, 
      venue, 
      seats: seats ? parseInt(seats) : null 
    })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      msg.style.color = "green"; 
      msg.innerText = "✅ Event created!";
      document.getElementById("eTitle").value = "";
      document.getElementById("eDesc").value = "";
      document.getElementById("eDate").value = "";
      document.getElementById("eVenue").value = "";
      document.getElementById("eSeats").value = "";
      loadEvents();
    } else {
      msg.style.color = "red"; 
      msg.innerText = d.message || "Failed";
    }
  })
  .catch(err => console.error("Create event error:", err));
}

function loadEvents() {
  fetch("/club/events/list", { credentials: "include" })
    .then(r => r.json())
    .then(events => {
      const el = document.getElementById("eventsList");
      
      if (!events.length) { 
        el.innerHTML = "<p style='color:var(--muted);'>No events yet. Create one!</p>"; 
        return; 
      }
      
      el.innerHTML = events.map(e => `
        <div style="padding:16px; border-radius:12px; background:var(--bg); border-left:4px solid var(--primary);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
            <div>
              <strong>${e.title}</strong>
              <p style="font-size:13px; color:var(--muted); margin-top:4px;">
                📅 ${e.event_date ? e.event_date.slice(0,10) : "—"}
                ${e.event_time ? " • " + e.event_time.slice(0,5) : ""}
                ${e.venue ? " • 📍 " + e.venue : ""}
              </p>
              <p style="font-size:12px; color:var(--muted); margin-top:2px;">
                ${e.category || "General"} • ${e.registration_count || 0} registered
              </p>
            </div>
            <button onclick="viewRegistrations(${e.id}, '${e.title.replace(/'/g,"\\'")}' )"
              style="padding:8px 14px; border-radius:8px; border:none; background:var(--primary); color:white; font-size:13px; cursor:pointer; white-space:nowrap;">
              👥 View Registrations
            </button>
          </div>
        </div>
      `).join("");
    })
    .catch(err => console.error("Load events error:", err));
}

function viewRegistrations(eventId, eventTitle) {
  document.getElementById("regEventTitle").innerText = eventTitle;
  document.getElementById("registrationsPanel").style.display = "block";
  document.getElementById("registrationsPanel").scrollIntoView({ behavior: "smooth" });

  fetch(`/club/events/registrations/${eventId}`, { credentials: "include" })
    .then(r => r.json())
    .then(regs => {
      const el = document.getElementById("regList");
      
      if (!regs.length) { 
        el.innerHTML = "<p style='color:var(--muted);'>No registrations yet</p>"; 
        return; 
      }
      
      el.innerHTML = regs.map(r => `
        <div style="padding:14px; border-radius:10px; background:var(--bg); display:flex; gap:20px; align-items:center; flex-wrap:wrap;">
          <strong>${r.username}</strong>
          <span style="color:var(--muted); font-size:13px;">${r.email}</span>
          <span style="color:var(--muted); font-size:13px;">PRN: ${r.prn || "—"}</span>
          <span style="color:var(--muted); font-size:13px;">${r.class_name || "—"}</span>
        </div>
      `).join("");
    })
    .catch(err => console.error("Load registrations error:", err));
}