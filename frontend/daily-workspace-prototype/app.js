(function () {
  "use strict";

  const state = {
    destination: "today",
    mode: "day",
    periodOffset: { day: 0, week: 0, month: 0 },
    insightsOffset: -6,
    planOffset: 0,
    focusRunning: true,
    runningCount: 2,
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
  let drawerReturnView = null;
  let toastTimer = null;

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

    running.hidden = state.runningCount < 2;
    running.textContent = `${state.runningCount} running`;
    if (state.focusRunning) {
      identity.innerHTML = `<span class="focus-name">Backend schema</span><span class="focus-meta">Theseus · Focus</span>`;
      timer.textContent = "18:42";
      action.innerHTML = icon("stop");
      action.setAttribute("aria-label", "End Backend schema");
      action.disabled = false;
    } else {
      identity.innerHTML = `<span class="focus-name">Backend schema</span><span class="focus-meta">Ready to focus</span>`;
      timer.textContent = "—";
      action.innerHTML = icon("play");
      action.setAttribute("aria-label", "Start Backend schema");
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
    const timelineTitle = historical ? "Thu, Jul 23 timeline" : "Today timeline";
    return `
      <section class="panel" aria-labelledby="distribution-title">
        <div class="panel-heading">
          <h2 id="distribution-title">Time by project</h2>
          <button class="icon-button data-button" type="button" data-open="distribution" aria-label="View time distribution data">${icon("list")}</button>
        </div>
        <div class="donut-wrap">
          <svg class="donut" viewBox="0 0 120 120" role="img" aria-labelledby="donut-title donut-description">
            <title id="donut-title">Time by project</title>
            <desc id="donut-description">Four hours thirty-five minutes total. Theseus 47 percent, Coursework 31 percent, Recovery 22 percent.</desc>
            <circle class="donut-track" cx="60" cy="60" r="44" />
            <circle class="donut-segment segment-theseus" data-open="theseus-records" tabindex="0" role="button" aria-label="Theseus, 2 hours 10 minutes, 47 percent" cx="60" cy="60" r="44" pathLength="100" stroke-dasharray="47 53" stroke-dashoffset="0" />
            <circle class="donut-segment segment-course" data-open="course-records" tabindex="0" role="button" aria-label="Coursework, 1 hour 25 minutes, 31 percent" cx="60" cy="60" r="44" pathLength="100" stroke-dasharray="31 69" stroke-dashoffset="-47" />
            <circle class="donut-segment segment-recovery" data-open="recovery-records" tabindex="0" role="button" aria-label="Recovery, 1 hour, 22 percent" cx="60" cy="60" r="44" pathLength="100" stroke-dasharray="22 78" stroke-dashoffset="-78" />
          </svg>
          <div class="donut-total"><strong>4h 35m</strong><span>recorded</span></div>
        </div>
        <div class="legend" aria-label="Time distribution legend">
          ${legendRow("Theseus", "2h 10m", "47%", "theseus", "theseus-records")}
          ${legendRow("Coursework", "1h 25m", "31%", "course", "course-records")}
          ${legendRow("Recovery", "1h 00m", "22%", "recovery", "recovery-records")}
        </div>
      </section>
      <section class="panel" aria-labelledby="timeline-title">
        <div class="panel-heading">
          <h2 id="timeline-title">${timelineTitle}</h2>
          <button class="icon-button data-button" type="button" data-open="day-history" aria-label="Open ${timelineTitle.toLowerCase()}">${icon("arrow")}</button>
        </div>
        <div class="timeline" aria-label="Selected day timeline preview">
          <time>09:00</time><div class="timeline-band">Backend schema · 2h 10m</div>
          <time>11:30</time><div class="timeline-band course">Course reading · 1h 25m</div>
          <time>14:10</time><div class="timeline-band recovery">Walk · 1h</div>
        </div>
      </section>`;
  }

  function legendRow(label, duration, percent, className, openName) {
    return `<div class="legend-row"><span class="swatch ${className}" aria-hidden="true"></span><button type="button" data-open="${openName}">${label}</button><strong>${duration}</strong><small>${percent}</small></div>`;
  }

  function weekView() {
    const bars = [
      [42, 24, 18, "Mon, 3h 20m"],
      [58, 39, 20, "Tue, 4h 40m"],
      [34, 28, 13, "Wed, 2h 40m"],
      [60, 34, 22, "Thu, 4h 30m"],
      [51, 44, 18, "Fri, 4h 35m"],
      [28, 31, 18, "Sat, 2h 45m"],
      [20, 25, 12, "Sun, 2h 10m"],
    ];
    const dayNames = ["M", "T", "W", "T", "F", "S", "S"];
    return `
      <section class="panel panel-wide" aria-labelledby="week-chart-title">
        <div class="panel-heading">
          <h2 id="week-chart-title">Recorded time by day</h2>
          <button class="icon-button data-button" type="button" data-open="week-data" aria-label="View daily recorded time data">${icon("list")}</button>
        </div>
        <div class="summary-row"><strong>24h 40m</strong><span>selected week</span></div>
        <div class="week-chart" role="img" aria-label="Stacked bars for seven recorded days. Exact values are available in the data view.">
          ${bars.map((bar, index) => `<div class="day-bar"><button class="bar-amber" style="height:${bar[2]}px" data-open="week-day" aria-label="${bar[3]}, Recovery segment"></button><button class="bar-blue" style="height:${bar[1]}px" data-open="week-day" aria-label="${bar[3]}, Coursework segment"></button><button class="bar-green" style="height:${bar[0]}px" data-open="week-day" aria-label="${bar[3]}, Theseus segment"></button><span>${dayNames[index]}</span></div>`).join("")}
        </div>
        <div class="week-chart-space"></div>
        <div class="legend" aria-label="Chart legend">
          ${legendRow("Theseus", "10h 30m", "43%", "theseus", "week-data")}
          ${legendRow("Coursework", "8h 10m", "33%", "course", "week-data")}
          ${legendRow("Recovery", "6h 00m", "24%", "recovery", "week-data")}
        </div>
      </section>
      <section class="panel panel-flush" aria-labelledby="variance-title">
        <div class="panel-heading" style="padding:17px"><h2 id="variance-title">Plan / actual</h2></div>
        ${compactRow("Theseus", "6h planned · 5h actual", "variance")}
        ${compactRow("Coursework", "4h planned · 6h actual", "variance")}
      </section>`;
  }

  function monthView() {
    const levels = [0, 1, 2, 1, 0, 2, 3, 1, 0, 2, 0, 0, 1, 2, 3, 2, 1, 0, 0, 2, 2, 1, 3, 2, 1, 0, 0, 2, 1, 3, -1];
    const cells = [`<span class="heatmap-blank" aria-hidden="true"></span>`, `<span class="heatmap-blank" aria-hidden="true"></span>`]
      .concat(levels.map((level, index) => {
        const day = index + 1;
        if (level < 0) return `<button class="heat-future" type="button" disabled aria-label="July ${day}, future date unavailable">${day}</button>`;
        const names = ["none", "low", "medium", "high"];
        const minutes = [0, 45, 150, 285][level];
        return `<button class="heat-${names[level]} ${day === 28 ? "heat-selected" : ""}" type="button" data-open="month-day" aria-label="July ${day}, ${minutes} recorded minutes, ${names[level]} intensity">${day}</button>`;
      }));
    return `
      <section class="panel panel-wide" aria-labelledby="month-title">
        <div class="panel-heading">
          <h2 id="month-title">Recorded time intensity</h2>
          <button class="icon-button data-button" type="button" data-open="month-data" aria-label="View monthly recorded time data">${icon("list")}</button>
        </div>
        <div class="summary-row"><strong>57h 36m</strong><span>18 active days · 3h 12m average</span></div>
        <div class="heatmap-weekdays" aria-hidden="true"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
        <div class="heatmap">${cells.join("")}</div>
        <div class="heat-legend" aria-label="Provisional intensity legend"><span><i></i>None</span><span><i class="low"></i>Low</span><span><i class="medium"></i>Medium</span><span><i class="high"></i>High</span></div>
        <div class="notice">Prototype thresholds are provisional. Freeze absolute duration thresholds before Month implementation.</div>
      </section>
      <section class="panel panel-flush">
        ${compactRow("Selected · Jul 28", "4h 45m recorded", "month-day")}
      </section>`;
  }

  function sparseView() {
    if (state.mode === "month") {
      return stateSurface("today", "More days are needed", "Recorded 25m on one date. A monthly pattern is not shown.", "Open records", "data-open='day-history'");
    }
    return `<section class="panel"><div class="panel-heading"><h2>Time by project</h2><button class="icon-button data-button" type="button" data-open="distribution" aria-label="View time distribution data">${icon("list")}</button></div><div class="donut-wrap"><svg class="donut" viewBox="0 0 120 120" role="img" aria-label="25 minutes total, one category"><circle class="donut-track" cx="60" cy="60" r="44"/><circle class="donut-segment segment-theseus" cx="60" cy="60" r="44" pathLength="100" stroke-dasharray="100 0"/></svg><div class="donut-total"><strong>25m</strong><span>recorded</span></div></div>${legendRow("Theseus", "25m", "100%", "theseus", "theseus-records")}</section>`;
  }

  function renderInsights() {
    updateInsightsRange();
    const preview = state.preview.insights;
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
      insightsContent.innerHTML = stateSurface("refresh", "Review out of date", "Recorded time changed after this review.", "Regenerate", "data-generate-review", "View previous", "data-open='previous-review'");
      return;
    }
    if (preview === "error") {
      insightsContent.innerHTML = stateSurface("warning", "Insights could not load", "Last verified review: Jun 14, 18:05.", "Retry", "data-retry-insights", "Last verified", "data-open='previous-review'");
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
        ${steady ? steadyPanel() : priorityPanel()}
        <section class="panel panel-flush compact-list" aria-label="Review summaries">
          ${compactRow("Wins", "2", "wins")}
          ${steady ? "" : compactRow("Other issues", "1", "issues")}
          ${compactRow("Steady checks", "3", "steady")}
          ${compactRow("Weekly review", "Jun 8 – Jun 14", "review")}
        </section>
      </div>`;
  }

  function updateInsightsRange() {
    const current = state.insightsOffset === 0;
    $("#insights-period-label").textContent = current ? "Jul 27 – Aug 2" : state.insightsOffset < -1 ? "Jun 8 – Jun 14" : "Jul 20 – Jul 26";
    $("#insights-reset").hidden = current;
    $("[data-insights-period='next']").disabled = current;
  }

  function priorityPanel() {
    return `<section class="panel priority-panel"><p class="section-kicker">Priority</p><h2 class="priority-title">Resume project</h2><div class="metric-row"><strong>0m actual / 60m planned</strong><span class="tag">Dormant</span></div><button class="primary-action" type="button" data-adjust-plan>Adjust ${icon("arrow")}</button></section>`;
  }

  function steadyPanel() {
    return `<section class="panel priority-panel"><p class="section-kicker">Verified</p><h2 class="priority-title">No attention signal</h2><div class="metric-row"><strong>3 checks steady</strong><span class="tag">Current</span></div><button class="secondary-action" type="button" data-open="review">Open review</button></section>`;
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

  function compactRow(title, meta, openName) {
    return `<button class="row-button" type="button" data-open="${openName}"><span><strong>${title}</strong><span class="meta">${meta}</span></span>${icon("chevron-right")}</button>`;
  }

  function stateSurface(iconName, title, message, actionLabel, actionAttribute, secondaryLabel = "", secondaryAttribute = "") {
    return `<section class="state-surface"><svg class="state-icon" aria-hidden="true"><use href="#icon-${iconName}" /></svg><h2>${title}</h2><p>${message}</p><div class="proposal-actions"><button class="primary-action" type="button" ${actionAttribute}>${actionLabel}</button>${secondaryLabel ? `<button class="secondary-action" type="button" ${secondaryAttribute}>${secondaryLabel}</button>` : ""}</div></section>`;
  }

  function skeletonState(label) {
    return `<section class="panel" aria-label="${label}" aria-busy="true"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-chart"></div></section>`;
  }

  function openDrawer(name, trigger, returnView = null) {
    if (drawer.hidden) lastFocused = trigger || document.activeElement;
    drawerReturnView = returnView;
    const views = drawerViews(name);
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
    if (drawerReturnView) {
      const returnView = drawerReturnView;
      drawerReturnView = null;
      openDrawer(returnView, null);
      return;
    }
    drawer.hidden = true;
    overlay.hidden = true;
    drawer.classList.remove("is-tracker");
    delete drawer.dataset.view;
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function drawerViews(name) {
    const selectedDay = state.periodOffset.day < 0 ? "Thu, Jul 23" : "Thu, Jul 30";
    const records = `<h3 class="drawer-section-title">${selectedDay}</h3>${drawerRow("Backend schema", "Theseus · 09:00–11:10", "2h 10m")}${drawerRow("Course reading", "Coursework · 11:30–12:55", "1h 25m")}${drawerRow("Walk", "Recovery · 14:10–15:10", "1h")}`;
    const map = {
      distribution: ["Time by project", `${drawerRow("Theseus", "47% of recorded time", "2h 10m")}${drawerRow("Coursework", "31% of recorded time", "1h 25m")}${drawerRow("Recovery", "22% of recorded time", "1h")}`],
      "theseus-records": ["Theseus records", drawerRow("Backend schema", `${selectedDay} · 09:00–11:10`, "2h 10m")],
      "course-records": ["Coursework records", drawerRow("Course reading", `${selectedDay} · 11:30–12:55`, "1h 25m")],
      "recovery-records": ["Recovery records", drawerRow("Walk", `${selectedDay} · 14:10–15:10`, "1h")],
      "day-history": [selectedDay + " history", records],
      "week-data": ["Daily recorded time", ["Mon|3h 20m", "Tue|4h 40m", "Wed|2h 40m", "Thu|4h 30m", "Fri|4h 35m", "Sat|2h 45m", "Sun|2h 10m"].map((item) => { const [day, value] = item.split("|"); return drawerRow(day, "Theseus · Coursework · Recovery", value); }).join("")],
      "week-day": ["Day records", records],
      variance: ["Plan / actual", `${drawerRow("Theseus", "6h planned", "−1h")}${drawerRow("Coursework", "4h planned", "+2h")}`],
      "month-data": ["July recorded time", `${drawerRow("Total", "18 active days", "57h 36m")}${drawerRow("Jul 28", "High · provisional threshold", "4h 45m")}${drawerRow("Jul 29", "Low · provisional threshold", "45m")}`],
      "month-day": ["Jul 28 records", records],
      activity: ["Backend schema", `${drawerRow("Project", "Authenticated Activity", "Theseus")}${drawerRow("Status", "Foreground selection", state.focusRunning ? "Running" : "Ready")}${drawerRow("Recorded today", "Selected Activity", "2h 10m")}`],
      account: ["Account", `${drawerRow("Profile", "Local account", "Dong")}${drawerRow("Timezone", "Period boundary", "America/Los_Angeles")}${drawerRow("Integrations", "OpenClaw · Telegram", "Active")}`],
      activities: ["Choose an Activity", `<button class="row-button" type="button" data-select-activity><span><strong>Backend schema</strong><span class="meta">Theseus · Ready</span></span>${icon("arrow")}</button><button class="row-button" type="button" data-select-activity><span><strong>Coursework reading</strong><span class="meta">Coursework · Ready</span></span>${icon("arrow")}</button>`],
      wins: ["Wins", `${drawerRow("Theseus moved forward", "Verified by recorded project time", "2h 10m")}${drawerRow("Recovery protected", "Three recovery sessions", "3h")}`],
      issues: ["Other issues", drawerRow("Coursework drift", "6h actual / 4h planned", "+2h")],
      steady: ["Steady checks", `${drawerRow("Protected slack", "Threshold satisfied", "6h")}${drawerRow("Restore balance", "Threshold satisfied", "Current")}${drawerRow("Plan load", "Within capacity", "67%")}`],
      review: ["Weekly review", `<h3 class="drawer-section-title">Jun 8 – Jun 14</h3>${drawerRow("Win", "Theseus work remained consistent", "Verified")}${drawerRow("Insight", "Resume project has no recorded time", "Inspect")}${drawerRow("Next step", "Protect one restart block", "Preview")}`],
      "previous-review": ["Previous review", `<div class="state-inline is-warning"><strong>Out of date</strong><p>Recorded time changed after this review.</p></div>${drawerRow("Generated", "Jun 14 at 18:05", "Previous")}${drawerRow("Priority", "Resume project", "Inspect")}`],
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
    const runningMeta = state.focusRunning
      ? `Theseus · Focus${state.runningCount > 1 ? ` · ${state.runningCount} running` : ""}`
      : "Theseus · Ready";
    const actionLabel = state.focusRunning ? "End Backend schema" : "Start Backend schema";
    return {
      title: "Focus",
      body: `<div class="tracker-workspace">
        <button class="tracker-activity" type="button" data-open="activities" aria-label="Choose Activity">
          <span class="tracker-activity-mark" aria-hidden="true">${icon("today")}</span>
          <span><strong>Backend schema</strong><small>${runningMeta}</small></span>
          ${icon("chevron-right")}
        </button>
        <button class="tracker-timer-button" type="button" data-tracker-toggle aria-label="${actionLabel}">
          <span class="tracker-run-mark" aria-hidden="true"></span>
          <strong>${state.focusRunning ? "00:18:42" : "00:00:00"}</strong>
        </button>
        <button class="tracker-focus-control" type="button" data-tracker-toggle aria-label="${actionLabel}">
          ${icon(state.focusRunning ? "stop" : "play")}
        </button>
        <button class="tracker-total" type="button" data-open="day-history" aria-label="Open Today history, 4 hours 35 minutes">
          <span class="swatch" aria-hidden="true"></span><span>Today total</span><strong>4h 35m</strong>${icon("chevron-right")}
        </button>
        <div class="tracker-links">
          <button class="row-button" type="button" data-open="running"><span><strong>Running Activities</strong><span class="meta">${state.runningCount} active</span></span>${icon("chevron-right")}</button>
          <button class="row-button" type="button" data-open="day-history"><span><strong>Today history</strong><span class="meta">3 records · correctable</span></span>${icon("chevron-right")}</button>
        </div>
      </div>`,
    };
  }

  function runningDrawer() {
    const rows = [
      `<div class="list-row"><span><strong>Backend schema</strong><span class="meta">Theseus · foreground</span></span><strong>18:42</strong><button class="icon-button running-end" type="button" data-end-running="backend" aria-label="End Backend schema">${icon("stop")}</button></div>`,
      `<div class="list-row"><span><strong>Coursework reading</strong><span class="meta">Coursework</span></span><strong>07:15</strong><button class="icon-button running-end" type="button" data-end-running="course" aria-label="End Coursework reading">${icon("stop")}</button></div>`,
      `<button class="row-button" type="button" data-choose-activity><span><strong>Choose another Activity</strong><span class="meta">Start remains a separate action</span></span>${icon("plus")}</button>`,
    ];
    return { title: "Running", body: rows.join("") };
  }

  function drawerRow(title, meta, value) {
    return `<div class="list-row"><span><strong>${title}</strong><span class="meta">${meta}</span></span><strong>${value}</strong></div>`;
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
      $$("[data-mode]").forEach((button) => button.setAttribute("aria-selected", String(button === mode)));
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
      const returnView = drawer.dataset.view === "tracker" ? "tracker" : null;
      openDrawer(open.dataset.open, open, returnView);
      return;
    }

    if (event.target.closest("[data-tracker-toggle]")) {
      state.focusRunning = !state.focusRunning;
      state.runningCount = state.focusRunning ? Math.max(2, state.runningCount + 1) : Math.max(1, state.runningCount - 1);
      renderFocus();
      openDrawer("tracker", null);
      showToast(state.focusRunning ? "Backend schema started." : "Backend schema ended. Other Activities keep running.");
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
    if (event.target.closest("[data-start-focus]")) { state.focusRunning = true; state.preview.today = "normal"; updateStateSelect(); renderToday(); showToast("Focus started in prototype."); return; }
    if (event.target.closest("[data-new-plan]")) { state.preview.plan = "normal"; updateStateSelect(); renderPlan(); return; }
    if (event.target.closest("[data-set-capacity]")) { state.preview.plan = "normal"; updateStateSelect(); renderPlan(); showToast("Sample capacity restored."); return; }
    if (event.target.closest("[data-undo-history]")) { state.preview.today = "normal"; updateStateSelect(); renderToday(); showToast("Correction undone in prototype."); return; }
    if (event.target.closest("[data-select-activity]")) { state.preview.today = "normal"; state.focusRunning = false; updateStateSelect(); renderToday(); closeDrawer(); showToast("Backend schema selected. Start remains a separate action."); return; }

    const endRunning = event.target.closest("[data-end-running]");
    if (endRunning) {
      state.runningCount = Math.max(0, state.runningCount - 1);
      if (endRunning.dataset.endRunning === "backend") state.focusRunning = false;
      closeDrawer();
      renderFocus();
      showToast("Only the selected Activity ended.");
      return;
    }
    if (event.target.closest("[data-choose-activity]")) {
      closeDrawer();
      showToast("Activity picker would open here.");
    }
  });

  $("#focus-action").addEventListener("click", () => {
    if (state.preview.today === "no-focus") {
      openDrawer("activities", $("#focus-action"));
      return;
    }
    state.focusRunning = !state.focusRunning;
    if (!state.focusRunning) state.runningCount = Math.max(1, state.runningCount - 1);
    else state.runningCount = Math.max(2, state.runningCount + 1);
    renderFocus();
    showToast(state.focusRunning ? "Backend schema started." : "Backend schema ended. Other Activities keep running.");
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
      const focusable = $$('button:not([disabled]), [href], select:not([disabled]), [tabindex]:not([tabindex="-1"])', drawer);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  document.addEventListener("keydown", (event) => {
    const chartTarget = event.target.closest(".donut-segment[data-open]");
    if (chartTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openDrawer(chartTarget.dataset.open, chartTarget);
    }
  });

  const initialDestination = window.location.hash.slice(1);
  if (initialDestination === "tracker") {
    setDestination("today", false);
    openDrawer("tracker", null);
  } else if (["today", "insights", "plan"].includes(initialDestination)) {
    setDestination(initialDestination, false);
  } else {
    setDestination("today", false);
  }
})();
