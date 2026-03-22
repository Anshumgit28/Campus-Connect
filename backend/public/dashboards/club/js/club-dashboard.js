"use strict";
/* ============================================================
   club-dashboard.js  — FIXED
   - /club/data  → memberCount, pendingCount, eventCount, announcementCount
   - /club/analytics → memberCount, pendingCount, upcomingEvents, recentMembers
   - /club/my-identity → username, position, club_name, uc_id
   - /club/announcements/list → last 5 announcements
============================================================ */

let myRole     = null;
let myClubName = "";

document.addEventListener("DOMContentLoaded", () => {
  loadMyIdentity();
  loadDashboardData();
  loadAnalytics();
  loadRecentAnnouncements();
});

/* ══════════════════════════════════════════
   MY IDENTITY (designation + club name)
══════════════════════════════════════════ */
function loadMyIdentity() {
  fetch("/club/my-identity", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      myRole     = (d.position || "member").toLowerCase().replace(/\s+/g, "_");
      myClubName = d.club_name || "Club";

      /* Topbar identity card */
      setText("identityAvatar", (d.username || "?")[0].toUpperCase());
      setText("identityName",   d.username  || "—");
      setText("identityRole",   d.position  || "Member");

      /* Page heading */
      setText("clubNameHeader", myClubName);

      /* Role banner */
      const banner = document.getElementById("roleBanner");
      if (banner) {
        banner.style.display = "flex";
        setText("roleBannerIcon",  getRoleIcon(myRole));
        setText("roleBannerTitle", d.position || "Member");
        setText("roleBannerClub",  myClubName);

        const chips = getAccessChips(myRole);
        const accessEl = document.getElementById("roleBannerAccess");
        if (accessEl) {
          accessEl.innerHTML = chips.map(c =>
            `<span class="access-chip">${c}</span>`
          ).join("");
        }
      }

      buildQuickActions(myRole);
    })
    .catch(err => {
      console.error("[CLUB DASH] identity error:", err);
      setText("identityRole", "Member");
      buildQuickActions("member");
    });
}

function getRoleIcon(role) {
  const map = {
    president:         "👑",
    vice_president:    "🥈",
    secretary:         "📋",
    treasurer:         "💰",
    technical_head:    "💻",
    coordinator:       "🎯",
    event_coordinator: "🎉",
    member:            "👤"
  };
  return map[role] || "👤";
}

function getAccessChips(role) {
  const all = ["Manage Members","Post Announcements","Manage Events",
               "Treasury","Tasks","Polls","Gallery","Attendance"];
  if (role === "president")      return all;
  if (role === "vice_president") return ["Manage Members","Post Announcements","Manage Events","Tasks","Polls"];
  if (role === "secretary")      return ["Post Announcements","Tasks","Polls"];
  if (role === "treasurer")      return ["Treasury"];
  if (role === "technical_head") return ["Manage Events","Tasks"];
  return ["View Club Info"];
}

function buildQuickActions(role) {
  const grid = document.getElementById("quickActionsGrid");
  if (!grid) return;

  const actions = [];
  actions.push({ label: "👥 View Members", href: "/club/members" });
  actions.push({ label: "🎉 Events",       href: "/club/events" });

  if (["president","vice_president"].includes(role)) {
    actions.push({ label: "📢 Post Announcement", onclick: "showAnnounce()" });
    actions.push({ label: "✅ Manage Members",    href: "/club/members" });
  } else {
    actions.push({ label: "📢 Announcements", href: "/club/announcements" });
  }

  if (["president","vice_president","treasurer"].includes(role)) {
    actions.push({ label: "💰 Treasury", href: "/club/treasury" });
  }

  actions.push({ label: "📋 Tasks",      href: "/club/tasks" });
  actions.push({ label: "🗳️ Polls",      href: "/club/polls" });
  actions.push({ label: "🖼️ Gallery",    href: "/club/gallery" });
  actions.push({ label: "✅ Attendance", href: "/club/attendance" });

  grid.innerHTML = actions.slice(0, 8).map(a =>
    a.onclick
      ? `<div class="btn btn-outline" style="cursor:pointer;justify-content:center;text-align:center;" onclick="${a.onclick}">${a.label}</div>`
      : `<a href="${a.href}" class="btn btn-outline" style="justify-content:center;text-align:center;">${a.label}</a>`
  ).join("");
}

/* ══════════════════════════════════════════
   ANNOUNCEMENT PANEL
══════════════════════════════════════════ */
function showAnnounce() {
  const p = document.getElementById("announcePanel");
  if (p) p.style.display = "block";
}

