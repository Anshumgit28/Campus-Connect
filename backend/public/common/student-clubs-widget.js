/* ============================================================
   student-clubs-widget.js
   
   DROP-IN PATCH for the student dashboard.
   
   HOW TO USE:
   Add this ONE line to the bottom of dashboard.html (before </body>):
   <script src="/common/student-clubs-widget.js"></script>
   
   What it does:
   - Fetches /club/student-clubs  →  student's memberships + pending invites
   - Injects a "My Clubs" card into the student dashboard
   - Shows each club the student belongs to with their position badge
   - Shows a banner if there are pending invitations to accept
   - Clicking "View Invitations" navigates to /club/ where they can respond
   
   The widget adds itself after #dashboardGrid or #statsGrid or after
   the last .card on the page — it finds the best anchor automatically.
============================================================ */

(async function initClubWidget() {
  try {
    const res = await fetch("/club/student-clubs");
    if (!res.ok) return; // not a club member yet, widget stays hidden

    const data = await res.json();
    const { memberships = [], pendingInvites = 0 } = data;

    // Nothing to show and no pending invites — skip
    if (!memberships.length && !pendingInvites) return;

    // Build HTML
    const positionBadge = pos => {
      const p = (pos || "Member").toLowerCase();
      let cls = "club-badge-member";
      if (p === "president")                            cls = "club-badge-president";
      else if (p === "vice president" || p === "vice_president") cls = "club-badge-vp";
      else if (p === "secretary")                       cls = "club-badge-secretary";
      else if (p === "treasurer")                       cls = "club-badge-treasurer";
      return `<span class="club-position-badge ${cls}">${pos || "Member"}</span>`;
    };

    const membershipRows = memberships.map(m => `
      <div class="club-widget-row">
        <div class="club-widget-icon">🏛️</div>
        <div class="club-widget-info">
          <span class="club-widget-name">${escH(m.club_name)}</span>
          ${positionBadge(m.position)}
        </div>
        <a href="/club/" class="club-widget-link">View →</a>
      </div>
    `).join("");

    const inviteBanner = pendingInvites > 0 ? `
      <div class="club-invite-banner">
        <span>📨 You have <strong>${pendingInvites}</strong> pending club invitation${pendingInvites > 1 ? "s" : ""}</span>
        <a href="/club/" class="club-invite-btn">Review Invitations →</a>
      </div>
    ` : "";

    const widgetHtml = `
    <div class="card club-widget-card" id="studentClubWidget">
      <div class="card-header" style="margin-bottom:14px;">
        <div class="card-title">🏛️ My Clubs</div>
        ${memberships.length ? `<a href="/club/" class="btn btn-outline btn-sm">Club Portal →</a>` : ""}
      </div>
      ${inviteBanner}
      ${memberships.length ? membershipRows : `
        <p style="color:var(--muted);font-size:13px;padding:8px 0;">
          You are not yet a member of any club.
        </p>`}
    </div>`;

    // Inject styles
    injectStyles();

    // Find best anchor to insert after
    const anchor =
      document.getElementById("dashboardGrid") ||
      document.getElementById("statsGrid") ||
      document.querySelector(".grid-4") ||
      (() => { const cards = document.querySelectorAll(".card"); return cards[cards.length - 1]; })();

    if (anchor) {
      anchor.insertAdjacentHTML("afterend", widgetHtml);
    } else {
      // Fallback: append to main content area
      const main = document.querySelector(".content") || document.querySelector("main") || document.body;
      main.insertAdjacentHTML("beforeend", widgetHtml);
    }

  } catch (e) {
    // Silently fail — widget is non-critical
    console.warn("[ClubWidget] Failed to load:", e.message);
  }
})();

function escH(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function injectStyles() {
  if (document.getElementById("clubWidgetStyles")) return;
  const style = document.createElement("style");
  style.id = "clubWidgetStyles";
  style.textContent = `
    .club-widget-card { margin-top: 20px; }

    .club-widget-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 10px;
      background: var(--surface, #f8fafc);
      border: 1px solid var(--border, #e5e7eb);
      margin-bottom: 8px;
      transition: box-shadow .15s;
    }
    .club-widget-row:hover { box-shadow: 0 3px 10px rgba(0,0,0,.07); }
    .club-widget-row:last-child { margin-bottom: 0; }

    .club-widget-icon {
      font-size: 22px;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #e0e7ff;
      border-radius: 10px;
      flex-shrink: 0;
    }

    .club-widget-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .club-widget-name {
      font-weight: 700;
      font-size: 14px;
      color: var(--ink, #0f172a);
    }

    .club-widget-link {
      font-size: 12px;
      font-weight: 600;
      color: #6366f1;
      text-decoration: none;
      white-space: nowrap;
    }
    .club-widget-link:hover { text-decoration: underline; }

    /* Position badges */
    .club-position-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 9px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      width: fit-content;
    }
    .club-badge-president  { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .club-badge-vp         { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
    .club-badge-secretary  { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .club-badge-treasurer  { background: #ede9fe; color: #5b21b6; border: 1px solid #ddd6fe; }
    .club-badge-member     { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }

    /* Invite banner */
    .club-invite-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 12px 16px;
      border-radius: 10px;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      border: 1px solid #fcd34d;
      margin-bottom: 14px;
      font-size: 13px;
      color: #78350f;
    }

    .club-invite-btn {
      padding: 6px 14px;
      border-radius: 20px;
      background: #f59e0b;
      color: white;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
      transition: background .15s;
    }
    .club-invite-btn:hover { background: #d97706; }
  `;
  document.head.appendChild(style);
}