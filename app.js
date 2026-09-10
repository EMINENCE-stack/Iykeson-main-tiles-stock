/* ==========================================================================
   IYKESON TILES STOCK -- app.js

   HOW THE DATA MODEL WORKS (read this before editing anything):

   We do NOT store "current stock" as one editable number. Instead, we store
   two separate lists:

   1. ITEMS -- one entry per unique tile design (name + color + size + company)
      e.g. { id: "abc123", name: "Marble Grey Gloss", color: "Grey",
             size: "60x60", company: "Twyford", photo: "data:image/..." }

   2. MOVEMENTS -- a running log of every single add/remove event
      e.g. { id: "m1", itemId: "abc123", type: "add", quantity: 100,
             note: "New delivery", by: "Ade", date: "2026-08-10T10:00:00" }

   The CURRENT STOCK for any item is always CALCULATED by adding up its
   "add" movements and subtracting its "remove" movements -- never typed in
   directly. This means every change is traceable, and nobody can silently
   overwrite a number without leaving a record. See getCurrentStock() below.
   ========================================================================== */

// ---------- Constants ----------
const STORAGE_KEY_ITEMS = "iykeson_items";
const STORAGE_KEY_MOVEMENTS = "iykeson_movements";
const LOW_STOCK_THRESHOLD = 20;      // below this = "low" (clay/orange)
const CRITICAL_STOCK_THRESHOLD = 5;  // below this = "critical" (red)
const MAX_PHOTO_WIDTH = 400;         // photos are resized to this width before saving

// ---------- Storage helpers ----------
// localStorage can only store TEXT, so we convert our arrays/objects to and
// from JSON (JavaScript Object Notation) text every time we save/load.

function loadItems() {
  const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
  return raw ? JSON.parse(raw) : [];
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
}

function loadMovements() {
  const raw = localStorage.getItem(STORAGE_KEY_MOVEMENTS);
  return raw ? JSON.parse(raw) : [];
}

function saveMovements(movements) {
  localStorage.setItem(STORAGE_KEY_MOVEMENTS, JSON.stringify(movements));
}

// A simple way to generate a unique ID without needing any external library
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- Core calculation: current stock for one item ----------
function getCurrentStock(itemId, movements) {
  let total = 0;
  for (const m of movements) {
    if (m.itemId !== itemId) continue; // skip movements for OTHER items
    if (m.type === "add") {
      total += m.quantity;
    } else if (m.type === "remove") {
      total -= m.quantity;
    }
  }
  return total;
}

// ---------- Find an existing item matching name+color+size+company ----------
// Case-insensitive and trims extra spaces, so "grey" and " Grey " match the same item.
function findMatchingItem(items, name, color, size, company) {
  const norm = (s) => s.trim().toLowerCase();
  return items.find(item =>
    norm(item.name) === norm(name) &&
    norm(item.color) === norm(color) &&
    norm(item.size) === norm(size) &&
    norm(item.company) === norm(company)
  );
}

// ---------- Image resizing (keeps localStorage usage small) ----------
// localStorage has a small size limit (about 5-10MB total), so full-size
// phone photos would fill it up fast. This shrinks any photo down to
// MAX_PHOTO_WIDTH before we ever save it, using an in-memory <canvas>.
function resizeImageFile(file, callback) {
  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      const scale = MAX_PHOTO_WIDTH / img.width;
      const canvas = document.createElement("canvas");
      canvas.width = MAX_PHOTO_WIDTH;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // toDataURL converts the canvas image into a compressed base64 JPEG string
      const resizedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
      callback(resizedDataUrl);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// ==========================================================================
// TAB NAVIGATION
// ==========================================================================
function initTabs() {
  const navButtons = document.querySelectorAll(".nav-btn");
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;

      // Hide every panel, then show only the one that matches
      document.querySelectorAll(".tab-panel").forEach(panel => {
        panel.classList.toggle("active-tab", panel.id === targetId);
      });

      // Highlight the active nav button
      navButtons.forEach(b => b.classList.toggle("active", b === btn));

      // Refresh data every time we switch tabs, so numbers are always current
      renderAll();
    });
  });
}

