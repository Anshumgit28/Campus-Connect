"use strict";
/* ============================================================
   faculty-dashboard-new.js  — FIXED
   Key fixes:
   1. All fetch calls use correct API endpoints that exist in faculty.js
   2. loadDashboardData uses /faculty/data
   3. loadStudents uses /faculty/students/list  (returns id, username, email, prn, class_name, current_year, gpa, attendance)
   4. Assignments use /faculty/assignments/list
   5. Exams use /faculty/exams/list
   6. Course dropdown uses /faculty/courses/my
   7. Attendance uses /faculty/attendance/update + /faculty/attendance/records
   8. Resources use /resources/upload + /faculty/resources/my
   9. Notifications use /faculty/notify + /faculty/notifications/sent
============================================================ */

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
let allStudents    = [];
let allAssignments = [];
let allExams       = [];
let myCoursesList  = [];

/* ═══════════════════════════════════════════
   PAGE NAVIGATION
═══════════════════════════════════════════ */
const pageTitles = {
  dashboard:  "Dashboard",
  students:   "Students",
  academics:  "Academics",
  attendance: "Attendance",
  resources:  "Resources",
  notify:     "Notify Students"
};

function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));

  const page = document.getElementById("page-" + name);
  if (page) page.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(l => {
    if (l.getAttribute("onclick")?.includes(`'${name}'`)) l.classList.add("active");
  });

  const titleEl = document.getElementById("pageTitle");
  if (titleEl) titleEl.innerText = pageTitles[name] || name;

  if (name === "students")   loadStudents();
  if (name === "attendance") populateStudentDropdowns();
  if (name === "resources")  loadMyResources();
  if (name === "academics")  { loadCourseDropdownForAcad(); loadAssignments(); loadExams(); }
  if (name === "notify")     loadSentNotifications();
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();
  loadAnalytics();

  const notifyMsg = document.getElementById("notifyMessage");
  if (notifyMsg) {
    notifyMsg.addEventListener("input", () => {
      const count = notifyMsg.value.length;
      const el = document.getElementById("charCount");
      if (el) {
        el.innerText = `${count} / 500 characters`;
        el.style.color = count > 450 ? "var(--red)" : "var(--muted)";
      }
    });
  }

  const today = new Date().toISOString().split("T")[0];
  ["attDate","bulkDate"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
});

