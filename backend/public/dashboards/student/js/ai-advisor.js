"use strict";
/* ============================================================
   ai-advisor.js — AI Study Advisor Frontend Logic
   Uses: /ai/recommend, /ai/ask, /ai/career-paths, /ai/departments
============================================================ */

let studentContext = null; // Cached student context from server
let careerPathsData = null; // Cached career paths

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  loadAvatar();
  loadInitialRecommendations();
  loadCareerPaths();
});

// ── LOAD AVATAR ──
function loadAvatar() {
  fetch("/dashboard/data", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById("avatarLetter");
      if (el) el.innerText = (d.user || "S")[0].toUpperCase();
    }).catch(() => {});
}

// ── INITIAL AUTO-RECOMMENDATIONS ──
function loadInitialRecommendations() {
  showLoading();

  fetch("/ai/recommend", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        showError(data.error);
        return;
      }

      studentContext = data.student_context;
      updateHeroChips(data.student_context);
      checkProfileComplete(data.student_context);
      renderResults(data);
    })
    .catch(err => {
      showError("Could not load AI recommendations. Please try refreshing.");
      console.error("[AI Advisor]", err);
    });
}

// ── UPDATE HERO CHIPS ──
function updateHeroChips(ctx) {
  if (!ctx) return;
  const sem  = document.getElementById("heroSem");
  const dept = document.getElementById("heroDept");
  const gpa  = document.getElementById("heroGPA");
  const att  = document.getElementById("heroAtt");

  if (sem)  sem.innerText  = `📅 Semester ${ctx.semester || "?"}`;
  if (dept) dept.innerText = `🏫 ${(ctx.department || "?").split(" ")[0]}`;
  if (gpa)  gpa.innerText  = `🎓 GPA: ${ctx.gpa > 0 ? ctx.gpa : "N/A"}`;
  if (att)  att.innerText  = `✅ Att: ${ctx.attendance > 0 ? ctx.attendance + "%" : "N/A"}`;
}

// ── CHECK PROFILE COMPLETENESS ──
function checkProfileComplete(ctx) {
  if (!ctx) return;
  const isIncomplete = !ctx.semester || ctx.semester === 0 ||
    ctx.department === "Computer Engineering" && !ctx.class_name;
  const prompt = document.getElementById("setupPrompt");
  if (prompt) prompt.style.display = isIncomplete ? "block" : "none";
}

// ── ASK AI (user query) ──
async function askAI() {
  const input = document.getElementById("aiQueryInput");
  const btn   = document.getElementById("sendBtn");
  const query = (input?.value || "").trim();

  if (!query) {
    input?.focus();
    return;
  }

  // Get selector values
  const semSel  = document.getElementById("semSelector");
  const deptSel = document.getElementById("deptSelector");
  const semester = semSel?.value !== "0" ? parseInt(semSel.value) : undefined;
  const department = deptSel?.value || undefined;

  if (btn) { btn.disabled = true; btn.innerHTML = "<span>Thinking...</span> <span>🧠</span>"; }
  showLoading("Analyzing your question with AI...");

  try {
    const res = await fetch("/ai/ask", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, semester, department })
    });

    const data = await res.json();

    if (data.error) {
      showError(data.error);
    } else {
      if (data.student_context) {
        studentContext = data.student_context;
        updateHeroChips(data.student_context);
      }
      renderResults(data, query);
    }
  } catch (err) {
    showError("Network error. Please try again.");
    console.error("[AI Ask]", err);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = "<span>Ask AI</span> <span>🚀</span>"; }
  }
}

// ── QUICK ASK (preset questions) ──
function quickAsk(question) {
  const input = document.getElementById("aiQueryInput");
  if (input) {
    input.value = question;
    input.focus();
  }
  askAI();
}

// ── ENTER KEY SUPPORT ──
function handleEnter(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    askAI();
  }
}

