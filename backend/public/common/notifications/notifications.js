const Notifications = (() => {

  function loadNotifications(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    
    el.innerHTML = `<p style="color:var(--muted);">Loading...</p>`;
    
    fetch("/notifications", { credentials: "include" })
      .then(r => r.json())
      .then(rows => {
        if (!rows.length) { 
          el.innerHTML = `<p style="color:var(--muted);">No notifications</p>`; 
          return; 
        }

        el.innerHTML = rows.map(n => `
          <div id="notif-${n.id}" 
            style="padding:14px; border-radius:10px; 
              background:${n.is_read ? 'white' : 'var(--bg)'}; 
              border:1px solid var(--border); 
              ${!n.is_read ? 'border-left:4px solid var(--primary);' : ''} 
              display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
            
            <div style="flex:1; min-width:0;">
              <p style="font-size:14px; ${!n.is_read ? 'font-weight:600;' : ''}">
                ${escapeHtml(n.message)}
              </p>

              <p style="font-size:12px; color:var(--muted); margin-top:4px;">
                ${n.created_at 
                  ? new Date(n.created_at).toLocaleDateString("en-IN", {
                      day:"2-digit",
                      month:"short",
                      year:"numeric",
                      hour:"2-digit",
                      minute:"2-digit"
                    }) 
                  : ""}
              </p>
            </div>

            ${!n.is_read 
              ? `<button onclick="Notifications.markRead(${n.id})"
                  style="padding:5px 10px; border-radius:6px; border:none; 
                    background:var(--primary); color:white; font-size:12px; 
                    cursor:pointer; white-space:nowrap; flex-shrink:0;">
                  Mark Read
                </button>` 
              : `<span style="font-size:12px; color:#22c55e; flex-shrink:0;">
                  ✓ Read
                </span>`
            }
          </div>
        `).join("");
      })
      .catch(err => {
        console.error("Notifications load error:", err);
        el.innerHTML = `<p style="color:red;">Failed to load notifications</p>`;
      });
  }

  function markRead(id) {
    fetch(`/notifications/read/${id}`, { 
      method: "POST", 
      credentials: "include" 
    })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        const el = document.getElementById(`notif-${id}`);
        if (el) {
          el.style.background = "white";
          el.style.borderLeft = "1px solid var(--border)";

          const btn = el.querySelector("button");
          if (btn) {
            btn.outerHTML = `
              <span style="font-size:12px; color:#22c55e;">
                ✓ Read
              </span>`;
          }

          const p = el.querySelector("p");
          if (p) p.style.fontWeight = "";
        }

        loadUnreadCount();
      }
    })
    .catch(err => console.error("Mark read error:", err));
  }

  function markAllRead() {
    fetch("/notifications/read-all", { 
      method: "POST", 
      credentials: "include" 
    })
    .then(r => r.json())
    .then(d => { 
      if (d.success) {
        window.location.reload(); 
      }
    })
    .catch(err => console.error("Mark all read error:", err));
  }

  function loadUnreadCount(badgeId = "notifBadge") {
    fetch("/notifications/count", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const el = document.getElementById(badgeId);
        if (el) {
          el.innerText = d.count;
          el.style.display = d.count > 0 ? "inline" : "none";
        }
      })
      .catch(err => console.error("Count load error:", err));
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return { 
    loadNotifications, 
    markRead, 
    markAllRead, 
    loadUnreadCount 
  };

})();

window.Notifications = Notifications;