/* ═══════════════════════════════════════════
   DASHBOARD DATA
   API: GET /faculty/data
   Returns: name, totalStudents, totalAssignments, totalExams, myCourses, activity[]
═══════════════════════════════════════════ */
function loadDashboardData() {
  fetch("/faculty/data", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      setText("facultyName",      data.name            || "Faculty");
      setText("totalStudents",    data.totalStudents   || 0);
      setText("totalAssignments", data.totalAssignments|| 0);
      setText("totalExams",       data.totalExams      || 0);
      setText("totalCourses",     data.myCourses       || 0);
      setText("avatarLetter",     (data.name || "F")[0].toUpperCase());

      const al = document.getElementById("activityList");
      if (al) {
        if (data.activity?.length) {
          al.innerHTML = data.activity.map(a => `
            <div class="activity-item">
              <div class="activity-dot"></div>
              <span>${esc(a.activity)}</span>
              <span style="margin-left:auto;font-size:11px;color:var(--muted);">
                ${a.created_at ? new Date(a.created_at).toLocaleDateString("en-IN", {day:"2-digit",month:"short"}) : ""}
              </span>
            </div>`).join("");
        } else {
          al.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No recent activity</p></div>`;
        }
      }
    })
    .catch(err => console.error("[FACULTY DASH] loadDashboardData:", err));
}

/* ═══════════════════════════════════════════
   ANALYTICS
   API: GET /faculty/analytics
   Returns: avgAttendance, gradeDistribution[]
═══════════════════════════════════════════ */
function loadAnalytics() {
  fetch("/faculty/analytics", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      const pct = data.avgAttendance || 0;
      setText("avgAttendanceBig", pct + "%");
      const bar = document.getElementById("attendanceBar");
      if (bar) bar.style.width = pct + "%";
      const note = document.getElementById("attendanceNote");
      if (note) {
        if (pct >= 75)      { note.innerText = "✅ Overall attendance is healthy"; note.style.color = "#065f46"; }
        else if (pct >= 60) { note.innerText = "⚠️ Some students need attention";  note.style.color = "#92400e"; }
        else                { note.innerText = "❌ Attendance needs improvement";   note.style.color = "#991b1b"; }
      }
      renderGradeDist("gradeDistribution", data.gradeDistribution || []);
    })
    .catch(err => console.error("[FACULTY DASH] loadAnalytics:", err));
}

/* ═══════════════════════════════════════════
   STUDENTS
   API: GET /faculty/students/list
   Returns: id, username, email, prn, class_name, current_year, gpa, attendance
═══════════════════════════════════════════ */
function loadStudents() {
  const tbody = document.getElementById("studentTableBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="padding:30px;text-align:center;color:var(--muted);">Loading students...</td></tr>`;

  fetch("/faculty/students/list", { credentials: "include" })
    .then(r => r.json())
    .then(students => {
      allStudents = students;
      populateClassFilter(students);
      renderStudentTable(students);
      setText("studentCountLabel", `${students.length} student${students.length !== 1 ? "s" : ""} total`);
    })
    .catch(err => {
      console.error("[FACULTY DASH] loadStudents:", err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="padding:30px;text-align:center;color:var(--red);">Failed to load students</td></tr>`;
    });
}

function renderStudentTable(students) {
  const tbody = document.getElementById("studentTableBody");
  if (!tbody) return;

  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:30px;text-align:center;color:var(--muted);">No students found</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map((s, i) => {
    const att = s.attendance ?? 0;
    const attBadge = att < 60 ? "badge-red" : att < 75 ? "badge-amber" : "badge-green";
    return `<tr>
      <td style="color:var(--muted);font-size:12px;">${i+1}</td>
      <td>
        <div style="font-weight:600;font-size:13px;">${esc(s.username)}</div>
      </td>
      <td style="font-size:12px;color:var(--muted);">${esc(s.email)}</td>
      <td><span class="badge badge-blue">${esc(s.prn || "—")}</span></td>
      <td>${esc(s.class_name || "—")}</td>
      <td>${esc(s.current_year || "—")}</td>
      <td><span style="font-weight:700;color:var(--accent);font-size:14px;">${s.gpa ?? "—"}</span></td>
      <td><span class="badge ${attBadge}">${att}%</span></td>
    </tr>`;
  }).join("");
}

function filterStudents() {
  const q   = (document.getElementById("searchStudent")?.value || "").toLowerCase();
  const cls = document.getElementById("classFilter")?.value || "";
  const filtered = allStudents.filter(s => {
    const matchQ = !q ||
      (s.username  || "").toLowerCase().includes(q) ||
      (s.prn       || "").toLowerCase().includes(q) ||
      (s.email     || "").toLowerCase().includes(q);
    return matchQ && (!cls || s.class_name === cls);
  });
  renderStudentTable(filtered);
  setText("studentCountLabel", `${filtered.length} of ${allStudents.length} students`);
}

function populateClassFilter(students) {
  const classes = [...new Set(students.map(s => s.class_name).filter(Boolean))].sort();
  const sel = document.getElementById("classFilter");
  if (!sel) return;
  sel.innerHTML = `<option value="">All Classes</option>` +
    classes.map(c => `<option value="${c}">${c}</option>`).join("");
}

function populateStudentDropdowns() {
  if (allStudents.length) return _populateDropdowns(allStudents);
  fetch("/faculty/students/list", { credentials: "include" })
    .then(r => r.json())
    .then(s => { allStudents = s; _populateDropdowns(s); })
    .catch(err => console.error("[FACULTY DASH] populateStudentDropdowns:", err));
}

function _populateDropdowns(students) {
  const opts = `<option value="">Select Student</option>` +
    students.map(s =>
      `<option value="${s.id}">${esc(s.username)}${s.prn ? ` (${s.prn})` : ""}</option>`
    ).join("");
  const el = document.getElementById("attStudent");
  if (el) el.innerHTML = opts;
}

/* ═══════════════════════════════════════════
   COURSE DROPDOWN — shared helper
   API: GET /faculty/courses/my
═══════════════════════════════════════════ */
function loadCourseDropdownForAcad() {
  fetch("/faculty/courses/my", { credentials: "include" })
    .then(r => r.json())
    .then(courses => {
      myCoursesList = courses;

      const note      = document.getElementById("aCourseNote");
      const sel       = document.getElementById("aCourseSel");
      const filterSel = document.getElementById("assignCourseFilter");

      if (!courses.length) {
        if (sel)  sel.innerHTML = `<option value="">— No courses yet — create one in Courses tab —</option>`;
        if (note) note.innerText = "⚠️ Create a course first so assignments link to it.";
        return;
      }

      if (note) note.innerText = `${courses.length} course${courses.length !== 1 ? "s" : ""} available`;

      const opts = courses.map(c =>
        `<option value="${c.id}">${esc(c.name)}${c.code ? ` (${esc(c.code)})` : ""}${c.semester ? ` · Sem ${c.semester}` : ""}</option>`
      ).join("");

      if (sel)       sel.innerHTML       = `<option value="">— Select course —</option>` + opts;
      if (filterSel) filterSel.innerHTML = `<option value="">All Courses</option>` + opts;
    })
    .catch(err => console.error("[FACULTY DASH] loadCourseDropdownForAcad:", err));
}

/* ═══════════════════════════════════════════
   ACADEMICS TABS
═══════════════════════════════════════════ */
function showAcadTab(tab, btn) {
  document.querySelectorAll("#page-academics > div[id^='acad-']")
    .forEach(d => d.style.display = "none");
  const tabEl = document.getElementById("acad-" + tab);
  if (tabEl) tabEl.style.display = "grid";

  document.querySelectorAll("#page-academics .tab-btn")
    .forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  if (tab === "assignments") { loadCourseDropdownForAcad(); loadAssignments(); }
  if (tab === "exams")       loadExams();
  if (tab === "courses")     loadMyCourses();
}

/* ═══════════════════════════════════════════
   ASSIGNMENTS — ADD
   API: POST /faculty/assignment/add
═══════════════════════════════════════════ */
function addAssignment() {
  const title     = val("aTitle");
  const subject   = val("aSubject");
  const desc      = val("aDesc");
  const dueDate   = val("aDueDate");
  const course_id = document.getElementById("aCourseSel")?.value || null;
  const msg       = document.getElementById("aMsg");

  if (!title)   { showMsg(msg, "error", "⚠️ Title is required");    return; }
  if (!dueDate) { showMsg(msg, "error", "⚠️ Due date is required"); return; }

  showMsg(msg, "success", "⏳ Adding...");

  fetch("/faculty/assignment/add", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, subject, description: desc, due_date: dueDate, course_id })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      const selEl      = document.getElementById("aCourseSel");
      const courseName = course_id && selEl
        ? (selEl.selectedOptions[0]?.text || "selected course")
        : "no specific course";
      showMsg(msg, "success", `✅ Assignment added to: ${courseName}`);
      clearFields(["aTitle","aSubject","aDesc","aDueDate"]);
      if (selEl) selEl.value = "";
      loadAssignments();
      loadDashboardData();
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(err => {
    console.error("[FACULTY DASH] addAssignment:", err);
    showMsg(msg, "error", "❌ Network error");
  });
}

/* ═══════════════════════════════════════════
   ASSIGNMENTS — LIST
   API: GET /faculty/assignments/list
   Returns: id, title, subject, description, due_date, max_marks,
            course_id, course_name, submission_count, enrolled_count
═══════════════════════════════════════════ */
function loadAssignments() {
  const courseFilter = document.getElementById("assignCourseFilter")?.value || "";
  const el           = document.getElementById("assignmentList");
  const badge        = document.getElementById("assignmentCountBadge");

  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading assignments...</p></div>`;

  fetch("/faculty/assignments/list", { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      allAssignments = rows;
      const filtered = courseFilter
        ? rows.filter(a => String(a.course_id) === String(courseFilter))
        : rows;

      if (badge) badge.innerText = filtered.length;
      if (!el) return;

      if (!filtered.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><p>${courseFilter ? "No assignments for this course" : "No assignments yet"}</p></div>`;
        return;
      }

      el.innerHTML = filtered.map(a => {
        const total     = a.enrolled_count || 0;
        const submitted = a.submission_count || 0;
        const pct       = total > 0 ? Math.round((submitted / total) * 100) : 0;
        const barColor  = pct >= 75 ? "#065f46" : pct >= 40 ? "#92400e" : "#991b1b";
        const isOverdue = a.due_date && new Date(a.due_date) < new Date();

        return `
          <div style="padding:14px;border-radius:12px;background:var(--bg);
            border-left:4px solid ${a.course_name ? "var(--accent2)" : "var(--border)"};
            margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:14px;">${esc(a.title)}
                  ${isOverdue ? `<span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;margin-left:6px;">Overdue</span>` : ""}
                </div>
                <div style="font-size:12px;color:var(--muted);margin-top:4px;display:flex;gap:10px;flex-wrap:wrap;">
                  ${a.subject ? `<span>📘 ${esc(a.subject)}</span>` : ""}
                  <span>Due: <strong>${a.due_date ? a.due_date.slice(0,10) : "—"}</strong></span>
                  ${a.course_name
                    ? `<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:12px;font-weight:700;font-size:11px;">📚 ${esc(a.course_name)}</span>`
                    : `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:12px;font-size:11px;">⚠️ No course linked</span>`}
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0;min-width:80px;">
                <div style="font-size:20px;font-weight:800;color:${barColor};">${submitted}<span style="font-size:13px;font-weight:400;color:var(--muted);">/${total}</span></div>
                <div style="font-size:11px;color:var(--muted);">submitted</div>
                <div style="margin-top:4px;height:4px;background:#e5e7eb;border-radius:4px;width:80px;">
                  <div style="height:4px;width:${pct}%;background:${barColor};border-radius:4px;transition:width .4s;"></div>
                </div>
              </div>
            </div>
            ${a.description ? `<div style="font-size:13px;margin-top:8px;color:var(--ink);">${esc(a.description)}</div>` : ""}
            <div style="margin-top:10px;">
              <button onclick="viewSubmissions(${a.id}, '${esc(a.title)}')"
                class="btn btn-outline btn-sm">
                👁 View ${submitted} Submission${submitted !== 1 ? "s" : ""}
              </button>
            </div>
          </div>`;
      }).join("");
    })
    .catch(err => {
      console.error("[FACULTY DASH] loadAssignments:", err);
      if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load assignments</p></div>`;
    });
}

/* ═══════════════════════════════════════════
   VIEW SUBMISSIONS MODAL
   API: GET /faculty/assignment/:id/submissions
═══════════════════════════════════════════ */
function viewSubmissions(assignmentId, title) {
  let modal = document.getElementById("submissionsModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "submissionsModal";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;display:flex;align-items:center;justify-content:center;";
    modal.innerHTML = `
      <div style="background:white;border-radius:18px;padding:28px;width:90%;max-width:640px;max-height:80vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,.25);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:700;" id="subModalTitle">Submissions</div>
          <button onclick="document.getElementById('submissionsModal').remove()"
            style="border:none;background:var(--bg,#f4f3f0);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:14px;">✕ Close</button>
        </div>
        <div id="subModalBody" style="font-size:14px;color:#6b7280;text-align:center;padding:20px;">Loading...</div>
      </div>`;
    document.body.appendChild(modal);
  }

  document.getElementById("subModalTitle").innerText = `📝 Submissions — ${title}`;
  document.getElementById("subModalBody").innerHTML  = `<p style="text-align:center;padding:20px;color:#6b7280;">Loading...</p>`;

  fetch(`/faculty/assignment/${assignmentId}/submissions`, { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      const body = document.getElementById("subModalBody");
      /* API returns { submitted: [], notSubmitted: [] } */
      const subs = Array.isArray(data) ? data : (data.submitted || []);

      if (!subs.length) {
        body.innerHTML = `<p style="text-align:center;padding:20px;color:#6b7280;">No submissions yet.</p>`;
        return;
      }
      body.innerHTML = subs.map(s => `
        <div style="padding:14px;border-radius:12px;background:#f4f3f0;border:1px solid #e8e5df;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
            <div>
              <div style="font-weight:700;font-size:14px;">${esc(s.username || "—")}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px;">
                ${esc(s.email || "—")} ${s.prn ? `· PRN: ${esc(s.prn)}` : ""}
              </div>
              <div style="font-size:12px;color:#6b7280;">
                Submitted: ${s.submitted_at
                  ? new Date(s.submitted_at).toLocaleString("en-IN", {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})
                  : "—"}
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              ${s.file_path ? `<a href="${s.file_path}" target="_blank" class="btn btn-outline btn-sm" style="padding:5px 10px;border:1px solid #e8e5df;border-radius:8px;font-size:12px;background:white;cursor:pointer;text-decoration:none;color:#0d0d14;">📥 Download</a>` : ""}
              ${s.marks !== null && s.marks !== undefined
                ? `<span style="background:#d1fae5;color:#065f46;padding:4px 10px;border-radius:8px;font-size:13px;font-weight:700;">🎯 ${s.marks}${s.graded_max ? "/"+s.graded_max : ""}</span>`
                : ""}
            </div>
          </div>
          ${s.text_content ? `<div style="margin-top:8px;padding:10px;background:white;border-radius:8px;border:1px solid #e8e5df;font-size:13px;max-height:80px;overflow-y:auto;">${esc(s.text_content)}</div>` : ""}
        </div>`).join("");
    })
    .catch(err => {
      console.error("[FACULTY DASH] viewSubmissions:", err);
      const body = document.getElementById("subModalBody");
      if (body) body.innerHTML = `<p style="color:red;text-align:center;">Failed to load submissions.</p>`;
    });
}

/* ═══════════════════════════════════════════
   EXAMS
   API: POST /faculty/exam/add
        GET  /faculty/exams/list
═══════════════════════════════════════════ */
function addExam() {
  const subject  = val("eSubject");
  const examDate = val("eDate");
  const examType = val("eType");
  const msg      = document.getElementById("eMsg");

  if (!subject || !examDate) {
    showMsg(msg, "error", "⚠️ Subject and date required");
    return;
  }
  showMsg(msg, "success", "⏳ Scheduling...");

  fetch("/faculty/exam/add", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, exam_date: examDate, exam_type: examType })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Exam scheduled!");
      clearFields(["eSubject","eDate"]);
      loadExams();
      loadDashboardData();
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(err => {
    console.error("[FACULTY DASH] addExam:", err);
    showMsg(msg, "error", "❌ Network error");
  });
}

function loadExams() {
  const el    = document.getElementById("examList");
  const badge = document.getElementById("examCountBadge");

  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading exams...</p></div>`;

  fetch("/faculty/exams/list", { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      allExams = rows;
      if (badge) badge.innerText = rows.length;
      if (!el) return;

      if (!rows.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">🧪</div><p>No exams scheduled</p></div>`;
        return;
      }
      el.innerHTML = rows.map(e => {
        const isUpcoming = e.exam_date && new Date(e.exam_date) >= new Date();
        return `
          <div style="padding:14px;border-radius:12px;background:var(--bg);
            border-left:4px solid ${isUpcoming ? "var(--amber)" : "var(--muted)"};margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <div style="font-weight:700;font-size:14px;">${esc(e.subject)}</div>
                <div style="font-size:12px;color:var(--muted);margin-top:4px;">
                  ${esc(e.exam_type || "Regular")} · 📅 ${e.exam_date ? e.exam_date.slice(0,10) : "—"}
                  ${e.course_name ? ` · 📚 ${esc(e.course_name)}` : ""}
                </div>
              </div>
              ${isUpcoming
                ? `<span class="badge badge-amber">Upcoming</span>`
                : `<span class="badge" style="background:#f3f4f6;color:var(--muted);">Past</span>`}
            </div>
          </div>`;
      }).join("");
    })
    .catch(err => {
      console.error("[FACULTY DASH] loadExams:", err);
      if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load exams</p></div>`;
    });
}

/* ═══════════════════════════════════════════
   COURSES — CREATE
   API: POST /faculty/courses/create
═══════════════════════════════════════════ */
function createCourse() {
  const name               = val("cName");
  const code               = val("cCode");
  const sem                = val("cSem");
  const desc               = val("cDesc");
  const total_sessions     = parseInt(document.getElementById("cTotalSessions")?.value) || 0;
  const total_lab_sessions = parseInt(document.getElementById("cTotalLabSessions")?.value) || 0;
  const msg                = document.getElementById("courseMsg");

  if (!name) { showMsg(msg, "error", "⚠️ Course name is required"); return; }
  if (!total_sessions || total_sessions < 1) {
    showMsg(msg, "error", "⚠️ Total lecture sessions is required (min 1)");
    return;
  }
  showMsg(msg, "success", "⏳ Creating...");

  fetch("/faculty/courses/create", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, code, semester: sem, description: desc, total_sessions, total_lab_sessions })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      const keyHtml = d.enrollment_key ? `
        <div style="margin-top:12px;padding:14px 18px;border-radius:12px;background:#d1fae5;border:2px solid #34d399;text-align:center;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#065f46;margin-bottom:6px;">🔑 Enrollment Key — share with students</div>
          <div style="font-family:monospace;font-size:26px;font-weight:800;letter-spacing:6px;color:#065f46;">${d.enrollment_key}</div>
          <button onclick="copyKey('${d.enrollment_key}')"
            style="margin-top:10px;padding:6px 16px;border-radius:8px;border:none;background:#065f46;color:white;font-size:12px;font-weight:700;cursor:pointer;">
            📋 Copy Key
          </button>
        </div>` : "";

      if (msg) { msg.className = "msg success"; msg.innerHTML = `✅ Course "${name}" created!${keyHtml}`; }
      clearFields(["cName","cCode","cDesc"]);
      ["cTotalSessions","cTotalLabSessions","cSem"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = id === "cTotalLabSessions" ? "0" : "";
      });
      loadMyCourses();
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(err => {
    console.error("[FACULTY DASH] createCourse:", err);
    showMsg(msg, "error", "❌ Network error");
  });
}

function copyKey(key) {
  navigator.clipboard.writeText(key)
    .then(() => alert(`✅ Key copied: ${key}\n\nShare this with your students.`))
    .catch(() => prompt("Copy this key:", key));
}

/* ═══════════════════════════════════════════
   COURSES — LIST
   API: GET /faculty/courses/my
═══════════════════════════════════════════ */
function loadMyCourses() {
  const el = document.getElementById("myCoursesList");
  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading courses...</p></div>`;

  fetch("/faculty/courses/my", { credentials: "include" })
    .then(r => r.json())
    .then(courses => {
      myCoursesList = courses;
      if (!el) return;
      if (!courses.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>No courses yet. Create one above.</p></div>`;
        return;
      }

      el.innerHTML = courses.map(c => `
        <div style="padding:14px;border-radius:12px;background:var(--bg);border:1px solid var(--border);margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:14px;">${esc(c.name)}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:3px;">
                ${c.code ? esc(c.code)+" · " : ""}
                ${c.semester ? "Sem "+c.semester+" · " : ""}
                ${c.batch_count} batch${c.batch_count!==1?"es":""} ·
                ${c.enrolled_count} student${c.enrolled_count!==1?"s":""} enrolled
              </div>
              ${c.total_sessions
                ? `<div style="font-size:12px;color:var(--muted);margin-top:3px;">📅 ${c.total_sessions} lectures${c.total_lab_sessions>0?" · "+c.total_lab_sessions+" labs":""}</div>`
                : ""}
              ${c.enrollment_key ? `
                <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span style="font-size:11px;color:var(--muted);font-weight:600;">🔑 Key:</span>
                  <span style="font-family:monospace;font-size:14px;font-weight:800;letter-spacing:3px;color:#065f46;background:#d1fae5;padding:3px 10px;border-radius:8px;">${esc(c.enrollment_key)}</span>
                  <button onclick="copyKey('${esc(c.enrollment_key)}')"
                    style="padding:3px 10px;border-radius:6px;border:none;background:#065f46;color:white;font-size:11px;font-weight:700;cursor:pointer;">
                    📋 Copy
                  </button>
                </div>` : ""}
            </div>
            <button onclick="deleteCourse(${c.id}, '${esc(c.name)}')"
              style="padding:6px 12px;border-radius:8px;border:none;background:#fee2e2;color:#dc2626;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;">
              🗑 Delete
            </button>
          </div>
        </div>`).join("");
    })
    .catch(err => {
      console.error("[FACULTY DASH] loadMyCourses:", err);
      if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load courses</p></div>`;
    });
}

function deleteCourse(id, name) {
  if (!confirm(`Delete course "${name}"?\n\nThis will delete all batches and attendance sessions.`)) return;
  fetch("/faculty/courses/delete", {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ course_id: id })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) { loadMyCourses(); loadDashboardData(); }
    else alert("❌ " + (d.message || "Failed"));
  })
  .catch(() => alert("❌ Network error"));
}

/* ═══════════════════════════════════════════
   ATTENDANCE TABS
═══════════════════════════════════════════ */
function showAttTab(tab, btn) {
  document.querySelectorAll("#page-attendance > div[id^='att-']")
    .forEach(d => d.style.display = "none");
  const el = document.getElementById("att-"+tab);
  if (el) el.style.display = tab === "view" ? "block" : "grid";
  document.querySelectorAll("#page-attendance .tab-btn")
    .forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  if (tab === "view") loadAttendanceRecords();
}

/* API: POST /faculty/attendance/update */
function updateAttendance() {
  const userId   = val("attStudent");
  const subject  = val("attSubject");
  const attended = val("attAttended");
  const total    = val("attTotal");
  const date     = val("attDate");
  const msg      = document.getElementById("attMsg");

  if (!userId||!subject||!attended||!total) {
    showMsg(msg,"error","⚠️ All fields except date are required");
    return;
  }
  if (parseInt(attended) > parseInt(total)) {
    showMsg(msg,"error","⚠️ Attended cannot exceed total");
    return;
  }
  showMsg(msg,"success","⏳ Saving...");

  fetch("/faculty/attendance/update", {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ user_id:userId, subject, attended:parseInt(attended), total:parseInt(total), date })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg,"success","✅ Attendance saved!");
      clearFields(["attSubject","attAttended","attTotal"]);
    } else {
      showMsg(msg,"error","❌ "+(d.message||"Failed"));
    }
  })
  .catch(() => showMsg(msg,"error","❌ Network error"));
}

