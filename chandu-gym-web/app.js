import { coachingRules, focusTags, program } from "./workout-data.js";

const selectedDayKey = "fit-pulse-selected-day";
const elements = {
  focusTags: document.querySelector("#focus-tags"),
  programGrid: document.querySelector("#program-grid"),
  dayTabs: document.querySelector("#day-tabs"),
  detailPanel: document.querySelector("#detail-panel"),
  coachingGrid: document.querySelector("#coaching-grid"),
  printButton: document.querySelector("#print-plan"),
  expandButton: document.querySelector("#expand-all"),
};

let activeDay = window.localStorage.getItem(selectedDayKey) || program[0].letter;
let expandedAlternatives = new Set();
let allExpanded = false;

elements.printButton.addEventListener("click", () => window.print());
elements.expandButton.addEventListener("click", () => {
  allExpanded = !allExpanded;
  expandedAlternatives = new Set(
    allExpanded ? program.flatMap((day) => day.exercises.map((exercise) => exerciseKey(day, exercise))) : [],
  );
  renderProgram();
});

render();

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
      window.localStorage.setItem(selectedDayKey, activeDay);
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

document.addEventListener("click", (event) => {
  const cardButton = event.target.closest(".day-card-hit");
  if (!cardButton) {
    return;
  }

  activeDay = cardButton.dataset.day;
  window.localStorage.setItem(selectedDayKey, activeDay);
  renderDayTabs();
  renderProgram();
  document.querySelector("#detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
});
