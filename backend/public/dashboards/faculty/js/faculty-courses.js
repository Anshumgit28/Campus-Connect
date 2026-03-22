/* ============================================================
   faculty-courses.js
   Handles: course list, create course, course detail,
            add assignment (with file upload), view submissions,
            grade submissions
============================================================ */

let courses = [];           // all my courses
let currentCourse = null;   // course object in detail view
let currentAsgnId = null;   // assignment being graded
let enrolledStudents = [];  // for search filter
let allSubmitted = [];

/* ══════════════════════════════════════ INIT ══════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  // Avatar
  try {
    const r = await fetch("/faculty/data");
    const d = await r.json();
    const av = document.getElementById("avatarLetter");
    if (av) av.textContent = (d.name || "F")[0].toUpperCase();
  } catch (_) {}

  await loadCourses();
});

/* ══════════════════════════════════════ COURSE LIST ══════════════════════════════════════ */
async function loadCourses() {
  const grid = document.getElementById("courseGrid");
  grid.innerHTML = `<div class="loading-state">Loading your courses...</div>`;

  try {
    const res = await fetch("/faculty/courses/list");
    courses = await res.json();

    // Update stats
    const totalStudents = courses.reduce((s, c) => s + (c.student_count || 0), 0);
    const totalAsgns    = courses.reduce((s, c) => s + (c.assignment_count || 0), 0);
    document.getElementById("totalCourses").textContent          = courses.length;
    document.getElementById("totalStudentsEnrolled").textContent = totalStudents;
    document.getElementById("totalAssignments").textContent      = totalAsgns;
    document.getElementById("coursesStats").style.display        = courses.length ? "flex" : "none";

    if (!courses.length) {
      grid.innerHTML = `
        <div class="empty-card" style="grid-column:1/-1;">
          <div class="empty-icon">📚</div>
          <div class="empty-title">No Courses Yet</div>
          <p>Click <strong>+ Create Course</strong> to add your first course.</p>
        </div>`;
      return;
    }

    grid.innerHTML = courses.map(renderCourseCard).join("");
  } catch (e) {
    console.error("[COURSES] loadCourses:", e);
    grid.innerHTML = `<p style="color:#dc2626;padding:20px;">Failed to load courses. Please refresh.</p>`;
  }
}

function renderCourseCard(c) {
  const isActive = c.is_active == 1;
  const chips = [
    c.subject_code ? `🔖 ${escH(c.subject_code)}` : null,
    c.branch        ? `🏫 ${escH(c.branch)}`       : null,
    c.semester      ? `📅 ${escH(c.semester)}`      : null,
    c.academic_year ? `📆 ${escH(c.academic_year)}` : null,
  ].filter(Boolean);

  return `
  <div class="course-card ${!isActive ? "inactive" : ""}" onclick="openCourseDetail(${c.id})">
    <div class="course-card-header">
      ${c.subject_code ? `<div class="course-card-code">${escH(c.subject_code)}</div>` : ""}
      <div class="course-card-title">${escH(c.title)}</div>
      <span class="course-active-badge ${!isActive ? "inactive" : ""}">${isActive ? "● Active" : "○ Inactive"}</span>
    </div>
    <div class="course-card-body">
      ${chips.length ? `<div class="course-meta-row">${chips.map(ch => `<span class="course-meta-chip">${ch}</span>`).join("")}</div>` : ""}
      ${c.description ? `<p style="font-size:13px;color:var(--muted);line-height:1.5;">${escH(c.description.substring(0, 80))}${c.description.length > 80 ? "..." : ""}</p>` : ""}
    </div>
    <div class="course-card-footer">
      <span>👥 ${c.student_count || 0} students · 📝 ${c.assignment_count || 0} assignments</span>
      <span class="course-card-key">${escH(c.enrollment_key || "—")}</span>
    </div>
  </div>`;
}

