"use strict";
/* ============================================================
   faculty-course.js — Individual course management page
============================================================ */

let courseId = null;
let courseData = null;
let allStudents = [];
let allAssignments = [];
let allBatches = [];

/* ── INIT ── */
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  courseId = params.get("id");

  if (!courseId) {
    document.getElementById("courseHeroCard").innerHTML =
      `<div class="course-hero-loading">❌ No course ID provided. <a href="/faculty/courses" style="color:var(--green2);">Go back</a></div>`;
    return;
  }

  loadAvatar();
  loadCourseDetails();
  loadBatches();
});

function loadAvatar() {
  fetch("/faculty/data", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById("avatarLetter");
      if (el) el.innerText = (d.name || "F")[0].toUpperCase();
    }).catch(() => {});
}

/* ── COURSE DETAILS ── */
function loadCourseDetails() {
  fetch(`/faculty/courses/detail/${courseId}`, { credentials: "include" })
    .then(r => r.json())
    .then(c => {
      courseData = c;
      document.getElementById("courseTitle").innerText = c.name || "Course";
      document.title = `${c.name} | Faculty`;
      renderHeroCard(c);
    })
    .catch(() => {
      document.getElementById("courseHeroCard").innerHTML =
        `<div class="course-hero-loading">❌ Failed to load course details.</div>`;
    });
}

function renderHeroCard(c) {
  document.getElementById("courseHeroCard").innerHTML = `
    <div class="course-hero-left">
      <div class="course-hero-code">${esc(c.code || 'COURSE')}</div>
      <div class="course-hero-name">${esc(c.name)}</div>
      <div class="course-hero-meta">
        ${c.semester ? 'Semester ' + c.semester + ' · ' : ''}
        ${c.description || 'No description'}
      </div>
      <div class="course-hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-num">${c.batch_count || 0}</div>
          <div class="hero-stat-label">Batches</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-num">${c.enrolled_count || 0}</div>
          <div class="hero-stat-label">Students</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-num">${c.assignment_count || 0}</div>
          <div class="hero-stat-label">Assignments</div>
        </div>
      </div>
    </div>
    ${c.enrollment_key ? `
    <div class="course-hero-key">
      <div class="hero-key-label">Enrollment Key</div>
      <span class="hero-key-value">${esc(c.enrollment_key)}</span>
      <button class="copy-key-btn" onclick="copyKey('${esc(c.enrollment_key)}')">📋 Copy Key</button>
    </div>` : ""}
  `;
}

function copyKey(key) {
  navigator.clipboard.writeText(key).then(() => {
    showToast(`Key "${key}" copied to clipboard!`);
  }).catch(() => { prompt("Copy enrollment key:", key); });
}

function showToast(msg) {
  const t = document.createElement("div");
  t.style.cssText = "position:fixed;bottom:24px;right:24px;background:#065f46;color:white;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.2);";
  t.innerText = "✅ " + msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

/* ── TABS ── */
function showTab(name, btn) {
  document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
  document.getElementById("tab-" + name).style.display = "block";
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  if (name === "batches")     loadBatches();
  if (name === "assignments") loadAssignments();
  if (name === "students")    loadStudents();
  if (name === "marks")       { loadAssignmentDropdowns(); loadStudentDropdown(); loadMarksOverview(); }
}

/* ── BATCHES ── */
function loadBatches() {
  if (!courseId) return;
  fetch(`/faculty/batches/${courseId}`, { credentials: "include" })
    .then(r => r.json())
    .then(batches => {
      allBatches = batches;
      renderBatchList(batches);

      // Populate batch filter for students tab
      const bFilter = document.getElementById("batchFilter");
      if (bFilter) {
        bFilter.innerHTML = '<option value="">All Batches</option>' +
          batches.map(b => `<option value="${b.id}">${esc(b.name)} (${b.type})</option>`).join("");
      }
    })
    .catch(() => {});
}

function renderBatchList(batches) {
  const el = document.getElementById("batchList");
  if (!el) return;

  if (!batches.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">🏫</span><p>No batches yet. Create one to get started.</p></div>`;
    return;
  }

  const typeClass = { Lecture: "pill-lecture", Lab: "pill-lab", Tutorial: "pill-tutorial" };

  el.innerHTML = batches.map(b => `
    <div class="batch-item">
      <div class="batch-item-left">
        <div>
          <span class="batch-type-pill ${typeClass[b.type] || 'pill-lecture'}">${b.type}</span>
          <div class="batch-item-name">${esc(b.name)}</div>
          ${b.division ? `<div class="batch-item-division">Division: ${esc(b.division)}</div>` : ""}
          <div class="batch-item-meta">👨‍🎓 ${b.student_count || 0} students enrolled</div>
        </div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="deleteBatch(${b.id}, '${esc(b.name)}')">🗑 Remove</button>
    </div>
  `).join("");
}

function createBatch() {
  const name     = (document.getElementById("bName")?.value || "").trim();
  const type     = document.getElementById("bType")?.value || "Lecture";
  const division = (document.getElementById("bDivision")?.value || "").trim();
  const msg      = document.getElementById("batchMsg");

  if (!name) { showMsg(msg, "error", "⚠️ Batch name is required"); return; }
  showMsg(msg, "success", "⏳ Creating...");

  fetch("/faculty/batches/create", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course_id: courseId, name, type, division })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Batch created!");
      document.getElementById("bName").value = "";
      document.getElementById("bDivision").value = "";
      loadBatches();
      loadCourseDetails();
      setTimeout(() => { msg.style.display = "none"; }, 3000);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

function deleteBatch(id, name) {
  if (!confirm(`Remove batch "${name}"? Students assigned to this batch will lose their batch assignment.`)) return;
  fetch("/faculty/batches/delete", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batch_id: id })
  })
  .then(r => r.json())
  .then(d => { if (d.success) { loadBatches(); loadCourseDetails(); } })
  .catch(() => {});
}