// ── RENDER RESULTS ──
function renderResults(data, query = "") {
  const content = document.getElementById("resultsContent");
  const loading = document.getElementById("loadingState");
  if (!content) return;

  if (loading) loading.style.display = "none";
  content.style.display = "block";

  const recs = data.recommendations || [];
  const insight = data.ai_insight || "";
  const queriedSem = data.queried_semester || data.student_semester;
  const dept = data.department || "Your Department";

  // Query understanding badge
  const queryBadge = query ? `
    <div style="margin:0 22px 4px;padding:8px 14px;background:#f1f0ec;border-radius:8px;font-size:12px;color:#374151;">
      🔍 Query: <strong>"${escH(query)}"</strong>
      ${data.query_understanding?.matched_subjects?.length
        ? ` → Matched: <strong>${data.query_understanding.matched_subjects.slice(0,3).join(", ")}</strong>`
        : ""}
    </div>` : "";

  // Insight box
  const insightHtml = insight ? `
    <div class="ai-insight-box">${processInsightText(insight)}</div>
  ` : "";

  // Recommendation cards
  const cardsHtml = recs.length
    ? recs.map(rec => renderRecCard(rec)).join("")
    : `<div class="ai-empty">
         <span class="ai-empty-icon">🤔</span>
         <p>No specific recommendations found for this query.</p>
         <p style="font-size:12px;margin-top:8px;">Try asking about a specific subject or semester.</p>
       </div>`;

  // Algorithm info banner
  const algoBanner = `
    <div style="margin:8px 22px;padding:10px 14px;background:#f5f3ff;border-radius:10px;font-size:11px;color:#6b21a8;display:flex;gap:8px;align-items:center;">
      <span>🧬</span>
      <span><strong>Algorithm:</strong> Content-Based Filtering + Rule-Based Classification |
      <strong>Model:</strong> TF-IDF Keyword Similarity + Importance Tier Scoring |
      <strong>Showing:</strong> Sem ${queriedSem} of ${dept}</span>
    </div>`;

  content.innerHTML = `
    <div class="ai-results-header">
      <div>
        <div class="ai-results-title">📌 AI Recommendations</div>
        <div class="ai-results-meta">Semester ${queriedSem} · ${dept} · ${recs.length} subjects analyzed</div>
      </div>
      <button onclick="loadInitialRecommendations()" style="padding:7px 14px;border-radius:8px;border:1px solid #e8e5df;background:white;cursor:pointer;font-size:12px;font-weight:600;color:#374151;">🔄 Refresh</button>
    </div>
    ${queryBadge}
    ${algoBanner}
    ${insightHtml}
    <div class="ai-rec-list">${cardsHtml}</div>
  `;
}

// ── RENDER A SINGLE RECOMMENDATION CARD ──
function renderRecCard(rec) {
  const tierBadgeClass = `tier-badge-${rec.importance_tier}`;
  const tierLabel = rec.tier_config?.label || `Tier ${rec.importance_tier}`;

  const careerChips = (rec.career_tags || []).slice(0, 4).map(tag =>
    `<span class="ai-meta-chip career">💼 ${escH(tag)}</span>`
  ).join("");

  const prereqChips = (rec.prerequisite_for || []).slice(0, 3).map(p =>
    `<span class="ai-meta-chip prereq">🔗 ${escH(p)}</span>`
  ).join("");

  const tips = (rec.study_tips || []).slice(0, 3).map(t =>
    `<li>${escH(t)}</li>`
  ).join("");

  const queryRelevancePct = rec.query_relevance || 0;
  const scoreNormalized = Math.min(Math.round((rec.composite_score / 250) * 100), 100);

  return `
    <div class="ai-rec-card tier-${rec.importance_tier}">
      <div class="ai-rec-header">
        <div class="ai-rec-rank">${rec.rank}</div>
        <div style="flex:1;min-width:0;">
          <div class="ai-rec-name">${escH(rec.name)}</div>
          <div class="ai-rec-code">${escH(rec.code || "")} · ${escH(rec.type || "")} · ${rec.credits} Credits</div>
        </div>
        <span class="ai-tier-badge ${tierBadgeClass}">${tierLabel}</span>
      </div>

      <div class="ai-rec-reason">
        ${escH(rec.focus_reason)}
      </div>

      ${careerChips || prereqChips ? `
      <div class="ai-rec-meta-row">
        ${careerChips}
        ${prereqChips}
      </div>` : ""}

      <div class="ai-score-bar">
        <span class="ai-score-label">AI Score</span>
        <div class="ai-score-track">
          <div class="ai-score-fill" style="width:${scoreNormalized}%"></div>
        </div>
        <span class="ai-score-val">${rec.composite_score}</span>
      </div>

      ${queryRelevancePct > 10 ? `
      <div class="ai-score-bar" style="margin-top:4px;">
        <span class="ai-score-label">Query Match</span>
        <div class="ai-score-track">
          <div class="ai-score-fill" style="width:${queryRelevancePct}%;background:linear-gradient(90deg,#16a34a,#22c55e);"></div>
        </div>
        <span class="ai-score-val" style="color:#16a34a;">${queryRelevancePct}%</span>
      </div>` : ""}

      ${tips ? `
      <div class="ai-rec-tips" style="margin-top:12px;">
        <div class="ai-rec-tips-title">💡 Study Tips:</div>
        <ul class="ai-rec-tips-list">${tips}</ul>
      </div>` : ""}
    </div>`;
}