/* Bulk attendance */
function processBulkAttendance() {
  const subject = val("bulkSubject"), date = val("bulkDate"), csv = val("bulkCSV");
  const msg     = document.getElementById("bulkMsg");
  const results = document.getElementById("bulkResults");

  if (!subject || !csv.trim()) { showMsg(msg,"error","⚠️ Subject and CSV required"); return; }

  const lines  = csv.trim().split("\n").filter(l => l.trim());
  const parsed = [];
  const errors = [];

  lines.forEach((line, idx) => {
    const parts = line.split(",").map(p => p.trim());
    if (parts.length < 3) { errors.push(`Line ${idx+1}: not enough columns`); return; }
    const [prn, attended, total] = parts;
    if (!prn || isNaN(attended) || isNaN(total)) { errors.push(`Line ${idx+1}: invalid data`); return; }
    parsed.push({ prn, attended: parseInt(attended), total: parseInt(total) });
  });

  if (errors.length) { showMsg(msg,"error","❌ Errors: "+errors.join(", ")); return; }
  showMsg(msg,"success",`⏳ Processing ${parsed.length} records...`);

  fetch("/faculty/attendance/bulk", {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ subject, date, records: parsed })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg,"success",`✅ ${d.processed} saved. ${d.failed||0} failed.`);
      clearFields(["bulkCSV"]);
      if (results) {
        results.innerHTML = `
          <div style="padding:16px;border-radius:12px;background:#d1fae5;border:1px solid #a7f3d0;">
            <div style="font-weight:700;color:#065f46;">✅ ${d.processed} records saved</div>
          </div>
          ${d.failedPRNs?.length
            ? `<div style="padding:16px;border-radius:12px;background:#fee2e2;border:1px solid #fecaca;margin-top:10px;">
                 <div style="font-weight:700;color:#991b1b;">❌ Not found: ${d.failedPRNs.join(", ")}</div>
               </div>` : ""}`;
      }
    } else {
      showMsg(msg,"error","❌ "+(d.message||"Failed"));
    }
  })
  .catch(() => showMsg(msg,"error","❌ Network error"));
}