function closeAnnounce() {
  const p = document.getElementById("announcePanel");
  if (p) p.style.display = "none";
}

function postAnnouncement() {
  const text = (document.getElementById("announceText")?.value || "").trim();
  const msg  = document.getElementById("announceMsg");
  if (!text) { showMsg(msg, "⚠️ Cannot be empty", "red"); return; }

  fetch("/club/announcements/post", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: text })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "✅ Posted!", "green");
      const ta = document.getElementById("announceText");
      if (ta) ta.value = "";
      closeAnnounce();
      loadRecentAnnouncements();
      setTimeout(() => { if (msg) msg.innerText = ""; }, 3000);
    } else {
      showMsg(msg, "❌ " + (d.message || "Failed"), "red");
    }
  })
  .catch(err => {
    console.error("[CLUB DASH] postAnnouncement:", err);
    showMsg(msg, "❌ Network error", "red");
  });
}

/* ══════════════════════════════════════════
   DASHBOARD STAT CARDS
   API: GET /club/data
   Returns: memberCount, pendingCount, eventCount, announcementCount
══════════════════════════════════════════ */
function loadDashboardData() {
  fetch("/club/data", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      /* stat cards */
      setText("memberCount",       data.memberCount       ?? data.member_count       ?? 0);
      setText("pendingCount",      data.pendingCount      ?? data.pending_count      ?? 0);
      setText("eventCount",        data.eventCount        ?? data.event_count        ?? 0);
      setText("announcementCount", data.announcementCount ?? data.announcement_count ?? 0);
    })
    .catch(err => console.error("[CLUB DASH] loadDashboardData:", err));
}

/* ══════════════════════════════════════════
   ANALYTICS PANEL
   API: GET /club/analytics
   Returns: memberCount, pendingCount, upcomingEvents, recentMembers[]
══════════════════════════════════════════ */
function loadAnalytics() {
  fetch("/club/analytics", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      setText("analyticsMembers",  data.memberCount    ?? 0);
      setText("analyticsPending",  data.pendingCount   ?? 0);
      setText("analyticsUpcoming", data.upcomingEvents ?? 0);

      const el = document.getElementById("recentMembersList");
      if (!el) return;

      const members = data.recentMembers || [];
      if (!members.length) {
        el.innerHTML = `<li style="color:var(--muted);">No members yet</li>`;
        return;
      }
      el.innerHTML = members.map(m => `
        <li style="padding:10px 14px;border-radius:10px;background:var(--bg);
          display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong>${esc(m.username)}</strong>
            ${m.position_name
              ? `<span style="font-size:12px;color:var(--primary);margin-left:8px;
                   background:#eef2ff;padding:2px 8px;border-radius:10px;">${esc(m.position_name)}</span>`
              : ""}
          </div>
          <span style="font-size:13px;color:var(--muted);">${esc(m.class_name || "—")}</span>
        </li>
      `).join("");
    })
    .catch(err => console.error("[CLUB DASH] loadAnalytics:", err));
}

/* ══════════════════════════════════════════
   RECENT ANNOUNCEMENTS
   API: GET /club/announcements/list
══════════════════════════════════════════ */
function loadRecentAnnouncements() {
  fetch("/club/announcements/list", { credentials: "include" })
    .then(r => r.json())
    .then(notices => {
      const el = document.getElementById("recentAnnouncements");
      if (!el) return;

      if (!notices.length) {
        el.innerHTML = `<p style="color:var(--muted);">No announcements yet.</p>`;
        return;
      }

      el.innerHTML = notices.slice(0, 5).map(n => `
        <div style="padding:14px;border-radius:12px;background:var(--bg);
          border-left:4px solid var(--primary);">
          <p style="font-size:14px;color:var(--ink);margin-bottom:6px;">${esc(n.title)}</p>
          <p style="font-size:12px;color:var(--muted);">
            📅 ${n.created_at
              ? new Date(n.created_at).toLocaleDateString("en-IN", {
                  day:"2-digit", month:"short", year:"numeric"
                })
              : "—"}
            ${n.posted_by ? ` · by <strong>${esc(n.posted_by)}</strong>` : ""}
          </p>
        </div>
      `).join("");
    })
    .catch(err => console.error("[CLUB DASH] loadRecentAnnouncements:", err));
}

/* ── UTILS ── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

function showMsg(el, text, color) {
  if (!el) return;
  el.style.color   = color;
  el.innerText     = text;
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}