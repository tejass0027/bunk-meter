/* ==========================================================================
   Bunk Meter — app.js
   All of the app's logic lives in this one file:
     1. Data storage (load/save to localStorage)
     2. The attendance math (percentage, skip/attend targets)
     3. Rendering (turning data into HTML on the screen)
     4. Event handlers (what happens when you tap buttons)
   Read it top to bottom — later sections use functions defined above them.
   ========================================================================== */

const STORAGE_KEY = "bunkmeter_data_v1";

/* ---------------------------------------------------------------------
   1. DATA: what we store and how we load/save it
   A "subject" looks like: { id, name, attended, total, lastAction }
   lastAction remembers the previous attended/total so "Undo last" works.
   --------------------------------------------------------------------- */

function defaultData() {
  return {
    target: 75, // percent, e.g. 75 means 75%
    subjects: [],
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultData();
    if (!Array.isArray(parsed.subjects)) parsed.subjects = [];
    if (typeof parsed.target !== "number" || parsed.target <= 0 || parsed.target > 100) {
      parsed.target = 75;
    }
    return parsed;
  } catch (e) {
    console.error("Could not read saved data, starting fresh.", e);
    return defaultData();
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadData();

function makeId() {
  return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/* ---------------------------------------------------------------------
   2. MATH: the core attendance formulas.
   target is given here as a fraction (0.75), not a percent (75).
   --------------------------------------------------------------------- */

function getPercent(attended, total) {
  if (total <= 0) return null; // no classes recorded yet
  return attended / total;
}

// How many more classes can be skipped while staying at/above target.
function classesCanSkip(attended, total, target) {
  return Math.floor((attended - target * total) / target);
}

// How many classes must be attended IN A ROW to reach target.
function classesNeededInARow(attended, total, target) {
  return Math.ceil((target * total - attended) / (1 - target));
}

// Figures out the color status + message shown on a subject card.
function getStatus(attended, total, targetPercent) {
  const target = targetPercent / 100;

  if (total <= 0) {
    return {
      color: "neutral",
      pctLabel: "—",
      message: "No classes recorded yet — mark your first one!",
    };
  }

  const pct = getPercent(attended, total);
  const pctLabel = Math.round(pct * 1000) / 10 + "%"; // one decimal place

  // Special case: a 100% target can never be recovered once a class is missed,
  // because attended can never exceed total. Avoid dividing by (1 - target) = 0.
  if (target >= 1) {
    if (attended === total) {
      return { color: "green", pctLabel, message: "Perfect record! Skip 0 classes to stay at 100%." };
    }
    return { color: "red", pctLabel, message: "Target of 100% can't be reached again this term." };
  }

  const diff = pct - target; // e.g. +0.06 means 6 points above target

  let color;
  if (diff >= 0.05) color = "green";
  else if (diff >= -0.05) color = "yellow";
  else color = "red";

  let message;
  if (pct >= target) {
    const n = classesCanSkip(attended, total, target);
    message = n > 0
      ? `You can skip ${n} more class${n === 1 ? "" : "es"}`
      : "Right on target — skipping one now would drop you below it";
  } else {
    const n = classesNeededInARow(attended, total, target);
    message = `Attend the next ${n} class${n === 1 ? "" : "es"} in a row to reach target`;
  }

  return { color, pctLabel, message };
}

/* ---------------------------------------------------------------------
   3. RENDERING: draw the current `state` onto the page.
   --------------------------------------------------------------------- */

const subjectListEl = document.getElementById("subjectList");
const overallCardEl = document.getElementById("overallCard");
const overallPctEl = document.getElementById("overallPct");
const overallSubEl = document.getElementById("overallSub");
const overallRingEl = document.getElementById("overallRingProgress");
const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // matches the r=52 circle in index.html

function renderOverall() {
  const totals = state.subjects.reduce(
    (acc, s) => {
      acc.attended += s.attended;
      acc.total += s.total;
      return acc;
    },
    { attended: 0, total: 0 }
  );

  const status = getStatus(totals.attended, totals.total, state.target);
  overallPctEl.textContent = status.pctLabel;

  const pct = totals.total > 0 ? totals.attended / totals.total : 0;
  overallRingEl.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - pct));

  if (state.subjects.length === 0) {
    overallSubEl.textContent = "Add a subject to get started";
  } else if (totals.total === 0) {
    overallSubEl.textContent = "No classes recorded yet";
  } else {
    overallSubEl.textContent = `${totals.attended} / ${totals.total} classes • target ${state.target}%`;
  }

  overallCardEl.className = "overall-card status-" + status.color;
}

function renderSubjects() {
  subjectListEl.innerHTML = "";

  if (state.subjects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No subjects yet. Tap “+ Add Subject” below to start tracking.";
    subjectListEl.appendChild(empty);
    return;
  }

  for (const subject of state.subjects) {
    subjectListEl.appendChild(buildSubjectCard(subject));
  }
}

function buildSubjectCard(subject) {
  const status = getStatus(subject.attended, subject.total, state.target);

  const card = document.createElement("div");
  card.className = "subject-card";
  card.dataset.id = subject.id;

  card.innerHTML = `
    <div class="subject-card-head">
      <div class="subject-name"></div>
      <div class="subject-head-actions">
        <button class="icon-btn" data-action="edit-counts" title="Edit counts">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </button>
        <button class="icon-btn" data-action="rename" title="Rename">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="icon-btn" data-action="delete" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
    <div class="subject-stats-row">
      <span class="subject-pct"></span>
      <span class="subject-count"></span>
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-bar-fill"></div>
      <div class="progress-target-marker"></div>
    </div>
    <div class="status-pill"></div>
    <div class="subject-buttons">
      <button class="big-btn btn-attend" data-action="attend">✅ Attended</button>
      <button class="big-btn btn-miss" data-action="miss">❌ Missed</button>
    </div>
    <button class="undo-btn" data-action="undo">↩️ Undo last</button>
  `;

  card.querySelector(".subject-name").textContent = subject.name;
  card.querySelector(".subject-pct").textContent = status.pctLabel;
  card.querySelector(".subject-count").textContent = `${subject.attended} / ${subject.total} classes`;

  const pill = card.querySelector(".status-pill");
  pill.textContent = status.message;
  pill.className = "status-pill status-" + status.color;

  const pct = subject.total > 0 ? subject.attended / subject.total : 0;
  const fill = card.querySelector(".progress-bar-fill");
  fill.style.width = Math.min(100, pct * 100) + "%";
  fill.className = "progress-bar-fill status-" + status.color;
  card.querySelector(".progress-target-marker").style.left = state.target + "%";

  const undoBtn = card.querySelector('[data-action="undo"]');
  undoBtn.disabled = !subject.lastAction;

  return card;
}

function render() {
  renderOverall();
  renderSubjects();
  saveData();
}

/* ---------------------------------------------------------------------
   4. EVENT HANDLERS
   --------------------------------------------------------------------- */

// ---- Toast (small confirmation popup) ----
let toastTimer = null;
function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
}

