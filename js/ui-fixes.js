// ui-fixes.js
// ランキング時間切替 + 本人記録互換 + タイピング中Backspaceのブラウザ戻り防止
// ES5 only: IE11 / Edge 95 IE mode compatible
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function hasClass(el, name) {
    return !!el && (" " + el.className + " ").indexOf(" " + name + " ") >= 0;
  }

  function on(el, eventName, handler, capture) {
    if (!el) { return; }
    if (el.addEventListener) {
      el.addEventListener(eventName, handler, !!capture);
    } else if (el.attachEvent) {
      el.attachEvent("on" + eventName, handler);
    }
  }

  function identityName(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/^\s+|\s+$/g, "")
      .toUpperCase();
  }

  function numberValue(value) {
    var n = parseFloat(value);
    return isNaN(n) ? 0 : n;
  }

  function hasColumn(columns, name) {
    var i;
    if (!columns) { return false; }
    for (i = 0; i < columns.length; i++) {
      if (String(columns[i]).toLowerCase() === String(name).toLowerCase()) { return true; }
    }
    return false;
  }

  function currentIdentityInfo() {
    var name = "";
    var clientId = "";
    try {
      if (window.Settings && Settings.loadPlayerCode) { name = identityName(Settings.loadPlayerCode()); }
      if (window.Settings && Settings.getClientId) { clientId = String(Settings.getClientId() || ""); }
    } catch (e) {}
    return { name: name, clientId: clientId };
  }

  function betterPlayerRow(candidate, current) {
    var candidateExp;
    var currentExp;
    var candidatePlays;
    var currentPlays;
    var candidateBest;
    var currentBest;
    if (!current) { return true; }
    candidateExp = numberValue(candidate.EXP);
    currentExp = numberValue(current.EXP);
    if (candidateExp !== currentExp) { return candidateExp > currentExp; }
    candidatePlays = numberValue(candidate.Plays);
    currentPlays = numberValue(current.Plays);
    if (candidatePlays !== currentPlays) { return candidatePlays > currentPlays; }
    candidateBest = numberValue(candidate.BestScore);
    currentBest = numberValue(current.BestScore);
    if (candidateBest !== currentBest) { return candidateBest > currentBest; }
    return numberValue(candidate.Id) > numberValue(current.Id);
  }

  function normalizeCurrentPlayerRows(items, info) {
    var best = null;
    var result = [];
    var i;
    var item;
    var name;

    if (!info.name || !info.clientId || !items || !items.length) { return items || []; }

    for (i = 0; i < items.length; i++) {
      item = items[i];
      name = identityName(item.Title || "");
      if (name === info.name) {
        if (betterPlayerRow(item, best)) { best = item; }
      }
    }

    if (!best) { return items; }

    for (i = 0; i < items.length; i++) {
      item = items[i];
      name = identityName(item.Title || "");
      if (name === info.name) {
        if (item === best) {
          item.ClientId = info.clientId;
          item.Title = info.name;
          result.push(item);
        }
        continue;
      }
      result.push(item);
    }
    return result;
  }

  function normalizeCurrentNormalRecords(items, info) {
    var i;
    var item;
    var name;
    var client;
    if (!info.name || !info.clientId || !items || !items.length) { return items || []; }

    for (i = 0; i < items.length; i++) {
      item = items[i];
      name = identityName(item.Title || "");
      client = String(item.ClientId || "");
      if (name === info.name || client === info.clientId) {
        item.ClientId = info.clientId;
      }
    }
    return items;
  }

  function installRecordIdentityCompatibility() {
    var originalLoad;
    if (!window.SP || !SP.load || SP.__recordIdentityWrapped) { return; }

    originalLoad = SP.load;
    SP.load = function (listName, columns, success, failure) {
      originalLoad.call(SP, listName, columns, function (items) {
        var info = currentIdentityInfo();
        var fixed = items || [];

        if (hasColumn(columns, "EXP") && hasColumn(columns, "Plays") && hasColumn(columns, "BestScore")) {
          fixed = normalizeCurrentPlayerRows(fixed, info);
        } else if (hasColumn(columns, "Score") && hasColumn(columns, "Accuracy") && hasColumn(columns, "Mode") && hasColumn(columns, "ClientId")) {
          fixed = normalizeCurrentNormalRecords(fixed, info);
        }

        if (success) { success(fixed); }
      }, failure);
    };
    SP.__recordIdentityWrapped = true;
  }

  function injectStyles() {
    var style;
    var css = "" +
      ".ranking-duration-switch{margin:8px 0 10px 0;padding:6px;border:1px solid #2b3d52;border-radius:5px;background:#0e1721;white-space:nowrap;}" +
      ".ranking-duration-switch.disabled{opacity:.48;}" +
      ".ranking-duration-label{display:inline-block;width:54px;color:#9fb1c4;font-size:10px;font-weight:bold;vertical-align:middle;}" +
      ".ranking-duration-button{display:inline-block;width:27%;height:28px;margin:0 1% 0 0;padding:0;border:1px solid #3b4d63;border-radius:4px;background:#172433;color:#b8c8d9;font-size:11px;font-weight:bold;cursor:pointer;vertical-align:middle;}" +
      ".ranking-duration-button.selected{border-color:#61bce6;background:#17415a;color:#e8f8ff;}" +
      ".ranking-duration-button:disabled{cursor:default;color:#718092;background:#111923;border-color:#283747;}";

    if ($("rankingDurationStyle")) { return; }
    style = document.createElement("style");
    style.id = "rankingDurationStyle";
    style.type = "text/css";
    if (style.styleSheet) { style.styleSheet.cssText = css; }
    else { style.appendChild(document.createTextNode(css)); }
    document.getElementsByTagName("head")[0].appendChild(style);
  }

  function renameTypingGame() {
    var headings = document.getElementsByTagName("h1");
    var i;
    var value;
    document.title = "タイピング練習";
    for (i = 0; i < headings.length; i++) {
      value = headings[i].innerText || headings[i].textContent || "";
      if (value === "タイピングゲーム") {
        headings[i].innerText = "タイピング練習";
      }
    }
  }

  function findLeftDurationButton(seconds) {
    var selector = $("normalTimeSelector");
    var buttons;
    var i;
    if (!selector) { return null; }
    buttons = selector.getElementsByTagName("button");
    for (i = 0; i < buttons.length; i++) {
      if (parseInt(buttons[i].getAttribute("data-seconds"), 10) === seconds) {
        return buttons[i];
      }
    }
    return null;
  }

  function selectedSeconds() {
    var values = [10, 15, 30];
    var i;
    var button;
    for (i = 0; i < values.length; i++) {
      button = findLeftDurationButton(values[i]);
      if (button && hasClass(button, "selected")) { return values[i]; }
    }
    return 10;
  }

  function scoreTabIsActive() {
    return hasClass($("rankTabScore"), "selected");
  }

  function syncRankingDurationButtons() {
    var box = $("rankingDurationSwitch");
    var buttons;
    var current;
    var active;
    var i;
    var seconds;
    if (!box) { return; }

    current = selectedSeconds();
    active = scoreTabIsActive();
    box.className = active ? "ranking-duration-switch" : "ranking-duration-switch disabled";
    buttons = box.getElementsByTagName("button");

    for (i = 0; i < buttons.length; i++) {
      seconds = parseInt(buttons[i].getAttribute("data-seconds"), 10);
      buttons[i].disabled = !active;
      if (active && seconds === current) {
        buttons[i].className = "ranking-duration-button selected";
      } else {
        buttons[i].className = "ranking-duration-button";
      }
    }
  }

  function rankingDurationClick(e) {
    var button;
    var seconds;
    var source;

    if (!scoreTabIsActive()) { return; }

    button = e ? (e.currentTarget || e.srcElement) : null;
    seconds = button ? parseInt(button.getAttribute("data-seconds"), 10) : 10;
    source = findLeftDurationButton(seconds);

    if (source) {
      if (source.click) { source.click(); }
      else if (source.onclick) { source.onclick(); }
    }

    window.setTimeout(syncRankingDurationButtons, 20);
    window.setTimeout(syncRankingDurationButtons, 300);
  }

  function createRankingDurationSwitch() {
    var tabs = document.getElementsByClassName ? document.getElementsByClassName("ranking-tabs")[0] : null;
    var box;
    var label;
    var values = [10, 15, 30];
    var i;
    var button;

    if (!tabs || $("rankingDurationSwitch")) { return false; }

    box = document.createElement("div");
    box.id = "rankingDurationSwitch";
    box.className = "ranking-duration-switch";

    label = document.createElement("span");
    label.className = "ranking-duration-label";
    label.innerText = "時間別";
    box.appendChild(label);

    for (i = 0; i < values.length; i++) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "ranking-duration-button";
      button.setAttribute("data-seconds", String(values[i]));
      button.innerText = values[i] + "秒";
      on(button, "click", rankingDurationClick, false);
      box.appendChild(button);
    }

    tabs.parentNode.insertBefore(box, tabs.nextSibling);
    syncRankingDurationButtons();
    return true;
  }

  function bindLeftDurationSync() {
    var selector = $("normalTimeSelector");
    var buttons;
    var i;
    if (!selector || selector.__rankingSyncBound) { return; }
    buttons = selector.getElementsByTagName("button");
    for (i = 0; i < buttons.length; i++) {
      on(buttons[i], "click", function () {
        window.setTimeout(syncRankingDurationButtons, 20);
      }, false);
    }
    selector.__rankingSyncBound = true;
  }

  function bindRankingTabSync() {
    var ids = ["rankTabScore", "rankTabExp", "rankTabPlay", "rankTabOfficial"];
    var i;
    var tab;
    for (i = 0; i < ids.length; i++) {
      tab = $(ids[i]);
      if (!tab || tab.__durationActiveBound) { continue; }
      on(tab, "click", function () {
        window.setTimeout(syncRankingDurationButtons, 20);
        window.setTimeout(syncRankingDurationButtons, 150);
      }, false);
      tab.__durationActiveBound = true;
    }
  }

  function gameIsActive() {
    return hasClass($("viewNormalGame"), "active-view") || hasClass($("viewOfficialGame"), "active-view");
  }

  function preventBackspaceNavigation(e) {
    var code;
    e = e || window.event;
    code = e.which || e.keyCode || 0;
    if (code !== 8 && e.key !== "Backspace") { return; }
    if (!gameIsActive()) { return; }

    if (e.preventDefault) { e.preventDefault(); }
    e.returnValue = false;
    if (e.stopPropagation) { e.stopPropagation(); }
    e.cancelBubble = true;
    return false;
  }

  function setup(attempt) {
    injectStyles();
    renameTypingGame();
    bindLeftDurationSync();
    bindRankingTabSync();
    createRankingDurationSwitch();
    syncRankingDurationButtons();

    if ((!$("rankingDurationSwitch") || !$("normalTimeSelector")) && attempt < 50) {
      window.setTimeout(function () { setup(attempt + 1); }, 200);
    }
  }

  // app.js/home.js/labels-ja.js がSharePointを読む前に本人記録の互換処理を入れる。
  installRecordIdentityCompatibility();

  // capture=trueで、IE系ブラウザの履歴戻り処理より先にBackspaceを無効化する。
  on(document, "keydown", preventBackspaceNavigation, true);

  if (window.addEventListener) {
    window.addEventListener("load", function () { setup(0); }, false);
  } else if (window.attachEvent) {
    window.attachEvent("onload", function () { setup(0); });
  } else {
    window.onload = function () { setup(0); };
  }
})();