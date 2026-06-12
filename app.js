import { coachingRules, focusTags, program, muscleMapping } from "./workout-data.js";

const elements = {
  pageShell: document.querySelector(".page-shell"),
  focusTags: document.querySelector("#focus-tags"),
  programGrid: document.querySelector("#program-grid"),
  dayTabs: document.querySelector("#day-tabs"),
  detailPanel: document.querySelector("#detail-panel"),
  coachingGrid: document.querySelector("#coaching-grid"),
  printButton: document.querySelector("#print-plan"),
  expandButton: document.querySelector("#expand-all"),
  themeButton: document.querySelector("#theme-toggle"),
  dashboardStimulus: document.querySelector("#dashboard-stimulus"),
  trackerPanel: document.querySelector("#workout-tracker-panel"),
};


let activeDay = program[0].letter;
let expandedAlternatives = new Set(program.flatMap((day) => day.exercises.map((exercise) => exerciseKey(day, exercise))));
let allExpanded = true;
let exerciseMedia = new Map();
let selectedAlternatives = new Map();

// Session Caching & Storage
const MEDIA_CACHE_NAME = "fit-pulse-media-cache-v1";
let workoutLogs = {};
try {
  const storedLogs = localStorage.getItem("fit_pulse_workout_logs");
  workoutLogs = storedLogs ? JSON.parse(storedLogs) : {};
  if (typeof workoutLogs !== "object" || workoutLogs === null) {
    workoutLogs = {};
  }
} catch (e) {
  console.error("Failed to parse workout logs, resetting:", e);
  workoutLogs = {};
}
let activeSession = null;
let sessionTimerInterval = null;
let restTimerInterval = null;
let restTimeRemaining = 0;
let restTimerTotal = 0;
let restTimerNextExerciseName = "";

// Web Audio API beep generator
function playTimerBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // 800Hz beep
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    console.warn("Audio Context blocked or not supported:", e);
  }
}

// Progressive Overload Logic
function getProgressiveOverloadRecommendation(exerciseName, targetRepsStr) {
  const normalized = exerciseName.toLowerCase().trim();
  const history = workoutLogs[normalized];
  if (!history || !history.length) {
    return null;
  }

  // Get the most recent session before this one
  const lastSession = history[history.length - 1];
  if (!lastSession || !lastSession.sets || !lastSession.sets.length) {
    return null;
  }

  // Parse target reps upper bound. e.g. "8-12" -> 12, "5-8" -> 8, "10-15" -> 15
  const repMatch = targetRepsStr.match(/(\d+)\s*(reps|time|sec|m)?$/i);
  let upperBound = 0;
  if (repMatch) {
    upperBound = parseInt(repMatch[1], 10);
  } else {
    const num = parseInt(targetRepsStr, 10);
    if (!isNaN(num)) upperBound = num;
  }

  if (upperBound <= 0) return null;

  // Check if all completed sets achieved or exceeded the upper bound
  const completedSets = lastSession.sets.filter(s => s.completed);
  if (completedSets.length === 0) return null;

  const allTargetMet = completedSets.every(s => s.reps >= upperBound);

  if (allTargetMet) {
    const maxWeight = Math.max(...completedSets.map(s => s.weight || 0));
    const muscles = muscleMapping[normalized] || [];
    const isLowerBody = muscles.includes("Quads") || muscles.includes("Hamstrings") || muscles.includes("Calves") || muscles.includes("Glutes");
    const weightInc = isLowerBody ? "5 kg" : "2.5 kg";

    return {
      achieved: true,
      lastWeight: maxWeight,
      lastReps: completedSets.map(s => s.reps).join(", "),
      recommendation: `🔥 Overload Met: You hit ${maxWeight}kg x ${completedSets[0].reps} reps on all sets. Try adding +${weightInc} or +1-2 reps today!`
    };
  }

  return null;
}

// Calculate lats and shoulders target vs. completed sets
function getStimulusData(dayLetter, isSessionActive = false) {
  const day = program.find(d => d.letter === dayLetter);
  if (!day) return { latsTarget: 0, latsCompleted: 0, shouldersTarget: 0, shouldersCompleted: 0 };

  let latsTarget = 0;
  let latsCompleted = 0;
  let shouldersTarget = 0;
  let shouldersCompleted = 0;

  day.exercises.forEach(ex => {
    const activeName = isSessionActive && activeSession?.swappedExercises?.[ex.name]
      ? activeSession.swappedExercises[ex.name]
      : ex.name;

    const normalized = activeName.toLowerCase().trim();
    const muscles = muscleMapping[normalized] || [];
    const numSets = parseInt(ex.sets, 10) || 0;

    const isLats = muscles.includes("Lats");
    const isShoulders = muscles.includes("Side Delts") || muscles.includes("Rear Delts");

    if (isLats) latsTarget += numSets;
    if (isShoulders) shouldersTarget += numSets;

    if (isSessionActive && activeSession?.logs[ex.name]) {
      const completedSets = activeSession.logs[ex.name].filter(s => s.completed).length;
      if (isLats) latsCompleted += completedSets;
      if (isShoulders) shouldersCompleted += completedSets;
    }
  });

  return { latsTarget, latsCompleted, shouldersTarget, shouldersCompleted };
}

