import {
  STORAGE_KEY,
  DAY_ORDER,
  PROGRAM,
  TRAINING_PHASES,
  TRAINER_PROFILE,
  NUTRITION_SNAPSHOT,
  programNotes,
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
  weekSplit: document.querySelector("#week-split"),
  coachInsights: document.querySelector("#coach-insights"),
  workoutSummary: document.querySelector("#workout-summary"),
  coachBrief: document.querySelector("#coach-brief"),
  exerciseList: document.querySelector("#exercise-list"),
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

document.querySelector("#jump-to-workout").addEventListener("click", () => {
  document.querySelector("#workout-panel").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#print-workout").addEventListener("click", () => window.print());
document.querySelector("#save-settings").addEventListener("click", saveSettings);
document.querySelector("#export-data").addEventListener("click", exportData);
document.querySelector("#reset-data").addEventListener("click", resetData);
elements.importData.addEventListener("change", importData);
elements.themeToggle.addEventListener("click", toggleTheme);
elements.installApp.addEventListener("click", installPwa);
elements.weekSplit.addEventListener("click", handleWeekSplitClick);
elements.exerciseList.addEventListener("click", handleExerciseListClick);
elements.exerciseList.addEventListener("input", handleExerciseListInput);
elements.exerciseList.addEventListener("keydown", handleExerciseListKeydown);

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
    ui: { ...base.ui, ...((candidate || {}).ui || {}) },
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

function getSelectedWorkoutDayKey() {
  const selected = state.ui?.selectedWorkoutDayKey;
  return selected && PROGRAM[selected] ? selected : getNextDayKey();
}

function setSelectedWorkoutDayKey(dayKey) {
  if (!PROGRAM[dayKey]) {
    return;
  }

  state.ui = { ...(state.ui || {}), selectedWorkoutDayKey: dayKey };
  markStateChanged();
  persistState();
  render();
  requestCloudSync("routine_select");
  showToast(`Viewing ${PROGRAM[dayKey].label} | ${PROGRAM[dayKey].title}.`);
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
    repLogs: [],
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
    insights.push("Use week one to calibrate loads.");
  } else if (recentAverageRpe >= 9.2) {
    insights.push("Recent effort is high. Hold loads steady.");
  } else if (recentAverageRpe > 0 && recentAverageRpe <= 8.2) {
    insights.push("Recovery looks good. Push the top range.");
  }

  const unlockedCount = nextWorkout.exercises.length - (PROGRAM[nextWorkout.dayKey]?.exercises.length || nextWorkout.exercises.length);
  if (unlockedCount > 0) {
    insights.push(`+${unlockedCount} extra accessory ${unlockedCount === 1 ? "move" : "moves"} unlocked.`);
  }

  return insights.slice(0, 2);
}

function render() {
  const suggestedDayKey = getNextDayKey();
  const selectedDayKey = getSelectedWorkoutDayKey();
  const suggestedWorkout = getWorkoutForDay(suggestedDayKey);
  const selectedWorkout = getWorkoutForDay(selectedDayKey);

  renderHero(selectedWorkout, suggestedWorkout, selectedDayKey, suggestedDayKey);
  renderTriggerChips(selectedWorkout, suggestedWorkout, selectedDayKey, suggestedDayKey);
  renderStats(selectedWorkout, selectedDayKey, suggestedDayKey);
  renderWeekSplit(selectedDayKey, suggestedDayKey);
  renderInsights(selectedWorkout);
  renderNutritionStrip();
  renderWorkoutSummary(selectedWorkout, suggestedWorkout, selectedDayKey, suggestedDayKey);
  renderCoachBrief(selectedWorkout, suggestedWorkout, selectedDayKey, suggestedDayKey);
  renderExerciseList(selectedWorkout);
  renderAuthShell();

  elements.upperIncrement.value = state.settings.upperIncrementKg;
  elements.lowerIncrement.value = state.settings.lowerIncrementKg;
}

function renderHero(selectedWorkout, suggestedWorkout, selectedDayKey, suggestedDayKey) {
  const phase = getTrainingPhase();
  const lastSession = getLastSession();
  const selectedExposure = getDayExposureCount(selectedDayKey);
  const isSuggestedSelected = selectedDayKey === suggestedDayKey;
  elements.heroPanel.innerHTML = `
    <div class="hero-panel-grid">
      <article class="hero-stat hero-stat-wide">
        <span class="small-copy">Selected Routine</span>
        <strong>${selectedWorkout.label} · ${selectedWorkout.title}</strong>
        <p class="hero-stat-note">Tap any day card below to switch the workout view.</p>
      </article>
      <article class="hero-stat">
        <span class="small-copy">Workout Focus</span>
        <strong>${selectedWorkout.type}</strong>
        <p class="hero-stat-note">${selectedWorkout.focus}</p>
      </article>
      <article class="hero-stat">
        <span class="small-copy">Progress Rule</span>
        <strong>+${state.settings.upperIncrementKg}/${state.settings.lowerIncrementKg} kg</strong>
        <p class="hero-stat-note">${programNotes.progressiveOverload}</p>
      </article>
      <article class="hero-stat">
        <span class="small-copy">${isSuggestedSelected ? "Cycle Match" : "Cycle Suggestion"}</span>
        <strong>${suggestedWorkout.label} · ${suggestedWorkout.title}</strong>
        <p class="hero-stat-note">${isSuggestedSelected ? "You are on the next programmed day." : "The split suggests this next."}</p>
      </article>
      <article class="hero-stat">
        <span class="small-copy">Training Phase</span>
        <strong>${phase.name}</strong>
        <p class="hero-stat-note">${phase.summary}</p>
      </article>
      <article class="hero-stat">
        <span class="small-copy">Last Logged Session</span>
        <strong>${lastSession ? `${lastSession.dayKey} on ${formatDate(lastSession.date)}` : "No sessions yet"}</strong>
        <p class="hero-stat-note">Exposure on this routine: ${selectedExposure}</p>
      </article>
    </div>
  `;
}

function renderTriggerChips(selectedWorkout) {
  elements.triggerChipList.innerHTML = GYM_TRIGGER_CHIPS
    .map(
      (label) => `
        <button type="button" class="trigger-chip" data-trigger="${label}">
          ${label}
        </button>
      `,
    )
    .join("");

  const defaultMessage = `Viewing: ${selectedWorkout.label} | ${selectedWorkout.title}. ${selectedWorkout.tip}`;
  elements.coachTriggerMessage.textContent = defaultMessage;

  elements.triggerChipList.querySelectorAll(".trigger-chip").forEach((button) => {
    button.onclick = () => {
      const trigger = button.dataset.trigger || "Gym today";
      elements.coachTriggerMessage.textContent = buildTriggerMessage(trigger, selectedWorkout);
      document.querySelector("#workout-panel").scrollIntoView({ behavior: "smooth", block: "start" });
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

function renderStats(selectedWorkout, selectedDayKey, suggestedDayKey) {
  const currentWeekCount = state.sessions.filter((session) => isWithinCurrentWeek(session.date)).length;
  const recentAverageRpe = getRecentAverageRpe();
  const completionRate = DAY_ORDER.reduce((acc, dayKey) => acc + (getDayExposureCount(dayKey) > 0 ? 1 : 0), 0);
  const stats = [
    { label: "Total Sessions", value: state.sessions.length },
    { label: "Sessions This Week", value: currentWeekCount },
    { label: "Average Recent RPE", value: recentAverageRpe ? recentAverageRpe.toFixed(1) : "N/A" },
    { label: "Selected Routine", value: `${selectedWorkout.label}` },
    { label: "Split Coverage", value: `${completionRate}/${DAY_ORDER.length} days touched` },
    { label: "Cycle Next", value: PROGRAM[suggestedDayKey].label },
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

function renderWeekSplit(selectedDayKey, suggestedDayKey) {
  elements.weekSplit.innerHTML = DAY_ORDER.map((dayKey) => {
    const workout = getWorkoutForDay(dayKey);
    const exposureCount = getDayExposureCount(dayKey);
    const previewExercises = workout.exercises.slice(0, 2);
    const remainingCount = Math.max(0, workout.exercises.length - previewExercises.length);
    const selectedLabel = dayKey === selectedDayKey ? "Selected" : dayKey === suggestedDayKey ? "Suggested" : `${exposureCount}x`;

    return `
      <article class="split-card ${dayKey === selectedDayKey ? "is-active" : ""}">
        <div class="split-card-head">
          <div>
            <p class="micro-label">${workout.label}</p>
            <h3>${workout.title}</h3>
          </div>
          <div class="split-actions">
            <span class="split-badge">${selectedLabel}</span>
            <button
              type="button"
              class="split-select-button"
              data-action="select-routine"
              data-day-key="${dayKey}"
            >
              ${dayKey === selectedDayKey ? "Viewing" : "Use this"}
            </button>
          </div>
        </div>
        <p class="split-copy">${workout.focus}</p>
        <div class="split-meta">
          <span>${workout.exercises.length} moves</span>
          <span>${workout.type}</span>
        </div>
        <div class="split-tags">
          ${previewExercises.map((exercise) => `<span class="pill split-pill">${exercise.name}</span>`).join("")}
          ${remainingCount > 0 ? `<span class="pill split-pill">+${remainingCount} more</span>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function renderInsights(selectedWorkout) {
  elements.coachInsights.innerHTML = buildCoachInsights(selectedWorkout)
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
      <p class="micro-label">Athlete</p>
      <p>${TRAINER_PROFILE.athlete}</p>
      <p class="muted">${TRAINER_PROFILE.goal}</p>
    </article>
    <article class="nutrition-card">
      <p class="micro-label">Fuel Stack</p>
      <div class="nutrition-list">
        ${NUTRITION_SNAPSHOT.map((item) => `<span class="pill">${item}</span>`).join("")}
      </div>
      <p class="muted">${TRAINER_PROFILE.gym} · ${TRAINER_PROFILE.schedule}</p>
    </article>
  `;
}

function renderWorkoutSummary(selectedWorkout, suggestedWorkout, selectedDayKey, suggestedDayKey) {
  const phase = getTrainingPhase();
  const exposureCount = getDayExposureCount(selectedDayKey);
  const unlockedExercises = selectedWorkout.exercises.filter((exercise) =>
    PROGRAM[selectedDayKey].evolutions.some((rule) => rule.exercise.id === exercise.id),
  );

  elements.workoutSummary.innerHTML = `
    <div class="summary-grid">
      <article class="summary-card summary-card-highlight">
        <div class="summary-head">
          <p class="eyebrow">${selectedWorkout.label}</p>
          <span class="status-pill ready">${phase.name}</span>
        </div>
        <h3>${selectedWorkout.title}</h3>
        <p>${selectedWorkout.focus}</p>
        <div class="pill-row">
          <span class="pill">${selectedWorkout.exercises.length} moves</span>
          <span class="pill">Exposure ${exposureCount + 1}</span>
          <span class="pill">${getRecentSessions(1).length ? "History on file" : "Start fresh"}</span>
          <span class="pill">${selectedDayKey === suggestedDayKey ? "On cycle" : `Cycle next: ${suggestedWorkout.label}`}</span>
        </div>
      </article>
      <article class="summary-card">
        <p class="micro-label">Session Goal</p>
        <p>${selectedWorkout.goal}</p>
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

function renderCoachBrief(selectedWorkout) {
  const phase = getTrainingPhase();
  elements.coachBrief.innerHTML = `
    <div class="coach-brief-grid">
      <article class="brief-card">
        <p class="micro-label">Coach Brief</p>
        <h3>${selectedWorkout.label} | ${selectedWorkout.title}</h3>
        <p>${selectedWorkout.motivation}</p>
        <p class="muted">${selectedWorkout.tip}</p>
      </article>
      <article class="brief-card">
        <p class="micro-label">Execution Focus</p>
        <p>${phase.summary}</p>
        <p class="muted">Clean reps first. Add a little load or a rep when form stays sharp.</p>
      </article>
    </div>
  `;
}

function buildExerciseSearchUrl(exerciseName) {
  const query = `${exerciseName} proper form gym exercise`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function getLoggedRepEntries(exerciseState) {
  return Array.isArray(exerciseState.repLogs) ? exerciseState.repLogs : [];
}

function getLoggedRepTotal(exerciseState) {
  return getLoggedRepEntries(exerciseState).reduce((sum, entry) => sum + Number(entry.reps || 0), 0);
}

function getExerciseDraftValue(exerciseState) {
  return exerciseState.draftRepEntry ?? "";
}

function createRepEntry(reps) {
  return {
    id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `rep-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    reps: Number(reps),
    createdAt: new Date().toISOString(),
  };
}

function renderExerciseList(nextWorkout) {
  elements.exerciseList.innerHTML = nextWorkout.exercises
    .map((exercise) => {
      const exerciseState = getExerciseState(exercise.id);
      const repEntries = getLoggedRepEntries(exerciseState);
      const totalLoggedReps = getLoggedRepTotal(exerciseState);
      const outcomeText =
        exerciseState.lastOutcome === "success"
          ? "up"
          : exerciseState.lastOutcome === "down"
            ? "down"
            : exerciseState.lastOutcome === "steady"
              ? "hold"
              : "new";

      return `
        <article class="exercise-card">
          <div class="exercise-title-row">
            <div>
              <h3>${exercise.name}</h3>
              <p>${exercise.cue}</p>
            </div>
            <div class="exercise-actions">
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
              <strong>${totalLoggedReps ? `${totalLoggedReps} reps` : "No reps yet"}</strong>
            </div>
          </div>
          <div class="rep-tracker">
            <div class="rep-tracker-head">
              <p class="micro-label">Quick Log</p>
              <span class="rep-tracker-total">${repEntries.length} entries</span>
            </div>
            <div class="rep-entry-row">
              <input
                class="rep-entry-input"
                type="number"
                min="1"
                step="1"
                placeholder="Reps"
                value="${getExerciseDraftValue(exerciseState)}"
                data-role="rep-entry"
                data-exercise-id="${exercise.id}"
              />
              <button type="button" class="rep-add-button" data-action="add-reps" data-exercise-id="${exercise.id}">
                +
              </button>
            </div>
            <div class="rep-chip-list">
              ${
                repEntries.length
                  ? repEntries
                      .map(
                        (entry) => `
                          <button
                            type="button"
                            class="rep-chip"
                            data-action="remove-reps"
                            data-exercise-id="${exercise.id}"
                            data-entry-id="${entry.id}"
                            title="Remove ${entry.reps} reps"
                          >
                            ${entry.reps} reps ×
                          </button>
                        `,
                      )
                      .join("")
                  : `<p class="muted rep-empty">Tap + to log reps. Tap a chip to delete it.</p>`
              }
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function handleWeekSplitClick(event) {
  const button = event.target.closest("[data-action='select-routine']");
  if (!button) {
    return;
  }

  const dayKey = button.dataset.dayKey;
  setSelectedWorkoutDayKey(dayKey);
}

function handleExerciseListInput(event) {
  const input = event.target.closest("[data-role='rep-entry']");
  if (!input) {
    return;
  }

  const { exerciseId } = input.dataset;
  if (!exerciseId) {
    return;
  }

  const exerciseState = getExerciseState(exerciseId);
  state.exerciseStates[exerciseId] = {
    ...exerciseState,
    draftRepEntry: input.value,
  };
  markStateChanged();
  persistState();
}

function handleExerciseListKeydown(event) {
  const input = event.target.closest("[data-role='rep-entry']");
  if (!input || event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  const { exerciseId } = input.dataset;
  if (!exerciseId) {
    return;
  }

  addRepToExercise(exerciseId, input.value);
}

function handleExerciseListClick(event) {
  const addButton = event.target.closest("[data-action='add-reps']");
  if (addButton) {
    const { exerciseId } = addButton.dataset;
    const input = elements.exerciseList.querySelector(`[data-role='rep-entry'][data-exercise-id="${exerciseId}"]`);
    addRepToExercise(exerciseId, input?.value || "");
    return;
  }

  const removeButton = event.target.closest("[data-action='remove-reps']");
  if (removeButton) {
    const { exerciseId, entryId } = removeButton.dataset;
    removeRepFromExercise(exerciseId, entryId);
  }
}

function addRepToExercise(exerciseId, value) {
  const reps = Number(String(value).trim());
  if (!exerciseId || !Number.isFinite(reps) || reps <= 0) {
    showToast("Enter a valid rep count before tapping +.");
    return;
  }

  const exerciseState = getExerciseState(exerciseId);
  const repLogs = getLoggedRepEntries(exerciseState);
  state.exerciseStates[exerciseId] = {
    ...exerciseState,
    draftRepEntry: "",
    repLogs: [...repLogs, createRepEntry(reps)],
  };
  markStateChanged();
  persistState();
  render();
  requestCloudSync("rep_log_add");
}

function removeRepFromExercise(exerciseId, entryId) {
  if (!exerciseId || !entryId) {
    return;
  }

  const exerciseState = getExerciseState(exerciseId);
  const repLogs = getLoggedRepEntries(exerciseState);
  const nextLogs = repLogs.filter((entry) => entry.id !== entryId);
  if (nextLogs.length === repLogs.length) {
    return;
  }

  state.exerciseStates[exerciseId] = {
    ...exerciseState,
    repLogs: nextLogs,
  };
  markStateChanged();
  persistState();
  render();
  requestCloudSync("rep_log_remove");
}

function saveSession(nextWorkout, formData) {
  const overallRpe = Number(formData.get("overallRpe"));
  const date = String(formData.get("date"));
  const notes = String(formData.get("notes") || "");
  const sessionId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const exerciseLogs = nextWorkout.exercises.map((exercise) => {
    const loadValue = formData.get(`load:${exercise.id}`);
    const performedLoadKg = loadValue ? Number(loadValue) : null;
    const reps = parseRepsString(String(formData.get(`reps:${exercise.id}`) || ""));
    const evaluation = evaluateExerciseOutcome(exercise, performedLoadKg, reps, overallRpe);
    const exerciseState = getExerciseState(exercise.id);

    state.exerciseStates[exercise.id] = {
      ...exerciseState,
      currentLoadKg: evaluation.nextLoadKg,
      topRangeStreak: evaluation.topRangeStreak,
      sessionsCompleted: (exerciseState.sessionsCompleted || 0) + 1,
      lastOutcome: evaluation.outcome,
      lastCompletedAt: date,
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
    dayKey: nextWorkout.dayKey,
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

function renderHistory() {}

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
      ui: { ...createInitialState().ui, ...(imported.ui || {}) },
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
