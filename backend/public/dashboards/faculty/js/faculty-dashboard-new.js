"use strict";

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
let allStudents   = [];
let allAssignments = [];
let allExams      = [];

/* ═══════════════════════════════════════════
   PAGE NAVIGATION
═══════════════════════════════════════════ */
const pageTitles = {
  dashboard:  "Dashboard",
  students:   "Students",
  academics:  "Academics",
  attendance: "Attendance",
  grades:     "Grades",
  resources:  "Resources",
  notify:     "Notify Students"
};

function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));

  const page = document.getElementById("page-" + name);
  if (page) page.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(l => {
    if (l.getAttribute("onclick")?.includes(`'${name}'`)) {
      l.classList.add("active");
    }
  });

  const titleEl = document.getElementById("pageTitle");
  if (titleEl) titleEl.innerText = pageTitles[name] || name;

  // Lazy load page data
  if (name === "students")   loadStudents();
  if (name === "attendance") populateStudentDropdowns();
  if (name === "grades")     { populateStudentDropdowns(); loadGradeAnalytics(); }
  if (name === "resources")  loadMyResources();
  if (name === "academics")  { loadAssignments(); loadExams(); }
  if (name === "notify")     loadSentNotifications();
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();
  loadAnalytics();

  // Character counter for notification
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

  // Set today's date as default
  const today = new Date().toISOString().split("T")[0];
  const dateInputs = ["attDate", "bulkDate"];
  dateInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
});

/* ═══════════════════════════════════════════
   DASHBOARD DATA
═══════════════════════════════════════════ */
function loadDashboardData() {
  fetch("/faculty/data", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      setText("facultyName",      data.name || "Faculty");
      setText("totalStudents",    data.totalStudents    || 0);
      setText("totalAssignments", data.totalAssignments || 0);
      setText("totalExams",       data.totalExams       || 0);
      setText("totalGrades",      data.totalGrades      || 0);

      const letter = (data.name || "F")[0].toUpperCase();
      setText("avatarLetter", letter);

      // Activity
      const al = document.getElementById("activityList");
      if (al && data.activity?.length) {
        al.innerHTML = data.activity.map(a => `
          <div class="activity-item">
            <div class="activity-dot"></div>
            <span>${esc(a.activity)}</span>
            <span style="margin-left:auto; font-size:11px; color:var(--muted);">
              ${a.created_at ? new Date(a.created_at).toLocaleDateString("en-IN", { day:"2-digit", month:"short" }) : ""}
            </span>
          </div>
        `).join("");
      }
    })
    .catch(err => console.error("Dashboard data error:", err));
}

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
        if (pct >= 75) { note.innerText = "✅ Overall attendance is healthy"; note.style.color = "#065f46"; }
        else if (pct >= 60) { note.innerText = "⚠️ Some students need attention"; note.style.color = "#92400e"; }
        else { note.innerText = "❌ Attendance needs improvement"; note.style.color = "#991b1b"; }
      }

      renderGradeDist("gradeDistribution", data.gradeDistribution || []);
    })
    .catch(err => console.error("Analytics error:", err));
}

/* ═══════════════════════════════════════════
   STUDENTS
═══════════════════════════════════════════ */
function loadStudents() {
  fetch("/faculty/students/list", { credentials: "include" })
    .then(r => r.json())
    .then(students => {
      allStudents = students;
      populateClassFilter(students);
      renderStudentTable(students);
      setText("studentCountLabel", `${students.length} student${students.length !== 1 ? "s" : ""} total`);
    })
    .catch(err => console.error("Load students error:", err));
}

function renderStudentTable(students) {
  const tbody = document.getElementById("studentTableBody");
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:30px;text-align:center;color:var(--muted);">No students found</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map((s, i) => {
    const gpa = s.gpa ?? "—";
    const att = s.attendance ?? 0;
    let attBadge = "badge-green";
    if (att < 60) attBadge = "badge-red";
    else if (att < 75) attBadge = "badge-amber";

    return `
      <tr>
        <td style="color:var(--muted); font-size:12px;">${i + 1}</td>
        <td>
          <div style="font-weight:600; font-size:13px;">${esc(s.username)}</div>
        </td>
        <td style="font-size:12px; color:var(--muted);">${esc(s.email)}</td>
        <td><span class="badge badge-blue">${esc(s.prn || "—")}</span></td>
        <td style="font-size:13px;">${esc(s.class_name || "—")}</td>
        <td style="font-size:13px;">${esc(s.current_year || "—")}</td>
        <td>
          <span style="font-weight:700; color:var(--accent); font-size:14px;">${gpa}</span>
        </td>
        <td>
          <span class="badge ${attBadge}">${att}%</span>
        </td>
      </tr>
    `;
  }).join("");
}

