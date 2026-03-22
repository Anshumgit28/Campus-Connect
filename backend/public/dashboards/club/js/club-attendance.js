"use strict";
/* ============================================================
   club-attendance.js — Club Meeting Attendance Management
============================================================ */

let currentMeetingId = null;
let memberAttendance = {}; // { userId: 'present'|'late'|'absent' }
let allMembers = [];

document.addEventListener("DOMContentLoaded", () => {
  loadClubInfo();
  loadMeetings();
  loadMemberReport();

  // Set default date to today
  const d = document.getElementById("meetingDate");
  if (d) d.value = new Date().toISOString().split("T")[0];
});

/* ── INIT ── */
function loadClubInfo() {
  fetch("/club/data", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById("avatarLetter");
      if (el) el.innerText = (d.name || "C")[0].toUpperCase();
    }).catch(() => {});
}

/* ── TABS ── */
function showTab(tab, btn) {
  document.querySelectorAll("[id^='tab-']").forEach(el => el.style.display = "none");
  document.getElementById("tab-" + tab).style.display = "block";
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  if (tab === "members") loadMemberReport();
}

/* ── LOAD MEETINGS ── */
function loadMeetings() {
  const tbody = document.getElementById("meetingsTableBody");
  tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Loading...</td></tr>`;

  fetch("/club/attendance/meetings", { credentials: "include" })
    .then(r => r.json())
    .then(meetings => {
      // Update stats
      document.getElementById("statMeetings").innerText = meetings.length;

      if (!meetings.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No meetings yet. Create your first one!</td></tr>`;
        return;
      }

      const avgArr = meetings.filter(m => m.total > 0).map(m => Math.round((m.present + m.late) / m.total * 100));
      const avg = avgArr.length ? Math.round(avgArr.reduce((a, b) => a + b, 0) / avgArr.length) : 0;
      document.getElementById("statAvgAtt").innerText = avg + "%";

      tbody.innerHTML = meetings.map(m => {
        const total = m.total || 0;
        const present = m.present || 0;
        const late = m.late || 0;
        const absent = m.absent || 0;
        const pct = total ? Math.round((present + late) / total * 100) : 0;
        const cls = pct >= 75 ? "badge-green" : pct >= 50 ? "badge-amber" : "badge-red";

        return `
          <tr>
            <td style="font-weight:600;">${m.meeting_date ? m.meeting_date.slice(0,10) : "—"}</td>
            <td>
              <div style="font-weight:600;">${esc(m.title)}</div>
              ${m.description ? `<div style="font-size:12px;color:var(--muted);">${esc(m.description.slice(0,60))}</div>` : ""}
            </td>
            <td><span class="badge badge-green">${present}</span></td>
            <td><span class="badge badge-amber">${late}</span></td>
            <td><span class="badge badge-red">${absent}</span></td>
            <td><span class="badge ${cls}">${pct}%</span></td>
            <td>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-primary btn-sm" onclick="openMarkAttModal(${m.id}, '${esc(m.title)}', '${m.meeting_date ? m.meeting_date.slice(0,10) : ""}')">
                  ✅ Mark
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteMeeting(${m.id})">🗑</button>
              </div>
            </td>
          </tr>`;
      }).join("");
    })
    .catch(() => {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty" style="color:var(--red);">Failed to load meetings</td></tr>`;
    });
}

