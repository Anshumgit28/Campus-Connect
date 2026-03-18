"use strict";

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
const state = {
  step:             1,
  courses:          [],
  batches:          [],
  selectedCourse:   null,
  selectedBatch:    null,
  students:         [],
  attendance:       {},
  activeMgrCourse:  null
};

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  loadFacultyInfo();
  loadCoursesForStep1();

  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("sessionDate");
  if (dateInput) dateInput.value = today;
});

function loadFacultyInfo() {
  fetch("/faculty/data", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      setText("facultyName",  d.name || "Faculty");
      setText("avatarLetter", (d.name || "F")[0].toUpperCase());
    })
    .catch(() => {});
}

/* ═══════════════════════════════════════════
   TABS
═══════════════════════════════════════════ */
function showMainTab(tab, btn) {
  ["mark", "sessions", "courses"].forEach(t => {
    const el = document.getElementById("tab-" + t);
    if (el) el.style.display = t === tab ? "block" : "none";
  });

  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  if (tab === "sessions") loadSessions();
  if (tab === "courses")  loadMyCourses();
}

/* ═══════════════════════════════════════════
   WIZARD NAVIGATION
═══════════════════════════════════════════ */
function goToStep(n) {
  state.step = n;

  [1, 2, 3, 4].forEach(i => {
    const stepEl = document.getElementById("step" + i);
    const lineEl = document.getElementById("line" + i);
    if (!stepEl) return;

    stepEl.classList.remove("active", "done");
    if (i < n)  stepEl.classList.add("done");
    if (i === n) stepEl.classList.add("active");

    if (lineEl) lineEl.style.background = i < n ? "var(--green2)" : "var(--border)";
  });

  document.querySelectorAll(".wizard-panel").forEach(p => p.classList.remove("active"));
  const panel = document.getElementById("panel" + n);
  if (panel) panel.classList.add("active");

  if (n === 2) loadBatchesForStep2();
  if (n === 4) loadStudentsForMarking();
}

/* ═══════════════════════════════════════════
   STEP 1 — SELECT COURSE
═══════════════════════════════════════════ */
function loadCoursesForStep1() {
  fetch("/faculty/courses/my", { credentials: "include" })
    .then(r => r.json())
    .then(courses => {
      state.courses = courses;
      renderCourseGrid(courses);

      const sel = document.getElementById("histCourseFilter");
      if (sel) {
        sel.innerHTML = '<option value="">All Courses</option>' +
          courses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
      }
    })
    .catch(() => {});
}

function renderCourseGrid(courses) {
  const el = document.getElementById("courseGrid");
  if (!el) return;

  if (!courses.length) {
    el.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <span class="empty-icon">📚</span>
        <p>No courses yet. Go to "Manage Courses" tab to create one.</p>
      </div>`;
    return;
  }

  el.innerHTML = courses.map(c => `
    <div class="course-card ${state.selectedCourse?.id === c.id ? "selected" : ""}"
      onclick="selectCourse(${c.id})">
      <div class="course-card-name">${esc(c.name)}</div>
      <div class="course-card-meta">
        ${c.code ? `<strong>${esc(c.code)}</strong> · ` : ""}
        ${c.semester ? `Sem ${c.semester} · ` : ""}
        ${c.batch_count} batch${c.batch_count !== 1 ? "es" : ""}
      </div>
      <div class="course-card-badge">👨‍🎓 ${c.enrolled_count} enrolled</div>
    </div>
  `).join("");
}

function selectCourse(id) {
  state.selectedCourse = state.courses.find(c => c.id === id) || null;
  renderCourseGrid(state.courses);
  setText("selectedCourseName", state.selectedCourse?.name || "—");
  setText("sess-course-name",   state.selectedCourse?.name || "—");
  goToStep(2);
}

/* ═══════════════════════════════════════════
   STEP 2 — SELECT BATCH
═══════════════════════════════════════════ */
function loadBatchesForStep2() {
  if (!state.selectedCourse) return;

  fetch("/faculty/batches/" + state.selectedCourse.id, { credentials: "include" })
    .then(r => r.json())
    .then(batches => {
      state.batches = batches;
      renderBatchGrid(batches);
    })
    .catch(() => {});
}

function renderBatchGrid(batches) {
  const el = document.getElementById("batchGrid");
  if (!el) return;

  if (!batches.length) {
    el.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <span class="empty-icon">🏫</span>
        <p>No batches for this course. Click "Add / Manage Batches" to create one.</p>
      </div>`;
    return;
  }

  const typeClass = { Lecture: "type-lecture", Lab: "type-lab", Tutorial: "type-tutorial" };

  el.innerHTML = batches.map(b => `
    <div class="batch-card ${state.selectedBatch?.id === b.id ? "selected" : ""}"
      onclick="selectBatch(${b.id}, '${esc(b.name)}', '${esc(b.type)}')">
      <div class="batch-type ${typeClass[b.type] || "type-lecture"}">${b.type}</div>
      <div class="batch-name">${esc(b.name)}</div>
      <div class="batch-count">👨‍🎓 ${b.student_count} students enrolled</div>
    </div>
  `).join("");
}

function selectBatch(id, name, type) {
  state.selectedBatch = { id, name, type };

  const sessType = document.getElementById("sessionType");
  if (sessType && ["Lecture", "Lab", "Tutorial"].includes(type)) sessType.value = type;

  renderBatchGrid(state.batches);
  setText("sess-batch-name", name);
  goToStep(3);
}

/* ═══════════════════════════════════════════
   STEP 4 — MARK STUDENTS
═══════════════════════════════════════════ */
function loadStudentsForMarking() {
  if (!state.selectedBatch) return;

  const sessType = document.getElementById("sessionType")?.value || "—";
  const sessDate = document.getElementById("sessionDate")?.value || "—";

  setText("mark-session-info",
    `${state.selectedCourse?.name || "—"} › ${state.selectedBatch.name} › ${sessType} › ${sessDate}`);

  fetch("/faculty/attendance/batch-students/" + state.selectedBatch.id, { credentials: "include" })
    .then(r => r.json())
    .then(students => {
      state.students   = students;
      state.attendance = {};
      students.forEach(s => { state.attendance[s.id] = "absent"; });
      renderStudentAttendanceList(students);
      updateSummary();
    })
    .catch(() => {});
}

function renderStudentAttendanceList(students) {
  const el = document.getElementById("studentAttendanceList");
  if (!el) return;

  if (!students.length) {
    el.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">👨‍🎓</span>
        <p>No students in this batch. Students must enroll and select this batch.</p>
      </div>`;
    return;
  }

  el.innerHTML = students.map(s => `
    <div class="student-row" id="srow-${s.id}">
      <div>
        <div class="student-name">${esc(s.username)}</div>
        <div class="student-prn">${esc(s.prn || s.class_name || "—")}</div>
      </div>
      <div class="prn-col">${esc(s.prn || "—")}</div>
      <div>
        <div class="status-toggle">
          <button class="status-btn ${state.attendance[s.id] === "present" ? "active-present" : ""}"
            onclick="setStatus(${s.id}, 'present', this)">P</button>
        </div>
      </div>
      <div>
        <div class="status-toggle">
          <button class="status-btn ${state.attendance[s.id] === "late" ? "active-late" : ""}"
            onclick="setStatus(${s.id}, 'late', this)">L</button>
        </div>
      </div>
      <div>
        <div class="status-toggle">
          <button class="status-btn ${state.attendance[s.id] === "absent" ? "active-absent" : ""}"
            onclick="setStatus(${s.id}, 'absent', this)">A</button>
        </div>
      </div>
    </div>
  `).join("");
}

function setStatus(studentId, status, btn) {
  state.attendance[studentId] = status;

  const row = document.getElementById("srow-" + studentId);
  if (row) {
    row.querySelectorAll(".status-btn").forEach(b => {
      b.classList.remove("active-present", "active-late", "active-absent");
    });
    btn.classList.add("active-" + status);
  }

  updateSummary();
}

function markAll(status) {
  state.students.forEach(s => { state.attendance[s.id] = status; });
  renderStudentAttendanceList(state.students);
  updateSummary();
}

function filterStudentList() {
  const q = (document.getElementById("searchStudent")?.value || "").toLowerCase();
  const filtered = state.students.filter(s =>
    (s.username || "").toLowerCase().includes(q) ||
    (s.prn      || "").toLowerCase().includes(q));
  renderStudentAttendanceList(filtered);
}

function updateSummary() {
  const vals    = Object.values(state.attendance);
  const present = vals.filter(v => v === "present").length;
  const late    = vals.filter(v => v === "late").length;
  const absent  = vals.filter(v => v === "absent").length;
  const total   = vals.length;
  const pct     = total ? Math.round(((present + late) / total) * 100) : 0;

  setText("sum-present", present + " Present");
  setText("sum-late",    late    + " Late");
  setText("sum-absent",  absent  + " Absent");
  setText("sum-pct",     pct + "% present");
}

function submitAttendance() {
  const courseId = state.selectedCourse?.id;
  const batchId  = state.selectedBatch?.id;
  const sessType = document.getElementById("sessionType")?.value;
  const sessDate = document.getElementById("sessionDate")?.value;
  const topic    = (document.getElementById("sessionTopic")?.value || "").trim();
  const msgEl    = document.getElementById("submitMsg");

  if (!courseId || !batchId || !sessDate) {
    showMsg(msgEl, "error", "⚠️ Missing course, batch or date");
    return;
  }
  if (!Object.keys(state.attendance).length) {
    showMsg(msgEl, "error", "⚠️ No students to mark");
    return;
  }

  const records = Object.entries(state.attendance).map(([student_id, status]) => ({
    student_id: parseInt(student_id), status
  }));

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.innerText = "⏳ Saving...";

  fetch("/faculty/attendance/session", {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course_id: courseId, batch_id: batchId, session_type: sessType, session_date: sessDate, topic, records })
  })
  .then(r => r.json())
  .then(d => {
    btn.disabled = false;
    btn.innerText = "💾 Save Attendance";

    if (d.success) {
      showMsg(msgEl, "success", `✅ Saved! ${d.present}/${d.total} present.`);
      setTimeout(() => {
        state.attendance = {};
        state.students.forEach(s => { state.attendance[s.id] = "absent"; });
        renderStudentAttendanceList(state.students);
        updateSummary();
        const topicEl = document.getElementById("sessionTopic");
        if (topicEl) topicEl.value = "";
      }, 2000);
    } else {
      showMsg(msgEl, "error", "❌ " + (d.message || "Save failed"));
    }
  })
  .catch(() => {
    btn.disabled = false;
    btn.innerText = "💾 Save Attendance";
    showMsg(msgEl, "error", "❌ Network error");
  });
}

/* ═══════════════════════════════════════════
   SESSION HISTORY
═══════════════════════════════════════════ */
function loadSessions() {
  const courseId = document.getElementById("histCourseFilter")?.value;

  if (!courseId) {
    loadAllSessions();
    return;
  }

  fetch("/faculty/attendance/sessions/" + courseId, { credentials: "include" })
    .then(r => r.json())
    .then(sessions => renderSessionsTable(sessions))
    .catch(() => {});
}

function loadAllSessions() {
  if (!state.courses.length) return;

  Promise.all(
    state.courses.map(c =>
      fetch("/faculty/attendance/sessions/" + c.id, { credentials: "include" }).then(r => r.json()))
  )
  .then(results => {
    const all = results.flat().sort((a, b) => new Date(b.session_date) - new Date(a.session_date));
    renderSessionsTable(all);
  })
  .catch(() => {});
}

function renderSessionsTable(sessions) {
  const tbody = document.getElementById("sessionsTableBody");
  if (!tbody) return;

  if (!sessions.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">No sessions recorded yet</td></tr>`;
    return;
  }

  const typeColor = { Lecture: "badge-blue", Lab: "badge-purple", Tutorial: "badge-amber" };

  tbody.innerHTML = sessions.map(s => {
    const pct      = s.total_students
      ? Math.round(((s.present_count + (s.late_count || 0)) / s.total_students) * 100)
      : 0;
    const pctBadge = pct < 60 ? "badge-red" : pct < 75 ? "badge-amber" : "badge-green";
    const course   = state.courses.find(c => c.id === s.course_id);

    return `
      <tr>
        <td class="td-bold">${s.session_date ? String(s.session_date).slice(0, 10) : "—"}</td>
        <td>${esc(course?.name || "—")}</td>
        <td><span class="badge badge-blue">${esc(s.batch_name || "—")}</span></td>
        <td><span class="badge ${typeColor[s.session_type] || "badge-blue"}">${esc(s.session_type)}</span></td>
        <td class="td-muted">${esc(s.topic || "—")}</td>
        <td class="td-present">${s.present_count || 0}</td>
        <td>${s.total_students || 0}</td>
        <td><span class="badge ${pctBadge}">${pct}%</span></td>
      </tr>`;
  }).join("");
}