/* ══════════════════════════════════════ COURSE DETAIL ══════════════════════════════════════ */
async function openCourseDetail(courseId) {
  document.getElementById("courseListView").style.display    = "none";
  document.getElementById("courseDetailView").style.display  = "block";
  document.getElementById("submissionsPanel").style.display  = "none";

  // Show loading state
  document.getElementById("detailCourseName").textContent = "Loading...";
  document.getElementById("detailCourseMeta").textContent  = "";
  document.getElementById("assignmentsList").innerHTML = `<div class="loading-state">Loading...</div>`;

  try {
    const res = await fetch(`/faculty/courses/${courseId}/detail`);
    const data = await res.json();
    const { course, students, assignments } = data;

    currentCourse = course;
    enrolledStudents = students;

    // Populate header
    document.getElementById("detailCourseName").textContent = course.title;
    const metas = [
      course.subject_code ? `Code: ${course.subject_code}` : null,
      course.branch        ? course.branch                  : null,
      course.semester      ? course.semester                : null,
      course.academic_year ? `AY ${course.academic_year}`  : null,
    ].filter(Boolean);
    document.getElementById("detailCourseMeta").textContent = metas.join(" · ") || "No additional info";

    // Enrollment key banner
    document.getElementById("enrollKeyDisplay").textContent = course.enrollment_key || "—";

    // Toggle button
    const toggleBtn = document.getElementById("toggleActiveBtn");
    if (course.is_active) {
      toggleBtn.textContent = "⏸ Deactivate";
      toggleBtn.style.color = "#dc2626";
    } else {
      toggleBtn.textContent = "▶ Activate";
      toggleBtn.style.color = "#16a34a";
    }

    // Render assignments
    renderAssignments(assignments);

    // Render students
    renderStudents(students);

  } catch (e) {
    console.error("[COURSES] openCourseDetail:", e);
    document.getElementById("assignmentsList").innerHTML =
      `<p style="color:#dc2626;padding:20px;">Failed to load course details.</p>`;
  }
}

function backToCourses() {
  document.getElementById("courseDetailView").style.display  = "none";
  document.getElementById("courseListView").style.display    = "block";
  document.getElementById("submissionsPanel").style.display  = "none";
  currentCourse = null;
  loadCourses();
}

/* ══════════════════════════════════════ TABS ══════════════════════════════════════ */
function switchTab(tab, btn) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("tab-assignments").style.display = tab === "assignments" ? "block" : "none";
  document.getElementById("tab-students").style.display    = tab === "students"    ? "block" : "none";
}

