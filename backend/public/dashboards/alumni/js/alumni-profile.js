"use strict";

document.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  
  document.getElementById("saveBtn").addEventListener("click", saveProfile);
});

function loadProfile() {
  fetch("/alumni/profile", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      if (!data) return;
      
      ["full_name","graduation_year","degree","company","job_title","work_location","linkedin"].forEach(key => {
        const el = document.getElementById(key);
        if (el && data[key]) el.value = data[key];
      });
    })
    .catch(err => console.error("Load profile error:", err));
}

function saveProfile() {
  const body = {};
  ["full_name","graduation_year","degree","company","job_title","work_location","linkedin"].forEach(k => {
    body[k] = document.getElementById(k).value;
  });
  
  fetch("/alumni/profile/update", {
    method: "POST", 
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  .then(r => r.json())
  .then(d => {
    const msg = document.getElementById("saveMsg");
    msg.style.color = d.success ? "green" : "red";
    msg.innerText = d.success ? "✅ Profile updated!" : "❌ Failed to save";
  })
  .catch(err => {
    const msg = document.getElementById("saveMsg");
    msg.style.color = "red";
    msg.innerText = "❌ Network error";
    console.error("Save profile error:", err);
  });
}