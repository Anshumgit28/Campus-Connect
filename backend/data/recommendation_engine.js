"use strict";
/**
 * AI RECOMMENDATION ENGINE
 * ========================
 * Algorithm: Content-Based Filtering + Rule-Based Classification
 * 
 * STEP-BY-STEP PIPELINE:
 * 
 * 1. INPUT COLLECTION
 *    - Student semester, department, GPA, attendance, enrolled courses
 *    - Optional: user query (natural language)
 * 
 * 2. QUERY UNDERSTANDING (TF-IDF Keyword Matching)
 *    - Tokenize user query into keywords
 *    - Match against subject keyword vectors in KB
 *    - Compute cosine similarity score
 * 
 * 3. RULE-BASED CLASSIFICATION
 *    - Assign importance score based on:
 *      a) importance_tier (1=critical, 2=important, 3=standard)
 *      b) prerequisite chain depth (more dependents = higher score)
 *      c) career tag diversity (how many careers it unlocks)
 *      d) Student's GPA (low GPA → focus on tier-1 core subjects)
 *      e) Attendance factor (low attendance → all subjects matter more)
 * 
 * 4. PERSONALIZATION FILTER
 *    - Filter subjects to student's semester
 *    - Check which subjects student is currently enrolled in
 *    - Boost score for subjects with low attendance
 * 
 * 5. RANKING & OUTPUT
 *    - Sort by composite score
 *    - Return top N recommendations with explanations
 */

const { CURRICULUM_KB, TIER_CONFIG, CAREER_PATHS } = require("./curriculum_kb");

// ─────────────────────────────────────────
// UTILITY: Simple TF-IDF Keyword Similarity
// ─────────────────────────────────────────
/**
 * Computes similarity between a query string and a subject's keyword list
 * Returns a score 0-1
 */
function computeKeywordSimilarity(query, subjectKeywords) {
  if (!query || !subjectKeywords || !subjectKeywords.length) return 0;

  const queryTokens = tokenize(query);
  if (!queryTokens.length) return 0;

  let matchCount = 0;
  let partialMatchCount = 0;

  for (const qToken of queryTokens) {
    for (const keyword of subjectKeywords) {
      const kw = keyword.toLowerCase();
      const qt = qToken.toLowerCase();

      if (kw === qt) {
        matchCount += 2; // Exact match gets double weight
        break;
      } else if (kw.includes(qt) || qt.includes(kw)) {
        partialMatchCount += 1;
        break;
      }
    }
  }

  const maxPossible = queryTokens.length * 2;
  const score = (matchCount + partialMatchCount * 0.5) / maxPossible;
  return Math.min(score, 1.0); // Cap at 1.0
}

/**
 * Tokenize text into words, removing stop words
 */
function tokenize(text) {
  const stopWords = new Set(["the", "a", "an", "in", "on", "at", "is", "it", "i", "me",
    "my", "to", "for", "of", "and", "or", "but", "what", "which",
    "how", "do", "should", "can", "will", "be", "are", "this", "that",
    "more", "focus", "which", "subject", "course", "help", "need",
    "tell", "about", "most", "important", "best", "give", "recommend"
  ]);
  return text.toLowerCase()
    .replace(/[^a-z0-9\s+\/]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));
}

// ─────────────────────────────────────────
// RULE-BASED SCORING ENGINE
// ─────────────────────────────────────────

/**
 * Compute a composite importance score for a subject given student context
 * 
 * Score components:
 *   - base_score:        from importance_tier (tier1=100, tier2=60, tier3=30)
 *   - prerequisite_score: number of subjects that depend on this * 10
 *   - career_score:      number of career paths this unlocks * 8
 *   - gpa_boost:         if student GPA < 6, tier-1 subjects get +20
 *   - attendance_boost:  if student attendance < 75%, all get +15
 *   - query_match:       TF-IDF similarity score * 50
 */
