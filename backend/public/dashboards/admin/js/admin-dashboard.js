"use strict";

const AdminDashboard = (() => {
  
  function init() {
    loadDashboardData();
  }
  
  function loadDashboardData() {
    fetch("/admin/data", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        document.getElementById("totalUsers").innerText = data.users || 0;
        document.getElementById("totalEvents").innerText = data.events || 0;
        document.getElementById("totalResources").innerText = data.resources || 0;
        document.getElementById("totalClubs").innerText = data.clubs || 0;
        document.getElementById("totalReg").innerText = data.registrations || 0;

        renderRecentUsers(data.recentUsers || []);
        renderActivity(data.activity || []);
      });
  }
  
  function renderRecentUsers(users) {
    const el = document.getElementById("recentUsers");
    el.innerHTML = users.length
      ? users.map(u => `
          <div style="padding:10px; border-radius:10px; background:var(--bg); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="font-size:14px;">${u.username}</strong>
              <p style="font-size:12px; color:var(--muted);">${u.email}</p>
            </div>
            <span style="font-size:12px; background:var(--primary); color:white; padding:2px 10px; border-radius:20px;">${u.role}</span>
          </div>`).join("")
      : "<p style='color:var(--muted);'>No users</p>";
  }
  
  function renderActivity(activity) {
    const el = document.getElementById("activityLog");
    el.innerHTML = activity.length
      ? activity.map(a => `
          <div style="padding:8px 10px; border-radius:8px; background:var(--bg); font-size:13px;">
            <strong>${a.username}</strong> — ${a.activity}
            <p style="font-size:11px; color:var(--muted); margin-top:2px;">${a.created_at ? new Date(a.created_at).toLocaleDateString("en-IN") : ""}</p>
          </div>`).join("")
      : "<p style='color:var(--muted);'>No activity</p>";
  }
  
  function showPanel(id) {
    ["noticePanel","clubPanel"].forEach(p => {
      document.getElementById(p).style.display = "none";
    });
    const el = document.getElementById(id);
    el.style.display = el.style.display === "none" ? "block" : "none";
  }
  
  function postNotice() {
    const title = document.getElementById("noticeText").value.trim();
    if (!title) return;
    
    fetch("/admin/notice", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    }).then(r => r.json()).then(d => {
      const msg = document.getElementById("noticeMsg");
      msg.style.color = d.success ? "green" : "red";
      msg.innerText = d.success ? "✅ Notice posted!" : "Failed";
      if (d.success) document.getElementById("noticeText").value = "";
    });
  }
  
  function addClub() {
    const name = document.getElementById("clubName").value.trim();
    const category = document.getElementById("clubCategory").value.trim();
    const description = document.getElementById("clubDesc").value.trim();
    
    if (!name) return;
    
    fetch("/admin/club", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, description })
    }).then(r => r.json()).then(d => {
      const msg = document.getElementById("clubMsg");
      msg.style.color = d.success ? "green" : "red";
      msg.innerText = d.success ? "✅ Club added!" : "Failed";
      if (d.success) { 
        document.getElementById("clubName").value = ""; 
        loadDashboardData(); 
      }
    });
  }
  
  return { init, showPanel, postNotice, addClub };
})();

window.showPanel = AdminDashboard.showPanel;
window.postNotice = AdminDashboard.postNotice;
window.addClub = AdminDashboard.addClub;

document.addEventListener("DOMContentLoaded", AdminDashboard.init);