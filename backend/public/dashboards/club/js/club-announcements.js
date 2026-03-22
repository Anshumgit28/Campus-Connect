"use strict";
/* ============================================================
   club-announcements.js
   - Single announcement form (no duplicate "quick announce")
   - Only President/VP can post
   - All members can view
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  loadMyRole();
  loadAnnouncements();
});

function loadMyRole() {
  fetch("/club/my-identity", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      const role  = (d.position || "member").toLowerCase().replace(/\s+/g,"_");
      const av    = document.getElementById("avatarLetter");
      if (av) av.innerText = (d.username || "C")[0].toUpperCase();

      const canPost = ["president","vice_president"].includes(role);
      const btn = document.getElementById("postBtn");
      if (btn && canPost) btn.style.display = "inline-flex";
    })
    .catch(() => {});
}

function togglePostForm() {
  const form = document.getElementById("postForm");
  if (!form) return;
  form.style.display = form.style.display === "none" ? "block" : "none";
}

function postAnnouncement() {
  const text = document.getElementById("announceText").value.trim();
  const msg  = document.getElementById("announceMsg");
  if (!text) {
    msg.style.color = "red";
    msg.innerText = "⚠️ Announcement cannot be empty";
    return;
  }

  msg.style.color = "#6366f1";
  msg.innerText = "⏳ Posting...";

  fetch("/club/announcements/post", {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ title: text })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      msg.style.color = "green";
      msg.innerText = "✅ Announcement posted!";
      document.getElementById("announceText").value = "";
      togglePostForm();
      loadAnnouncements();
      setTimeout(() => { msg.innerText = ""; }, 3000);
    } else {
      msg.style.color = "red";
      msg.innerText = "❌ " + (d.message || "Failed to post");
    }
  })
  .catch(() => {
    msg.style.color = "red";
    msg.innerText = "❌ Network error";
  });
}

function loadAnnouncements() {
  fetch("/club/announcements/list", { credentials: "include" })
    .then(r => r.json())
    .then(notices => {
      const el    = document.getElementById("announceList");
      const badge = document.getElementById("countBadge");
      if (badge) badge.innerText = `${notices.length} announcement${notices.length !== 1 ? "s" : ""}`;

      if (!notices.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">📢</span><p>No announcements posted yet.</p></div>`;
        return;
      }

      el.innerHTML = notices.map((n, i) => `
        <div style="padding:18px;border-radius:14px;
          background:${i % 2 === 0 ? "var(--bg)" : "white"};
          border:1px solid var(--border);border-left:5px solid var(--primary);">
          <p style="font-size:15px;line-height:1.6;color:var(--ink);">${esc(n.title)}</p>
          <p style="font-size:12px;color:var(--muted);margin-top:8px;">
            📅 ${n.created_at ? new Date(n.created_at).toLocaleDateString("en-IN",
              {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"}
            ${n.posted_by ? ` · by <strong>${esc(n.posted_by)}</strong>` : ""}
          </p>
        </div>
      `).join("");
    })
    .catch(() => {
      document.getElementById("announceList").innerHTML =
        `<p style="color:red;">Failed to load announcements</p>`;
    });
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}