/* ══════════════════════════════════════ ASSIGNMENTS ══════════════════════════════════════ */
function renderAssignments(assignments) {
  const el = document.getElementById("assignmentsList");

  if (!assignments.length) {
    el.innerHTML = `
      <div class="empty-card">
        <div class="empty-icon">📝</div>
        <div class="empty-title">No Assignments Yet</div>
        <p>Click <strong>+ Add Assignment</strong> to upload the first one.</p>
      </div>`;
    return;
  }

  el.innerHTML = assignments.map(a => {
    const dueClass  = getDueClass(a.due_date);
    const dueText   = a.due_date ? formatDate(a.due_date) : "No due date";
    const total     = a.total_students || 0;
    const submitted = a.submission_count || 0;
    const graded    = a.graded_count || 0;
    const pct       = total ? Math.round(submitted / total * 100) : 0;

    return `
    <div class="assignment-card" id="asgn-${a.id}">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:14px;color:var(--ink);">${escH(a.title)}</div>
        ${a.description ? `<div style="font-size:12px;color:var(--muted);margin-top:3px;">${escH(a.description.substring(0, 80))}${a.description.length > 80 ? "..." : ""}</div>` : ""}
        <div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap;">
          <span class="asgn-due ${dueClass}">📅 ${dueText}</span>
          <span style="font-size:11px;color:var(--muted);">Max: ${a.max_marks} marks</span>
          ${a.file_path ? `<a href="/${a.file_path}" target="_blank" style="font-size:11px;color:var(--primary);font-weight:600;">📎 Attachment</a>` : ""}
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <div class="submission-progress">
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width:${pct}%"></div>
          </div>
          <span>${submitted}/${total} submitted · ${graded} graded</span>
        </div>

        <div style="display:flex;gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();viewSubmissions(${a.id},'${escAttr(a.title)}',${a.max_marks})">
            📋 Submissions
          </button>
          <button class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:1px solid #fecaca;"
            onclick="event.stopPropagation();deleteAssignment(${a.id})">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

/* ══════════════════════════════════════ STUDENTS ══════════════════════════════════════ */
function renderStudents(students) {
  const el = document.getElementById("studentsList");
  const countEl = document.getElementById("studentCountLabel");
  if (countEl) countEl.textContent = `${students.length} student${students.length !== 1 ? "s" : ""} enrolled`;

  if (!students.length) {
    el.innerHTML = `
      <div class="empty-card">
        <div class="empty-icon">👥</div>
        <div class="empty-title">No Students Yet</div>
        <p>Students enroll using the course enrollment key.</p>
      </div>`;
    return;
  }

  el.innerHTML = students.map(s => `
    <div class="student-row">
      <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#06b6d4);
                  color:white;font-weight:800;font-size:15px;display:flex;align-items:center;
                  justify-content:center;flex-shrink:0;">
        ${(s.username || "?")[0].toUpperCase()}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;">${escH(s.username)}</div>
        <div style="font-size:11px;color:var(--muted);">
          ${s.prn ? `PRN: ${escH(s.prn)}` : ""}
          ${s.class_name ? ` · ${escH(s.class_name)}` : ""}
          · Enrolled ${formatDate(s.enrolled_at)}
        </div>
      </div>
    </div>`).join("");
}

function filterStudents() {
  const q = document.getElementById("studentSearch").value.toLowerCase();
  if (!q) return renderStudents(enrolledStudents);
  renderStudents(enrolledStudents.filter(s =>
    s.username?.toLowerCase().includes(q) ||
    s.prn?.toLowerCase().includes(q) ||
    s.class_name?.toLowerCase().includes(q)
  ));
}

/* ══════════════════════════════════════ TOGGLE COURSE ══════════════════════════════════════ */
async function toggleCourse() {
  if (!currentCourse) return;
  try {
    const res = await fetch("/faculty/courses/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: currentCourse.id })
    });
    const data = await res.json();
    if (data.success) {
      currentCourse.is_active = data.is_active ? 1 : 0;
      const btn = document.getElementById("toggleActiveBtn");
      if (data.is_active) {
        btn.textContent = "⏸ Deactivate";
        btn.style.color = "#dc2626";
      } else {
        btn.textContent = "▶ Activate";
        btn.style.color = "#16a34a";
      }
    }
  } catch (e) {
    console.error("[COURSES] toggleCourse:", e);
  }
}

/* ══════════════════════════════════════ SUBMISSIONS VIEW ══════════════════════════════════════ */
async function viewSubmissions(asgnId, asgnTitle, maxMarks) {
  currentAsgnId = asgnId;
  document.getElementById("courseDetailView").style.display  = "none";
  document.getElementById("submissionsPanel").style.display  = "block";
  document.getElementById("subsPanelTitle").textContent      = asgnTitle;
  document.getElementById("subsPanelMeta").textContent       = `Max marks: ${maxMarks}`;
  document.getElementById("submittedList").innerHTML    = `<div class="loading-state">Loading...</div>`;
  document.getElementById("notSubmittedList").innerHTML = `<div class="loading-state">Loading...</div>`;

  try {
    const res = await fetch(`/faculty/courses/assignments/${asgnId}/submissions`);
    const data = await res.json();
    const { submitted = [], notSubmitted = [] } = data;
    allSubmitted = submitted;

    // Summary stats
    const graded   = submitted.filter(s => s.status === "graded").length;
    const avg      = submitted.filter(s => s.marks_obtained != null).length
      ? Math.round(submitted.filter(s => s.marks_obtained != null).reduce((a, s) => a + s.marks_obtained, 0) / submitted.filter(s => s.marks_obtained != null).length)
      : null;

    document.getElementById("subsSummary").innerHTML = `
      <div class="subs-stat"><div class="subs-stat-num">${submitted.length}</div><div class="subs-stat-label">Submitted</div></div>
      <div class="subs-stat"><div class="subs-stat-num">${notSubmitted.length}</div><div class="subs-stat-label">Pending</div></div>
      <div class="subs-stat"><div class="subs-stat-num">${graded}</div><div class="subs-stat-label">Graded</div></div>
      ${avg !== null ? `<div class="subs-stat"><div class="subs-stat-num">${avg}</div><div class="subs-stat-label">Avg Score</div></div>` : ""}`;

    // Badges
    document.getElementById("submittedBadge").textContent    = submitted.length;
    document.getElementById("notSubmittedBadge").textContent = notSubmitted.length;

    // Render submitted
    if (!submitted.length) {
      document.getElementById("submittedList").innerHTML =
        `<p style="color:var(--muted);font-size:13px;padding:8px 0;">No submissions yet.</p>`;
    } else {
      document.getElementById("submittedList").innerHTML = submitted.map(s => {
        const isGraded = s.status === "graded";
        return `
        <div class="submission-row">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#22c55e);
                      color:white;font-weight:800;font-size:14px;display:flex;align-items:center;
                      justify-content:center;flex-shrink:0;">
            ${(s.username || "?")[0].toUpperCase()}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:13px;">${escH(s.username)}</div>
            <div style="font-size:11px;color:var(--muted);">
              ${s.prn ? `PRN: ${escH(s.prn)} · ` : ""}
              Submitted: ${formatDateTime(s.submitted_at)}
            </div>
            ${isGraded && s.feedback ? `<div style="font-size:11px;color:#6b7280;margin-top:3px;font-style:italic;">Feedback: ${escH(s.feedback)}</div>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            ${s.file_path ? `<a href="/${s.file_path}" target="_blank" class="btn btn-outline btn-sm">📎 Download</a>` : ""}
            ${isGraded
              ? `<span class="grade-badge grade-graded">✅ ${s.marks_obtained}/${maxMarks}${s.grade ? ` · ${s.grade}` : ""}</span>
                 <button class="btn btn-outline btn-sm" onclick="openGradeModal(${s.sub_id},'${escAttr(s.username)}',${maxMarks},${s.marks_obtained||0},'${escAttr(s.grade||"")}','${escAttr(s.feedback||"")}')">
                   ✏️ Re-grade
                 </button>`
              : `<span class="grade-badge grade-pending">⏳ Not graded</span>
                 <button class="btn btn-primary btn-sm" onclick="openGradeModal(${s.sub_id},'${escAttr(s.username)}',${maxMarks},null,'','')">
                   📊 Grade
                 </button>`
            }
          </div>
        </div>`;
      }).join("");
    }

    // Render not submitted
    if (!notSubmitted.length) {
      document.getElementById("notSubmittedList").innerHTML =
        `<p style="color:var(--muted);font-size:13px;padding:8px 0;">All students have submitted! 🎉</p>`;
    } else {
      document.getElementById("notSubmittedList").innerHTML = notSubmitted.map(s => `
        <div class="submission-row" style="opacity:.7;">
          <div style="width:36px;height:36px;border-radius:50%;background:#e5e7eb;
                      color:#6b7280;font-weight:800;font-size:14px;display:flex;align-items:center;
                      justify-content:center;flex-shrink:0;">
            ${(s.username || "?")[0].toUpperCase()}
          </div>
          <div style="flex:1;">
            <div style="font-weight:700;font-size:13px;color:var(--ink);">${escH(s.username)}</div>
            <div style="font-size:11px;color:var(--muted);">${s.prn ? `PRN: ${escH(s.prn)} · ` : ""}${s.class_name || ""}</div>
          </div>
          <span style="font-size:12px;font-weight:600;color:#9ca3af;">Not submitted</span>
        </div>`).join("");
    }

  } catch (e) {
    console.error("[COURSES] viewSubmissions:", e);
    document.getElementById("submittedList").innerHTML =
      `<p style="color:#dc2626;">Failed to load submissions.</p>`;
  }
}

