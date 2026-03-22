/* ============================================================
   club-members.js
   - President: search students by PRN/name, send invite,
     track sent invitations, cancel pending invites, remove
     members, change positions
   - All members: view approved member list
   - Role-aware UI (president sees all controls, members see read-only)
============================================================ */

let myRole = "";
let myClubId = null;
let allMembers = [];
let inviteSearchTimer = null;
let selectedStudentForInvite = null;

/* ── INIT ── */
document.addEventListener("DOMContentLoaded", async () => {
  await loadMyIdentity();
  await Promise.all([loadMembers(), loadRequests()]);
  if (isPresident()) {
    await loadSentInvitations();
  }
});

function isPresident() {
  return myRole.toLowerCase() === "president";
}

function canManage() {
  const r = myRole.toLowerCase();
  return r === "president" || r === "vice president" || r === "vice_president";
}

/* ── MY IDENTITY ── */
async function loadMyIdentity() {
  try {
    const res = await fetch("/club/my-identity");
    const data = await res.json();
    myRole = data.position || "Member";
    myClubId = data.club_id;

    // Topbar avatar
    const avatar = document.getElementById("avatarLetter");
    if (avatar) avatar.textContent = (data.username || "U")[0].toUpperCase();

    // Role strip
    const strip = document.getElementById("myRoleStrip");
    const roleIcons = {
      "president": "👑", "vice president": "🎖️", "vice_president": "🎖️",
      "secretary": "📋", "treasurer": "💰", "member": "👤"
    };
    const icon = roleIcons[myRole.toLowerCase()] || "👤";
    document.getElementById("myRoleIcon").textContent = icon;
    document.getElementById("myRoleName").textContent = myRole;
    document.getElementById("myClubNameStrip").textContent = data.club_name || "Club";

    // Show president-only UI elements
    if (isPresident()) {
      document.getElementById("inviteBtn").style.display = "inline-flex";
      document.getElementById("pendingSection").style.display = "block";
      document.getElementById("sentInvitationsCard").style.display = "block";
    } else if (canManage()) {
      // VP can also see invitations
      document.getElementById("inviteBtn").style.display = "inline-flex";
      document.getElementById("pendingSection").style.display = "block";
      document.getElementById("sentInvitationsCard").style.display = "block";
    }
  } catch (e) {
    console.error("[MEMBERS] loadMyIdentity:", e);
  }
}

/* ── MEMBER LIST ── */
async function loadMembers() {
  try {
    const res = await fetch("/club/members/list");
    allMembers = await res.json();

    const badge = document.getElementById("memberBadge");
    if (badge) badge.textContent = allMembers.length;

    renderMembers(allMembers);
  } catch (e) {
    console.error("[MEMBERS] loadMembers:", e);
  }
}

function renderMembers(members) {
  const el = document.getElementById("membersList");
  if (!el) return;

  if (!members.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:14px;padding:20px 0;">No approved members yet.</p>`;
    return;
  }

  el.innerHTML = members.map(m => {
    const pos = m.position_name || "Member";
    const posClass = getPositionClass(pos);
    const initial = (m.username || "?")[0].toUpperCase();
    const canChange = canManage() && pos.toLowerCase() !== "president";

    return `
    <div class="member-row" id="member-${m.uc_id}">
      <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);
                    color:white;font-weight:800;font-size:16px;display:flex;align-items:center;
                    justify-content:center;flex-shrink:0;">
          ${initial}
        </div>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:14px;color:var(--ink);truncate;">${escHtml(m.username)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">
            ${m.prn ? `PRN: ${escHtml(m.prn)}` : ""}
            ${m.class_name ? ` · ${escHtml(m.class_name)}` : ""}
          </div>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="member-position-badge ${posClass}">${escHtml(pos)}</span>

        ${canChange ? `
          <button class="btn btn-outline btn-sm"
            onclick="openChangePosition(${m.uc_id}, '${escAttr(m.username)}', '${escAttr(pos)}')">
            🎖️ Change Role
          </button>
        ` : ""}

        ${isPresident() && pos.toLowerCase() !== "president" ? `
          <button class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:1px solid #fecaca;"
            onclick="removeMember(${m.uc_id}, '${escAttr(m.username)}')">
            🗑️ Remove
          </button>
        ` : ""}
      </div>
    </div>`;
  }).join("");
}