// Render Stimulus Score Card
function renderStimulusDashboardMarkup(dayLetter, isSessionActive = false) {
  const { latsTarget, latsCompleted, shouldersTarget, shouldersCompleted } = getStimulusData(dayLetter, isSessionActive);

  if (latsTarget === 0 && shouldersTarget === 0) {
    return `<div class="stimulus-dashboard" style="display:none;"></div>`;
  }

  const latsPct = latsTarget > 0 ? Math.round((latsCompleted / latsTarget) * 100) : 0;
  const shouldersPct = shouldersTarget > 0 ? Math.round((shouldersCompleted / shouldersTarget) * 100) : 0;

  const strokeDash = 150.8;
  const latsOffset = strokeDash - (latsPct / 100) * strokeDash;
  const shouldersOffset = strokeDash - (shouldersPct / 100) * strokeDash;

  const latsLabel = isSessionActive ? `${latsCompleted}/${latsTarget} Sets` : `${latsTarget} Sets Target`;
  const shouldersLabel = isSessionActive ? `${shouldersCompleted}/${shouldersTarget} Sets` : `${shouldersTarget} Sets Target`;

  return `
    <div class="stimulus-dashboard">
      <article class="stimulus-card lats">
        <div class="stimulus-info">
          <h4>Lat Width Stimulus</h4>
          <strong>${latsPct}%</strong>
          <p>${latsLabel}</p>
        </div>
        <div class="stimulus-progress">
          <svg>
            <circle class="bg-ring" cx="29" cy="29" r="24"></circle>
            <circle class="fill-ring" cx="29" cy="29" r="24" stroke-dasharray="${strokeDash}" stroke-dashoffset="${latsOffset}"></circle>
          </svg>
          <span class="stimulus-pct">${latsPct}%</span>
        </div>
      </article>

      <article class="stimulus-card shoulders">
        <div class="stimulus-info">
          <h4>Deltoid Stimulus</h4>
          <strong>${shouldersPct}%</strong>
          <p>${shouldersLabel}</p>
        </div>
        <div class="stimulus-progress">
          <svg>
            <circle class="bg-ring" cx="29" cy="29" r="24"></circle>
            <circle class="fill-ring" cx="29" cy="29" r="24" stroke-dasharray="${strokeDash}" stroke-dashoffset="${shouldersOffset}"></circle>
          </svg>
          <span class="stimulus-pct">${shouldersPct}%</span>
        </div>
      </article>
    </div>
  `;
}


const WORKOUTX_API_KEY = "wx_2f5e7d97345de8a1af152ca4bc65f17f969d18997ef865004f66cf18";
const WORKOUTX_API_BASE_URL = "https://api.workoutxapp.com/v1";
const WORKOUTX_ALIASES = {
  "45 degree back extension": "Back Extension",
  "ab wheel rollout": "Wheel Rollout",
  "back squat": "Barbell Full Squat",
  "barbell bench press": "Barbell Bench Press",
  "cable chest fly": "Cable Fly",
  "cable lateral raise": "Cable Lateral Raise",
  "chest supported row": "Seated Row",
  "decline sit up": "Decline Sit-up",
  "ez bar curl": "Barbell Curl",
  "face pull": "Cable Rear Delt Row",
  "front squat": "Barbell Front Squat",
  "incline dumbbell press": "Dumbbell Press",
  "overhead cable triceps extension": "Overhead Triceps Extension",
  "pallof press": "Pallof Press",
  "rope triceps pushdown": "Rope Triceps Extension",
  "seated dumbbell shoulder press": "Dumbbell Seated Shoulder Press",
  "standing calf raise": "Barbell Standing Leg Calf Raise",
  "straight arm pulldown": "Straight Arm Pulldown",
  "wide grip lat pulldown": "Lat Pulldown",
};
const WORKOUTX_SEEDS = {
  "ab wheel rollout": { id: "0857", name: "Wheel Rollout", gifUrl: "https://api.workoutxapp.com/v1/gifs/0857.gif" },
  "back squat": { id: "0043", name: "Barbell Full Squat", gifUrl: "https://api.workoutxapp.com/v1/gifs/0043.gif" },
  "face pull": { id: "0203", name: "Cable Rear Delt Row (with Rope)", gifUrl: "https://api.workoutxapp.com/v1/gifs/0203.gif" },
};

elements.themeButton.addEventListener("click", toggleTheme);
elements.printButton.addEventListener("click", () => window.print());
elements.expandButton.addEventListener("click", () => {
  allExpanded = !allExpanded;
  expandedAlternatives = new Set(
    allExpanded ? program.flatMap((day) => day.exercises.map((exercise) => exerciseKey(day, exercise))) : [],
  );
  renderProgram();
});

render();
const savedTheme = localStorage.getItem("fit-pulse-theme") || 
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
setTheme(savedTheme);
loadExerciseAnimations();
window.addEventListener("scroll", updateScrollScene, { passive: true });
updateScrollScene();

