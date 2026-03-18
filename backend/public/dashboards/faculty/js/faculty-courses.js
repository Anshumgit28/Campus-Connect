"use strict";
/* ============================================================
   faculty-courses.js — Course list page for faculty
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  loadAvatar();
  loadCourses();
});

function loadAvatar() {
  fetch("/faculty/data", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById("avatarLetter");
      if (el) el.innerText = (d.name || "F")[0].toUpperCase();
    }).catch(() => {});
}

/* ── LOAD COURSES ── */
function loadCourses() {
  fetch("/faculty/courses/my", { credentials: "include" })
    .then(r => r.json())
    .then(courses => {
      const el = document.getElementById("coursesGrid");
      if (!courses.length) {
        el.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <span class="empty-icon">🎓</span>
            <p style="margin-bottom:16px;">No courses yet. Create your first course!</p>
            <button class="btn btn-primary" onclick="openCreateModal()">➕ Create Course</button>
          </div>`;
        return;
      }
      el.innerHTML = courses.map(c => renderCourseCard(c)).join("");
    })
    .catch(() => {});
}

function renderCourseCard(c) {
  return `
    <div class="course-card" onclick="openCourse(${c.id}, '${esc(c.name)}')">
      <div class="course-card-top">
        <div class="course-card-code">${esc(c.code || 'COURSE')}</div>
        <div class="course-card-name">${esc(c.name)}</div>
        <div class="course-card-sem">${c.semester ? 'Semester ' + c.semester : 'All Semesters'}</div>
      </div>
      <div class="course-card-body">
        <div class="course-stats">
          <div class="course-stat">
            <div class="course-stat-num">${c.batch_count || 0}</div>
            <div class="course-stat-label">Batches</div>
          </div>
          <div class="course-stat">
            <div class="course-stat-num">${c.enrolled_count || 0}</div>
            <div class="course-stat-label">Students</div>
          </div>
          <div class="course-stat">
            <div class="course-stat-num">${c.assignment_count || 0}</div>
            <div class="course-stat-label">Assignments</div>
          </div>
        </div>

        ${c.enrollment_key ? `
        <div class="enrollment-key-row" onclick="event.stopPropagation()">
          <div>
            <div class="enrollment-key-label">🔑 Enrollment Key</div>
            <div class="enrollment-key-value">${esc(c.enrollment_key)}</div>
          </div>
          <button class="copy-key-btn" onclick="copyKey('${esc(c.enrollment_key)}')" title="Copy key">📋</button>
        </div>` : ""}

        <div class="course-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-primary btn-sm" style="flex:1;" onclick="openCourse(${c.id}, '${esc(c.name)}')">
            📂 Manage
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteCourse(${c.id}, '${esc(c.name)}')">
            🗑
          </button>
        </div>
      </div>
    </div>`;
}

function openCourse(id, name) {
  window.location.href = `/faculty/course?id=${id}`;
}

function copyKey(key) {
  navigator.clipboard.writeText(key).then(() => {
    showToast(`Key "${key}" copied!`);
  }).catch(() => {
    prompt("Copy this enrollment key:", key);
  });
}

function showToast(msg) {
  const t = document.createElement("div");
  t.style.cssText = "position:fixed;bottom:24px;right:24px;background:#065f46;color:white;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.2);animation:slideUp .2s ease;";
  t.innerText = "✅ " + msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

/* ── CREATE COURSE ── */
function openCreateModal() {
  document.getElementById("createModal").classList.add("open");
  generateKeyPreview();
}

function closeCreateModal() {
  document.getElementById("createModal").classList.remove("open");
}

function generateKeyPreview() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let i = 0; i < 8; i++) key += chars[Math.floor(Math.random() * chars.length)];
  const el = document.getElementById("keyPreview");
  if (el) el.innerText = key;
}

function createCourse() {
  const name = (document.getElementById("cName")?.value || "").trim();
  const code = (document.getElementById("cCode")?.value || "").trim();
  const sem  = document.getElementById("cSem")?.value || "";
  const desc = (document.getElementById("cDesc")?.value || "").trim();
  const msg  = document.getElementById("createCourseMsg");

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
      showMsg(msg, "success", "✅ Course created!");
      ["cName","cCode","cDesc"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
      document.getElementById("cSem").value = "";
      setTimeout(() => {
        closeCreateModal();
        loadCourses();
        if (msg) msg.style.display = "none";
      }, 1000);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

function deleteCourse(id, name) {
  if (!confirm(`Delete course "${name}"?\n\nThis will also delete all batches, assignments, and attendance sessions. This cannot be undone.`)) return;

  fetch("/faculty/courses/delete", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course_id: id })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showToast("Course deleted");
      loadCourses();
    } else {
      alert("❌ " + (d.message || "Delete failed"));
    }
  })
  .catch(() => alert("❌ Network error"));
}

/* ── UTILITIES ── */
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