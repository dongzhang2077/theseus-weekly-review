(function() {
  "use strict";

  var sheetBackdrop = document.getElementById("sheetBackdrop");
  var openSheetId = null;
  var openDetailId = null;
  var suggestionCard = document.getElementById("suggestionCard");
  var suggestionTitle = document.getElementById("suggestionTitle");
  var suggestionMeta = document.getElementById("suggestionMeta");
  var suggestionStatus = document.getElementById("suggestionStatus");
  var applySuggestionBtn = document.getElementById("applySuggestionBtn");
  var dismissSuggestionBtn = document.getElementById("dismissSuggestionBtn");
  var emptyStartBtn = document.getElementById("emptyStartBtn");
  var capacityValue = document.getElementById("capacityValue");
  var bufferValue = document.getElementById("bufferValue");
  var plannedHours = 14;

  function setState(state) {
    document.body.classList.remove("plan-normal", "plan-loading", "plan-empty", "plan-error");
    document.body.classList.add("plan-" + state);
    document.querySelectorAll("[data-plan-state]").forEach(function(btn) {
      btn.classList.toggle("active", btn.getAttribute("data-plan-state") === state);
    });
    if (state !== "normal") {
      closeAllSheets();
      closeAllDetails();
    }
  }

  function openSheet(id) {
    if (!document.body.classList.contains("plan-normal")) return;
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

  document.querySelectorAll("[data-plan-state]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      setState(btn.getAttribute("data-plan-state"));
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

  if (emptyStartBtn) {
    emptyStartBtn.addEventListener("click", function() {
      setState("normal");
      openSheet("focus");
    });
  }

  if (applySuggestionBtn) {
    applySuggestionBtn.addEventListener("click", function() {
      suggestionCard.classList.remove("dismissed");
      suggestionCard.classList.add("applied");
      suggestionTitle.textContent = "Resume planned";
      suggestionMeta.textContent = "Applied to Tue / Thu";
      suggestionStatus.textContent = "Applied";
      window.setTimeout(function() {
        suggestionStatus.textContent = "";
      }, 1400);
    });
  }

  if (dismissSuggestionBtn) {
    dismissSuggestionBtn.addEventListener("click", function() {
      suggestionCard.classList.remove("applied");
      suggestionCard.classList.add("dismissed");
      suggestionTitle.textContent = "Suggestion dismissed";
      suggestionMeta.textContent = "Review source kept";
      suggestionStatus.textContent = "Dismissed";
      window.setTimeout(function() {
        closeSheet("suggestion");
      }, 520);
    });
  }

  document.querySelectorAll(".capacity-chip").forEach(function(chip) {
    chip.addEventListener("click", function() {
      var capacity = Number(chip.getAttribute("data-capacity"));
      var buffer = capacity - plannedHours;
      capacityValue.textContent = capacity + "h";
      bufferValue.textContent = buffer + "h";
      bufferValue.classList.toggle("status-ok", buffer >= 3);
      bufferValue.classList.toggle("status-bad", buffer < 1);
      document.querySelectorAll(".capacity-chip").forEach(function(other) {
        var selected = other === chip;
        other.classList.toggle("selected", selected);
        other.setAttribute("aria-pressed", String(selected));
      });
    });
  });

  document.querySelectorAll("[data-save-plan]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var label = btn.querySelector("span");
      var detail = btn.closest(".detail");
      var status = detail ? detail.querySelector(".detail-save-status") : null;
      btn.classList.add("saved");
      if (label) label.textContent = "Saved";
      if (status) status.textContent = "Saved";
      window.setTimeout(function() {
        btn.classList.remove("saved");
        if (label) label.textContent = "Save";
        if (status) status.textContent = "";
      }, 1400);
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

  setState("normal");
})();