// Export / Import / Clear History
function exportWorkoutLogs() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(workoutLogs, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `fit_pulse_logs_${new Date().toISOString().split("T")[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importWorkoutLogs(event) {
  const fileReader = new FileReader();
  fileReader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (typeof imported === "object" && imported !== null) {
        workoutLogs = imported;
        localStorage.setItem("fit_pulse_workout_logs", JSON.stringify(workoutLogs));
        alert("Workout logs imported successfully!");
        renderProgram();
        renderDashboardStimulus();
      } else {
        alert("Invalid file format.");
      }
    } catch {
      alert("Error parsing file.");
    }
  };
  if (event.target.files[0]) {
    fileReader.readAsText(event.target.files[0]);
  }
}

function clearWorkoutLogs() {
  if (confirm("Are you sure you want to delete ALL workout logs? This cannot be undone.")) {
    workoutLogs = {};
    localStorage.removeItem("fit_pulse_workout_logs");
    alert("Workout logs cleared.");
    renderProgram();
    renderDashboardStimulus();
  }
}

function renderSettingsBand() {
  const notesSection = document.querySelector(".notes-section");
  if (!notesSection) return;
  if (notesSection.querySelector(".settings-band")) return;

  const band = document.createElement("div");
  band.className = "settings-band";
  band.innerHTML = `
    <button class="settings-btn" id="btn-export-logs" type="button">Export Logs</button>
    <button class="settings-btn" id="btn-import-logs" type="button">Import Logs</button>
    <button class="settings-btn" id="btn-clear-logs" type="button">Clear Logs</button>
    <input type="file" id="file-import-logs" accept=".json" style="display:none;" />
  `;

  const legend = notesSection.querySelector(".legend");
  if (legend) {
    notesSection.insertBefore(band, legend);
  } else {
    notesSection.appendChild(band);
  }

  document.querySelector("#btn-export-logs").addEventListener("click", exportWorkoutLogs);
  document.querySelector("#btn-import-logs").addEventListener("click", () => {
    document.querySelector("#file-import-logs").click();
  });
  document.querySelector("#file-import-logs").addEventListener("change", importWorkoutLogs);
  document.querySelector("#btn-clear-logs").addEventListener("click", clearWorkoutLogs);
}


function render() {
  renderFocusTags();
  renderDayTabs();
  renderCoachingGrid();
  renderProgram();
  renderDashboardStimulus();
  renderSettingsBand();
}

function renderDashboardStimulus() {
  if (elements.dashboardStimulus) {
    elements.dashboardStimulus.innerHTML = renderStimulusDashboardMarkup(activeDay, false);
  }
}


function renderFocusTags() {
  elements.focusTags.innerHTML = focusTags
    .map((tag) => `<span class="focus-tag ${tag.tone}"><span></span>${tag.label}</span>`)
    .join("");
}

function renderDayTabs() {
  elements.dayTabs.innerHTML = program
    .map(
      (day) => `
        <button class="day-tab ${day.letter === activeDay ? "active" : ""}" type="button" data-day="${day.letter}">
          <span>${day.day}</span>
          ${day.title}
        </button>
      `,
    )
    .join("");

  elements.dayTabs.querySelectorAll(".day-tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeDay = button.dataset.day;
      renderDayTabs();
      renderProgram();
      renderDashboardStimulus();
      loadExerciseAnimations();
      document.querySelector("#detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}


function renderCoachingGrid() {
  elements.coachingGrid.innerHTML = coachingRules
    .map(
      (rule) => `
        <article class="coach-card">
          <p>${rule.title}</p>
          <span>${rule.copy}</span>
        </article>
      `,
    )
    .join("");
}

function renderProgram() {
  elements.programGrid.innerHTML = program.map(renderDayCard).join("");
  elements.detailPanel.innerHTML = renderDetailPanel(program.find((day) => day.letter === activeDay) || program[0]);
  elements.expandButton.textContent = allExpanded ? "Hide Alternatives" : "Show All Alternatives";

  document.querySelectorAll("[data-action='alternative']").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.key;
      if (expandedAlternatives.has(key)) {
        expandedAlternatives.delete(key);
      } else {
        expandedAlternatives.add(key);
      }
      allExpanded = expandedAlternatives.size === program.flatMap((day) => day.exercises).length;
      renderProgram();
    });
  });

  document.querySelectorAll("[data-action='select-alternative']").forEach((button) => {
    button.addEventListener("click", async () => {
      const exerciseKeyValue = button.dataset.exerciseKey;
      const alternativeName = button.dataset.alternativeName;
      selectedAlternatives.set(exerciseKeyValue, alternativeName);
      await loadMediaForQuery(alternativeName);
      renderProgram();
    });
  });

  hydrateAnimationPanels();

  // Bind start session button
  const startBtn = document.querySelector("#start-workout-session");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      startWorkoutSession(startBtn.dataset.day);
    });
  }
}

function renderDayCard(day) {
  return `
    <article class="day-card ${day.accent} ${day.letter === activeDay ? "selected" : ""}">
      <button class="day-card-hit" type="button" data-day="${day.letter}" aria-label="View ${day.title}"></button>
      <div class="day-card-header">
        <div>
          <p>${day.day}</p>
          <h2>${day.title}</h2>
        </div>
        <span>${day.letter}</span>
      </div>
      <p class="day-intent">${day.intent}</p>
      <ol class="exercise-mini-list">
        ${day.exercises
          .map(
            (exercise, index) => `
              <li>
                <span>${String(index + 1).padStart(2, "0")}</span>
                <strong>${exercise.name}</strong>
                <em>${exercise.tag}</em>
              </li>
            `,
          )
          .join("")}
      </ol>
    </article>
  `;
}

function renderDetailPanel(day) {
  return `
    <section class="detail-header ${day.accent}">
      <div>
        <p class="eyebrow">${day.day} / Cult Fit Uttarahalli</p>
        <h2>${day.title}</h2>
        <span>${day.intent}</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
        <strong>${day.exercises.length} exercises</strong>
        <button class="tracker-btn finish" id="start-workout-session" data-day="${day.letter}" type="button">Start Session</button>
      </div>
    </section>
    <div class="exercise-table">
      ${day.exercises.map((exercise, index) => renderExerciseRow(day, exercise, index)).join("")}
    </div>
  `;
}

function renderExerciseRow(day, exercise, index) {
  const key = exerciseKey(day, exercise);
  const expanded = expandedAlternatives.has(key);
  const selectedAlternative = selectedAlternatives.get(key);
  return `
    <article class="exercise-row">
      <div class="exercise-number">${String(index + 1).padStart(2, "0")}</div>
      <div class="exercise-main">
        <div class="exercise-title-line">
          <div>
            <h3>${exercise.name}</h3>
            <p>${exercise.cue}</p>
          </div>
          <span class="exercise-tag">${exercise.tag}</span>
        </div>
        <div class="prescription">
          <span><b>${exercise.sets}</b> sets</span>
          <span><b>${exercise.reps}</b> reps/time</span>
          <span><b>${exercise.rest}</b> rest</span>
        </div>
        <div class="movement-preview" data-animation-key="${key}" data-animation-query="${exercise.animationQuery || exercise.name}">
          ${renderAnimationPanel(exercise)}
        </div>
        <div class="exercise-actions">
          <a class="form-button" href="${googleFormUrl(exercise.name)}" target="_blank" rel="noopener noreferrer">
            How To Do It
          </a>
          <button class="alt-button" type="button" data-action="alternative" data-key="${key}">
            ${expanded ? "Hide Alternative" : "Alternative"}
          </button>
        </div>
        ${
          expanded
            ? `<div class="alternative-box">
                <p>Pick an alternative first. The GIF and coaching notes load here; then use the demo link only if you want to open Google.</p>
                <div class="alternative-options">
                  ${exercise.alternatives
                    .map(
                      (item) => `
                        <button
                          type="button"
                          class="alternative-choice ${selectedAlternative === item ? "active" : ""}"
                          data-action="select-alternative"
                          data-exercise-key="${key}"
                          data-alternative-name="${item}"
                        >
                          ${item}
                        </button>
                      `,
                    )
                    .join("")}
                </div>
                ${selectedAlternative ? renderAlternativePreview(key, selectedAlternative) : ""}
              </div>`
            : ""
        }
      </div>
    </article>
  `;
}

function exerciseKey(day, exercise) {
  return `${day.letter}-${exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function googleFormUrl(exerciseName) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${exerciseName} proper form gym exercise video`)}`;
}

function toggleTheme() {
  const newTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  setTheme(newTheme);
  try {
    localStorage.setItem("fit-pulse-theme", newTheme);
  } catch (e) {
    console.error("Failed to save theme setting", e);
  }
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  elements.themeButton.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
  elements.themeButton.setAttribute("aria-pressed", String(theme === "light"));
  document.querySelector("meta[name='theme-color']")?.setAttribute("content", theme === "dark" ? "#050505" : "#f4f1e8");
}

function renderAnimationPanel(exercise) {
  const media = findMedia(exercise.animationQuery || exercise.name);
  if (media?.imageObjectUrl) {
    return `
      <figure class="movement-figure has-media">
        <img src="${media.imageObjectUrl}" alt="${exercise.name} WorkoutX GIF demonstration" loading="lazy" />
        <figcaption>
          <strong>${media.name}</strong>
          <span>${media.description || exercise.cue}</span>
        </figcaption>
      </figure>
    `;
  }

  return `
    <figure class="movement-figure">
      <div class="motion-avatar" aria-hidden="true">
        <span class="motion-head"></span>
        <span class="motion-torso"></span>
        <span class="motion-arm arm-left"></span>
        <span class="motion-arm arm-right"></span>
        <span class="motion-leg leg-left"></span>
        <span class="motion-leg leg-right"></span>
      </div>
      <figcaption>
        <strong>WorkoutX GIF loading</strong>
        <span>${exercise.cue}</span>
      </figcaption>
    </figure>
  `;
}

function renderAlternativePreview(exerciseKeyValue, alternativeName) {
  const media = findMedia(alternativeName);
  const mediaMarkup = media?.imageObjectUrl
    ? `
      <figure class="movement-figure has-media alternative-media">
        <img src="${media.imageObjectUrl}" alt="${alternativeName} WorkoutX GIF demonstration" loading="lazy" />
        <figcaption>
          <strong>${media.name}</strong>
          <span>${media.description || "Use this as your replacement movement for the selected exercise."}</span>
        </figcaption>
      </figure>
    `
    : `
      <figure class="movement-figure alternative-media">
        <div class="motion-avatar" aria-hidden="true">
          <span class="motion-head"></span>
          <span class="motion-torso"></span>
          <span class="motion-arm arm-left"></span>
          <span class="motion-arm arm-right"></span>
          <span class="motion-leg leg-left"></span>
          <span class="motion-leg leg-right"></span>
        </div>
        <figcaption>
          <strong>Loading ${alternativeName}</strong>
          <span>The GIF appears here first when WorkoutX finds the movement.</span>
        </figcaption>
      </figure>
    `;

  return `
    <div class="alternative-preview" data-alternative-preview="${exerciseKeyValue}">
      ${mediaMarkup}
      <a class="external-demo-link" href="${googleFormUrl(alternativeName)}" target="_blank" rel="noopener noreferrer">
        Open Google Demo
      </a>
    </div>
  `;
}

function hydrateAnimationPanels() {
  document.querySelectorAll(".movement-preview").forEach((panel) => {
    const query = panel.dataset.animationQuery;
    const key = panel.dataset.animationKey;
    
    // Find exercise details either from active session or normal program list
    let exercise = null;
    if (activeSession) {
      const day = program.find(d => d.letter === activeSession.day);
      const idx = parseInt(panel.closest(".tracker-exercise-card")?.dataset.index, 10);
      if (!isNaN(idx)) {
        const exItem = day?.exercises[idx];
        if (exItem) {
          const activeName = activeSession.swappedExercises[exItem.name] || exItem.name;
          exercise = { name: activeName, cue: exItem.cue };
        }
      }
    }

    if (!exercise) {
      const day = program.find((candidate) =>
        candidate.exercises.some((ex) => exerciseKey(candidate, ex) === key),
      );
      exercise = day?.exercises.find((candidate) => exerciseKey(day, candidate) === key);
    }

    if (!exercise) return;

    const media = findMedia(query);
    if (!media?.imageObjectUrl) {
      return;
    }

    // Only update panel if it hasn't loaded the media yet to avoid flashing
    if (!panel.querySelector(".has-media")) {
      panel.innerHTML = renderAnimationPanel(exercise);
    }
  });

  // Hydrate alternative previews inside tracker or details
  document.querySelectorAll(".alternative-preview").forEach((panel) => {
    const key = panel.dataset.alternativePreview;
    const selectedAlternative = selectedAlternatives.get(key);
    if (selectedAlternative) {
      const media = findMedia(selectedAlternative);
      if (media?.imageObjectUrl) {
        if (!panel.querySelector(".has-media")) {
          panel.innerHTML = `
            ${renderAlternativePreviewMarkup(key, selectedAlternative)}
            <a class="external-demo-link" href="${googleFormUrl(selectedAlternative)}" target="_blank" rel="noopener noreferrer">
              Open Google Demo
            </a>
          `;
        }
      }
    }
  });
}

function renderAlternativePreviewMarkup(exerciseKeyValue, alternativeName) {
  const media = findMedia(alternativeName);
  if (media?.imageObjectUrl) {
    return `
      <figure class="movement-figure has-media alternative-media">
        <img src="${media.imageObjectUrl}" alt="${alternativeName} WorkoutX GIF demonstration" loading="lazy" />
        <figcaption>
          <strong>${media.name}</strong>
          <span>${media.description || "Use this as your replacement movement for the selected exercise."}</span>
        </figcaption>
      </figure>
    `;
  }

  return `
    <figure class="movement-figure alternative-media">
      <div class="motion-avatar" aria-hidden="true">
        <span class="motion-head"></span>
        <span class="motion-torso"></span>
        <span class="motion-arm arm-left"></span>
        <span class="motion-arm arm-right"></span>
        <span class="motion-leg leg-left"></span>
        <span class="motion-leg leg-right"></span>
      </div>
      <figcaption>
        <strong>Loading ${alternativeName}</strong>
        <span>The GIF appears here first when WorkoutX finds the movement.</span>
      </figcaption>
    </figure>
  `;
}

let mediaObserver = null;
function setupMediaObserver() {
  if (mediaObserver) {
    mediaObserver.disconnect();
  }

  mediaObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const panel = entry.target;
        const query = panel.dataset.animationQuery;
        if (query) {
          loadMediaForQuery(query);
        }
      }
    });
  }, {
    rootMargin: "100px 0px",
    threshold: 0.01
  });

  document.querySelectorAll(".movement-preview, .alternative-preview").forEach((el) => {
    mediaObserver.observe(el);
  });
}

