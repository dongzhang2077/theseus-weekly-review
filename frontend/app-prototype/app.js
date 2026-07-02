(function() {
  "use strict";

  // -------- State definitions --------
  // Each state: body class, character image, character extra class
  var STATES = {
    normal:    { bodyClass: "state-normal",    img: "assets/character-attention.png", alt: "Week needs attention",  charClass: "" },
    loading:   { bodyClass: "state-loading",   img: "assets/character-loading.png",   alt: "Generating review",      charClass: "loading" },
    empty:     { bodyClass: "state-empty",     img: "assets/character-waiting.png",   alt: "Waiting for time logs",  charClass: "" },
    noReview:  { bodyClass: "state-no-review", img: "assets/character-waiting.png",   alt: "Waiting for review",     charClass: "" },
    stale:     { bodyClass: "state-stale",     img: "assets/character-attention.png", alt: "Week needs attention",  charClass: "" },
    error:     { bodyClass: "state-error",     img: "assets/character-attention.png", alt: "Could not load review", charClass: "error" }
  };

  var body = document.body;
  var characterImg = document.getElementById("characterImg");
  var characterBtn = document.getElementById("characterBtn");
  var regenerateBtn = document.getElementById("regenerateBtn");

  // -------- State switching --------
  function setState(name) {
    var prev = STATES[currentState];
    if (prev) body.classList.remove(prev.bodyClass);
    var s = STATES[name];
    if (!s) return;
    body.classList.add(s.bodyClass);
    characterImg.src = s.img;
    characterImg.alt = s.alt;
    characterBtn.className = "character-btn" + (s.charClass ? " " + s.charClass : "");
    currentState = name;

    // Regenerate button only visible in stale state (inside full review sheet)
    regenerateBtn.classList.toggle("hidden", name !== "stale");

    // Close any open sheets/details/bubble when switching state
    closeAllSheets();
    closeAllDetails();
    closeBubble();

    // Update switcher button active states
    var btns = document.querySelectorAll(".switcher-btn");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("active", btns[i].getAttribute("data-state") === name);
    }
  }
  var currentState = "normal";

  document.querySelectorAll(".switcher-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      setState(btn.getAttribute("data-state"));
    });
  });

  // -------- Speech bubble --------
  var bubbleOverlay = document.getElementById("bubbleOverlay");
  function toggleBubble() {
    if (bubbleOverlay.classList.contains("open")) {
      closeBubble();
    } else {
      // Only allow in states that show the character interactively
      if (currentState === "normal" || currentState === "stale") {
        bubbleOverlay.classList.add("open");
      }
    }
  }
  function closeBubble() { bubbleOverlay.classList.remove("open"); }
  characterBtn.addEventListener("click", toggleBubble);
  // Tap outside bubble to dismiss
  bubbleOverlay.addEventListener("click", function(e) {
    if (e.target === bubbleOverlay) closeBubble();
  });

  // -------- Sheets (Level 2) --------
  var sheetBackdrop = document.getElementById("sheetBackdrop");
  var openSheetId = null;

  function openSheet(id) {
    var sheet = document.getElementById("sheet-" + id);
    if (!sheet) return;
    closeBubble();
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
    document.querySelectorAll(".sheet.open").forEach(function(s) {
      s.classList.remove("open");
      s.classList.remove("dragging");
      s.style.transform = "";
    });
    sheetBackdrop.classList.remove("open");
    openSheetId = null;
  }

  // Chapter entry -> open sheet
  document.querySelectorAll(".chapter-entry").forEach(function(btn) {
    btn.addEventListener("click", function() {
      if (btn.disabled) return;
      var id = btn.getAttribute("data-sheet");
      if (openSheetId === id) {
        closeSheet(id);
      } else {
        if (openSheetId) closeSheet(openSheetId);
        openSheet(id);
      }
    });
  });

  // Close buttons
  document.querySelectorAll("[data-close]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var sheet = btn.closest(".sheet");
      if (sheet) closeSheet(sheet.getAttribute("data-sheet-id"));
    });
  });

  // Backdrop tap to close
  sheetBackdrop.addEventListener("click", function() {
    if (openSheetId) closeSheet(openSheetId);
  });

  // -------- Swipe-to-dismiss on sheets --------
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

    handle.addEventListener("pointerup", function(e) {
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

  // -------- Detail sheets (Level 3 — full screen) --------
  var openDetailId = null;

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
    document.querySelectorAll(".detail.open").forEach(function(d) {
      d.classList.remove("open");
    });
    openDetailId = null;
  }

  // List rows -> open detail
  document.querySelectorAll(".list-row[data-detail]").forEach(function(row) {
    row.addEventListener("click", function() {
      openDetail(row.getAttribute("data-detail"));
    });
  });

  // Back buttons
  document.querySelectorAll("[data-back]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var detail = btn.closest(".detail");
      if (detail) {
        var id = detail.id.replace("detail-", "");
        closeDetail(id);
      }
    });
  });

  // ESC key to close topmost layer
  document.addEventListener("keydown", function(e) {
    if (e.key !== "Escape") return;
    if (openDetailId) {
      closeDetail(openDetailId);
    } else if (openSheetId) {
      closeSheet(openSheetId);
    } else if (bubbleOverlay.classList.contains("open")) {
      closeBubble();
    }
  });

  // Initialize
  setState("normal");
})();
