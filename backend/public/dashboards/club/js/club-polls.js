"use strict";
/* ============================================================
   club-polls.js — Polls & Voting
   FIXES:
   - Vote ratio/progress bars always visible to club head
   - Summary (total votes, leading option) shown on every poll
   - Students can vote; president/VP see full results always
============================================================ */

let myRole = "member";

document.addEventListener("DOMContentLoaded", () => {
  loadClubInfo();
  loadPolls();
});

function loadClubInfo() {
  fetch("/club/my-identity", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById("avatarLetter");
      if (el) el.innerText = (d.username || "C")[0].toUpperCase();
      myRole = (d.position || d.user_role || "member").toLowerCase();
    }).catch(() => {});
}

/* ── TABS ── */
function showTab(tab, btn) {
  document.querySelectorAll("[id^='tab-']").forEach(el => el.style.display = "none");
  document.getElementById("tab-" + tab).style.display = "block";
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

/* ── LOAD POLLS ── */
function loadPolls() {
  fetch("/club/polls/list", { credentials: "include" })
    .then(r => r.json())
    .then(polls => {
      const active = polls.filter(p => p.is_active);
      const closed = polls.filter(p => !p.is_active);
      renderPolls(active, "activePollsContainer", true);
      renderPolls(closed, "closedPollsContainer", false);
    })
    .catch(() => {
      document.getElementById("activePollsContainer").innerHTML =
        `<p style="color:var(--red);text-align:center;padding:30px;">Failed to load polls</p>`;
    });
}

function renderPolls(polls, containerId, isActive) {
  const el = document.getElementById(containerId);
  if (!polls.length) {
    el.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">${isActive ? "🗳️" : "🔒"}</span>
        <p>${isActive ? "No active polls. Create one!" : "No closed polls."}</p>
      </div>`;
    return;
  }
  el.innerHTML = polls.map(p => renderPollCard(p, isActive)).join("");
}

function renderPollCard(p, isActive) {
  const totalVotes     = p.options.reduce((s, o) => s + (o.vote_count || 0), 0);
  const userVote       = p.user_voted_option;
  const hasVoted       = !!userVote;

  /* Club head / president always sees results;
     regular members see results only after voting */
  const isManager = ["president","vice_president","vice president",
                     "club_head","admin"].some(r => myRole.includes(r));
  const showResults = isManager || hasVoted || !isActive;

  /* Find leading option */
  const maxVotes   = Math.max(...p.options.map(o => o.vote_count || 0), 0);
  const leadingIds = p.options
    .filter(o => o.vote_count === maxVotes && maxVotes > 0)
    .map(o => o.id);

  /* ── SUMMARY BAR (only when results visible) ── */
  const summaryHtml = showResults ? `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;
      padding:12px 14px;border-radius:10px;background:var(--bg);
      margin-bottom:14px;font-size:13px;">
      <span style="font-weight:700;color:var(--ink);">
        📊 ${totalVotes} vote${totalVotes !== 1 ? "s" : ""}
      </span>
      ${totalVotes > 0 ? `
        <span style="color:var(--muted);">·</span>
        <span style="color:var(--primary);font-weight:600;">
          🏆 Leading: ${esc(p.options.find(o => leadingIds.includes(o.id))?.label || "—")}
          (${maxVotes} vote${maxVotes !== 1 ? "s" : ""} ·
           ${Math.round(maxVotes / totalVotes * 100)}%)
        </span>` : `<span style="color:var(--muted);">No votes yet</span>`}
      ${hasVoted ? `<span style="color:var(--green);font-weight:600;">· ✅ You voted</span>` : ""}
    </div>` : "";

  /* ── OPTIONS ── */
  const optionsHtml = p.options.map(o => {
    const pct        = totalVotes > 0 ? Math.round((o.vote_count / totalVotes) * 100) : 0;
    const isSelected = userVote === o.id;
    const isLeading  = leadingIds.includes(o.id) && totalVotes > 0;
    const canVote    = isActive && !hasVoted && !isManager;

    return `
      <div class="poll-option
        ${isSelected ? "selected" : ""}
        ${!canVote   ? "voted"    : ""}"
        onclick="${canVote ? `castVote(${p.id}, ${o.id})` : ""}"
        style="cursor:${canVote ? "pointer" : "default"};
               ${isLeading && showResults ? "border-color:var(--primary);" : ""}">

        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;margin-bottom:${showResults ? "8px" : "0"};">
            ${isSelected ? "✅ " : ""}${isLeading && showResults && !isActive ? "🏆 " : ""}${esc(o.label)}
          </div>

          ${showResults ? `
            <!-- Progress bar always visible to managers -->
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="flex:1;height:8px;background:#f0f0f4;border-radius:8px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;border-radius:8px;transition:width .5s ease;
                  background:${isLeading
                    ? "linear-gradient(90deg,var(--primary),var(--violet))"
                    : "linear-gradient(90deg,#94a3b8,#cbd5e1)"};">
                </div>
              </div>
              <span style="font-size:13px;font-weight:700;min-width:36px;text-align:right;
                color:${isLeading ? "var(--primary)" : "var(--muted)"};">${pct}%</span>
              <span style="font-size:12px;color:var(--muted);min-width:60px;">
                ${o.vote_count} vote${o.vote_count !== 1 ? "s" : ""}
              </span>
            </div>` : ""}
        </div>
      </div>`;
  }).join("");

  /* ── FULL CARD ── */
  return `
    <div class="card" style="margin-bottom:16px;" id="poll-${p.id}">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;
        gap:12px;margin-bottom:12px;flex-wrap:wrap;">
        <div style="flex:1;">
          <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:700;
            color:var(--ink);margin-bottom:4px;">
            ${esc(p.question)}
            ${!isActive ? `<span style="background:#f3f4f6;color:#6b7280;font-size:11px;
              font-weight:700;padding:2px 8px;border-radius:20px;margin-left:8px;">🔒 Closed</span>` : ""}
          </div>
          <div style="font-size:12px;color:var(--muted);">
            ${p.ends_at ? `Closes ${new Date(p.ends_at).toLocaleDateString("en-IN")}` : "No end date"}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;">
          ${isActive ? `<button class="btn btn-danger btn-sm" onclick="closePoll(${p.id})">🔒 Close</button>` : ""}
          <button class="btn btn-outline btn-sm" onclick="deletePoll(${p.id})">🗑</button>
        </div>
      </div>

      <!-- Summary -->
      ${summaryHtml}

      <!-- Options -->
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${optionsHtml}
      </div>

      <!-- Hint for members who haven't voted -->
      ${isActive && !hasVoted && !isManager ? `
        <p style="font-size:12px;color:var(--primary);margin-top:10px;font-weight:600;">
          Tap an option above to cast your vote
        </p>` : ""}

    </div>`;
}

/* ── CAST VOTE ── */
function castVote(pollId, optionId) {
  /* Disable all options in this poll immediately */
  const card = document.getElementById("poll-" + pollId);
  if (card) card.querySelectorAll(".poll-option").forEach(o => {
    o.style.pointerEvents = "none"; o.style.opacity = ".6";
  });

  fetch("/club/polls/vote", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ poll_id: pollId, option_id: optionId })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) loadPolls();
    else {
      alert(d.message || "Vote failed");
      if (card) card.querySelectorAll(".poll-option").forEach(o => {
        o.style.pointerEvents = ""; o.style.opacity = "";
      });
    }
  });
}

/* ── CLOSE POLL ── */
function closePoll(id) {
  if (!confirm("Close this poll? No more votes can be cast.")) return;
  fetch("/club/polls/close", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ poll_id: id })
  }).then(r => r.json()).then(d => { if (d.success) loadPolls(); });
}

/* ── DELETE POLL ── */
function deletePoll(id) {
  if (!confirm("Delete this poll and all votes?")) return;
  fetch("/club/polls/delete", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ poll_id: id })
  }).then(r => r.json()).then(d => { if (d.success) loadPolls(); });
}

/* ── CREATE POLL ── */
function openCreatePollModal() {
  document.getElementById("pollQuestion").value = "";
  document.getElementById("pollEndsAt").value   = "";
  document.getElementById("createPollMsg").className = "msg";
  document.getElementById("createPollMsg").innerText = "";
  const list = document.getElementById("pollOptionsList");
  list.innerHTML = `
    <div class="option-row" style="display:flex;gap:8px;margin-bottom:8px;">
      <input class="poll-opt-input" placeholder="Option 1" style="flex:1;">
      <button class="btn btn-outline btn-sm" onclick="removeOptionRow(this)" style="flex-shrink:0;">✕</button>
    </div>
    <div class="option-row" style="display:flex;gap:8px;margin-bottom:8px;">
      <input class="poll-opt-input" placeholder="Option 2" style="flex:1;">
      <button class="btn btn-outline btn-sm" onclick="removeOptionRow(this)" style="flex-shrink:0;">✕</button>
    </div>`;
  openModal("createPollModal");
}

function addOptionRow() {
  const list = document.getElementById("pollOptionsList");
  const idx  = list.querySelectorAll(".option-row").length + 1;
  const row  = document.createElement("div");
  row.className = "option-row";
  row.style.cssText = "display:flex;gap:8px;margin-bottom:8px;";
  row.innerHTML = `
    <input class="poll-opt-input" placeholder="Option ${idx}" style="flex:1;">
    <button class="btn btn-outline btn-sm" onclick="removeOptionRow(this)" style="flex-shrink:0;">✕</button>`;
  list.appendChild(row);
}

function removeOptionRow(btn) {
  const rows = document.querySelectorAll(".option-row");
  if (rows.length <= 2) { alert("Minimum 2 options required"); return; }
  btn.closest(".option-row").remove();
}

function createPoll() {
  const question = document.getElementById("pollQuestion").value.trim();
  const endsAt   = document.getElementById("pollEndsAt").value || null;
  const msg      = document.getElementById("createPollMsg");

  const options = Array.from(document.querySelectorAll(".poll-opt-input"))
    .map(i => i.value.trim()).filter(Boolean);

  if (!question)          { showMsg(msg, "error", "⚠️ Question is required"); return; }
  if (options.length < 2) { showMsg(msg, "error", "⚠️ At least 2 options required"); return; }

  showMsg(msg, "info", "⏳ Creating...");

  fetch("/club/polls/create", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, options, ends_at: endsAt })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Poll created!");
      setTimeout(() => { closeModal("createPollModal"); loadPolls(); }, 800);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

/* ── UTILITIES ── */
function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }
function showMsg(el, type, text) { if (!el) return; el.className = "msg " + type; el.innerText = text; }
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}
document.addEventListener("click", e => {
  if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open");
});