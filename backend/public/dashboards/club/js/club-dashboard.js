/* =========================
   CLUB DASHBOARD JS
========================= */

document.addEventListener("DOMContentLoaded", () => {

  // Load dashboard data only on main dashboard page
  if (document.getElementById("memberCount")) {
    loadDashboardData();
    loadAnalytics();
  }

});

/* --- DASHBOARD SUMMARY --- */
function loadDashboardData() {
  fetch("/club/data", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (document.getElementById("greetingText")) {
        document.getElementById("greetingText").innerText = `Welcome, ${data.name} 👋`;
      }
      if (document.getElementById("clubNameSub")) {
        document.getElementById("clubNameSub").innerText = `Managing: ${data.clubName}`;
      }
      document.getElementById("memberCount").innerText = data.memberCount || 0;
      document.getElementById("pendingCount").innerText = data.pendingCount || 0;
      document.getElementById("eventCount").innerText = data.eventCount || 0;
      document.getElementById("announcementCount").innerText = data.announcementCount || 0;
    })
    .catch(err => console.error("CLUB DASH ERROR:", err));
}

/* --- ANALYTICS --- */
function loadAnalytics() {
  fetch("/club/analytics", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (document.getElementById("analyticsMembers")) {
        document.getElementById("analyticsMembers").innerText = data.memberCount || 0;
      }
      if (document.getElementById("analyticsPending")) {
        document.getElementById("analyticsPending").innerText = data.pendingCount || 0;
      }
      if (document.getElementById("analyticsUpcoming")) {
        document.getElementById("analyticsUpcoming").innerText = data.upcomingEvents || 0;
      }

      // Recent members list
      const recentEl = document.getElementById("recentMembersList");
      if (recentEl) {
        if (!data.recentMembers?.length) {
          recentEl.innerHTML = `<li style="color:var(--muted);">No members yet</li>`;
        } else {
          recentEl.innerHTML = data.recentMembers.map(m => `
            <li style="padding:10px 14px; border-radius:10px; background:var(--bg);
              display:flex; justify-content:space-between; align-items:center;">
              <strong>${m.username}</strong>
              <span style="font-size:13px; color:var(--muted);">${m.class_name || "—"}</span>
            </li>
          `).join("");
        }
      }
    })
    .catch(err => console.error("CLUB ANALYTICS ERROR:", err));
}

/* --- TOGGLE QUICK ANNOUNCE SECTION --- */
function showSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === "none" ? "block" : "none";
}

/* --- QUICK POST ANNOUNCEMENT (from dashboard) --- */
function postQuickAnnounce() {
  const title = document.getElementById("qAnnounce")?.value?.trim();
  const msg = document.getElementById("qAnnounceMsg");

  if (!title) {
    if (msg) { msg.style.color = "red"; msg.innerText = "Cannot be empty"; }
    return;
  }

  fetch("/club/announcements/post", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  })
  .then(r => r.json())
  .then(d => {
    if (msg) {
      msg.style.color = d.success ? "green" : "red";
      msg.innerText = d.success ? "✅ Announcement posted!" : (d.message || "Failed");
    }
    if (d.success) {
      document.getElementById("qAnnounce").value = "";
      loadDashboardData();
      setTimeout(() => { if (msg) msg.innerText = ""; }, 3000);
    }
  });
}