function backToDetail() {
  document.getElementById("submissionsPanel").style.display  = "none";
  document.getElementById("courseDetailView").style.display  = "block";
  if (currentCourse) openCourseDetail(currentCourse.id);
}

/* ══════════════════════════════════════ GRADE MODAL ══════════════════════════════════════ */
function openGradeModal(subId, studentName, maxMarks, currentMarks, currentGrade, currentFeedback) {
  document.getElementById("gradeSubId").value   = subId;
  document.getElementById("gradeMaxMarks").value = maxMarks;
  document.getElementById("gradeStudentName").textContent = studentName;
  document.getElementById("gradeSubInfo").textContent     = `Max marks: ${maxMarks}`;
  document.getElementById("gradeOutOf").textContent       = `(out of ${maxMarks})`;
  document.getElementById("gradeMarks").value    = currentMarks !== null ? currentMarks : "";
  document.getElementById("gradeMarks").max      = maxMarks;
  document.getElementById("gradeGrade").value    = currentGrade || "";
  document.getElementById("gradeFeedback").value = currentFeedback || "";
  document.getElementById("gradeMsg").textContent = "";
  document.getElementById("gradeModal").classList.add("open");
}

async function submitGrade() {
  const subId    = document.getElementById("gradeSubId").value;
  const maxMarks = parseInt(document.getElementById("gradeMaxMarks").value);
  const marks    = document.getElementById("gradeMarks").value;
  const grade    = document.getElementById("gradeGrade").value;
  const feedback = document.getElementById("gradeFeedback").value;
  const msgEl    = document.getElementById("gradeMsg");

  if (marks === "" || marks === null) {
    msgEl.textContent = "Please enter marks"; msgEl.style.color = "#dc2626"; return;
  }
  if (parseInt(marks) < 0 || parseInt(marks) > maxMarks) {
    msgEl.textContent = `Marks must be between 0 and ${maxMarks}`; msgEl.style.color = "#dc2626"; return;
  }

  try {
    const res = await fetch(`/faculty/courses/submissions/${subId}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marks_obtained: parseInt(marks), grade: grade || null, feedback: feedback || null })
    });
    const data = await res.json();
    if (data.success) {
      msgEl.textContent = "✅ Grade saved!"; msgEl.style.color = "#16a34a";
      setTimeout(() => {
        closeModal("gradeModal");
        // Refresh submissions view
        if (currentAsgnId) {
          viewSubmissions(currentAsgnId, document.getElementById("subsPanelTitle").textContent, maxMarks);
        }
      }, 900);
    } else {
      msgEl.textContent = data.message || "Failed to save grade"; msgEl.style.color = "#dc2626";
    }
  } catch (e) {
    msgEl.textContent = "Network error"; msgEl.style.color = "#dc2626";
  }
}

/* ══════════════════════════════════════ CREATE COURSE MODAL ══════════════════════════════════════ */
function openCreateCourse() {
  document.getElementById("createCourseMsg").textContent = "";
  document.getElementById("newKeyDisplay").style.display = "none";
  document.getElementById("courseTitle").value           = "";
  document.getElementById("courseSubjectCode").value     = "";
  document.getElementById("courseBranch").value          = "";
  document.getElementById("courseSemester").value        = "";
  document.getElementById("courseAcademicYear").value    = "";
  document.getElementById("courseMaxStudents").value     = "100";
  document.getElementById("courseDescription").value     = "";
  document.getElementById("createCourseModal").classList.add("open");
}

async function createCourse() {
  const title = document.getElementById("courseTitle").value.trim();
  const msgEl = document.getElementById("createCourseMsg");
  if (!title) { msgEl.textContent = "Course title is required"; msgEl.style.color = "#dc2626"; return; }

  try {
    const res = await fetch("/faculty/courses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        subject_code:  document.getElementById("courseSubjectCode").value.trim() || null,
        branch:        document.getElementById("courseBranch").value.trim()       || null,
        semester:      document.getElementById("courseSemester").value            || null,
        academic_year: document.getElementById("courseAcademicYear").value.trim() || null,
        max_students:  parseInt(document.getElementById("courseMaxStudents").value) || 100,
        description:   document.getElementById("courseDescription").value.trim()   || null,
      })
    });
    const data = await res.json();
    if (data.success) {
      msgEl.textContent = "✅ Course created!"; msgEl.style.color = "#16a34a";
      document.getElementById("newKeyValue").textContent    = data.enrollment_key;
      document.getElementById("newKeyDisplay").style.display = "block";
      setTimeout(() => { closeModal("createCourseModal"); loadCourses(); }, 2500);
    } else {
      msgEl.textContent = data.message || "Failed to create course"; msgEl.style.color = "#dc2626";
    }
  } catch (e) {
    msgEl.textContent = "Network error"; msgEl.style.color = "#dc2626";
  }
}

function copyNewKey() {
  const key = document.getElementById("newKeyValue").textContent;
  navigator.clipboard.writeText(key).then(() => {
    const btn = event.target;
    btn.textContent = "✅ Copied!";
    setTimeout(() => btn.textContent = "📋 Copy Key", 1500);
  }).catch(() => {});
}

function copyKey() {
  const key = document.getElementById("enrollKeyDisplay").textContent;
  navigator.clipboard.writeText(key).then(() => {
    const btn = event.target;
    btn.textContent = "✅ Copied!";
    setTimeout(() => btn.textContent = "📋 Copy Key", 1500);
  }).catch(() => {});
}

/* ══════════════════════════════════════ CREATE ASSIGNMENT MODAL ══════════════════════════════════════ */
function openCreateAssignment() {
  document.getElementById("asgnTitle").value       = "";
  document.getElementById("asgnDueDate").value     = "";
  document.getElementById("asgnMaxMarks").value    = "100";
  document.getElementById("asgnDescription").value = "";
  document.getElementById("asgnFile").value        = "";
  document.getElementById("createAsgnMsg").textContent = "";
  document.getElementById("createAssignmentModal").classList.add("open");
}

async function createAssignment() {
  const title = document.getElementById("asgnTitle").value.trim();
  const msgEl = document.getElementById("createAsgnMsg");
  const btn   = document.getElementById("createAsgnBtn");
  if (!title)            { msgEl.textContent = "Assignment title required"; msgEl.style.color = "#dc2626"; return; }
  if (!currentCourse)    { msgEl.textContent = "No course selected"; msgEl.style.color = "#dc2626"; return; }

  btn.disabled    = true;
  btn.textContent = "Uploading...";

  try {
    const formData = new FormData();
    formData.append("title",       title);
    formData.append("description", document.getElementById("asgnDescription").value.trim() || "");
    formData.append("due_date",    document.getElementById("asgnDueDate").value    || "");
    formData.append("max_marks",   document.getElementById("asgnMaxMarks").value   || "100");

    const fileInput = document.getElementById("asgnFile");
    if (fileInput.files[0]) formData.append("file", fileInput.files[0]);

    const res = await fetch(`/faculty/courses/${currentCourse.id}/assignments/create`, {
      method: "POST",
      body: formData
      // Note: DO NOT set Content-Type manually — browser sets it with boundary for FormData
    });
    const data = await res.json();
    if (data.success) {
      msgEl.textContent = "✅ Assignment uploaded! Students have been notified."; msgEl.style.color = "#16a34a";
      setTimeout(() => {
        closeModal("createAssignmentModal");
        openCourseDetail(currentCourse.id);
      }, 1200);
    } else {
      msgEl.textContent = data.message || "Failed to create assignment"; msgEl.style.color = "#dc2626";
    }
  } catch (e) {
    msgEl.textContent = "Network error"; msgEl.style.color = "#dc2626";
  } finally {
    btn.disabled    = false;
    btn.textContent = "📤 Upload Assignment";
  }
}

async function deleteAssignment(asgnId) {
  if (!confirm("Delete this assignment? All submissions will also be deleted.")) return;
  try {
    const res = await fetch(`/faculty/courses/assignments/${asgnId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      document.getElementById(`asgn-${asgnId}`)?.remove();
    } else {
      alert(data.message || "Failed to delete");
    }
  } catch (e) {
    console.error("[COURSES] deleteAssignment:", e);
  }
}

/* ══════════════════════════════════════ MODALS ══════════════════════════════════════ */
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

document.addEventListener("click", e => {
  if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open");
});

/* ══════════════════════════════════════ HELPERS ══════════════════════════════════════ */
function getDueClass(dueDate) {
  if (!dueDate) return "no-date";
  const due  = new Date(dueDate);
  const now  = new Date();
  const diff = (due - now) / 86400000;
  if (diff < 0)  return "overdue";
  if (diff < 3)  return "upcoming";
  return "future";
}

function formatDate(str) {
  if (!str) return "—";
  try { return new Date(str).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }); }
  catch { return str; }
}

function formatDateTime(str) {
  if (!str) return "—";
  try { return new Date(str).toLocaleString("en-IN", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }); }
  catch { return str; }
}

function escH(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function escAttr(str) {
  if (!str) return "";
  return String(str).replace(/'/g,"\\'").replace(/"/g,"&quot;");
}

// Store maxMarks for use in grade modal refresh
let maxMarksForRefresh = 100;