(function() {
  "use strict";

  var sheetBackdrop = document.getElementById("sheetBackdrop");
  var openSheetId = null;
  var openDetailId = null;
  var signalCover = document.getElementById("signalCover");
  var signalCore = document.getElementById("signalCore");
  var signalCoreIcon = document.getElementById("signalCoreIcon");
  var signalStatus = document.getElementById("signalStatus");

  var severityRank = {
    severe: 3,
    attention: 2,
    normal: 1,
    nodata: 0
  };

  var priorityOrder = ["stage", "plan", "goal", "energy"];

  var signals = {
    plan: {
      label: "Plan",
      status: "Plan drift",
      severity: "attention",
      icon: "i-calendar",
      color: "#C18A3A"
    },
    stage: {
      label: "Stage",
      status: "Stage drift",
      severity: "severe",
      icon: "i-layers",
      color: "#B96358"
    },
    goal: {
      label: "Goal",
      status: "Goal aligned",
      severity: "normal",
      icon: "i-target",
      color: "#6F8F6B"
    },
    energy: {
      label: "Energy",
      status: "Energy uneven",
      severity: "attention",
      icon: "i-leaf",
      color: "#C18A3A"
    }
  };

  function severityDotClass(severity) {
    if (severity === "severe") return "red";
    if (severity === "attention") return "amber";
    if (severity === "normal") return "green";
    return "gray";
  }

  function choosePrioritySignal() {
    return priorityOrder.slice().sort(function(a, b) {
      var severityDiff = severityRank[signals[b].severity] - severityRank[signals[a].severity];
      if (severityDiff !== 0) return severityDiff;
      return priorityOrder.indexOf(a) - priorityOrder.indexOf(b);
    })[0];
  }

  function applyPrioritySignal() {
    var priorityId = choosePrioritySignal();
    var priority = signals[priorityId];
    signalCore.style.setProperty("--signal-color", priority.color);
    signalStatus.style.setProperty("--signal-color", priority.color);
    signalCoreIcon.setAttribute("href", "#" + priority.icon);
    signalStatus.textContent = priority.status;
    signalCover.setAttribute("aria-label", priority.label + " signal is the strongest issue");

    Object.keys(signals).forEach(function(id) {
      var signal = signals[id];
      var entry = document.querySelector(".signal-entry." + id);
      if (!entry) return;
      var dot = entry.querySelector(".signal-dot");
      entry.style.setProperty("--signal-color", signal.color);
      entry.classList.remove("severe", "attention", "normal", "nodata", "priority");
      entry.classList.add(signal.severity);
      entry.classList.toggle("priority", id === priorityId);
      entry.setAttribute("aria-label", signal.label + " signal, " + signal.severity);
      if (dot) {
        dot.className = "signal-dot " + severityDotClass(signal.severity);
      }
    });
  }

  function sortSignalRows() {
    document.querySelectorAll(".sheet-body").forEach(function(body) {
      var rows = Array.from(body.querySelectorAll(".list-row[data-detail]"));
      if (rows.length < 2) return;
      rows.sort(function(a, b) {
        var severityDiff = severityRank[b.dataset.severity || "normal"] - severityRank[a.dataset.severity || "normal"];
        if (severityDiff !== 0) return severityDiff;
        var aStage = Number(a.dataset.stagePriority || 99);
        var bStage = Number(b.dataset.stagePriority || 99);
        return aStage - bStage;
      });
      rows.forEach(function(row) {
        body.appendChild(row);
      });
    });
  }

  function setState(state) {
    document.body.classList.remove("signals-normal", "signals-loading", "signals-nodata", "signals-error");
    document.body.classList.add("signals-" + state);
    document.querySelectorAll("[data-signals-state]").forEach(function(btn) {
      btn.classList.toggle("active", btn.getAttribute("data-signals-state") === state);
    });
    if (state !== "normal") {
      closeAllSheets();
      closeAllDetails();
    }
  }

  function openSheet(id) {
    if (!document.body.classList.contains("signals-normal")) return;
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
    sheet.classList.remove("dragging");
    sheet.style.transform = "";
    if (openSheetId === id) {
      sheetBackdrop.classList.remove("open");
      openSheetId = null;
    }
  }

  function closeAllSheets() {
    document.querySelectorAll(".sheet.open").forEach(function(sheet) {
      sheet.classList.remove("open");
      sheet.classList.remove("dragging");
      sheet.style.transform = "";
    });
    sheetBackdrop.classList.remove("open");
    openSheetId = null;
  }

  function openDetail(id) {
    var detail = document.getElementById("detail-" + id);
    if (!detail) return;
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

  document.querySelectorAll("[data-signals-state]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      setState(btn.getAttribute("data-signals-state"));
    });
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

  sheetBackdrop.addEventListener("click", function() {
    if (openSheetId) closeSheet(openSheetId);
  });

  document.querySelectorAll(".sheet").forEach(function(sheet) {
    var handle = sheet.querySelector(".sheet-handle") || sheet.querySelector(".sheet-header");
    if (!handle) return;
    var startY = 0;
    var dragging = false;
    var currentY = 0;

    handle.addEventListener("pointerdown", function(e) {
      if (!sheet.classList.contains("open")) return;
      dragging = true;
      startY = e.clientY;
      sheet.classList.add("dragging");
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener("pointermove", function(e) {
      if (!dragging) return;
      currentY = e.clientY - startY;
      if (currentY < 0) currentY = 0;
      sheet.style.transform = "translateY(" + currentY + "px)";
    });

    handle.addEventListener("pointerup", function() {
      if (!dragging) return;
      dragging = false;
      sheet.classList.remove("dragging");
      if (currentY > 80) {
        closeSheet(sheet.getAttribute("data-sheet-id"));
      } else {
        sheet.style.transform = "";
      }
      currentY = 0;
    });

    handle.addEventListener("pointercancel", function() {
      dragging = false;
      sheet.classList.remove("dragging");
      sheet.style.transform = "";
      currentY = 0;
    });
  });

  document.querySelectorAll(".list-row[data-detail]").forEach(function(row) {
    row.addEventListener("click", function() {
      openDetail(row.getAttribute("data-detail"));
    });
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
    closeAllSheets();
    closeAllDetails();
  });

  sortSignalRows();
  applyPrioritySignal();
  setState("normal");
})();
