"use strict";
/* ============================================================
   student-course-detail.js — Student view of a single course
============================================================ */

let courseId = null;

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  courseId = params.get("id");

  if (!courseId) {
    document.getElementById("courseHero").innerHTML =
      `<div>❌ No course ID. <a href="/dashboards/student/student-courses.html" style="color:rgba(255,255,255,.8);">Go back</a></div>`;
    return;
  }

  loadAvatar();
  loadCourseHero();
  loadAssignments();
});

function loadAvatar() {
  fetch("/dashboard/data", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById("avatarLetter");
      if (el) el.innerText = (d.user || "S")[0].toUpperCase();
    }).catch(() => {});
}

/* ── COURSE HERO ── */
function loadCourseHero() {
  fetch(`/courses/detail/${courseId}`, { credentials: "include" })
    .then(r => r.json())
    .then(c => {
      document.getElementById("courseTitle").innerText = c.name || "Course";
      document.title = `${c.name} | Student`;
      document.getElementById("courseHero").innerHTML = `
        <div class="ch-code">${esc(c.code || "COURSE")}</div>
        <div class="ch-name">${esc(c.name)}</div>
        <div class="ch-meta">
          👨‍🏫 Prof. ${esc(c.faculty_name || "—")}
          ${c.semester ? " · Semester " + c.semester : ""}
          ${c.batch_name ? " · Batch: " + esc(c.batch_name) : ""}
        </div>
        <div class="ch-stats">
          <div class="ch-stat">
            <div class="ch-stat-num">${c.lec_pct !== null ? c.lec_pct + "%" : "—"}</div>
            <div class="ch-stat-label">Lecture Att.</div>
          </div>
          <div class="ch-stat">
            <div class="ch-stat-num">${c.lab_pct !== null ? c.lab_pct + "%" : "—"}</div>
            <div class="ch-stat-label">Lab Att.</div>
          </div>
          <div class="ch-stat">
            <div class="ch-stat-num">${c.pending_assignments || 0}</div>
            <div class="ch-stat-label">Pending</div>
          </div>
        </div>
      `;
    })
    .catch(() => {
      document.getElementById("courseHero").innerHTML =
        `<div>Unable to load course details.</div>`;
    });
}

/* ── TABS ── */
function showTab(name, btn) {
  document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
  document.getElementById("tab-" + name).style.display = "block";
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  if (name === "assignments") loadAssignments();
  if (name === "attendance")  loadAttendance();
  if (name === "marks")       loadMarks();
}

/* ── ASSIGNMENTS ── */
function loadAssignments() {
  if (!courseId) return;
  fetch(`/courses/${courseId}/assignments`, { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      const el = document.getElementById("assignmentCards");
      if (!rows.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">📝</span><p>No assignments posted yet</p></div>`;
        return;
      }
      el.innerHTML = rows.map(a => renderAssignmentCard(a)).join("");
    })
    .catch(() => {
      document.getElementById("assignmentCards").innerHTML =
        `<div class="empty-state"><span class="empty-icon">❌</span><p>Failed to load assignments</p></div>`;
    });
}

function renderAssignmentCard(a) {
  const now       = new Date();
  const due       = a.due_date ? new Date(a.due_date) : null;
  const isOverdue = due && due < now;
  const isGraded  = a.marks !== null && a.marks !== undefined;
  const isSubmitted = !!a.submission_id;

  let statusClass = "pending";
  let statusChip  = `<span class="status-chip chip-pending">⏳ Pending</span>`;

  if (isGraded) {
    statusClass = "graded";
    statusChip  = `<span class="status-chip chip-graded">🎯 Graded: ${a.marks}/${a.max_marks || 10}</span>`;
  } else if (isSubmitted) {
    statusClass = "submitted";
    statusChip  = `<span class="status-chip chip-submitted">✅ Submitted</span>`;
  } else if (isOverdue) {
    statusClass = "overdue";
    statusChip  = `<span class="status-chip chip-overdue">⚠️ Overdue</span>`;
  }

  return `
    <div class="assignment-card status-${statusClass}">
      <div class="ac-header">
        <div class="ac-title">${esc(a.title)}</div>
        <span class="ac-marks-badge">🎯 ${a.max_marks || 10} marks</span>
      </div>
      <div class="ac-meta">
        ${a.subject ? `<span>📘 ${esc(a.subject)}</span>` : ""}
        <span>📅 Due: ${due ? due.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—"}</span>
        ${statusChip}
      </div>
      ${a.description ? `<div style="font-size:13px;color:var(--muted);margin-bottom:12px;">${esc(a.description)}</div>` : ""}

      ${isGraded ? `
        <div style="padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:13px;">
          <strong>Your score:</strong> ${a.marks}/${a.max_marks || 10}
          (${Math.round((a.marks / (a.max_marks || 10)) * 100)}%)
          ${a.feedback ? `<br><em style="color:var(--muted);">📬 Feedback: ${esc(a.feedback)}</em>` : ""}
        </div>
      ` : isSubmitted ? `
        <div style="padding:12px 14px;background:#dcfce7;border:1px solid #86efac;border-radius:10px;font-size:13px;color:#14532d;">
          ✅ Submitted — waiting to be graded
        </div>
      ` : `
        <div style="display:flex;gap:10px;margin-top:4px;">
          <button class="btn btn-primary btn-sm" onclick="openSubmitModal(${a.id}, '${esc(a.title)}')">
            📤 Submit Assignment
          </button>
        </div>
      `}
    </div>`;
}

