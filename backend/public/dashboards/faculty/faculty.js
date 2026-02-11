/* =========================
   FACULTY DASHBOARD JS
========================= */

document.addEventListener("DOMContentLoaded", () => {

  // Load dashboard summary data (only runs on dashboard page)
  if (document.getElementById("totalStudents")) {
    loadDashboardData();
    loadAnalytics();
  }

});

/* --- DASHBOARD SUMMARY --- */
function loadDashboardData() {
  fetch("/faculty/data", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (document.getElementById("greetingText")) {
        document.getElementById("greetingText").innerText = `Welcome, ${data.name} 👋`;
      }
      document.getElementById("totalStudents").innerText = data.totalStudents || 0;
      document.getElementById("totalAssignments").innerText = data.totalAssignments || 0;
      document.getElementById("totalExams").innerText = data.totalExams || 0;
      document.getElementById("totalGrades").innerText = data.totalGrades || 0;
    })
    .catch(err => console.error("FACULTY DATA ERROR:", err));
}

/* --- ANALYTICS --- */
function loadAnalytics() {
  fetch("/faculty/analytics", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      const pct = data.avgAttendance || 0;
      if (document.getElementById("avgAttendance")) {
        document.getElementById("avgAttendance").innerText = pct + "%";
      }
      if (document.getElementById("attendanceBar")) {
        document.getElementById("attendanceBar").style.width = pct + "%";
      }

      // Grade distribution
      const gradeEl = document.getElementById("gradeDistribution");
      if (gradeEl && data.gradeDistribution?.length) {
        const colors = { A: "#22c55e", B: "#6366f1", C: "#f59e0b", D: "#f97316", F: "#ef4444" };
        gradeEl.innerHTML = data.gradeDistribution.map(g => `
          <div style="text-align:center; padding:14px 20px; border-radius:14px;
            background:${colors[g.grade] || "#6b7280"}22; border:2px solid ${colors[g.grade] || "#6b7280"};">
            <p style="font-size:26px; font-weight:800; color:${colors[g.grade] || "#6b7280"};">${g.grade}</p>
            <p style="font-size:13px; color:var(--muted);">${g.count} students</p>
          </div>
        `).join("");
      } else if (gradeEl) {
        gradeEl.innerHTML = `<p style="color:var(--muted);">No grade data yet</p>`;
      }
    });
}

/* --- TOGGLE SECTION (for quick action cards) --- */
function showSection(id) {
  const allSections = ["addAssignment", "addExam"];
  allSections.forEach(s => {
    const el = document.getElementById(s);
    if (el) {
      el.style.display = (s === id && el.style.display === "none") ? "block" : "none";
    }
  });
}

/* --- ADD ASSIGNMENT (from dashboard quick action) --- */
function addAssignment() {
  const title = document.getElementById("aTitle")?.value;
  const subject = document.getElementById("aSubject")?.value;
  const description = document.getElementById("aDesc")?.value;
  const due_date = document.getElementById("aDueDate")?.value;
  const msg = document.getElementById("assignmentMsg");

  if (!title || !due_date) {
    if (msg) { msg.style.color = "red"; msg.innerText = "Title and due date required"; }
    return;
  }

  fetch("/faculty/assignment/add", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, subject, description, due_date })
  })
  .then(r => r.json())
  .then(d => {
    if (msg) {
      msg.style.color = d.success ? "green" : "red";
      msg.innerText = d.success ? "✅ Assignment added!" : (d.message || "Failed");
    }
    if (d.success) loadDashboardData();
  });
}

/* --- ADD EXAM (from dashboard quick action) --- */
function addExam() {
  const subject = document.getElementById("eSubject")?.value;
  const exam_date = document.getElementById("eDate")?.value;
  const exam_type = document.getElementById("eType")?.value;
  const msg = document.getElementById("examMsg");

  if (!subject || !exam_date) {
    if (msg) { msg.style.color = "red"; msg.innerText = "Subject and date required"; }
    return;
  }

  fetch("/faculty/exam/add", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, exam_date, exam_type })
  })
  .then(r => r.json())
  .then(d => {
    if (msg) {
      msg.style.color = d.success ? "green" : "red";
      msg.innerText = d.success ? "✅ Exam scheduled!" : (d.message || "Failed");
    }
    if (d.success) loadDashboardData();
  });
}