async function loadExerciseAnimations() {
  hydrateAnimationPanels();
  setupMediaObserver();
}

async function loadMediaForQuery(query) {
  const existing = findMedia(query);
  if (existing?.imageObjectUrl) {
    return existing;
  }

  const media = WORKOUTX_SEEDS[normalizeName(query)] || await searchWorkoutXExercise(query);
  if (!media) {
    return null;
  }

  const imageObjectUrl = await fetchWorkoutXGif(media.gifUrl);
  const hydratedMedia = { ...media, imageObjectUrl };
  exerciseMedia.set(normalizeName(query), hydratedMedia);
  exerciseMedia.set(normalizeName(media.name), hydratedMedia);
  
  hydrateAnimationPanels();
  return hydratedMedia;
}

async function searchWorkoutXExercise(query) {
  const searchTerms = buildWorkoutXSearchTerms(query);

  for (const searchTerm of searchTerms) {
    const url = `${WORKOUTX_API_BASE_URL}/exercises/name/${encodeURIComponent(searchTerm)}`;
    try {
      const cache = await caches.open(MEDIA_CACHE_NAME);
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        const payload = await cachedResponse.json();
        const results = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        const match = pickBestMediaResult(query, results);
        if (match) {
          return match;
        }
      }

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "X-WorkoutX-Key": WORKOUTX_API_KEY,
        },
      });

      if (!response.ok) {
        continue;
      }

      const responseClone = response.clone();
      const payload = await response.json();
      await cache.put(url, responseClone);

      const results = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      const match = pickBestMediaResult(query, results);
      if (match) {
        return match;
      }
    } catch {
      // Try next
    }
  }

  return null;
}