/* ── ATTENDANCE ── */
function loadAttendance() {
  if (!courseId) return;
  fetch(`/courses/${courseId}/my-attendance`, { credentials: "include" })
    .then(r => r.json())
    .then(sessions => {
      const tbody = document.getElementById("attendanceTableBody");

      // Summary chips
      const present = sessions.filter(s => s.status === "present").length;
      const late    = sessions.filter(s => s.status === "late").length;
      const absent  = sessions.filter(s => s.status === "absent").length;
      const total   = sessions.length;
      const pct     = total ? Math.round(((present + late) / total) * 100) : 0;

      const chips = document.getElementById("attSummaryChips");
      if (chips) {
        chips.innerHTML = `
          <span style="background:#d1fae5;color:#065f46;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">${present} Present</span>
          <span style="background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">${late} Late</span>
          <span style="background:#fee2e2;color:#991b1b;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">${absent} Absent</span>
          <span style="background:#eef2ff;color:#3730a3;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">${pct}% Overall</span>
        `;
      }

      if (!sessions.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="table-empty">No attendance records yet</td></tr>`;
        return;
      }

      tbody.innerHTML = sessions.map(s => {
        const cls = s.status === "present" ? "status-present" : s.status === "late" ? "status-late" : "status-absent";
        return `
          <tr>
            <td>${s.session_date ? s.session_date.slice(0, 10) : "—"}</td>
            <td><span style="font-size:12px;font-weight:600;">${esc(s.session_type || "—")}</span></td>
            <td style="font-size:13px;color:var(--muted);">${esc(s.topic || "—")}</td>
            <td><span class="${cls}">${s.status.charAt(0).toUpperCase() + s.status.slice(1)}</span></td>
          </tr>`;
      }).join("");
    })
    .catch(() => {
      document.getElementById("attendanceTableBody").innerHTML =
        `<tr><td colspan="4" class="table-empty">Failed to load attendance</td></tr>`;
    });
}

/* ── MARKS ── */
function loadMarks() {
  if (!courseId) return;
  fetch(`/courses/${courseId}/my-marks`, { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      const el = document.getElementById("marksCards");
      if (!rows.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">🎯</span><p>No marks recorded yet</p></div>`;
        return;
      }
      el.innerHTML = rows.map(m => {
        const max = m.max_marks || 10;
        const pct = Math.round((m.marks / max) * 100);
        const cls = pct >= 70 ? "high" : pct >= 40 ? "mid" : "low";
        return `
          <div class="marks-card">
            <div class="marks-card-header">
              <div class="marks-card-title">${esc(m.assignment_title || "—")}</div>
              <span style="font-size:12px;color:var(--muted);">
                ${m.graded_at ? new Date(m.graded_at).toLocaleDateString("en-IN") : ""}
              </span>
            </div>
            <div class="marks-card-body">
              <div class="marks-display">
                <span class="marks-obtained ${cls}">${m.marks}</span>
                <span class="marks-max">/ ${max}</span>
                <span style="font-size:14px;color:var(--muted);margin-left:8px;">(${pct}%)</span>
              </div>
              <div class="marks-pct-bar">
                <div class="marks-pct-fill fill-${cls}" style="width:${pct}%"></div>
              </div>
              ${m.feedback ? `<div class="marks-feedback">💬 ${esc(m.feedback)}</div>` : ""}
            </div>
          </div>`;
      }).join("");
    })
    .catch(() => {
      document.getElementById("marksCards").innerHTML =
        `<div class="empty-state"><span class="empty-icon">❌</span><p>Failed to load marks</p></div>`;
    });
}

/* ── SUBMIT ASSIGNMENT ── */
function openSubmitModal(assignId, title) {
  document.getElementById("submitAssignId").value = assignId;
  document.getElementById("submitModalAssignName").innerText = `📝 Assignment: ${title}`;
  document.getElementById("submitText").value = "";
  document.getElementById("submitFile").value = "";
  const msg = document.getElementById("submitMsg");
  if (msg) msg.style.display = "none";
  document.getElementById("submitModal").classList.add("open");
}

function closeSubmitModal() {
  document.getElementById("submitModal").classList.remove("open");
}

function submitAssignment() {
  const assignId = document.getElementById("submitAssignId").value;
  const text     = (document.getElementById("submitText").value || "").trim();
  const fileEl   = document.getElementById("submitFile");
  const msg      = document.getElementById("submitMsg");

  if (!text && (!fileEl.files || !fileEl.files.length)) {
    showMsg(msg, "error", "⚠️ Please provide a text response or upload a file");
    return;
  }

  showMsg(msg, "success", "⏳ Submitting...");

  const formData = new FormData();
  formData.append("assignment_id", assignId);
  formData.append("text_content", text);
  if (fileEl.files && fileEl.files.length) {
    formData.append("file", fileEl.files[0]);
  }

  fetch("/courses/submit-assignment", {
    method: "POST", credentials: "include",
    body: formData
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Assignment submitted successfully!");
      setTimeout(() => {
        closeSubmitModal();
        loadAssignments();
      }, 1200);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Submission failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

/* ── UTILITIES ── */
function showMsg(el, type, text) {
  if (!el) return;
  el.className = "msg " + type;
  el.innerText = text;
  if (type === "success") setTimeout(() => { if (el) el.style.display = "none"; }, 5000);
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}