/* ============================================================
   COMMON ACADEMICS MODULE — public/common/academics/academics.js
============================================================ */

const Academics = (() => {

  // ✅ FIXED: Added noteId parameter
  function loadAttendance(barId, labelId, noteId) {
    fetch("/dashboard/academic/attendance", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const pct = d.attendance || 0;
        
        if (labelId && document.getElementById(labelId)) {
          document.getElementById(labelId).innerText = pct + "%";
        }
        
        if (barId && document.getElementById(barId)) {
          document.getElementById(barId).style.width = pct + "%";
        }
        
        // ✅ NEW: Support attendance note
        if (noteId && document.getElementById(noteId)) {
          const noteEl = document.getElementById(noteId);
          if (pct >= 75) {
            noteEl.innerText = "✅ Attendance is good — keep it up!";
            noteEl.style.color = "#22c55e";
          } else {
            noteEl.innerText = "⚠️ Below 75% — try to improve attendance";
            noteEl.style.color = "#ef4444";
          }
        }
      })
      .catch(err => {
        console.error("Attendance load error:", err);
        if (labelId) {
          const el = document.getElementById(labelId);
          if (el) el.innerText = "N/A";
        }
      });
  }

  function loadAssignments(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    
    el.innerHTML = `<li style="color:var(--muted);">Loading...</li>`;
    
    fetch("/dashboard/academic/assignments", { credentials: "include" })
      .then(r => r.json())
      .then(rows => {
        if (!rows.length) { 
          el.innerHTML = `<li style="color:var(--muted);">No upcoming assignments</li>`; 
          return; 
        }
        el.innerHTML = rows.map(a =>
          `<li style="padding:8px 0; border-bottom:1px solid var(--border); font-size:14px;">
            📝 <strong>${escapeHtml(a.title)}</strong>
            ${a.subject ? `<span style="color:var(--muted); font-size:13px;"> · ${escapeHtml(a.subject)}</span>` : ""}
            <span style="float:right; font-size:12px; color:var(--muted);">
              Due: ${a.due_date ? a.due_date.slice(0,10) : "—"}
            </span>
           </li>`
        ).join("");
      })
      .catch(err => {
        console.error("Assignments load error:", err);
        el.innerHTML = `<li style="color:red;">Failed to load assignments</li>`;
      });
  }

  function loadExams(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    
    el.innerHTML = `<li style="color:var(--muted);">Loading...</li>`;
    
    fetch("/dashboard/academic/exams", { credentials: "include" })
      .then(r => r.json())
      .then(rows => {
        if (!rows.length) { 
          el.innerHTML = `<li style="color:var(--muted);">No upcoming exams</li>`; 
          return; 
        }
        el.innerHTML = rows.map(e =>
          `<li style="padding:8px 0; border-bottom:1px solid var(--border); font-size:14px;">
            🧪 <strong>${escapeHtml(e.subject)}</strong>
            ${e.exam_type ? `<span style="color:var(--muted); font-size:12px;"> · ${escapeHtml(e.exam_type)}</span>` : ""}
            <span style="float:right; font-size:12px; color:var(--muted);">
              ${e.exam_date ? e.exam_date.slice(0,10) : "—"}
            </span>
           </li>`
        ).join("");
      })
      .catch(err => {
        console.error("Exams load error:", err);
        el.innerHTML = `<li style="color:red;">Failed to load exams</li>`;
      });
  }

  function loadGrades(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    
    el.innerHTML = `<p style="color:var(--muted);">Loading...</p>`;
    
    fetch("/dashboard/academic/grades", { credentials: "include" })
      .then(r => r.json())
      .then(rows => {
        if (!rows.length) { 
          el.innerHTML = `<p style="color:var(--muted);">No grades recorded yet</p>`; 
          return; 
        }
        const colors = { 
          A: "#22c55e", 
          B: "#6366f1", 
          C: "#f59e0b", 
          D: "#f97316", 
          F: "#ef4444" 
        };
        el.innerHTML = `<div style="display:flex; flex-wrap:wrap; gap:12px;">` +
          rows.map(g =>
            `<div style="padding:14px 20px; border-radius:14px; text-align:center; 
              background:${colors[g.grade] || "#6b7280"}22; 
              border:2px solid ${colors[g.grade] || "#6b7280"};">
              <p style="font-size:28px; font-weight:800; color:${colors[g.grade] || "#6b7280"};">${g.grade}</p>
              <p style="font-size:13px; color:var(--muted); margin-top:4px;">${escapeHtml(g.subject || "—")}</p>
             </div>`
          ).join("") + `</div>`;
      })
      .catch(err => {
        console.error("Grades load error:", err);
        el.innerHTML = `<p style="color:red;">Failed to load grades</p>`;
      });
  }

  function loadPerformance(labelId) {
    const el = document.getElementById(labelId);
    if (!el) return;
    
    el.innerHTML = `Loading...`;
    
    fetch("/dashboard/academic/performance", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const perfColors = {
          "Excellent": "#22c55e", 
          "Good": "#6366f1",
          "Average": "#f59e0b", 
          "Needs Improvement": "#ef4444", 
          "N/A": "#6b7280"
        };
        const color = perfColors[d.performance] || "#6b7280";
        el.innerHTML =
          `<span style="font-size:22px; font-weight:800; color:${color};">${d.performance}</span>` +
          `<span style="color:var(--muted); font-size:15px; margin-left:10px;">GPA: ${d.gpa}</span>`;
      })
      .catch(err => {
        console.error("Performance load error:", err);
        el.innerText = "Could not load performance";
      });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return { 
    loadAttendance, 
    loadAssignments, 
    loadExams, 
    loadGrades, 
    loadPerformance 
  };
})();

window.Academics = Academics;