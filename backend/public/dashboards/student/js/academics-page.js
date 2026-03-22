"use strict";
/* ============================================================
   academics-page.js
   Fixes:
   - Per-course attendance (subject-wise) with overall summary
   - Assignments: loads from enrolled courses, fallback to all
   - Exams: proper error handling
   - Grades: proper error handling
============================================================ */

/* ── TAB SWITCHER ── */
function showTab(name, btn) {
  document.querySelectorAll(".tab-panel").forEach(p => {
    p.style.display = "none";
    p.classList.remove("active");
  });
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));

  const panel = document.getElementById("tab-" + name);
  if (panel) {
    panel.style.display = "block";
    panel.classList.add("active");
  }
  if (btn) btn.classList.add("active");
}

/* ── INIT ── */
document.addEventListener("DOMContentLoaded", () => {
  loadOverallAttendance();
  loadCourseWiseAttendance();
  loadPerformance();
  loadAssignments();
  loadExams();
  loadGrades();
});

/* ── OVERALL ATTENDANCE ── */
function loadOverallAttendance() {
  fetch("/dashboard/academic/attendance", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      const pct = d.attendance || 0;
      const pctEl = document.getElementById("overallAttPct");
      const barEl = document.getElementById("overallAttBar");
      const noteEl = document.getElementById("overallAttNote");

      if (pctEl) pctEl.innerText = pct + "%";
      if (barEl) barEl.style.width = pct + "%";
      if (noteEl) {
        if (pct >= 75) {
          noteEl.innerText = "✅ Attendance is good — keep it up!";
          noteEl.style.color = "#22c55e";
        } else {
          noteEl.innerText = "⚠️ Below 75% — attendance needs improvement";
          noteEl.style.color = "#ef4444";
        }
      }
    })
    .catch(() => {
      const el = document.getElementById("overallAttPct");
      if (el) el.innerText = "N/A";
    });
}

