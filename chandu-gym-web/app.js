import {
  STORAGE_KEY,
  DAY_ORDER,
  PROGRAM,
  TRAINING_PHASES,
  TRAINER_PROFILE,
  NUTRITION_SNAPSHOT,
  GYM_TRIGGER_CHIPS,
  createInitialState,
} from "./workout-data.js";
import { initSupabaseSync } from "./supabase-sync.js";

const THEME_KEY = "fit-pulse-theme";
let deferredInstallPrompt = null;
const state = loadState();
let authSnapshot = {
  configured: false,
  session: null,
  status: "not_configured",
  message: "Cloud sync is not configured yet.",
  lastSyncedAt: null,
};

const elements = {
  heroPanel: document.querySelector("#hero-panel"),
  statsGrid: document.querySelector("#stats-grid"),
  coachInsights: document.querySelector("#coach-insights"),
  workoutSummary: document.querySelector("#workout-summary"),
  coachBrief: document.querySelector("#coach-brief"),
  workoutLogBar: document.querySelector("#workout-log-bar"),
  exerciseList: document.querySelector("#exercise-list"),
  historyList: document.querySelector("#history-list"),
  nutritionStrip: document.querySelector("#nutrition-strip"),
  upperIncrement: document.querySelector("#upper-increment"),
  lowerIncrement: document.querySelector("#lower-increment"),
  importData: document.querySelector("#import-data"),
  authShell: document.querySelector("#auth-shell"),
  installApp: document.querySelector("#install-app"),
  themeToggle: document.querySelector("#theme-toggle"),
  triggerChipList: document.querySelector("#trigger-chip-list"),
  coachTriggerMessage: document.querySelector("#coach-trigger-message"),
};

const syncManager = initSupabaseSync({
  getStateSnapshot: cloneStateSnapshot,
  replaceState: replaceWorkingState,
  sanitizeState: sanitizeLoadedState,
  showToast,
});

syncManager.subscribe((nextSnapshot) => {
  authSnapshot = nextSnapshot;
  renderAuthShell();
});

applyTheme(loadTheme());

document.querySelector("#jump-to-log").addEventListener("click", () => {
  document.querySelector("#log-panel").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#print-workout").addEventListener("click", () => window.print());
document.querySelector("#save-settings").addEventListener("click", saveSettings);
document.querySelector("#export-data").addEventListener("click", exportData);
document.querySelector("#reset-data").addEventListener("click", resetData);
elements.importData.addEventListener("change", importData);
elements.themeToggle.addEventListener("click", toggleTheme);
elements.installApp.addEventListener("click", installPwa);

setupPwa();

render();

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return sanitizeLoadedState(createInitialState());
    }
    return sanitizeLoadedState(JSON.parse(raw));
  } catch {
    return sanitizeLoadedState(createInitialState());
  }
}

function persistState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function sanitizeLoadedState(candidate) {
  const base = createInitialState();
  return {
    ...base,
    ...(candidate || {}),
    settings: { ...base.settings, ...((candidate || {}).settings || {}) },
    exerciseStates: (candidate || {}).exerciseStates || {},
    sessions: Array.isArray((candidate || {}).sessions) ? (candidate || {}).sessions : [],
    updatedAt: (candidate || {}).updatedAt || (candidate || {}).createdAt || new Date().toISOString(),
  };
}

function replaceWorkingState(nextState) {
  const sanitized = sanitizeLoadedState(nextState);
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, sanitized);
  persistState();
  render();
}

function cloneStateSnapshot() {
  return sanitizeLoadedState(JSON.parse(JSON.stringify(state)));
}

function markStateChanged() {
  state.updatedAt = new Date().toISOString();
}

function requestCloudSync(reason = "manual") {
  if (authSnapshot.configured && authSnapshot.session?.user) {
    syncManager.pushState(reason);
  }
}

function loadTheme() {
  return window.localStorage.getItem(THEME_KEY) || "dark";
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  elements.themeToggle.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
}

function toggleTheme() {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  window.localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}

function setupPwa() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        showToast("PWA service worker could not register.");
      });
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installApp.classList.remove("hidden");
    elements.installApp.textContent = "Install App";
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    elements.installApp.classList.add("hidden");
    showToast("Fit Pulse installed on this device.");
  });
}

