"use strict";
/* ============================================================
   club-tasks.js — Task Assignment & Tracking
============================================================ */

let allTasks = [];
let allMembers = [];

document.addEventListener("DOMContentLoaded", () => {
  loadClubInfo();
  loadMembers().then(() => loadTasks());
});

function loadClubInfo() {
  fetch("/club/data", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById("avatarLetter");
      if (el) el.innerText = (d.name || "C")[0].toUpperCase();
    }).catch(() => {});
}

function loadMembers() {
  return fetch("/club/members/list", { credentials: "include" })
    .then(r => r.json())
    .then(members => {
      allMembers = members;
      // Populate assignee dropdown
      const sel = document.getElementById("taskAssignee");
      const mFilter = document.getElementById("filterMember");
      if (sel) {
        sel.innerHTML = '<option value="">Unassigned</option>' +
          members.map(m => `<option value="${m.uc_id}">${esc(m.username)}</option>`).join("");
      }
      if (mFilter) {
        mFilter.innerHTML = '<option value="">All Members</option>' +
          members.map(m => `<option value="${m.uc_id}">${esc(m.username)}</option>`).join("");
      }
    }).catch(() => {});
}

function loadTasks() {
  fetch("/club/tasks/list", { credentials: "include" })
    .then(r => r.json())
    .then(tasks => {
      allTasks = tasks;
      updateStats(tasks);
      applyFilters();
    })
    .catch(() => {
      ["pending","in_progress","done"].forEach(col => {
        const el = document.getElementById("col-" + col);
        if (el) el.innerHTML = `<p style="color:var(--red);font-size:13px;">Failed to load</p>`;
      });
    });
}

function updateStats(tasks) {
  const pending    = tasks.filter(t => t.status === "pending").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const done       = tasks.filter(t => t.status === "done").length;
  const overdue    = tasks.filter(t =>
    t.status !== "done" && t.due_date && new Date(t.due_date) < new Date()
  ).length;

  setText("statPending",    pending);
  setText("statInProgress", inProgress);
  setText("statDone",       done);
  setText("statOverdue",    overdue);
}

function applyFilters() {
  const statusF   = document.getElementById("filterStatus")?.value   || "";
  const priorityF = document.getElementById("filterPriority")?.value || "";
  const memberF   = document.getElementById("filterMember")?.value   || "";

  const filtered = allTasks.filter(t => {
    return (!statusF   || t.status   === statusF) &&
           (!priorityF || t.priority === priorityF) &&
           (!memberF   || String(t.assigned_to) === memberF);
  });

  setText("taskCount", `${filtered.length} task${filtered.length !== 1 ? "s" : ""}`);
  renderBoard(filtered);
}

function renderBoard(tasks) {
  const cols = { pending: [], in_progress: [], done: [] };
  tasks.forEach(t => {
    if (cols[t.status]) cols[t.status].push(t);
  });

  const counts = {
    pending:     cols.pending.length,
    in_progress: cols.in_progress.length,
    done:        cols.done.length
  };
  setText("pendingCount",    counts.pending);
  setText("inProgressCount", counts.in_progress);
  setText("doneCount",       counts.done);

  Object.entries(cols).forEach(([status, tasks]) => {
    const el = document.getElementById("col-" + status);
    if (!el) return;

    if (!tasks.length) {
      el.innerHTML = `<div style="border:2px dashed var(--border);border-radius:12px;padding:24px;text-align:center;color:var(--muted);font-size:13px;">No tasks here</div>`;
      return;
    }

    el.innerHTML = tasks.map(t => renderTaskCard(t)).join("");
  });
}

function renderTaskCard(t) {
  const isOverdue = t.status !== "done" && t.due_date && new Date(t.due_date) < new Date();
  const pBorder   = t.priority === "high" ? "priority-high-border" : t.priority === "medium" ? "priority-medium-border" : "priority-low-border";
  const assignee  = allMembers.find(m => m.uc_id === t.assigned_to);

  return `
    <div class="task-card ${pBorder}" id="task-${t.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">
        <div class="task-title">${esc(t.title)}</div>
        <span class="badge ${t.priority === "high" ? "priority-high" : t.priority === "medium" ? "priority-medium" : "priority-low"}" style="padding:2px 8px;border-radius:6px;font-size:10px;flex-shrink:0;">
          ${t.priority}
        </span>
      </div>
      ${t.description ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px;">${esc(t.description.slice(0, 80))}${t.description.length > 80 ? "…" : ""}</div>` : ""}
      <div class="task-meta">
        ${assignee ? `<span>👤 ${esc(assignee.username)}</span>` : "<span style='color:var(--muted);'>Unassigned</span>"}
        ${t.due_date ? `<span style="${isOverdue ? "color:var(--red);font-weight:700;" : ""}">📅 ${t.due_date.slice(0,10)}${isOverdue ? " ⚠️" : ""}</span>` : ""}
      </div>
      <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
        ${t.status !== "in_progress" && t.status !== "done" ? `<button class="btn btn-outline btn-sm" onclick="updateTaskStatus(${t.id},'in_progress')">🔄 Start</button>` : ""}
        ${t.status !== "done"                               ? `<button class="btn btn-success btn-sm" onclick="updateTaskStatus(${t.id},'done')">✅ Done</button>` : ""}
        ${t.status === "done"                               ? `<button class="btn btn-outline btn-sm" onclick="updateTaskStatus(${t.id},'pending')">↩️ Reopen</button>` : ""}
        <button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})" style="margin-left:auto;">🗑</button>
      </div>
    </div>`;
}

/* ── CREATE TASK ── */
function openCreateTaskModal() {
  ["taskTitle","taskDesc"].forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
  document.getElementById("taskPriority").value = "medium";
  document.getElementById("taskAssignee").value = "";
  document.getElementById("taskDueDate").value = "";
  const msg = document.getElementById("createTaskMsg");
  msg.className = "msg"; msg.innerText = "";
  openModal("createTaskModal");
}

function createTask() {
  const title      = document.getElementById("taskTitle").value.trim();
  const desc       = document.getElementById("taskDesc").value.trim();
  const assignedTo = document.getElementById("taskAssignee").value || null;
  const priority   = document.getElementById("taskPriority").value;
  const dueDate    = document.getElementById("taskDueDate").value || null;
  const msg        = document.getElementById("createTaskMsg");

  if (!title) { showMsg(msg, "error", "⚠️ Task title is required"); return; }
  showMsg(msg, "info", "⏳ Creating...");

  fetch("/club/tasks/create", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description: desc, assigned_to: assignedTo, priority, due_date: dueDate })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Task created!");
      setTimeout(() => { closeModal("createTaskModal"); loadTasks(); }, 800);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

/* ── UPDATE STATUS ── */
function updateTaskStatus(id, status) {
  fetch("/club/tasks/status", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: id, status })
  }).then(r => r.json()).then(d => { if (d.success) loadTasks(); });
}

/* ── DELETE TASK ── */
function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  fetch("/club/tasks/delete", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: id })
  }).then(r => r.json()).then(d => { if (d.success) loadTasks(); });
}

/* ── UTILITIES ── */
function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }
function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function showMsg(el, type, text) { if (!el) return; el.className = "msg " + type; el.innerText = text; }
function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
document.addEventListener("click", e => { if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open"); });
