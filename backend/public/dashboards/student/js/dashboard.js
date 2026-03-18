"use strict";

document.addEventListener("DOMContentLoaded", () => {

  /* ── DASHBOARD DATA ── */
  fetch("/dashboard/data", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      const name = data.user || "Student";

      document.getElementById("greetingName").innerText       = name;
      document.getElementById("studentName").innerText        = name;
      document.getElementById("studentEmail").innerText       = data.email        || "—";
      document.getElementById("studentPRN").innerText         = data.prn          || "—";
      document.getElementById("studentClass").innerText       = data.class_name   || "—";
      document.getElementById("studentDivision").innerText    = data.division     || "—";
      document.getElementById("studentYear").innerText        = data.current_year || "—";
      document.getElementById("noticeCount").innerText        = data.notices      || 0;
      document.getElementById("eventCount").innerText         = data.events       || 0;
      document.getElementById("resourceCount").innerText      = data.resources    || 0;
      document.getElementById("clubCount").innerText          = data.clubs        || 0;

      /* Avatar initials */
      const initial = name.charAt(0).toUpperCase();
      const avatar  = document.getElementById("avatarInitial");
      const pAvatar = document.getElementById("profileAvatarLetter");
      if (avatar)  avatar.innerText  = initial;
      if (pAvatar) pAvatar.innerText = initial;

      /* Activity list */
      const al = document.getElementById("activityList");
      if (al) {
        al.innerHTML = data.activity?.length
          ? data.activity.map(a =>
              `<li><span>✔ ${esc(a.activity)}</span></li>`
            ).join("")
          : "<li class='item-muted'>No recent activity</li>";
      }
    })
    .catch(err => console.error("Dashboard data error:", err));

  /* ── ACADEMICS ── */
  Academics.loadAttendance("attendanceBar", "attendanceValue", "attendanceNote");
  Academics.loadAssignments("assignmentList");
  Academics.loadPerformance("performanceLabel");

  /* ── MY REGISTERED EVENTS ── */
  Events.loadMyEvents("myEvents");

  /* ── NOTIFICATION BADGE ── */
  Notifications.loadUnreadCount("notifBadge");

});

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}