async function installPwa() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result.outcome === "accepted") {
      showToast("Install accepted. Android will add Fit Pulse to your device.");
    }
    deferredInstallPrompt = null;
    elements.installApp.classList.add("hidden");
    return;
  }

  showToast("On Android Chrome, open the browser menu and tap Install app or Add to Home screen.");
}

function getTrainingPhase() {
  const totalSessions = state.sessions.length;
  return [...TRAINING_PHASES].reverse().find((phase) => totalSessions >= phase.minSessions);
}

function getLastSession() {
  return state.sessions.at(-1) || null;
}

function getNextDayKey() {
  const lastSession = getLastSession();
  if (!lastSession) {
    return "A";
  }
  const lastIndex = DAY_ORDER.indexOf(lastSession.dayKey);
  return DAY_ORDER[(lastIndex + 1) % DAY_ORDER.length];
}

function getDayExposureCount(dayKey) {
  return state.sessions.filter((session) => session.dayKey === dayKey).length;
}

function getRecentSessions(limit = 6) {
  return [...state.sessions].slice(-limit).reverse();
}

function getRecentAverageRpe(limit = 4) {
  const recent = state.sessions.slice(-limit);
  if (!recent.length) {
    return 0;
  }
  return recent.reduce((sum, session) => sum + Number(session.overallRpe || 0), 0) / recent.length;
}

function getWorkoutForDay(dayKey) {
  const day = PROGRAM[dayKey];
  const baseExercises = [...day.exercises];
  const dayExposureCount = getDayExposureCount(dayKey);
  const unlockedEvolutions = day.evolutions
    .filter((rule) => dayExposureCount >= rule.threshold)
    .map((rule) => ({ ...rule.exercise, unlockedAt: rule.threshold }));

  let combined = [...baseExercises, ...unlockedEvolutions];
  const phase = getTrainingPhase();
  if (phase.id !== "foundation") {
    combined = combined.map((exercise, index) => {
      if (index === 0 && exercise.progression === "compound") {
        const extraSet = phase.id === "performance" ? 1 : 0;
        return { ...exercise, sets: exercise.sets + extraSet };
      }
      return exercise;
    });
  }
  return { ...day, exercises: combined };
}

function getExerciseState(exerciseId) {
  return state.exerciseStates[exerciseId] || {
    currentLoadKg: null,
    topRangeStreak: 0,
    sessionsCompleted: 0,
    lastOutcome: "new",
    lastCompletedAt: null,
    draftLoadKg: null,
    draftRepEntry: "",
    draftReps: [],
  };
}

function getRecommendedLoad(exercise) {
  const exerciseState = getExerciseState(exercise.id);
  if (!exercise.loadTrack) {
    return exercise.metric === "seconds" ? "Hold for time" : "Bodyweight target";
  }
  if (exerciseState.currentLoadKg == null) {
    return "Find a weight with 1-2 reps in reserve";
  }
  return `${exerciseState.currentLoadKg} kg`;
}

function getIncrementForExercise(exercise) {
  return exercise.muscleGroup === "lower"
    ? Number(state.settings.lowerIncrementKg || 5)
    : Number(state.settings.upperIncrementKg || 2.5);
}

function roundToIncrement(value, increment) {
  return Math.round(value / increment) * increment;
}

function parseRepsString(value) {
  return value
    .split(",")
    .map((chunk) => Number(chunk.trim()))
    .filter((chunk) => Number.isFinite(chunk) && chunk >= 0);
}

