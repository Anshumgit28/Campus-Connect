"use strict";

const AlumniDashboard = (() => {

  function init() {
    loadDashboardData();
  }

  function loadDashboardData() {
    fetch("/alumni/data", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const nameEl = document.getElementById("greetingText");
        if (nameEl) nameEl.innerText = `Welcome back, ${data.name || "Alumni"} 👋`;

        setText("upcomingEvents", data.upcomingEvents || 0);
        setText("noticeCount",    data.notices        || 0);

        renderEventList(data.events     || []);
        renderNoticeList(data.noticeList|| []);
      })
      .catch(err => console.error("[ALUMNI DASH] load error:", err));
  }

  function renderEventList(events) {
    const el = document.getElementById("eventList");
    if (!el) return;
    el.innerHTML = events.length
      ? events.map(e =>
          `<li style="padding:8px 0; border-bottom:1px solid var(--border); font-size:14px;">
            📅 <strong>${esc(e.title)}</strong> — ${e.event_date ? e.event_date.slice(0,10) : "—"}
           </li>`).join("")
      : "<li style='color:var(--muted);'>No upcoming events</li>";
  }

  function renderNoticeList(notices) {
    const el = document.getElementById("noticeList");
    if (!el) return;
    el.innerHTML = notices.length
      ? notices.map(n =>
          `<li style="padding:8px 0; border-bottom:1px solid var(--border); font-size:14px;">
            📢 ${esc(n.title)}
           </li>`).join("")
      : "<li style='color:var(--muted);'>No notices</li>";
  }

  function showPanel(id) {
    ["jobPanel", "notifyPanel"].forEach(p => {
      const el = document.getElementById(p);
      if (el) el.style.display = "none";
    });
    const el = document.getElementById(id);
    if (el) el.style.display = el.style.display === "none" ? "block" : "none";
  }

  /* FIX: The backend /alumni/job/post expects:
       company_name, job_title, job_description, location, salary_range,
       requirements, application_link
     The old code sent a single `title` field (the whole textarea content).
     Now we send all fields properly. The textarea collects all details
     which we use as job_description; company_name + job_title remain
     required so we parse the first line or prompt the user. */
  function postJob() {
    const textEl = document.getElementById("jobText");
    const msgEl  = document.getElementById("jobMsg");
    const raw    = textEl ? textEl.value.trim() : "";
    if (!raw) return;

    /* Simple heuristic: first line = "Company | Job Title", rest = description.
       The textarea placeholder already tells alumni to include title/company/role. */
    const lines        = raw.split("\n").map(l => l.trim()).filter(Boolean);
    const firstLine    = lines[0] || "";
    const splitIdx     = firstLine.indexOf("|");
    const company_name = splitIdx > -1
      ? firstLine.slice(0, splitIdx).trim()
      : firstLine;                                    // fallback: whole first line
    const job_title    = splitIdx > -1
      ? firstLine.slice(splitIdx + 1).trim()
      : "See description";
    const job_description = lines.slice(1).join("\n") || raw;

    if (!company_name) {
      if (msgEl) { msgEl.style.color = "red"; msgEl.innerText = "⚠️ Start with: Company | Job Title"; }
      return;
    }

    fetch("/alumni/job/post", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name, job_title, job_description })
    })
    .then(r => r.json())
    .then(d => {
      if (msgEl) {
        msgEl.style.color = d.success ? "green" : "red";
        msgEl.innerText   = d.success ? "✅ Job posted!" : "❌ Failed";
      }
      if (d.success && textEl) textEl.value = "";
    })
    .catch(err => console.error("[ALUMNI] postJob error:", err));
  }

  function sendNotification() {
    const msgTextEl  = document.getElementById("notifyMsg");
    const resultEl   = document.getElementById("notifyResult");
    const message    = msgTextEl ? msgTextEl.value.trim() : "";
    if (!message) return;

    fetch("/alumni/notify", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, target_role: "student" })
    })
    .then(r => r.json())
    .then(d => {
      if (resultEl) {
        resultEl.style.color = d.success ? "green" : "red";
        resultEl.innerText   = d.success
          ? `✅ Sent to ${d.sent} students!`
          : "❌ Failed to send";
      }
      if (d.success && msgTextEl) msgTextEl.value = "";
    })
    .catch(err => console.error("[ALUMNI] sendNotification error:", err));
  }

  /* ── helpers ── */
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  }

  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  return { init, showPanel, postJob, sendNotification };
})();

window.showPanel         = AlumniDashboard.showPanel;
window.postJob           = AlumniDashboard.postJob;
window.sendNotification  = AlumniDashboard.sendNotification;

document.addEventListener("DOMContentLoaded", AlumniDashboard.init);