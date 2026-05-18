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

const mediaSeed = new Map([
  ["barbell bench press", { name: "barbell bench press", gifUrl: "https://static.exercisedb.dev/media/EIeI8Vf.gif" }],
]);

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
                <p>Use one of these if the station is busy, the movement irritates a joint, or you need a simpler setup:</p>
                <div>${exercise.alternatives.map((item) => `<a href="${googleFormUrl(item)}" target="_blank" rel="noopener noreferrer">${item}</a>`).join("")}</div>
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
  if (media?.gifUrl) {
    return `
      <figure class="movement-figure has-media">
        <img src="${media.gifUrl}" alt="${exercise.name} exercise demonstration" loading="lazy" />
        <figcaption>${media.name}</figcaption>
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
      <figcaption>3D form cue while online demo loads</figcaption>
    </figure>
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
    if (!exercise || !media?.gifUrl) {
      return;
    }
    panel.innerHTML = renderAnimationPanel(exercise);
  });
}

async function loadExerciseAnimations() {
  exerciseMedia = new Map(mediaSeed);
  hydrateAnimationPanels();

  try {
    let cursor = "";
    const wanted = new Set(program.flatMap((day) => day.exercises.map((exercise) => normalizeName(exercise.animationQuery || exercise.name))));

    for (let page = 0; page < 8 && wanted.size; page += 1) {
      const url = new URL("https://oss.exercisedb.dev/api/v1/exercises");
      if (cursor) {
        url.searchParams.set("after", cursor);
      }

      const response = await fetch(url);
      if (!response.ok) {
        break;
      }

      const payload = await response.json();
      const exercises = Array.isArray(payload?.data) ? payload.data : [];
      exercises.forEach((item) => {
        const key = normalizeName(item.name);
        exerciseMedia.set(key, item);
        wanted.forEach((wantedKey) => {
          if (key === wantedKey || key.includes(wantedKey) || wantedKey.includes(key)) {
            wanted.delete(wantedKey);
          }
        });
      });

      hydrateAnimationPanels();
      cursor = payload?.meta?.nextCursor;
      if (!payload?.meta?.hasNextPage || !cursor) {
        break;
      }
    }
  } catch {
    hydrateAnimationPanels();
  }
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

function updateScrollScene() {
  const scrollRatio = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
  elements.pageShell?.style.setProperty("--scroll-progress", scrollRatio.toFixed(3));
}

document.addEventListener("click", (event) => {
  const cardButton = event.target.closest(".day-card-hit");
  if (!cardButton) {
    return;
  }

  activeDay = cardButton.dataset.day;
  renderDayTabs();
  renderProgram();
  document.querySelector("#detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
});
