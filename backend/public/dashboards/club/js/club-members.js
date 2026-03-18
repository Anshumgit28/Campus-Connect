"use strict";

document.addEventListener("DOMContentLoaded", () => {
  loadRequests();
  loadMembers();
});

function loadRequests() {
  fetch("/club/members/requests", { credentials: "include" })
    .then(r => r.json())
    .then(requests => {
      document.getElementById("pendingBadge").innerText = requests.length;
      const el = document.getElementById("requestsList");
      
      if (!requests.length) {
        el.innerHTML = `<p style="color:var(--muted);">No pending requests 🎉</p>`;
        return;
      }
      
      el.innerHTML = requests.map(r => `
        <div style="padding:16px; border-radius:12px; background:var(--bg); border:1px solid var(--border);
          display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <strong>${r.username}</strong>
            <p style="font-size:13px; color:var(--muted);">${r.email}</p>
            <p style="font-size:12px; color:var(--muted);">PRN: ${r.prn || "—"} | Class: ${r.class_name || "—"}</p>
          </div>
          <div style="display:flex; gap:10px;">
            <button onclick="respond(${r.uc_id}, 'approved')"
              style="padding:8px 18px; border-radius:8px; border:none; background:#22c55e; color:white; font-weight:600; cursor:pointer;">
              ✅ Approve
            </button>
            <button onclick="respond(${r.uc_id}, 'rejected')"
              style="padding:8px 18px; border-radius:8px; border:none; background:#ef4444; color:white; font-weight:600; cursor:pointer;">
              ❌ Reject
            </button>
          </div>
        </div>
      `).join("");
    })
    .catch(err => console.error("Load requests error:", err));
}

function loadMembers() {
  fetch("/club/members/list", { credentials: "include" })
    .then(r => r.json())
    .then(members => {
      document.getElementById("memberBadge").innerText = members.length;
      const el = document.getElementById("membersList");
      
      if (!members.length) {
        el.innerHTML = `<p style="color:var(--muted);">No members yet</p>`;
        return;
      }
      
      el.innerHTML = members.map(m => `
        <div class="student-profile-card card" style="margin:0; padding:16px;
          display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <strong>${m.username}</strong>
            <p style="font-size:13px; color:var(--muted);">${m.email}</p>
            <p style="font-size:12px; color:var(--muted);">PRN: ${m.prn || "—"} | Class: ${m.class_name || "—"} | Year: ${m.current_year || "—"}</p>
          </div>
          <button onclick="removeMember(${m.uc_id})"
            style="padding:8px 16px; border-radius:8px; border:1px solid var(--danger); background:white; color:var(--danger); font-weight:600; cursor:pointer;">
            Remove
          </button>
        </div>
      `).join("");
    })
    .catch(err => console.error("Load members error:", err));
}

function respond(uc_id, action) {
  fetch("/club/members/respond", {
    method: "POST", 
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uc_id, action })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) { 
      loadRequests(); 
      loadMembers(); 
    } else {
      alert(d.message || "Error");
    }
  })
  .catch(err => console.error("Respond error:", err));
}

function removeMember(uc_id) {
  if (!confirm("Remove this member from the club?")) return;
  
  fetch("/club/members/remove", {
    method: "POST", 
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uc_id })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) loadMembers();
    else alert("Error removing member");
  })
  .catch(err => console.error("Remove member error:", err));
}