/* ── ASSIGNMENTS ── */
function loadAssignments() {
  if (!courseId) return;
  fetch(`/faculty/courses/${courseId}/assignments`, { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      allAssignments = rows;
      const badge = document.getElementById("assignCountBadge");
      if (badge) badge.innerText = rows.length;

      const el = document.getElementById("assignmentList");
      if (!el) return;

      if (!rows.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">📝</span><p>No assignments yet. Create one!</p></div>`;
        return;
      }

      el.innerHTML = rows.map(a => {
        const isOverdue = a.due_date && new Date(a.due_date) < new Date();
        return `
          <div class="assignment-item">
            <div class="assignment-item-header">
              <div>
                <div class="assignment-item-title">${esc(a.title)}</div>
                ${a.subject ? `<div class="assignment-item-meta">📘 ${esc(a.subject)}</div>` : ""}
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
                <span class="marks-badge">🎯 ${a.max_marks || 10} marks</span>
                <span class="due-date-badge" style="${isOverdue?'background:#fee2e2;color:#991b1b;border-color:#fecaca;':''}">
                  📅 ${a.due_date ? a.due_date.slice(0,10) : "—"}
                  ${isOverdue ? " (Overdue)" : ""}
                </span>
              </div>
            </div>
            ${a.description ? `<div style="font-size:12px;color:var(--muted);margin-top:6px;">${esc(a.description)}</div>` : ""}
            <div style="display:flex;gap:8px;margin-top:10px;align-items:center;">
              <span style="font-size:12px;color:var(--muted);">Type: ${a.submission_type || 'document'}</span>
              <span style="margin-left:auto;">
                <button class="btn btn-danger btn-sm" onclick="deleteAssignment(${a.id}, '${esc(a.title)}')">🗑 Delete</button>
              </span>
            </div>
          </div>`;
      }).join("");
    })
    .catch(() => {});
}

function createAssignment() {
  const title    = (document.getElementById("aTitle")?.value || "").trim();
  const subject  = (document.getElementById("aSubject")?.value || "").trim();
  const desc     = (document.getElementById("aDesc")?.value || "").trim();
  const dueDate  = document.getElementById("aDueDate")?.value || "";
  const maxMarks = parseInt(document.getElementById("aMaxMarks")?.value || "10");
  const subType  = document.getElementById("aSubmissionType")?.value || "document";
  const msg      = document.getElementById("assignMsg");

  if (!title)   { showMsg(msg, "error", "⚠️ Title is required"); return; }
  if (!dueDate) { showMsg(msg, "error", "⚠️ Due date is required"); return; }
  if (!maxMarks || maxMarks < 1) { showMsg(msg, "error", "⚠️ Max marks must be at least 1"); return; }

  showMsg(msg, "success", "⏳ Creating...");

  fetch(`/faculty/courses/${courseId}/assignments/add`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, subject, description: desc, due_date: dueDate, max_marks: maxMarks, submission_type: subType })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Assignment created!");
      ["aTitle","aSubject","aDesc","aDueDate"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "";
      });
      document.getElementById("aMaxMarks").value = "25";
      loadAssignments();
      loadCourseDetails();
      loadAssignmentDropdowns();
      setTimeout(() => { msg.style.display = "none"; }, 3000);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