/* ── COURSE-WISE ATTENDANCE ── */
function loadCourseWiseAttendance() {
  const container = document.getElementById("courseAttendanceList");
  if (!container) return;

  fetch("/courses/my", { credentials: "include" })
    .then(r => r.json())
    .then(courses => {
      if (!courses.length) {
        container.innerHTML = `
          <div class="no-courses-msg">
            <div class="icon">📚</div>
            <p>No courses enrolled yet.</p>
            <p style="font-size:13px;margin-top:6px;">Enroll in courses to see subject-wise attendance.</p>
          </div>`;
        return;
      }

      container.innerHTML = courses.map(c => {
        const lecPct = c.lec_pct;
        const labPct = c.lab_pct;

        // Determine dominant attendance for color
        const mainPct = lecPct !== null ? lecPct : (labPct !== null ? labPct : null);
        const pctClass = mainPct === null ? "" : mainPct >= 75 ? "att-pct-good" : mainPct >= 60 ? "att-pct-warn" : "att-pct-crit";
        const badgeClass = mainPct === null ? "" : mainPct >= 75 ? "att-badge-good" : mainPct >= 60 ? "att-badge-warn" : "att-badge-crit";
        const badgeText = mainPct === null ? "No data" : mainPct >= 75 ? "✅ Good" : mainPct >= 60 ? "⚠️ Warning" : "❌ Critical";

        return `
          <div class="course-att-card">
            <div class="course-att-header">
              <div>
                <div class="course-att-name">${esc(c.name)}</div>
                <div class="course-att-meta">
                  👨‍🏫 ${esc(c.faculty_name || "—")}
                  ${c.code ? ` · ${esc(c.code)}` : ""}
                  ${c.semester ? ` · Sem ${c.semester}` : ""}
                  ${c.batch_name ? ` · ${esc(c.batch_name)}` : ""}
                </div>
              </div>
              <div style="text-align:right;">
                ${mainPct !== null
                  ? `<span class="course-att-pct ${pctClass}">${mainPct}%</span>
                     <span class="att-status-badge ${badgeClass}">${badgeText}</span>`
                  : `<span style="font-size:13px;color:var(--muted);">No sessions yet</span>`}
              </div>
            </div>

            <!-- Type breakdown -->
            <div class="att-type-row">
              ${lecPct !== null
                ? `<span class="att-type-chip att-chip-lec">
                     📖 Lecture: <strong>${lecPct}%</strong>
                     (${c.lec_attended}/${c.lec_total})
                   </span>`
                : `<span class="att-type-chip att-chip-lec" style="opacity:.5;">📖 No lecture data</span>`}
              ${labPct !== null
                ? `<span class="att-type-chip att-chip-lab">
                     🔬 Lab: <strong>${labPct}%</strong>
                     (${c.lab_attended}/${c.lab_total})
                   </span>`
                : ""}
            </div>

            <!-- Progress bar -->
            ${mainPct !== null ? `
              <div style="margin-top:12px;">
                <div style="height:6px;background:var(--light);border-radius:6px;overflow:hidden;">
                  <div style="height:100%;width:${mainPct}%;
                    background:${mainPct>=75?"linear-gradient(90deg,#16a34a,#22c55e)":mainPct>=60?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#dc2626,#ef4444)"};
                    border-radius:6px;transition:width .5s ease;"></div>
                </div>
              </div>` : ""}

            ${c.pending_assignments > 0
              ? `<div style="margin-top:10px;">
                   <span style="background:#fef3c7;color:#92400e;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;">
                     📝 ${c.pending_assignments} pending assignment${c.pending_assignments!==1?"s":""}
                   </span>
                 </div>`
              : ""}
          </div>`;
      }).join("");
    })
    .catch(() => {
      container.innerHTML = `<p style="color:var(--muted);">Unable to load course attendance. Make sure you are enrolled in courses.</p>`;
    });
}

/* ── PERFORMANCE ── */
function loadPerformance() {
  const el = document.getElementById("performanceLabel");
  if (!el) return;
  el.innerText = "Loading...";

  fetch("/dashboard/academic/performance", { credentials: "include" })
    .then(r => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(d => {
      const perfColors = {
        "Excellent":         "#22c55e",
        "Good":              "#6366f1",
        "Average":           "#f59e0b",
        "Needs Improvement": "#ef4444",
        "N/A":               "#6b7280"
      };
      const color = perfColors[d.performance] || "#6b7280";
      el.innerHTML =
        `<span style="font-size:22px;font-weight:800;color:${color};">${d.performance}</span>` +
        `<span style="color:var(--muted);font-size:15px;margin-left:10px;">GPA: ${d.gpa}</span>`;
    })
    .catch(() => {
      el.innerText = "No grade data yet";
      el.style.color = "var(--muted)";
    });
}

/* ── ASSIGNMENTS ── */
function loadAssignments() {
  const el = document.getElementById("assignmentList");
  if (!el) return;
  el.innerHTML = `<li style="color:var(--muted);">Loading...</li>`;

  fetch("/dashboard/academic/assignments", { credentials: "include" })
    .then(r => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(rows => {
      if (!Array.isArray(rows) || !rows.length) {
        el.innerHTML = `<li style="color:var(--muted);font-style:italic;">No upcoming assignments</li>`;
        return;
      }
      el.innerHTML = rows.map(a =>
        `<li style="padding:10px 0;border-bottom:1px solid var(--border);font-size:14px;">
           📝 <strong>${esc(a.title)}</strong>
           ${a.subject ? `<span style="color:var(--muted);font-size:13px;"> · ${esc(a.subject)}</span>` : ""}
           <span style="float:right;font-size:12px;color:var(--muted);">
             Due: ${a.due_date ? String(a.due_date).slice(0,10) : "—"}
           </span>
         </li>`
      ).join("");
    })
    .catch(() => {
      el.innerHTML = `<li style="color:var(--muted);font-style:italic;">No assignments available</li>`;
    });
}

/* ── EXAMS ── */
function loadExams() {
  const el = document.getElementById("examList");
  if (!el) return;
  el.innerHTML = `<li style="color:var(--muted);">Loading...</li>`;

  fetch("/dashboard/academic/exams", { credentials: "include" })
    .then(r => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(rows => {
      if (!Array.isArray(rows) || !rows.length) {
        el.innerHTML = `<li style="color:var(--muted);font-style:italic;">No upcoming exams</li>`;
        return;
      }
      el.innerHTML = rows.map(e =>
        `<li style="padding:10px 0;border-bottom:1px solid var(--border);font-size:14px;">
           🧪 <strong>${esc(e.subject)}</strong>
           ${e.exam_type ? `<span style="color:var(--muted);font-size:12px;"> · ${esc(e.exam_type)}</span>` : ""}
           <span style="float:right;font-size:12px;color:var(--muted);">
             ${e.exam_date ? String(e.exam_date).slice(0,10) : "—"}
           </span>
         </li>`
      ).join("");
    })
    .catch(() => {
      el.innerHTML = `<li style="color:var(--muted);font-style:italic;">No exam data available</li>`;
    });
}

/* ── GRADES ── */
function loadGrades() {
  const el = document.getElementById("gradesList");
  if (!el) return;
  el.innerHTML = `<p style="color:var(--muted);">Loading...</p>`;

  fetch("/dashboard/academic/grades", { credentials: "include" })
    .then(r => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(rows => {
      if (!Array.isArray(rows) || !rows.length) {
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
            <div class="grade-chip" style="background:${c.bg};border:2px solid ${c.border};color:${c.text};">
              <span class="grade-letter">${esc(g.grade)}</span>
              <span class="grade-subject">${esc(g.subject || "—")}</span>
            </div>`;
        }).join("") + `</div>`;
    })
    .catch(() => {
      el.innerHTML = `<p style="color:var(--muted);font-style:italic;">No grade data available yet</p>`;
    });
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}