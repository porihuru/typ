// ui-fixes.js
// ランキング時間切替 + タイピング中Backspaceのブラウザ戻り防止
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

  function injectStyles() {
    var style;
    var css = "" +
      ".ranking-duration-switch{margin:8px 0 10px 0;padding:6px;border:1px solid #2b3d52;border-radius:5px;background:#0e1721;white-space:nowrap;}" +
      ".ranking-duration-label{display:inline-block;width:54px;color:#9fb1c4;font-size:10px;font-weight:bold;vertical-align:middle;}" +
      ".ranking-duration-button{display:inline-block;width:27%;height:28px;margin:0 1% 0 0;padding:0;border:1px solid #3b4d63;border-radius:4px;background:#172433;color:#b8c8d9;font-size:11px;font-weight:bold;cursor:pointer;vertical-align:middle;}" +
      ".ranking-duration-button.selected{border-color:#61bce6;background:#17415a;color:#e8f8ff;}";

    if ($("rankingDurationStyle")) { return; }
    style = document.createElement("style");
    style.id = "rankingDurationStyle";
    style.type = "text/css";
    if (style.styleSheet) { style.styleSheet.cssText = css; }
    else { style.appendChild(document.createTextNode(css)); }
    document.getElementsByTagName("head")[0].appendChild(style);
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

  function syncRankingDurationButtons() {
    var box = $("rankingDurationSwitch");
    var buttons;
    var current;
    var i;
    var seconds;
    if (!box) { return; }
    current = selectedSeconds();
    buttons = box.getElementsByTagName("button");
    for (i = 0; i < buttons.length; i++) {
      seconds = parseInt(buttons[i].getAttribute("data-seconds"), 10);
      buttons[i].className = seconds === current ? "ranking-duration-button selected" : "ranking-duration-button";
    }
  }

  function rankingDurationClick(e) {
    var button = e ? (e.currentTarget || e.srcElement) : null;
    var seconds = button ? parseInt(button.getAttribute("data-seconds"), 10) : 10;
    var source = findLeftDurationButton(seconds);

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
    bindLeftDurationSync();
    createRankingDurationSwitch();
    syncRankingDurationButtons();

    if ((!$("rankingDurationSwitch") || !$("normalTimeSelector")) && attempt < 50) {
      window.setTimeout(function () { setup(attempt + 1); }, 200);
    }
  }

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
