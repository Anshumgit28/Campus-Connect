/* =========================
  DASHBOARD DATA
========================= */

fetch("/dashboard/data", { credentials: "include" })
.then(res => res.json())
.then(data => {

  console.log("DASHBOARD DATA:", data);

  document.getElementById("greetingText")
    .innerText = `Welcome, ${data.user} 👋`;

  document.getElementById("studentName").innerText = data.user;
  document.getElementById("studentPRN").innerText = data.prn;
  document.getElementById("studentClass").innerText = data.class_name;
  document.getElementById("studentDivision").innerText = data.division;
  document.getElementById("studentYear").innerText = data.current_year;

  document.getElementById("noticeCount").innerText = data.notices || 0;
  document.getElementById("eventCount").innerText = data.events || 0;
  document.getElementById("resourceCount").innerText = data.resources || 0;
  document.getElementById("clubCount").innerText = data.clubs || 0;

  /* ACTIVITY */
  const activityList = document.getElementById("activityList");
  activityList.innerHTML = "";

  if (data.activity?.length) {
    data.activity.forEach(item => {
      const li = document.createElement("li");
      li.innerHTML = `✔ ${item.activity}`;
      activityList.appendChild(li);
    });
  } else {
    activityList.innerHTML = "<li>No recent activity</li>";
  }

  /* UPCOMING EVENTS */
  const eventList = document.getElementById("eventList");
  eventList.innerHTML = "";

  if (data.upcomingEvents?.length) {
    data.upcomingEvents.forEach(e => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="date">${e.event_date}</span> ${e.title}`;
      eventList.appendChild(li);
    });
  } else {
    eventList.innerHTML = "<li>No upcoming events</li>";
  }

});


/* =========================
   MY EVENTS
========================= */

fetch("/events/my", { credentials: "include" })
.then(res => res.json())
.then(events => {

  const list = document.getElementById("myEvents");
  list.innerHTML = "";

  if (!events.length) {
    list.innerHTML = "<li>No registered events</li>";
    return;
  }

  events.forEach(e => {
    const li = document.createElement("li");
    li.innerHTML = `🎯 ${e.title} — ${e.event_date}`;
    list.appendChild(li);
  });

});


/* =========================
   ATTENDANCE
========================= */

fetch("/academic/attendance", { credentials: "include" })
.then(res => res.json())
.then(data => {

  console.log("ATTENDANCE:", data);

  document.getElementById("attendanceValue").innerText =
    data.attendance + "%";

  document.getElementById("attendanceBar").style.width =
    data.attendance + "%";
});


/* =========================
   ASSIGNMENTS
========================= */

fetch("/academic/assignments", { credentials: "include" })
.then(res => res.json())
.then(assignments => {

  const list = document.getElementById("assignmentList");
  list.innerHTML = "";

  if (!assignments.length) {
    list.innerHTML = "<li>No upcoming assignments</li>";
    return;
  }

  assignments.forEach(a => {
    const li = document.createElement("li");
    li.innerHTML = `📝 ${a.title} — ${a.due_date}`;
    list.appendChild(li);
  });

});


/* =========================
   EXAMS
========================= */

fetch("/academic/exams", { credentials: "include" })
.then(res => res.json())
.then(exams => {

  if (!exams.length) return;

  const eventList = document.getElementById("eventList");

  exams.forEach(e => {
    const li = document.createElement("li");
    li.innerHTML = `🧪 ${e.subject} — ${e.exam_date}`;
    eventList.appendChild(li);
  });
 
});


/* =========================
   PERFORMANCE (DEBUG)
========================= */

fetch("/academic/performance", { credentials: "include" })
.then(res => res.json())
.then(data => {
  console.log("PERFORMANCE:", data); // ✅ FIXED
});
