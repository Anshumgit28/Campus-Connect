"use strict";

const AlumniDashboard = (() => {
  
  function init() {
    loadDashboardData();
  }
  
  function loadDashboardData() {
    fetch("/alumni/data", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        document.getElementById("greetingText").innerText = `Welcome back, ${data.name} 👋`;
        document.getElementById("upcomingEvents").innerText = data.upcomingEvents || 0;
        document.getElementById("noticeCount").innerText = data.notices || 0;

        renderEventList(data.events || []);
        renderNoticeList(data.noticeList || []);
      })
      .catch(err => console.error("Alumni dashboard error:", err));
  }
  
  function renderEventList(events) {
    const el = document.getElementById("eventList");
    el.innerHTML = events.length
      ? events.map(e => `<li style="padding:8px 0; border-bottom:1px solid var(--border); font-size:14px;">📅 <strong>${e.title}</strong> — ${e.event_date ? e.event_date.slice(0,10) : "—"}</li>`).join("")
      : "<li style='color:var(--muted);'>No upcoming events</li>";
  }
  
  function renderNoticeList(notices) {
    const el = document.getElementById("noticeList");
    el.innerHTML = notices.length
      ? notices.map(n => `<li style="padding:8px 0; border-bottom:1px solid var(--border); font-size:14px;">📢 ${n.title}</li>`).join("")
      : "<li style='color:var(--muted);'>No notices</li>";
  }
  
  function showPanel(id) {
    ["jobPanel","notifyPanel"].forEach(p => {
      document.getElementById(p).style.display = "none";
    });
    const el = document.getElementById(id);
    el.style.display = el.style.display === "none" ? "block" : "none";
  }
  
  function postJob() {
    const title = document.getElementById("jobText").value.trim();
    if (!title) return;
    
    fetch("/alumni/job/post", {
      method: "POST", 
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    })
    .then(r => r.json())
    .then(d => {
      const msg = document.getElementById("jobMsg");
      msg.style.color = d.success ? "green" : "red";
      msg.innerText = d.success ? "✅ Job posted to notices!" : "Failed";
      if (d.success) document.getElementById("jobText").value = "";
    });
  }
  
  function sendNotification() {
    const message = document.getElementById("notifyMsg").value.trim();
    if (!message) return;
    
    fetch("/alumni/notify", {
      method: "POST", 
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, target_role: "student" })
    })
    .then(r => r.json())
    .then(d => {
      const msg = document.getElementById("notifyResult");
      msg.style.color = d.success ? "green" : "red";
      msg.innerText = d.success ? `✅ Sent to ${d.sent} students!` : "Failed";
      if (d.success) document.getElementById("notifyMsg").value = "";
    });
  }
  
  return { init, showPanel, postJob, sendNotification };
})();

// Expose functions globally for onclick handlers
window.showPanel = AlumniDashboard.showPanel;
window.postJob = AlumniDashboard.postJob;
window.sendNotification = AlumniDashboard.sendNotification;

document.addEventListener("DOMContentLoaded", AlumniDashboard.init);