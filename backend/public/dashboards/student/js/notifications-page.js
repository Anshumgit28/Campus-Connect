"use strict";

document.addEventListener("DOMContentLoaded", () => {
  loadInvitations();
  Notifications.loadNotifications("notificationsList");
  Notifications.loadUnreadCount("notifBadge");
});

/* ── LOAD INVITATIONS ── */
async function loadInvitations() {
  try {
    const res     = await fetch("/club/invitations/mine");
    const invites = await res.json();

    const pending = invites.filter(i => i.status === "pending");
    const badge   = document.getElementById("inviteBadge");
    if (badge) {
      badge.innerText       = pending.length;
      badge.style.display   = pending.length ? "inline" : "none";
    }

    const el = document.getElementById("invitationsList");

    if (!invites.length) {
      el.innerHTML = `<div class="no-invites">📭 No club invitations yet</div>`;
      return;
    }

    el.innerHTML = invites.map(inv => {
      const daysLeft  = Math.ceil((new Date(inv.expires_at) - new Date()) / 86400000);
      const expiryTxt = daysLeft > 0 ? `⏰ Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}` : "⌛ Expires soon";

      const actions = inv.status === "pending" ? `
        <div class="invite-actions">
          <button class="btn-accept" onclick="respond(${inv.id},'accepted',this)">✅ Accept</button>
          <button class="btn-decline" onclick="respond(${inv.id},'declined',this)">✕ Decline</button>
        </div>` : `
        <div>
          <span class="invite-responded ${inv.status}">
            ${{ accepted: "✅ Accepted", declined: "✕ Declined", expired: "⌛ Expired" }[inv.status] || inv.status}
          </span>
        </div>`;

      return `
        <div class="invite-banner ${inv.status !== "pending" ? 'opacity:.7' : ''}" id="invite-${inv.id}"
          style="${inv.status !== "pending" ? "opacity:.7;" : ""}">
          <div class="invite-banner-left">
            <div class="invite-icon">🏛️</div>
            <div class="invite-text">
              <div class="invite-club-name">${escH(inv.club_name)}</div>
              <div class="invite-meta">Invited by ${escH(inv.invited_by_name)}</div>
              ${inv.message ? `<div class="invite-meta" style="font-style:italic;">"${escH(inv.message)}"</div>` : ""}
              ${inv.status === "pending" ? `<div class="invite-expiry">${expiryTxt}</div>` : ""}
            </div>
          </div>
          ${actions}
        </div>`;
    }).join("");

  } catch (e) {
    document.getElementById("invitationsList").innerHTML =
      `<p style="color:red;font-size:13px;">Failed to load invitations. Please refresh.</p>`;
  }
}

/* ── RESPOND TO INVITATION ── */
async function respond(invId, action, btnEl) {
  if (btnEl) btnEl.disabled = true;

  try {
    const res  = await fetch("/club/invitations/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitation_id: invId, action })
    });
    const data = await res.json();

    if (data.success) {
      const card = document.getElementById(`invite-${invId}`);
      if (card) {
        const actionsEl = card.querySelector(".invite-actions");
        if (actionsEl) {
          actionsEl.outerHTML = action === "accepted"
            ? `<span class="invite-responded accepted">✅ Accepted — Welcome to the club!</span>`
            : `<span class="invite-responded declined">✕ Declined</span>`;
        }
        card.style.opacity = ".75";
      }

      if (action === "accepted") {
        // Show success banner
        showBanner(`🎉 You've joined "${data.club_name}"! Visit the Club Portal to see your membership.`, "green");
      }

      // Refresh badge & notifications
      loadInvitations();
      Notifications.loadUnreadCount("notifBadge");
    } else {
      alert(data.message || "Something went wrong. Please try again.");
      if (btnEl) btnEl.disabled = false;
    }
  } catch (e) {
    alert("Network error. Please try again.");
    if (btnEl) btnEl.disabled = false;
  }
}

function markAllRead() {
  Notifications.markAllRead();
}

function showBanner(msg, color) {
  const div = document.createElement("div");
  div.style.cssText = `position:fixed;top:20px;right:20px;z-index:9999;padding:14px 20px;
    background:${color === "green" ? "#d1fae5" : "#fee2e2"};
    color:${color === "green" ? "#065f46" : "#991b1b"};
    border:1.5px solid ${color === "green" ? "#34d399" : "#f87171"};
    border-radius:12px;font-weight:600;font-size:14px;
    box-shadow:0 8px 24px rgba(0,0,0,.12);max-width:380px;`;
  div.innerText = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

function escH(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}