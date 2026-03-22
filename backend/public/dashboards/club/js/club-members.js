/* ============================================================
   club-members.js — FIXED v5
   KEY FIX:
   - Invite button is shown/hidden based on role ONCE at init
   - After adding/responding to a member, the button visibility
     is RE-APPLIED so it never disappears
   - canManage() handles club_head, president, VP roles
============================================================ */

let myRole     = "";
let myUserRole = ""; // session role: 'club_head', 'student', etc.
let myClubId   = null;
let allMembers = [];
let inviteSearchTimer = null;

/* ── INIT ── */
document.addEventListener("DOMContentLoaded", async () => {
  await loadMyIdentity();
  await Promise.all([loadMembers(), loadRequests()]);
  if (canManage()) {
    await loadSentInvitations();
  }
});

function isPresident() {
  const r = myRole.toLowerCase().trim();
  return r === "president" ||
         myUserRole === "club_head" ||
         r === "club_head" ||
         r === "club head";
}

function canManage() {
  if (myUserRole === "club_head" || myUserRole === "admin") return true;
  const r = myRole.toLowerCase().trim();
  return r === "president" ||
         r === "club_head" ||
         r === "club head" ||
         r === "vice president" ||
         r === "vice_president" ||
         r === "vp";
}

/* ── APPLY UI BASED ON ROLE — called after every reload ── */
function applyRoleUI() {
  if (canManage()) {
    const inviteBtn           = document.getElementById("inviteBtn");
    const pendingSection      = document.getElementById("pendingSection");
    const sentInvitationsCard = document.getElementById("sentInvitationsCard");
    if (inviteBtn)           inviteBtn.style.display           = "inline-flex";
    if (pendingSection)      pendingSection.style.display      = "block";
    if (sentInvitationsCard) sentInvitationsCard.style.display = "block";
  }
}

/* ── MY IDENTITY ── */
async function loadMyIdentity() {
  try {
    const res  = await fetch("/club/my-identity");
    const data = await res.json();

    myRole     = data.position  || "Member";
    myUserRole = data.user_role || "";
    myClubId   = data.club_id;

    console.log("[MEMBERS] identity:", data);
    console.log("[MEMBERS] myRole:", myRole, "| myUserRole:", myUserRole);
    console.log("[MEMBERS] canManage:", canManage(), "| isPresident:", isPresident());

    const avatar = document.getElementById("avatarLetter");
    if (avatar) avatar.textContent = (data.username || "U")[0].toUpperCase();

    const roleIcons = {
      "president":       "👑",
      "club_head":       "👑",
      "club head":       "👑",
      "vice president":  "🎖️",
      "vice_president":  "🎖️",
      "secretary":       "📋",
      "treasurer":       "💰",
      "member":          "👤"
    };
    const icon = roleIcons[myRole.toLowerCase()] || "👤";

    const myRoleIconEl  = document.getElementById("myRoleIcon");
    const myRoleNameEl  = document.getElementById("myRoleName");
    const myClubNameEl  = document.getElementById("myClubNameStrip");
    if (myRoleIconEl)  myRoleIconEl.textContent  = icon;
    if (myRoleNameEl)  myRoleNameEl.textContent  = myRole;
    if (myClubNameEl)  myClubNameEl.textContent  = data.club_name || "Club";

    // Apply UI visibility based on role
    applyRoleUI();

  } catch (e) {
    console.error("[MEMBERS] loadMyIdentity error:", e);
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
  // Re-apply role UI after every member reload to ensure invite button stays visible
  applyRoleUI();
}

function renderMembers(members) {
  const el = document.getElementById("membersList");
  if (!el) return;

  if (!members.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:14px;padding:20px 0;">No approved members yet.</p>`;
    return;
  }

  el.innerHTML = members.map(m => {
    const pos      = m.position_name || "Member";
    const posClass = getPositionClass(pos);
    const initial  = (m.username || "?")[0].toUpperCase();
    const canChange = canManage() && pos.toLowerCase() !== "president";

    return `
    <div class="member-row" id="member-${m.uc_id}">
      <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
        <div style="width:40px;height:40px;border-radius:50%;
          background:linear-gradient(135deg,#6366f1,#8b5cf6);
          color:white;font-weight:800;font-size:16px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${initial}
        </div>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:14px;color:var(--ink);">${escHtml(m.username)}</div>
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
            onclick="openChangePosition(${m.uc_id},'${escAttr(m.username)}','${escAttr(pos)}')">
            🎖️ Change Role
          </button>` : ""}
        ${isPresident() && pos.toLowerCase() !== "president" ? `
          <button class="btn btn-sm"
            style="background:#fee2e2;color:#dc2626;border:1px solid #fecaca;"
            onclick="removeMember(${m.uc_id},'${escAttr(m.username)}')">
            🗑️ Remove
          </button>` : ""}
      </div>
    </div>`;
  }).join("");
}

function filterMembers() {
  const q = (document.getElementById("memberSearch")?.value || "").toLowerCase();
  if (!q) return renderMembers(allMembers);
  renderMembers(allMembers.filter(m =>
    (m.username   || "").toLowerCase().includes(q) ||
    (m.prn        || "").toLowerCase().includes(q) ||
    (m.class_name || "").toLowerCase().includes(q)
  ));
}

/* ── PENDING REQUESTS ── */
async function loadRequests() {
  try {
    const res      = await fetch("/club/members/requests");
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
          <div style="width:38px;height:38px;border-radius:50%;background:#f59e0b;
            color:white;font-weight:800;font-size:15px;
            display:flex;align-items:center;justify-content:center;">
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
          <button class="btn btn-primary btn-sm"
            onclick="respondRequest(${r.uc_id},'approved')">✅ Approve</button>
          <button class="btn btn-sm"
            style="background:#fee2e2;color:#dc2626;border:1px solid #fecaca;"
            onclick="respondRequest(${r.uc_id},'rejected')">✕ Reject</button>
        </div>
      </div>`).join("");
  } catch (e) {
    console.error("[MEMBERS] loadRequests:", e);
  }
}

