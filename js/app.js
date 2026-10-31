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
   A "subject" looks like:
     { id, name, attended, total, lastAction, lastMarkedDate }
   lastAction remembers the previous attended/total so "Undo last" works.
   lastMarkedDate is the date (YYYY-MM-DD) Attended/Missed was last tapped,
   used to only allow one tap per subject per day.
   --------------------------------------------------------------------- */

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Weekly timetable: for each weekday, the list of subject ids that have class
// that day, in class order. e.g. { mon: ["s_1", "s_2"], tue: [], ... }
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // matches Date.getDay()
const TIMETABLE_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};

function normalizeTimetable(raw, subjects) {
  const valid = new Set(subjects.map((s) => s.id));
  const result = {};
  for (const key of DAY_KEYS) {
    const list = raw && Array.isArray(raw[key]) ? raw[key] : [];
    result[key] = [...new Set(list)].filter((id) => valid.has(id));
  }
  return result;
}

function defaultData() {
  return {
    target: 75, // percent, e.g. 75 means 75%
    subjects: [],
    timetable: normalizeTimetable(null, []),
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
    parsed.timetable = normalizeTimetable(parsed.timetable, parsed.subjects);
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
const overallMsgEl = document.getElementById("overallMsg");
const heroBarFillEl = document.getElementById("heroBarFill");
const heroBarTargetEl = document.getElementById("heroBarTarget");

const ICON_ATTEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ICON_MISS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON_UNDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>';

// Simple SVG smiley faces used for mood (no emoji needed).
const MOOD = { green: "happy", yellow: "meh", red: "sad", neutral: "sleepy" };

function faceSvg(mood, fill, ink) {
  const eyes = mood === "sleepy"
    ? `<path d="M16 27H27M37 27H48" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`
    : `<circle cx="23" cy="26" r="3.8" fill="${ink}"/><circle cx="41" cy="26" r="3.8" fill="${ink}"/>`;
  const mouths = {
    happy: "M19 38Q32 53 45 38",
    meh: "M22 43H42",
    sad: "M22 48Q32 37 42 48",
    sleepy: "M25 42Q32 47 39 42",
  };
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="${fill}"/>${eyes}` +
    `<path d="${mouths[mood]}" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/></svg>`;
}

// Each subject gets its own bright colour tile, picked from its name so it stays the same.
const TILE_COLORS = ["#7C3AED", "#3B82F6", "#F97316", "#14B8A6", "#A855F7", "#0EA5E9"];
function tileColor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_COLORS[h % TILE_COLORS.length];
}

function buzz() {
  if (navigator.vibrate) navigator.vibrate(12);
}

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
  document.getElementById("heroFace").innerHTML = faceSvg(MOOD[status.color], "#fff", "#1F1147");
  heroBarFillEl.style.width = Math.min(100, pct * 100) + "%";
  heroBarTargetEl.style.left = state.target + "%";
  document.getElementById("heroTarget").textContent = `Target ${state.target}%`;

  if (state.subjects.length === 0) {
    overallSubEl.textContent = "No subjects yet";
    overallMsgEl.textContent = "Add your subjects to see how many classes you can skip.";
  } else if (totals.total === 0) {
    overallSubEl.textContent = "No classes recorded yet";
    overallMsgEl.textContent = "Mark your first class to get started.";
  } else {
    overallSubEl.textContent = `${totals.attended} of ${totals.total} classes attended`;
    overallMsgEl.textContent = status.message;
  }

  document.getElementById("todayDate").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  });
  const todayProgressEl = document.getElementById("todayProgress");
  const todayList = hasTimetable() ? todaysSubjects() : state.subjects;
  const markedCount = todayList.filter((s) => s.lastMarkedDate === todayStr()).length;
  const noClassesToday = hasTimetable() && todayList.length === 0;
  todayProgressEl.classList.toggle("hidden", state.subjects.length === 0);
  todayProgressEl.textContent = noClassesToday
    ? "No classes today"
    : `${markedCount} of ${todayList.length} marked today`;
  todayProgressEl.classList.toggle("all-done", todayList.length > 0 && markedCount === todayList.length);

  document.getElementById("statSubjects").textContent = state.subjects.length;
  document.getElementById("statAttended").textContent = totals.attended;
  document.getElementById("statMissed").textContent = totals.total - totals.attended;

  overallCardEl.className = "hero status-" + status.color;
}

/* ---- Timetable helpers: which subjects belong to today ---- */
let viewMode = "today"; // "today" = only today's timetable, "all" = every subject

function todayKey() {
  return DAY_KEYS[new Date().getDay()];
}

function hasTimetable() {
  return DAY_KEYS.some((k) => state.timetable[k].length > 0);
}

function subjectsOn(dayKey) {
  return state.timetable[dayKey]
    .map((id) => state.subjects.find((s) => s.id === id))
    .filter(Boolean);
}

function todaysSubjects() {
  return subjectsOn(todayKey());
}

function visibleSubjects() {
  if (!hasTimetable() || viewMode === "all") return state.subjects;
  return todaysSubjects();
}

function removeFromTimetable(id) {
  for (const key of DAY_KEYS) {
    state.timetable[key] = state.timetable[key].filter((x) => x !== id);
  }
}

function renderViewControls() {
  const showSwitch = state.subjects.length > 0 && hasTimetable();
  const switchEl = document.getElementById("viewSwitch");
  switchEl.classList.toggle("hidden", !showSwitch);
  if (showSwitch) {
    const todayBtn = switchEl.querySelector('[data-view="today"]');
    const allBtn = switchEl.querySelector('[data-view="all"]');
    todayBtn.textContent = `Today · ${todaysSubjects().length}`;
    allBtn.textContent = `All · ${state.subjects.length}`;
    todayBtn.classList.toggle("active", viewMode === "today");
    allBtn.classList.toggle("active", viewMode === "all");
  }
  document.getElementById("ttCtaTitle").textContent = hasTimetable()
    ? "Edit weekly timetable"
    : "Add your weekly timetable";
  document.getElementById("ttCtaSub").textContent = hasTimetable()
    ? "Change which subjects you have each day"
    : "Show only the subjects you have each day";
}

let renderedIds = new Set(); // cards already on screen, so only new ones animate in

function renderSubjects() {
  subjectListEl.innerHTML = "";
  renderViewControls();

  const list = visibleSubjects();

  if (state.subjects.length > 0 && list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </div>
      <div class="empty-title">No classes today</div>
      <div class="empty-text">Nothing in your timetable for ${DAY_NAMES[todayKey()]}. Switch to "All" to mark an extra class.</div>
    `;
    subjectListEl.appendChild(empty);
    return;
  }

  if (state.subjects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 8h7M9 12h5"/></svg>
      </div>
      <div class="empty-title">No subjects yet</div>
      <div class="empty-text">Add the subjects you're taking and start tracking your attendance in one tap.</div>
    `;
    subjectListEl.appendChild(empty);
    return;
  }

  for (const subject of list) {
    const card = buildSubjectCard(subject);
    if (!renderedIds.has(subject.id)) card.classList.add("card-enter");
    subjectListEl.appendChild(card);
  }
  renderedIds = new Set(list.map((s) => s.id));
}

function buildSubjectCard(subject) {
  const status = getStatus(subject.attended, subject.total, state.target);

  const card = document.createElement("div");
  card.className = "subject-card";
  card.dataset.id = subject.id;

  card.innerHTML = `
    <div class="sc-top">
      <div class="sc-tile"></div>
      <div class="sc-info">
        <div class="subject-name"></div>
        <div class="subject-count"></div>
      </div>
      <button class="icon-btn" data-action="menu" aria-label="More options" title="More">
        <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>
      </button>
    </div>
    <div class="sc-meter">
      <div class="sc-pct"></div>
      <div class="sc-bar">
        <div class="sc-bar-fill"></div>
        <div class="sc-bar-target"></div>
      </div>
    </div>
    <div class="status-pill"></div>
    <div class="subject-buttons">
      <button class="big-btn btn-attend" data-action="attend">${ICON_ATTEND}Attended</button>
      <button class="big-btn btn-miss" data-action="miss">${ICON_MISS}Missed</button>
    </div>
    <div class="today-row hidden">
      <span class="today-label"></span>
      <button class="undo-btn" data-action="undo">${ICON_UNDO}Undo</button>
    </div>
  `;

  card.classList.add("status-" + status.color);
  const nameEl = card.querySelector(".subject-name");
  nameEl.textContent = subject.name;
  if (hasTimetable() && viewMode === "all" && state.timetable[todayKey()].includes(subject.id)) {
    const chip = document.createElement("span");
    chip.className = "today-chip";
    chip.textContent = "Today";
    nameEl.append(" ", chip);
  }
  const missed = subject.total - subject.attended;
  card.querySelector(".subject-count").textContent =
    `${subject.attended} attended · ${missed} missed`;

  const tile = card.querySelector(".sc-tile");
  tile.textContent = (subject.name.trim()[0] || "?").toUpperCase();
  tile.style.background = tileColor(subject.name);

  const pct = subject.total > 0 ? subject.attended / subject.total : 0;
  card.querySelector(".sc-pct").textContent = subject.total > 0 ? Math.round(pct * 100) + "%" : "—";
  card.querySelector(".sc-bar-fill").style.width = Math.min(100, pct * 100) + "%";
  card.querySelector(".sc-bar-target").style.left = state.target + "%";

  const pill = card.querySelector(".status-pill");
  pill.className = "status-pill status-" + status.color;
  const pillFace = document.createElement("span");
  pillFace.className = "pill-face";
  pillFace.innerHTML = faceSvg(MOOD[status.color], "currentColor", "#fff");
  const pillText = document.createElement("span");
  pillText.textContent = status.message;
  pill.append(pillFace, pillText);

  const markedToday = subject.lastMarkedDate === todayStr();

  const attendBtn = card.querySelector('[data-action="attend"]');
  const missBtn = card.querySelector('[data-action="miss"]');
  // If the last tap raised "attended", it was an Attended tap; otherwise Missed.
  const chose = subject.lastAction
    ? (subject.attended > subject.lastAction.attended ? "attend" : "miss")
    : null;
  attendBtn.classList.toggle("is-locked", markedToday);
  missBtn.classList.toggle("is-locked", markedToday);
  attendBtn.classList.toggle("is-chosen", markedToday && chose === "attend");
  missBtn.classList.toggle("is-chosen", markedToday && chose === "miss");

  const todayRow = card.querySelector(".today-row");
  todayRow.classList.toggle("hidden", !markedToday);
  todayRow.querySelector(".today-label").textContent =
    chose === "attend" ? "Marked as attended today"
    : chose === "miss" ? "Marked as missed today"
    : "Already marked today";
  card.querySelector('[data-action="undo"]').disabled = !subject.lastAction;

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

// ---- Simple info popup with a single OK button ----
function showAlert(title, message) {
  document.getElementById("alertTitle").textContent = title;
  document.getElementById("alertMessage").textContent = message;
  document.getElementById("alertModal").classList.remove("hidden");
}
document.getElementById("alertOkBtn").addEventListener("click", () => {
  document.getElementById("alertModal").classList.add("hidden");
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
  // New subjects aren't in the timetable yet, so show everything so they're visible.
  if (hasTimetable()) viewMode = "all";
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
let menuSubjectId = null;

subjectListEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const card = e.target.closest(".subject-card");
  const subject = state.subjects.find((s) => s.id === card.dataset.id);
  if (!subject) return;

  if (btn.dataset.action === "menu") {
    menuSubjectId = subject.id;
    document.getElementById("subjectMenuTitle").textContent = subject.name;
    openModal("subjectMenuModal");
    return;
  }
  runSubjectAction(btn.dataset.action, subject);
});

document.querySelectorAll("[data-menu-action]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const subject = state.subjects.find((s) => s.id === menuSubjectId);
    closeModal("subjectMenuModal");
    if (subject) runSubjectAction(btn.dataset.menuAction, subject);
  });
});

function runSubjectAction(action, subject) {
  const id = subject.id;
  const today = todayStr();
  const alreadyMarkedToday = subject.lastMarkedDate === today;

  if ((action === "attend" || action === "miss") && alreadyMarkedToday) {
    showAlert(
      "Already marked for today",
      `You've already marked attendance for "${subject.name}" today. You can only do this once per day. Made a mistake? Tap "Undo last" to change it.`
    );
    return;
  }

  if (action === "attend") {
    subject.lastAction = { attended: subject.attended, total: subject.total, lastMarkedDate: subject.lastMarkedDate };
    subject.attended += 1;
    subject.total += 1;
    subject.lastMarkedDate = today;
    buzz();
    render();
  } else if (action === "miss") {
    subject.lastAction = { attended: subject.attended, total: subject.total, lastMarkedDate: subject.lastMarkedDate };
    subject.total += 1;
    subject.lastMarkedDate = today;
    buzz();
    render();
  } else if (action === "undo") {
    if (subject.lastAction && alreadyMarkedToday) {
      subject.attended = subject.lastAction.attended;
      subject.total = subject.lastAction.total;
      subject.lastMarkedDate = subject.lastAction.lastMarkedDate;
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
        removeFromTimetable(id);
        render();
        showToast("Subject deleted");
      }
    );
  }
}