async function fetchWorkoutXGif(gifUrl) {
  if (!gifUrl) {
    return "";
  }

  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const cachedResponse = await cache.match(gifUrl);
    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }

    const response = await fetch(gifUrl, {
      headers: {
        Accept: "image/gif",
        "X-WorkoutX-Key": WORKOUTX_API_KEY,
      },
    });

    if (!response.ok) {
      return "";
    }

    await cache.put(gifUrl, response.clone());

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return "";
  }
}


function pickBestMediaResult(query, results) {
  if (!results.length) {
    return null;
  }

  const queryKey = normalizeName(query);
  const looseQueryKey = normalizeLooseName(query);
  const exact = results.find(
    (item) =>
      normalizeName(item.name) === queryKey ||
      normalizeName(item.code) === queryKey ||
      normalizeLooseName(item.name) === looseQueryKey,
  );
  if (exact) {
    return exact;
  }

  return (
    results.find((item) => normalizeName(item.name).includes(queryKey) || queryKey.includes(normalizeName(item.name))) ||
    results.find((item) => {
      const itemKey = normalizeLooseName(item.name);
      return itemKey.includes(looseQueryKey) || looseQueryKey.includes(itemKey);
    }) ||
    results.find((item) => looseQueryKey.split(" ").every((part) => normalizeLooseName(item.name).includes(part))) ||
    null
  );
}

function findMedia(name) {
  const key = normalizeName(name);
  if (exerciseMedia.has(key)) {
    return exerciseMedia.get(key);
  }

  return [...exerciseMedia.entries()].find(([candidate]) => candidate.includes(key) || key.includes(candidate))?.[1] || null;
}

