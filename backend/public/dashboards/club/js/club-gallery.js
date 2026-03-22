"use strict";
/* ============================================================
   club-gallery.js — Club Photo Gallery
============================================================ */

let allPhotos   = [];
let currentPhotoId = null;

document.addEventListener("DOMContentLoaded", () => {
  loadClubInfo();
  loadGallery();

  // File preview
  const fileInput = document.getElementById("photoFile");
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = e => {
          document.getElementById("photoPreview").src = e.target.result;
          document.getElementById("photoPreviewWrap").style.display = "block";
        };
        reader.readAsDataURL(file);
      }
    });
  }
});

function loadClubInfo() {
  fetch("/club/data", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById("avatarLetter");
      if (el) el.innerText = (d.name || "C")[0].toUpperCase();
    }).catch(() => {});
}

/* ── LOAD GALLERY ── */
function loadGallery() {
  fetch("/club/gallery/list", { credentials: "include" })
    .then(r => r.json())
    .then(photos => {
      allPhotos = photos;
      populateEventFilter(photos);
      renderGallery(photos);
    })
    .catch(() => {
      document.getElementById("galleryGrid").innerHTML =
        `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--red);">Failed to load gallery</div>`;
    });
}

function populateEventFilter(photos) {
  const events = [...new Set(photos.map(p => p.event_name).filter(Boolean))].sort();
  const sel = document.getElementById("filterEvent");
  if (!sel) return;
  sel.innerHTML = '<option value="">All Events</option>' +
    events.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join("");
}

function filterGallery() {
  const event  = document.getElementById("filterEvent")?.value  || "";
  const search = (document.getElementById("gallerySearch")?.value || "").toLowerCase();
  const filtered = allPhotos.filter(p =>
    (!event  || p.event_name === event) &&
    (!search || (p.title||"").toLowerCase().includes(search) ||
                (p.event_name||"").toLowerCase().includes(search))
  );
  renderGallery(filtered);
}

function renderGallery(photos) {
  const el = document.getElementById("galleryGrid");
  const count = document.getElementById("galleryCount");
  if (count) count.innerText = `${photos.length} photo${photos.length !== 1 ? "s" : ""}`;

  if (!photos.length) {
    el.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted);">
        <div style="font-size:44px;margin-bottom:12px;opacity:.4;">🖼️</div>
        <p style="margin-bottom:16px;">No photos yet. Upload your first one!</p>
        <button class="btn btn-primary" onclick="openUploadModal()">📤 Upload Photo</button>
      </div>`;
    return;
  }

  el.innerHTML = photos.map(p => {
    const isImg = p.file_type && p.file_type.startsWith("image/");
    const imgSrc = isImg ? `/uploads/gallery/${p.file_path.split("/").pop()}` : null;

    return `
      <div class="gallery-card" onclick="openLightbox(${p.id})">
        ${imgSrc
          ? `<img class="gallery-img" src="${imgSrc}" alt="${esc(p.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
             <div class="gallery-img-placeholder" style="display:none;">🖼️</div>`
          : `<div class="gallery-img-placeholder">🖼️</div>`}
        <div class="gallery-body">
          <div class="gallery-title">${esc(p.title)}</div>
          <div class="gallery-meta">
            ${p.event_name ? `🎉 ${esc(p.event_name)}` : ""}
            ${p.created_at ? ` · ${new Date(p.created_at).toLocaleDateString("en-IN")}` : ""}
          </div>
        </div>
      </div>`;
  }).join("");
}

/* ── LIGHTBOX ── */
function openLightbox(photoId) {
  const photo = allPhotos.find(p => p.id === photoId);
  if (!photo) return;
  currentPhotoId = photoId;

  const lb   = document.getElementById("lightbox");
  const img  = document.getElementById("lightboxImg");
  const cap  = document.getElementById("lightboxCaption");
  const del  = document.getElementById("lightboxDelete");

  const imgSrc = `/uploads/gallery/${photo.file_path.split("/").pop()}`;
  img.src  = imgSrc;
  img.alt  = photo.title;
  cap.innerHTML = `<strong>${esc(photo.title)}</strong>` +
    (photo.event_name ? ` · ${esc(photo.event_name)}` : "") +
    (photo.description ? `<br><span style="opacity:.6;">${esc(photo.description)}</span>` : "");

  del.onclick = (e) => { e.stopPropagation(); deletePhoto(photoId); };
  lb.classList.add("open");
}

function closeLightbox() {
  document.getElementById("lightbox")?.classList.remove("open");
}

/* ── UPLOAD ── */
function openUploadModal() {
  ["photoTitle","photoEvent","photoDesc"].forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
  document.getElementById("photoFile").value = "";
  document.getElementById("photoPreviewWrap").style.display = "none";
  const msg = document.getElementById("uploadMsg");
  msg.className = "msg"; msg.innerText = "";
  openModal("uploadModal");
}

function uploadPhoto() {
  const title    = document.getElementById("photoTitle").value.trim();
  const eventNm  = document.getElementById("photoEvent").value.trim();
  const desc     = document.getElementById("photoDesc").value.trim();
  const fileEl   = document.getElementById("photoFile");
  const msg      = document.getElementById("uploadMsg");

  if (!title)         { showMsg(msg, "error", "⚠️ Title is required"); return; }
  if (!fileEl.files?.length) { showMsg(msg, "error", "⚠️ Please select a photo"); return; }

  const file = fileEl.files[0];
  if (file.size > 10 * 1024 * 1024) { showMsg(msg, "error", "⚠️ File too large (max 10MB)"); return; }

  showMsg(msg, "info", "⏳ Uploading...");

  const fd = new FormData();
  fd.append("title",       title);
  fd.append("event_name",  eventNm);
  fd.append("description", desc);
  fd.append("photo",       file);

  fetch("/club/gallery/upload", {
    method: "POST", credentials: "include",
    body: fd
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Photo uploaded!");
      setTimeout(() => { closeModal("uploadModal"); loadGallery(); }, 800);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Upload failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

/* ── DELETE PHOTO ── */
function deletePhoto(id) {
  if (!confirm("Delete this photo permanently?")) return;
  fetch("/club/gallery/delete", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo_id: id })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) { closeLightbox(); loadGallery(); }
    else alert("Delete failed: " + (d.message || "Unknown error"));
  });
}

/* ── UTILITIES ── */
function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }
function showMsg(el, type, text) { if (!el) return; el.className = "msg " + type; el.innerText = text; }
function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
document.addEventListener("click", e => { if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open"); });

// Keyboard close for lightbox
document.addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });
