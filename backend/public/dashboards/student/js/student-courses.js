"use strict";
/* ============================================================
   student-courses.js — with assignment submission modal
============================================================ */

let myCourses   = [];
let allCourses  = [];
let filteredAll = [];

document.addEventListener("DOMContentLoaded", () => {
  loadAvatar();
  loadNotifBadge();
  loadMyEnrollments();
});

function loadAvatar() {
  fetch("/dashboard/data", { credentials: "include" })
    .then(r => r.json())
    .then(d => { const el = document.getElementById("avatarLetter"); if (el) el.innerText = (d.user||"S")[0].toUpperCase(); })
    .catch(() => {});
}

function loadNotifBadge() {
  fetch("/notifications/count", { credentials: "include" })
    .then(r => r.json())
    .then(d => { const el = document.getElementById("notifBadge"); if (el && d.count > 0) { el.innerText = d.count; el.style.display = "inline"; } })
    .catch(() => {});
}

/* ── TABS ── */
function showTab(tab, btn) {
  ["enrolled","browse"].forEach(t => { const el = document.getElementById("tab-"+t); if (el) el.style.display = t===tab?"block":"none"; });
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  if (tab === "browse" && !allCourses.length) loadBrowseCourses();
}

/* ── MY COURSES ── */
function loadMyEnrollments() {
  fetch("/courses/my", { credentials: "include" })
    .then(r => r.json())
    .then(courses => { myCourses = courses; renderAlerts(courses); renderEnrolledGrid(courses); })
    .catch(() => { const el = document.getElementById("enrolledGrid"); if (el) el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="empty-icon">⚠️</span><p>Failed to load courses.</p></div>`; });
}

function renderAlerts(courses) {
  const sec = document.getElementById("alertsSection");
  if (!sec) return;
  const low = courses.filter(c => (c.lec_pct !== null && c.lec_pct < 75) || (c.lab_pct !== null && c.lab_pct < 75));
  if (!low.length) { sec.innerHTML = ""; return; }
  sec.innerHTML = low.map(c => {
    const items = [];
    if (c.lec_pct !== null && c.lec_pct < 75) items.push(`Lectures: ${c.lec_pct}%`);
    if (c.lab_pct !== null && c.lab_pct < 75)  items.push(`Labs: ${c.lab_pct}%`);
    const isCrit = items.some(x => parseInt(x.split(":")[1]) < 60);
    return `<div class="alert-banner ${isCrit?"alert-crit":"alert-warn"}">${isCrit?"❌":"⚠️"} <strong>${esc(c.name)}</strong>: Low attendance — ${items.join(", ")}</div>`;
  }).join("");
}

function renderEnrolledGrid(courses) {
  const el = document.getElementById("enrolledGrid");
  if (!el) return;
  if (!courses.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="empty-icon">🎓</span><p style="margin-bottom:16px;">No courses enrolled yet.</p><button class="btn btn-primary" onclick="openEnrollModal()">🔑 Enroll with Key</button></div>`;
    return;
  }
  el.innerHTML = courses.map(c => {
    const lecClass = attClass(c.lec_pct);
    const labClass = attClass(c.lab_pct);
    return `
      <div class="my-course-card">
        <div class="my-course-header">
          <div class="my-course-name">${esc(c.name)}</div>
          <div class="my-course-meta">${c.code?esc(c.code)+" · ":""}👨‍🏫 ${esc(c.faculty_name||"—")}${c.semester?" · Sem "+c.semester:""}${c.batch_name?" · 📋 "+esc(c.batch_name):""}</div>
        </div>
        <div class="my-course-body">
          ${c.lec_pct !== null ? `
            <div class="att-section">
              <div class="att-label">Lecture Attendance</div>
              <div class="att-row">
                <span class="att-pct ${lecClass}">${c.lec_pct}%</span>
                <div class="att-track"><div class="att-fill ${lecClass}" style="width:${c.lec_pct}%"></div></div>
                <span class="att-counts">${c.lec_attended}/${c.lec_total}</span>
              </div>
            </div>` : ""}
          ${c.lab_pct !== null ? `
            <div class="att-section">
              <div class="att-label">Lab Attendance</div>
              <div class="att-row">
                <span class="att-pct ${labClass}">${c.lab_pct}%</span>
                <div class="att-track"><div class="att-fill ${labClass}" style="width:${c.lab_pct}%"></div></div>
                <span class="att-counts">${c.lab_attended}/${c.lab_total}</span>
              </div>
            </div>` : ""}
          ${(c.lec_pct === null && c.lab_pct === null) ? `<p style="color:var(--muted);font-size:13px;margin-bottom:12px;">No attendance recorded yet</p>` : ""}
          ${c.pending_assignments > 0 ? `<div style="margin-bottom:12px;"><span class="assign-chip">📝 ${c.pending_assignments} pending assignment${c.pending_assignments!==1?"s":""}</span></div>` : ""}
          <div class="course-action-row">
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();viewAttendance(${c.id},'${esc(c.name)}')">📊 Attendance</button>
            <button class="btn btn-primary btn-sm"  onclick="event.stopPropagation();openAssignmentsModal(${c.id},'${esc(c.name)}')">📝 Assignments</button>
            <button class="btn btn-danger btn-sm"   onclick="event.stopPropagation();unenroll(event,${c.id},'${esc(c.name)}')">Leave</button>
          </div>
        </div>
      </div>`;
  }).join("");
}

function attClass(pct) { if (pct===null||pct===undefined||pct>=75) return "good"; if (pct>=60) return "warn"; return "crit"; }

/* ── BROWSE ── */
function loadBrowseCourses() {
  const el = document.getElementById("browseGrid");
  if (el) el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="empty-icon">🔍</span><p>Loading...</p></div>`;
  fetch("/courses/", { credentials: "include" })
    .then(r => r.json())
    .then(courses => {
      allCourses = courses; filteredAll = courses;
      renderBrowseGrid(courses);
      const cnt = document.getElementById("browseCount");
      if (cnt) cnt.innerText = `${courses.length} course${courses.length!==1?"s":""} available`;
    })
    .catch(() => { const el = document.getElementById("browseGrid"); if (el) el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p style="color:red;">Failed to load courses</p></div>`; });
}

