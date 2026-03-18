"use strict";

document.addEventListener("DOMContentLoaded", loadAnnouncements);

function postAnnouncement() {
  const title = document.getElementById("announceText").value.trim();
  const msg = document.getElementById("announceMsg");

  if (!title) {
    msg.style.color = "red"; 
    msg.innerText = "Announcement cannot be empty"; 
    return;
  }

  fetch("/club/announcements/post", {
    method: "POST", 
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      msg.style.color = "green"; 
      msg.innerText = "✅ Announcement posted!";
      document.getElementById("announceText").value = "";
      loadAnnouncements();
      setTimeout(() => { msg.innerText = ""; }, 3000);
    } else {
      msg.style.color = "red"; 
      msg.innerText = d.message || "Failed to post";
    }
  })
  .catch(err => console.error("Post announcement error:", err));
}

function loadAnnouncements() {
  fetch("/club/announcements/list", { credentials: "include" })
    .then(r => r.json())
    .then(notices => {
      const el = document.getElementById("announceList");
      
      if (!notices.length) {
        el.innerHTML = `<p style="color:var(--muted);">No announcements posted yet</p>`;
        return;
      }
      
      el.innerHTML = notices.map((n, i) => `
        <div style="padding:18px; border-radius:14px; background:${i % 2 === 0 ? 'var(--bg)' : 'white'};
          border:1px solid var(--border); border-left:5px solid var(--primary); position:relative;">
          <p style="font-size:15px; line-height:1.6; color:var(--text);">${n.title}</p>
          <p style="font-size:12px; color:var(--muted); margin-top:8px;">
            📅 ${n.created_at ? new Date(n.created_at).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—"}
          </p>
        </div>
      `).join("");
    })
    .catch(err => console.error("Load announcements error:", err));
}