function filterMembers() {
  const q = document.getElementById("memberSearch").value.toLowerCase();
  if (!q) return renderMembers(allMembers);
  renderMembers(allMembers.filter(m =>
    m.username?.toLowerCase().includes(q) ||
    m.prn?.toLowerCase().includes(q) ||
    m.class_name?.toLowerCase().includes(q)
  ));
}

/* ── PENDING REQUESTS ── */
async function loadRequests() {
  try {
    const res = await fetch("/club/members/requests");
    const requests = await res.json();

    const badge = document.getElementById("pendingBadge");
    if (badge) badge.textContent = requests.length;

    const el = document.getElementById("requestsList");
    if (!el) return;

    if (!requests.length) {
      el.innerHTML = `<p style="color:var(--muted);font-size:13px;padding:8px 0;">No pending requests.</p>`;
      return;
    }

    el.innerHTML = requests.map(r => `
      <div class="member-row" id="req-${r.uc_id}">
        <div style="display:flex;align-items:center;gap:12px;flex:1;">
          <div style="width:38px;height:38px;border-radius:50%;background:#f59e0b;color:white;
                      font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;">
            ${(r.username || "?")[0].toUpperCase()}
          </div>
          <div>
            <div style="font-weight:700;font-size:14px;">${escHtml(r.username)}</div>
            <div style="font-size:12px;color:var(--muted);">
              ${r.prn ? `PRN: ${escHtml(r.prn)}` : ""}
              ${r.class_name ? ` · ${escHtml(r.class_name)}` : ""}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" onclick="respondRequest(${r.uc_id},'approved')">✅ Approve</button>
          <button class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:1px solid #fecaca;"
            onclick="respondRequest(${r.uc_id},'rejected')">✕ Reject</button>
        </div>
      </div>`).join("");
  } catch (e) {
    console.error("[MEMBERS] loadRequests:", e);
  }
}

async function respondRequest(ucId, action) {
  try {
    const res = await fetch("/club/members/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uc_id: ucId, action })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById(`req-${ucId}`)?.remove();
      await loadMembers();
      await loadRequests();
    } else {
      alert(data.message || "Failed to update request");
    }
  } catch (e) {
    console.error("[MEMBERS] respondRequest:", e);
  }
}

/* ── REMOVE MEMBER ── */
async function removeMember(ucId, name) {
  if (!confirm(`Remove "${name}" from the club?`)) return;
  try {
    const res = await fetch("/club/members/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uc_id: ucId })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById(`member-${ucId}`)?.remove();
      allMembers = allMembers.filter(m => m.uc_id !== ucId);
      document.getElementById("memberBadge").textContent = allMembers.length;
    } else {
      alert(data.message || "Failed to remove member");
    }
  } catch (e) {
    console.error("[MEMBERS] removeMember:", e);
  }
}

/* ── CHANGE POSITION MODAL ── */
function openChangePosition(ucId, name, currentPos) {
  document.getElementById("changePositionUcId").value = ucId;
  document.getElementById("changePositionMemberName").textContent = name;
  const sel = document.getElementById("changePositionSelect");
  sel.value = currentPos || "";
  document.getElementById("changePositionMsg").textContent = "";
  document.getElementById("changePositionModal").classList.add("open");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

async function savePositionChange() {
  const ucId = document.getElementById("changePositionUcId").value;
  const position = document.getElementById("changePositionSelect").value;
  const msgEl = document.getElementById("changePositionMsg");
  if (!position) { msgEl.textContent = "Please select a position"; msgEl.style.color = "#dc2626"; return; }

  try {
    const res = await fetch("/club/members/change-position", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uc_id: ucId, position })
    });
    const data = await res.json();
    if (data.success) {
      msgEl.textContent = "✅ Position updated!";
      msgEl.style.color = "#16a34a";
      setTimeout(() => {
        closeModal("changePositionModal");
        loadMembers();
      }, 1000);
    } else {
      msgEl.textContent = data.message || "Failed to update position";
      msgEl.style.color = "#dc2626";
    }
  } catch (e) {
    msgEl.textContent = "Network error";
    msgEl.style.color = "#dc2626";
  }
}