function renderBrowseGrid(courses) {
  const el = document.getElementById("browseGrid");
  if (!el) return;
  if (!courses.length) { el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="empty-icon">🔍</span><p>No courses found</p></div>`; return; }
  const enrolledIds = new Set(myCourses.map(c => c.id));
  el.innerHTML = courses.map(c => {
    const enrolled = enrolledIds.has(c.id);
    return `<div class="browse-card ${enrolled?"enrolled":""}">
      ${c.code?`<div class="course-code">${esc(c.code)}</div>`:""}
      <div class="course-name">${esc(c.name)}</div>
      <div class="course-meta">👨‍🏫 ${esc(c.faculty_name||"—")}${c.semester?" · Sem "+c.semester:""}${c.description?`<br><span style="font-size:12px;">${esc(c.description.slice(0,80))}${c.description.length>80?"…":""}</span>`:""}</div>
      <div class="course-footer">
        <span style="font-size:12px;color:var(--muted);">👨‍🎓 ${c.enrolled_count||0} enrolled</span>
        ${enrolled?`<span class="enrolled-label">✅ Enrolled</span>`:`<button class="btn btn-primary btn-sm" onclick="openEnrollModal()">🔑 Enroll</button>`}
      </div>
    </div>`;
  }).join("");
}

function filterBrowse() {
  const q = (document.getElementById("searchCourse")?.value||"").toLowerCase();
  const sem = document.getElementById("semFilter")?.value||"";
  filteredAll = allCourses.filter(c => {
    const matchQ = !q||(c.name||"").toLowerCase().includes(q)||(c.code||"").toLowerCase().includes(q)||(c.faculty_name||"").toLowerCase().includes(q);
    return matchQ && (!sem||String(c.semester)===sem);
  });
  renderBrowseGrid(filteredAll);
  const cnt = document.getElementById("browseCount");
  if (cnt) cnt.innerText = `${filteredAll.length} of ${allCourses.length} courses`;
}

/* ── ATTENDANCE MODAL ── */
function viewAttendance(courseId, courseName) {
  const modal = document.getElementById("sessionModal");
  const title = document.getElementById("sessionModalTitle");
  const body  = document.getElementById("sessionModalBody");
  if (!modal) return;
  title.innerText = `📊 ${courseName} — Attendance`;
  body.innerHTML  = `<p style="color:var(--muted);text-align:center;padding:20px;">Loading...</p>`;
  modal.classList.add("open");
  fetch(`/courses/${courseId}/my-attendance`, { credentials: "include" })
    .then(r => r.json())
    .then(sessions => {
      if (!sessions.length) { body.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px;">No attendance sessions recorded yet.</p>`; return; }
      const present=sessions.filter(s=>s.status==="present").length;
      const late   =sessions.filter(s=>s.status==="late").length;
      const absent =sessions.filter(s=>s.status==="absent").length;
      const total  =sessions.length;
      const pct    =Math.round(((present+late)/total)*100);
      body.innerHTML = `
        <div class="session-summary">
          <div class="session-summary-item"><div class="summary-big-num" style="color:var(--indigo);">${pct}%</div><div class="summary-item-label">Overall</div></div>
          <div class="session-summary-item session-summary-present"><div class="summary-big-num">${present}</div><div class="summary-item-label">Present</div></div>
          <div class="session-summary-item session-summary-late"><div class="summary-big-num">${late}</div><div class="summary-item-label">Late</div></div>
          <div class="session-summary-item session-summary-absent"><div class="summary-big-num">${absent}</div><div class="summary-item-label">Absent</div></div>
        </div>
        <div style="max-height:350px;overflow-y:auto;">
          <table class="session-table">
            <thead><tr><th>Date</th><th>Type</th><th>Topic</th><th>Status</th></tr></thead>
            <tbody>${sessions.map(s=>`<tr><td>${s.session_date?String(s.session_date).slice(0,10):"—"}</td><td>${esc(s.session_type||"—")}</td><td style="color:var(--muted);font-size:12px;">${esc(s.topic||"—")}</td><td><span class="status-${s.status||"absent"}">${s.status||"absent"}</span></td></tr>`).join("")}</tbody>
          </table>
        </div>`;
    })
    .catch(() => { body.innerHTML = `<p style="color:red;text-align:center;padding:20px;">Failed to load attendance.</p>`; });
}

