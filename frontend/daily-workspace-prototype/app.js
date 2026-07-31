(function () {
  "use strict";

  const state = {
    destination: "today",
    mode: "day",
    periodOffset: { day: 0, week: 0, month: 0 },
    insightsOffset: -1,
    planOffset: 0,
    foregroundId: "backend",
    activityOrder: 3,
    activities: [
      { id: "backend", name: "Backend schema and migration review", project: "Theseus", running: true, clock: "18:42", today: "2h 10m", startedOrder: 2 },
      { id: "course", name: "Coursework literature review notes", project: "Coursework", running: true, clock: "07:15", today: "1h 25m", startedOrder: 1 },
      { id: "walk", name: "Walk", project: "Recovery", running: false, clock: "00:00", today: "1h 00m", startedOrder: 0 },
    ],
    preview: { today: "normal", insights: "normal", plan: "normal" },
  };

  const previewStates = {
    today: [
      ["normal", "Recorded day"],
      ["loading", "Time loading"],
      ["empty", "No recorded time"],
      ["sparse", "Sparse evidence"],
      ["no-focus", "No foreground Activity"],
      ["history-updated", "History corrected"],
      ["chart-error", "Chart load error"],
      ["focus-error", "Focus load error"],
    ],
    insights: [
      ["normal", "Needs attention"],
      ["loading", "Loading"],
      ["no-evidence", "No week evidence"],
      ["no-review", "Review not created"],
      ["steady", "No attention signals"],
      ["stale", "Review out of date"],
      ["error", "Load error"],
    ],
    plan: [
      ["normal", "Active proposal"],
      ["loading", "Loading"],
      ["no-plan", "No plan"],
      ["capacity-missing", "Capacity missing"],
      ["applying", "Proposal applying"],
      ["conflict", "Conflict"],
      ["verified", "Verified save"],
      ["undoing", "Undo in progress"],
      ["undo-success", "Undo success"],
      ["undo-error", "Undo failure"],
      ["load-error", "Plan load error"],
      ["save-error", "Plan not saved"],
      ["unknown", "Save status unknown"],
    ],
  };

  const titles = {
    today: ["Today", "Thursday, July 30"],
    insights: ["Insights", "Weekly evidence"],
    plan: ["Plan", "Next commitments"],
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const icon = (name) => `<svg aria-hidden="true"><use href="#icon-${name}" /></svg>`;
  const evidenceAttributes = ({ date = "", category = "", recordIds = [], duration = "", period = "" }) => [
    date ? `data-evidence-date="${date}"` : "",
    category ? `data-evidence-category="${category}"` : "",
    recordIds.length ? `data-record-ids="${recordIds.join(",")}"` : "",
    duration ? `data-evidence-duration="${duration}"` : "",
    period ? `data-evidence-period="${period}"` : "",
  ].filter(Boolean).join(" ");

  const todayContent = $("#today-content");
  const insightsContent = $("#insights-content");
  const planContent = $("#plan-content");
  const stateSelect = $("#state-select");
  const drawer = $("#drawer");
  const overlay = $("#overlay");
  const drawerTitle = $("#drawer-title");
  const drawerBody = $("#drawer-body");
  const toast = $("#toast");
  let lastFocused = null;
  const drawerStack = [];
  let drawerContext = {};
  let toastTimer = null;

  function activityById(id) {
    return state.activities.find((activity) => activity.id === id) || null;
  }

  function runningActivities() {
    return state.activities
      .filter((activity) => activity.running)
      .sort((left, right) => right.startedOrder - left.startedOrder);
  }

  function foregroundActivity() {
    return activityById(state.foregroundId)
      || runningActivities()[0]
      || state.activities[0]
      || null;
  }

  function selectFallbackForeground() {
    const nextRunning = runningActivities()[0];
    if (nextRunning) state.foregroundId = nextRunning.id;
  }

  function toggleForegroundActivity() {
    const activity = foregroundActivity();
    if (!activity) return null;
    if (activity.running) {
      activity.running = false;
      selectFallbackForeground();
    } else {
      activity.running = true;
      activity.startedOrder = state.activityOrder++;
      activity.clock = "00:00";
    }
    return activity;
  }

  function setDestination(destination, focusWorkspace = true) {
    state.destination = destination;
    if (window.location.hash !== `#${destination}`) {
      window.history.replaceState(null, "", `#${destination}`);
    }
    $$(".destination").forEach((view) => {
      const active = view.id === `view-${destination}`;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
    $$("[data-destination]").forEach((button) => {
      const active = button.dataset.destination === destination;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    $("#screen-title").textContent = titles[destination][0];
    $("#header-context").textContent = titles[destination][1];
    $(".app-frame").scrollTop = 0;
    updateStateSelect();
    renderActiveDestination();
    closePrototypePanel();
    if (focusWorkspace) $("#workspace").focus({ preventScroll: true });
  }

  function updateStateSelect() {
    const options = previewStates[state.destination];
    stateSelect.innerHTML = options
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join("");
    stateSelect.value = state.preview[state.destination];
  }

  function renderActiveDestination() {
    if (state.destination === "today") renderToday();
    if (state.destination === "insights") renderInsights();
    if (state.destination === "plan") renderPlan();
  }

  function renderFocus() {
    const focusError = state.preview.today === "focus-error";
    const noFocus = state.preview.today === "no-focus";
    const identity = $("#focus-identity");
    const timer = $("#focus-timer");
    const action = $("#focus-action");
    const running = $("#running-control");

    if (focusError) {
      identity.innerHTML = `<span class="focus-name">Focus state could not load</span><span class="focus-meta">Running state is unknown</span>`;
      timer.textContent = "—";
      action.disabled = true;
      action.setAttribute("aria-label", "Focus unavailable");
      running.hidden = true;
      return;
    }

    if (noFocus) {
      identity.innerHTML = `<span class="focus-name">Choose an Activity</span><span class="focus-meta">Nothing selected</span>`;
      timer.textContent = "—";
      action.innerHTML = icon("play");
      action.disabled = false;
      action.setAttribute("aria-label", "Choose an Activity before starting focus");
      running.hidden = true;
      return;
    }

    const foreground = foregroundActivity();
    const runningCount = runningActivities().length;
    if (!foreground) return;
    running.hidden = runningCount < 2;
    running.textContent = `${runningCount} running`;
    if (foreground.running) {
      identity.innerHTML = `<span class="focus-name">${foreground.name}</span><span class="focus-meta">${foreground.project} · Focus</span>`;
      timer.textContent = foreground.clock;
      action.innerHTML = icon("stop");
      action.setAttribute("aria-label", `End ${foreground.name}`);
      action.disabled = false;
    } else {
      identity.innerHTML = `<span class="focus-name">${foreground.name}</span><span class="focus-meta">${foreground.project} · Ready</span>`;
      timer.textContent = "—";
      action.innerHTML = icon("play");
      action.setAttribute("aria-label", `Start ${foreground.name}`);
      action.disabled = false;
    }
  }

  function renderToday() {
    renderFocus();
    updateTodayRange();
    const preview = state.preview.today;
    if (preview === "loading") {
      todayContent.innerHTML = skeletonState("Loading recorded time");
      return;
    }
    if (preview === "empty") {
      todayContent.innerHTML = stateSurface("today", "No time recorded", "Start a focus session when you are ready.", "Start focus", "data-start-focus");
      return;
    }
    if (preview === "chart-error") {
      todayContent.innerHTML = stateSurface("warning", "Time summary could not load", "Focus remains available. Recorded evidence has not been replaced.", "Retry", "data-retry-today");
      return;
    }
    if (preview === "focus-error") {
      todayContent.innerHTML = state.mode === "day" ? dayView() : state.mode === "week" ? weekView() : monthView();
      return;
    }
    if (preview === "sparse") {
      todayContent.innerHTML = sparseView();
      return;
    }
    const content = state.mode === "day" ? dayView() : state.mode === "week" ? weekView() : monthView();
    todayContent.innerHTML = preview === "history-updated"
      ? `<div class="state-inline is-success panel-wide"><div class="state-heading"><strong>History updated</strong><button class="secondary-action" type="button" data-undo-history>${icon("undo")}Undo</button></div><p>Chart totals now match the corrected records. The overlapping Review is out of date.</p></div>${content}`
      : content;
  }

  function updateTodayRange() {
    const offset = state.periodOffset[state.mode];
    const historical = offset < 0;
    const labels = {
      day: historical ? "Thu, Jul 23" : "Thu, Jul 30",
      week: historical ? "Jun 8 – Jun 14" : "Jul 27 – Aug 2",
      month: historical ? "June 2026" : "July 2026",
    };
    const nouns = { day: "day", week: "week", month: "month" };
    $("#today-period-label").textContent = labels[state.mode];
    $("#today-reset").hidden = !historical;
    const previous = $("[data-period='previous']");
    const next = $("[data-period='next']");
    previous.setAttribute("aria-label", `Previous ${nouns[state.mode]}`);
    next.setAttribute("aria-label", `Next ${nouns[state.mode]}`);
    next.disabled = !historical;
  }

  function dayView() {
    const historical = state.periodOffset.day < 0;
    const selectedDate = historical ? "2026-07-23" : "2026-07-30";
    const timelineTitle = historical ? "Thu, Jul 23 timeline" : "Today timeline";
    const projectEvidence = {
      Theseus: historical ? ["TL-20260723-01"] : ["TL-20260730-01"],
      Coursework: historical ? ["TL-20260723-02"] : ["TL-20260730-02"],
      Recovery: historical ? ["TL-20260723-03"] : ["TL-20260730-03"],
    };
    return `
      <section class="panel" aria-labelledby="distribution-title">
        <div class="panel-heading">
          <h2 id="distribution-title">Time by project</h2>
          <button class="icon-button data-button" type="button" data-open="distribution" ${evidenceAttributes({ date: selectedDate, recordIds: Object.values(projectEvidence).flat(), duration: "4h 35m" })} aria-label="View time distribution data">${icon("list")}</button>
        </div>
        <button class="donut-chart-button" type="button" data-open="distribution" ${evidenceAttributes({ date: selectedDate, recordIds: Object.values(projectEvidence).flat(), duration: "4h 35m" })} aria-label="View all time distribution data for ${timelineTitle.replace(" timeline", "")}">
          <span class="donut-wrap">
          <svg class="donut" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <circle class="donut-track" cx="60" cy="60" r="44" />
            <circle class="donut-segment segment-theseus" cx="60" cy="60" r="44" pathLength="100" stroke-dasharray="47 53" stroke-dashoffset="0" />
            <circle class="donut-segment segment-course" cx="60" cy="60" r="44" pathLength="100" stroke-dasharray="31 69" stroke-dashoffset="-47" />
            <circle class="donut-segment segment-recovery" cx="60" cy="60" r="44" pathLength="100" stroke-dasharray="22 78" stroke-dashoffset="-78" />
          </svg>
          <div class="donut-total"><strong>4h 35m</strong><span>recorded</span></div>
          </span>
        </button>
        <div class="legend" aria-label="Time distribution legend">
          ${legendRow("Theseus", "2h 10m", "47%", "theseus", "project-evidence", evidenceAttributes({ date: selectedDate, category: "Theseus", recordIds: projectEvidence.Theseus, duration: "2h 10m" }))}
          ${legendRow("Coursework", "1h 25m", "31%", "course", "project-evidence", evidenceAttributes({ date: selectedDate, category: "Coursework", recordIds: projectEvidence.Coursework, duration: "1h 25m" }))}
          ${legendRow("Recovery", "1h 00m", "22%", "recovery", "project-evidence", evidenceAttributes({ date: selectedDate, category: "Recovery", recordIds: projectEvidence.Recovery, duration: "1h 00m" }))}
        </div>
      </section>
      <section class="panel" aria-labelledby="timeline-title">
        <div class="panel-heading">
          <h2 id="timeline-title">${timelineTitle}</h2>
          <button class="icon-button data-button" type="button" data-open="day-history" ${evidenceAttributes({ date: selectedDate, recordIds: Object.values(projectEvidence).flat(), duration: "4h 35m" })} aria-label="Open ${timelineTitle.toLowerCase()}">${icon("arrow")}</button>
        </div>
        <div class="timeline" aria-label="Selected day timeline preview">
          <time>09:00</time><div class="timeline-band">Backend schema · 2h 10m</div>
          <time>11:30</time><div class="timeline-band course">Course reading · 1h 25m</div>
          <time>14:10</time><div class="timeline-band recovery">Walk · 1h</div>
        </div>
      </section>`;
  }

  function legendRow(label, duration, percent, className, openName, attributes = "") {
    return `<div class="legend-row"><span class="swatch ${className}" aria-hidden="true"></span><button type="button" data-open="${openName}" ${attributes}>${label}</button><strong>${duration}</strong><small>${percent}</small></div>`;
  }

  function weekView() {
    const historical = state.periodOffset.week < 0;
    const currentDays = [
      ["2026-07-27", "M", "Mon", 200, [100, 60, 40]],
      ["2026-07-28", "T", "Tue", 280, [130, 90, 60]],
      ["2026-07-29", "W", "Wed", 160, [70, 55, 35]],
      ["2026-07-30", "T", "Thu", 270, [120, 90, 60]],
      ["2026-07-31", "F", "Fri", null, []],
      ["2026-08-01", "S", "Sat", null, []],
      ["2026-08-02", "S", "Sun", null, []],
    ];
    const historicalDays = [
      ["2026-06-08", "M", "Mon", 200, [100, 60, 40]],
      ["2026-06-09", "T", "Tue", 280, [130, 90, 60]],
      ["2026-06-10", "W", "Wed", 160, [70, 55, 35]],
      ["2026-06-11", "T", "Thu", 270, [120, 90, 60]],
      ["2026-06-12", "F", "Fri", 275, [125, 95, 55]],
      ["2026-06-13", "S", "Sat", 165, [70, 55, 40]],
      ["2026-06-14", "S", "Sun", 130, [55, 45, 30]],
    ];
    const days = historical ? historicalDays : currentDays;
    const weekPeriod = historical ? "2026-06-08/2026-06-14" : "2026-07-27/2026-08-02";
    const total = historical ? "24h 40m" : "15h 10m";
    const allRecordIds = days.flatMap((day) => day[3] === null ? [] : weekRecordIds(day[0]));
    const legendValues = historical
      ? [["Theseus", "11h 10m", "45%", "theseus"], ["Coursework", "8h 10m", "33%", "course"], ["Recovery", "5h 20m", "22%", "recovery"]]
      : [["Theseus", "7h 00m", "46%", "theseus"], ["Coursework", "4h 55m", "32%", "course"], ["Recovery", "3h 15m", "21%", "recovery"]];
    return `
      <section class="panel panel-wide" aria-labelledby="week-chart-title">
        <div class="panel-heading">
          <h2 id="week-chart-title">Recorded time by day</h2>
          <button class="icon-button data-button" type="button" data-open="week-data" ${evidenceAttributes({ period: weekPeriod, recordIds: allRecordIds, duration: total })} aria-label="View daily recorded time data">${icon("list")}</button>
        </div>
        <div class="summary-row"><strong>${total}</strong><span>${historical ? "selected week" : "through Thu, Jul 30"}</span></div>
        <div class="week-chart" role="group" aria-label="Recorded time by day. Open a day for its exact Project values and records.">
          ${days.map((day) => weekDayButton(day)).join("")}
        </div>
        <div class="week-chart-space"></div>
        <div class="legend" aria-label="Chart legend">
          ${legendValues.map(([label, duration, percent, className]) => legendRow(label, duration, percent, className, "week-category", evidenceAttributes({ period: weekPeriod, category: label, recordIds: days.flatMap((day) => day[3] === null ? [] : [weekRecordIds(day[0])[["Theseus", "Coursework", "Recovery"].indexOf(label)]]), duration }))).join("")}
        </div>
      </section>
      <section class="panel panel-flush" aria-labelledby="variance-title">
        <div class="panel-heading" style="padding:17px"><h2 id="variance-title">Plan / actual</h2></div>
        ${compactRow("Theseus", "6h planned · 5h actual", "variance")}
        ${compactRow("Coursework", "4h planned · 6h actual", "variance")}
      </section>`;
  }

  function weekRecordIds(date) {
    const compactDate = date.replaceAll("-", "");
    return [`TL-${compactDate}-T`, `TL-${compactDate}-C`, `TL-${compactDate}-R`];
  }

  function weekDayButton(day) {
    const [date, shortDay, longDay, totalMinutes, segments] = day;
    if (totalMinutes === null) {
      return `<div class="day-bar is-unavailable" aria-label="${longDay}, future date unavailable"><span class="future-mark" aria-hidden="true"></span><span>${shortDay}</span></div>`;
    }
    const [theseus, coursework, recovery] = segments;
    const duration = minutesLabel(totalMinutes);
    return `<div class="day-bar"><button class="day-bar-button" type="button" data-open="week-evidence" ${evidenceAttributes({ date, recordIds: weekRecordIds(date), duration })} aria-label="${longDay}, ${duration}. Open exact Project values and records"><span class="bar-stack" aria-hidden="true"><i class="bar-amber" style="height:${Math.max(12, recovery / 2)}px"></i><i class="bar-blue" style="height:${Math.max(12, coursework / 2)}px"></i><i class="bar-green" style="height:${Math.max(12, theseus / 2)}px"></i></span></button><span>${shortDay}</span></div>`;
  }

  function minutesLabel(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return `${hours ? `${hours}h ` : ""}${remainder ? `${remainder}m` : ""}`.trim();
  }

  function monthView() {
    const historical = state.periodOffset.month < 0;
    const levels = historical
      ? [1, 2, 0, 1, 2, 3, 0, 1, 2, 1, 0, 2, 0, 0, 2, 3, 1, 2, 1, 0, 0, 1, 2, 3, 1, 0, 0, 3, 1, 2]
      : [0, 1, 2, 1, 0, 2, 3, 1, 0, 2, 0, 0, 1, 2, 3, 2, 1, 0, 0, 2, 2, 1, 3, 2, 1, 0, 0, 3, 1, 3, -1];
    const monthName = historical ? "June" : "July";
    const monthPrefix = historical ? "2026-06" : "2026-07";
    const monthPeriod = historical ? "2026-06-01/2026-06-30" : "2026-07-01/2026-07-31";
    const monthTotal = historical ? "48h 20m" : "57h 36m";
    const activeSummary = historical ? "16 active days · 3h 01m average" : "18 active days · 3h 12m average";
    const leadingBlanks = historical ? [] : [`<span class="heatmap-blank" aria-hidden="true"></span>`, `<span class="heatmap-blank" aria-hidden="true"></span>`];
    const cells = leadingBlanks
      .concat(levels.map((level, index) => {
        const day = index + 1;
        const date = `${monthPrefix}-${String(day).padStart(2, "0")}`;
        if (level < 0) return `<button class="heat-future" type="button" disabled aria-label="${monthName} ${day}, future date unavailable">${day}</button>`;
        const names = ["none", "low", "medium", "high"];
        const minutes = [0, 45, 150, 285][level];
        const ids = minutes ? [`TL-${date.replaceAll("-", "")}-M1`] : [];
        return `<button class="heat-${names[level]} ${day === 28 ? "heat-selected" : ""}" type="button" data-open="month-evidence" ${evidenceAttributes({ date, recordIds: ids, duration: minutesLabel(minutes) || "0m" })} data-evidence-intensity="${names[level]}" aria-label="${monthName} ${day}, ${minutes} recorded minutes, ${names[level]} intensity">${day}</button>`;
      }));
    const allMonthIds = levels.flatMap((level, index) => level > 0 ? [`TL-${monthPrefix.replace("-", "")}${String(index + 1).padStart(2, "0")}-M1`] : []);
    const selectedDate = `${monthPrefix}-28`;
    return `
      <section class="panel panel-wide" aria-labelledby="month-title">
        <div class="panel-heading">
          <h2 id="month-title">Recorded time intensity</h2>
          <button class="icon-button data-button" type="button" data-open="month-data" ${evidenceAttributes({ period: monthPeriod, recordIds: allMonthIds, duration: monthTotal })} aria-label="View monthly recorded time data">${icon("list")}</button>
        </div>
        <div class="summary-row"><strong>${monthTotal}</strong><span>${activeSummary}</span></div>
        <div class="heatmap-weekdays" aria-hidden="true"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
        <div class="heatmap">${cells.join("")}</div>
        <div class="heat-legend" aria-label="Provisional intensity legend"><span><i></i>None</span><span><i class="low"></i>Low</span><span><i class="medium"></i>Medium</span><span><i class="high"></i>High</span></div>
        <div class="notice">Prototype thresholds are provisional. Freeze absolute duration thresholds before Month implementation.</div>
      </section>
      <section class="panel panel-flush">
        ${compactRow(`Selected · ${monthName.slice(0, 3)} 28`, "4h 45m recorded", "month-evidence", evidenceAttributes({ date: selectedDate, recordIds: [`TL-${selectedDate.replaceAll("-", "")}-M1`], duration: "4h 45m" }))}
      </section>`;
  }

  function sparseView() {
    if (state.mode === "month") {
      return stateSurface("today", "More days are needed", "Recorded 25m on one date. A monthly pattern is not shown.", "Open records", "data-open='day-history'");
    }
    const selectedDate = state.periodOffset.day < 0 ? "2026-07-23" : "2026-07-30";
    const attributes = evidenceAttributes({ date: selectedDate, category: "Theseus", recordIds: [`TL-${selectedDate.replaceAll("-", "")}-01`], duration: "25m" });
    return `<section class="panel"><div class="panel-heading"><h2>Time by project</h2><button class="icon-button data-button" type="button" data-open="distribution" ${attributes} aria-label="View time distribution data">${icon("list")}</button></div><button class="donut-chart-button" type="button" data-open="project-evidence" ${attributes} aria-label="Theseus, 25 minutes, 100 percent"><span class="donut-wrap"><svg class="donut" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle class="donut-track" cx="60" cy="60" r="44"/><circle class="donut-segment segment-theseus" cx="60" cy="60" r="44" pathLength="100" stroke-dasharray="100 0"/></svg><span class="donut-total"><strong>25m</strong><span>recorded</span></span></span></button>${legendRow("Theseus", "25m", "100%", "theseus", "project-evidence", attributes)}</section>`;
  }

  function renderInsights() {
    updateInsightsRange();
    const preview = state.preview.insights;
    const period = selectedInsightsPeriod();
    const reviewAttributes = evidenceAttributes({ period: period.iso, recordIds: [period.reviewId] });
    if (preview === "loading") {
      insightsContent.innerHTML = skeletonState("Loading Insights");
      return;
    }
    if (preview === "no-evidence") {
      insightsContent.innerHTML = stateSurface("today", "No week evidence", "Record time in Today before generating a review.", "Open Today", "data-go-today");
      return;
    }
    if (preview === "no-review") {
      insightsContent.innerHTML = stateSurface("insights", "Review not created", "Evidence exists for this week.", "Generate", "data-generate-review");
      return;
    }
    if (preview === "stale") {
      insightsContent.innerHTML = stateSurface("refresh", "Review out of date", "Recorded time changed after this review.", "Regenerate", "data-generate-review", "View previous", `data-open="previous-review" ${reviewAttributes}`);
      return;
    }
    if (preview === "error") {
      insightsContent.innerHTML = stateSurface("warning", "Insights could not load", `Last verified review: ${period.label}.`, "Retry", "data-retry-insights", "Last verified", `data-open="previous-review" ${reviewAttributes}`);
      return;
    }
    const steady = preview === "steady";
    insightsContent.innerHTML = `
      <div class="insights-grid">
        <section class="panel status-panel">
          <div class="status-summary">
            <div><p class="section-kicker">Status</p><p class="status-word">${steady ? "Steady" : "Needs attention"}</p></div>
            <div class="count-pair"><div><strong>2</strong><span>wins</span></div><div><strong>${steady ? "0" : "1"}</strong><span>risks</span></div></div>
          </div>
        </section>
        ${steady ? steadyPanel(reviewAttributes) : priorityPanel()}
        <section class="panel panel-flush compact-list" aria-label="Review summaries">
          ${compactRow("Wins", "2", "wins")}
          ${steady ? "" : compactRow("Other issues", "1", "issues")}
          ${compactRow("Steady checks", "3", "steady")}
          ${compactRow("Weekly review", period.label, "review", reviewAttributes)}
        </section>
      </div>`;
  }

  function updateInsightsRange() {
    const current = state.insightsOffset === 0;
    $("#insights-period-label").textContent = selectedInsightsPeriod().label;
    $("#insights-reset").hidden = current;
    $("[data-insights-period='next']").disabled = current;
  }

  function selectedInsightsPeriod() {
    if (state.insightsOffset === 0) return { label: "Jul 27 – Aug 2", iso: "2026-07-27/2026-08-02", reviewId: "WR-20260727" };
    if (state.insightsOffset <= -2) return { label: "Jun 1 – Jun 7", iso: "2026-06-01/2026-06-07", reviewId: "WR-20260601" };
    return { label: "Jun 8 – Jun 14", iso: "2026-06-08/2026-06-14", reviewId: "WR-20260608" };
  }

  function priorityPanel() {
    return `<section class="panel priority-panel"><p class="section-kicker">Priority</p><h2 class="priority-title">Resume project</h2><div class="metric-row"><strong>0m actual / 60m planned</strong><span class="tag">Dormant</span></div><button class="primary-action" type="button" data-adjust-plan>Adjust ${icon("arrow")}</button></section>`;
  }

  function steadyPanel(reviewAttributes) {
    return `<section class="panel priority-panel"><p class="section-kicker">Verified</p><h2 class="priority-title">No attention signal</h2><div class="metric-row"><strong>3 checks steady</strong><span class="tag">Current</span></div><button class="secondary-action" type="button" data-open="review" ${reviewAttributes}>Open review</button></section>`;
  }

  function renderPlan() {
    updatePlanRange();
    const preview = state.preview.plan;
    if (preview === "loading") {
      planContent.innerHTML = skeletonState("Loading Plan");
      return;
    }
    if (preview === "no-plan") {
      planContent.innerHTML = stateSurface("plan", "No plan yet", "Tasks remain available for this target week.", "New plan", "data-new-plan");
      return;
    }
    if (preview === "load-error") {
      planContent.innerHTML = stateSurface("warning", "Plan could not load", "No sample or previously selected week has been substituted.", "Retry", "data-retry-plan");
      return;
    }

    const inline = planInlineState(preview);
    planContent.innerHTML = `
      ${inline}
      <div class="plan-grid">
        ${capacityPanel(preview === "capacity-missing")}
        ${proposalPanel(preview)}
        <section class="panel panel-flush compact-list" aria-label="Plan content">
          ${compactRow("Plan blocks", "3 · 12h", "plan-blocks")}
          ${compactRow("Tasks", "4 active", "tasks")}
        </section>
      </div>`;
  }

  function updatePlanRange() {
    const labels = state.planOffset === 0 ? "Aug 3 – Aug 9" : state.planOffset < 0 ? "Jul 27 – Aug 2" : "Aug 10 – Aug 16";
    $("#plan-period-label").textContent = labels;
    $("#plan-reset").hidden = state.planOffset === 0;
    const locked = state.preview.plan === "applying" || state.preview.plan === "undoing";
    $$('[data-plan-period]').forEach((button) => { button.disabled = locked; });
  }

  function capacityPanel(missing) {
    if (missing) {
      return `<section class="panel capacity-panel"><div class="state-heading"><h2>Capacity needed</h2><button class="secondary-action" type="button" data-set-capacity>Set capacity</button></div><p class="subtle">Blocks remain inspectable. Balance and Apply are unavailable.</p></section>`;
    }
    return `<section class="panel capacity-panel"><div class="capacity-numbers"><div><span class="plan-number">12h</span><span class="meta">planned</span></div><div><span class="plan-number">18h</span><span class="meta">capacity</span></div></div><div class="capacity-bar" aria-label="12 of 18 hours planned"><span></span></div><div class="summary-row"><strong>6h</strong><span>protected slack</span></div></section>`;
  }

  function proposalPanel(preview) {
    const unavailable = preview === "capacity-missing" || preview === "conflict" || preview === "applying" || preview === "undoing";
    const buttonLabel = preview === "applying" ? "Applying" : "Apply";
    return `<section class="panel proposal"><p class="section-kicker">Adjustment</p><h2 class="priority-title">Protect one restart block</h2><div class="proposal-diff"><div><span class="meta">Before</span><strong>11h · 7h slack</strong></div>${icon("arrow")}<div><span class="meta">After</span><strong>12h · 6h slack</strong></div></div><div class="proposal-actions"><button class="primary-action" type="button" data-apply ${unavailable ? "disabled" : ""}>${buttonLabel}</button><button class="secondary-action" type="button" data-open="proposal" ${unavailable ? "disabled" : ""}>Preview</button></div></section>`;
  }

  function planInlineState(preview) {
    const states = {
      applying: ["is-warning", "Applying adjustment", "The complete diff stays visible. Duplicate actions and week navigation are disabled."],
      conflict: ["is-error", "Plan changed elsewhere", "Reload before applying this proposal."],
      verified: ["is-success", "Plan saved and verified", "12h planned · 6h protected slack"],
      undoing: ["is-warning", "Restoring previous plan", "The current verified Plan remains visible."],
      "undo-success": ["is-success", "Previous plan restored", "Balance, blocks, and proposal state are refreshed."],
      "undo-error": ["is-error", "Plan could not be restored", "The last verified saved Plan remains current."],
      "save-error": ["is-error", "Plan was not saved", "The local draft is preserved and remains unsaved."],
      unknown: ["is-warning", "Save status unknown", "Verify server state before retrying the write."],
    };
    if (!states[preview]) return "";
    const [className, title, message] = states[preview];
    const action = preview === "verified" ? `<button class="secondary-action" type="button" data-undo>${icon("undo")}Undo</button>`
      : preview === "conflict" ? `<button class="secondary-action" type="button" data-reload-plan>Reload</button>`
      : preview === "undo-error" ? `<button class="secondary-action" type="button" data-undo>Retry</button>`
      : preview === "save-error" ? `<button class="secondary-action" type="button" data-apply>Retry</button>`
      : preview === "unknown" ? `<button class="secondary-action" type="button" data-verify>Verify</button>` : "";
    return `<div class="state-inline ${className}"><div class="state-heading"><strong>${title}</strong>${action}</div><p>${message}</p></div>`;
  }

  function compactRow(title, meta, openName, attributes = "") {
    return `<button class="row-button" type="button" data-open="${openName}" ${attributes}><span><strong>${title}</strong><span class="meta">${meta}</span></span>${icon("chevron-right")}</button>`;
  }

  function stateSurface(iconName, title, message, actionLabel, actionAttribute, secondaryLabel = "", secondaryAttribute = "") {
    return `<section class="state-surface"><svg class="state-icon" aria-hidden="true"><use href="#icon-${iconName}" /></svg><h2>${title}</h2><p>${message}</p><div class="proposal-actions"><button class="primary-action" type="button" ${actionAttribute}>${actionLabel}</button>${secondaryLabel ? `<button class="secondary-action" type="button" ${secondaryAttribute}>${secondaryLabel}</button>` : ""}</div></section>`;
  }

  function skeletonState(label) {
    return `<section class="panel" aria-label="${label}" aria-busy="true"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-chart"></div></section>`;
  }

  function openDrawer(name, trigger, pushCurrent = false, context = {}) {
    if (drawer.hidden) {
      lastFocused = trigger || document.activeElement;
      drawerStack.length = 0;
    } else if (pushCurrent && drawer.dataset.view) {
      drawerStack.push({ name: drawer.dataset.view, context: drawerContext });
    }
    drawerContext = context;
    const views = drawerViews(name, context);
    drawerTitle.textContent = views.title;
    drawerBody.innerHTML = views.body;
    drawer.dataset.view = name;
    drawer.classList.toggle("is-tracker", name === "tracker");
    overlay.hidden = false;
    drawer.hidden = false;
    document.body.style.overflow = "hidden";
    $("#drawer-back").focus();
  }

  function closeDrawer() {
    if (drawer.hidden) return;
    if (drawerStack.length) {
      const previous = drawerStack.pop();
      openDrawer(previous.name, null, false, previous.context);
      return;
    }
    drawer.hidden = true;
    overlay.hidden = true;
    drawer.classList.remove("is-tracker");
    delete drawer.dataset.view;
    drawerStack.length = 0;
    drawerContext = {};
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function drawerViews(name, context = {}) {
    const selectedDate = context.evidenceDate || (state.periodOffset.day < 0 ? "2026-07-23" : "2026-07-30");
    const selectedDay = readableDate(selectedDate);
    const periodLabel = readablePeriod(context.evidencePeriod || "");
    const evidenceLabel = context.evidencePeriod ? periodLabel : selectedDay;
    const records = evidenceRows(context, evidenceLabel);
    const foreground = foregroundActivity();
    const map = {
      distribution: ["Time by project", records],
      "project-evidence": [`${context.evidenceCategory || "Project"} records`, records],
      "day-history": [selectedDay + " history", records],
      "week-data": ["Daily recorded time", weekDataRows(context.evidencePeriod)],
      "week-evidence": [`${selectedDay} records`, records],
      "week-category": [`${context.evidenceCategory || "Project"} · ${periodLabel}`, records],
      variance: ["Plan / actual", `${drawerRow("Theseus", "6h planned", "−1h")}${drawerRow("Coursework", "4h planned", "+2h")}`],
      "month-data": [`${periodLabel} recorded time`, `${drawerRow("Total", `${(context.recordIds || "").split(",").filter(Boolean).length} source records`, context.evidenceDuration || "—")}${records}`],
      "month-evidence": [`${selectedDay} records`, records],
      activity: [foreground?.name || "Activity", `${drawerRow("Project", "Authenticated Activity", foreground?.project || "—")}${drawerRow("Status", "Foreground selection", foreground?.running ? "Running" : "Ready")}${drawerRow("Recorded today", "Selected Activity", foreground?.today || "—")}`],
      account: ["Account", `${drawerRow("Profile", "Local account", "Dong")}${drawerRow("Timezone", "Period boundary", "America/Los_Angeles")}${drawerRow("Integrations", "OpenClaw · Telegram", "Active")}`],
      activities: ["Choose an Activity", activityPickerRows()],
      wins: ["Wins", `${drawerRow("Theseus moved forward", "Verified by recorded project time", "2h 10m")}${drawerRow("Recovery protected", "Three recovery sessions", "3h")}`],
      issues: ["Other issues", drawerRow("Coursework drift", "6h actual / 4h planned", "+2h")],
      steady: ["Steady checks", `${drawerRow("Protected slack", "Threshold satisfied", "6h")}${drawerRow("Restore balance", "Threshold satisfied", "Current")}${drawerRow("Plan load", "Within capacity", "67%")}`],
      review: ["Weekly review", `<h3 class="drawer-section-title">${periodLabel}</h3>${drawerRow("Source review", "Inspectable Review record", (context.recordIds || "—").replaceAll(",", ", "))}${drawerRow("Win", "Theseus work remained consistent", "Verified")}${drawerRow("Insight", "Resume project has no recorded time", "Inspect")}${drawerRow("Next step", "Protect one restart block", "Preview")}`],
      "previous-review": ["Previous review", `<div class="state-inline is-warning"><strong>Out of date</strong><p>Recorded time changed after this review.</p></div>${drawerRow("Period", "Previous verified Review", periodLabel)}${drawerRow("Source review", "Inspectable Review record", context.recordIds || "—")}${drawerRow("Priority", "Resume project", "Inspect")}`],
      proposal: ["Adjustment preview", `${drawerRow("Evidence", "Resume project · 0m actual", "Inspect")}${drawerRow("Before", "11h planned · 7h slack", "Current")}${drawerRow("After", "12h planned · 6h slack", "+1h")}<div class="proposal-actions"><button class="primary-action" type="button" data-apply>Apply</button></div>`],
      "plan-blocks": ["Plan blocks", `${drawerRow("Theseus", "Mon / Wed / Fri", "6h")}${drawerRow("Coursework", "Tue / Thu", "4h")}${drawerRow("Resume project", "Tue morning", "2h")}`],
      tasks: ["Tasks", `${drawerRow("Schema contract", "Theseus · In progress", "Current")}${drawerRow("Review notes", "Coursework · Open", "Next")}${drawerRow("Resume outline", "Resume · Open", "Next")}${drawerRow("Weekly reflection", "Theseus · Open", "Later")}`],
    };
    if (name === "tracker") return trackerDrawer();
    if (name === "running") return runningDrawer();
    const result = map[name] || ["Detail", drawerRow("Selected record", "Static prototype detail", "Open")];
    return { title: result[0], body: result[1] };
  }

  function trackerDrawer() {
    const foreground = foregroundActivity();
    const runningCount = runningActivities().length;
    if (!foreground) return { title: "Focus", body: stateSurface("today", "No Activity available", "Create an Activity before starting Focus.", "New Activity", "data-create-activity") };
    const runningMeta = foreground.running
      ? `${foreground.project} · Focus${runningCount > 1 ? ` · ${runningCount} running` : ""}`
      : `${foreground.project} · Ready`;
    const actionLabel = foreground.running ? `End ${foreground.name}` : `Start ${foreground.name}`;
    const todayEvidence = evidenceAttributes({ date: "2026-07-30", recordIds: ["TL-20260730-01", "TL-20260730-02", "TL-20260730-03"], duration: "4h 35m" });
    return {
      title: "Focus",
      body: `<div class="tracker-workspace">
        <button class="tracker-activity" type="button" data-open="activities" aria-label="Choose Activity">
          <span class="tracker-activity-mark" aria-hidden="true">${icon("today")}</span>
          <span><strong>${foreground.name}</strong><small>${runningMeta}</small></span>
          ${icon("chevron-right")}
        </button>
        <div class="tracker-timer-display" role="timer" aria-label="Current Focus duration ${foreground.running ? foreground.clock : "zero"}">
          <span class="tracker-run-mark" aria-hidden="true"></span>
          <strong>${foreground.running ? `00:${foreground.clock}` : "00:00:00"}</strong>
        </div>
        <button class="tracker-focus-control" type="button" data-tracker-toggle aria-label="${actionLabel}">
          ${icon(foreground.running ? "stop" : "play")}
        </button>
        <button class="tracker-total" type="button" data-open="day-history" ${todayEvidence} aria-label="Open Today history, 4 hours 35 minutes">
          <span class="swatch" aria-hidden="true"></span><span>Today total</span><strong>4h 35m</strong>${icon("chevron-right")}
        </button>
        <div class="tracker-links">
          <button class="row-button" type="button" data-open="running"><span><strong>Running Activities</strong><span class="meta">${runningCount} active</span></span>${icon("chevron-right")}</button>
          <button class="row-button" type="button" data-open="day-history" ${todayEvidence}><span><strong>Today history</strong><span class="meta">3 records · correctable</span></span>${icon("chevron-right")}</button>
        </div>
      </div>`,
    };
  }

  function runningDrawer() {
    const running = runningActivities();
    const rows = running.map((activity) => `<div class="running-row"><button class="running-select" type="button" data-select-running="${activity.id}" aria-pressed="${activity.id === state.foregroundId}"><strong>${activity.name}</strong><span class="meta">${activity.project} · ${activity.clock}${activity.id === state.foregroundId ? " · foreground" : ""}</span></button><button class="running-end" type="button" data-end-running="${activity.id}" aria-label="End ${activity.name}">End</button></div>`);
    rows.push(`<button class="row-button" type="button" data-choose-activity><span><strong>Choose another Activity</strong><span class="meta">Selection does not start it</span></span>${icon("plus")}</button>`);
    return { title: "Running", body: running.length ? rows.join("") : `<div class="state-inline"><strong>No running Activities</strong><p>Choose an Activity before starting Focus.</p></div>${rows.at(-1)}` };
  }

  function drawerRow(title, meta, value) {
    return `<div class="list-row"><span><strong>${title}</strong><span class="meta">${meta}</span></span><strong>${value}</strong></div>`;
  }

  function activityPickerRows() {
    return state.activities.map((activity) => {
      const selected = activity.id === state.foregroundId;
      const status = activity.running ? `Running · ${activity.clock}` : "Ready";
      return `<button class="row-button activity-picker-row" type="button" data-select-activity="${activity.id}" aria-pressed="${selected}"><span><strong>${activity.name}</strong><span class="meta">${activity.project} · ${status}</span></span>${selected ? icon("check") : icon("arrow")}</button>`;
    }).join("") + `<button class="row-button" type="button" data-create-activity><span><strong>New Activity</strong><span class="meta">Create before starting</span></span>${icon("plus")}</button>`;
  }

  function evidenceRows(context, readableDateLabel) {
    const ids = (context.recordIds || "").split(",").filter(Boolean);
    if (!ids.length) {
      return `<div class="state-inline"><strong>No recorded evidence</strong><p>${readableDateLabel} has no matching TimeLog records.</p></div>`;
    }
    const category = context.evidenceCategory || "TimeLog";
    const duration = context.evidenceDuration || "Source";
    return `<h3 class="drawer-section-title">${readableDateLabel}</h3>${ids.map((id, index) => drawerRow(index === 0 ? category : `${category} record`, `Source record · ${id}`, ids.length === 1 ? duration : "Inspect")).join("")}`;
  }

  function weekDataRows(period) {
    const historical = period === "2026-06-08/2026-06-14";
    const rows = historical
      ? [["2026-06-08", "3h 20m"], ["2026-06-09", "4h 40m"], ["2026-06-10", "2h 40m"], ["2026-06-11", "4h 30m"], ["2026-06-12", "4h 35m"], ["2026-06-13", "2h 45m"], ["2026-06-14", "2h 10m"]]
      : [["2026-07-27", "3h 20m"], ["2026-07-28", "4h 40m"], ["2026-07-29", "2h 40m"], ["2026-07-30", "4h 30m"], ["2026-07-31", "Unavailable"], ["2026-08-01", "Unavailable"], ["2026-08-02", "Unavailable"]];
    return rows.map(([date, value]) => drawerRow(readableDate(date), value === "Unavailable" ? "Future date · excluded" : weekRecordIds(date).join(" · "), value)).join("");
  }

  function readableDate(isoDate) {
    const [year, month, day] = isoDate.split("-").map(Number);
    if (!year || !month || !day) return isoDate || "Selected evidence";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  function readablePeriod(period) {
    if (!period || !period.includes("/")) return "Selected period";
    const [start, end] = period.split("/");
    return `${readableDate(start)} – ${readableDate(end)}`;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2600);
  }

  function applyPlan() {
    closeDrawer();
    state.preview.plan = "applying";
    setDestination("plan", false);
    window.setTimeout(() => {
      state.preview.plan = "verified";
      updateStateSelect();
      renderPlan();
      showToast("Plan saved and verified.");
    }, 850);
  }

  function undoPlan() {
    state.preview.plan = "undoing";
    updateStateSelect();
    renderPlan();
    window.setTimeout(() => {
      state.preview.plan = "undo-success";
      updateStateSelect();
      renderPlan();
      showToast("Previous plan restored.");
    }, 750);
  }

  function handlePeriod(direction) {
    if (direction === "previous") state.periodOffset[state.mode] = -1;
    if (direction === "next") state.periodOffset[state.mode] = 0;
    renderToday();
  }

  function closePrototypePanel() {
    $("#prototype-panel").hidden = true;
    $("#prototype-toggle").setAttribute("aria-expanded", "false");
  }

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-destination]");
    if (nav) {
      setDestination(nav.dataset.destination);
      return;
    }

    const mode = event.target.closest("[data-mode]");
    if (mode) {
      state.mode = mode.dataset.mode;
      $$("[data-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button === mode)));
      renderToday();
      return;
    }

    const period = event.target.closest("[data-period]");
    if (period) {
      handlePeriod(period.dataset.period);
      return;
    }

    const insightsPeriod = event.target.closest("[data-insights-period]");
    if (insightsPeriod) {
      state.insightsOffset += insightsPeriod.dataset.insightsPeriod === "previous" ? -1 : 1;
      state.insightsOffset = Math.min(0, state.insightsOffset);
      renderInsights();
      return;
    }

    const planPeriod = event.target.closest("[data-plan-period]");
    if (planPeriod) {
      state.planOffset += planPeriod.dataset.planPeriod === "previous" ? -1 : 1;
      state.planOffset = Math.max(-1, Math.min(1, state.planOffset));
      renderPlan();
      return;
    }

    const open = event.target.closest("[data-open]");
    if (open) {
      const context = {
        evidenceDate: open.dataset.evidenceDate || "",
        evidenceCategory: open.dataset.evidenceCategory || "",
        evidenceDuration: open.dataset.evidenceDuration || "",
        evidencePeriod: open.dataset.evidencePeriod || "",
        evidenceIntensity: open.dataset.evidenceIntensity || "",
        recordIds: open.dataset.recordIds || "",
      };
      openDrawer(open.dataset.open, open, !drawer.hidden, context);
      return;
    }

    if (event.target.closest("[data-tracker-toggle]")) {
      const changed = toggleForegroundActivity();
      renderFocus();
      openDrawer("tracker", null, false);
      showToast(changed?.running ? `${changed.name} started.` : `${changed?.name || "Activity"} ended. Foreground updated safely.`);
      return;
    }

    if (event.target.closest("[data-adjust-plan]")) {
      state.preview.plan = "normal";
      setDestination("plan");
      return;
    }
    if (event.target.closest("[data-apply]")) { applyPlan(); return; }
    if (event.target.closest("[data-undo]")) { undoPlan(); return; }
    if (event.target.closest("[data-verify]")) {
      state.preview.plan = "verified";
      updateStateSelect();
      renderPlan();
      showToast("Server state verified. The plan was saved once.");
      return;
    }
    if (event.target.closest("[data-reload-plan]")) {
      state.preview.plan = "normal";
      updateStateSelect();
      renderPlan();
      showToast("Latest plan loaded. Review the proposal again.");
      return;
    }
    if (event.target.closest("[data-go-today]")) { setDestination("today"); return; }
    if (event.target.closest("[data-generate-review]")) {
      state.preview.insights = "loading";
      updateStateSelect();
      renderInsights();
      window.setTimeout(() => { state.preview.insights = "normal"; updateStateSelect(); renderInsights(); showToast("Review generated from current evidence."); }, 800);
      return;
    }
    if (event.target.closest("[data-retry-today]")) { state.preview.today = "normal"; updateStateSelect(); renderToday(); return; }
    if (event.target.closest("[data-retry-insights]")) { state.preview.insights = "normal"; updateStateSelect(); renderInsights(); return; }
    if (event.target.closest("[data-retry-plan]")) { state.preview.plan = "normal"; updateStateSelect(); renderPlan(); return; }
    if (event.target.closest("[data-start-focus]")) { const changed = toggleForegroundActivity(); state.preview.today = "normal"; updateStateSelect(); renderToday(); showToast(changed?.running ? "Focus started in prototype." : "Focus ended in prototype."); return; }
    if (event.target.closest("[data-new-plan]")) { state.preview.plan = "normal"; updateStateSelect(); renderPlan(); return; }
    if (event.target.closest("[data-set-capacity]")) { state.preview.plan = "normal"; updateStateSelect(); renderPlan(); showToast("Sample capacity restored."); return; }
    if (event.target.closest("[data-undo-history]")) { state.preview.today = "normal"; updateStateSelect(); renderToday(); showToast("Correction undone in prototype."); return; }
    const selectedActivity = event.target.closest("[data-select-activity]");
    if (selectedActivity) { state.foregroundId = selectedActivity.dataset.selectActivity; state.preview.today = "normal"; updateStateSelect(); renderToday(); closeDrawer(); showToast("Activity selected. Its running state did not change."); return; }

    const selectedRunning = event.target.closest("[data-select-running]");
    if (selectedRunning) { state.foregroundId = selectedRunning.dataset.selectRunning; renderFocus(); closeDrawer(); showToast("Foreground Activity changed. Other timers keep running."); return; }

    const endRunning = event.target.closest("[data-end-running]");
    if (endRunning) {
      const activity = activityById(endRunning.dataset.endRunning);
      if (activity) activity.running = false;
      if (activity?.id === state.foregroundId) selectFallbackForeground();
      renderFocus();
      openDrawer("running", null, false);
      showToast(`${activity?.name || "Selected Activity"} ended. Other timers keep running.`);
      return;
    }
    if (event.target.closest("[data-choose-activity]")) {
      openDrawer("activities", event.target.closest("[data-choose-activity]"), true);
      return;
    }
    if (event.target.closest("[data-create-activity]")) {
      showToast("Activity creation remains a separate persisted flow.");
    }
  });

  $("#focus-action").addEventListener("click", () => {
    if (state.preview.today === "no-focus") {
      openDrawer("activities", $("#focus-action"));
      return;
    }
    const changed = toggleForegroundActivity();
    renderFocus();
    showToast(changed?.running ? `${changed.name} started.` : `${changed?.name || "Activity"} ended. Foreground updated safely.`);
  });

  $("#running-control").addEventListener("click", (event) => openDrawer("running", event.currentTarget));
  $("#focus-identity").addEventListener("click", (event) => openDrawer(state.preview.today === "no-focus" ? "activities" : "tracker", event.currentTarget));
  $(".account-button").addEventListener("click", (event) => openDrawer("account", event.currentTarget));
  $("#today-reset").addEventListener("click", () => { state.periodOffset[state.mode] = 0; renderToday(); });
  $("#insights-reset").addEventListener("click", () => { state.insightsOffset = 0; renderInsights(); });
  $("#plan-reset").addEventListener("click", () => { state.planOffset = 0; renderPlan(); });
  $("#drawer-back").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);

  $("#prototype-toggle").addEventListener("click", () => {
    const panel = $("#prototype-panel");
    panel.hidden = !panel.hidden;
    $("#prototype-toggle").setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) stateSelect.focus();
  });

  stateSelect.addEventListener("change", () => {
    state.preview[state.destination] = stateSelect.value;
    renderActiveDestination();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!drawer.hidden) closeDrawer();
      else closePrototypePanel();
    }
    if (!drawer.hidden && event.key === "Tab") {
      const focusable = $$('button:not([disabled]), a[href], select:not([disabled]), [tabindex]:not([tabindex="-1"])', drawer);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  const prototypeWidth = Number(new URLSearchParams(window.location.search).get("width"));
  if (prototypeWidth >= 280 && prototypeWidth <= 430) {
    document.documentElement.style.setProperty("--prototype-width", `${prototypeWidth}px`);
  }

  const initialDestination = window.location.hash.slice(1);
  if (initialDestination === "tracker") {
    setDestination("today", false);
    openDrawer("tracker", null);
  } else if (initialDestination === "week") {
    state.mode = "week";
    $$("[data-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === "week")));
    setDestination("today", false);
  } else if (initialDestination === "running") {
    setDestination("today", false);
    openDrawer("running", null);
  } else if (initialDestination === "insights-stale") {
    state.preview.insights = "stale";
    setDestination("insights", false);
  } else if (initialDestination === "plan-conflict" || initialDestination === "plan-verified") {
    state.preview.plan = initialDestination.endsWith("conflict") ? "conflict" : "verified";
    setDestination("plan", false);
  } else if (["today", "insights", "plan"].includes(initialDestination)) {
    setDestination(initialDestination, false);
  } else {
    setDestination("today", false);
  }
})();