/* ═══════════════════════════════════════════
   COURSE MANAGER
═══════════════════════════════════════════ */
function loadMyCourses() {
  fetch("/faculty/courses/my", { credentials: "include" })
    .then(r => r.json())
    .then(courses => {
      state.courses = courses;
      renderCourseGrid(courses);

      const el = document.getElementById("myCoursesList");
      if (!el) return;

      if (!courses.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">📚</span><p>No courses yet</p></div>`;
        return;
      }

      el.innerHTML = courses.map(c => `
        <div class="course-list-item">
          <div>
            <div class="course-list-name">${esc(c.name)}</div>
            <div class="course-list-meta">
              ${c.code     ? esc(c.code) + " · "          : ""}
              ${c.semester ? "Sem " + c.semester + " · "  : ""}
              ${c.batch_count} batch${c.batch_count !== 1 ? "es" : ""} ·
              ${c.enrolled_count} students
            </div>
          </div>
          <div class="course-list-actions">
            <button class="btn btn-outline btn-sm" onclick="openBatchManager(${c.id}, '${esc(c.name)}')">🏫 Batches</button>
            <button class="btn btn-danger-sm" onclick="deleteCourse(${c.id})">🗑</button>
          </div>
        </div>
      `).join("");

      const sel = document.getElementById("histCourseFilter");
      if (sel) {
        sel.innerHTML = '<option value="">All Courses</option>' +
          courses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
      }
    })
    .catch(() => {});
}

