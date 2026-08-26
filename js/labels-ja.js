// labels-ja.js
// 日本語表示 + 初回プロフィール設定 + ローマ字初回設定 + 10/15/30秒モード
// ES5 only: IE11 / Edge 95 IE mode compatible
(function () {
  "use strict";

  var PLAYER_COOKIE = "typ_player";
  var ROMAJI_COOKIE = "typ_romaji";
  var NORMAL_SECONDS_COOKIE = "typ_normal_seconds";
  var nativeRegExpTest = RegExp.prototype.test;
  var selectedSeconds = loadSavedSeconds();
  var runtimeConfigs = [];
  var normalRecordsCache = [];
  var uiReady = false;
  var nameDialogInitial = false;

  function $(id) { return document.getElementById(id); }

  function on(el, eventName, handler) {
    if (!el) { return; }
    if (el.addEventListener) { el.addEventListener(eventName, handler, false); }
    else if (el.attachEvent) { el.attachEvent("on" + eventName, handler); }
  }

  function setText(id, value) {
    var el = $(id);
    if (el) { el.innerText = String(value === null || value === undefined ? "" : value); }
  }

  function hasClass(el, name) {
    return !!el && (" " + el.className + " ").indexOf(" " + name + " ") >= 0;
  }

  function findByClass(root, className) {
    if (!root || !root.getElementsByClassName) { return []; }
    return root.getElementsByClassName(className);
  }

  function normalizeName(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
  }

  function isSixName(value) {
    return nativeRegExpTest.call(/^[A-Z0-9]{6}$/, String(value || "").toUpperCase());
  }

  function loadSavedSeconds() {
    var value = "";
    var n;
    try {
      if (window.Settings && Settings.getCookie) { value = Settings.getCookie(NORMAL_SECONDS_COOKIE); }
      else {
        var target = NORMAL_SECONDS_COOKIE + "=";
        var parts = document.cookie ? document.cookie.split(";") : [];
        var i;
        for (i = 0; i < parts.length; i++) {
          var p = parts[i].replace(/^\s+/, "");
          if (p.indexOf(target) === 0) { value = decodeURIComponent(p.substring(target.length)); break; }
        }
      }
    } catch (e) {}
    n = parseInt(value, 10);
    return n === 15 || n === 30 ? n : 10;
  }

  function saveSeconds(seconds) {
    try {
      if (Settings && Settings.setCookie) { Settings.setCookie(NORMAL_SECONDS_COOKIE, String(seconds), 365); }
    } catch (e) {}
  }

  // app.js の旧プレイヤーコード判定だけを、6文字英数字にも通す。
  // 他の正規表現には影響させない。
  RegExp.prototype.test = function (value) {
    if (this && this.source === "^\\d{3}-[A-Z]{2}$" && isSixName(value)) { return true; }
    return nativeRegExpTest.call(this, value);
  };

  function installSettingsCompatibility() {
    if (!window.Settings) { return; }

    Settings.makePlayerCode = function (nameText) {
      var name = normalizeName(nameText);
      return isSixName(name) ? name : "";
    };

    Settings.savePlayerCode = function (code) {
      var name = normalizeName(code);
      if (!isSixName(name)) { return false; }
      Settings.setCookie(PLAYER_COOKIE, name, 365);
      return true;
    };

    Settings.loadPlayerCode = function () {
      var name = normalizeName(Settings.getCookie(PLAYER_COOKIE));
      return isSixName(name) ? name : "";
    };

    Settings.hasRomajiSaved = function () {
      return !!Settings.getCookie(ROMAJI_COOKIE);
    };
  }

  function installConfigCompatibility() {
    var original;
    if (!window.FileData || !FileData.loadConfig || FileData.__typingDurationWrapped) { return; }
    original = FileData.loadConfig;
    FileData.loadConfig = function (url, success, failure) {
      original(url, function (config) {
        config = config || {};
        config.NORMAL_SECONDS = selectedSeconds;
        runtimeConfigs.push(config);
        if (success) { success(config); }
      }, failure);
    };
    FileData.__typingDurationWrapped = true;
  }

  installSettingsCompatibility();
  installConfigCompatibility();

  function injectStyles() {
    var css = "" +
      ".player-box .player-inputs{display:none!important;}" +
      ".player-name-line{display:table;width:100%;margin:8px 0 10px 0;}" +
      ".player-name-line .player-code{display:table-cell;width:auto;vertical-align:middle;margin:0;font-size:25px;letter-spacing:3px;text-align:left;}" +
      ".player-name-change{display:table-cell;width:78px;vertical-align:middle;margin:0 0 0 8px;padding:7px 8px;border:1px solid #40536c;border-radius:4px;background:#182636;color:#dce8f5;font-size:11px;cursor:pointer;}" +
      ".player-romaji-button{display:block;width:100%;margin:8px 0 0 0;padding:7px 8px;border:1px solid #34485f;border-radius:4px;background:#111d2a;color:#9fb4c9;font-size:11px;cursor:pointer;}" +
      ".normal-time-selector{margin:10px 0 5px 0;padding:9px;border:1px solid #2b3d52;border-radius:5px;background:#0e1721;}" +
      ".normal-time-label{display:inline-block;width:64px;color:#9fb1c4;font-size:11px;font-weight:bold;}" +
      ".normal-time-button{display:inline-block;width:26%;height:32px;margin:0 1% 0 0;border:1px solid #3b4d63;border-radius:4px;background:#172433;color:#b8c8d9;font-size:12px;font-weight:bold;cursor:pointer;}" +
      ".normal-time-button.selected{border-color:#61bce6;background:#17415a;color:#e8f8ff;}" +
      ".player-name-dialog{display:none;position:fixed;z-index:9999;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,.72);}" +
      ".player-name-dialog-panel{width:360px;max-width:88%;margin:14vh auto 0 auto;padding:20px;border:1px solid #4a617d;border-radius:7px;background:#111b27;color:#eaf2fa;text-align:center;box-shadow:0 12px 45px rgba(0,0,0,.55);}" +
      ".player-name-dialog-panel h2{margin:0 0 8px 0;font-size:20px;}" +
      ".player-name-dialog-panel p{margin:6px 0 12px 0;color:#a5b6c8;font-size:12px;}" +
      ".player-name-dialog-input{box-sizing:border-box;width:100%;height:46px;padding:8px 10px;border:1px solid #52708e;border-radius:5px;background:#08111b;color:#fff;font-size:24px;font-weight:bold;letter-spacing:4px;text-align:center;text-transform:uppercase;}" +
      ".player-name-dialog-message{min-height:22px;margin:7px 0;color:#ff9e9e;font-size:11px;}" +
      ".player-name-dialog-buttons button{min-width:110px;margin:4px;padding:8px 10px;border-radius:4px;cursor:pointer;}" +
      ".player-name-dialog-save{border:1px solid #4aa7d6;background:#1a607f;color:#fff;}" +
      ".player-name-dialog-cancel{border:1px solid #405066;background:#17202b;color:#b8c4d1;}" +
      ".result-duration-label{margin:4px 0 6px 0;color:#9fc4dc;font-size:13px;font-weight:bold;letter-spacing:1px;}" +
      ".home-tools-actions #btnSettings{display:none!important;}" +
      ".home-tools-actions #btnRetryAll{float:none!important;width:100%!important;margin-left:0!important;}";
    var style = document.createElement("style");
    style.type = "text/css";
    if (style.styleSheet) { style.styleSheet.cssText = css; }
    else { style.appendChild(document.createTextNode(css)); }
    document.getElementsByTagName("head")[0].appendChild(style);
  }

  function setupPlayerCard() {
    var box = findByClass(document, "player-box")[0];
    var title;
    var display;
    var line;
    var change;
    var romaji;
    var inputs;
    if (!box || $("btnChangePlayerName")) { return; }

    title = box.getElementsByTagName("h2")[0];
    if (title) { title.innerText = "名前"; }

    display = $("playerCodeDisplay");
    if (!display) { return; }

    inputs = findByClass(box, "player-inputs")[0];
    if (inputs) { inputs.style.display = "none"; }

    line = document.createElement("div");
    line.className = "player-name-line";
    display.parentNode.insertBefore(line, display);
    line.appendChild(display);

    change = document.createElement("button");
    change.id = "btnChangePlayerName";
    change.type = "button";
    change.className = "player-name-change";
    change.innerText = "変更";
    line.appendChild(change);

    romaji = document.createElement("button");
    romaji.id = "btnRomajiQuick";
    romaji.type = "button";
    romaji.className = "player-romaji-button";
    romaji.innerText = "ローマ字入力設定";
    line.parentNode.insertBefore(romaji, line.nextSibling);

    on(change, "click", function () { openNameDialog(false); });
    on(romaji, "click", function () {
      var original = $("btnSettings");
      if (original && original.onclick) { original.onclick(); }
      else if (original && original.click) { original.click(); }
    });

    updatePlayerNameDisplay();
  }

  function createNameDialog() {
    var overlay;
    var panel;
    var html;
    if ($("playerNameDialog")) { return; }
    overlay = document.createElement("div");
    overlay.id = "playerNameDialog";
    overlay.className = "player-name-dialog";
    panel = document.createElement("div");
    panel.className = "player-name-dialog-panel";
    html = "" +
      "<h2>名前を入力</h2>" +
      "<p>英数字6文字で入力してください。</p>" +
      "<input id=\"playerNameDialogInput\" class=\"player-name-dialog-input\" type=\"text\" maxlength=\"6\" autocomplete=\"off\">" +
      "<div id=\"playerNameDialogMessage\" class=\"player-name-dialog-message\"></div>" +
      "<div class=\"player-name-dialog-buttons\">" +
        "<button id=\"btnPlayerNameDialogSave\" type=\"button\" class=\"player-name-dialog-save\">決定</button>" +
        "<button id=\"btnPlayerNameDialogCancel\" type=\"button\" class=\"player-name-dialog-cancel\">キャンセル</button>" +
      "</div>";
    panel.innerHTML = html;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    on($("playerNameDialogInput"), "keyup", function () {
      var input = $("playerNameDialogInput");
      var fixed = normalizeName(input.value);
      if (input.value !== fixed) { input.value = fixed; }
      setText("playerNameDialogMessage", "");
    });
    on($("btnPlayerNameDialogSave"), "click", saveNameFromDialog);
    on($("btnPlayerNameDialogCancel"), "click", function () {
      if (!nameDialogInitial) { closeNameDialog(); }
    });
  }

  function openNameDialog(initial) {
    var overlay = $("playerNameDialog");
    var input = $("playerNameDialogInput");
    var cancel = $("btnPlayerNameDialogCancel");
    var current = Settings.loadPlayerCode();
    nameDialogInitial = !!initial;
    if (!overlay || !input || !cancel) { return; }
    input.value = current;
    cancel.style.display = nameDialogInitial ? "none" : "inline-block";
    setText("playerNameDialogMessage", "");
    overlay.style.display = "block";
    window.setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 30);
  }

  function closeNameDialog() {
    var overlay = $("playerNameDialog");
    if (overlay) { overlay.style.display = "none"; }
  }

  function updatePlayerNameDisplay() {
    var name = Settings.loadPlayerCode();
    setText("playerCodeDisplay", name || "------");
    setText("recordPlayer", name || "---");
  }

  function saveNameFromDialog() {
    var input = $("playerNameDialogInput");
    var name = normalizeName(input ? input.value : "");
    var legacyName = $("playerNumber");
    var legacyNick = $("playerNick");
    var saveButton = $("btnSavePlayer");
    if (!isSixName(name)) {
      setText("playerNameDialogMessage", "英数字6文字で入力してください。");
      return;
    }

    if (legacyName) { legacyName.value = name; }
    if (legacyNick) { legacyNick.value = ""; }

    if (saveButton && saveButton.onclick) { saveButton.onclick(); }
    else { Settings.savePlayerCode(name); }

    closeNameDialog();
    updatePlayerNameDisplay();

    window.setTimeout(function () {
      updatePlayerNameDisplay();
      loadNormalRecords();
    }, 1250);

    if (!Settings.hasRomajiSaved()) {
      window.setTimeout(openRomajiSettings, 250);
    }
  }

  function openRomajiSettings() {
    var button = $("btnSettings");
    if (button && button.onclick) { button.onclick(); }
    else if (button && button.click) { button.click(); }
  }

  function enforceFirstRomajiSetup() {
    var back = $("btnSettingsBack");
    var originalBack;
    if (!back || back.__firstSetupWrapped) { return; }
    originalBack = back.onclick;
    back.onclick = function () {
      if (!Settings.hasRomajiSaved()) {
        window.alert("最初にローマ字入力設定を保存してください。");
        return;
      }
      if (originalBack) { originalBack(); }
    };
    back.__firstSetupWrapped = true;
  }

  function createDurationSelector() {
    var menu = findByClass(document, "menu-buttons")[0];
    var box;
    var label;
    var seconds = [10, 15, 30];
    var i;
    var button;
    if (!menu || $("normalTimeSelector")) { return; }
    box = document.createElement("div");
    box.id = "normalTimeSelector";
    box.className = "normal-time-selector";
    label = document.createElement("span");
    label.className = "normal-time-label";
    label.innerText = "タイム";
    box.appendChild(label);
    for (i = 0; i < seconds.length; i++) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "normal-time-button";
      button.setAttribute("data-seconds", String(seconds[i]));
      button.innerText = seconds[i] + "秒";
      on(button, "click", durationButtonClick);
      box.appendChild(button);
    }
    menu.parentNode.insertBefore(box, menu);
    applyDurationUi();
  }

  function durationButtonClick(e) {
    var button = e ? (e.currentTarget || e.srcElement) : null;
    var seconds = button ? parseInt(button.getAttribute("data-seconds"), 10) : 10;
    setSelectedSeconds(seconds);
  }

  function setSelectedSeconds(seconds) {
    var i;
    if (seconds !== 10 && seconds !== 15 && seconds !== 30) { seconds = 10; }
    selectedSeconds = seconds;
    saveSeconds(seconds);
    for (i = 0; i < runtimeConfigs.length; i++) {
      runtimeConfigs[i].NORMAL_SECONDS = seconds;
    }
    applyDurationUi();
    renderMyDurationBests();
    if (selectedTabName() === "score") { renderDurationScoreRanking(); }
  }

  function applyDurationUi() {
    var selector = $("normalTimeSelector");
    var buttons;
    var i;
    var sec;
    if (selector) {
      buttons = selector.getElementsByTagName("button");
      for (i = 0; i < buttons.length; i++) {
        sec = parseInt(buttons[i].getAttribute("data-seconds"), 10);
        buttons[i].className = sec === selectedSeconds ? "normal-time-button selected" : "normal-time-button";
      }
    }
    setText("normalModeLabel", selectedSeconds + "秒スコアアタック");
    setText("rankingCondition", selectedSeconds + "秒");
    setText("resultModeLabel", selectedSeconds + "秒タイピング");
  }

  function createResultDurationLabel() {
    var score = $("resultScore");
    var label;
    if (!score || $("resultModeLabel")) { return; }
    label = document.createElement("div");
    label.id = "resultModeLabel";
    label.className = "result-duration-label";
    score.parentNode.insertBefore(label, score);
    applyDurationUi();
  }

  function ensureDurationRecordRows() {
    var best10 = $("recordBestScore");
    var row10;
    var row15;
    var row30;
    var span;
    var strong;
    if (!best10) { return; }
    row10 = best10.parentNode;
    if (row10 && row10.getElementsByTagName("span").length) {
      row10.getElementsByTagName("span")[0].innerText = "10秒最高";
    }
    if (!$("recordBest15")) {
      row15 = document.createElement("div");
      row15.className = "record-summary-row";
      span = document.createElement("span"); span.innerText = "15秒最高";
      strong = document.createElement("strong"); strong.id = "recordBest15"; strong.innerText = "0";
      row15.appendChild(span); row15.appendChild(strong);
      row10.parentNode.insertBefore(row15, row10.nextSibling);
    }
    if (!$("recordBest30")) {
      row30 = document.createElement("div");
      row30.className = "record-summary-row";
      span = document.createElement("span"); span.innerText = "30秒最高";
      strong = document.createElement("strong"); strong.id = "recordBest30"; strong.innerText = "0";
      row30.appendChild(span); row30.appendChild(strong);
      row15 = $("recordBest15").parentNode;
      row15.parentNode.insertBefore(row30, row15.nextSibling);
    }
  }

  function selectedTabName() {
    if (hasClass($("rankTabExp"), "selected")) { return "exp"; }
    if (hasClass($("rankTabPlay"), "selected")) { return "play"; }
    if (hasClass($("rankTabOfficial"), "selected")) { return "official"; }
    return "score";
  }

  function translateStaticLabels() {
    var card = findByClass(document, "home-ranking-card")[0];
    var titles;
    var rows;
    var i;
    var labels = ["プレイヤー", "10秒最高", "15秒最高", "30秒最高", "経験値", "プレイ回数", "公式ベスト"];
    if (!card) { return; }

    titles = findByClass(card, "home-card-title");
    if (titles.length && titles[0].firstChild) {
      titles[0].firstChild.nodeValue = "記録・ランキング\n                ";
    }
    setText("rankTabScore", "スコア");
    setText("rankTabExp", "経験値");
    setText("rankTabPlay", "プレイ回数");
    setText("rankTabOfficial", "公式");

    titles = findByClass(card, "record-summary-title");
    if (titles.length) { titles[0].innerText = "自分の記録"; }

    ensureDurationRecordRows();
    rows = findByClass(card, "record-summary-row");
    for (i = 0; i < rows.length && i < labels.length; i++) {
      if (rows[i].getElementsByTagName("span").length) {
        rows[i].getElementsByTagName("span")[0].innerText = labels[i];
      }
    }
  }

  function translateDynamicLabels() {
    var tab = selectedTabName();
    var titleMap = {
      score: "通常スコア 上位5名",
      exp: "経験値 上位5名",
      play: "プレイ回数 上位5名",
      official: "公式タイピング 上位5名"
    };
    var condition = $("rankingCondition");
    var list = $("rankingList");
    var value;
    setText("rankingTitle", titleMap[tab] || titleMap.score);
    if (tab === "score") { setText("rankingCondition", selectedSeconds + "秒"); }
    if (condition) {
      value = condition.innerText || condition.textContent || "";
      if (value === "累計EXP") { condition.innerText = "累計経験値"; }
    }
    if (list && tab === "exp") {
      value = list.innerHTML;
      if (value.indexOf(" EXP") >= 0) { list.innerHTML = value.replace(/ EXP/g, " 経験値"); }
    }
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function recordMatchesSeconds(item, seconds) {
    var mode = String(item.Mode || "").toUpperCase();
    if (!mode) { return seconds === 10; }
    return mode === String(seconds) + "SEC";
  }

  function itemIdentity(item) {
    var client = String(item.ClientId || "");
    var title = normalizeName(item.Title || "");
    if (client) { return "client:" + client; }
    return "name:" + title;
  }

  function currentIdentity() {
    var client = "";
    try { client = Settings.getClientId(); } catch (e) {}
    return client ? "client:" + client : "name:" + Settings.loadPlayerCode();
  }

  function loadNormalRecords() {
    var config = runtimeConfigs.length ? runtimeConfigs[0] : null;
    var listName = config ? (config.NORMAL_RECORD_LIST || "normalrecords") : "normalrecords";
    if (!window.SP || !SP.load) { return; }
    SP.load(listName, ["Id", "Title", "ClientId", "Score", "Accuracy", "Mode", "PlayDate"], function (items) {
      normalRecordsCache = items || [];
      renderMyDurationBests();
      if (selectedTabName() === "score") { renderDurationScoreRanking(); }
    }, function () {});
  }

  function getMyBest(seconds) {
    var key = currentIdentity();
    var best = 0;
    var i;
    var score;
    for (i = 0; i < normalRecordsCache.length; i++) {
      if (itemIdentity(normalRecordsCache[i]) !== key) { continue; }
      if (!recordMatchesSeconds(normalRecordsCache[i], seconds)) { continue; }
      score = parseFloat(normalRecordsCache[i].Score);
      if (!isNaN(score) && score > best) { best = score; }
    }
    return Math.round(best);
  }

  function renderMyDurationBests() {
    var best10 = getMyBest(10);
    var best15 = getMyBest(15);
    var best30 = getMyBest(30);
    var selectedBest = selectedSeconds === 15 ? best15 : (selectedSeconds === 30 ? best30 : best10);
    setText("recordBestScore", best10);
    setText("recordBest15", best15);
    setText("recordBest30", best30);
    setText("homeBest", selectedSeconds + "秒 BEST SCORE " + selectedBest);
  }

  function renderDurationScoreRanking() {
    var bestByPlayer = {};
    var list = [];
    var currentKey = currentIdentity();
    var currentName = Settings.loadPlayerCode();
    var listEl = $("rankingList");
    var i;
    var item;
    var key;
    var score;
    var accuracy;
    var old;
    var html = "";
    var position = 0;
    if (!listEl) { return; }

    for (i = 0; i < normalRecordsCache.length; i++) {
      item = normalRecordsCache[i];
      if (!recordMatchesSeconds(item, selectedSeconds)) { continue; }
      key = itemIdentity(item);
      score = parseFloat(item.Score);
      accuracy = parseFloat(item.Accuracy);
      if (isNaN(score)) { score = 0; }
      if (isNaN(accuracy)) { accuracy = 0; }
      old = bestByPlayer[key];
      if (!old || score > old.score || (score === old.score && accuracy > old.accuracy)) {
        bestByPlayer[key] = {
          key: key,
          code: key === currentKey && currentName ? currentName : normalizeName(item.Title || ""),
          score: score,
          accuracy: accuracy
        };
      }
    }

    for (key in bestByPlayer) {
      if (bestByPlayer.hasOwnProperty(key)) { list.push(bestByPlayer[key]); }
    }
    list.sort(function (a, b) {
      if (a.score !== b.score) { return b.score - a.score; }
      if (a.accuracy !== b.accuracy) { return b.accuracy - a.accuracy; }
      return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0);
    });

    setText("rankingTitle", "通常スコア 上位5名");
    setText("rankingCondition", selectedSeconds + "秒");

    if (!list.length) {
      listEl.innerHTML = '<div class="ranking-empty">まだ記録がありません</div>';
      setText("rankingMyPosition", "あなたの順位：記録なし");
      return;
    }

    for (i = 0; i < list.length && i < 5; i++) {
      html += '<div class="ranking-row">' +
        '<span class="ranking-pos">' + (i + 1) + '位</span>' +
        '<span class="ranking-player">' + escapeHtml(list[i].code || "------") + '</span>' +
        '<span class="ranking-value">' + Math.round(list[i].score) + ' pt</span>' +
        '<div class="clear"></div></div>';
    }
    listEl.innerHTML = html;

    for (i = 0; i < list.length; i++) {
      if (list[i].key === currentKey) { position = i + 1; break; }
    }
    if (position) { setText("rankingMyPosition", "あなたの順位：" + position + "位 / " + list.length + "人"); }
    else { setText("rankingMyPosition", "あなたの順位：記録なし"); }
  }

  function applyJapaneseLabels() {
    translateStaticLabels();
    translateDynamicLabels();
    updatePlayerNameDisplay();
    applyDurationUi();
    renderMyDurationBests();
    if (selectedTabName() === "score" && normalRecordsCache.length) { renderDurationScoreRanking(); }
  }

  function bindRankingTabs() {
    var ids = ["rankTabScore", "rankTabExp", "rankTabPlay", "rankTabOfficial"];
    var i;
    var el;
    for (i = 0; i < ids.length; i++) {
      el = $(ids[i]);
      if (!el) { continue; }
      on(el, "click", function () {
        window.setTimeout(function () {
          translateStaticLabels();
          translateDynamicLabels();
          if (selectedTabName() === "score") { renderDurationScoreRanking(); }
        }, 30);
      });
    }
  }

  function bindRefreshPoints() {
    on($("btnNormalHome"), "click", function () { window.setTimeout(loadNormalRecords, 1250); });
    on($("btnSavePlayer"), "click", function () { window.setTimeout(loadNormalRecords, 1250); });
  }

  function firstRunCheck() {
    var name = Settings.loadPlayerCode();
    updatePlayerNameDisplay();
    if (!name) {
      openNameDialog(true);
      return;
    }
    if (!Settings.hasRomajiSaved()) {
      window.setTimeout(openRomajiSettings, 150);
    }
  }

  function setupUiWhenReady(attempt) {
    var home = $("viewHome");
    if (uiReady) { return; }
    if (!home || !hasClass(home, "active-view")) {
      if (attempt < 50) { window.setTimeout(function () { setupUiWhenReady(attempt + 1); }, 200); }
      return;
    }
    uiReady = true;
    injectStyles();
    setupPlayerCard();
    createNameDialog();
    createDurationSelector();
    createResultDurationLabel();
    ensureDurationRecordRows();
    enforceFirstRomajiSetup();
    bindRankingTabs();
    bindRefreshPoints();
    applyJapaneseLabels();
    loadNormalRecords();
    firstRunCheck();
    window.setTimeout(applyJapaneseLabels, 1200);
  }

  if (window.addEventListener) {
    window.addEventListener("load", function () { setupUiWhenReady(0); }, false);
  } else if (window.attachEvent) {
    window.attachEvent("onload", function () { setupUiWhenReady(0); });
  } else {
    window.onload = function () { setupUiWhenReady(0); };
  }
})();