function evaluateExerciseOutcome(exercise, performedLoadKg, reps, overallRpe) {
  const exerciseState = getExerciseState(exercise.id);
  const increment = getIncrementForExercise(exercise);
  const expectedSets = exercise.sets;
  const workingSets = reps.slice(0, expectedSets);
  const hitAllSets = workingSets.length === expectedSets;
  const hitMin = hitAllSets && workingSets.every((rep) => rep >= exercise.repMin);
  const hitTop = hitAllSets && workingSets.every((rep) => rep >= exercise.repMax);
  const averageRep = workingSets.length
    ? workingSets.reduce((sum, rep) => sum + rep, 0) / workingSets.length
    : 0;

  let nextLoadKg = performedLoadKg || exerciseState.currentLoadKg || null;
  let nextStreak = exerciseState.topRangeStreak || 0;
  let recommendation = "Hold the load and clean up execution.";
  let outcome = "steady";

  if (!exercise.loadTrack) {
    outcome = hitTop ? "success" : hitMin ? "steady" : "down";
    recommendation = hitTop
      ? "Great control. Add reps or a harder variation next time."
      : hitMin
        ? "Solid bodyweight work. Hold the same target next exposure."
        : "Stay here and own the pattern before progressing.";
    return {
      outcome,
      recommendation,
      nextLoadKg: null,
      topRangeStreak: hitTop ? nextStreak + 1 : hitMin ? nextStreak : 0,
      averageRep,
      hitMin,
      hitTop,
    };
  }

  if (hitTop && overallRpe <= 9) {
    nextStreak += 1;
    outcome = "success";
    if (nextStreak >= 2 && nextLoadKg != null) {
      nextLoadKg = roundToIncrement(nextLoadKg + increment, increment);
      nextStreak = 0;
      recommendation = `You owned the top of the range twice. Increase to ${nextLoadKg} kg next time.`;
    } else {
      recommendation = "Excellent. Repeat this load once more and then bump it.";
    }
  } else if (hitMin && overallRpe <= 9.5) {
    nextStreak = 0;
    outcome = "steady";
    recommendation = "Target a few more reps before increasing load.";
  } else {
    nextStreak = 0;
    outcome = "down";
    if (nextLoadKg != null && overallRpe >= 9.5) {
      nextLoadKg = roundToIncrement(Math.max(increment, nextLoadKg * 0.95), increment);
      recommendation = `Fatigue was high. Pull back to about ${nextLoadKg} kg and rebuild cleanly.`;
    } else {
      recommendation = "Stay conservative and own the minimum reps with better form.";
    }
  }

  return {
    outcome,
    recommendation,
    nextLoadKg,
    topRangeStreak: nextStreak,
    averageRep,
    hitMin,
    hitTop,
  };
}

function buildCoachInsights(nextWorkout) {
  const phase = getTrainingPhase();
  const recentAverageRpe = getRecentAverageRpe();
  const insights = [`${phase.name}: ${phase.summary}`];

  if (!state.sessions.length) {
    insights.push("Start one rep shy of failure and use week one to calibrate loads.");
  } else if (recentAverageRpe >= 9.2) {
    insights.push("Recent effort is high. Hold loads steady and clean up reps.");
  } else if (recentAverageRpe > 0 && recentAverageRpe <= 8.2) {
    insights.push("Recovery looks good. Keep owning the top range and load will climb.");
  }

  const unlockedCount = nextWorkout.exercises.length - PROGRAM[getNextDayKey()].exercises.length;
  if (unlockedCount > 0) {
    insights.push(`Unlocked ${unlockedCount} extra accessory ${unlockedCount === 1 ? "move" : "moves"} for this day.`);
  }

  return insights.slice(0, 2);
}

function render() {
  const dayKey = getNextDayKey();
  const nextWorkout = getWorkoutForDay(dayKey);

  renderHero(nextWorkout);
  renderTriggerChips(nextWorkout);
  renderStats(nextWorkout);
  renderInsights(nextWorkout);
  renderNutritionStrip();
  renderWorkoutSummary(nextWorkout);
  renderCoachBrief(nextWorkout);
  renderWorkoutLogBar(nextWorkout);
  renderExerciseList(nextWorkout);
  renderHistory();
  renderAuthShell();

  elements.upperIncrement.value = state.settings.upperIncrementKg;
  elements.lowerIncrement.value = state.settings.lowerIncrementKg;
}