function deleteAssignment(id, title) {
  if (!confirm(`Delete assignment "${title}"? All submissions and marks will be lost.`)) return;
  fetch(`/faculty/assignments/${id}/delete`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" }
  })
  .then(r => r.json())
  .then(d => { if (d.success) { loadAssignments(); loadCourseDetails(); } })
  .catch(() => {});
}

/* ── STUDENTS ── */
function loadStudents() {
  if (!courseId) return;
  fetch(`/faculty/courses/${courseId}/students`, { credentials: "include" })
    .then(r => r.json())
    .then(students => {
      allStudents = students;
      setText("studentCountLabel", `${students.length} enrolled student${students.length !== 1 ? "s" : ""}`);
      renderStudentTable(students);
    })
    .catch(() => {});
}

function renderStudentTable(students) {
  const tbody = document.getElementById("studentTableBody");
  if (!tbody) return;
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No students enrolled yet. Share the enrollment key!</td></tr>`;
    return;
  }
  tbody.innerHTML = students.map((s, i) => {
    const lecPct = s.lec_pct !== null ? s.lec_pct : null;
    const labPct = s.lab_pct !== null ? s.lab_pct : null;
    const lecBadge = attBadge(lecPct);
    const labBadge = attBadge(labPct);
    return `
      <tr>
        <td style="color:var(--muted);font-size:12px;">${i+1}</td>
        <td>
          <div style="font-weight:600;">${esc(s.username)}</div>
          <div style="font-size:12px;color:var(--muted);">${esc(s.email)}</div>
        </td>
        <td><span class="badge badge-blue">${esc(s.prn || "—")}</span></td>
        <td>
          ${s.batch_name
            ? `<span class="badge" style="background:#ede9fe;color:#5b21b6;">${esc(s.batch_name)}</span>`
            : `<span style="font-size:12px;color:var(--muted);">No batch</span>`}
        </td>
        <td>${lecPct !== null ? `<span class="badge ${lecBadge}">${lecPct}%</span>` : '<span style="color:var(--muted);font-size:12px;">N/A</span>'}</td>
        <td>${labPct !== null ? `<span class="badge ${labBadge}">${labPct}%</span>` : '<span style="color:var(--muted);font-size:12px;">N/A</span>'}</td>
      </tr>`;
  }).join("");
}

function attBadge(pct) {
  if (pct === null) return "badge-blue";
  if (pct >= 75) return "badge-green";
  if (pct >= 60) return "badge-amber";
  return "badge-red";
}

function filterStudents() {
  const q     = (document.getElementById("searchStudent")?.value || "").toLowerCase();
  const batch = document.getElementById("batchFilter")?.value || "";

  const filtered = allStudents.filter(s =>
    (!q || (s.username||"").toLowerCase().includes(q) || (s.prn||"").toLowerCase().includes(q)) &&
    (!batch || String(s.batch_id) === batch)
  );

  renderStudentTable(filtered);
  setText("studentCountLabel", `${filtered.length} of ${allStudents.length} students`);
}

/* ── MARKS ── */
function loadAssignmentDropdowns() {
  if (!courseId) return;
  fetch(`/faculty/courses/${courseId}/assignments`, { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      allAssignments = rows;
      const opts = rows.map(a =>
        `<option value="${a.id}" data-max="${a.max_marks || 10}">${esc(a.title)} (/${a.max_marks || 10})</option>`
      ).join("");

      const selMain = document.getElementById("marksAssignment");
      if (selMain) selMain.innerHTML = '<option value="">Select Assignment</option>' + opts;

      const selView = document.getElementById("marksViewAssignment");
      if (selView) selView.innerHTML = '<option value="">All Assignments</option>' + opts;
    })
    .catch(() => {});
}

function loadStudentDropdown() {
  if (!courseId) return;
  fetch(`/faculty/courses/${courseId}/students`, { credentials: "include" })
    .then(r => r.json())
    .then(students => {
      const sel = document.getElementById("marksStudent");
      if (!sel) return;
      sel.innerHTML = '<option value="">Select Student</option>' +
        students.map(s =>
          `<option value="${s.id}">${esc(s.username)}${s.prn ? ` (${s.prn})` : ""}</option>`
        ).join("");
    })
    .catch(() => {});
}

function onAssignmentSelect() {
  const sel = document.getElementById("marksAssignment");
  const infoBar = document.getElementById("maxMarksDisplay");
  const maxVal = document.getElementById("maxMarksValue");
  const outOf  = document.getElementById("marksOutOf");
  const obtained = document.getElementById("marksObtained");

  if (!sel.value) {
    if (infoBar) infoBar.style.display = "none";
    if (outOf) outOf.value = "";
    return;
  }

  const selected = sel.options[sel.selectedIndex];
  const max = selected.dataset.max || "10";

  if (infoBar) infoBar.style.display = "flex";
  if (maxVal) maxVal.innerText = max;
  if (outOf) outOf.value = max;
  if (obtained) {
    obtained.max = max;
    obtained.placeholder = `0 – ${max}`;
  }
}

function awardMarks() {
  const assignId  = document.getElementById("marksAssignment")?.value;
  const studentId = document.getElementById("marksStudent")?.value;
  const obtained  = document.getElementById("marksObtained")?.value;
  const outOf     = document.getElementById("marksOutOf")?.value;
  const feedback  = (document.getElementById("marksFeedback")?.value || "").trim();
  const msg       = document.getElementById("marksMsg");

  if (!assignId)  { showMsg(msg, "error", "⚠️ Select an assignment"); return; }
  if (!studentId) { showMsg(msg, "error", "⚠️ Select a student"); return; }
  if (obtained === "" || obtained === null) { showMsg(msg, "error", "⚠️ Enter marks obtained"); return; }

  const marks   = parseFloat(obtained);
  const maxM    = parseFloat(outOf || "10");

  if (isNaN(marks) || marks < 0) { showMsg(msg, "error", "⚠️ Marks must be a positive number"); return; }
  if (marks > maxM) { showMsg(msg, "error", `⚠️ Marks cannot exceed max (${maxM})`); return; }

  showMsg(msg, "success", "⏳ Saving...");

  fetch("/faculty/marks/award", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assignment_id: assignId,
      student_id:   studentId,
      marks_obtained: marks,
      max_marks:    maxM,
      feedback
    })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", `✅ Marks saved! (${marks}/${maxM})`);
      document.getElementById("marksObtained").value = "";
      document.getElementById("marksFeedback").value = "";
      loadMarksOverview();
      setTimeout(() => { msg.style.display = "none"; }, 3000);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed to save marks"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

function loadMarksOverview() {
  const assignId = document.getElementById("marksViewAssignment")?.value || "";
  const el = document.getElementById("marksOverviewTable");
  if (!el || !courseId) return;

  el.innerHTML = `<div class="empty-state"><span class="empty-icon">⏳</span><p>Loading...</p></div>`;

  const url = assignId
    ? `/faculty/marks/overview/${courseId}?assignment_id=${assignId}`
    : `/faculty/marks/overview/${courseId}`;

  fetch(url, { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      if (!rows.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">📊</span><p>No marks recorded yet</p></div>`;
        return;
      }

      el.innerHTML = rows.map(r => {
        const pct = r.max_marks > 0 ? Math.round((r.marks_obtained / r.max_marks) * 100) : 0;
        const cls = pct >= 70 ? "high" : pct >= 40 ? "mid" : "low";
        return `
          <div class="marks-row">
            <div>
              <div style="font-weight:600;font-size:13px;">${esc(r.username || "—")}</div>
              <div style="font-size:12px;color:var(--muted);">
                ${esc(r.assignment_title || "—")}
                ${r.feedback ? `<br><em style="font-style:italic;">${esc(r.feedback)}</em>` : ""}
              </div>
            </div>
            <div style="text-align:right;">
              <div class="marks-score ${cls}">${r.marks_obtained}<span style="font-size:14px;font-weight:600;color:var(--muted);">/${r.max_marks}</span></div>
              <div style="font-size:11px;color:var(--muted);">${pct}%</div>
            </div>
          </div>`;
      }).join("");
    })
    .catch(() => {
      el.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><p>Failed to load</p></div>`;
    });
}

/* ── UTILITIES ── */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function showMsg(el, type, text) {
  if (!el) return;
  el.className = "msg " + type;
  el.innerText = text;
  if (type === "success") setTimeout(() => { if (el) el.style.display = "none"; }, 4000);
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}