// ==========================================================================
// DASHBOARD RENDERING
// ==========================================================================
function renderDashboard() {
  const items = loadItems();
  const movements = loadMovements();
  const grid = document.getElementById("stock-grid");
  const emptyState = document.getElementById("empty-state");

  const searchTerm = document.getElementById("search-input").value.trim().toLowerCase();
  const companyFilter = document.getElementById("filter-company").value;

  grid.innerHTML = ""; // clear before re-drawing

  let totalTiles = 0;
  let lowStockCount = 0;
  let visibleCount = 0;

  items.forEach(item => {
    const stock = getCurrentStock(item.id, movements);
    totalTiles += stock;
    if (stock < LOW_STOCK_THRESHOLD) lowStockCount++;

    // Apply search & filter -- skip drawing this card if it doesn't match
    const searchable = `${item.name} ${item.color} ${item.size} ${item.company}`.toLowerCase();
    if (searchTerm && !searchable.includes(searchTerm)) return;
    if (companyFilter && item.company !== companyFilter) return;

    visibleCount++;

    // Decide the color-coded stock level
    let levelClass = ""; // healthy (green) by default
    if (stock < CRITICAL_STOCK_THRESHOLD) levelClass = "level-critical";
    else if (stock < LOW_STOCK_THRESHOLD) levelClass = "level-low";

    const card = document.createElement("div");
    card.className = `stock-card ${levelClass}`;

    const photoHtml = item.photo
      ? `<img class="stock-card-photo" src="${item.photo}" alt="${item.name}">`
      : `<div class="stock-card-photo placeholder">No photo</div>`;

    card.innerHTML = `
      ${photoHtml}
      <div class="stock-card-body">
        <div class="stock-card-name">${item.name}</div>
        <div class="stock-card-meta">${item.color} &middot; ${item.size} &middot; ${item.company}</div>
        <div class="stock-card-qty">${stock}</div>
        <span class="stock-card-qty-label">tiles in stock</span>
      </div>
    `;
    grid.appendChild(card);
  });

  // Update the summary strip at the top
  document.getElementById("summary-designs").textContent = items.length;
  document.getElementById("summary-total").textContent = totalTiles;
  document.getElementById("summary-low").textContent = lowStockCount;

  emptyState.hidden = items.length > 0;
  grid.hidden = items.length === 0;
}

// Fills the "All Companies" filter dropdown with every unique company found
function renderCompanyFilterOptions() {
  const items = loadItems();
  const select = document.getElementById("filter-company");
  const currentValue = select.value;

  const uniqueCompanies = [...new Set(items.map(i => i.company))].sort();

  select.innerHTML = `<option value="">All Companies</option>`;
  uniqueCompanies.forEach(company => {
    const opt = document.createElement("option");
    opt.value = company;
    opt.textContent = company;
    select.appendChild(opt);
  });

  select.value = currentValue; // keep whatever was selected, if it still exists
}

// ==========================================================================
// ADD STOCK FORM
// ==========================================================================
function initAddForm() {
  const form = document.getElementById("add-form");
  const photoInput = document.getElementById("add-photo");
  const photoPreview = document.getElementById("add-photo-preview");

  let pendingPhotoDataUrl = null;

  // Show a live preview as soon as a photo is chosen/taken
  photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (!file) return;
    resizeImageFile(file, (dataUrl) => {
      pendingPhotoDataUrl = dataUrl;
      photoPreview.src = dataUrl;
      photoPreview.hidden = false;
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault(); // stops the page from reloading (default HTML form behaviour)

    const name = document.getElementById("add-name").value;
    const color = document.getElementById("add-color").value;
    const size = document.getElementById("add-size").value;
    const company = document.getElementById("add-company").value;
    const quantity = parseInt(document.getElementById("add-quantity").value, 10);
    const note = document.getElementById("add-note").value;
    const by = document.getElementById("add-by").value;

    const items = loadItems();
    const movements = loadMovements();

    // Reuse an existing item if this exact design already exists, otherwise create one
    let item = findMatchingItem(items, name, color, size, company);
    if (!item) {
      item = {
        id: generateId(),
        name: name.trim(),
        color: color.trim(),
        size: size.trim(),
        company: company.trim(),
        photo: pendingPhotoDataUrl || null,
      };
      items.push(item);
    } else if (pendingPhotoDataUrl) {
      item.photo = pendingPhotoDataUrl; // update photo if a new one was provided
    }

    movements.push({
      id: generateId(),
      itemId: item.id,
      type: "add",
      quantity: quantity,
      note: note.trim(),
      by: by.trim(),
      date: new Date().toISOString(),
    });

    saveItems(items);
    saveMovements(movements);

    form.reset();
    photoPreview.hidden = true;
    pendingPhotoDataUrl = null;

    renderAll();
    goToTab("dashboard"); // jump back to the dashboard so they see the update immediately
  });
}

// ==========================================================================
// REMOVE STOCK FORM
// ==========================================================================
function renderRemoveDropdown() {
  const items = loadItems();
  const movements = loadMovements();
  const select = document.getElementById("remove-item");
  const currentValue = select.value;

  select.innerHTML = `<option value="">-- choose a design --</option>`;
  items.forEach(item => {
    const stock = getCurrentStock(item.id, movements);
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = `${item.name} (${item.color}, ${item.size}) -- ${stock} in stock`;
    select.appendChild(opt);
  });

  select.value = currentValue;
}

