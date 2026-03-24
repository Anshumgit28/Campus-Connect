/* ============================================================
   ai-dashboard-widget.js
   
   DROP-IN for student dashboard.html
   Add this ONE line before </body>:
   <script src="/common/ai-dashboard-widget.js"></script>
   
   What it does:
   - Fetches /ai/recommend → top 3 AI recommendations
   - Injects a compact "AI Study Advisor" widget into the dashboard
   - Shows top 3 critical/important subjects with tier badges
   - Has a "View Full AI Advisor" button
============================================================ */

(async function initAIWidget() {
  try {
    const res = await fetch("/ai/recommend", { credentials: "include" });
    if (!res.ok) return; // Silently fail

    const data = await res.json();
    if (!data.success || !data.recommendations?.length) return;

    const recs = data.recommendations.slice(0, 3);
    const dept = data.department || "";
    const sem  = data.student_semester || "";

    // Build tier badge helper
    const tierBadge = (tier) => {
      const cfg = {
        1: { bg: "#fee2e2", color: "#991b1b", label: "🔴 Critical" },
        2: { bg: "#fef3c7", color: "#92400e", label: "🟡 Important" },
        3: { bg: "#d1fae5", color: "#065f46", label: "🟢 Standard" }
      };
      const c = cfg[tier] || cfg[3];
      return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${c.bg};color:${c.color};">${c.label}</span>`;
    };

    const recRows = recs.map(r => `
      <div style="padding:10px 12px;border-radius:10px;background:var(--light,#f1f0ec);
        border:1px solid var(--border,#e8e5df);margin-bottom:8px;
        border-left:3px solid ${r.importance_tier===1?"#dc2626":r.importance_tier===2?"#d97706":"#16a34a"};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:4px;">
          <span style="font-weight:700;font-size:13px;color:var(--text,#1a1a2e);flex:1;">${escH(r.name)}</span>
          ${tierBadge(r.importance_tier)}
        </div>
        <div style="font-size:11px;color:var(--muted,#6b7280);line-height:1.4;">${escH(r.focus_reason).slice(0,100)}...</div>
      </div>
    `).join("");

    const widgetHtml = `
    <div class="card" id="aiAdvisorWidget" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <div class="card-title" style="display:flex;align-items:center;gap:8px;">
            <span>🤖 AI Study Advisor</span>
            <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;">AI Powered</span>
          </div>
          <div style="font-size:11px;color:var(--muted,#6b7280);margin-top:2px;">
            Sem ${sem} · ${(dept || "").split(" ")[0]} · Content-Based AI
          </div>
        </div>
        <a href="/dashboards/student/ai-advisor.html"
          style="padding:7px 14px;border-radius:9px;border:1px solid var(--border,#e8e5df);
            background:white;font-size:12px;font-weight:700;text-decoration:none;
            color:#4f46e5;white-space:nowrap;">
          Full Advisor →
        </a>
      </div>

      ${data.ai_insight ? `
      <div style="padding:10px 12px;border-radius:9px;background:linear-gradient(135deg,#f5f3ff,#eef2ff);
        border:1px solid #c7d2fe;font-size:12px;color:#312e81;margin-bottom:12px;line-height:1.5;">
        🎯 ${escH((data.ai_insight || "").split("\n\n")[0]).slice(0, 160)}...
      </div>` : ""}

      <div style="font-size:11px;font-weight:700;color:var(--muted,#6b7280);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">
        Top Priority Subjects
      </div>

      ${recRows}

      <a href="/dashboards/student/ai-advisor.html"
        style="display:block;text-align:center;padding:10px;border-radius:10px;
          background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;
          font-size:13px;font-weight:700;text-decoration:none;margin-top:4px;">
        🚀 Ask AI Anything About Your Syllabus
      </a>
    </div>`;

    // Inject styles
    if (!document.getElementById("aiWidgetStyles")) {
      const style = document.createElement("style");
      style.id = "aiWidgetStyles";
      style.textContent = `
        #aiAdvisorWidget { animation: fadeIn .3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      `;
      document.head.appendChild(style);
    }

    // Find best injection anchor in the dashboard
    // Try to insert in the right column (col-right), after quick actions
    const colRight = document.querySelector(".col-right");
    if (colRight) {
      // Insert as first element in right column
      colRight.insertAdjacentHTML("afterbegin", widgetHtml);
      return;
    }

    // Fallback: insert after statsRow
    const statsRow = document.querySelector(".stats-row");
    if (statsRow) {
      statsRow.insertAdjacentHTML("afterend",
        `<div style="padding:0 36px;margin-top:16px;">${widgetHtml}</div>`);
      return;
    }

    // Final fallback: append to main
    const main = document.querySelector(".main") || document.body;
    main.insertAdjacentHTML("beforeend", `<div style="padding:24px 36px 0;">${widgetHtml}</div>`);

  } catch (e) {
    console.warn("[AI Widget] Failed to load:", e.message);
  }
})();

function escH(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}