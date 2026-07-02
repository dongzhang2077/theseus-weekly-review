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
  generated_text:
    "Win: Backend MVP work moved forward with clear implementation evidence. Insight: Planned and logged time can now be compared by project. Risk: Debugging and frontend scope can still displace planned work. Next step: Prepare debugger notes before the next implementation block.",
};

const fallbackCollections = {
  goals: [
    {
      id: 1,
      title: "Build Theseus MVP",
      description: "Create a working weekly review prototype for CSIS 4495.",
      priority: 1,
      active_status: true,
    },
    {
      id: 2,
      title: "Internship preparation",
      description: "Maintain job search and interview preparation.",
      priority: 2,
      active_status: true,
    },
  ],
  projects: [
    {
      id: 1,
      goal_id: 1,
      title: "Theseus backend",
      stage: "startup",
      weekly_min_minutes: 180,
      weekly_target_minutes: 480,
      status: "active",
    },
    {
      id: 2,
      goal_id: 1,
      title: "Theseus frontend",
      stage: "startup",
      weekly_min_minutes: 120,
      weekly_target_minutes: 360,
      status: "active",
    },
    {
      id: 3,
      goal_id: 2,
      title: "Resume and applications",
      stage: "stable",
      weekly_min_minutes: 60,
      weekly_target_minutes: 180,
      status: "active",
    },
  ],
  weeklyPlans: [],
  timeLogs: [],
  planRows: [
    { day: "MON", task: "Backend API", project: "Theseus backend", minutes: 120, type: "P1" },
    { day: "MON", task: "Research reading", project: "Research report", minutes: 60, type: "P2" },
    { day: "TUE", task: "API integration", project: "Theseus backend", minutes: 120, type: "P1" },
    { day: "WED", task: "Research report", project: "Research report", minutes: 120, type: "P2" },
    { day: "THU", task: "Exercise and walk", project: "Health", minutes: 60, type: "P3" },
    { day: "FRI", task: "Review and plan", project: "Weekly review", minutes: 60, type: "P2" },
  ],
  logRows: [
    { day: "MON", task: "Backend API", project: "Theseus backend", minutes: 135, type: "consuming" },
    { day: "MON", task: "Research reading", project: "Research report", minutes: 45, type: "neutral" },
    { day: "TUE", task: "API integration", project: "Theseus backend", minutes: 105, type: "consuming" },
    { day: "WED", task: "Research report", project: "Research report", minutes: 125, type: "consuming" },
    { day: "THU", task: "Exercise and walk", project: "Health", minutes: 60, type: "restore" },
    { day: "FRI", task: "Late scrolling", project: "Unlinked", minutes: 65, type: "destroy" },
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
  return ["consuming", "neutral", "restore", "destroy"].includes(type)
    ? type
    : labelFromKey(type || "log");
}

function projectById(projects, projectId) {
  return projects.find((project) => project.id === projectId);
}

function goalById(goals, goalId) {
  return goals.find((goal) => goal.id === goalId);
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
  const rows = items.length
    ? items
        .map(
          (item) => `
        <li>
          <span class="small-mark ${marker} ${tone || ""}" aria-hidden="true"></span>
          <span class="item-text">
            <strong>${escapeHtml(item.title || item)}</strong>
            ${item.detail ? `<span>${escapeHtml(item.detail)}</span>` : ""}
          </span>
        </li>
      `
        )
        .join("")
    : `
        <li class="empty-row">
          <span class="small-mark ${marker} ${tone || ""}" aria-hidden="true"></span>
          <span class="item-text">
            <strong>No items yet</strong>
            <span>This section will fill after review data is available.</span>
          </span>
        </li>
      `;
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
  const source = Array.isArray(items) ? items : fallback;
  return source.map((item) =>
    typeof item === "string"
      ? { title: item, detail: "" }
      : { title: item.title || item.evidence || String(item), detail: item.evidence || "" }
  );
}

function riskTitles(risks, fallback) {
  const source = Array.isArray(risks) ? risks : fallback;
  return source.map((risk) =>
    typeof risk === "string"
      ? { title: risk, detail: "" }
      : {
          title: risk.evidence || labelFromKey(risk.type),
          detail: risk.severity ? `${labelFromKey(risk.severity)} severity` : "",
        }
  );
}

function nextStepItems() {
  const nextSteps = state.review.next_steps;
  if (!Array.isArray(nextSteps)) {
    return fallbackReview.next_steps.map((step) => ({
      title: step.title,
      detail: step.reason,
    }));
  }
  return nextSteps.map((step) => ({
    title: step.title || step.reason || "Prepare next review block",
    detail: step.reason || "",
  }));
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
      <div class="panel-body">
        ${evidenceSummary()}
        <details class="evidence-details" open>
          <summary>
            <span>Project evidence</span>
            <span>${reviewEvidenceRows().length}</span>
          </summary>
          <div class="table-wrap">
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
        </details>
      </div>
    </section>
  `;
}

function evidenceSummary() {
  const summary = state.review.evidence?.summary || {};
  const plan = state.review.evidence?.plan || {};
  const reflections = state.review.evidence?.reflections || {};
  const dormancyProjects = state.review.evidence?.dormancy?.projects || [];
  const cards = [
    ["Logs", summary.time_log_count ?? 0],
    ["Projects", summary.project_count ?? reviewEvidenceRows().length],
    ["Slack", plan.slack_status ? labelFromKey(plan.slack_status) : "Unknown"],
    ["Dormant", dormancyProjects.filter((project) => project.risk_level !== "none").length],
    ["Reflections", reflections.count ?? summary.reflection_count ?? 0],
    ["Unplanned", formatMinutes(plan.unplanned_project_minutes || 0)],
  ];
  return `
    <div class="evidence-summary">
      ${cards
        .map(
          ([label, value]) => `
            <div class="mini-metric">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
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
  const planned = numberValue(
    summary.planned_total_minutes,
    numberValue(state.review.evidence?.planned_total_minutes, 840)
  );
  const actual = numberValue(
    summary.actual_total_minutes,
    numberValue(state.review.evidence?.actual_total_minutes, 805)
  );
  return {
    plannedRaw: planned,
    loggedRaw: actual,
    planned: formatMinutes(planned),
    logged: formatMinutes(actual),
    delta: formatSignedMinutes(actual - planned),
    deltaClass: actual - planned < 0 ? "delta-negative" : actual - planned > 0 ? "delta-positive" : "",
  };
}

function sourceLabel() {
  if (state.isBusy) return "Loading";
  if (state.statusTone === "warning") return "Fixture";
  if (state.statusMessage.includes("Backend")) return "Backend";
  return "Fixture";
}

function dashboardMetrics(metrics) {
  const summary = state.review.evidence?.summary || {};
  const risks = Array.isArray(state.review.risk_flags) ? state.review.risk_flags.length : 0;
  const nextSteps = Array.isArray(state.review.next_steps) ? state.review.next_steps.length : 0;
  const cards = [
    ["Source", sourceLabel(), state.statusTone === "warning" ? "amber" : "green"],
    ["Risks", risks, risks > 0 ? "amber" : "green"],
    ["Next", nextSteps || nextStepItems().length, "green"],
    ["Logs", summary.time_log_count ?? state.collections.timeLogs.length, "blue"],
  ];

  return `
    <div class="dashboard-strip">
      ${cards
        .map(
          ([label, value, tone]) => `
            <div class="dashboard-card ${tone}">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
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
  `;
}

function generatedReviewText() {
  const text = String(state.review.generated_text || "").trim();
  if (!text) {
    return "No generated review text yet.";
  }
  return text;
}

function reviewTextPanel() {
  return `
    <section class="paper-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="status-dot blue"></span>
          <h2>Review text</h2>
        </div>
      </div>
      <div class="panel-body">
        <p class="generated-text">${escapeHtml(generatedReviewText())}</p>
      </div>
    </section>
  `;
}

function renderReview() {
  const wins = findingTitles(
    state.review.wins,
    fallbackReview.wins
  );
  const insights = findingTitles(
    state.review.insights,
    fallbackReview.insights
  );
  const risks = riskTitles(
    state.review.risk_flags,
    fallbackReview.risk_flags
  );
  const nextSteps = nextStepItems();
  const metrics = summaryMetrics();
  return `
    <div class="view-shell review-grid">
      <div class="summary-stack">
        ${section("Wins", wins.length, "", wins, "check")}
        ${section("Insights", insights.length, "blue", insights, "dot")}
        ${section("Risks", risks.length, "amber", risks, "dot")}
        ${evidenceTable()}
        ${section("Next", nextSteps.length, "", nextSteps, "box")}
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
            ${state.isBusy ? '<div class="loading-line" aria-hidden="true"></div>' : ""}
            ${dashboardMetrics(metrics)}
          </div>
        </section>
        ${activityTiles()}
        ${reviewTextPanel()}
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
    return {
      day: "PLAN",
      task: item.title,
      project: project?.title || "Unlinked",
      minutes: numberValue(item.planned_minutes),
      type: `P${item.priority || 1}`,
    };
  });
}

function logRowsFromApi() {
  const weeklyLogs = state.collections.timeLogs.filter(
    (log) => log.date >= demoWeek.week_start && log.date <= demoWeek.week_end
  );
  if (!weeklyLogs.length) return fallbackCollections.logRows;
  return weeklyLogs.map((log) => {
    const project = projectById(state.collections.projects, log.project_id);
    return {
      day: weekdayLabel(log.date),
      task: log.activity_name,
      project: project?.title || "Unlinked",
      minutes: numberValue(log.duration_minutes),
      type: activityTypeLabel(log.activity_type),
    };
  });
}

function totalRowMinutes(rows) {
  return rows.reduce((total, row) => total + numberValue(row.minutes), 0);
}

function deltaClass(minutes) {
  const value = numberValue(minutes);
  if (value > 0) return "delta-positive";
  if (value < 0) return "delta-negative";
  return "";
}

function planLogMetrics(planRows, logRows) {
  const planned = totalRowMinutes(planRows);
  const logged = totalRowMinutes(logRows);
  return {
    planned,
    logged,
    delta: logged - planned,
  };
}

function planOverview(planRows, logRows) {
  const metrics = planLogMetrics(planRows, logRows);
  const activityTypes = new Set(logRows.map((row) => row.type));
  const cards = [
    ["Planned", formatMinutes(metrics.planned), ""],
    ["Logged", formatMinutes(metrics.logged), ""],
    ["Delta", formatSignedMinutes(metrics.delta), deltaClass(metrics.delta)],
    ["Log types", activityTypes.size, ""],
  ];
  return `
    <section class="paper-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="status-dot blue"></span>
          <h1>Plan vs log</h1>
        </div>
      </div>
      <div class="panel-body">
        <div class="plan-overview">
          ${cards
            .map(
              ([label, value, valueClass]) => `
                <div class="metric">
                  <span class="metric-label">${escapeHtml(label)}</span>
                  <span class="metric-value ${valueClass}">${escapeHtml(value)}</span>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function planTable(title, rows, mode) {
  const body = rows
    .map(
      (row) => `
        <tr>
          <td data-label="Day">${escapeHtml(row.day)}</td>
          <td data-label="Task">${escapeHtml(row.task)}</td>
          <td data-label="Project">${escapeHtml(row.project)}</td>
          <td class="numeric" data-label="Hours">${escapeHtml(formatMinutes(row.minutes))}</td>
          <td data-label="${mode === "log" ? "Activity" : "Priority"}">
            <span class="chip ${chipTone(row.type)}">${escapeHtml(row.type)}</span>
          </td>
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
        <table class="compact-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Task</th>
              <th>Project</th>
              <th class="numeric">Hours</th>
              <th>${mode === "log" ? "Activity" : "Priority"}</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
  `;
}

function chipTone(type) {
  if (type === "neutral") return "blue";
  if (type === "restore") return "pink";
  if (type === "destroy" || type === "under_plan") return "amber";
  if (type === "over_plan") return "blue";
  if (type === "Research") return "blue";
  if (type === "Health" || type === "Review" || type === "Restore" || type === "P1") return "pink";
  if (type === "Career" || type === "Risk" || type === "P2") return "amber";
  return "";
}

function comparisonRows(planRows, logRows) {
  const byProject = new Map();
  const ensureProject = (project) => {
    if (!byProject.has(project)) {
      byProject.set(project, { project, planned: 0, logged: 0 });
    }
    return byProject.get(project);
  };

  planRows.forEach((row) => {
    ensureProject(row.project).planned += numberValue(row.minutes);
  });
  logRows.forEach((row) => {
    ensureProject(row.project).logged += numberValue(row.minutes);
  });

  return Array.from(byProject.values())
    .map((row) => {
      const delta = row.logged - row.planned;
      return {
        ...row,
        delta,
        status: delta > 0 ? "over_plan" : delta < 0 ? "under_plan" : "on_track",
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.project.localeCompare(b.project));
}

function comparisonTable(planRows, logRows) {
  const rows = comparisonRows(planRows, logRows)
    .map(
      (row) => `
        <tr>
          <td data-label="Project">${escapeHtml(row.project)}</td>
          <td class="numeric" data-label="Planned">${escapeHtml(formatMinutes(row.planned))}</td>
          <td class="numeric" data-label="Logged">${escapeHtml(formatMinutes(row.logged))}</td>
          <td class="numeric ${deltaClass(row.delta)}" data-label="Delta">${escapeHtml(formatSignedMinutes(row.delta))}</td>
          <td data-label="Status"><span class="chip ${chipTone(row.status)}">${escapeHtml(labelFromKey(row.status))}</span></td>
        </tr>
      `
    )
    .join("");
  return `
    <section class="paper-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="status-dot"></span>
          <h1>Evidence link</h1>
        </div>
      </div>
      <div class="panel-body table-wrap">
        <table class="compact-table comparison-table">
          <thead>
            <tr>
              <th>Project</th>
              <th class="numeric">Planned</th>
              <th class="numeric">Logged</th>
              <th class="numeric">Delta</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPlan() {
  const planRows = planRowsFromApi();
  const logRows = logRowsFromApi();
  return `
    <div class="view-shell">
      ${planOverview(planRows, logRows)}
      <div class="view-shell plan-grid">
        ${planTable("Plan", planRows, "plan")}
        ${planTable("Log", logRows, "log")}
      </div>
      ${comparisonTable(planRows, logRows)}
    </div>
  `;
}

function goalRows() {
  return state.collections.goals.map((goal) => {
    const projects = state.collections.projects
      .filter((project) => project.goal_id === goal.id)
      .map((project) => project.title)
      .join(", ");
    return {
      title: goal.title,
      description: goal.description || "",
      projects: projects || "No linked projects",
      priority: `P${goal.priority || 1}`,
      status: goal.active_status ? "Active" : "Paused",
    };
  });
}

function projectRows() {
  return state.collections.projects.map((project) => {
    const goal = goalById(state.collections.goals, project.goal_id);
    return {
      title: project.title,
      goal: goal?.title || "Unlinked",
      stage: labelFromKey(project.stage),
      target: formatMinutes(project.weekly_target_minutes || 0),
      status: labelFromKey(project.status),
    };
  });
}

function goalOptions() {
  if (!state.collections.goals.length) {
    return '<option value="">No goals available</option>';
  }
  return state.collections.goals
    .map(
      (goal) => `<option value="${goal.id}">${escapeHtml(goal.title)}</option>`
    )
    .join("");
}

function renderGoalForm() {
  return `
    <section class="paper-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="status-dot"></span>
          <h1>Goal setup</h1>
        </div>
      </div>
      <div class="panel-body">
        <form class="settings-form setup-form" id="goalCreateForm">
          <div class="form-grid">
            <div class="form-field">
              <label class="field-label" for="goalTitle">Title</label>
              <input id="goalTitle" name="title" type="text" required autocomplete="off" />
            </div>
            <div class="form-field compact-field">
              <label class="field-label" for="goalPriority">Priority</label>
              <input id="goalPriority" name="priority" type="number" min="1" max="5" value="1" />
            </div>
          </div>
          <div class="form-field">
            <label class="field-label" for="goalDescription">Description</label>
            <textarea id="goalDescription" name="description" rows="3"></textarea>
          </div>
          <div class="form-actions">
            <label class="checkbox-row" for="goalActiveStatus">
              <input id="goalActiveStatus" name="active_status" type="checkbox" checked />
              <span>Active</span>
            </label>
            <button class="icon-button accent-action" type="submit" aria-label="Create goal" title="Create goal">
              ${icon("save")}
            </button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderProjectForm() {
  return `
    <section class="paper-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="status-dot blue"></span>
          <h1>Project setup</h1>
        </div>
      </div>
      <div class="panel-body">
        <form class="settings-form setup-form" id="projectCreateForm">
          <div class="form-field">
            <label class="field-label" for="projectTitle">Title</label>
            <input id="projectTitle" name="title" type="text" required autocomplete="off" />
          </div>
          <div class="form-grid">
            <div class="form-field">
              <label class="field-label" for="projectGoalId">Goal</label>
              <select id="projectGoalId" name="goal_id" required>
                ${goalOptions()}
              </select>
            </div>
            <div class="form-field">
              <label class="field-label" for="projectStage">Stage</label>
              <select id="projectStage" name="stage">
                <option value="startup">Startup</option>
                <option value="stable">Stable</option>
                <option value="sprint">Sprint</option>
                <option value="dormant">Dormant</option>
                <option value="wake_up">Wake up</option>
              </select>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-field">
              <label class="field-label" for="projectStatus">Status</label>
              <select id="projectStatus" name="status">
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="form-field compact-field">
              <label class="field-label" for="projectTarget">Target minutes</label>
              <input id="projectTarget" name="weekly_target_minutes" type="number" min="0" step="15" value="120" />
            </div>
          </div>
          <div class="form-actions">
            <span class="status-note inline-note">Linked to selected goal</span>
            <button class="icon-button accent-action" type="submit" aria-label="Create project" title="Create project">
              ${icon("save")}
            </button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderGoalTable() {
  const rows = goalRows()
    .map(
      (goal, index) => `
        <tr>
          <td class="numeric" data-label="No.">${index + 1}</td>
          <td data-label="Goal">
            <span class="table-title">${escapeHtml(goal.title)}</span>
            ${goal.description ? `<span class="table-subtitle">${escapeHtml(goal.description)}</span>` : ""}
          </td>
          <td data-label="Projects">${escapeHtml(goal.projects)}</td>
          <td data-label="Priority"><span class="chip ${goal.priority === "P1" ? "pink" : ""}">${escapeHtml(goal.priority)}</span></td>
          <td data-label="Status"><span class="chip ${goal.status === "Paused" ? "amber" : ""}">${escapeHtml(goal.status)}</span></td>
        </tr>
      `
    )
    .join("");
  return `
    <section class="paper-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="status-dot"></span>
          <h1>Goals</h1>
        </div>
      </div>
      <div class="panel-body table-wrap">
        <table class="compact-table">
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
  `;
}

function renderProjectTable() {
  const rows = projectRows()
    .map(
      (project) => `
        <tr>
          <td data-label="Project">${escapeHtml(project.title)}</td>
          <td data-label="Goal">${escapeHtml(project.goal)}</td>
          <td data-label="Stage"><span class="chip blue">${escapeHtml(project.stage)}</span></td>
          <td class="numeric" data-label="Target">${escapeHtml(project.target)}</td>
          <td data-label="Status"><span class="chip ${project.status === "Paused" ? "amber" : ""}">${escapeHtml(project.status)}</span></td>
        </tr>
      `
    )
    .join("");
  return `
    <section class="paper-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="status-dot blue"></span>
          <h1>Projects</h1>
        </div>
      </div>
      <div class="panel-body table-wrap">
        <table class="compact-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Goal</th>
              <th>Stage</th>
              <th class="numeric">Target</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderGoals() {
  return `
    <div class="view-shell">
      <div class="view-shell setup-grid">
        ${renderGoalForm()}
        ${renderProjectForm()}
      </div>
      ${renderGoalTable()}
      ${renderProjectTable()}
      <p class="status-note ${state.statusTone}">${escapeHtml(state.statusMessage)}</p>
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

function nextLocalId(items) {
  return items.reduce((maxId, item) => Math.max(maxId, numberValue(item.id)), 0) + 1;
}

function createLocalGoal(payload) {
  const goal = {
    id: nextLocalId(state.collections.goals),
    ...payload,
  };
  state.collections = {
    ...state.collections,
    goals: [...state.collections.goals, goal],
  };
  return goal;
}

function createLocalProject(payload) {
  const project = {
    id: nextLocalId(state.collections.projects),
    weekly_min_minutes: 0,
    weekly_target_minutes: 0,
    ...payload,
  };
  state.collections = {
    ...state.collections,
    projects: [...state.collections.projects, project],
  };
  return project;
}

async function handleGoalCreate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const title = form.elements.title.value.trim();
  if (!title) {
    state.statusMessage = "Goal title is required";
    state.statusTone = "warning";
    render();
    return;
  }

  const payload = {
    title,
    description: form.elements.description.value.trim(),
    priority: numberValue(form.elements.priority.value, 1),
    active_status: form.elements.active_status.checked,
  };

  state.isBusy = true;
  state.statusMessage = "Saving goal";
  state.statusTone = "";
  render();

  try {
    if (!api) throw new Error("API unavailable");
    await api.createGoal(payload);
    await loadApiCollections();
    state.statusMessage = "Goal saved";
    state.statusTone = "";
  } catch {
    createLocalGoal(payload);
    state.statusMessage = "Backend unavailable; goal saved locally";
    state.statusTone = "warning";
  } finally {
    state.isBusy = false;
    render();
  }
}

async function handleProjectCreate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const goalId = numberValue(form.elements.goal_id.value, 0);
  const title = form.elements.title.value.trim();
  if (!title || goalId <= 0) {
    state.statusMessage = "Project title and goal are required";
    state.statusTone = "warning";
    render();
    return;
  }

  const payload = {
    goal_id: goalId,
    title,
    stage: form.elements.stage.value,
    status: form.elements.status.value,
    weekly_target_minutes: numberValue(form.elements.weekly_target_minutes.value, 0),
    weekly_min_minutes: 0,
  };

  state.isBusy = true;
  state.statusMessage = "Saving project";
  state.statusTone = "";
  render();

  try {
    if (!api) throw new Error("API unavailable");
    await api.createProject(payload);
    await loadApiCollections();
    state.statusMessage = "Project saved";
    state.statusTone = "";
  } catch {
    createLocalProject(payload);
    state.statusMessage = "Backend unavailable; project saved locally";
    state.statusTone = "warning";
  } finally {
    state.isBusy = false;
    render();
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

  const goalForm = document.getElementById("goalCreateForm");
  if (goalForm) {
    goalForm.addEventListener("submit", handleGoalCreate);
  }

  const projectForm = document.getElementById("projectCreateForm");
  if (projectForm) {
    projectForm.addEventListener("submit", handleProjectCreate);
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
      mode: "supportive_text",
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
