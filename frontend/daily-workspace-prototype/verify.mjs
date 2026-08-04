import fs from "node:fs";
import { JSDOM } from "../app/node_modules/jsdom/lib/api.js";

const prototypeDirectory = new URL("./", import.meta.url);
const html = fs.readFileSync(new URL("index.html", prototypeDirectory), "utf8");
const application = fs.readFileSync(new URL("app.js", prototypeDirectory), "utf8");
const dom = new JSDOM(html, {
  url: "http://127.0.0.1:4173/#today",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const { document } = dom.window;

dom.window.eval(application);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function all(selector) {
  return [...document.querySelectorAll(selector)];
}

function click(selector) {
  const element = document.querySelector(selector);
  assert(element, `Missing interactive element: ${selector}`);
  element.click();
  return element;
}

assert(all('[role="tab"]').length === 0, "Incomplete ARIA tab pattern remains");
assert(all('[role="img"] button, [role="img"] [tabindex]').length === 0, "An image role hides interactive descendants");

click('[data-mode="week"]');
assert(all(".day-bar-button").length === 4, "The current week must expose four recorded days");
assert(all(".day-bar.is-unavailable").length === 3, "Future days must be unavailable");
assert(document.querySelector(".summary-row strong").textContent === "15h 10m", "The current total must exclude future days");
const wednesday = all(".day-bar-button")[2];
const wednesdayRecord = wednesday.dataset.recordIds.split(",")[0];
wednesday.click();
assert(document.querySelector("#drawer-title").textContent.includes("Jul 29"), "The week drawer opened the wrong date");
assert(document.querySelector("#drawer-body").textContent.includes(wednesdayRecord), "The week drawer lost its source record ID");
click("#drawer-back");

click('[data-mode="month"]');
const monthDay = all(".heatmap button").find((button) => button.dataset.evidenceDate === "2026-07-15");
assert(monthDay, "The expected Month evidence target is missing");
const monthRecord = monthDay.dataset.recordIds;
monthDay.click();
assert(document.querySelector("#drawer-title").textContent.includes("Jul 15"), "The Month drawer opened the wrong date");
assert(document.querySelector("#drawer-body").textContent.includes(monthRecord), "The Month drawer lost its source record ID");
click("#drawer-back");

click('[data-destination="insights"]');
let review = document.querySelector('[data-open="review"]');
assert(review.dataset.evidencePeriod === "2026-06-08/2026-06-14", "The initial Review period is incorrect");
review.click();
assert(document.querySelector("#drawer-body").textContent.includes("WR-20260608"), "The initial Review opened the wrong source");
click("#drawer-back");
click('[data-insights-period="next"]');
review = document.querySelector('[data-open="review"]');
assert(review.dataset.evidencePeriod === "2026-07-27/2026-08-02", "The switched Review period is incorrect");
review.click();
assert(document.querySelector("#drawer-body").textContent.includes("WR-20260727"), "The switched Review opened the wrong source");
click("#drawer-back");

click('[data-destination="today"]');
click("#running-control");
assert(all("[data-select-running]").length === 2, "The Running drawer does not reflect live timers");
click('[data-select-running="course"]');
assert(document.querySelector("#focus-identity .focus-name").textContent.includes("Coursework"), "Selecting a running row did not change foreground");
click("#running-control");
click("[data-choose-activity]");
assert(document.querySelector('[data-select-activity="backend"]').textContent.includes("Running"), "A running Activity is marked Ready");
assert(document.querySelector('[data-select-activity="course"]').textContent.includes("Running"), "A running Activity is marked Ready");
click("#drawer-back");
click("#drawer-back");
click("#running-control");
click('[data-end-running="course"]');
assert(all("[data-select-running]").length === 1, "An ended Activity remained in the Running drawer");
assert(document.querySelector("#focus-identity .focus-name").textContent.includes("Backend"), "Ending foreground did not select a running fallback");
click("#drawer-back");
click("#focus-identity");
assert(all("[data-tracker-toggle]").length === 1, "Tracker must expose exactly one Start/End control");
assert(document.querySelector(".tracker-timer-display").tagName === "DIV", "Tracker time must be read-only");

console.log(JSON.stringify({
  status: "ok",
  checks: [
    "evidence-date-and-record-ids",
    "future-week-exclusion",
    "insights-period-binding",
    "parallel-focus-safety",
    "single-tracker-control",
    "accessible-chart-structure",
  ],
}));
dom.window.close();
