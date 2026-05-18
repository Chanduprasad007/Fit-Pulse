import { coachingRules, focusTags, program } from "./workout-data.js";

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
};

let activeDay = program[0].letter;
let expandedAlternatives = new Set(program.flatMap((day) => day.exercises.map((exercise) => exerciseKey(day, exercise))));
let allExpanded = true;
let exerciseMedia = new Map();
let selectedAlternatives = new Map();

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
setTheme("light");
loadExerciseAnimations();
window.addEventListener("scroll", updateScrollScene, { passive: true });
updateScrollScene();

function render() {
  renderFocusTags();
  renderDayTabs();
  renderCoachingGrid();
  renderProgram();
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
      <strong>${day.exercises.length} exercises</strong>
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
  setTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
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
    const day = program.find((candidate) =>
      candidate.exercises.some((exercise) => exerciseKey(candidate, exercise) === panel.dataset.animationKey),
    );
    const exercise = day?.exercises.find((candidate) => exerciseKey(day, candidate) === panel.dataset.animationKey);
    const media = findMedia(query);
    if (!exercise || !media?.imageObjectUrl) {
      return;
    }
    panel.innerHTML = renderAnimationPanel(exercise);
  });
}

async function loadExerciseAnimations() {
  hydrateAnimationPanels();

  const uniqueQueries = [...new Set(getSelectedWorkout().exercises.map((exercise) => exercise.animationQuery || exercise.name))];

  for (const query of uniqueQueries) {
    await loadMediaForQuery(query);
  }
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
    try {
      const response = await fetch(`${WORKOUTX_API_BASE_URL}/exercises/name/${encodeURIComponent(searchTerm)}`, {
        headers: {
          Accept: "application/json",
          "X-WorkoutX-Key": WORKOUTX_API_KEY,
        },
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const results = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      const match = pickBestMediaResult(query, results);
      if (match) {
        return match;
      }
    } catch {
      // Try the next search term before falling back.
    }
  }

  return null;
}

async function fetchWorkoutXGif(gifUrl) {
  if (!gifUrl) {
    return "";
  }

  try {
    const response = await fetch(gifUrl, {
      headers: {
        Accept: "image/gif",
        "X-WorkoutX-Key": WORKOUTX_API_KEY,
      },
    });

    if (!response.ok) {
      return "";
    }

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
  loadExerciseAnimations();
  document.querySelector("#detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
});