// ---- Generic confirm dialog ----
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMessage = document.getElementById("confirmMessage");
const confirmOkBtn = document.getElementById("confirmOkBtn");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
let confirmCallback = null;

function askConfirm(title, message, onConfirm) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmCallback = onConfirm;
  confirmModal.classList.remove("hidden");
}
confirmOkBtn.addEventListener("click", () => {
  confirmModal.classList.add("hidden");
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
});
confirmCancelBtn.addEventListener("click", () => {
  confirmModal.classList.add("hidden");
  confirmCallback = null;
});

// ---- Generic modal open/close helpers ----
function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}
function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}
document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
});
// Tapping the dark overlay (outside the modal box) also closes it
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
});

// ---- Add / Rename subject modal ----
const subjectModal = document.getElementById("subjectModal");
const subjectModalTitle = document.getElementById("subjectModalTitle");
const subjectNameInput = document.getElementById("subjectNameInput");
const subjectNameLabel = document.getElementById("subjectNameLabel");
const saveSubjectBtn = document.getElementById("saveSubjectBtn");
const presetSection = document.getElementById("presetSection");
const presetChipsEl = document.getElementById("presetChips");
let editingSubjectId = null; // null = adding a new subject

// A prefilled list of common college subjects, shown as tappable chips so
// students can just pick the ones they're taking instead of typing each one.
// Tap as many as apply, then hit the button — all of them get added at once.
const SUBJECT_PRESETS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "English",
  "Statistics", "Economics", "Environmental Science", "Communication Skills",
  "Data Structures", "Algorithms", "Database Management Systems",
  "Operating Systems", "Computer Networks", "Object Oriented Programming",
  "Software Engineering", "Web Development", "Machine Learning",
  "Artificial Intelligence", "Data Science", "Discrete Mathematics",
  "Digital Electronics", "Microprocessors", "Electrical Circuits",
  "Mechanics", "Thermodynamics", "Accounting", "Business Management",
  "Psychology",
];

