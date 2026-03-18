"use strict";

/* =========================
   FACULTY ACADEMICS PAGE JS
   — loads faculty's own courses into dropdowns
========================= */

document.addEventListener("DOMContentLoaded", () => {
  loadCourseDropdowns();   // ← populate course selects first
  loadAssignments();
  loadExams();
});

/* ─────────────────────────────────────────
   LOAD FACULTY'S OWN COURSES INTO DROPDOWNS
───────────────────────────────────────── */
function loadCourseDropdowns() {
  fetch("/faculty/courses/my", { credentials: "include" })
    .then(r => r.json())
    .then(courses => {
      const noteEl = document.getElementById("aCourseNote");

      if (!courses.length) {
        if (noteEl) {
          noteEl.innerHTML =
            '⚠️ No courses yet — <a href="/faculty/attendance" ' +
            'style="color:var(--primary);font-weight:600;">create one first</a> ' +
            'in the Attendance → Manage Courses tab.';
        }
        return;
      }

      if (noteEl) noteEl.innerText = `${courses.length} course${courses.length !== 1 ? "s" : ""} available`;

      const opts = courses.map(c =>
        `<option value="${c.id}">${esc(c.name)}${c.code ? " (" + esc(c.code) + ")" : ""}${c.semester ? " · Sem " + c.semester : ""}</option>`
      ).join("");

      // Populate both dropdowns
      ["aCourse", "eCourse"].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
          sel.innerHTML = '<option value="">— Select a course (optional) —</option>' + opts;
        }
      });
    })
    .catch(() => {
      const noteEl = document.getElementById("aCourseNote");
      if (noteEl) noteEl.innerText = "Could not load courses.";
    });
}

/* ─────────────────────────────────────────
   ASSIGNMENTS
───────────────────────────────────────── */
function addAssignment() {
  const title     = document.getElementById("aTitle").value.trim();
  const subject   = document.getElementById("aSubject").value.trim();
  const course_id = document.getElementById("aCourse").value || null;
  const desc      = document.getElementById("aDesc").value.trim();
  const due_date  = document.getElementById("aDueDate").value;
  const msg       = document.getElementById("aMsg");

  if (!title) {
    showMsg(msg, "red", "⚠️ Title is required");
    return;
  }
  if (!due_date) {
    showMsg(msg, "red", "⚠️ Due date is required");
    return;
  }

  showMsg(msg, "#6366f1", "⏳ Saving...");

  fetch("/faculty/assignment/add", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, subject, description: desc, due_date, course_id })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "#16a34a", "✅ Assignment added!");
      // Clear fields
      ["aTitle", "aSubject", "aDesc", "aDueDate"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      document.getElementById("aCourse").value = "";
      loadAssignments();
      setTimeout(() => { msg.innerText = ""; }, 3000);
    } else {
      showMsg(msg, "#dc2626", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "#dc2626", "❌ Network error"));
}

function loadAssignments() {
  fetch("/faculty/assignments/list", { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      const el    = document.getElementById("assignmentList");
      const badge = document.getElementById("assignCountBadge");
      if (badge) badge.innerText = rows.length;

      if (!rows.length) {
        el.innerHTML = "<p style='color:var(--muted); font-style:italic;'>No assignments yet</p>";
        return;
      }

      el.innerHTML = rows.map(a => `
        <div style="padding:14px; border-radius:12px; background:var(--bg);
          border-left:4px solid var(--primary);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <strong style="font-size:14px;">${esc(a.title)}</strong>
            <span style="font-size:11px; color:var(--muted); white-space:nowrap;">
              Due: ${a.due_date ? a.due_date.slice(0,10) : "—"}
            </span>
          </div>
          <p style="font-size:13px; color:var(--muted); margin-top:4px;">
            📘 ${esc(a.subject || "No subject")}
            ${a.course_name ? ` · 📚 ${esc(a.course_name)}` : ""}
          </p>
          ${a.description
            ? `<p style="font-size:13px; color:var(--text); margin-top:6px;">${esc(a.description)}</p>`
            : ""}
        </div>
      `).join("");
    })
    .catch(() => {});
}

/* ─────────────────────────────────────────
   EXAMS
───────────────────────────────────────── */
function addExam() {
  const subject   = document.getElementById("eSubject").value.trim();
  const course_id = document.getElementById("eCourse").value || null;
  const exam_date = document.getElementById("eDate").value;
  const exam_type = document.getElementById("eType").value;
  const msg       = document.getElementById("eMsg");

  if (!subject) {
    showMsg(msg, "red", "⚠️ Subject is required");
    return;
  }
  if (!exam_date) {
    showMsg(msg, "red", "⚠️ Exam date is required");
    return;
  }

  showMsg(msg, "#6366f1", "⏳ Scheduling...");

  fetch("/faculty/exam/add", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, exam_date, exam_type, course_id })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "#16a34a", "✅ Exam scheduled!");
      ["eSubject", "eDate"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      document.getElementById("eCourse").value = "";
      loadExams();
      setTimeout(() => { msg.innerText = ""; }, 3000);
    } else {
      showMsg(msg, "#dc2626", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "#dc2626", "❌ Network error"));
}

function loadExams() {
  fetch("/faculty/exams/list", { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      const el    = document.getElementById("examList");
      const badge = document.getElementById("examCountBadge");
      if (badge) badge.innerText = rows.length;

      if (!rows.length) {
        el.innerHTML = "<p style='color:var(--muted); font-style:italic;'>No exams scheduled</p>";
        return;
      }

      el.innerHTML = rows.map(e => {
        const isUpcoming = e.exam_date && new Date(e.exam_date) >= new Date();
        return `
          <div style="padding:14px; border-radius:12px; background:var(--bg);
            border-left:4px solid ${isUpcoming ? "var(--secondary)" : "var(--muted)"};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <strong style="font-size:14px;">${esc(e.subject)}</strong>
              ${isUpcoming
                ? `<span style="background:#fef3c7; color:#92400e; font-size:11px;
                     font-weight:700; padding:2px 8px; border-radius:20px;">Upcoming</span>`
                : `<span style="background:#f3f4f6; color:var(--muted); font-size:11px;
                     font-weight:700; padding:2px 8px; border-radius:20px;">Past</span>`}
            </div>
            <p style="font-size:13px; color:var(--muted); margin-top:4px;">
              ${esc(e.exam_type || "Regular")} · 📅 ${e.exam_date ? e.exam_date.slice(0,10) : "—"}
              ${e.course_name ? ` · 📚 ${esc(e.course_name)}` : ""}
            </p>
          </div>`;
      }).join("");
    })
    .catch(() => {});
}

/* ─────────────────────────────────────────
   UTILITIES
───────────────────────────────────────── */
function showMsg(el, color, text) {
  if (!el) return;
  el.style.color = color;
  el.innerText   = text;
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}