/* API: GET /faculty/attendance/records */
function loadAttendanceRecords() {
  const tbody = document.getElementById("attendanceTableBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--muted);">Loading...</td></tr>`;

  fetch("/faculty/attendance/records", { credentials:"include" })
    .then(r => r.json())
    .then(rows => {
      if (!tbody) return;
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding:30px;text-align:center;color:var(--muted);">No records found</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(r => {
        const pct   = r.total ? Math.round(r.attended/r.total*100) : 0;
        const badge = pct >= 75 ? "badge-green" : pct >= 60 ? "badge-amber" : "badge-red";
        return `<tr>
          <td style="font-weight:600;">${esc(r.username||"—")}</td>
          <td>${esc(r.subject||"—")}</td>
          <td>${r.attended}</td>
          <td>${r.total}</td>
          <td><strong>${pct}%</strong></td>
          <td><span class="badge ${badge}">${pct>=75?"Good":pct>=60?"Warning":"Critical"}</span></td>
          <td style="font-size:12px;color:var(--muted);">${r.date?r.date.slice(0,10):"—"}</td>
        </tr>`;
      }).join("");
    })
    .catch(err => {
      console.error("[FACULTY DASH] loadAttendanceRecords:", err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--red);">Failed to load records</td></tr>`;
    });
}

