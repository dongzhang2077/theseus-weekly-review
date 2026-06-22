const navItems = [
  { id: "review", label: "Review", icon: "home" },
  { id: "plan", label: "Plan and log", icon: "calendar" },
  { id: "goals", label: "Goals and projects", icon: "target" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const sample = {
  wins: [
    "Backend MVP shipped",
    "Research report complete",
    "Job search interviews scheduled",
  ],
  risks: ["Debugging time higher than planned", "Scope creep in frontend tasks"],
  next: "Prepare debugger notes",
  evidence: [
    ["Theseus MVP Backend", "6h", "7h", "+1h", "Auth and API polish"],
    ["Research Report", "3h", "3h", "0h", "Outline done"],
    ["Job Search", "2h", "1h", "-1h", "Interviews rescheduled"],
    ["Documentation", "1h", "1h", "0h", "API docs updated"],
  ],
  plan: [
    ["MON", "Backend API", "2h", "MVP"],
    ["MON", "Research reading", "1h", "Research"],
    ["TUE", "API integration", "2h", "MVP"],
    ["WED", "Research report", "2h", "Research"],
    ["THU", "Exercise and walk", "1h", "Health"],
    ["FRI", "Review and plan", "1h", "Review"],
  ],
  log: [
    ["MON", "Backend API", "2h 15m", "MVP"],
    ["MON", "Research reading", "45m", "Research"],
    ["TUE", "API integration", "1h 45m", "MVP"],
    ["WED", "Research report", "2h 05m", "Research"],
    ["THU", "Exercise and walk", "1h", "Health"],
    ["FRI", "Review and plan", "1h 05m", "Review"],
  ],
  goals: [
    ["Ship backend MVP", "Backend, API, Docs", "P1", "Active"],
    ["Publish research report", "Research, Lit Review", "P2", "Active"],
    ["Find a great job", "Job Search, Interviews", "P2", "Active"],
    ["Build healthy habits", "Health, Exercise", "P3", "On Track"],
  ],
  activity: [
    ["Consuming", "5h"],
    ["Neutral", "0h"],
    ["Restore", "1h"],
    ["Destroy", "1h 30m"],
  ],
};

const icons = {
  home: '<path d="m4 11 8-7 8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  calendar:
    '<path d="M8 3v3M16 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  settings:
    '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/>',
};

const state = {
  view: "review",
};

function icon(name) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${icons[name]}</svg>`;
}

function navButton(item) {
  const current = state.view === item.id ? ' aria-current="page"' : "";
  return `
    <button class="icon-button" type="button" data-view="${item.id}" aria-label="${item.label}" title="${item.label}"${current}>
      ${icon(item.icon)}
    </button>
  `;
}

function renderNav() {
  document.getElementById("desktopNav").innerHTML = navItems.map(navButton).join("");
  document.getElementById("mobileNav").innerHTML = navItems.map(navButton).join("");
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      render();
      document.getElementById("workspace").focus({ preventScroll: true });
    });
  });
}

function section(title, count, tone, items, marker) {
  const rows = items
    .map(
      (item) => `
        <li>
          <span class="small-mark ${marker} ${tone === "amber" ? "amber" : ""}" aria-hidden="true"></span>
          <span>${item}</span>
        </li>
      `
    )
    .join("");
  return `
    <section class="paper-panel">
      <div class="section-header">
        <div class="header-title">
          <span class="status-dot ${tone}"></span>
          <h2>${title}</h2>
        </div>
        <span class="count-mark">${count}</span>
      </div>
      <div class="section-body">
        <ul class="section-list">${rows}</ul>
      </div>
    </section>
  `;
}

function evidenceTable() {
  const rows = sample.evidence
    .map(([project, planned, actual, delta, note]) => {
      const deltaClass = delta.startsWith("+")
        ? "delta-positive"
        : delta.startsWith("-")
          ? "delta-negative"
          : "";
      return `
        <tr>
          <td>${project}</td>
          <td class="numeric">${planned}</td>
          <td class="numeric">${actual}</td>
          <td class="numeric ${deltaClass}">${delta}</td>
          <td>${note}</td>
        </tr>
      `;
    })
    .join("");
  return `
    <section class="paper-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="status-dot blue"></span>
          <h2>Evidence</h2>
        </div>
      </div>
      <div class="panel-body table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th class="numeric">Planned</th>
              <th class="numeric">Actual</th>
              <th class="numeric">Delta</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function activityTiles() {
  const tiles = sample.activity
    .map(
      ([name, minutes]) => `
        <div class="activity-tile">
          <span class="activity-name">${name}</span>
          <span class="activity-minutes">${minutes}</span>
        </div>
      `
    )
    .join("");
  return `
    <section class="paper-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="status-dot"></span>
          <h2>Activity mix</h2>
        </div>
      </div>
      <div class="panel-body activity-grid">${tiles}</div>
    </section>
  `;
}

function renderReview() {
  return `
    <div class="view-shell review-grid">
      <div class="summary-stack">
        ${section("Wins", 3, "", sample.wins, "check")}
        ${section("Risks", 2, "amber", sample.risks, "dot")}
        ${evidenceTable()}
        <section class="paper-panel">
          <div class="section-header">
            <div class="header-title">
              <span class="status-dot"></span>
              <h2>Next</h2>
            </div>
            <span class="count-mark">1</span>
          </div>
          <div class="section-body">
            <div class="task-row">
              <span class="task-checkbox" aria-hidden="true"></span>
              <span>${sample.next}</span>
            </div>
          </div>
        </section>
      </div>
      <div class="summary-stack">
        <section class="paper-panel">
          <div class="panel-header">
            <div class="header-title">
              <span class="status-dot blue"></span>
              <h1>Weekly review</h1>
            </div>
          </div>
          <div class="panel-body">
            <div class="metric-strip">
              <div class="metric">
                <span class="metric-label">Planned</span>
                <span class="metric-value">14h</span>
              </div>
              <div class="metric">
                <span class="metric-label">Logged</span>
                <span class="metric-value">13h 25m</span>
              </div>
              <div class="metric">
                <span class="metric-label">Delta</span>
                <span class="metric-value delta-negative">-35m</span>
              </div>
            </div>
          </div>
        </section>
        ${activityTiles()}
      </div>
    </div>
  `;
}

function planTable(title, rows) {
  const body = rows
    .map(
      ([day, task, hours, type]) => `
        <tr>
          <td>${day}</td>
          <td>${task}</td>
          <td class="numeric">${hours}</td>
          <td><span class="chip ${chipTone(type)}">${type}</span></td>
        </tr>
      `
    )
    .join("");
  return `
    <section class="paper-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="status-dot blue"></span>
          <h1>${title}</h1>
        </div>
      </div>
      <div class="panel-body table-wrap">
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Task</th>
              <th class="numeric">Hours</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
  `;
}

function chipTone(type) {
  if (type === "Research") return "blue";
  if (type === "Health" || type === "Review") return "pink";
  if (type === "Career") return "amber";
  return "";
}

function renderPlan() {
  return `
    <div class="view-shell plan-grid">
      ${planTable("Plan", sample.plan)}
      ${planTable("Log", sample.log)}
    </div>
  `;
}

function renderGoals() {
  const rows = sample.goals
    .map(
      ([goal, projects, priority, status], index) => `
        <tr>
          <td class="numeric">${index + 1}</td>
          <td>${goal}</td>
          <td>${projects}</td>
          <td><span class="chip ${priority === "P1" ? "pink" : ""}">${priority}</span></td>
          <td><span class="chip ${status === "On Track" ? "blue" : ""}">${status}</span></td>
        </tr>
      `
    )
    .join("");
  return `
    <div class="view-shell">
      <section class="paper-panel">
        <div class="panel-header">
          <div class="header-title">
            <span class="status-dot"></span>
            <h1>Goals and projects</h1>
          </div>
        </div>
        <div class="panel-body table-wrap">
          <table>
            <thead>
              <tr>
                <th class="numeric">No.</th>
                <th>Goal</th>
                <th>Projects</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderSettings() {
  return `
    <div class="view-shell">
      <section class="paper-panel route-placeholder">
        <h1 class="placeholder-title">Demo support</h1>
        <p class="placeholder-text">API base URL, sample week selection, import controls, and review generation options will live here after the app shell is connected to backend data.</p>
      </section>
    </div>
  `;
}

function renderWorkspace() {
  if (state.view === "plan") return renderPlan();
  if (state.view === "goals") return renderGoals();
  if (state.view === "settings") return renderSettings();
  return renderReview();
}

function render() {
  renderNav();
  document.getElementById("workspace").innerHTML = renderWorkspace();
}

render();