// ── LOAD CAREER PATHS ──
function loadCareerPaths() {
  fetch("/ai/career-paths", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      careerPathsData = data.career_paths || {};
      renderCareerGrid(careerPathsData);
    })
    .catch(err => {
      const grid = document.getElementById("careerGrid");
      if (grid) grid.innerHTML = `<p style="color:red;font-size:13px;">Failed to load career paths.</p>`;
    });
}

function renderCareerGrid(paths) {
  const grid = document.getElementById("careerGrid");
  if (!grid) return;

  grid.innerHTML = Object.entries(paths).map(([key, path]) => `
    <div class="ai-career-card" onclick="selectCareerPath('${escH(key)}', this)">
      <div class="ai-career-name">${escH(path.label)}</div>
      <div class="ai-career-salary">💰 ${escH(path.avg_salary)}</div>
      <div class="ai-career-subjects">
        Key subjects: ${(path.priority_subjects || []).slice(0, 3).join(", ")}...
      </div>
    </div>
  `).join("");
}

function selectCareerPath(key, cardEl) {
  // Remove active from all
  document.querySelectorAll(".ai-career-card").forEach(c => c.classList.remove("active"));
  cardEl.classList.add("active");

  if (careerPathsData && careerPathsData[key]) {
    const path = careerPathsData[key];
    const q = `Which subjects should I focus on for ${path.label}?`;
    quickAsk(q);
    switchTab("recommendations", document.getElementById("tab-rec"));
  }
}

// ── SWITCH TABS ──
function switchTab(name, btn) {
  ["recommendations", "career"].forEach(t => {
    const panel = document.getElementById("panel-" + t);
    if (panel) panel.style.display = t === name ? "block" : "none";
  });
  document.querySelectorAll(".ai-tab").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

// ── UI HELPERS ──
function showLoading(msg = "Loading your personalized AI recommendations...") {
  const loading = document.getElementById("loadingState");
  const content = document.getElementById("resultsContent");
  if (loading) { loading.style.display = "flex"; loading.innerHTML = `<div class="ai-spinner"></div><span>${msg}</span>`; }
  if (content) content.style.display = "none";
}

function showError(msg) {
  const content = document.getElementById("resultsContent");
  const loading = document.getElementById("loadingState");
  if (loading) loading.style.display = "none";
  if (content) {
    content.style.display = "block";
    content.innerHTML = `<div class="ai-error">❌ ${escH(msg)}</div>`;
  }
}

function processInsightText(text) {
  // Convert **bold** markdown to <strong>
  return escH(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/⚠️/g, "<span style='font-size:16px;'>⚠️</span>")
    .replace(/✨/g, "<span style='font-size:16px;'>✨</span>")
    .replace(/🎯/g, "<span style='font-size:16px;'>🎯</span>")
    .replace(/📚/g, "<span style='font-size:16px;'>📚</span>");
}

function escH(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}