function normalizeName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\b(bb|db)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLooseName(name) {
  return normalizeName(name)
    .replace(
      /\b(barbell|dumbbell|cable|machine|weighted|seated|standing|incline|decline|single arm|single|wide grip|wide|close grip|close|ez bar|45 degree|degree)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function buildWorkoutXSearchTerms(query) {
  const normalized = normalizeName(query);
  const alias = WORKOUTX_ALIASES[normalized];
  const loose = normalizeLooseName(query);
  const terms = [
    alias,
    query,
    loose,
    loose.replace(/\bpress\b/g, "dumbbell press"),
    loose.replace(/\bfly\b/g, "fly"),
    loose.split(" ").slice(-2).join(" "),
    loose.split(" ").at(-1),
  ];

  return [...new Set(terms.filter((term) => term && String(term).trim().length >= 3))];
}

function updateScrollScene() {
  const scrollRatio = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
  elements.pageShell?.style.setProperty("--scroll-progress", scrollRatio.toFixed(3));
}

function getSelectedWorkout() {
  return program.find((day) => day.letter === activeDay) || program[0];
}

document.addEventListener("click", (event) => {
  const cardButton = event.target.closest(".day-card-hit");
  if (!cardButton) {
    return;
  }

  activeDay = cardButton.dataset.day;
  renderDayTabs();
  renderProgram();
  renderDashboardStimulus();
  loadExerciseAnimations();
  document.querySelector("#detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
});

// ACTIVE SESSION TRACKER FUNCTIONS

function startWorkoutSession(dayLetter) {
  const day = program.find((d) => d.letter === dayLetter);
  if (!day) return;

  activeSession = {
    day: dayLetter,
    startTime: Date.now(),
    activeExerciseIndex: 0,
    logs: {},
    swappedExercises: {},
  };

  day.exercises.forEach((ex) => {
    const setsCount = parseInt(ex.sets, 10) || 3;
    activeSession.logs[ex.name] = Array.from({ length: setsCount }, () => ({
      weight: "",
      reps: "",
      completed: false,
    }));
  });

  document.body.setAttribute("data-session-active", "true");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (sessionTimerInterval) clearInterval(sessionTimerInterval);
  sessionTimerInterval = setInterval(updateWorkoutSessionTimer, 1000);
  updateWorkoutSessionTimer();

  renderTrackerPanel();
  setupMediaObserver();
}

function updateWorkoutSessionTimer() {
  if (!activeSession) return;
  const elapsedMs = Date.now() - activeSession.startTime;
  const totalSecs = Math.floor(elapsedMs / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const timerStr = hrs > 0
    ? `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const el = document.querySelector("#tracker-elapsed-time");
  if (el) el.textContent = timerStr;
}

function setsCompletedCount(exerciseName) {
  if (!activeSession || !activeSession.logs[exerciseName]) return 0;
  return activeSession.logs[exerciseName].filter((s) => s.completed).length;
}

function isExerciseCompleted(exerciseName) {
  if (!activeSession || !activeSession.logs[exerciseName]) return false;
  return activeSession.logs[exerciseName].every((s) => s.completed);
}

function getExerciseIndexByName(name) {
  if (!activeSession) return -1;
  const day = program.find((d) => d.letter === activeSession.day);
  return day.exercises.findIndex((ex) => ex.name === name);
}

function renderTrackerPanel() {
  if (!activeSession) return;

  const day = program.find((d) => d.letter === activeSession.day);
  const elapsedMs = Date.now() - activeSession.startTime;
  const totalSecs = Math.floor(elapsedMs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const timerStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  let html = `
    <header class="tracker-header">
      <div class="tracker-title-area">
        <p>Active Session / Day ${activeSession.day}</p>
        <h2>${day.title}</h2>
        <p>${day.intent}</p>
      </div>
      <div class="tracker-timer-area">
        <span class="tracker-timer-label">Workout Time</span>
        <span class="tracker-timer" id="tracker-elapsed-time">${timerStr}</span>
      </div>
      <div class="tracker-actions">
        <button class="tracker-btn finish" id="tracker-finish-btn" type="button">Finish Workout</button>
        <button class="tracker-btn cancel" id="tracker-cancel-btn" type="button">Cancel</button>
      </div>
    </header>

    <div id="tracker-stimulus-dashboard">
      ${renderStimulusDashboardMarkup(activeSession.day, true)}
    </div>

    <div class="tracker-exercises">
  `;

  day.exercises.forEach((exercise, index) => {
    const isActive = index === activeSession.activeExerciseIndex;
    const isCompleted = isExerciseCompleted(exercise.name);
    const activeName = activeSession.swappedExercises[exercise.name] || exercise.name;
    const activeCue = exercise.alternatives.includes(activeName)
      ? `Alternative swap: ${activeName}. Use as replacement.`
      : exercise.cue;
    
    const setsData = activeSession.logs[exercise.name];
    const overloadRec = getProgressiveOverloadRecommendation(activeName, exercise.reps);

    const prevHistory = workoutLogs[activeName.toLowerCase().trim()] || [];
    const lastSession = prevHistory[prevHistory.length - 1];

    html += `
      <article class="tracker-exercise-card ${isActive ? "active" : ""}" data-index="${index}">
        <div class="tracker-exercise-header" data-action="toggle-card" data-index="${index}">
          <div>
            <h3>${activeName}</h3>
            <p>${exercise.sets} sets x ${exercise.reps} reps | Rest: ${exercise.rest}</p>
          </div>
          <div class="tracker-exercise-meta">
            <span class="tracker-exercise-progress ${isCompleted ? "completed" : ""}">
              ${isCompleted ? "Completed" : `${setsCompletedCount(exercise.name)}/${exercise.sets} Sets`}
            </span>
            <span class="tracker-exercise-arrow">▼</span>
          </div>
        </div>

        <div class="tracker-exercise-body">
          ${overloadRec ? `
            <div class="overload-alert">
              <span class="overload-icon">🔥</span>
              <p class="overload-text">
                <strong>Progressive Overload Advisor</strong>
                ${overloadRec.recommendation}
              </p>
            </div>
          ` : ""}

          <p style="margin: 0 0 16px; color: var(--muted); font-size: 0.95rem; line-height: 1.45;">
            <b>Form Cue:</b> ${activeCue}
          </p>

          <div class="movement-preview" data-animation-key="tracker-${index}" data-animation-query="${activeName}">
            ${renderAnimationPanel({ name: activeName, cue: activeCue })}
          </div>

          <div class="set-tracker-table">
            <div class="set-tracker-header">
              <span class="set-num">Set</span>
              <span class="set-prev">Prev</span>
              <span>Weight</span>
              <span>Reps</span>
              <span style="text-align: center;">Done</span>
            </div>
            ${setsData.map((setData, setIdx) => {
              const prevSet = lastSession?.sets?.[setIdx];
              const prevStr = prevSet && prevSet.completed ? `${prevSet.weight}kg x ${prevSet.reps}` : "—";
              const placeholderWeight = prevSet && prevSet.completed ? prevSet.weight : "";
              const placeholderReps = prevSet && prevSet.completed ? prevSet.reps : "";

              return `
                <div class="set-tracker-row ${setData.completed ? "completed" : ""}" data-set-index="${setIdx}">
                  <span class="set-num">${setIdx + 1}</span>
                  <span class="set-prev">${prevStr}</span>
                  <div class="set-input-wrap">
                    <input 
                      type="number" 
                      placeholder="${placeholderWeight}" 
                      value="${setData.weight}" 
                      data-input="weight" 
                      data-exercise="${exercise.name}" 
                      data-set="${setIdx}"
                      min="0" step="0.5"
                      ${setData.completed ? "disabled" : ""}
                    />
                    <span>kg</span>
                  </div>
                  <div class="set-input-wrap">
                    <input 
                      type="number" 
                      placeholder="${placeholderReps}" 
                      value="${setData.reps}" 
                      data-input="reps" 
                      data-exercise="${exercise.name}" 
                      data-set="${setIdx}"
                      min="0"
                      ${setData.completed ? "disabled" : ""}
                    />
                    <span>reps</span>
                  </div>
                  <button 
                    class="set-check-btn" 
                    type="button" 
                    data-action="toggle-set" 
                    data-exercise="${exercise.name}" 
                    data-set="${setIdx}"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M20 6L9 17L4 12" />
                    </svg>
                  </button>
                </div>
              `;
            }).join("")}
          </div>

          <div class="exercise-actions" style="margin-top: 14px;">
            <button class="alt-button" type="button" data-action="tracker-alternative" data-exercise="${exercise.name}">
              Swap Exercise
            </button>
            <a class="form-button" href="${googleFormUrl(activeName)}" target="_blank" rel="noopener noreferrer">
              Form Demo
            </a>
          </div>

          <div class="tracker-alternatives-box" id="tracker-alt-box-${index}" style="display: none; margin-top: 14px;">
            <p style="font-size: 0.82rem; color: var(--muted); margin-bottom: 8px;">Select an alternative to substitute for this session:</p>
            <div class="alternative-options">
              <button 
                type="button" 
                class="alternative-choice ${activeName === exercise.name ? "active" : ""}" 
                data-action="tracker-select-alternative" 
                data-exercise="${exercise.name}" 
                data-alternative="${exercise.name}"
              >
                ${exercise.name} (Original)
              </button>
              ${exercise.alternatives.map(item => `
                <button 
                  type="button" 
                  class="alternative-choice ${activeName === item ? "active" : ""}" 
                  data-action="tracker-select-alternative" 
                  data-exercise="${exercise.name}" 
                  data-alternative="${item}"
                >
                  ${item}
                </button>
              `).join("")}
            </div>
          </div>

        </div>
      </article>
    `;
  });

  html += `</div>`;
  elements.trackerPanel.innerHTML = html;

  bindTrackerPanelEvents();
}

function bindTrackerPanelEvents() {
  document.querySelectorAll("[data-action='toggle-card']").forEach((header) => {
    header.addEventListener("click", () => {
      const idx = parseInt(header.dataset.index, 10);
      activeSession.activeExerciseIndex = activeSession.activeExerciseIndex === idx ? -1 : idx;
      renderTrackerPanel();
      setupMediaObserver();
    });
  });

  document.querySelector("#tracker-finish-btn").addEventListener("click", finishWorkoutSession);

  document.querySelector("#tracker-cancel-btn").addEventListener("click", () => {
    if (confirm("Are you sure you want to cancel this workout? Current progress will be lost.")) {
      cancelWorkoutSession();
    }
  });

  document.querySelectorAll("[data-input]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const exerciseName = input.dataset.exercise;
      const setIdx = parseInt(input.dataset.set, 10);
      const field = input.dataset.input;
      const val = parseFloat(input.value) || input.value;
      if (activeSession?.logs[exerciseName]?.[setIdx]) {
        activeSession.logs[exerciseName][setIdx][field] = val;
      }
    });
  });

  document.querySelectorAll("[data-action='toggle-set']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const exerciseName = btn.dataset.exercise;
      const setIdx = parseInt(btn.dataset.set, 10);
      toggleTrackerSet(exerciseName, setIdx);
    });
  });

  document.querySelectorAll("[data-action='tracker-alternative']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const exerciseName = btn.dataset.exercise;
      const card = btn.closest(".tracker-exercise-card");
      const idx = card.dataset.index;
      const altBox = document.querySelector(`#tracker-alt-box-${idx}`);
      if (altBox) {
        altBox.style.display = altBox.style.display === "none" ? "block" : "none";
      }
    });
  });

  document.querySelectorAll("[data-action='tracker-select-alternative']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const exerciseName = btn.dataset.exercise;
      const altName = btn.dataset.alternative;
      activeSession.swappedExercises[exerciseName] = altName;
      
      await loadMediaForQuery(altName);
      
      renderTrackerPanel();
      setupMediaObserver();
    });
  });
}