function computeSubjectScore(subject, studentContext, query = "") {
  const { gpa, attendance } = studentContext;

  // Base score from tier
  const tierScores = { 1: 100, 2: 60, 3: 30 };
  let score = tierScores[subject.importance_tier] || 30;

  // Prerequisite chain score
  const prereqBoost = (subject.prerequisite_for || []).length * 10;
  score += Math.min(prereqBoost, 40); // Cap at 40

  // Career diversity score
  const careerBoost = (subject.career_tags || []).length * 8;
  score += Math.min(careerBoost, 40); // Cap at 40

  // GPA-based boost (struggling students need core subjects more)
  const numericGPA = parseFloat(gpa) || 0;
  if (numericGPA > 0 && numericGPA < 6.0 && subject.importance_tier === 1) {
    score += 25;
  } else if (numericGPA >= 8.0 && subject.importance_tier <= 2) {
    score += 10; // High-performing students get elective boost too
  }

  // Attendance-based boost
  const numericAtt = parseFloat(attendance) || 0;
  if (numericAtt > 0 && numericAtt < 75) {
    score += 15; // All subjects matter more when attendance is low
  }

  // Query match boost (TF-IDF similarity)
  if (query && query.trim().length > 0) {
    const similarity = computeKeywordSimilarity(query, subject.keywords || []);
    score += similarity * 60; // Can add up to 60 points
  }

  return Math.round(score);
}

// ─────────────────────────────────────────
// MAIN RECOMMENDATION FUNCTION
// ─────────────────────────────────────────

/**
 * Generate AI recommendations for a student
 * 
 * @param {Object} params
 * @param {string} params.department - e.g., "Computer Engineering"
 * @param {number} params.semester - 1 to 8
 * @param {number} params.gpa - student GPA (0-10)
 * @param {number} params.attendance - attendance percentage (0-100)
 * @param {string} params.query - natural language query (optional)
 * @param {Array}  params.enrolledCourses - list of enrolled course names
 * @param {number} params.topN - how many recommendations to return
 * @returns {Object} recommendations
 */
function generateRecommendations(params) {
  const {
    department = "Computer Engineering",
    semester = 1,
    gpa = 0,
    attendance = 0,
    query = "",
    enrolledCourses = [],
    topN = 5
  } = params;

  // ─── Step 1: Find department in KB ───
  let deptData = CURRICULUM_KB[department];
  if (!deptData) {
    // Fallback: try partial match
    const deptKeys = Object.keys(CURRICULUM_KB);
    const matched = deptKeys.find(k =>
      k.toLowerCase().includes(department.toLowerCase()) ||
      department.toLowerCase().includes(k.toLowerCase())
    );
    deptData = matched ? CURRICULUM_KB[matched] : null;
  }

  if (!deptData) {
    return {
      success: false,
      error: `Department "${department}" not found in curriculum. Available: ${Object.keys(CURRICULUM_KB).join(", ")}`,
      recommendations: [],
      query_understanding: { tokens: [], matched_subjects: [] }
    };
  }

  // ─── Step 2: Determine semester range to query ───
  // Student in sem N can ask about any semester
  let semToQuery = parseInt(semester);
  
  // If query mentions a different semester, extract it
  const semMention = query.match(/sem(?:ester)?\s*(\d)/i);
  if (semMention) {
    semToQuery = parseInt(semMention[1]);
  }

  // ─── Step 3: Get subjects for the queried semester ───
  let subjects = [];
  
  // If asking about a specific semester via query, use that; else use current
  const targetSem = deptData.semesters[semToQuery];
  const currentSem = deptData.semesters[parseInt(semester)];
  
  if (targetSem && semToQuery !== parseInt(semester)) {
    // Student asked about a different semester
    subjects = targetSem;
  } else if (currentSem) {
    subjects = currentSem;
  }

  // If no subjects found for that semester, collect all available
  if (!subjects.length) {
    Object.values(deptData.semesters).forEach(semSubjects => {
      subjects = subjects.concat(semSubjects);
    });
    // Remove duplicates by code
    const seen = new Set();
    subjects = subjects.filter(s => {
      if (seen.has(s.code)) return false;
      seen.add(s.code);
      return true;
    });
  }

  // ─── Step 4: Score each subject ───
  const studentContext = { gpa, attendance };
  const scoredSubjects = subjects.map(subject => ({
    ...subject,
    score: computeSubjectScore(subject, studentContext, query),
    queryMatch: query ? computeKeywordSimilarity(query, subject.keywords || []) : 0
  }));

  // ─── Step 5: Sort by score descending ───
  scoredSubjects.sort((a, b) => b.score - a.score);

  // ─── Step 6: Take top N ───
  const topRecommendations = scoredSubjects.slice(0, topN);

  // ─── Step 7: Build response ───
  const queryTokens = tokenize(query);
  
  // Build a natural language insight
  const insight = buildInsight(department, semToQuery, parseInt(semester), gpa, attendance, query, topRecommendations);

  return {
    success: true,
    department,
    student_semester: semester,
    queried_semester: semToQuery,
    query_understanding: {
      original_query: query,
      tokens: queryTokens,
      detected_semester: semMention ? semToQuery : null,
      matched_subjects: topRecommendations
        .filter(s => s.queryMatch > 0.1)
        .map(s => s.name)
    },
    recommendations: topRecommendations.map((s, idx) => ({
      rank: idx + 1,
      code: s.code,
      name: s.name,
      type: s.type,
      credits: s.credits,
      importance_tier: s.importance_tier,
      tier_config: TIER_CONFIG[s.importance_tier],
      composite_score: s.score,
      query_relevance: Math.round(s.queryMatch * 100),
      career_tags: s.career_tags,
      prerequisite_for: s.prerequisite_for,
      focus_reason: s.focus_reason,
      study_tips: s.study_tips
    })),
    ai_insight: insight,
    career_paths: CAREER_PATHS
  };
}