function initRemoveForm() {
  const form = document.getElementById("remove-form");
  const itemSelect = document.getElementById("remove-item");
  const currentStockDisplay = document.getElementById("remove-current-stock");

  // Show the current stock whenever a design is picked, so the person knows
  // what they're working with before typing a quantity
  itemSelect.addEventListener("change", () => {
    const movements = loadMovements();
    if (!itemSelect.value) {
      currentStockDisplay.textContent = "";
      return;
    }
    const stock = getCurrentStock(itemSelect.value, movements);
    currentStockDisplay.textContent = `Current stock: ${stock} tiles`;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const itemId = itemSelect.value;
    const quantity = parseInt(document.getElementById("remove-quantity").value, 10);
    const reason = document.getElementById("remove-reason").value;
    const by = document.getElementById("remove-by").value;

    const movements = loadMovements();
    const currentStock = getCurrentStock(itemId, movements);

    // Warn (but don't block) if removing more than what's recorded as in stock --
    // this can legitimately happen with a recount correction, so we just confirm.
    if (quantity > currentStock) {
      const proceed = confirm(
        `This will take stock below zero (current: ${currentStock}). Continue anyway?`
      );
      if (!proceed) return;
    }

    movements.push({
      id: generateId(),
      itemId: itemId,
      type: "remove",
      quantity: quantity,
      note: reason,
      by: by.trim(),
      date: new Date().toISOString(),
    });

    saveMovements(movements);
    form.reset();
    currentStockDisplay.textContent = "";

    renderAll();
    goToTab("dashboard");
  });
}

// ==========================================================================
// HISTORY RENDERING
// ==========================================================================
function renderHistory() {
  const items = loadItems();
  const movements = loadMovements();
  const list = document.getElementById("history-list");
  const emptyState = document.getElementById("history-empty");

  list.innerHTML = "";

  // Show newest first -- slice() copies the array so we don't reorder the saved data itself
  const sorted = movements.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(m => {
    const item = items.find(i => i.id === m.itemId);
    const itemName = item ? item.name : "(deleted design)";
    const dateLabel = new Date(m.date).toLocaleString();
    const sign = m.type === "add" ? "+" : "-";

    const entry = document.createElement("div");
    entry.className = "history-entry";
    entry.innerHTML = `
      <div class="history-entry-main">
        <div class="history-entry-name">${itemName}</div>
        <div class="history-entry-meta">${m.note || ""} ${m.by ? "&middot; by " + m.by : ""} &middot; ${dateLabel}</div>
      </div>
      <div class="history-qty ${m.type}">${sign}${m.quantity}</div>
    `;
    list.appendChild(entry);
  });

  emptyState.hidden = movements.length > 0;
  list.hidden = movements.length === 0;
}

// ==========================================================================
// BACKUP / RESTORE
// ==========================================================================
function initBackup() {
  document.getElementById("btn-export-json").addEventListener("click", () => {
    const data = {
      items: loadItems(),
      movements: loadMovements(),
      exportedAt: new Date().toISOString(),
    };
    downloadFile(
      `iykeson-tiles-backup-${todayForFilename()}.json`,
      JSON.stringify(data, null, 2),
      "application/json"
    );
  });

  document.getElementById("btn-export-csv").addEventListener("click", () => {
    const items = loadItems();
    const movements = loadMovements();

    let csv = "Design Name,Color,Size,Company,Current Stock\n";
    items.forEach(item => {
      const stock = getCurrentStock(item.id, movements);
      // Wrap each field in quotes in case a name contains a comma
      csv += `"${item.name}","${item.color}","${item.size}","${item.company}",${stock}\n`;
    });

    downloadFile(`iykeson-tiles-report-${todayForFilename()}.csv`, csv, "text/csv");
  });

  document.getElementById("restore-input").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const proceed = confirm(
          "This will REPLACE all current data on this device with the backup file. Continue?"
        );
        if (!proceed) return;

        saveItems(data.items || []);
        saveMovements(data.movements || []);
        renderAll();
        alert("Backup restored successfully.");
      } catch (err) {
        alert("This doesn't look like a valid backup file.");
      }
    };
    reader.readAsText(file);
  });
}

// Creates a downloadable file directly in the browser (no server needed)
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function todayForFilename() {
  return new Date().toISOString().slice(0, 10); // e.g. "2026-08-10"
}

// ==========================================================================
// MISC HELPERS
// ==========================================================================
function goToTab(tabId) {
  document.querySelector(`.nav-btn[data-target="${tabId}"]`).click();
}

function setTodayDate() {
  const el = document.getElementById("today-date");
  el.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

function initSearchAndFilter() {
  document.getElementById("search-input").addEventListener("input", renderDashboard);
  document.getElementById("filter-company").addEventListener("change", renderDashboard);
}

// Re-runs every render function -- called after any data change so the whole
// app (dashboard, dropdowns, history) always reflects the latest saved data
function renderAll() {
  renderCompanyFilterOptions();
  renderDashboard();
  renderRemoveDropdown();
  renderHistory();
}

// ==========================================================================
// STARTUP
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  setTodayDate();
  initTabs();
  initAddForm();
  initRemoveForm();
  initBackup();
  initSearchAndFilter();
  renderAll();
});