function filterStudents() {
  const q     = (document.getElementById("searchStudent")?.value || "").toLowerCase();
  const cls   = document.getElementById("classFilter")?.value || "";

  const filtered = allStudents.filter(s => {
    const matchQ = !q ||
      (s.username || "").toLowerCase().includes(q) ||
      (s.prn      || "").toLowerCase().includes(q) ||
      (s.email    || "").toLowerCase().includes(q);
    const matchCls = !cls || s.class_name === cls;
    return matchQ && matchCls;
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

function populateStudentDropdowns(students) {
  if (!students) {
    if (allStudents.length) {
      return _populateDropdowns(allStudents);
    }
    return fetch("/faculty/students/list", { credentials: "include" })
      .then(r => r.json())
      .then(s => { allStudents = s; _populateDropdowns(s); });
  }
  _populateDropdowns(students);
}

function _populateDropdowns(students) {
  const opts = `<option value="">Select Student</option>` +
    students.map(s => `<option value="${s.id}">${esc(s.username)} ${s.prn ? `(${s.prn})` : ""}</option>`).join("");

  ["attStudent", "gradeStudent"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

/* ═══════════════════════════════════════════
   ACADEMICS — ASSIGNMENTS
═══════════════════════════════════════════ */
function showAcadTab(tab, btn) {
  document.querySelectorAll("#page-academics > div[id^='acad-']").forEach(d => d.style.display = "none");
  document.getElementById("acad-" + tab).style.display = "grid";
  document.querySelectorAll("#page-academics .tab-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  // ADD THIS LINE:
  if (tab === "courses") loadMyCourses();
}

function addAssignment() {
  const title   = val("aTitle");
  const subject = val("aSubject");
  const desc    = val("aDesc");
  const dueDate = val("aDueDate");
  const msg     = document.getElementById("aMsg");

  if (!title || !dueDate) { showMsg(msg, "error", "⚠️ Title and due date are required"); return; }

  showMsg(msg, "success", "⏳ Adding...");

  fetch("/faculty/assignment/add", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, subject, description: desc, due_date: dueDate })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Assignment added successfully!");
      clearFields(["aTitle", "aSubject", "aDesc", "aDueDate"]);
      loadAssignments();
      loadDashboardData();
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

function loadAssignments() {
  fetch("/faculty/assignments/list", { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      allAssignments = rows;
      setText("assignmentCountBadge", rows.length);
      const el = document.getElementById("assignmentList");
      if (!el) return;
      if (!rows.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><p>No assignments yet</p></div>`;
        return;
      }
      el.innerHTML = rows.map(a => `
        <div style="padding:14px; border-radius:12px; background:var(--bg); border-left:4px solid var(--accent2); margin-bottom:10px;">
          <div style="font-weight:700; font-size:14px;">${esc(a.title)}</div>
          <div style="font-size:12px; color:var(--muted); margin-top:4px;">
            📘 ${esc(a.subject || "No subject")}
            &nbsp;·&nbsp; Due: <strong>${a.due_date ? a.due_date.slice(0,10) : "—"}</strong>
          </div>
          ${a.description ? `<div style="font-size:13px; color:var(--ink); margin-top:6px;">${esc(a.description)}</div>` : ""}
        </div>
      `).join("");
    });
}

/* ═══════════════════════════════════════════
   ACADEMICS — EXAMS
═══════════════════════════════════════════ */
function addExam() {
  const subject  = val("eSubject");
  const examDate = val("eDate");
  const examType = val("eType");
  const msg      = document.getElementById("eMsg");

  if (!subject || !examDate) { showMsg(msg, "error", "⚠️ Subject and date required"); return; }

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
      clearFields(["eSubject", "eDate"]);
      loadExams();
      loadDashboardData();
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

function loadExams() {
  fetch("/faculty/exams/list", { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      allExams = rows;
      setText("examCountBadge", rows.length);
      const el = document.getElementById("examList");
      if (!el) return;
      if (!rows.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">🧪</div><p>No exams scheduled</p></div>`;
        return;
      }
      el.innerHTML = rows.map(e => {
        const examDate = e.exam_date ? new Date(e.exam_date) : null;
        const isUpcoming = examDate && examDate >= new Date();
        return `
          <div style="padding:14px; border-radius:12px; background:var(--bg);
            border-left:4px solid ${isUpcoming ? 'var(--amber)' : 'var(--muted)'}; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <div style="font-weight:700; font-size:14px;">${esc(e.subject)}</div>
                <div style="font-size:12px; color:var(--muted); margin-top:4px;">
                  ${e.exam_type || "Regular"} &nbsp;·&nbsp; 📅 ${e.exam_date ? e.exam_date.slice(0,10) : "—"}
                </div>
              </div>
              ${isUpcoming ? `<span class="badge badge-amber">Upcoming</span>` : `<span class="badge" style="background:#f3f4f6;color:var(--muted);">Past</span>`}
            </div>
          </div>
        `;
      }).join("");
    });
}

/* ============================================================
   PATCH for faculty-dashboard-new.js
   Replace the loadMyCourses() and createCourse() functions
   with these fixed versions that display the enrollment key.
   
   Also add the copyKey() helper at the bottom.
============================================================ */

/* ── PASTE THESE TWO FUNCTIONS INTO faculty-dashboard-new.js ── */

function createCourse() {
  const name = val("cName");
  const code = val("cCode");
  const sem  = val("cSem");
  const desc = val("cDesc");
  const msg  = document.getElementById("courseMsg");

  if (!name) { showMsg(msg, "error", "⚠️ Course name is required"); return; }
  showMsg(msg, "success", "⏳ Creating...");

  fetch("/faculty/courses/create", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, code, semester: sem, description: desc })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      const keyHtml = d.enrollment_key
        ? `<div style="margin-top:12px;padding:14px 18px;border-radius:12px;
              background:#d1fae5;border:2px solid #34d399;text-align:center;">
             <div style="font-size:11px;font-weight:700;text-transform:uppercase;
               letter-spacing:.5px;color:#065f46;margin-bottom:6px;">
               🔑 Enrollment Key — Share with students
             </div>
             <div style="font-family:monospace;font-size:26px;font-weight:800;
               letter-spacing:6px;color:#065f46;" id="newCourseKey">
               ${d.enrollment_key}
             </div>
             <button onclick="copyKey('${d.enrollment_key}')"
               style="margin-top:10px;padding:6px 16px;border-radius:8px;border:none;
                 background:#065f46;color:white;font-size:12px;font-weight:700;cursor:pointer;">
               📋 Copy Key
             </button>
           </div>`
        : "";

      // Show success + key in the msg area
      if (msg) {
        msg.className  = "msg success";
        msg.innerHTML  = `✅ Course "${name}" created!${keyHtml}`;
        // Don't auto-hide because the key needs to remain visible
      }

      clearFields(["cName", "cCode", "cDesc"]);
      const semEl = document.getElementById("cSem");
      if (semEl) semEl.value = "";
      loadMyCourses();
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

function loadMyCourses() {
  fetch("/faculty/courses/my", { credentials: "include" })
    .then(r => r.json())
    .then(courses => {
      const el = document.getElementById("myCoursesList");
      if (!el) return;
      if (!courses.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>No courses yet. Create one!</p></div>`;
        return;
      }
      el.innerHTML = courses.map(c => `
        <div style="padding:16px; border-radius:12px; background:var(--bg);
          border:1px solid var(--border); margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">

            <div style="flex:1; min-width:0;">
              <div style="font-weight:700; font-size:14px;">${esc(c.name)}</div>
              <div style="font-size:12px; color:var(--muted); margin-top:3px;">
                ${c.code     ? esc(c.code) + " · "         : ""}
                ${c.semester ? "Sem " + c.semester + " · " : ""}
                ${c.batch_count} batch${c.batch_count !== 1 ? "es" : ""} ·
                ${c.enrolled_count} student${c.enrolled_count !== 1 ? "s" : ""} enrolled
              </div>

              ${c.enrollment_key ? `
                <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span style="font-size:11px;color:var(--muted);font-weight:600;">🔑 Key:</span>
                  <span style="font-family:monospace;font-size:14px;font-weight:800;
                    letter-spacing:3px;color:#065f46;background:#d1fae5;
                    padding:3px 10px;border-radius:8px;">${esc(c.enrollment_key)}</span>
                  <button onclick="copyKey('${esc(c.enrollment_key)}')"
                    style="padding:3px 10px;border-radius:6px;border:none;
                      background:#065f46;color:white;font-size:11px;
                      font-weight:700;cursor:pointer;">
                    📋 Copy
                  </button>
                </div>` : `
                <div style="margin-top:6px;font-size:12px;color:var(--muted);">
                  No enrollment key — 
                  <button onclick="regenerateKey(${c.id})"
                    style="border:none;background:none;color:var(--accent);
                      font-size:12px;font-weight:600;cursor:pointer;text-decoration:underline;">
                    Generate Key
                  </button>
                </div>`}
            </div>

            <button onclick="deleteCourse(${c.id}, '${esc(c.name)}')"
              style="padding:6px 12px; border-radius:8px; border:none;
                background:#fee2e2; color:#dc2626; font-size:12px;
                font-weight:600; cursor:pointer; flex-shrink:0;">
              🗑 Delete
            </button>
          </div>
        </div>
      `).join("");
    })
    .catch(() => {});
}

function copyKey(key) {
  if (!key) return;
  navigator.clipboard.writeText(key)
    .then(() => {
      // Brief visual feedback
      const els = document.querySelectorAll("button");
      els.forEach(b => {
        if (b.innerText.includes("Copy") && b.getAttribute("onclick")?.includes(key)) {
          const orig = b.innerText;
          b.innerText = "✅ Copied!";
          setTimeout(() => { b.innerText = orig; }, 1500);
        }
      });
      alert(`✅ Enrollment key copied: ${key}\n\nShare this with your students.`);
    })
    .catch(() => {
      // Fallback
      prompt("Copy this enrollment key and share with students:", key);
    });
}

function regenerateKey(courseId) {
  if (!confirm("Generate a new enrollment key for this course?\n\nStudents with the old key will no longer be able to enroll with it.")) return;

  // Generate client-side (same logic as server fallback)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let i = 0; i < 8; i++) key += chars[Math.floor(Math.random() * chars.length)];

  // We'll use the create endpoint isn't ideal; better to have an update endpoint.
  // For now, show the key and instruct to update DB manually or add the endpoint.
  // If you have a PATCH /faculty/courses/update-key endpoint, call it here.
  fetch("/faculty/courses/regenerate-key", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course_id: courseId })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      alert(`✅ New enrollment key: ${d.enrollment_key}\n\nShare this with your students.`);
      loadMyCourses();
    } else {
      alert("❌ " + (d.message || "Could not regenerate key"));
    }
  })
  .catch(() => alert("❌ Network error"));
}

function deleteCourse(id, name) {
  if (!confirm(`Delete course "${name}"?\n\nThis will also delete all batches and attendance sessions. This cannot be undone.`)) return;

  fetch("/faculty/courses/delete", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course_id: id })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      loadMyCourses();
      loadDashboardData();
    } else {
      alert("❌ " + (d.message || "Delete failed"));
    }
  })
  .catch(() => alert("❌ Network error"));
}

/* ═══════════════════════════════════════════
   ATTENDANCE — SINGLE
═══════════════════════════════════════════ */
function showAttTab(tab, btn) {
  document.querySelectorAll("#page-attendance > div[id^='att-']").forEach(d => d.style.display = "none");
  document.getElementById("att-" + tab).style.display = tab === "view" ? "block" : "grid";
  document.querySelectorAll("#page-attendance .tab-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  if (tab === "view") loadAttendanceRecords();
}

function updateAttendance() {
  const userId   = val("attStudent");
  const subject  = val("attSubject");
  const attended = val("attAttended");
  const total    = val("attTotal");
  const date     = val("attDate");
  const msg      = document.getElementById("attMsg");

  if (!userId || !subject || !attended || !total) {
    showMsg(msg, "error", "⚠️ All fields except date are required");
    return;
  }
  if (parseInt(attended) > parseInt(total)) {
    showMsg(msg, "error", "⚠️ Attended cannot exceed total classes");
    return;
  }

  showMsg(msg, "success", "⏳ Saving...");

  fetch("/faculty/attendance/update", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, subject, attended: parseInt(attended), total: parseInt(total), date })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Attendance saved successfully!");
      clearFields(["attSubject", "attAttended", "attTotal"]);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

/* ═══════════════════════════════════════════
   ATTENDANCE — BULK
═══════════════════════════════════════════ */
function processBulkAttendance() {
  const subject = val("bulkSubject");
  const date    = val("bulkDate");
  const csv     = val("bulkCSV");
  const msg     = document.getElementById("bulkMsg");
  const results = document.getElementById("bulkResults");

  if (!subject || !csv.trim()) {
    showMsg(msg, "error", "⚠️ Subject and CSV data required");
    return;
  }

  const lines = csv.trim().split("\n").filter(l => l.trim());
  const parsed = [];
  const errors = [];

  lines.forEach((line, idx) => {
    const parts = line.split(",").map(p => p.trim());
    if (parts.length < 3) { errors.push(`Line ${idx+1}: Not enough columns`); return; }
    const [prn, attended, total] = parts;
    if (!prn || isNaN(attended) || isNaN(total)) { errors.push(`Line ${idx+1}: Invalid data`); return; }
    parsed.push({ prn, attended: parseInt(attended), total: parseInt(total) });
  });

  if (errors.length) {
    showMsg(msg, "error", "❌ Errors found: " + errors.join(", "));
    return;
  }

  showMsg(msg, "success", `⏳ Processing ${parsed.length} records...`);

  fetch("/faculty/attendance/bulk", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, date, records: parsed })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", `✅ Processed ${d.processed} records. ${d.failed || 0} failed.`);
      clearFields(["bulkCSV"]);

      results.innerHTML = `
        <div style="padding:16px; border-radius:12px; background:#d1fae5; border:1px solid #a7f3d0; margin-bottom:12px;">
          <div style="font-weight:700; color:#065f46;">✅ ${d.processed} records saved</div>
        </div>
        ${d.failedPRNs?.length ? `
        <div style="padding:16px; border-radius:12px; background:#fee2e2; border:1px solid #fecaca;">
          <div style="font-weight:700; color:#991b1b; margin-bottom:6px;">❌ ${d.failedPRNs.length} PRNs not found:</div>
          <div style="font-size:12px; color:#b91c1c;">${d.failedPRNs.join(", ")}</div>
        </div>` : ""}
      `;
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Bulk processing failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

function loadAttendanceRecords() {
  const tbody = document.getElementById("attendanceTableBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--muted);">Loading...</td></tr>`;

  fetch("/faculty/attendance/records", { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      if (!tbody) return;
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding:30px;text-align:center;color:var(--muted);">No attendance records found</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(r => {
        const pct = r.total ? Math.round((r.attended / r.total) * 100) : 0;
        let badge = "badge-green";
        if (pct < 60) badge = "badge-red";
        else if (pct < 75) badge = "badge-amber";
        return `
          <tr>
            <td style="font-weight:600;">${esc(r.username || "—")}</td>
            <td>${esc(r.subject || "—")}</td>
            <td>${r.attended}</td>
            <td>${r.total}</td>
            <td><strong>${pct}%</strong></td>
            <td><span class="badge ${badge}">${pct >= 75 ? "Good" : pct >= 60 ? "Warning" : "Critical"}</span></td>
            <td style="font-size:12px; color:var(--muted);">${r.date ? r.date.slice(0,10) : "—"}</td>
          </tr>
        `;
      }).join("");
    })
    .catch(() => {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--red);">Failed to load records</td></tr>`;
    });
}

/* ═══════════════════════════════════════════
   GRADES
═══════════════════════════════════════════ */
function enterGrade() {
  const userId  = val("gradeStudent");
  const subject = val("gradeSubject");
  const grade   = val("gradeValue");
  const msg     = document.getElementById("gradeMsg");

  if (!userId || !subject || !grade) {
    showMsg(msg, "error", "⚠️ All fields required");
    return;
  }

  showMsg(msg, "success", "⏳ Saving...");

  fetch("/faculty/grade/add", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, subject, grade })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", `✅ Grade ${grade} saved for ${subject}!`);
      clearFields(["gradeSubject"]);
      document.getElementById("gradeValue").value = "";
      loadGradeAnalytics();
      loadDashboardData();
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

function loadGradeAnalytics() {
  fetch("/faculty/analytics", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      renderGradeDist("gradeDistFull", data.gradeDistribution || []);
    });

  fetch("/faculty/grades/recent", { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      const el = document.getElementById("recentGradesList");
      if (!el) return;
      if (!rows.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">🎓</div><p>No grades yet</p></div>`;
        return;
      }
      el.innerHTML = rows.map(g => `
        <div style="display:flex; justify-content:space-between; align-items:center;
          padding:10px 0; border-bottom:1px solid var(--border);">
          <div>
            <div style="font-size:13px; font-weight:600;">${esc(g.username || "—")}</div>
            <div style="font-size:12px; color:var(--muted);">${esc(g.subject)}</div>
          </div>
          <div style="font-family:'Syne',sans-serif; font-size:22px; font-weight:800;
            color:${gradeColor(g.grade)};">${g.grade}</div>
        </div>
      `).join("");
    })
    .catch(() => {});
}

function gradeColor(g) {
  return { A: "#065f46", B: "#1d3461", C: "#92400e", D: "#c2410c", F: "#991b1b" }[g] || "var(--muted)";
}

function renderGradeDist(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!data.length) {
    el.innerHTML = `<p style="color:var(--muted); font-size:13px;">No grade data yet</p>`;
    return;
  }
  const colors = {
    A: { bg: "#d1fae5", border: "#34d399", text: "#065f46" },
    B: { bg: "#dbeafe", border: "#60a5fa", text: "#1e40af" },
    C: { bg: "#fef3c7", border: "#fcd34d", text: "#92400e" },
    D: { bg: "#fed7aa", border: "#fb923c", text: "#c2410c" },
    F: { bg: "#fee2e2", border: "#f87171", text: "#991b1b" }
  };
  el.innerHTML = data.map(g => {
    const c = colors[g.grade] || { bg: "#f3f4f6", border: "#d1d5db", text: "var(--muted)" };
    return `
      <div style="padding:16px 20px; border-radius:14px; text-align:center; min-width:80px;
        background:${c.bg}; border:2px solid ${c.border};">
        <div style="font-family:'Syne',sans-serif; font-size:28px; font-weight:800; color:${c.text};">${g.grade}</div>
        <div style="font-size:12px; color:${c.text}; margin-top:4px; opacity:.8;">${g.count} students</div>
      </div>
    `;
  }).join("");
}

/* ═══════════════════════════════════════════
   RESOURCES
═══════════════════════════════════════════ */
function uploadResource() {
  const title    = val("resTitle");
  const subject  = val("resSubject");
  const semester = val("resSemester");
  const type     = val("resType");
  const fileEl   = document.getElementById("resFile");
  const msg      = document.getElementById("resMsg");

  if (!title || !fileEl?.files?.length) {
    showMsg(msg, "error", "⚠️ Title and file are required");
    return;
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("subject", subject);
  formData.append("semester", semester);
  formData.append("type", type);
  formData.append("file", fileEl.files[0]);

  // Show progress
  const progressWrap = document.getElementById("uploadProgress");
  const progressBar  = document.getElementById("uploadBar");
  if (progressWrap) progressWrap.style.display = "block";
  showMsg(msg, "success", "⏳ Uploading...");

  // Fake progress animation
  let prog = 0;
  const progInterval = setInterval(() => {
    prog += 10;
    if (prog <= 80 && progressBar) progressBar.style.width = prog + "%";
    if (prog >= 80) clearInterval(progInterval);
  }, 150);

  fetch("/resources/upload", {
    method: "POST", credentials: "include",
    body: formData
  })
  .then(r => r.json())
  .then(d => {
    clearInterval(progInterval);
    if (progressBar) progressBar.style.width = "100%";

    setTimeout(() => {
      if (progressWrap) progressWrap.style.display = "none";
      if (progressBar) progressBar.style.width = "0%";
    }, 1000);

    if (d.success) {
      showMsg(msg, "success", "✅ Resource uploaded successfully!");
      clearFields(["resTitle", "resSubject"]);
      if (fileEl) fileEl.value = "";
      loadMyResources();
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Upload failed"));
    }
  })
  .catch(() => {
    clearInterval(progInterval);
    if (progressWrap) progressWrap.style.display = "none";
    showMsg(msg, "error", "❌ Network error");
  });
}

function loadMyResources() {
  fetch("/faculty/resources/my", { credentials: "include" })
    .then(r => r.json())
    .then(resources => {
      const el = document.getElementById("resourcesList");
      if (!el) return;
      if (!resources.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><p>No resources uploaded yet</p></div>`;
        return;
      }
      const typeIcons = { "Notes": "📄", "PPT": "📊", "PDF": "📕", "Assignment": "📝" };
      el.innerHTML = resources.map(r => `
        <div class="resource-card">
          <div class="resource-icon">${typeIcons[r.type] || "📄"}</div>
          <div class="resource-info">
            <div class="resource-title">${esc(r.title)}</div>
            <div class="resource-meta">
              ${r.subject ? esc(r.subject) + " · " : ""}
              ${r.semester ? "Sem " + r.semester + " · " : ""}
              ${r.type || "Notes"} · ⬇ ${r.downloads || 0}
            </div>
          </div>
          <a href="/resources/download/${r.id}" class="btn btn-outline btn-sm">⬇ Download</a>
        </div>
      `).join("");
    })
    .catch(() => {});
}

/* ═══════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════ */
const templates = {
  exam:       "🧪 Exam Reminder: Your exam is scheduled soon. Please review all topics and come prepared. Best of luck!",
  assignment: "📝 Assignment Reminder: Please submit your pending assignment before the due date. Contact me if you need help.",
  attendance: "✅ Attendance Alert: Your attendance has fallen below 75%. Please attend classes regularly to avoid consequences.",
  result:     "🎓 Results Announcement: Your results have been updated. Please check your academic portal for details."
};

function setTemplate(type) {
  const el = document.getElementById("notifyMessage");
  if (el) {
    el.value = templates[type] || "";
    el.dispatchEvent(new Event("input"));
  }
}

function sendNotification() {
  const target  = val("notifyTarget");
  const message = val("notifyMessage");
  const msg     = document.getElementById("notifyMsg");

  if (!message.trim()) { showMsg(msg, "error", "⚠️ Message cannot be empty"); return; }
  if (message.length > 500) { showMsg(msg, "error", "⚠️ Message too long (max 500 chars)"); return; }

  showMsg(msg, "success", "⏳ Sending...");

  fetch("/faculty/notify", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, target_role: target })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", `✅ Sent to ${d.sent} ${target}${d.sent !== 1 ? "s" : ""}!`);
      document.getElementById("notifyMessage").value = "";
      document.getElementById("charCount").innerText = "0 / 500 characters";
      loadSentNotifications();
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed to send"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

function loadSentNotifications() {
  fetch("/faculty/notifications/sent", { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      const el = document.getElementById("sentNotificationsList");
      if (!el) return;
      if (!rows.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📣</div><p>No notifications sent yet</p></div>`;
        return;
      }
      el.innerHTML = rows.map(n => `
        <div class="notif-item">
          <div>
            <div class="notif-text">${esc(n.message)}</div>
            <div style="font-size:11px; color:var(--muted); margin-top:4px;">
              Sent to: <strong>${n.target_role || "students"}</strong>
            </div>
          </div>
          <div class="notif-time">
            ${n.created_at ? new Date(n.created_at).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : ""}
          </div>
        </div>
      `).join("");
    })
    .catch(() => {});
}

/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */
function val(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function clearFields(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function showMsg(el, type, text) {
  if (!el) return;
  el.className = "msg " + type;
  el.innerText = text;
  if (type === "success") {
    setTimeout(() => { if (el) el.style.display = "none"; }, 4000);
  }
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}