// ---- Weekly timetable editor ----
const dayTabsEl = document.getElementById("dayTabs");
const ttChipsEl = document.getElementById("ttChips");
let ttDay = "mon"; // day currently being edited

function renderTimetableEditor() {
  dayTabsEl.innerHTML = "";
  for (const key of TIMETABLE_ORDER) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "day-tab";
    tab.dataset.day = key;
    const count = state.timetable[key].length;
    tab.classList.toggle("selected", key === ttDay);
    tab.classList.toggle("is-today", key === todayKey());
    const name = document.createElement("span");
    name.textContent = DAY_NAMES[key].slice(0, 3);
    const badge = document.createElement("small");
    badge.textContent = count > 0 ? String(count) : "–";
    tab.append(name, badge);
    dayTabsEl.appendChild(tab);
  }

  document.getElementById("dayLabel").textContent = `Subjects on ${DAY_NAMES[ttDay]} — tap in class order`;
  ttChipsEl.innerHTML = "";

  if (state.subjects.length === 0) {
    const note = document.createElement("p");
    note.className = "modal-hint";
    note.textContent = "Add your subjects first, then come back to build your timetable.";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-primary";
    addBtn.textContent = "Add subjects";
    addBtn.addEventListener("click", () => {
      closeModal("timetableModal");
      document.getElementById("addSubjectBtn").click();
    });
    ttChipsEl.append(note, addBtn);
    return;
  }

  const dayList = state.timetable[ttDay];
  for (const subject of state.subjects) {
    const idx = dayList.indexOf(subject.id);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "preset-chip" + (idx >= 0 ? " preset-chip-selected" : "");
    chip.dataset.id = subject.id;
    if (idx >= 0) {
      const order = document.createElement("span");
      order.className = "chip-order";
      order.textContent = String(idx + 1);
      chip.append(order);
    }
    chip.append(subject.name);
    ttChipsEl.appendChild(chip);
  }
}

