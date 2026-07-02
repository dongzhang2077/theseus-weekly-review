(function() {
  "use strict";

  var sheetBackdrop = document.getElementById("sheetBackdrop");
  var openSheetId = null;
  var openDetailId = null;
  var timerDisplay = document.getElementById("timerDisplay");
  var focusButton = document.getElementById("timerFocus");
  var recommendedActivity = document.getElementById("recommendedActivity");
  var timerButton = document.getElementById("timerToggle");
  var timerIcon = document.getElementById("timerToggleIcon");
  var timerState = document.getElementById("timerState");
  var focusIcon = document.getElementById("focusIcon");
  var focusTitle = document.getElementById("focusTitle");
  var focusMeta = document.getElementById("focusMeta");
  var totalValue = document.getElementById("totalValue");
  var detailTitle = document.getElementById("activityDetailTitle");
  var detailEnergy = document.getElementById("activityDetailEnergy");
  var detailCategory = document.getElementById("activityDetailCategory");
  var detailColor = document.getElementById("activityDetailColor");
  var detailDuration = document.getElementById("activityDetailDuration");
  var detailNote = document.getElementById("activityDetailNote");
  var runningActivities = new Set(["frontend"]);
  var sessionElapsed = { frontend: 0 };
  var userFocusId = null;
  var focusActivityId = "frontend";
  var detailActivityId = "frontend";
  var intervalId = null;

  var energyRank = {
    destroy: 4,
    consume: 3,
    neutral: 2,
    restore: 1
  };

  var activities = {
    frontend: {
      name: "Frontend build block",
      category: "Project",
      kind: "Build",
      icon: "i-code",
      color: "#6F8F6B",
      soft: "rgba(231, 240, 227, 0.74)",
      energy: "consume",
      elapsed: 42 * 60 + 15,
      note: "Built the app-first tracker prototype and checked the tab timing flow."
    },
    backend: {
      name: "Backend polish",
      category: "Project",
      kind: "API",
      icon: "i-briefcase",
      color: "#6F8FAF",
      soft: "rgba(230, 237, 245, 0.74)",
      energy: "neutral",
      elapsed: 24 * 60,
      note: "Reviewed API shape and left small cleanup for the next backend pass."
    },
    research: {
      name: "Research notes",
      category: "Study",
      kind: "Reading",
      icon: "i-book-open",
      color: "#C18A3A",
      soft: "rgba(245, 232, 208, 0.74)",
      energy: "consume",
      elapsed: 55 * 60,
      note: "Collected UX review notes and converted them into screen-level constraints."
    },
    health: {
      name: "Health walk",
      category: "Health",
      kind: "Recovery",
      icon: "i-leaf",
      color: "#7E9C78",
      soft: "rgba(231, 240, 227, 0.66)",
      energy: "restore",
      elapsed: 45 * 60,
      note: "Short walk block to reset attention before the next coding session."
    }
  };

  function formatTimer(totalSeconds) {
    var h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    var m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    var s = String(totalSeconds % 60).padStart(2, "0");
    return h + ":" + m + ":" + s;
  }

  function formatShort(totalSeconds) {
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    if (h <= 0) return m + "m";
    if (m <= 0) return h + "h";
    return h + "h " + m + "m";
  }

  function formatLive(totalSeconds) {
    var h = Math.floor(totalSeconds / 3600);
    var m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    var s = String(totalSeconds % 60).padStart(2, "0");
    if (h <= 0) return m + ":" + s;
    return h + ":" + m + ":" + s;
  }

  function totalSeconds() {
    return Object.keys(activities).reduce(function(total, id) {
      return total + activities[id].elapsed + (sessionElapsed[id] || 0);
    }, 0);
  }

  function chooseFocusActivity() {
    if (userFocusId && runningActivities.has(userFocusId)) return userFocusId;
    var runningIds = Array.from(runningActivities);
    if (runningIds.length === 1) return runningIds[0];
    if (runningIds.length > 1) {
      return runningIds.slice().sort(function(a, b) {
        var rankDiff = energyRank[activities[b].energy] - energyRank[activities[a].energy];
        if (rankDiff !== 0) return rankDiff;
        return (sessionElapsed[b] || 0) - (sessionElapsed[a] || 0);
      })[0];
    }
    return "frontend";
  }

  function syncTicker() {
    if (runningActivities.size > 0 && !intervalId) {
      intervalId = window.setInterval(function() {
        runningActivities.forEach(function(id) {
          sessionElapsed[id] = (sessionElapsed[id] || 0) + 1;
        });
        render();
      }, 1000);
    }
    if (runningActivities.size === 0 && intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  }

  function setFocus(id) {
    if (!activities[id]) return;
    userFocusId = id;
    focusActivityId = id;
    render();
  }

  function toggleActivity(id) {
    if (!activities[id]) return;
    if (runningActivities.has(id)) {
      activities[id].elapsed += sessionElapsed[id] || 0;
      delete sessionElapsed[id];
      runningActivities.delete(id);
      if (userFocusId === id) userFocusId = null;
    } else {
      runningActivities.add(id);
      sessionElapsed[id] = 0;
      userFocusId = id;
    }
    syncTicker();
    render();
  }

  function renderFocus(activity) {
    focusButton.style.setProperty("--focus-color", activity.color);
    focusButton.style.setProperty("--focus-soft", activity.soft);
    timerButton.style.setProperty("--focus-color", activity.color);
    timerButton.style.setProperty("--focus-soft", activity.soft);
    recommendedActivity.style.setProperty("--focus-color", activity.color);
    recommendedActivity.style.setProperty("--focus-soft", activity.soft);
    focusIcon.setAttribute("href", "#" + activity.icon);
    focusTitle.textContent = activity.name;
    focusMeta.textContent = runningActivities.has(focusActivityId) ? activity.category + " · " + runningActivities.size + " running" : "Recommended now";
    timerDisplay.textContent = runningActivities.has(focusActivityId) ? formatTimer(sessionElapsed[focusActivityId] || 0) : formatTimer(0);
    totalValue.textContent = formatShort(totalSeconds());
  }

  function renderRows() {
    document.querySelectorAll(".tracker-row[data-activity]").forEach(function(row) {
      var id = row.getAttribute("data-activity");
      var activity = activities[id];
      var isRunning = runningActivities.has(id);
      var isFocus = id === focusActivityId;
      row.style.setProperty("--activity-color", activity.color);
      row.style.setProperty("--activity-soft", activity.soft);
      row.classList.toggle("running", isRunning);
      row.classList.toggle("selected", isFocus);
      row.querySelector(".tracker-time").textContent = isRunning ? formatLive(sessionElapsed[id] || 0) : formatShort(activity.elapsed);
      row.querySelector(".tracker-row-main").setAttribute("aria-pressed", String(isRunning));
    });
  }

  function renderDetail(id) {
    var activity = activities[id];
    if (!activity) return;
    detailActivityId = id;
    detailTitle.textContent = activity.name;
    detailEnergy.textContent = activity.energy;
    detailEnergy.className = "energy-chip " + activity.energy;
    detailCategory.textContent = activity.category + " · " + activity.kind;
    detailColor.style.background = activity.color;
    detailDuration.textContent = formatShort(activity.elapsed + (sessionElapsed[id] || 0));
    detailNote.value = activity.note;
  }

  function render() {
    focusActivityId = chooseFocusActivity();
    var focusActivity = activities[focusActivityId];
    var focusRunning = runningActivities.has(focusActivityId);
    renderFocus(focusActivity);
    renderRows();
    timerState.classList.toggle("running", focusRunning);
    timerButton.setAttribute("aria-label", focusRunning ? "Pause focus activity" : "Start focus activity");
    timerIcon.setAttribute("href", focusRunning ? "#i-pause" : "#i-play");
    document.body.classList.toggle("track-running", focusRunning);
    syncTicker();
  }

  function openSheet(id) {
    var sheet = document.getElementById("sheet-" + id);
    if (!sheet) return;
    closeAllDetails();
    sheetBackdrop.classList.add("open");
    sheet.classList.add("open");
    openSheetId = id;
  }

  function closeSheet(id) {
    var sheet = document.getElementById("sheet-" + id);
    if (!sheet) return;
    sheet.classList.remove("open");
    if (openSheetId === id) {
      sheetBackdrop.classList.remove("open");
      openSheetId = null;
    }
  }

  function closeAllSheets() {
    document.querySelectorAll(".sheet.open").forEach(function(sheet) {
      sheet.classList.remove("open");
    });
    sheetBackdrop.classList.remove("open");
    openSheetId = null;
  }

  function openDetail(id, activityId) {
    var detail = document.getElementById("detail-" + id);
    if (!detail) return;
    if (activityId) renderDetail(activityId);
    detail.classList.add("open");
    openDetailId = id;
  }

  function closeDetail(id) {
    var detail = document.getElementById("detail-" + id);
    if (!detail) return;
    detail.classList.remove("open");
    if (openDetailId === id) openDetailId = null;
  }

  function closeAllDetails() {
    document.querySelectorAll(".detail.open").forEach(function(detail) {
      detail.classList.remove("open");
    });
    openDetailId = null;
  }

  timerButton.addEventListener("click", function() {
    toggleActivity(focusActivityId);
  });

  focusButton.addEventListener("click", function() {
    toggleActivity(focusActivityId);
  });

  recommendedActivity.addEventListener("click", function() {
    setFocus("frontend");
    if (!runningActivities.has("frontend")) toggleActivity("frontend");
  });

  document.querySelectorAll(".tracker-row-main[data-activity-toggle]").forEach(function(mainButton) {
    var longPressTimer = null;
    var suppressNextClick = false;
    var activityId = mainButton.getAttribute("data-activity-toggle");

    mainButton.addEventListener("click", function(event) {
      if (suppressNextClick) {
        event.preventDefault();
        suppressNextClick = false;
        return;
      }
      setFocus(activityId);
      toggleActivity(activityId);
    });

    mainButton.addEventListener("contextmenu", function(event) {
      event.preventDefault();
      openDetail("activity", activityId);
    });

    mainButton.addEventListener("pointerdown", function() {
      longPressTimer = window.setTimeout(function() {
        suppressNextClick = true;
        openDetail("activity", activityId);
      }, 520);
    });

    mainButton.addEventListener("pointerup", function() {
      if (longPressTimer) window.clearTimeout(longPressTimer);
    });

    mainButton.addEventListener("pointerleave", function() {
      if (longPressTimer) window.clearTimeout(longPressTimer);
    });
  });

  document.querySelectorAll("[data-activity-detail]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      openDetail("activity", btn.getAttribute("data-activity-detail"));
    });
  });

  detailNote.addEventListener("input", function() {
    if (activities[detailActivityId]) {
      activities[detailActivityId].note = detailNote.value;
    }
  });

  document.querySelectorAll("[data-sheet]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var id = btn.getAttribute("data-sheet");
      if (openSheetId === id) {
        closeSheet(id);
      } else {
        if (openSheetId) closeSheet(openSheetId);
        openSheet(id);
      }
    });
  });

  document.querySelectorAll("[data-close]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var sheet = btn.closest(".sheet");
      if (sheet) closeSheet(sheet.getAttribute("data-sheet-id"));
    });
  });

  document.querySelectorAll("[data-detail]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      openDetail(btn.getAttribute("data-detail"), focusActivityId);
    });
  });

  sheetBackdrop.addEventListener("click", function() {
    if (openSheetId) closeSheet(openSheetId);
  });

  document.querySelectorAll("[data-back]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var detail = btn.closest(".detail");
      if (detail) closeDetail(detail.id.replace("detail-", ""));
    });
  });

  document.addEventListener("keydown", function(e) {
    if (e.key !== "Escape") return;
    if (openDetailId) {
      closeDetail(openDetailId);
    } else if (openSheetId) {
      closeSheet(openSheetId);
    }
  });

  window.addEventListener("pagehide", function() {
    if (intervalId) window.clearInterval(intervalId);
    closeAllSheets();
    closeAllDetails();
  });

  render();
})();