function selectedPresetNames() {
  return [...presetChipsEl.querySelectorAll(".preset-chip-selected")].map((c) => c.dataset.name);
}

function updateSaveButtonLabel() {
  if (editingSubjectId) {
    saveSubjectBtn.textContent = "Save";
    return;
  }
  const count = selectedPresetNames().length;
  saveSubjectBtn.textContent = count > 0 ? `Add ${count} Subject${count === 1 ? "" : "s"}` : "Add Subject";
}

function renderPresetChips() {
  const takenNames = new Set(state.subjects.map((s) => s.name.toLowerCase()));
  presetChipsEl.innerHTML = "";

  for (const name of SUBJECT_PRESETS) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "preset-chip";
    chip.textContent = name;
    chip.dataset.name = name;

    if (takenNames.has(name.toLowerCase())) {
      chip.classList.add("preset-chip-added");
      chip.disabled = true;
    } else {
      chip.addEventListener("click", () => {
        chip.classList.toggle("preset-chip-selected");
        updateSaveButtonLabel();
      });
    }

    presetChipsEl.appendChild(chip);
  }
}

document.getElementById("addSubjectBtn").addEventListener("click", () => {
  editingSubjectId = null;
  subjectModalTitle.textContent = "Add Subject";
  subjectNameLabel.textContent = "Add a custom subject (optional)";
  subjectNameInput.value = "";
  presetSection.classList.remove("hidden");
  renderPresetChips();
  updateSaveButtonLabel();
  openModal("subjectModal");
});

saveSubjectBtn.addEventListener("click", () => {
  if (editingSubjectId) {
    const name = subjectNameInput.value.trim();
    if (!name) {
      subjectNameInput.focus();
      return;
    }
    const subject = state.subjects.find((s) => s.id === editingSubjectId);
    if (subject) subject.name = name;
    closeModal("subjectModal");
    render();
    return;
  }

  // Adding: combine every selected preset chip with the optional custom name.
  const names = selectedPresetNames();
  const customName = subjectNameInput.value.trim();
  if (customName) names.push(customName);

  if (names.length === 0) {
    subjectNameInput.focus();
    return;
  }

  const existing = new Set(state.subjects.map((s) => s.name.toLowerCase()));
  let added = 0;
  for (const name of names) {
    if (existing.has(name.toLowerCase())) continue; // skip duplicates
    state.subjects.push({
      id: makeId(),
      name,
      attended: 0,
      total: 0,
      lastAction: null,
    });
    existing.add(name.toLowerCase());
    added++;
  }

  closeModal("subjectModal");
  render();
  showToast(added === 1 ? "Added 1 subject" : `Added ${added} subjects`);
});

// ---- Edit counts modal ----
const editCountsModal = document.getElementById("editCountsModal");
const editAttendedInput = document.getElementById("editAttendedInput");
const editTotalInput = document.getElementById("editTotalInput");
const editCountsError = document.getElementById("editCountsError");
const saveCountsBtn = document.getElementById("saveCountsBtn");
let editingCountsId = null;

saveCountsBtn.addEventListener("click", () => {
  const subject = state.subjects.find((s) => s.id === editingCountsId);
  if (!subject) return;

  const attended = Math.max(0, Math.floor(Number(editAttendedInput.value) || 0));
  const total = Math.max(0, Math.floor(Number(editTotalInput.value) || 0));

  if (attended > total) {
    editCountsError.classList.remove("hidden");
    return;
  }
  editCountsError.classList.add("hidden");

  subject.attended = attended;
  subject.total = total;
  subject.lastAction = null; // manual edits invalidate undo history

  closeModal("editCountsModal");
  render();
});