dayTabsEl.addEventListener("click", (e) => {
  const tab = e.target.closest(".day-tab");
  if (!tab) return;
  ttDay = tab.dataset.day;
  renderTimetableEditor();
});

ttChipsEl.addEventListener("click", (e) => {
  const chip = e.target.closest(".preset-chip");
  if (!chip) return;
  const list = state.timetable[ttDay];
  const idx = list.indexOf(chip.dataset.id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(chip.dataset.id);
  render();
  renderTimetableEditor();
});

function openTimetable() {
  ttDay = todayKey();
  renderTimetableEditor();
  openModal("timetableModal");
}

document.getElementById("timetableBtn").addEventListener("click", openTimetable);
document.getElementById("timetableCta").addEventListener("click", openTimetable);

document.getElementById("viewSwitch").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-view]");
  if (!btn) return;
  viewMode = btn.dataset.view;
  render();
});

// ---- Settings modal ----
const targetInput = document.getElementById("targetInput");
const targetChips = document.querySelectorAll("#targetChips .preset-chip");

function highlightTargetChip() {
  targetChips.forEach((c) =>
    c.classList.toggle("preset-chip-selected", Number(c.dataset.target) === Number(targetInput.value))
  );
}

targetChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    targetInput.value = chip.dataset.target;
    highlightTargetChip();
  });
});
targetInput.addEventListener("input", highlightTargetChip);

document.getElementById("settingsBtn").addEventListener("click", () => {
  targetInput.value = state.target;
  highlightTargetChip();
  openModal("settingsModal");
});

// Escape closes whichever modal is open
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  document.querySelectorAll(".modal-overlay:not(.hidden)").forEach((o) => o.classList.add("hidden"));
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
        const importedSubjects = parsed.subjects.map((s) => ({
          id: s.id || makeId(),
          name: String(s.name || "Untitled"),
          attended: Math.max(0, Math.floor(Number(s.attended) || 0)),
          total: Math.max(0, Math.floor(Number(s.total) || 0)),
          lastAction: null,
        }));
        state = {
          target: Math.min(100, Math.max(1, Math.round(parsed.target))),
          subjects: importedSubjects,
          timetable: normalizeTimetable(parsed.timetable, importedSubjects),
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

   Because the app is cached for offline use, a phone that already has it
   open can otherwise keep running an old cached version even after a new
   one is deployed. To fix that, once a newly-installed service worker
   takes over, we reload the page once so the fresh version is picked up.
   --------------------------------------------------------------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });

  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });
}

/* ---------------------------------------------------------------------
   Initial render on page load
   --------------------------------------------------------------------- */
render();