function closeSessionModal() { document.getElementById("sessionModal")?.classList.remove("open"); }

/* ── ASSIGNMENTS MODAL (with submit button) ── */
function openAssignmentsModal(courseId, courseName) {
  const modal = document.getElementById("assignModal");
  const title = document.getElementById("assignModalTitle");
  const body  = document.getElementById("assignModalBody");
  if (!modal) return;
  title.innerText = `📝 ${courseName} — Assignments`;
  body.innerHTML  = `<p style="color:var(--muted);text-align:center;padding:20px;">Loading...</p>`;
  modal.classList.add("open");

  fetch(`/courses/${courseId}/assignments`, { credentials: "include" })
    .then(r => r.json())
    .then(assignments => {
      if (!assignments.length) { body.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px;">No assignments yet.</p>`; return; }
      body.innerHTML = assignments.map(a => {
        const isOverdue   = a.due_date && new Date(a.due_date) < new Date() && !a.submission_id;
        const isSubmitted = !!a.submission_id;
        const statusLabel = isSubmitted
          ? `<span style="background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">✅ Submitted</span>`
          : isOverdue
            ? `<span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">❌ Overdue</span>`
            : `<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">⏳ Pending</span>`;
        return `
          <div style="padding:16px;border-radius:12px;background:var(--bg);border:1px solid var(--border);margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:14px;">${esc(a.title)}</div>
                ${a.subject?`<div style="font-size:12px;color:var(--muted);margin-top:2px;">📘 ${esc(a.subject)}</div>`:""}
                ${a.description?`<div style="font-size:13px;margin-top:6px;">${esc(a.description)}</div>`:""}
                <div style="font-size:12px;color:var(--muted);margin-top:6px;">
                  Due: <strong>${a.due_date?String(a.due_date).slice(0,10):"—"}</strong>
                  ${a.max_marks?` · Max: ${a.max_marks} marks`:""}
                </div>
                ${a.marks!==null&&a.marks!==undefined?`<div style="margin-top:6px;font-size:13px;color:#065f46;font-weight:700;">🎯 Marks: ${a.marks}${a.max_marks?"/"+a.max_marks:""}</div>${a.feedback?`<div style="font-size:12px;color:var(--muted);margin-top:4px;">💬 ${esc(a.feedback)}</div>`:""}`:""}
              </div>
              <div>${statusLabel}</div>
            </div>
            <!-- SUBMIT BUTTON — shown if not overdue or already submitted, allow resubmit too -->
            <div style="margin-top:10px;">
              <button onclick="openSubmitModal(${a.id},'${esc(a.title)}',${isSubmitted?1:0})"
                class="btn ${isSubmitted?"btn-outline":"btn-primary"} btn-sm">
                ${isSubmitted?"🔄 Update Submission":"📤 Submit Assignment"}
              </button>
            </div>
          </div>`;
      }).join("");
    })
    .catch(() => { body.innerHTML = `<p style="color:red;text-align:center;padding:20px;">Failed to load assignments.</p>`; });
}

function closeAssignModal() { document.getElementById("assignModal")?.classList.remove("open"); }

/* ── SUBMIT ASSIGNMENT MODAL ── */
function openSubmitModal(assignmentId, assignmentTitle, isUpdate) {
  /* Remove existing if any */
  document.getElementById("submitAssignModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "submitAssignModal";
  modal.className = "modal-overlay";
  modal.style.zIndex = "200";  /* above assignments modal */
  modal.innerHTML = `
    <div class="modal" style="max-width:500px;">
      <div class="modal-header">
        <div class="modal-title">${isUpdate?"🔄 Update Submission":"📤 Submit Assignment"}</div>
        <button class="modal-close" onclick="closeSubmitModal()">✕</button>
      </div>
      <p style="color:var(--muted);font-size:13px;margin-bottom:18px;">${esc(assignmentTitle)}</p>

      <!-- TEXT ANSWER -->
      <div class="field-group" style="margin-bottom:14px;">
        <label style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;display:block;margin-bottom:6px;">Text Answer (optional)</label>
        <textarea id="submitTextContent" placeholder="Type your answer here..."
          style="width:100%;padding:12px;border-radius:10px;border:1.5px solid var(--border);font-family:'DM Sans',sans-serif;font-size:14px;min-height:100px;resize:vertical;"></textarea>
      </div>

      <!-- FILE UPLOAD -->
      <div class="field-group" style="margin-bottom:18px;">
        <label style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;display:block;margin-bottom:6px;">Upload File (optional — PDF, DOC, ZIP, max 20MB)</label>
        <input type="file" id="submitFile" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip,.rar"
          style="width:100%;padding:10px;border-radius:10px;border:1.5px solid var(--border);font-size:13px;">
      </div>

      <p style="font-size:12px;color:var(--muted);margin-bottom:16px;">You must provide either a text answer or a file (or both).</p>

      <div class="modal-actions">
        <button class="btn btn-primary btn-full" onclick="submitAssignment(${assignmentId})">
          ${isUpdate?"🔄 Update Submission":"📤 Submit"}
        </button>
        <button class="btn btn-outline" onclick="closeSubmitModal()">Cancel</button>
      </div>
      <div id="submitMsg" class="msg" style="margin-top:12px;"></div>
    </div>`;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add("open"), 10);
}

function closeSubmitModal() { document.getElementById("submitAssignModal")?.remove(); }

function submitAssignment(assignmentId) {
  const textContent = document.getElementById("submitTextContent")?.value?.trim() || "";
  const fileEl      = document.getElementById("submitFile");
  const msg         = document.getElementById("submitMsg");
  const file        = fileEl?.files?.[0] || null;

  if (!textContent && !file) {
    showMsg(msg, "error", "⚠️ Please provide a text answer or upload a file");
    return;
  }

  showMsg(msg, "success", "⏳ Submitting...");

  const formData = new FormData();
  formData.append("assignment_id", assignmentId);
  if (textContent) formData.append("text_content", textContent);
  if (file) formData.append("file", file);

  fetch("/courses/submit-assignment", {
    method: "POST",
    credentials: "include",
    body: formData
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ " + (d.message || "Submitted successfully!"));
      setTimeout(() => {
        closeSubmitModal();
        loadMyEnrollments(); /* refresh pending count */
      }, 1500);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Submission failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error — please try again"));
}

/* ── ENROLL MODAL ── */
function openEnrollModal() { document.getElementById("enrollKeyModal")?.classList.add("open"); }
function closeEnrollModal() {
  document.getElementById("enrollKeyModal")?.classList.remove("open");
  const inp = document.getElementById("enrollKeyInput"); if (inp) inp.value = "";
  const msg = document.getElementById("enrollKeyMsg");   if (msg) { msg.className="msg"; msg.innerText=""; }
}

function enrollByKey() {
  const input = document.getElementById("enrollKeyInput");
  const msg   = document.getElementById("enrollKeyMsg");
  const key   = (input?.value||"").trim().toUpperCase();
  if (!key) { showMsg(msg,"error","⚠️ Enter an enrollment key"); return; }
  showMsg(msg,"success","⏳ Enrolling…");
  fetch("/courses/enroll-by-key",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({enrollment_key:key})})
  .then(r=>r.json())
  .then(d=>{
    if(d.success){showMsg(msg,"success",`✅ Enrolled in "${d.course_name}"!`);setTimeout(()=>{closeEnrollModal();loadMyEnrollments();if(allCourses.length)loadBrowseCourses();},1200);}
    else showMsg(msg,"error","❌ "+(d.message||"Invalid key"));
  }).catch(()=>showMsg(msg,"error","❌ Network error"));
}

/* ── UNENROLL ── */
function unenroll(event, courseId, courseName) {
  if (event) event.stopPropagation();
  if (!confirm(`⚠️ Leave course "${courseName}"?\n\nYour attendance history will be preserved.`)) return;
  fetch("/courses/unenroll",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({course_id:courseId})})
  .then(r=>r.json())
  .then(d=>{if(d.success){loadMyEnrollments();if(allCourses.length)loadBrowseCourses();}else alert("❌ "+(d.message||"Could not unenroll"));})
  .catch(()=>alert("❌ Network error"));
}

/* ── CLOSE OVERLAY ON CLICK ── */
document.addEventListener("click", e => { if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open"); });

/* ── UTILITIES ── */
function showMsg(el, type, text) { if (!el) return; el.className = "msg " + type; el.innerText = text; }
function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}