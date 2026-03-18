"use strict";

/* =========================
   FACULTY STUDENTS PAGE JS
========================= */

document.addEventListener("DOMContentLoaded", () => {
  loadStudents();
  loadPerformance();
});

function showTab(tab) {
  ["listTab", "perfTab", "attendTab", "gradeTab"].forEach(t => {
    document.getElementById(t).style.display = "none";
    document.getElementById("btn-" + t).style.background = "white";
    document.getElementById("btn-" + t).style.border = "1px solid var(--border)";
    document.getElementById("btn-" + t).style.color = "var(--text)";
  });
  document.getElementById(tab).style.display = "block";
  document.getElementById("btn-" + tab).style.background = "var(--primary)";
  document.getElementById("btn-" + tab).style.border = "none";
  document.getElementById("btn-" + tab).style.color = "white";
}

let allStudents = [];

function loadStudents() {
  fetch("/faculty/students/list", { credentials: "include" })
    .then(r => r.json())
    .then(students => {
      allStudents = students;
      renderStudentList(students);
      populateStudentDropdowns(students);
    });
}

function renderStudentList(students) {
  const el = document.getElementById("studentList");
  if (!students.length) { 
    el.innerHTML = "<p>No students found</p>"; 
    return; 
  }
  
  el.innerHTML = students.map(s => `
    <div class="student-profile-card card" style="margin:0; padding:18px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <strong style="font-size:16px;">${s.username}</strong>
          <p style="color:var(--muted); font-size:13px; margin-top:4px;">${s.email}</p>
        </div>
        <div style="display:flex; gap:20px; font-size:13px; color:var(--muted);">
          <span>PRN: <strong>${s.prn || "—"}</strong></span>
          <span>Class: <strong>${s.class_name || "—"}</strong></span>
          <span>Year: <strong>${s.current_year || "—"}</strong></span>
        </div>
      </div>
    </div>
  `).join("");
}

function filterStudents() {
  const q = document.getElementById("searchStudent").value.toLowerCase();
  const filtered = allStudents.filter(s =>
    (s.username || "").toLowerCase().includes(q) ||
    (s.prn || "").toLowerCase().includes(q) ||
    (s.class_name || "").toLowerCase().includes(q)
  );
  renderStudentList(filtered);
}

function populateStudentDropdowns(students) {
  const opts = students.map(s => 
    `<option value="${s.id}">${s.username} (${s.prn || s.id})</option>`
  ).join("");
  
  document.getElementById("attStudent").innerHTML = 
    `<option value="">Select Student</option>${opts}`;
  document.getElementById("gradeStudent").innerHTML = 
    `<option value="">Select Student</option>${opts}`;
}

function loadPerformance() {
  fetch("/faculty/students/performance", { credentials: "include" })
    .then(r => r.json())
    .then(rows => {
      const tbody = document.getElementById("perfTableBody");
      if (!rows.length) { 
        tbody.innerHTML = `<tr><td colspan="5" style="padding:12px;color:var(--muted);">No data</td></tr>`; 
        return; 
      }
      
      tbody.innerHTML = rows.map(r => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px;">${r.username}</td>
          <td style="padding:12px;">${r.prn || "—"}</td>
          <td style="padding:12px;">${r.class_name || "—"}</td>
          <td style="padding:12px;">
            <strong style="color:var(--primary);">${r.gpa || "N/A"}</strong>
          </td>
          <td style="padding:12px;">
            <span style="font-weight:700; color:${(r.attendance||0) >= 75 ? '#22c55e' : '#ef4444'};">
              ${r.attendance || 0}%
            </span>
          </td>
        </tr>
      `).join("");
    });
}

function updateAttendance() {
  const user_id = document.getElementById("attStudent").value;
  const attended = document.getElementById("attAttended").value;
  const total = document.getElementById("attTotal").value;
  const subject = document.getElementById("attSubject").value;
  const date = document.getElementById("attDate").value;

  if (!user_id || !attended || !total) {
    const msg = document.getElementById("attendMsg");
    msg.style.color = "red";
    msg.innerText = "Please fill all fields";
    return;
  }

  fetch("/faculty/attendance/update", {
    method: "POST", 
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      user_id, 
      attended: parseInt(attended), 
      total: parseInt(total), 
      subject, 
      date 
    })
  })
  .then(r => r.json())
  .then(d => {
    const msg = document.getElementById("attendMsg");
    msg.style.color = d.success ? "green" : "red";
    msg.innerText = d.success ? "✅ Attendance updated!" : (d.message || "Failed");
  });
}

function enterGrade() {
  const user_id = document.getElementById("gradeStudent").value;
  const subject = document.getElementById("gradeSubject").value;
  const grade = document.getElementById("gradeValue").value;

  if (!user_id || !subject || !grade) {
    const msg = document.getElementById("gradeMsg");
    msg.style.color = "red";
    msg.innerText = "Please fill all fields";
    return;
  }

  fetch("/faculty/grade/add", {
    method: "POST", 
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, subject, grade })
  })
  .then(r => r.json())
  .then(d => {
    const msg = document.getElementById("gradeMsg");
    msg.style.color = d.success ? "green" : "red";
    msg.innerText = d.success ? "✅ Grade saved!" : (d.message || "Failed");
  });
}