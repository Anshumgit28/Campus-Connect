"use strict";

const AdminDashboard = (() => {

  function init() {
    loadDashboardData();
  }

  function loadDashboardData() {
    fetch("/admin/data", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setText("totalUsers",     data.users         || 0);
        setText("totalEvents",    data.events        || 0);
        setText("totalResources", data.resources     || 0);
        setText("totalClubs",     data.clubs         || 0);
        /* FIX: totalReg element does not exist in admin-dashboard.html —
           guard with null check instead of crashing */
        setText("totalReg",       data.registrations || 0);

        renderRecentUsers(data.recentUsers || []);
        renderActivity(data.activity || []);
      })
      .catch(err => console.error("[ADMIN DASH] load error:", err));
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  }

  function renderRecentUsers(users) {
    const el = document.getElementById("recentUsers");
    if (!el) return;
    el.innerHTML = users.length
      ? users.map(u => `
          <div style="padding:10px; border-radius:10px; background:var(--bg);
            display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="font-size:14px;">${esc(u.username)}</strong>
              <p style="font-size:12px; color:var(--muted);">${esc(u.email)}</p>
            </div>
            <span style="font-size:12px; background:var(--primary); color:white;
              padding:2px 10px; border-radius:20px;">${esc(u.role)}</span>
          </div>`).join("")
      : "<p style='color:var(--muted);'>No users yet</p>";
  }

  function renderActivity(activity) {
    const el = document.getElementById("activityLog");
    if (!el) return;
    el.innerHTML = activity.length
      ? activity.map(a => `
          <div style="padding:8px 10px; border-radius:8px; background:var(--bg); font-size:13px;">
            <strong>${esc(a.username || "—")}</strong> — ${esc(a.activity || "")}
            <p style="font-size:11px; color:var(--muted); margin-top:2px;">
              ${a.created_at ? new Date(a.created_at).toLocaleDateString("en-IN") : ""}
            </p>
          </div>`).join("")
      : "<p style='color:var(--muted);'>No recent activity</p>";
  }

  function showPanel(id) {
    ["noticePanel", "clubPanel"].forEach(p => {
      const el = document.getElementById(p);
      if (el) el.style.display = "none";
    });
    const el = document.getElementById(id);
    if (el) el.style.display = el.style.display === "none" ? "block" : "none";
  }

  function postNotice() {
    const textEl = document.getElementById("noticeText");
    const title  = textEl ? textEl.value.trim() : "";
    if (!title) return;

    fetch("/admin/notice", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    })
    .then(r => r.json())
    .then(d => {
      const msg = document.getElementById("noticeMsg");
      if (msg) {
        msg.style.color = d.success ? "green" : "red";
        msg.innerText   = d.success ? "✅ Notice posted!" : "❌ Failed";
      }
      if (d.success && textEl) textEl.value = "";
    })
    .catch(err => console.error("[ADMIN] postNotice error:", err));
  }

  function addClub() {
    const name        = (document.getElementById("clubName")?.value     || "").trim();
    const category    = (document.getElementById("clubCategory")?.value || "").trim();
    const description = (document.getElementById("clubDesc")?.value     || "").trim();

    if (!name) return;

    fetch("/admin/club", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, description })
    })
    .then(r => r.json())
    .then(d => {
      const msg = document.getElementById("clubMsg");
      if (msg) {
        msg.style.color = d.success ? "green" : "red";
        msg.innerText   = d.success ? "✅ Club added!" : "❌ Failed";
      }
      if (d.success) {
        const clubNameEl = document.getElementById("clubName");
        if (clubNameEl) clubNameEl.value = "";
        loadDashboardData();
      }
    })
    .catch(err => console.error("[ADMIN] addClub error:", err));
  }

  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g,  "&amp;").replace(/</g,  "&lt;")
      .replace(/>/g,  "&gt;").replace(/"/g,  "&quot;")
      .replace(/'/g,  "&#039;");
  }

  return { init, showPanel, postNotice, addClub };
})();

window.showPanel  = AdminDashboard.showPanel;
window.postNotice = AdminDashboard.postNotice;
window.addClub    = AdminDashboard.addClub;

document.addEventListener("DOMContentLoaded", AdminDashboard.init);