"use strict";

document.addEventListener("DOMContentLoaded", () => {

  /* ── LOAD CURRENT PROFILE DATA ── */
  fetch("/dashboard/data", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      document.getElementById("username").value     = data.user         || "";
      document.getElementById("prn").value          = data.prn          || "";
      document.getElementById("class_name").value   = data.class_name   || "";
      document.getElementById("division").value     = data.division     || "";
      document.getElementById("current_year").value = data.current_year || "";
    })
    .catch(err => console.error("Failed to load profile:", err));

  /* ── SAVE PROFILE ── */
  document.getElementById("saveBtn").addEventListener("click", () => {
    const username     = document.getElementById("username").value.trim();
    const prn          = document.getElementById("prn").value.trim();
    const class_name   = document.getElementById("class_name").value.trim();
    const division     = document.getElementById("division").value.trim();
    const current_year = document.getElementById("current_year").value;
    const msg          = document.getElementById("saveMsg");

    if (!username || username.length < 2) {
      msg.style.color = "red";
      msg.innerText   = "⚠️ Name is required (min 2 characters)";
      return;
    }

    msg.style.color = "#6366f1";
    msg.innerText   = "⏳ Saving…";

    fetch("/dashboard/profile/update", {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body: JSON.stringify({ username, prn, class_name, division, current_year })
    })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        msg.style.color = "green";
        msg.innerText   = "✅ Profile updated!";
        setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
      } else {
        msg.style.color = "red";
        msg.innerText   = "❌ " + (d.message || "Update failed");
      }
    })
    .catch(err => {
      msg.style.color = "red";
      msg.innerText   = "❌ Network error";
      console.error("Save profile error:", err);
    });
  });
});