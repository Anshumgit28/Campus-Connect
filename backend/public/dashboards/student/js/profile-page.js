"use strict";

document.addEventListener("DOMContentLoaded", () => {

  /* ── LOAD CURRENT DATA ── */
  fetch("/dashboard/data", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      setVal("username",     data.user         || "");
      setVal("prn",          data.prn          || "");
      setVal("class_name",   data.class_name   || "");
      setVal("division",     data.division     || "");
      setVal("current_year", data.current_year || "");
    })
    .catch(err => console.error("Failed to load profile:", err));

  /* ── SAVE HANDLER ── */
  document.getElementById("saveBtn").addEventListener("click", () => {
    const username     = getVal("username").trim();
    const prn          = getVal("prn").trim();
    const class_name   = getVal("class_name").trim();
    const division     = getVal("division").trim();
    const current_year = getVal("current_year");
    const msg          = document.getElementById("saveMsg");

    if (!username || username.length < 2) {
      showMsg(msg, "red", "⚠️ Name must be at least 2 characters");
      return;
    }

    showMsg(msg, "#6366f1", "⏳ Saving…");

    fetch("/dashboard/profile/update", {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body: JSON.stringify({ username, prn, class_name, division, current_year })
    })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        showMsg(msg, "#16a34a", "✅ Profile updated!");
        setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
      } else {
        showMsg(msg, "#dc2626", "❌ " + (d.message || "Update failed"));
      }
    })
    .catch(() => showMsg(msg, "#dc2626", "❌ Network error"));
  });

});

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function showMsg(el, color, text) {
  if (!el) return;
  el.style.color = color;
  el.innerText   = text;
}