function toggleTrackerSet(exerciseName, setIdx) {
  if (!activeSession) return;
  const setLog = activeSession.logs[exerciseName][setIdx];
  setLog.completed = !setLog.completed;

  if (setLog.completed) {
    const rowEl = document.querySelector(`.tracker-exercise-card[data-index="${activeSession.activeExerciseIndex}"] .set-tracker-row[data-set-index="${setIdx}"]`);
    const weightInput = rowEl.querySelector("[data-input='weight']");
    const repsInput = rowEl.querySelector("[data-input='reps']");
    
    if (!setLog.weight) {
      setLog.weight = parseFloat(weightInput.placeholder) || 0;
      weightInput.value = setLog.weight;
    }
    if (!setLog.reps) {
      setLog.reps = parseInt(repsInput.placeholder, 10) || 0;
      repsInput.value = setLog.reps;
    }

    const day = program.find(d => d.letter === activeSession.day);
    const exercise = day.exercises.find(ex => ex.name === exerciseName);
    const restStr = exercise.rest;
    
    let secs = 60;
    if (restStr.includes("sec")) {
      secs = parseInt(restStr, 10) || 60;
    } else if (restStr.includes("min")) {
      const range = restStr.replace("min", "").trim().split("-");
      const avgMin = range.length > 1 ? (parseFloat(range[0]) + parseFloat(range[1])) / 2 : parseFloat(range[0]);
      secs = Math.round(avgMin * 60);
    }

    let nextExName = "";
    if (setIdx + 1 < activeSession.logs[exerciseName].length) {
      nextExName = `Next Set: Set ${setIdx + 2} of ${exerciseName}`;
    } else {
      const nextExIdx = activeSession.activeExerciseIndex + 1;
      const nextEx = day.exercises[nextExIdx];
      if (nextEx) {
        nextExName = `Next Exercise: ${activeSession.swappedExercises[nextEx.name] || nextEx.name}`;
      } else {
        nextExName = "Final Stretch! Complete your workout.";
      }
    }

    startRestTimer(secs, nextExName);
  }

  const allCompleted = isExerciseCompleted(exerciseName);
  if (allCompleted && activeSession.activeExerciseIndex === getExerciseIndexByName(exerciseName)) {
    const day = program.find((d) => d.letter === activeSession.day);
    if (activeSession.activeExerciseIndex + 1 < day.exercises.length) {
      activeSession.activeExerciseIndex += 1;
    }
  }

  renderTrackerPanel();
  setupMediaObserver();
}