/* ═══════════════════════════════════════════
   RESOURCES
   API: POST /resources/upload
        GET  /faculty/resources/my
═══════════════════════════════════════════ */
function uploadResource() {
  const title    = val("resTitle");
  const subject  = val("resSubject");
  const semester = val("resSemester");
  const type     = val("resType");
  const fileEl   = document.getElementById("resFile");
  const msg      = document.getElementById("resMsg");

  if (!title || !fileEl?.files?.length) {
    showMsg(msg,"error","⚠️ Title and file are required");
    return;
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("subject", subject);
  formData.append("semester", semester);
  formData.append("type", type);
  formData.append("file", fileEl.files[0]);

  const progressWrap = document.getElementById("uploadProgress");
  const progressBar  = document.getElementById("uploadBar");
  if (progressWrap) progressWrap.style.display = "block";
  showMsg(msg,"success","⏳ Uploading...");

  let prog = 0;
  const interval = setInterval(() => {
    prog += 10;
    if (prog <= 80 && progressBar) progressBar.style.width = prog + "%";
    if (prog >= 80) clearInterval(interval);
  }, 150);

  fetch("/resources/upload", { method:"POST", credentials:"include", body: formData })
    .then(r => r.json())
    .then(d => {
      clearInterval(interval);
      if (progressBar) progressBar.style.width = "100%";
      setTimeout(() => {
        if (progressWrap) progressWrap.style.display = "none";
        if (progressBar) progressBar.style.width = "0%";
      }, 1000);
      if (d.success) {
        showMsg(msg,"success","✅ Resource uploaded!");
        clearFields(["resTitle","resSubject"]);
        if (fileEl) fileEl.value = "";
        loadMyResources();
      } else {
        showMsg(msg,"error","❌ "+(d.message||"Failed"));
      }
    })
    .catch(() => {
      clearInterval(interval);
      if (progressWrap) progressWrap.style.display = "none";
      showMsg(msg,"error","❌ Network error");
    });
}

function loadMyResources() {
  const el = document.getElementById("resourcesList");
  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading resources...</p></div>`;

  fetch("/faculty/resources/my", { credentials:"include" })
    .then(r => r.json())
    .then(resources => {
      if (!el) return;
      if (!resources.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><p>No resources uploaded yet</p></div>`;
        return;
      }
      const typeIcons = { Notes:"📄", PPT:"📊", PDF:"📕", Assignment:"📝" };
      el.innerHTML = resources.map(r => `
        <div class="resource-card">
          <div class="resource-icon">${typeIcons[r.type] || "📄"}</div>
          <div class="resource-info">
            <div class="resource-title">${esc(r.title)}</div>
            <div class="resource-meta">
              ${r.subject ? esc(r.subject)+" · " : ""}
              ${r.semester ? "Sem "+r.semester+" · " : ""}
              ${r.type || "Notes"} · ⬇ ${r.downloads || 0}
            </div>
          </div>
          <a href="/resources/download/${r.id}"
            style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:white;font-size:12px;font-weight:600;text-decoration:none;color:var(--ink);">
            ⬇ Download
          </a>
        </div>`).join("");
    })
    .catch(err => {
      console.error("[FACULTY DASH] loadMyResources:", err);
      if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load resources</p></div>`;
    });
}

/* ═══════════════════════════════════════════
   NOTIFICATIONS
   API: POST /faculty/notify
        GET  /faculty/notifications/sent
═══════════════════════════════════════════ */
const templates = {
  exam:       "🧪 Exam Reminder: Your exam is scheduled soon. Please review all topics and come prepared.",
  assignment: "📝 Assignment Reminder: Please submit your pending assignment before the due date.",
  attendance: "✅ Attendance Alert: Your attendance has fallen below 75%. Please attend classes regularly.",
  result:     "🎓 Results Announcement: Your results have been updated. Please check your academic portal."
};

function setTemplate(type) {
  const el = document.getElementById("notifyMessage");
  if (el) { el.value = templates[type] || ""; el.dispatchEvent(new Event("input")); }
}

function sendNotification() {
  const target  = val("notifyTarget");
  const message = val("notifyMessage");
  const msg     = document.getElementById("notifyMsg");

  if (!message.trim()) { showMsg(msg,"error","⚠️ Message cannot be empty"); return; }
  if (message.length > 500) { showMsg(msg,"error","⚠️ Message too long (max 500 chars)"); return; }
  showMsg(msg,"success","⏳ Sending...");

  fetch("/faculty/notify", {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ message, target_role: target })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg,"success",`✅ Sent to ${d.sent} ${target}${d.sent!==1?"s":""}!`);
      const el = document.getElementById("notifyMessage");
      if (el) el.value = "";
      const cc = document.getElementById("charCount");
      if (cc) cc.innerText = "0 / 500 characters";
      loadSentNotifications();
    } else {
      showMsg(msg,"error","❌ "+(d.message||"Failed"));
    }
  })
  .catch(() => showMsg(msg,"error","❌ Network error"));
}

function loadSentNotifications() {
  const el = document.getElementById("sentNotificationsList");
  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading...</p></div>`;

  fetch("/faculty/notifications/sent", { credentials:"include" })
    .then(r => r.json())
    .then(rows => {
      if (!el) return;
      if (!rows.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📣</div><p>No notifications sent yet</p></div>`;
        return;
      }
      el.innerHTML = rows.map(n => `
        <div class="notif-item">
          <div>
            <div class="notif-text">${esc(n.message)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">
              To: <strong>${n.target_role || "students"}</strong>
            </div>
          </div>
          <div class="notif-time">
            ${n.created_at
              ? new Date(n.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})
              : ""}
          </div>
        </div>`).join("");
    })
    .catch(err => {
      console.error("[FACULTY DASH] loadSentNotifications:", err);
      if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load</p></div>`;
    });
}

/* ═══════════════════════════════════════════
   GRADE DISTRIBUTION (dashboard widget)
═══════════════════════════════════════════ */
function renderGradeDist(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!data.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:13px;">No grade data yet</p>`;
    return;
  }
  const colors = {
    A: { bg:"#d1fae5", border:"#34d399", text:"#065f46" },
    B: { bg:"#dbeafe", border:"#60a5fa", text:"#1e40af" },
    C: { bg:"#fef3c7", border:"#fcd34d", text:"#92400e" },
    D: { bg:"#fed7aa", border:"#fb923c", text:"#c2410c" },
    F: { bg:"#fee2e2", border:"#f87171", text:"#991b1b" }
  };
  el.innerHTML = data.map(g => {
    const c = colors[g.grade] || { bg:"#f3f4f6", border:"#d1d5db", text:"var(--muted)" };
    return `
      <div style="padding:16px 20px;border-radius:14px;text-align:center;min-width:80px;
        background:${c.bg};border:2px solid ${c.border};">
        <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:${c.text};">${g.grade}</div>
        <div style="font-size:12px;color:${c.text};margin-top:4px;opacity:.8;">${g.count} students</div>
      </div>`;
  }).join("");
}

/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */
function val(id) { return document.getElementById(id)?.value?.trim() || ""; }
function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function clearFields(ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; }); }

function showMsg(el, type, text) {
  if (!el) return;
  el.className = "msg " + type;
  el.innerText = text;
  if (type === "success") setTimeout(() => { if (el) el.style.display = "none"; }, 5000);
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}