// ---- Subject card button clicks (event delegation) ----
subjectListEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const card = e.target.closest(".subject-card");
  const id = card.dataset.id;
  const subject = state.subjects.find((s) => s.id === id);
  if (!subject) return;
  const action = btn.dataset.action;

  if (action === "attend") {
    subject.lastAction = { attended: subject.attended, total: subject.total };
    subject.attended += 1;
    subject.total += 1;
    render();
  } else if (action === "miss") {
    subject.lastAction = { attended: subject.attended, total: subject.total };
    subject.total += 1;
    render();
  } else if (action === "undo") {
    if (subject.lastAction) {
      subject.attended = subject.lastAction.attended;
      subject.total = subject.lastAction.total;
      subject.lastAction = null;
      render();
    }
  } else if (action === "edit-counts") {
    editingCountsId = id;
    editAttendedInput.value = subject.attended;
    editTotalInput.value = subject.total;
    editCountsError.classList.add("hidden");
    openModal("editCountsModal");
  } else if (action === "rename") {
    editingSubjectId = id;
    subjectModalTitle.textContent = "Rename Subject";
    subjectNameLabel.textContent = "Subject name";
    subjectNameInput.value = subject.name;
    presetSection.classList.add("hidden");
    updateSaveButtonLabel();
    openModal("subjectModal");
    subjectNameInput.focus();
  } else if (action === "delete") {
    askConfirm(
      "Delete subject?",
      `This will permanently delete "${subject.name}" and its attendance history.`,
      () => {
        state.subjects = state.subjects.filter((s) => s.id !== id);
        render();
        showToast("Subject deleted");
      }
    );
  }
});

// ---- Settings modal ----
const targetInput = document.getElementById("targetInput");

document.getElementById("settingsBtn").addEventListener("click", () => {
  targetInput.value = state.target;
  openModal("settingsModal");
});

document.getElementById("saveTargetBtn").addEventListener("click", () => {
  let value = Math.round(Number(targetInput.value));
  if (!Number.isFinite(value) || value < 1) value = 1;
  if (value > 100) value = 100;
  state.target = value;
  targetInput.value = value;
  render();
  showToast(`Target set to ${value}%`);
});

// ---- Reset all data ----
document.getElementById("resetDataBtn").addEventListener("click", () => {
  askConfirm(
    "Reset all data?",
    "This deletes every subject and all attendance history on this device. This cannot be undone.",
    () => {
      state = defaultData();
      render();
      closeModal("settingsModal");
      showToast("All data has been reset");
    }
  );
});

// ---- Export data ----
document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `bunk-meter-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Backup file downloaded");
});

// ---- Import data ----
const importFileInput = document.getElementById("importFileInput");
document.getElementById("importBtn").addEventListener("click", () => importFileInput.click());

importFileInput.addEventListener("change", () => {
  const file = importFileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (e) {
      showToast("That file isn't valid JSON");
      importFileInput.value = "";
      return;
    }

    if (!parsed || !Array.isArray(parsed.subjects) || typeof parsed.target !== "number") {
      showToast("That file doesn't look like a Bunk Meter backup");
      importFileInput.value = "";
      return;
    }

    askConfirm(
      "Import data?",
      "This will replace all current subjects and settings with the contents of the backup file.",
      () => {
        state = {
          target: Math.min(100, Math.max(1, Math.round(parsed.target))),
          subjects: parsed.subjects.map((s) => ({
            id: s.id || makeId(),
            name: String(s.name || "Untitled"),
            attended: Math.max(0, Math.floor(Number(s.attended) || 0)),
            total: Math.max(0, Math.floor(Number(s.total) || 0)),
            lastAction: null,
          })),
        };
        render();
        closeModal("settingsModal");
        showToast("Data imported successfully");
      }
    );
    importFileInput.value = "";
  };
  reader.readAsText(file);
});

/* ---------------------------------------------------------------------
   5. PWA: register the service worker so the app works offline and can
   be installed. This silently does nothing on browsers without support.
   --------------------------------------------------------------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}

/* ---------------------------------------------------------------------
   Initial render on page load
   --------------------------------------------------------------------- */
render();