async function respondRequest(ucId, action) {
  try {
    const res  = await fetch("/club/members/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uc_id: ucId, action })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById(`req-${ucId}`)?.remove();
      // Reload members AND re-apply invite button visibility
      await loadMembers();
      await loadRequests();
      applyRoleUI(); // ← KEY FIX: ensure invite button stays visible
    } else {
      alert(data.message || "Failed");
    }
  } catch (e) {
    console.error("[MEMBERS] respondRequest:", e);
  }
}

/* ── REMOVE MEMBER ── */
async function removeMember(ucId, name) {
  if (!confirm(`Remove "${name}" from the club?`)) return;
  try {
    const res  = await fetch("/club/members/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uc_id: ucId })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById(`member-${ucId}`)?.remove();
      allMembers = allMembers.filter(m => m.uc_id !== ucId);
      const badge = document.getElementById("memberBadge");
      if (badge) badge.textContent = allMembers.length;
      applyRoleUI(); // ← re-apply after remove too
    } else {
      alert(data.message || "Failed");
    }
  } catch (e) {
    console.error("[MEMBERS] removeMember:", e);
  }
}

/* ── CHANGE POSITION MODAL ── */
function openChangePosition(ucId, name, currentPos) {
  const ucIdEl   = document.getElementById("changePositionUcId");
  const nameEl   = document.getElementById("changePositionMemberName");
  const selEl    = document.getElementById("changePositionSelect");
  const modal    = document.getElementById("changePositionModal");
  const msgEl    = document.getElementById("changePositionMsg");
  if (ucIdEl)  ucIdEl.value        = ucId;
  if (nameEl)  nameEl.textContent  = name;
  if (selEl)   selEl.value         = currentPos || "";
  if (msgEl)   msgEl.textContent   = "";
  if (modal)   modal.classList.add("open");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

async function savePositionChange() {
  const ucId     = document.getElementById("changePositionUcId")?.value;
  const position = document.getElementById("changePositionSelect")?.value;
  const msgEl    = document.getElementById("changePositionMsg");

  if (!position) {
    if (msgEl) { msgEl.textContent = "Please select a position"; msgEl.style.color = "#dc2626"; }
    return;
  }
  try {
    const res  = await fetch("/club/members/change-position", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uc_id: ucId, position })
    });
    const data = await res.json();
    if (data.success) {
      if (msgEl) { msgEl.textContent = "✅ Position updated!"; msgEl.style.color = "#16a34a"; }
      setTimeout(() => { closeModal("changePositionModal"); loadMembers(); }, 1000);
    } else {
      if (msgEl) { msgEl.textContent = data.message || "Failed"; msgEl.style.color = "#dc2626"; }
    }
  } catch (e) {
    if (msgEl) { msgEl.textContent = "Network error"; msgEl.style.color = "#dc2626"; }
  }
}