/* ══════════════════════════════════════════════════════
   INVITATION SYSTEM
══════════════════════════════════════════════════════ */

function openInvitePanel() {
  document.getElementById("invitePanel").style.display = "block";
  document.getElementById("inviteSearchInput").focus();
}

function closeInvitePanel() {
  document.getElementById("invitePanel").style.display = "none";
  document.getElementById("inviteSearchResults").innerHTML = "";
  document.getElementById("inviteSearchInput").value = "";
  document.getElementById("inviteMessage").value = "";
  document.getElementById("inviteMsg").textContent = "";
  selectedStudentForInvite = null;
}

/* Search students */
function searchForInvite() {
  clearTimeout(inviteSearchTimer);
  const q = document.getElementById("inviteSearchInput").value.trim();
  if (q.length < 2) {
    document.getElementById("inviteSearchResults").innerHTML =
      `<p style="color:var(--muted);font-size:13px;padding:8px;">Type at least 2 characters to search...</p>`;
    return;
  }
  document.getElementById("inviteSearchResults").innerHTML =
    `<p style="color:var(--muted);font-size:13px;padding:8px;">Searching...</p>`;

  inviteSearchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/club/members/search?q=${encodeURIComponent(q)}`);
      const students = await res.json();
      renderInviteResults(students);
    } catch (e) {
      document.getElementById("inviteSearchResults").innerHTML =
        `<p style="color:#dc2626;font-size:13px;padding:8px;">Search failed. Try again.</p>`;
    }
  }, 350);
}

function renderInviteResults(students) {
  const el = document.getElementById("inviteSearchResults");

  if (!students.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:13px;padding:8px;">No students found.</p>`;
    return;
  }

  el.innerHTML = students.map(s => {
    // Determine button state
    let actionBtn = "";
    if (s.membership_status === "approved") {
      actionBtn = `<span class="already-label already-member">✅ Already a Member</span>`;
    } else if (s.pending_invite === "pending") {
      actionBtn = `<span class="already-label already-invited">⏳ Invite Pending</span>`;
    } else if (s.membership_status === "pending") {
      actionBtn = `<span class="already-label already-invited">⏳ Request Pending</span>`;
    } else {
      actionBtn = `<button class="btn btn-primary btn-sm"
        onclick="sendInvite(${s.id}, '${escAttr(s.username)}', this)">
        📨 Invite
      </button>`;
    }

    return `
    <div class="invite-result-card">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#06b6d4);
                    color:white;font-weight:800;font-size:14px;display:flex;align-items:center;
                    justify-content:center;flex-shrink:0;">
          ${(s.username || "?")[0].toUpperCase()}
        </div>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;color:var(--ink);">${escHtml(s.username)}</div>
          <div style="font-size:11px;color:var(--muted);">
            ${s.prn ? `PRN: ${escHtml(s.prn)}` : ""}
            ${s.class_name ? ` · ${escHtml(s.class_name)}` : ""}
          </div>
        </div>
      </div>
      <div>${actionBtn}</div>
    </div>`;
  }).join("");
}

