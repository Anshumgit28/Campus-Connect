"use strict";

let allUsers      = [];
let allClubs      = [];
let allPositions  = [];
let currentUserId = null;

document.addEventListener("DOMContentLoaded", () => {
  loadUsers();
  loadClubs();
  loadPositions();
});

/* ═══════════════════════════════════════════
   LOAD DATA
═══════════════════════════════════════════ */
function loadUsers() {
  const tbody = document.getElementById("userTableBody");
  tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:#6b7280;">Loading users…</td></tr>`;

  fetch("/admin/users/list", { credentials: "include" })
    .then(r => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(data => {
      allUsers = Array.isArray(data) ? data : [];
      console.log("[ADMIN] Users loaded:", allUsers.length);
      renderUsers(allUsers);
    })
    .catch(err => {
      console.error("[ADMIN] Load users error:", err);
      showMessage("Failed to load users: " + err.message, true);
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding:40px;text-align:center;color:#ef4444;">
            <strong>Error: ${err.message}</strong><br>
            <button onclick="loadUsers()"
              style="margin-top:10px;padding:8px 16px;border-radius:8px;border:none;
                background:#6366f1;color:white;cursor:pointer;">
              Retry
            </button>
          </td>
        </tr>`;
    });
}

function loadClubs() {
  fetch("/admin/clubs/list", { credentials: "include" })
    .then(r => r.json())
    .then(data => { allClubs = Array.isArray(data) ? data : []; updateClubSelect(); })
    .catch(err => console.error("Load clubs:", err));
}

function loadPositions() {
  fetch("/admin/clubs/positions", { credentials: "include" })
    .then(r => r.json())
    .then(data => { allPositions = Array.isArray(data) ? data : []; updatePositionSelect(); })
    .catch(err => console.error("Load positions:", err));
}

/* ═══════════════════════════════════════════
   RENDER TABLE
   is_active is a boolean derived server-side
   from users.status ('active' / 'inactive')
═══════════════════════════════════════════ */
function renderUsers(users) {
  if (!Array.isArray(users)) users = [];

  const count = users.length;
  document.getElementById("userCountLabel").innerText =
    count + " user" + (count !== 1 ? "s" : "");

  const tbody = document.getElementById("userTableBody");

  if (!count) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:#6b7280;">No users found</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const active      = !!u.is_active;
    const roleClass   = "role-"   + (u.role || "").replace(/_/g, "-");
    const statusClass = active ? "status-active" : "status-inactive";

    return `
      <tr id="row-${u.id}">
        <td style="font-weight:600;color:#6366f1;">#${u.id}</td>

        <td>
          <strong style="font-size:14px;">${escapeHtml(u.username)}</strong>
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">${escapeHtml(u.email)}</div>
          ${u.prn        ? `<div style="font-size:11px;color:#9ca3af;">PRN: ${escapeHtml(u.prn)}</div>`        : ""}
          ${u.class_name ? `<div style="font-size:11px;color:#9ca3af;">${escapeHtml(u.class_name)}</div>`      : ""}
        </td>

        <td>
          <select onchange="changeRole(${u.id}, this.value)"
            style="padding:6px 10px;border-radius:8px;border:1px solid #e0e7ff;
              font-size:13px;cursor:pointer;width:100%;">
            ${["student","faculty","alumni","club_head","admin"].map(r =>
              `<option value="${r}" ${u.role === r ? "selected" : ""}>${r.replace(/_/g," ")}</option>`
            ).join("")}
          </select>
          <div style="margin-top:4px;">
            <span class="role-badge ${roleClass}">${(u.role||"").replace(/_/g," ")}</span>
          </div>
        </td>

        <td>
          ${u.club_name
            ? `<div style="font-size:12px;">
                <strong>${escapeHtml(u.club_name)}</strong>
                ${u.position_name ? `<br><span style="color:#6b7280;">${escapeHtml(u.position_name)}</span>` : ""}
               </div>`
            : `<span style="color:#9ca3af;font-size:12px;">No club</span>`
          }
          <button class="action-btn btn-secondary"
            onclick="openClubModal(${u.id}, '${escapeHtml(u.username)}')"
            style="margin-top:6px;padding:4px 10px;font-size:11px;">
            ${u.club_name ? "Change" : "Assign"}
          </button>
        </td>

        <td>
          <span id="status-badge-${u.id}" class="role-badge ${statusClass}">
            ${active ? "✅ Active" : "❌ Inactive"}
          </span>
        </td>

        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button id="toggle-btn-${u.id}"
              class="action-btn ${active ? "btn-secondary" : "btn-success"}"
              onclick="toggleUser(${u.id})">
              ${active ? "Deactivate" : "Activate"}
            </button>
            <button class="action-btn btn-danger" onclick="deleteUser(${u.id})">
              Delete
            </button>
          </div>
        </td>
      </tr>`;
  }).join("");
}

/* ═══════════════════════════════════════════
   FILTER
═══════════════════════════════════════════ */
function filterUsers() {
  const q      = (document.getElementById("searchUser").value || "").toLowerCase();
  const role   = document.getElementById("roleFilter").value;
  const status = document.getElementById("statusFilter").value;

  const filtered = allUsers.filter(u => {
    const matchSearch = !q ||
      (u.username   || "").toLowerCase().includes(q) ||
      (u.email      || "").toLowerCase().includes(q) ||
      (u.prn        || "").toLowerCase().includes(q) ||
      (u.class_name || "").toLowerCase().includes(q);

    const matchRole   = !role   || u.role === role;
    const matchStatus =
      !status ||
      (status === "1" &&  u.is_active) ||
      (status === "0" && !u.is_active);

    return matchSearch && matchRole && matchStatus;
  });

  renderUsers(filtered);
}

/* ═══════════════════════════════════════════
   CHANGE ROLE
═══════════════════════════════════════════ */
function changeRole(user_id, role) {
  fetch("/admin/users/role", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, role })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      const u = allUsers.find(u => u.id === user_id);
      if (u) u.role = role;
      showMessage(`✅ Role updated to "${role.replace(/_/g," ")}"`, false);
      filterUsers();
    } else {
      showMessage("❌ " + (d.message || "Failed"), true);
      loadUsers();
    }
  })
  .catch(err => { showMessage("❌ Network error", true); console.error(err); });
}

/* ═══════════════════════════════════════════
   TOGGLE STATUS
   Server toggles users.status varchar and
   returns is_active boolean
═══════════════════════════════════════════ */
function toggleUser(user_id) {
  fetch("/admin/users/toggle", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      const u = allUsers.find(u => u.id === user_id);
      if (u) u.is_active = d.is_active;

      const badge = document.getElementById("status-badge-" + user_id);
      if (badge) {
        badge.className = "role-badge " + (d.is_active ? "status-active" : "status-inactive");
        badge.innerText = d.is_active ? "✅ Active" : "❌ Inactive";
      }
      const btn = document.getElementById("toggle-btn-" + user_id);
      if (btn) {
        btn.className = "action-btn " + (d.is_active ? "btn-secondary" : "btn-success");
        btn.innerText = d.is_active ? "Deactivate" : "Activate";
      }
      showMessage("✅ User " + (d.is_active ? "activated" : "deactivated"), false);
    } else {
      showMessage("❌ " + (d.message || "Failed"), true);
    }
  })
  .catch(err => { showMessage("❌ Network error", true); console.error(err); });
}

/* ═══════════════════════════════════════════
   DELETE USER
═══════════════════════════════════════════ */
function deleteUser(user_id) {
  const u    = allUsers.find(u => u.id === user_id);
  const name = u ? u.username : "this user";
  const conf = prompt(`⚠️ DELETE: ${name}\n\nType DELETE to confirm:`);
  if (conf !== "DELETE") { showMessage("Cancelled", false); return; }

  fetch("/admin/users/delete", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      allUsers = allUsers.filter(u => u.id !== user_id);
      const row = document.getElementById("row-" + user_id);
      if (row) row.remove();
      filterUsers();
      showMessage("✅ User deleted", false);
    } else {
      showMessage("❌ " + (d.message || "Failed"), true);
    }
  })
  .catch(err => { showMessage("❌ Network error", true); console.error(err); });
}

/* ═══════════════════════════════════════════
   CLUB MODAL
═══════════════════════════════════════════ */
function openClubModal(userId, username) {
  currentUserId = userId;
  document.getElementById("modalUsername").innerText = username;
  document.getElementById("clubModal").classList.add("active");
}

function closeClubModal() {
  document.getElementById("clubModal").classList.remove("active");
  currentUserId = null;
}

function updateClubSelect() {
  document.getElementById("clubSelect").innerHTML =
    '<option value="">Select Club</option>' +
    allClubs.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

function updatePositionSelect() {
  document.getElementById("positionSelect").innerHTML =
    '<option value="">Select Position</option>' +
    allPositions.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
}

function saveClubAssignment() {
  const clubId     = document.getElementById("clubSelect").value;
  const positionId = document.getElementById("positionSelect").value;
  if (!clubId) { alert("Please select a club"); return; }

  fetch("/admin/users/assign-club", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id:     currentUserId,
      club_id:     parseInt(clubId),
      position_id: positionId ? parseInt(positionId) : null
    })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMessage("✅ Club assigned!", false);
      closeClubModal();
      loadUsers();
    } else {
      alert("❌ " + (d.message || "Failed"));
    }
  })
  .catch(err => { alert("❌ Network error"); console.error(err); });
}

/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */
function showMessage(msg, isError) {
  const el = document.getElementById("statusMessage");
  if (!el) return;
  el.style.color = isError ? "#ef4444" : "#22c55e";
  el.innerText = msg;
  setTimeout(() => { el.innerText = ""; }, 4000);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}