function renderHero(nextWorkout) {
  const phase = getTrainingPhase();
  const lastSession = getLastSession();
  const nextDayExposure = getDayExposureCount(getNextDayKey());
  elements.heroPanel.innerHTML = `
    <div class="hero-panel-grid">
      <div class="hero-stat">
        <span class="small-copy">Next Workout</span>
        <strong>${nextWorkout.label} | ${nextWorkout.title}</strong>
      </div>
      <div class="hero-stat">
        <span class="small-copy">Training Phase</span>
        <strong>${phase.name}</strong>
      </div>
      <div class="hero-stat">
        <span class="small-copy">Day Exposure</span>
        <strong>Run ${nextDayExposure + 1}</strong>
      </div>
      <div class="hero-stat">
        <span class="small-copy">Last Logged Session</span>
        <strong>${lastSession ? `${lastSession.dayKey} on ${formatDate(lastSession.date)}` : "No sessions yet"}</strong>
      </div>
    </div>
  `;
}

function renderTriggerChips(nextWorkout) {
  elements.triggerChipList.innerHTML = GYM_TRIGGER_CHIPS
    .map(
      (label) => `
        <button type="button" class="trigger-chip" data-trigger="${label}">
          ${label}
        </button>
      `,
    )
    .join("");

  const defaultMessage = `Next up: ${nextWorkout.label} | ${nextWorkout.title}. ${nextWorkout.tip}`;
  elements.coachTriggerMessage.textContent = defaultMessage;

  elements.triggerChipList.querySelectorAll(".trigger-chip").forEach((button) => {
    button.onclick = () => {
      const trigger = button.dataset.trigger || "Gym today";
      elements.coachTriggerMessage.textContent = buildTriggerMessage(trigger, nextWorkout);
      document.querySelector("#log-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    };
  });
}

function buildTriggerMessage(trigger, nextWorkout) {
  const opening =
    trigger === "At the gym"
      ? "You're already in the arena."
      : trigger === "Going to Cult"
        ? "Cult session locked in."
        : trigger === "What's my workout?"
          ? "Here's the move for today."
          : "Gym time.";

  return `${opening} ${nextWorkout.label} | ${nextWorkout.title}. ${nextWorkout.tip}`;
}

function renderStats(nextWorkout) {
  const currentWeekCount = state.sessions.filter((session) => isWithinCurrentWeek(session.date)).length;
  const recentAverageRpe = getRecentAverageRpe();
  const completionRate = DAY_ORDER.reduce((acc, dayKey) => acc + (getDayExposureCount(dayKey) > 0 ? 1 : 0), 0);
  const stats = [
    { label: "Total Sessions", value: state.sessions.length },
    { label: "Sessions This Week", value: currentWeekCount },
    { label: "Average Recent RPE", value: recentAverageRpe ? recentAverageRpe.toFixed(1) : "N/A" },
    { label: "Split Coverage", value: `${completionRate}/5 days touched` },
  ];

  elements.statsGrid.innerHTML = stats
    .map(
      (stat) => `
        <article class="stat-card">
          <p class="stat-label">${stat.label}</p>
          <p class="stat-value">${stat.value}</p>
        </article>
      `,
    )
    .join("");
}

function renderInsights(nextWorkout) {
  elements.coachInsights.innerHTML = buildCoachInsights(nextWorkout)
    .map(
      (insight) => `
        <article class="coach-card">
          <p class="coach-note">${insight}</p>
        </article>
      `,
    )
    .join("");
}

function renderNutritionStrip() {
  elements.nutritionStrip.innerHTML = `
    <article class="nutrition-card">
      <p class="micro-label">Chandu Context</p>
      <p>${TRAINER_PROFILE.athlete}</p>
      <p class="muted">${TRAINER_PROFILE.goal}</p>
      <p class="muted">${TRAINER_PROFILE.gym} | ${TRAINER_PROFILE.schedule}</p>
    </article>
    <article class="nutrition-card">
      <p class="micro-label">Nutrition Snapshot</p>
      <div class="nutrition-list">
        ${NUTRITION_SNAPSHOT.map((item) => `<span class="pill">${item}</span>`).join("")}
      </div>
    </article>
  `;
}

function renderWorkoutSummary(nextWorkout) {
  const phase = getTrainingPhase();
  const exposureCount = getDayExposureCount(getNextDayKey());
  const unlockedExercises = nextWorkout.exercises.filter((exercise) =>
    PROGRAM[getNextDayKey()].evolutions.some((rule) => rule.exercise.id === exercise.id),
  );

  elements.workoutSummary.innerHTML = `
    <div class="summary-grid">
      <article class="summary-card summary-card-highlight">
        <p class="eyebrow">${nextWorkout.label}</p>
        <h3>${nextWorkout.title}</h3>
        <p>${nextWorkout.focus}</p>
        <div class="pill-row">
          <span class="pill">${phase.name}</span>
          <span class="pill">${nextWorkout.exercises.length} moves</span>
          <span class="pill">Exposure ${exposureCount + 1}</span>
        </div>
      </article>
      <article class="summary-card">
        <p class="micro-label">Coach Note</p>
        <p>${nextWorkout.goal}</p>
        <p class="muted">
          ${
            unlockedExercises.length
              ? `Unlocked: ${unlockedExercises.map((exercise) => exercise.name).join(", ")}.`
              : "Base day only for now. Nail it and the extras will unlock."
          }
        </p>
      </article>
    </div>
  `;
}

function renderCoachBrief(nextWorkout) {
  const phase = getTrainingPhase();
  elements.coachBrief.innerHTML = `
    <div class="coach-brief-grid">
      <article class="brief-card">
        <p class="micro-label">Coach Brief</p>
        <h3>${nextWorkout.label} | ${nextWorkout.title}</h3>
        <p>${nextWorkout.motivation}</p>
        <p class="muted">${nextWorkout.tip}</p>
      </article>
      <article class="brief-card">
        <p class="micro-label">Execution Focus</p>
        <p>Stay in the ${phase.name.toLowerCase()} mindset: clean reps first, progression second.</p>
        <p class="muted">Add a little load or a rep every 1-2 weeks when form stays sharp.</p>
      </article>
    </div>
  `;
}

function buildExerciseSearchUrl(exerciseName) {
  const query = `${exerciseName} proper form gym exercise`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function formatDraftReps(reps) {
  if (!Array.isArray(reps) || !reps.length) {
    return "Tap + to start logging reps.";
  }

  return reps.map((rep) => `${rep}`).join(" · ");
}

function setExerciseDraftState(exerciseId, patch) {
  const current = getExerciseState(exerciseId);
  state.exerciseStates[exerciseId] = {
    ...current,
    ...patch,
  };
  markStateChanged();
  persistState();
}

function getLoggedRepsForExercise(exercise, exerciseState) {
  const draftReps = Array.isArray(exerciseState.draftReps) ? exerciseState.draftReps : [];
  if (draftReps.length) {
    return draftReps;
  }

  const fallback = parseRepsString(String(exerciseState.draftRepEntry || ""));
  return fallback.length ? fallback : [];
}

function renderWorkoutLogBar(nextWorkout) {
  const today = new Date().toISOString().slice(0, 10);
  const totalDraftSets = nextWorkout.exercises.reduce((count, exercise) => {
    const exerciseState = getExerciseState(exercise.id);
    return count + getLoggedRepsForExercise(exercise, exerciseState).length;
  }, 0);

  elements.workoutLogBar.innerHTML = `
    <div class="session-meta-grid">
      <label>
        <span>Date</span>
        <input name="date" type="date" value="${today}" required />
      </label>
      <label>
        <span>Overall RPE (1-10)</span>
        <input name="overallRpe" type="number" min="1" max="10" step="0.5" value="8" required />
      </label>
    </div>
    <label class="session-notes-field">
      <span>Session Notes</span>
      <textarea name="notes" placeholder="Energy, sleep, pump, or pain."></textarea>
    </label>
    <div class="workout-logbar-actions">
      <button type="submit" class="primary-button">Save Workout</button>
      <span class="mini-tag">${totalDraftSets} set${totalDraftSets === 1 ? "" : "s"} logged</span>
    </div>
  `;

  elements.workoutLogBar.onsubmit = (event) => {
    event.preventDefault();
    saveSession(nextWorkout, new FormData(elements.workoutLogBar));
  };
}

function renderExerciseList(nextWorkout) {
  elements.exerciseList.innerHTML = nextWorkout.exercises
    .map((exercise) => {
      const exerciseState = getExerciseState(exercise.id);
      const loggedReps = getLoggedRepsForExercise(exercise, exerciseState);
      const draftLoadKg = exerciseState.draftLoadKg ?? exerciseState.currentLoadKg ?? "";
      const draftRepEntry = exerciseState.draftRepEntry || exercise.repMax;
      const outcomeText =
        exerciseState.lastOutcome === "success"
          ? "up"
          : exerciseState.lastOutcome === "down"
            ? "down"
            : exerciseState.lastOutcome === "steady"
              ? "hold"
              : "new";

      return `
        <article class="exercise-card" data-exercise-id="${exercise.id}">
          <div class="exercise-title-row">
            <div>
              <h3>${exercise.name}</h3>
              <p>${exercise.cue}</p>
            </div>
            <div class="exercise-actions">
              <button type="button" class="exercise-plus-button" data-add-reps="${exercise.id}">+</button>
              <a
                class="exercise-search-link"
                href="${buildExerciseSearchUrl(exercise.name)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Form
              </a>
              <span class="mini-tag">${outcomeText}</span>
            </div>
          </div>
          <div class="exercise-grid">
            <div>
              <p class="micro-label">Prescription</p>
              <strong>${exercise.sets} sets x ${exercise.repMin}${exercise.repMax !== exercise.repMin ? `-${exercise.repMax}` : ""}${exercise.metric === "seconds" ? " sec" : " reps"}</strong>
            </div>
            <div>
              <p class="micro-label">Rest</p>
              <strong>${exercise.rest}</strong>
            </div>
            <div>
              <p class="micro-label">Target Load</p>
              <strong>${getRecommendedLoad(exercise)}</strong>
            </div>
            <div>
              <p class="micro-label">Trend</p>
              <strong>${exerciseState.sessionsCompleted || 0} logged</strong>
            </div>
          </div>
          <div class="exercise-log-inline">
            <label class="inline-field">
              <span>Load (kg)</span>
              <input
                class="load-input"
                type="number"
                step="0.5"
                min="0"
                ${exercise.loadTrack ? "" : "disabled"}
                value="${draftLoadKg}"
                placeholder="${exercise.loadTrack ? "Add load" : "Bodyweight"}"
              />
            </label>
            <label class="inline-field">
              <span>Reps</span>
              <input class="reps-input" type="number" min="1" step="1" value="${draftRepEntry}" />
            </label>
          </div>
          <div class="rep-chip-row">
            ${
              loggedReps.length
                ? loggedReps.map((rep) => `<span class="rep-chip">${rep}</span>`).join("")
                : `<span class="muted">Tap + to start logging reps.</span>`
            }
          </div>
        </article>
      `;
    })
    .join("");

  elements.exerciseList.querySelectorAll(".load-input").forEach((input) => {
    input.onchange = () => {
      const card = input.closest(".exercise-card");
      const exerciseId = card?.dataset.exerciseId;
      if (!exerciseId) {
        return;
      }

      setExerciseDraftState(exerciseId, {
        draftLoadKg: input.disabled || input.value === "" ? null : Number(input.value),
      });
    };
  });

  elements.exerciseList.querySelectorAll(".reps-input").forEach((input) => {
    input.onchange = () => {
      const card = input.closest(".exercise-card");
      const exerciseId = card?.dataset.exerciseId;
      if (!exerciseId) {
        return;
      }

      setExerciseDraftState(exerciseId, {
        draftRepEntry: input.value,
      });
    };
  });

  elements.exerciseList.querySelectorAll(".exercise-plus-button").forEach((button) => {
    button.onclick = () => {
      const exerciseId = button.dataset.addReps;
      if (!exerciseId) {
        return;
      }

      const card = button.closest(".exercise-card");
      const repsInput = card?.querySelector(".reps-input");
      const loadInput = card?.querySelector(".load-input");
      const repsValue = Number(repsInput?.value || "");
      if (!Number.isFinite(repsValue) || repsValue <= 0) {
        showToast("Enter reps first, then tap +.");
        return;
      }

      const exerciseState = getExerciseState(exerciseId);
      const nextDraftReps = [...(Array.isArray(exerciseState.draftReps) ? exerciseState.draftReps : []), repsValue];

      setExerciseDraftState(exerciseId, {
        draftReps: nextDraftReps,
        draftRepEntry: String(repsValue),
        draftLoadKg:
          loadInput && !loadInput.disabled && loadInput.value !== ""
            ? Number(loadInput.value)
            : exerciseState.draftLoadKg ?? exerciseState.currentLoadKg ?? null,
      });

      renderExerciseList(nextWorkout);
      renderWorkoutLogBar(nextWorkout);
      showToast(`Added ${repsValue} reps.`);
    };
  });
}

function saveSession(nextWorkout, formData) {
  const overallRpe = Number(formData.get("overallRpe"));
  const date = String(formData.get("date"));
  const notes = String(formData.get("notes") || "");
  const sessionId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const exerciseLogs = nextWorkout.exercises.map((exercise) => {
    const exerciseState = getExerciseState(exercise.id);
    const reps = getLoggedRepsForExercise(exercise, exerciseState);
    let performedLoadKg = null;
    if (exercise.loadTrack) {
      if (exerciseState.draftLoadKg != null && exerciseState.draftLoadKg !== "") {
        performedLoadKg = Number(exerciseState.draftLoadKg);
      } else if (exerciseState.currentLoadKg != null) {
        performedLoadKg = Number(exerciseState.currentLoadKg);
      }
    }
    const evaluation = evaluateExerciseOutcome(exercise, performedLoadKg, reps, overallRpe);

    state.exerciseStates[exercise.id] = {
      ...exerciseState,
      currentLoadKg: evaluation.nextLoadKg,
      topRangeStreak: evaluation.topRangeStreak,
      sessionsCompleted: (exerciseState.sessionsCompleted || 0) + 1,
      lastOutcome: evaluation.outcome,
      lastCompletedAt: date,
      draftLoadKg: evaluation.nextLoadKg ?? null,
      draftRepEntry: "",
      draftReps: [],
    };

    return {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      performedLoadKg,
      reps,
      outcome: evaluation.outcome,
      recommendation: evaluation.recommendation,
      hitMin: evaluation.hitMin,
      hitTop: evaluation.hitTop,
    };
  });

  state.sessions.push({
    id: sessionId,
    date,
    dayKey: getNextDayKey(),
    overallRpe,
    notes,
    exerciseLogs,
    createdAt: new Date().toISOString(),
  });

  markStateChanged();
  persistState();
  render();
  requestCloudSync("session_save");
  showToast(`Saved ${nextWorkout.label} | ${nextWorkout.title}. The app just advanced your cycle.`);
}

function renderHistory() {
  const sessions = getRecentSessions(4);
  if (!sessions.length) {
    elements.historyList.innerHTML = `
      <div class="empty-state">
        No workouts logged yet. Your first completed session will start the progression engine.
      </div>
    `;
    return;
  }

  elements.historyList.innerHTML = sessions
    .map((session) => {
      const wins = session.exerciseLogs.filter((log) => log.outcome === "success").length;
      const fatigue = session.exerciseLogs.filter((log) => log.outcome === "down").length;
      return `
        <article class="history-card">
          <div class="history-header">
            <div>
              <h3>${session.dayKey} | ${PROGRAM[session.dayKey].title}</h3>
              <p class="history-meta">${formatDate(session.date)} | RPE ${session.overallRpe}</p>
            </div>
            <div class="history-tags">
              <span class="outcome-chip success">${wins} up</span>
              <span class="outcome-chip ${fatigue ? "down" : "steady"}">${fatigue ? `${fatigue} down` : "steady"}</span>
            </div>
          </div>
          <p class="muted">${session.notes || "No session notes logged."}</p>
          <div class="history-tags">
            ${session.exerciseLogs
              .slice(0, 3)
              .map(
                (log) => `
                  <span class="outcome-chip ${log.outcome === "success" ? "success" : log.outcome === "down" ? "down" : "steady"}">
                    ${log.exerciseName}: ${log.outcome}
                  </span>
                `,
              )
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function saveSettings() {
  state.settings.upperIncrementKg = Number(elements.upperIncrement.value || 2.5);
  state.settings.lowerIncrementKg = Number(elements.lowerIncrement.value || 5);
  markStateChanged();
  persistState();
  render();
  requestCloudSync("settings_update");
  showToast("Progression settings saved.");
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chandu-gym-coach-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const raw = await file.text();
    const imported = JSON.parse(raw);
    const nextState = {
      ...createInitialState(),
      ...imported,
      settings: { ...createInitialState().settings, ...(imported.settings || {}) },
      exerciseStates: imported.exerciseStates || {},
      sessions: Array.isArray(imported.sessions) ? imported.sessions : [],
    };
    nextState.updatedAt = new Date().toISOString();
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, sanitizeLoadedState(nextState));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
    requestCloudSync("import");
    showToast("Workout data imported.");
  } catch {
    showToast("That file could not be imported. Use a previous JSON export from this app.");
  } finally {
    event.target.value = "";
  }
}

function resetData() {
  const shouldReset = window.confirm("Reset all workout history, progression, and settings?");
  if (!shouldReset) {
    return;
  }

  const freshState = createInitialState();
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, freshState);
  markStateChanged();
  persistState();
  render();
  requestCloudSync("reset");
  showToast("All workout data reset.");
}

function renderAuthShell() {
  const statusClass =
    authSnapshot.status === "synced" || authSnapshot.status === "signed_in"
      ? "ready"
      : authSnapshot.status === "error"
        ? "error"
        : authSnapshot.status === "not_configured" || authSnapshot.status === "signed_out"
          ? "off"
          : "waiting";

  if (!authSnapshot.configured) {
    elements.authShell.innerHTML = `
      <article class="auth-card">
        <div class="auth-status-line">
          <span class="status-pill ${statusClass}">Cloud Off</span>
        </div>
        <p>${authSnapshot.message}</p>
      </article>
    `;
    return;
  }

  if (!authSnapshot.session?.user) {
    elements.authShell.innerHTML = `
      <article class="auth-card">
        <div class="auth-status-line">
          <span class="status-pill ${statusClass}">Signed Out</span>
          <span class="small-copy">Supabase</span>
        </div>
        <label>
          <span>Email</span>
          <input id="magic-link-email" type="email" placeholder="you@example.com" />
        </label>
        <div class="auth-actions">
          <button id="send-magic-link" class="primary-button">Send Link</button>
          <button id="retry-cloud-check" class="ghost-button">Refresh</button>
        </div>
      </article>
    `;

    elements.authShell.querySelector("#send-magic-link").onclick = async () => {
      const emailInput = elements.authShell.querySelector("#magic-link-email");
      const email = emailInput.value.trim();
      if (!email) {
        showToast("Enter your email first so Supabase can send the magic link.");
        return;
      }
      const { error } = await syncManager.sendMagicLink(email);
      if (!error) {
        showToast("Magic link sent. Open it from your email to finish sign-in.");
      }
    };

    elements.authShell.querySelector("#retry-cloud-check").onclick = () => {
      syncManager.reconcileRemote("manual");
    };
    return;
  }

  elements.authShell.innerHTML = `
    <article class="auth-card">
      <div class="auth-status-line">
        <span class="status-pill ${statusClass}">Cloud Ready</span>
        <span class="small-copy">${authSnapshot.session.user.email || "Supabase user"}</span>
      </div>
      <p class="muted">
        ${
          authSnapshot.lastSyncedAt
            ? `Last sync: ${formatDate(authSnapshot.lastSyncedAt)}`
            : "Cloud sync will mark time after the first upload."
        }
      </p>
      <div class="auth-actions">
        <button id="sync-now" class="primary-button">Sync</button>
        <button id="load-cloud" class="ghost-button">Pull</button>
        <button id="sign-out" class="danger-button">Sign Out</button>
      </div>
    </article>
  `;

  elements.authShell.querySelector("#sync-now").onclick = async () => {
    const synced = await syncManager.pushState("manual");
    if (synced) {
      showToast("Cloud sync complete.");
    }
  };

  elements.authShell.querySelector("#load-cloud").onclick = async () => {
    const synced = await syncManager.reconcileRemote("manual");
    if (synced) {
      showToast("Compared local and cloud state.");
    }
  };

  elements.authShell.querySelector("#sign-out").onclick = () => {
    syncManager.signOut();
  };
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function isWithinCurrentWeek(value) {
  const input = new Date(value);
  const now = new Date();
  const day = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);
  return input >= weekStart;
}

function showToast(message) {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2800);
}