/* ══════════════════════════════════════
   INVITATION SYSTEM
══════════════════════════════════════ */

function openInvitePanel() {
  const panel = document.getElementById("invitePanel");
  const input = document.getElementById("inviteSearchInput");
  if (panel) panel.style.display = "block";
  if (input) input.focus();
  applyRoleUI(); // ensure button stays visible when panel opens
}

function closeInvitePanel() {
  const panel   = document.getElementById("invitePanel");
  const results = document.getElementById("inviteSearchResults");
  const input   = document.getElementById("inviteSearchInput");
  const msg     = document.getElementById("inviteMsg");
  const message = document.getElementById("inviteMessage");
  if (panel)   panel.style.display = "none";
  if (results) results.innerHTML   = "";
  if (input)   input.value         = "";
  if (msg)     msg.textContent     = "";
  if (message) message.value       = "";
  // Keep the invite BUTTON visible even after closing the panel
  applyRoleUI();
}

function searchForInvite() {
  clearTimeout(inviteSearchTimer);
  const q       = (document.getElementById("inviteSearchInput")?.value || "").trim();
  const results = document.getElementById("inviteSearchResults");
  if (q.length < 2) {
    if (results) results.innerHTML =
      `<p style="color:var(--muted);font-size:13px;padding:8px;">Type at least 2 characters...</p>`;
    return;
  }
  if (results) results.innerHTML =
    `<p style="color:var(--muted);font-size:13px;padding:8px;">Searching...</p>`;

  inviteSearchTimer = setTimeout(async () => {
    try {
      const res      = await fetch(`/club/members/search?q=${encodeURIComponent(q)}`);
      const students = await res.json();
      renderInviteResults(students);
    } catch (e) {
      if (results) results.innerHTML =
        `<p style="color:#dc2626;font-size:13px;padding:8px;">Search failed.</p>`;
    }
  }, 350);
}