/* ── LOAD MEMBER REPORT ── */
function loadMemberReport() {
  fetch("/club/attendance/member-report", { credentials: "include" })
    .then(r => r.json())
    .then(members => {
      document.getElementById("statMembers").innerText = members.length;

      if (members.length > 0) {
        const best = members.reduce((a, b) => (b.pct > a.pct ? b : a));
        document.getElementById("statBest").innerText = best.pct + "%";
        document.getElementById("statBestName").innerText = best.username;
      }

      const tbody = document.getElementById("memberReportBody");
      if (!members.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No member attendance data yet</td></tr>`;
        return;
      }

      tbody.innerHTML = members.map(m => {
        const cls = m.pct >= 75 ? "badge-green" : m.pct >= 50 ? "badge-amber" : "badge-red";
        const statusLabel = m.pct >= 75 ? "Good" : m.pct >= 50 ? "Needs Attention" : "Critical";
        return `
          <tr>
            <td><div style="font-weight:600;">${esc(m.username)}</div><div style="font-size:12px;color:var(--muted);">${esc(m.email||"")}</div></td>
            <td>${esc(m.class_name || "—")}</td>
            <td><span class="badge badge-green">${m.present || 0}</span></td>
            <td><span class="badge badge-amber">${m.late || 0}</span></td>
            <td><span class="badge badge-red">${m.absent || 0}</span></td>
            <td><span class="badge ${cls}">${m.pct || 0}%</span></td>
            <td><span class="badge ${cls}">${statusLabel}</span></td>
          </tr>`;
      }).join("");
    })
    .catch(() => {});
}

/* ── CREATE MEETING ── */
function openCreateMeetingModal() {
  document.getElementById("meetingTitle").value = "";
  document.getElementById("meetingDesc").value = "";
  document.getElementById("meetingDate").value = new Date().toISOString().split("T")[0];
  const msg = document.getElementById("createMeetingMsg");
  msg.className = "msg"; msg.innerText = "";
  openModal("createMeetingModal");
}

function createMeeting() {
  const title = document.getElementById("meetingTitle").value.trim();
  const date  = document.getElementById("meetingDate").value;
  const desc  = document.getElementById("meetingDesc").value.trim();
  const msg   = document.getElementById("createMeetingMsg");

  if (!title) { showMsg(msg, "error", "⚠️ Meeting title is required"); return; }
  if (!date)  { showMsg(msg, "error", "⚠️ Date is required"); return; }

  showMsg(msg, "info", "⏳ Creating meeting...");

  fetch("/club/attendance/meeting/create", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, meeting_date: date, description: desc })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Meeting created!");
      setTimeout(() => {
        closeModal("createMeetingModal");
        loadMeetings();
        openMarkAttModal(d.meeting_id, title, date);
      }, 800);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

/* ── MARK ATTENDANCE MODAL ── */
function openMarkAttModal(meetingId, title, date) {
  currentMeetingId = meetingId;
  memberAttendance = {};
  document.getElementById("markAttSubtitle").innerText = `${title} — ${date}`;
  document.getElementById("memberAttList").innerHTML =
    `<p style="color:var(--muted);text-align:center;padding:20px;">Loading members...</p>`;
  openModal("markAttModal");

  // Load existing attendance (if re-marking)
  Promise.all([
    fetch("/club/members/list", { credentials: "include" }).then(r => r.json()),
    fetch(`/club/attendance/meeting/${meetingId}`, { credentials: "include" }).then(r => r.json())
  ]).then(([members, existing]) => {
    allMembers = members;

    // Pre-fill existing
    existing.forEach(e => { memberAttendance[e.user_id] = e.status; });
    // Default absent for rest
    members.forEach(m => {
      if (!memberAttendance[m.uc_id]) memberAttendance[m.uc_id] = "absent";
    });

    renderMemberAttList();
    updateSummary();
  }).catch(() => {});
}

function renderMemberAttList() {
  const el = document.getElementById("memberAttList");
  if (!allMembers.length) {
    el.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px;">No approved members yet.</p>`;
    return;
  }

  el.innerHTML = allMembers.map(m => {
    const status = memberAttendance[m.uc_id] || "absent";
    return `
      <div class="item-row" id="att-row-${m.uc_id}">
        <div>
          <div style="font-weight:600;font-size:14px;">${esc(m.username)}</div>
          <div style="font-size:12px;color:var(--muted);">${esc(m.email || "")} ${m.class_name ? "· " + m.class_name : ""}</div>
        </div>
        <div class="att-toggle">
          <button class="att-btn ${status === "present" ? "active-present" : ""}" onclick="setStatus(${m.uc_id}, 'present', this)">✅</button>
          <button class="att-btn ${status === "late"    ? "active-late"    : ""}" onclick="setStatus(${m.uc_id}, 'late', this)">⏰</button>
          <button class="att-btn ${status === "absent"  ? "active-absent"  : ""}" onclick="setStatus(${m.uc_id}, 'absent', this)">❌</button>
        </div>
      </div>`;
  }).join("");
}

function setStatus(userId, status, btn) {
  memberAttendance[userId] = status;
  const row = document.getElementById("att-row-" + userId);
  if (row) row.querySelectorAll(".att-btn").forEach(b => b.className = "att-btn");
  btn.className = "att-btn active-" + status;
  updateSummary();
}

function markAllAs(status) {
  allMembers.forEach(m => { memberAttendance[m.uc_id] = status; });
  renderMemberAttList();
  updateSummary();
}

function updateSummary() {
  const vals = Object.values(memberAttendance);
  const present = vals.filter(v => v === "present").length;
  const late    = vals.filter(v => v === "late").length;
  const absent  = vals.filter(v => v === "absent").length;
  document.getElementById("attSummary").innerHTML = `
    <span class="summary-chip badge-green">✅ ${present} Present</span>
    <span class="summary-chip badge-amber">⏰ ${late} Late</span>
    <span class="summary-chip badge-red">❌ ${absent} Absent</span>`;
}

function saveAttendance() {
  const msg = document.getElementById("markAttMsg");
  const records = Object.entries(memberAttendance).map(([user_id, status]) => ({
    user_id: parseInt(user_id), status
  }));

  if (!records.length) { showMsg(msg, "error", "⚠️ No members to mark"); return; }
  showMsg(msg, "info", "⏳ Saving...");

  fetch("/club/attendance/meeting/mark", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meeting_id: currentMeetingId, records })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", `✅ Attendance saved — ${d.present}/${d.total} present`);
      setTimeout(() => { closeModal("markAttModal"); loadMeetings(); loadMemberReport(); }, 1200);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Save failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

/* ── DELETE MEETING ── */
function deleteMeeting(id) {
  if (!confirm("Delete this meeting and all attendance records?")) return;
  fetch("/club/attendance/meeting/delete", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meeting_id: id })
  }).then(r => r.json()).then(d => { if (d.success) loadMeetings(); });
}

/* ── UTILITIES ── */
function openModal(id) { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }
function showMsg(el, type, text) { if (!el) return; el.className = "msg " + type; el.innerText = text; }
function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
document.addEventListener("click", e => { if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open"); });