/**
 * Generate a natural language insight paragraph
 */
function buildInsight(dept, queriedSem, currentSem, gpa, attendance, query, recommendations) {
  const lines = [];
  const topSubject = recommendations[0];

  if (!topSubject) return "I couldn't find specific subjects for this query. Please try a different semester or department.";

  // Context-aware intro
  if (queriedSem !== currentSem) {
    lines.push(`You're currently in Semester ${currentSem} but asking about Semester ${queriedSem}. Great initiative to plan ahead!`);
  }

  // Subject spotlight
  lines.push(`🎯 Top Priority for ${dept} Semester ${queriedSem}: **${topSubject.name}** — ${topSubject.focus_reason}`);

  // GPA-based advice
  const numGPA = parseFloat(gpa) || 0;
  if (numGPA > 0 && numGPA < 6.0) {
    lines.push(`⚠️ With a GPA of ${gpa}, I recommend focusing intensely on Tier-1 (Critical) subjects. These are your most important exam subjects and form the foundation for future semesters.`);
  } else if (numGPA >= 8.0) {
    lines.push(`✨ Excellent GPA of ${gpa}! You have a strong foundation. Consider exploring elective specializations and industry projects to stand out.`);
  }

  // Attendance-based advice
  const numAtt = parseFloat(attendance) || 0;
  if (numAtt > 0 && numAtt < 75) {
    lines.push(`⚠️ Your attendance is ${attendance}%, which is below the 75% threshold. Attending all classes for critical subjects is strongly recommended to avoid eligibility issues.`);
  }

  // Prerequisite chain advice
  const tier1Subjects = recommendations.filter(s => s.importance_tier === 1);
  if (tier1Subjects.length > 1) {
    lines.push(`📚 These ${tier1Subjects.length} critical subjects from Semester ${queriedSem} are foundational: ${tier1Subjects.map(s => s.name).join(", ")}. They serve as prerequisites for multiple future subjects.`);
  }

  return lines.join("\n\n");
}

// ─────────────────────────────────────────
// QUICK SUBJECT LOOKUP
// ─────────────────────────────────────────

/**
 * Get all subjects across all semesters for a department
 */
function getAllSubjectsForDept(department) {
  const deptData = CURRICULUM_KB[department];
  if (!deptData) return [];
  const all = [];
  Object.entries(deptData.semesters).forEach(([sem, subjects]) => {
    subjects.forEach(s => all.push({ ...s, semester: parseInt(sem) }));
  });
  return all;
}

/**
 * Get departments list
 */
function getDepartments() {
  return Object.keys(CURRICULUM_KB).map(name => ({
    name,
    code: CURRICULUM_KB[name].department_code,
    semestersAvailable: Object.keys(CURRICULUM_KB[name].semesters).map(Number)
  }));
}

/**
 * Search subjects by keyword across all departments/semesters
 */
function globalSubjectSearch(query, department = null) {
  const results = [];
  const depts = department
    ? (CURRICULUM_KB[department] ? { [department]: CURRICULUM_KB[department] } : {})
    : CURRICULUM_KB;

  Object.entries(depts).forEach(([deptName, deptData]) => {
    Object.entries(deptData.semesters).forEach(([sem, subjects]) => {
      subjects.forEach(subject => {
        const similarity = computeKeywordSimilarity(query, subject.keywords || []);
        if (similarity > 0.05) {
          results.push({
            department: deptName,
            semester: parseInt(sem),
            subject: subject.name,
            code: subject.code,
            importance_tier: subject.importance_tier,
            similarity: Math.round(similarity * 100),
            focus_reason: subject.focus_reason
          });
        }
      });
    });
  });

  return results.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
}

module.exports = {
  generateRecommendations,
  globalSubjectSearch,
  getAllSubjectsForDept,
  getDepartments,
  TIER_CONFIG,
  CAREER_PATHS
};