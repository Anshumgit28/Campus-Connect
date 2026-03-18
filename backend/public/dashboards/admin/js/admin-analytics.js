"use strict";

const roleColors = {
  student: "#6366f1",
  faculty: "#f59e0b",
  alumni: "#22c55e",
  club_head: "#8b5cf6",
  admin: "#ef4444"
};
const catColors = ["#6366f1", "#f59e0b", "#22c55e", "#8b5cf6", "#ef4444", "#06b6d4"];

document.addEventListener("DOMContentLoaded", () => {
  loadAnalytics();
  loadActivityLog();
});

function loadAnalytics() {
  fetch("/admin/system-analytics", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      renderRoleDist(data.roleDist || []);
      renderEventCat(data.eventCat || []);
      renderTopEvents(data.topEvents || []);
      renderMonthlyUsers(data.monthlyUsers || []);
    })
    .catch(err => {
      console.error("Analytics load failed:", err);
      ["roleDist","eventCat","topEvents","monthlyUsers"].forEach(id => {
        document.getElementById(id).innerHTML =
          "<p style='color:red;'>Failed to load data</p>";
      });
    });
}

function renderRoleDist(data) {
  const el = document.getElementById("roleDist");
  if (!data.length) {
    el.innerHTML = "<p style='color:var(--muted);'>No user data</p>";
    return;
  }
  el.innerHTML = data.map(r => {
    const color = roleColors[r.role] || "#6b7280";
    return `
      <div style="padding:14px 20px; border-radius:14px; text-align:center; flex:1;
        min-width:100px; background:${color}22; border:2px solid ${color};">
        <p style="font-size:28px; font-weight:800; color:${color};">${r.c}</p>
        <p style="font-size:13px; color:var(--muted); text-transform:capitalize; margin-top:4px;">
          ${r.role.replace("_"," ")}
        </p>
      </div>
    `;
  }).join("");
}

function renderEventCat(data) {
  const el = document.getElementById("eventCat");
  if (!data.length) {
    el.innerHTML = "<p style='color:var(--muted);'>No event data</p>";
    return;
  }
  el.innerHTML = data.map((c, i) => {
    const color = catColors[i % catColors.length];
    return `
      <div style="padding:14px 20px; border-radius:14px; text-align:center; flex:1;
        min-width:110px; background:${color}22; border:2px solid ${color};">
        <p style="font-size:26px; font-weight:800; color:${color};">${c.c}</p>
        <p style="font-size:13px; color:var(--muted); margin-top:4px;">
          ${c.category || "Uncategorized"}
        </p>
      </div>
    `;
  }).join("");
}

function renderTopEvents(data) {
  const el = document.getElementById("topEvents");
  if (!data.length) {
    el.innerHTML = "<p style='color:var(--muted);'>No registration data yet</p>";
    return;
  }
  el.innerHTML = data.map((e, i) => `
    <div style="padding:12px 16px; border-radius:12px; background:var(--bg);
      display:flex; justify-content:space-between; align-items:center; gap:8px;">
      <span style="font-weight:600; font-size:14px;">
        <span style="color:var(--muted); margin-right:6px;">${i + 1}.</span>${e.title}
      </span>
      <span style="background:var(--primary); color:white; padding:4px 12px;
        border-radius:20px; font-size:13px; font-weight:700; white-space:nowrap;">
        ${e.c} reg
      </span>
    </div>
  `).join("");
}

function renderMonthlyUsers(data) {
  const el = document.getElementById("monthlyUsers");
  if (!data.length) {
    el.innerHTML = "<p style='color:var(--muted);'>No activity data yet</p>";
    return;
  }
  const max = Math.max(...data.map(d => d.c), 1);
  el.innerHTML = data.map(d => `
    <div style="display:flex; align-items:center; gap:12px;">
      <span style="font-size:13px; color:var(--muted); width:70px; flex-shrink:0; text-align:right;">
        ${d.month}
      </span>
      <div style="flex:1; background:#f3f4f6; border-radius:6px; height:26px; overflow:hidden;">
        <div style="width:${Math.round((d.c / max) * 100)}%; background:linear-gradient(90deg, var(--primary), var(--secondary));
          height:100%; border-radius:6px; transition:width .4s ease;">
        </div>
      </div>
      <span style="font-size:13px; font-weight:700; color:var(--primary); width:30px;">
        ${d.c}
      </span>
    </div>
  `).join("");
}

function loadActivityLog() {
  fetch("/admin/activity", { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      const el = document.getElementById("activityFull");
      if (!rows.length) {
        el.innerHTML = "<p style='color:var(--muted);'>No activity recorded yet</p>";
        return;
      }
      el.innerHTML = rows.map(a => `
        <div style="padding:10px 14px; border-radius:10px; background:var(--bg);
          border:1px solid var(--border); font-size:13px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <div>
              <strong>${a.username || "—"}</strong>
              <span style="color:var(--muted); margin-left:8px;">— ${a.activity}</span>
            </div>
            <span style="font-size:11px; color:var(--muted); white-space:nowrap;">
              ${a.created_at ? new Date(a.created_at).toLocaleString("en-IN", {
                day:"2-digit", month:"short", year:"numeric",
                hour:"2-digit", minute:"2-digit"
              }) : "—"}
            </span>
          </div>
        </div>
      `).join("");
    })
    .catch(() => {
      document.getElementById("activityFull").innerHTML =
        "<p style='color:red;'>Failed to load activity log</p>";
    });
}