function createCourse() {
  const name = (document.getElementById("cName")?.value || "").trim();
  const code = (document.getElementById("cCode")?.value || "").trim();
  const sem  = document.getElementById("cSem")?.value || "";
  const desc = (document.getElementById("cDesc")?.value || "").trim();
  const msg  = document.getElementById("courseMsg");

  if (!name) { showMsg(msg, "error", "⚠️ Course name required"); return; }

  fetch("/faculty/courses/create", {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, code, semester: sem, description: desc })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Course created!");
      clearFields(["cName", "cCode", "cDesc"]);
      loadMyCourses();
      loadCoursesForStep1();
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

function deleteCourse(id) {
  if (!confirm("Delete this course and all its batches/sessions? This cannot be undone.")) return;

  fetch("/faculty/courses/delete", {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course_id: id })
  })
  .then(r => r.json())
  .then(d => { if (d.success) loadMyCourses(); })
  .catch(() => {});
}

/* ═══════════════════════════════════════════
   BATCH MANAGER
═══════════════════════════════════════════ */
function openBatchManager(courseId, courseName) {
  state.activeMgrCourse = courseId;
  setText("batchMgrCourseName", courseName);

  const card = document.getElementById("batchManagerCard");
  if (card) {
    card.style.display = "block";
    card.scrollIntoView({ behavior: "smooth" });
  }

  loadBatchList(courseId);
}

function closeBatchManager() {
  const card = document.getElementById("batchManagerCard");
  if (card) card.style.display = "none";
}

function showBatchManager() {
  if (state.selectedCourse) {
    showMainTab("courses", null);
    openBatchManager(state.selectedCourse.id, state.selectedCourse.name);
  }
}

function showCourseManager() {
  const btn = document.querySelectorAll(".tab-btn")[2];
  showMainTab("courses", btn || null);
}

function loadBatchList(courseId) {
  fetch("/faculty/batches/" + courseId, { credentials: "include" })
    .then(r => r.json())
    .then(batches => {
      const el = document.getElementById("batchList");
      if (!el) return;

      if (!batches.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">🏫</span><p>No batches yet</p></div>`;
        return;
      }

      const typeColor = { Lecture: "type-lecture", Lab: "type-lab", Tutorial: "type-tutorial" };

      el.innerHTML = batches.map(b => `
        <div class="batch-list-item">
          <div>
            <div class="batch-list-header-row">
              <span class="batch-type ${typeColor[b.type] || "type-lecture"}">${b.type}</span>
              <strong>${esc(b.name)}</strong>
            </div>
            <div class="batch-list-count">👨‍🎓 ${b.student_count} students</div>
          </div>
          <button class="btn btn-danger-sm" onclick="deleteBatch(${b.id})">🗑</button>
        </div>
      `).join("");
    })
    .catch(() => {});
}

function createBatch() {
  const courseId = state.activeMgrCourse;
  const name = (document.getElementById("bName")?.value || "").trim();
  const type = document.getElementById("bType")?.value || "Lecture";
  const msg  = document.getElementById("batchMsg");

  if (!courseId || !name) { showMsg(msg, "error", "⚠️ Batch name required"); return; }

  fetch("/faculty/batches/create", {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course_id: courseId, name, type })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Batch added!");
      clearFields(["bName"]);
      loadBatchList(courseId);
      loadMyCourses();
      loadCoursesForStep1();
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

function deleteBatch(id) {
  if (!confirm("Delete this batch? Enrolled students will lose their batch assignment.")) return;

  fetch("/faculty/batches/delete", {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batch_id: id })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success && state.activeMgrCourse) loadBatchList(state.activeMgrCourse);
  })
  .catch(() => {});
}

/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */
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
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}