function renderInviteResults(students) {
  const el = document.getElementById("inviteSearchResults");
  if (!el) return;

  if (!students.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:13px;padding:8px;">No students found.</p>`;
    return;
  }

  el.innerHTML = students.map(s => {
    let actionBtn = "";
    if (s.membership_status === "approved") {
      actionBtn = `<span class="already-label already-member">✅ Already a Member</span>`;
    } else if (s.pending_invite === "pending") {
      actionBtn = `<span class="already-label already-invited">⏳ Invite Pending</span>`;
    } else if (s.membership_status === "pending") {
      actionBtn = `<span class="already-label already-invited">⏳ Request Pending</span>`;
    } else {
      actionBtn = `<button class="btn btn-primary btn-sm"
        onclick="sendInvite(${s.id},'${escAttr(s.username)}',this)">
        📨 Invite
      </button>`;
    }

    return `
    <div class="invite-result-card">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <div style="width:36px;height:36px;border-radius:50%;
          background:linear-gradient(135deg,#6366f1,#06b6d4);
          color:white;font-weight:800;font-size:14px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;">
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
  const message = (document.getElementById("inviteMessage")?.value || "").trim();
  const msgEl   = document.getElementById("inviteMsg");

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = "Sending..."; }

  try {
    const res  = await fetch("/club/invitations/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, message: message || null })
    });
    const data = await res.json();
    console.log("[INVITE] response:", data);

    if (data.success) {
      if (msgEl) { msgEl.textContent = `✅ Invitation sent to ${studentName}!`; msgEl.style.color = "#16a34a"; }
      if (btnEl) { btnEl.textContent = "⏳ Pending"; btnEl.style.background = "#fef3c7"; btnEl.style.color = "#92400e"; }
      loadSentInvitations();
      applyRoleUI(); // keep invite button visible after sending
    } else {
      if (msgEl) { msgEl.textContent = `❌ ${data.message || "Failed"}`; msgEl.style.color = "#dc2626"; }
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = "📨 Invite"; }
    }
    setTimeout(() => { if (msgEl) msgEl.textContent = ""; }, 4000);
  } catch (e) {
    if (msgEl) { msgEl.textContent = "❌ Network error."; msgEl.style.color = "#dc2626"; }
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = "📨 Invite"; }
  }
}

/* ── SENT INVITATIONS ── */
async function loadSentInvitations() {
  try {
    const res     = await fetch("/club/invitations/sent");
    const invites = await res.json();

    const pendingCount = invites.filter(i => i.status === "pending").length;
    const badge        = document.getElementById("pendingInviteBadge");
    if (badge) { badge.textContent = pendingCount; badge.style.display = pendingCount ? "inline" : "none"; }

    const el = document.getElementById("sentInvitationsList");
    if (!el) return;

    if (!invites.length) {
      el.innerHTML = `<p style="color:var(--muted);font-size:13px;padding:8px 0;">No invitations sent yet.</p>`;
      return;
    }

    el.innerHTML = invites.map(inv => {
      const statusEmoji = { pending:"⏳", accepted:"✅", declined:"✕", expired:"⌛" }[inv.status] || "•";
      const expiresText = inv.status === "pending"
        ? `Expires: ${formatDate(inv.expires_at)}`
        : `Updated: ${formatDate(inv.updated_at || inv.created_at)}`;

      return `
      <div class="invite-result-card" id="inv-${inv.id}">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
          <div style="width:34px;height:34px;border-radius:50%;background:#e0e7ff;
            color:#4f46e5;font-weight:800;font-size:13px;
            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
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
          <span class="inv-status inv-${inv.status}">${statusEmoji} ${capitalise(inv.status)}</span>
          ${inv.status === "pending" ? `
            <button class="btn btn-sm"
              style="background:#fee2e2;color:#dc2626;border:1px solid #fecaca;font-size:11px;"
              onclick="cancelInvite(${inv.id})">🗑️ Cancel</button>` : ""}
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
    const res  = await fetch("/club/invitations/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitation_id: invId })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById(`inv-${invId}`)?.remove();
      loadSentInvitations();
      applyRoleUI(); // keep button visible after cancel
    } else {
      alert(data.message || "Failed");
    }
  } catch (e) {
    console.error("[MEMBERS] cancelInvite:", e);
  }
}

/* ── HELPERS ── */
function getPositionClass(pos) {
  const p = (pos || "").toLowerCase();
  if (p === "president")                                return "pos-president";
  if (p === "vice president" || p === "vice_president") return "pos-vice-president";
  if (p === "secretary")                                return "pos-secretary";
  if (p === "treasurer")                                return "pos-treasurer";
  return "pos-member";
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function escAttr(str) {
  if (!str) return "";
  return String(str).replace(/'/g,"\\'").replace(/"/g,"&quot;");
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN",
      { day:"numeric", month:"short", year:"numeric" });
  } catch(_) { return dateStr; }
}

function capitalise(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

document.addEventListener("click", e => {
  if (e.target.classList.contains("modal-overlay"))
    e.target.classList.remove("open");
});