async function sendInvite(studentId, studentName, btnEl) {
  const message = document.getElementById("inviteMessage").value.trim();
  const msgEl = document.getElementById("inviteMsg");

  // Disable button immediately to prevent double-send
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = "Sending..."; }

  try {
    const res = await fetch("/club/invitations/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, message: message || null })
    });
    const data = await res.json();
    if (data.success) {
      msgEl.textContent = `✅ Invitation sent to ${studentName}! They have 7 days to accept.`;
      msgEl.style.color = "#16a34a";
      if (btnEl) {
        btnEl.textContent = "⏳ Pending";
        btnEl.disabled = true;
        btnEl.style.background = "#fef3c7";
        btnEl.style.color = "#92400e";
      }
      // Refresh sent invitations list
      loadSentInvitations();
    } else {
      msgEl.textContent = `❌ ${data.message || "Failed to send invitation"}`;
      msgEl.style.color = "#dc2626";
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = "📨 Invite"; }
    }
    // Clear msg after 4 seconds
    setTimeout(() => { msgEl.textContent = ""; }, 4000);
  } catch (e) {
    msgEl.textContent = "❌ Network error. Try again.";
    msgEl.style.color = "#dc2626";
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = "📨 Invite"; }
  }
}

/* ── SENT INVITATIONS ── */
async function loadSentInvitations() {
  try {
    const res = await fetch("/club/invitations/sent");
    const invites = await res.json();

    const pendingCount = invites.filter(i => i.status === "pending").length;
    const badge = document.getElementById("pendingInviteBadge");
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount ? "inline" : "none";
    }

    const el = document.getElementById("sentInvitationsList");
    if (!el) return;

    if (!invites.length) {
      el.innerHTML = `<p style="color:var(--muted);font-size:13px;padding:8px 0;">No invitations sent yet.</p>`;
      return;
    }

    el.innerHTML = invites.map(inv => {
      const statusClass = `inv-${inv.status}`;
      const statusEmoji = { pending:"⏳", accepted:"✅", declined:"✕", expired:"⌛" }[inv.status] || "•";
      const expiresText = inv.status === "pending"
        ? `Expires: ${formatDate(inv.expires_at)}`
        : `Updated: ${formatDate(inv.updated_at || inv.created_at)}`;

      return `
      <div class="invite-result-card" id="inv-${inv.id}">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
          <div style="width:34px;height:34px;border-radius:50%;background:#e0e7ff;color:#4f46e5;
                      font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${(inv.username || "?")[0].toUpperCase()}
          </div>
          <div style="min-width:0;">
            <div style="font-weight:700;font-size:13px;">${escHtml(inv.username)}</div>
            <div style="font-size:11px;color:var(--muted);">
              ${inv.prn ? `PRN: ${escHtml(inv.prn)}` : ""}
              ${inv.class_name ? ` · ${escHtml(inv.class_name)}` : ""}
              · ${expiresText}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="inv-status ${statusClass}">${statusEmoji} ${capitalise(inv.status)}</span>
          ${inv.status === "pending" ? `
            <button class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:1px solid #fecaca;font-size:11px;"
              onclick="cancelInvite(${inv.id})">🗑️ Cancel</button>
          ` : ""}
        </div>
      </div>`;
    }).join("");
  } catch (e) {
    console.error("[MEMBERS] loadSentInvitations:", e);
  }
}

async function cancelInvite(invId) {
  if (!confirm("Cancel this invitation?")) return;
  try {
    const res = await fetch("/club/invitations/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitation_id: invId })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById(`inv-${invId}`)?.remove();
      loadSentInvitations();
    } else {
      alert(data.message || "Failed to cancel");
    }
  } catch (e) {
    console.error("[MEMBERS] cancelInvite:", e);
  }
}

/* ── HELPERS ── */
function getPositionClass(pos) {
  const p = (pos || "").toLowerCase();
  if (p === "president")                      return "pos-president";
  if (p === "vice president" || p === "vice_president") return "pos-vice-president";
  if (p === "secretary")                      return "pos-secretary";
  if (p === "treasurer")                      return "pos-treasurer";
  if (p === "member")                         return "pos-member";
  return "pos-default";
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(str) {
  if (!str) return "";
  return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric"
    });
  } catch { return dateStr; }
}

function capitalise(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Close modal on overlay click
document.addEventListener("click", e => {
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("open");
  }
});