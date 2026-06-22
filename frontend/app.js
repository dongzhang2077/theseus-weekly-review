const api = window.TheseusApi;
const demoWeek = {
  week_start: "2026-06-08",
  week_end: "2026-06-14",
  label: "Jun 8 - Jun 14, 2026",
};

const navItems = [
  { id: "review", label: "Review", icon: "home" },
  { id: "plan", label: "Plan and log", icon: "calendar" },
  { id: "goals", label: "Goals and projects", icon: "target" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const fallbackReview = {
  week_start: demoWeek.week_start,
  week_end: demoWeek.week_end,
  wins: [
    {
      title: "Backend MVP shipped",
      evidence: "Theseus MVP backend received 7 hours of implementation time.",
    },
    {
      title: "Research report complete",
      evidence: "Research report work matched the planned 3 hours.",
    },
    {
      title: "Job search interviews scheduled",
      evidence: "Interview planning stayed visible in the weekly evidence.",
    },
  ],
  insights: [
    {
      title: "Core implementation time is visible",
      evidence: "Planned and logged time can be compared project by project.",
    },
  ],
  risk_flags: [
    {
      type: "plan_drift",
      severity: "medium",
      evidence: "Debugging time was higher than planned.",
    },
    {
      type: "overload_risk",
      severity: "low",
      evidence: "Frontend scope needs a narrow demo path.",
    },
  ],
  next_steps: [
    {
      title: "Prepare debugger notes",
      reason: "Keeps the next implementation block clear.",
    },
  ],
  evidence: {
    summary: {
      planned_total_minutes: 840,
      actual_total_minutes: 805,
      goal_count: 4,
      project_count: 4,
      time_log_count: 6,
    },
    projects: [
      {
        project_title: "Theseus MVP Backend",
        planned_minutes: 360,
        actual_minutes: 420,
        difference_minutes: 60,
        status: "Auth and API polish",
      },
      {
        project_title: "Research Report",
        planned_minutes: 180,
        actual_minutes: 180,
        difference_minutes: 0,
        status: "Outline done",
      },
      {
        project_title: "Job Search",
        planned_minutes: 120,
        actual_minutes: 60,
        difference_minutes: -60,
        status: "Interviews rescheduled",
      },
      {
        project_title: "Documentation",
        planned_minutes: 60,
        actual_minutes: 60,
        difference_minutes: 0,
        status: "API docs updated",
      },
    ],
    activity: {
      mix: {
        consuming: 300,
        neutral: 0,
        restore: 60,
        destroy: 90,
      },
      total_minutes: 450,
    },
  },
  generated_text: "Fixture review loaded.",
};

const fallbackCollections = {
  goals: [],
  projects: [],
  weeklyPlans: [],
  timeLogs: [],
  planRows: [
    ["MON", "Backend API", "2h", "MVP"],
    ["MON", "Research reading", "1h", "Research"],
    ["TUE", "API integration", "2h", "MVP"],
    ["WED", "Research report", "2h", "Research"],
    ["THU", "Exercise and walk", "1h", "Health"],
    ["FRI", "Review and plan", "1h", "Review"],
  ],
  logRows: [
    ["MON", "Backend API", "2h 15m", "MVP"],
    ["MON", "Research reading", "45m", "Research"],
    ["TUE", "API integration", "1h 45m", "MVP"],
    ["WED", "Research report", "2h 05m", "Research"],
    ["THU", "Exercise and walk", "1h", "Health"],
    ["FRI", "Review and plan", "1h 05m", "Review"],
  ],
  goalRows: [
    ["Ship backend MVP", "Backend, API, Docs", "P1", "Active"],
    ["Publish research report", "Research, Lit Review", "P2", "Active"],
    ["Find a great job", "Job Search, Interviews", "P2", "Active"],
    ["Build healthy habits", "Health, Exercise", "P3", "On Track"],
  ],
};

const icons = {
  home: '<path d="m4 11 8-7 8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  calendar:
    '<path d="M8 3v3M16 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  settings:
    '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/>',
  save: '<path d="M5 4h12l2 2v14H5Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
  undo: '<path d="M9 7H4v5"/><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6"/>',
};

const state = {
  view: "review",
  review: fallbackReview,
  collections: fallbackCollections,
  apiBaseUrl: api ? api.getApiBaseUrl() : "",
  statusMessage: "Fixture review loaded",
  statusTone: "",
  isBusy: false,
};

function icon(name) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${icons[name]}</svg>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatMinutes(minutes) {
  const absolute = Math.abs(Math.round(numberValue(minutes)));
  const hours = Math.floor(absolute / 60);
  const remainingMinutes = absolute % 60;
  if (hours && remainingMinutes) return `${hours}h ${remainingMinutes}m`;
  if (hours) return `${hours}h`;
  return `${remainingMinutes}m`;
}

function formatSignedMinutes(minutes) {
  const numeric = Math.round(numberValue(minutes));
  const sign = numeric > 0 ? "+" : numeric < 0 ? "-" : "";
  return `${sign}${formatMinutes(numeric)}`;
}

function labelFromKey(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function weekdayLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getUTCDay()];
}

function activityTypeLabel(type) {
  const labels = {
    consuming: "MVP",
    neutral: "Neutral",
    restore: "Health",
    destroy: "Risk",
  };
  return labels[type] || labelFromKey(type || "Log");
}

function projectById(projects, projectId) {
  return projects.find((project) => project.id === projectId);
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
          <span>${escapeHtml(item)}</span>
        </li>
      `
    )
    .join("");
  return `
    <section class="paper-panel">
      <div class="section-header">
        <div class="header-title">
          <span class="status-dot ${tone}"></span>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <span class="count-mark">${count}</span>
      </div>
      <div class="section-body">
        <ul class="section-list">${rows}</ul>
      </div>
    </section>
  `;
}

function findingTitles(items, fallback) {
  if (!Array.isArray(items) || !items.length) return fallback;
  return items.map((item) => item.title || item.evidence || String(item));
}

function riskTitles(risks, fallback) {
  if (!Array.isArray(risks) || !risks.length) return fallback;
  return risks.map((risk) => risk.evidence || labelFromKey(risk.type));
}

function nextStepTitle() {
  const nextSteps = state.review.next_steps;
  if (!Array.isArray(nextSteps) || !nextSteps.length) {
    return fallbackReview.next_steps[0].title;
  }
  return nextSteps[0].title || nextSteps[0].reason || "Prepare next review block";
}

function reviewEvidenceRows() {
  const projects = state.review.evidence?.projects;
  if (Array.isArray(projects) && projects.length) {
    return projects.slice(0, 8).map((project) => {
      const planned = numberValue(project.planned_minutes);
      const actual = numberValue(project.actual_minutes);
      const delta = numberValue(project.difference_minutes, actual - planned);
      return [
        project.project_title || project.title || `Project ${project.project_id || ""}`,
        formatMinutes(planned),
        formatMinutes(actual),
        formatSignedMinutes(delta),
        project.plan_status || project.status || project.stage || project.goal_title || "",
      ];
    });
  }

  return fallbackReview.evidence.projects.map((project) => [
    project.project_title,
    formatMinutes(project.planned_minutes),
    formatMinutes(project.actual_minutes),
    formatSignedMinutes(project.difference_minutes),
    project.status,
  ]);
}

function evidenceTable() {
  const rows = reviewEvidenceRows()
    .map(([project, planned, actual, delta, note]) => {
      const deltaClass = delta.startsWith("+")
        ? "delta-positive"
        : delta.startsWith("-")
          ? "delta-negative"
          : "";
      return `
        <tr>
          <td>${escapeHtml(project)}</td>
          <td class="numeric">${escapeHtml(planned)}</td>
          <td class="numeric">${escapeHtml(actual)}</td>
          <td class="numeric ${deltaClass}">${escapeHtml(delta)}</td>
          <td>${escapeHtml(note)}</td>
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

function activityRows() {
  const mix = state.review.evidence?.activity?.mix;
  if (mix && typeof mix === "object") {
    return ["consuming", "neutral", "restore", "destroy"].map((key) => [
      labelFromKey(key),
      formatMinutes(mix[key] || 0),
    ]);
  }

  return [
    ["Consuming", "5h"],
    ["Neutral", "0h"],
    ["Restore", "1h"],
    ["Destroy", "1h 30m"],
  ];
}

function activityTiles() {
  const tiles = activityRows()
    .map(
      ([name, minutes]) => `
        <div class="activity-tile">
          <span class="activity-name">${escapeHtml(name)}</span>
          <span class="activity-minutes">${escapeHtml(minutes)}</span>
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

function summaryMetrics() {
  const summary = state.review.evidence?.summary || {};
  const planned = numberValue(summary.planned_total_minutes, 840);
  const actual = numberValue(summary.actual_total_minutes, 805);
  return {
    planned: formatMinutes(planned),
    logged: formatMinutes(actual),
    delta: formatSignedMinutes(actual - planned),
    deltaClass: actual - planned < 0 ? "delta-negative" : actual - planned > 0 ? "delta-positive" : "",
  };
}

function renderReview() {
  const wins = findingTitles(
    state.review.wins,
    fallbackReview.wins.map((win) => win.title)
  );
  const risks = riskTitles(
    state.review.risk_flags,
    fallbackReview.risk_flags.map((risk) => risk.evidence)
  );
  const metrics = summaryMetrics();
  return `
    <div class="view-shell review-grid">
      <div class="summary-stack">
        ${section("Wins", wins.length, "", wins, "check")}
        ${section("Risks", risks.length, "amber", risks, "dot")}
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
              <span>${escapeHtml(nextStepTitle())}</span>
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
            <p class="status-note ${state.statusTone}">${escapeHtml(state.statusMessage)}</p>
            <div class="metric-strip">
              <div class="metric">
                <span class="metric-label">Planned</span>
                <span class="metric-value">${metrics.planned}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Logged</span>
                <span class="metric-value">${metrics.logged}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Delta</span>
                <span class="metric-value ${metrics.deltaClass}">${metrics.delta}</span>
              </div>
            </div>
          </div>
        </section>
        ${activityTiles()}
      </div>
    </div>
  `;
}

function planRowsFromApi() {
  const plan = state.collections.weeklyPlans.find(
    (item) => item.week_start === demoWeek.week_start && item.week_end === demoWeek.week_end
  );
  if (!plan?.items?.length) return fallbackCollections.planRows;

  return plan.items.map((item) => {
    const project = projectById(state.collections.projects, item.project_id);
    return [
      "PLAN",
      item.title,
      formatMinutes(item.planned_minutes),
      project?.title || "Plan",
    ];
  });
}

function logRowsFromApi() {
  const weeklyLogs = state.collections.timeLogs.filter(
    (log) => log.date >= demoWeek.week_start && log.date <= demoWeek.week_end
  );
  if (!weeklyLogs.length) return fallbackCollections.logRows;
  return weeklyLogs.map((log) => [
    weekdayLabel(log.date),
    log.activity_name,
    formatMinutes(log.duration_minutes),
    activityTypeLabel(log.activity_type),
  ]);
}

function planTable(title, rows) {
  const body = rows
    .map(
      ([day, task, hours, type]) => `
        <tr>
          <td>${escapeHtml(day)}</td>
          <td>${escapeHtml(task)}</td>
          <td class="numeric">${escapeHtml(hours)}</td>
          <td><span class="chip ${chipTone(type)}">${escapeHtml(type)}</span></td>
        </tr>
      `
    )
    .join("");
  return `
    <section class="paper-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="status-dot blue"></span>
          <h1>${escapeHtml(title)}</h1>
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
  if (type === "Health" || type === "Review" || type === "Restore") return "pink";
  if (type === "Career" || type === "Risk") return "amber";
  return "";
}

function renderPlan() {
  return `
    <div class="view-shell plan-grid">
      ${planTable("Plan", planRowsFromApi())}
      ${planTable("Log", logRowsFromApi())}
    </div>
  `;
}

function goalRowsFromApi() {
  if (!state.collections.goals.length && !state.collections.projects.length) {
    return fallbackCollections.goalRows;
  }

  return state.collections.goals.map((goal) => {
    const projects = state.collections.projects
      .filter((project) => project.goal_id === goal.id)
      .map((project) => project.title)
      .join(", ");
    return [
      goal.title,
      projects || "No linked projects",
      `P${goal.priority || 1}`,
      goal.active_status ? "Active" : "Paused",
    ];
  });
}

function renderGoals() {
  const rows = goalRowsFromApi()
    .map(
      ([goal, projects, priority, status], index) => `
        <tr>
          <td class="numeric">${index + 1}</td>
          <td>${escapeHtml(goal)}</td>
          <td>${escapeHtml(projects)}</td>
          <td><span class="chip ${priority === "P1" ? "pink" : ""}">${escapeHtml(priority)}</span></td>
          <td><span class="chip ${status === "Paused" ? "amber" : ""}">${escapeHtml(status)}</span></td>
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
  const apiBase = state.apiBaseUrl || (api ? api.DEFAULT_API_BASE_URL : "");
  return `
    <div class="view-shell">
      <section class="paper-panel settings-panel">
        <div class="panel-header">
          <div class="header-title">
            <span class="status-dot blue"></span>
            <h1>Demo connection</h1>
          </div>
        </div>
        <div class="panel-body">
          <form class="settings-form" id="apiSettingsForm">
            <div class="form-field">
              <label class="field-label" for="apiBaseUrl">API base URL</label>
              <div class="input-row">
                <input id="apiBaseUrl" name="apiBaseUrl" type="url" value="${escapeHtml(apiBase)}" autocomplete="off" spellcheck="false" />
                <button class="icon-button accent-action" type="submit" aria-label="Save API base URL" title="Save">
                  ${icon("save")}
                </button>
                <button class="icon-button" type="button" data-action="reset-api" aria-label="Reset API base URL" title="Reset">
                  ${icon("undo")}
                </button>
              </div>
            </div>
            <p class="status-note ${state.statusTone}">${escapeHtml(state.statusMessage)}</p>
          </form>
        </div>
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

function updateChrome() {
  const weekRange = document.querySelector(".week-range");
  const weekState = document.querySelector(".week-state");
  const generateButton = document.querySelector('[data-action="generate-review"]');
  if (weekRange) weekRange.textContent = demoWeek.label;
  if (weekState) weekState.textContent = state.statusMessage;
  if (generateButton) {
    generateButton.disabled = state.isBusy;
    generateButton.setAttribute("aria-busy", String(state.isBusy));
  }
}

function bindWorkspaceActions() {
  const form = document.getElementById("apiSettingsForm");
  if (form && api) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.getElementById("apiBaseUrl");
      state.apiBaseUrl = api.setApiBaseUrl(input.value);
      state.statusMessage = "API base URL saved";
      state.statusTone = "";
      render();
    });
  }

  const resetButton = document.querySelector('[data-action="reset-api"]');
  if (resetButton && api) {
    resetButton.addEventListener("click", () => {
      state.apiBaseUrl = api.resetApiBaseUrl();
      state.statusMessage = "API base URL reset";
      state.statusTone = "";
      render();
    });
  }
}

function render() {
  renderNav();
  document.getElementById("workspace").innerHTML = renderWorkspace();
  bindWorkspaceActions();
  updateChrome();
}

async function loadApiCollections() {
  if (!api) return;
  const requests = [
    ["goals", api.listGoals()],
    ["projects", api.listProjects()],
    ["weeklyPlans", api.listWeeklyPlans()],
    ["timeLogs", api.listTimeLogs()],
  ];
  const results = await Promise.allSettled(requests.map(([, request]) => request));
  const nextCollections = { ...fallbackCollections };

  results.forEach((result, index) => {
    const key = requests[index][0];
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      nextCollections[key] = result.value;
    }
  });

  state.collections = nextCollections;
}

function fallbackMessage(error) {
  if (error?.status === 404) {
    return "Sample database not loaded; fixture review loaded";
  }
  if (error?.name === "TypeError") {
    return "Backend unavailable; fixture review loaded";
  }
  return "API request failed; fixture review loaded";
}

function resetFixture() {
  state.review = fallbackReview;
  state.collections = fallbackCollections;
  state.statusMessage = "Fixture review loaded";
  state.statusTone = "";
  render();
}

async function generateReview() {
  if (!api) {
    resetFixture();
    return;
  }

  state.isBusy = true;
  state.statusMessage = "Generating review";
  state.statusTone = "";
  render();

  try {
    state.review = await api.generateWeeklyReview({
      week_start: demoWeek.week_start,
      week_end: demoWeek.week_end,
      mode: "deterministic_first",
    });
    state.statusMessage = "Backend review loaded";
    state.statusTone = "";
    await loadApiCollections();
  } catch (error) {
    state.review = fallbackReview;
    state.collections = fallbackCollections;
    state.statusMessage = fallbackMessage(error);
    state.statusTone = "warning";
  } finally {
    state.isBusy = false;
    render();
  }
}

function bindChromeActions() {
  const refreshButton = document.querySelector('[data-action="refresh-fixture"]');
  const generateButton = document.querySelector('[data-action="generate-review"]');
  if (refreshButton) refreshButton.addEventListener("click", resetFixture);
  if (generateButton) generateButton.addEventListener("click", generateReview);
}

bindChromeActions();
render();
