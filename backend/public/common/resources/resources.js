/* ============================================================
   COMMON RESOURCES MODULE — public/common/resources/resources.js
============================================================ */
const Resources = (() => {

  function loadResources(containerId, opts = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<p style="color:var(--muted);">Loading resources...</p>`;

    let url = "/resources";
    const params = [];
    if (opts.search) params.push("search=" + encodeURIComponent(opts.search));
    if (opts.semester) params.push("semester=" + encodeURIComponent(opts.semester));
    if (opts.type) params.push("type=" + encodeURIComponent(opts.type));
    if (params.length) url += "?" + params.join("&");

    fetch(url, { credentials: "include" })
      .then(r => r.json())
      .then(resources => {
        if (!resources.length) {
          container.innerHTML = `<p style="color:var(--muted);">No resources found</p>`;
          return;
        }
        container.innerHTML = resources.map(r => `
          <div class="snap-card" style="min-width:220px; max-width:280px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
              <h3 style="font-size:14px; font-weight:700; flex:1; margin:0;">${r.title}</h3>
              <span style="font-size:11px; background:var(--bg); padding:3px 8px;
                border-radius:20px; color:var(--primary); white-space:nowrap; flex-shrink:0;">
                ${r.type || "Notes"}
              </span>
            </div>
            ${r.subject ? `<p style="font-size:12px; color:var(--muted); margin-top:6px;">📘 ${r.subject}</p>` : ""}
            ${r.semester ? `<p style="font-size:12px; color:var(--muted);">Sem: ${r.semester}</p>` : ""}
            <p style="font-size:12px; color:var(--muted);">⬇ ${r.downloads || 0} downloads</p>
            <div style="display:flex; gap:8px; margin-top:10px;">
              <a href="/resources/download/${r.id}"
                style="flex:1; padding:8px; text-align:center; border-radius:8px; border:none;
                  background:var(--primary); color:white; font-size:12px;
                  font-weight:600; text-decoration:none; cursor:pointer;">
                ⬇ Download
              </a>
              <button id="save-btn-${r.id}"
                onclick="Resources.save(${r.id}, this)"
                title="Save resource"
                style="padding:7px 12px; border-radius:8px; border:1px solid var(--border);
                  background:white; cursor:pointer; font-size:13px;">
                🔖
              </button>
            </div>
          </div>
        `).join("");
      })
      .catch(() => {
        container.innerHTML = `<p style="color:red;">Failed to load resources</p>`;
      });
  }

  function save(resourceId, btn) {
    if (!resourceId) return;
    fetch("/resources/save", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId })
    })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        if (btn) {
          btn.innerText = "✅";
          btn.disabled = true;
          btn.title = "Saved!";
          btn.style.background = "#dcfce7";
          btn.style.borderColor = "#22c55e";
        }
      } else {
        if (btn) btn.title = "Already saved or error";
      }
    })
    .catch(err => console.error("Save error:", err));
  }

  function unsave(resourceId, cardEl) {
    if (!resourceId) return;
    fetch("/resources/unsave", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId })
    })
    .then(r => r.json())
    .then(d => {
      if (d.success && cardEl) {
        cardEl.remove();
      }
    })
    .catch(err => console.error("Unsave error:", err));
  }

  function loadSaved(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<p style="color:var(--muted);">Loading saved resources...</p>`;

    fetch("/resources/saved", { credentials: "include" })
      .then(r => r.json())
      .then(resources => {
        if (!resources.length) {
          container.innerHTML = `<p style="color:var(--muted);">No saved resources yet. Click 🔖 on any resource to save it.</p>`;
          return;
        }
        container.innerHTML = resources.map(r => `
          <div id="saved-${r.id}" style="padding:14px; border-radius:12px; background:var(--bg);
            border:1px solid var(--border); display:flex; justify-content:space-between;
            align-items:center; gap:12px; flex-wrap:wrap;">
            <div style="flex:1; min-width:0;">
              <strong style="font-size:14px;">${r.title}</strong>
              <p style="font-size:12px; color:var(--muted); margin-top:4px;">
                ${r.subject || ""}${r.type ? " · " + r.type : ""}
                ${r.semester ? " · Sem " + r.semester : ""}
              </p>
            </div>
            <div style="display:flex; gap:8px; flex-shrink:0;">
              <a href="/resources/download/${r.id}"
                style="padding:8px 14px; border-radius:8px; border:none; background:var(--primary);
                  color:white; font-size:12px; font-weight:600; text-decoration:none; white-space:nowrap;">
                ⬇ Download
              </a>
              <button onclick="Resources.unsave(${r.id}, document.getElementById('saved-${r.id}'))"
                style="padding:8px 12px; border-radius:8px; border:1px solid #fca5a5;
                  background:#fee2e2; color:#dc2626; font-size:12px; cursor:pointer;
                  font-weight:600; white-space:nowrap;">
                Remove
              </button>
            </div>
          </div>
        `).join("");
      })
      .catch(() => {
        container.innerHTML = `<p style="color:red;">Failed to load saved resources</p>`;
      });
  }

  return { loadResources, save, unsave, loadSaved };
})();

window.Resources = Resources;