function startRestTimer(secs, nextExLabel) {
  if (restTimerInterval) clearInterval(restTimerInterval);

  restTimeRemaining = secs;
  restTimerTotal = secs;
  restTimerNextExerciseName = nextExLabel;

  let overlay = document.querySelector("#rest-timer-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "rest-timer-overlay";
    overlay.className = "rest-timer-overlay";
    document.body.appendChild(overlay);
  }

  updateRestTimerUI();

  restTimerInterval = setInterval(() => {
    restTimeRemaining--;
    if (restTimeRemaining <= 0) {
      clearInterval(restTimerInterval);
      playTimerBeep();
      closeRestTimer();
    } else {
      updateRestTimerUI();
    }
  }, 1000);
}

function updateRestTimerUI() {
  const overlay = document.querySelector("#rest-timer-overlay");
  if (!overlay) return;

  const pct = Math.max(0, Math.min(100, (restTimeRemaining / restTimerTotal) * 100));
  const strokeDash = 439.8; 
  const offset = strokeDash - (pct / 100) * strokeDash;

  overlay.innerHTML = `
    <div class="rest-timer-card">
      <h3>Rest Active</h3>
      <p class="rest-timer-next">${restTimerNextExerciseName}</p>
      
      <div class="timer-dial">
        <svg>
          <circle class="bg-ring" cx="75" cy="75" r="70"></circle>
          <circle class="fill-ring" cx="75" cy="75" r="70" stroke-dasharray="${strokeDash}" stroke-dashoffset="${offset}"></circle>
        </svg>
        <span class="timer-text">${restTimeRemaining}s</span>
      </div>

      <div class="timer-controls">
        <button class="tracker-btn" id="btn-timer-add" type="button">+30s</button>
        <button class="tracker-btn finish" id="btn-timer-skip" type="button">Skip Rest</button>
      </div>
    </div>
  `;

  document.querySelector("#btn-timer-add").addEventListener("click", () => {
    restTimeRemaining += 30;
    restTimerTotal += 30;
    updateRestTimerUI();
  });

  document.querySelector("#btn-timer-skip").addEventListener("click", () => {
    clearInterval(restTimerInterval);
    closeRestTimer();
  });
}

function closeRestTimer() {
  const overlay = document.querySelector("#rest-timer-overlay");
  if (overlay) overlay.remove();
}

function finishWorkoutSession() {
  if (!activeSession) return;

  const todayStr = new Date().toISOString().split("T")[0];
  const day = program.find(d => d.letter === activeSession.day);

  day.exercises.forEach((ex) => {
    const activeName = activeSession.swappedExercises[ex.name] || ex.name;
    const normalized = activeName.toLowerCase().trim();
    
    const setsLogged = activeSession.logs[ex.name].map((s, idx) => ({
      set: idx + 1,
      weight: parseFloat(s.weight) || 0,
      reps: parseInt(s.reps, 10) || 0,
      completed: s.completed
    }));

    if (setsLogged.some(s => s.completed)) {
      if (!workoutLogs[normalized]) {
        workoutLogs[normalized] = [];
      }
      workoutLogs[normalized].push({
        date: todayStr,
        day: activeSession.day,
        sets: setsLogged
      });
    }
  });

  localStorage.setItem("fit_pulse_workout_logs", JSON.stringify(workoutLogs));

  alert("Workout session completed! Awesome job on progressive overload!");

  cleanupSessionState();

  renderProgram();
  renderDashboardStimulus();
}

function cancelWorkoutSession() {
  cleanupSessionState();
  renderProgram();
  renderDashboardStimulus();
}

function cleanupSessionState() {
  if (sessionTimerInterval) clearInterval(sessionTimerInterval);
  if (restTimerInterval) clearInterval(restTimerInterval);
  sessionTimerInterval = null;
  restTimerInterval = null;
  activeSession = null;
  closeRestTimer();

  document.body.removeAttribute("data-session-active");
}

