"use strict";

/* ── TAB SWITCHER ── */
function showTab(name, btn) {
  /* Hide all panels */
  document.querySelectorAll(".tab-panel").forEach(p => {
    p.style.display = "none";
    p.classList.remove("active");
  });

  /* Deactivate all tabs */
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));

  /* Show selected panel */
  const panel = document.getElementById("tab-" + name);
  if (panel) {
    panel.style.display = "block";
    panel.classList.add("active");
  }

  /* Activate clicked tab */
  if (btn) btn.classList.add("active");
}

/* ── LOAD ON PAGE READY ── */
document.addEventListener("DOMContentLoaded", () => {
  Academics.loadAttendance("attendanceBar", "attendanceValue", "attendanceNote");
  Academics.loadPerformance("performanceLabel");
  Academics.loadAssignments("assignmentList");
  Academics.loadExams("examList");
  loadGradesCustom();   /* custom renderer with grade chips */
});

/* ── GRADES — custom chip renderer ── */
function loadGradesCustom() {
  const el = document.getElementById("gradesList");
  if (!el) return;

  el.innerHTML = `<p style="color:var(--muted);">Loading...</p>`;

  fetch("/dashboard/academic/grades", { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      if (!rows.length) {
        el.innerHTML = `<p style="color:var(--muted);font-style:italic;">No grades recorded yet</p>`;
        return;
      }

      const colors = {
        A: { bg: "#dcfce7", border: "#16a34a", text: "#14532d" },
        B: { bg: "#eef2ff", border: "#6366f1", text: "#312e81" },
        C: { bg: "#fef3c7", border: "#d97706", text: "#78350f" },
        D: { bg: "#fff7ed", border: "#ea580c", text: "#7c2d12" },
        F: { bg: "#fee2e2", border: "#dc2626", text: "#7f1d1d" }
      };

      el.innerHTML = `<div class="grades-grid">` +
        rows.map(g => {
          const c = colors[g.grade] || { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" };
          return `
            <div class="grade-chip"
              style="background:${c.bg}; border:2px solid ${c.border}; color:${c.text};">
              <span class="grade-letter">${esc(g.grade)}</span>
              <span class="grade-subject">${esc(g.subject || "—")}</span>
            </div>`;
        }).join("") + `</div>`;
    })
    .catch(() => {
      el.innerHTML = `<p style="color:#dc2626;">Failed to load grades</p>`;
    });
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}