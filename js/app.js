// app.js
// playersリスト単独試験版
// 通常タイピングは利用可能。SharePointへの書込はplayersだけに限定する。
// ES5 only: IE11 / Edge 95 IE mode compatible
(function () {
  "use strict";

  var VIEWS = [
    "viewLoading",
    "viewHome",
    "viewNormalGame",
    "viewNormalResult",
    "viewOfficialLogin",
    "viewOfficialReady",
    "viewOfficialGame",
    "viewOfficialResult",
    "viewSettings"
  ];

  var state = {
    config: {},
    normalWords: [],
    romajiSettings: {},
    playerCode: "",
    clientId: "",
    player: {
      itemId: null,
      exp: 0,
      rank: 1,
      plays: 0,
      bestScore: 0
    },
    engine: null,
    mode: "",
    active: false,
    countdownToken: 0,
    timer: null,
    startMs: 0,
    endMs: 0,
    queue: [],
    queueIndex: 0,
    wordHadMiss: false,
    stats: null,
    normalSeconds: 60
  };

  function $(id) {
    return document.getElementById(id);
  }

  function text(id, value) {
    var el = $(id);
    if (el) {
      el.innerText = String(value === null || value === undefined ? "" : value);
    }
  }

  function showView(id) {
    var i;
    var el;
    for (i = 0; i < VIEWS.length; i++) {
      el = $(VIEWS[i]);
      if (el) {
        el.className = el.className.replace(/\s*active-view/g, "");
      }
    }
    el = $(id);
    if (el) {
      el.className += " active-view";
    }
  }

  function setStatus(message) {
    text("statusBar", message || "");
  }

  function numberValue(value, fallback) {
    var n = parseInt(value, 10);
    return isNaN(n) ? fallback : n;
  }

  function setDiag(name, level, status, detail) {
    var row = $("diag-" + name);
    var statusEl = $("diag-" + name + "-status");
    var detailEl = $("diag-" + name + "-detail");

    if (row) {
      row.className = "diag-row diag-" + level;
    }
    if (statusEl) {
      statusEl.innerText = status || "";
    }
    if (detailEl) {
      detailEl.innerText = detail || "";
    }
  }

  function initDiagnostics() {
    setDiag("config", "wait", "確認中", "config/config.txt");
    setDiag("csv", "wait", "確認中", "通常問題CSV");
    setDiag("sp", "wait", "未確認", "SharePoint REST API");
    setDiag("playersread", "wait", "未確認", "players 読込");
    setDiag("playerswrite", "wait", "未確認", "PLAYER保存ボタンで書込試験");
    setDiag("others", "skip", "未接続", "normalrecords / officialrecords / tournament / accesscounter は今回試験しません");
  }

  function getSharePointError(req) {
    var status = req && typeof req.status !== "undefined" ? req.status : 0;
    var message = "";
    var data;

    if (req && req.responseText) {
      try {
        data = JSON.parse(req.responseText);
        if (data && data.error && data.error.message) {
          message = data.error.message.value || data.error.message;
        }
      } catch (e) {
      }
    }

    if (!message) {
      if (status === 0) {
        message = "通信できません。WEB_ROOT、SharePoint上の配置場所、認証状態を確認してください。";
      } else if (status === 400) {
        message = "要求が不正です。playersの列名・内部名を確認してください。";
      } else if (status === 401) {
        message = "SharePointの認証が必要です。";
      } else if (status === 403) {
        message = "権限がありません。playersの閲覧・追加・編集権限を確認してください。";
      } else if (status === 404) {
        message = "見つかりません。WEB_ROOTまたはplayersリスト名を確認してください。";
      } else if (status >= 500) {
        message = "SharePointサーバー側でエラーが発生しました。";
      } else {
        message = req && req.statusText ? req.statusText : "SharePoint通信エラー";
      }
    }

    if (message.length > 180) {
      message = message.substring(0, 180) + "...";
    }

    return "HTTP " + status + " / " + message;
  }

  function resetPlayerState() {
    state.player = {
      itemId: null,
      exp: 0,
      rank: 1,
      plays: 0,
      bestScore: 0
    };
    updateHomePlayer();
  }

  function setPlayerInputs(code) {
    var parts;
    if (!code) {
      return;
    }
    parts = code.split("-");
    if (parts.length === 2) {
      $("playerNumber").value = parts[0];
      $("playerNick").value = parts[1];
    }
  }

  function updateExpBar(barId, exp) {
    var current = GameRules.getRankByExp(exp);
    var next = GameRules.getNextRank(exp);
    var percent;
    var bar = $(barId);

    if (!bar) {
      return;
    }

    if (!next) {
      percent = 100;
    } else {
      percent = ((exp - current.exp) / (next.exp - current.exp)) * 100;
      if (percent < 0) { percent = 0; }
      if (percent > 100) { percent = 100; }
    }

    bar.style.width = percent.toFixed(1) + "%";
  }

  function updateHomePlayer() {
    var rank = GameRules.getRankByExp(state.player.exp);
    state.player.rank = rank.rank;
    text("homeRank", rank.name);
    text("homeExp", state.player.exp);
    text("homeBest", "BEST SCORE " + state.player.bestScore);
    updateExpBar("homeExpBar", state.player.exp);
    text("playerCodeDisplay", state.playerCode || "--- --");
  }

  function applyPlayerItem(item) {
    if (!item) {
      resetPlayerState();
      return;
    }

    state.player.itemId = item.Id;
    state.player.exp = numberValue(item.EXP, 0);
    state.player.plays = numberValue(item.Plays, 0);
    state.player.bestScore = numberValue(item.BestScore, 0);
    state.player.rank = GameRules.getRankByExp(state.player.exp).rank;
    updateHomePlayer();
  }

  function findCurrentPlayer(items) {
    var i;
    for (i = 0; i < items.length; i++) {
      if (String(items[i].ClientId || "") === state.clientId) {
        return items[i];
      }
    }
    return null;
  }

  function testPlayersRead(callback) {
    var listName = state.config.PLAYER_LIST;

    if (!listName) {
      setDiag("playersread", "ng", "NG", "configにPLAYER_LISTがありません。");
      if (callback) { callback(false, []); }
      return;
    }

    setDiag("playersread", "wait", "確認中", listName + " を読み込んでいます...");
    setDiag("sp", "wait", "確認中", SP.api || "SharePoint REST API");

    SP.load(
      listName,
      ["Id", "Title", "ClientId", "EXP", "Rank", "Plays", "BestScore"],
      function (items) {
        var current = findCurrentPlayer(items);
        var detail = listName + " / " + items.length + "件読込成功";

        setDiag("sp", "ok", "OK", SP.api);
        if (state.playerCode && !current) {
          detail += " / この端末のplayerは未登録";
        }
        setDiag("playersread", "ok", "OK", detail);

        if (current) {
          applyPlayerItem(current);
        } else if (state.playerCode) {
          resetPlayerState();
        }

        setStatus("players 読込成功");
        if (callback) { callback(true, items); }
      },
      function (req) {
        var detail = getSharePointError(req);
        setDiag("sp", "ng", "NG", detail + " / API: " + (SP.api || "未設定"));
        setDiag("playersread", "ng", "NG", detail);
        setStatus("playersに接続できません。接続状況の詳細を確認してください。");
        if (callback) { callback(false, []); }
      }
    );
  }

  function playerProfile() {
    return {
      Title: state.playerCode,
      ClientId: state.clientId,
      EXP: state.player.exp,
      Rank: state.player.rank,
      Plays: state.player.plays,
      BestScore: state.player.bestScore
    };
  }

  function writePlayerProfile(done) {
    var listName = state.config.PLAYER_LIST;
    var profile = playerProfile();

    if (!state.playerCode) {
      if (done) { done(false); }
      return;
    }

    setDiag("playerswrite", "wait", "書込中", state.player.itemId ? "既存playerを更新中..." : "playerを追加中...");

    function writeError(req) {
      var detail = getSharePointError(req);
      setDiag("playerswrite", "ng", "NG", detail);
      setStatus("playersへの書込に失敗しました。");
      if (done) { done(false); }
    }

    if (state.player.itemId) {
      SP.update(listName, state.player.itemId, profile, function () {
        setDiag("playerswrite", "ok", "OK", "更新成功 / ID " + state.player.itemId + " / " + state.playerCode);
        setStatus("playersへの更新に成功しました。");
        if (done) { done(true); }
      }, writeError);
      return;
    }

    SP.add(listName, profile, function (result) {
      try {
        if (result && result.d && result.d.Id) {
          state.player.itemId = result.d.Id;
        }
      } catch (e) {
      }
      setDiag("playerswrite", "ok", "OK", "追加成功" + (state.player.itemId ? " / ID " + state.player.itemId : "") + " / " + state.playerCode);
      setStatus("playersへの追加に成功しました。");
      if (done) { done(true); }
    }, writeError);
  }

  function savePlayerFromInputs(showAlert, writeSharePoint) {
    var code = Settings.makePlayerCode($("playerNumber").value, $("playerNick").value);

    if (!code) {
      if (showAlert) {
        window.alert("プレイヤーコードは3桁の数字と英字2文字で入力してください。例：123-AB");
      }
      return false;
    }

    state.playerCode = code;
    Settings.savePlayerCode(code);
    text("playerCodeDisplay", code);
    setPlayerInputs(code);

    if (writeSharePoint) {
      testPlayersRead(function (ok) {
        if (!ok) {
          return;
        }
        writePlayerProfile(function (writeOk) {
          if (writeOk) {
            testPlayersRead();
          }
        });
      });
    }

    return true;
  }

  function ensurePlayer() {
    if (state.playerCode && /^\d{3}-[A-Z]{2}$/.test(state.playerCode)) {
      return true;
    }
    return savePlayerFromInputs(true, false);
  }

  function stopTimer() {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
  }

  function cancelCountdown() {
    state.countdownToken++;
    text("normalCountdown", "");
  }

  function runCountdown(elementId, callback) {
    var token = ++state.countdownToken;
    var value = 3;

    state.active = false;
    text(elementId, value);

    function tick() {
      if (token !== state.countdownToken) {
        return;
      }
      value--;
      if (value > 0) {
        text(elementId, value);
        window.setTimeout(tick, 800);
        return;
      }
      text(elementId, "START!");
      window.setTimeout(function () {
        if (token !== state.countdownToken) {
          return;
        }
        text(elementId, "");
        callback();
      }, 500);
    }

    window.setTimeout(tick, 800);
  }

  function blurInput() {
    try {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    } catch (e) {
    }
  }

  function renderNormalWord() {
    var word = state.engine.word;
    if (!word) {
      return;
    }
    text("normalKanji", word.kanji);
    text("normalKana", word.kana);
    text("normalGuide", state.engine.getGuide());
    text("normalTyped", state.engine.typed);
  }

  function nextNormalWord() {
    if (state.queueIndex >= state.queue.length) {
      state.queue = GameRules.shuffle(state.queue);
      state.queueIndex = 0;
    }

    state.wordHadMiss = false;
    state.engine.setWord(state.queue[state.queueIndex]);
    state.queueIndex++;
    renderNormalWord();
  }

  function updateNormalStats() {
    text("normalScore", state.stats.score);
    text("normalCombo", state.stats.combo);
    text("normalCorrect", state.stats.correctKeys);
    text("normalMiss", state.stats.missKeys);
    text("normalCompleted", state.stats.completed);
  }

  function startNormal() {
    var rank;
    var pool;
    var seconds;

    if (!ensurePlayer()) {
      return;
    }
    if (!state.normalWords.length) {
      window.alert("通常タイピングの問題CSVを読み込めていません。接続状況を確認してください。");
      return;
    }

    blurInput();
    stopTimer();
    cancelCountdown();

    state.romajiSettings = Settings.cloneSettings(Settings.loadRomaji());
    state.engine = new TypingEngine(state.romajiSettings);
    rank = GameRules.getRankByExp(state.player.exp);
    pool = GameRules.filterWords(state.normalWords, rank.maxLevel);
    state.queue = GameRules.shuffle(pool);
    state.queueIndex = 0;
    state.stats = {
      correctKeys: 0,
      missKeys: 0,
      completed: 0,
      combo: 0,
      maxCombo: 0,
      score: 0
    };
    state.mode = "normal";
    state.active = false;

    seconds = numberValue(state.config.NORMAL_SECONDS, 60);
    if (seconds < 10) { seconds = 60; }
    state.normalSeconds = seconds;

    text("normalTime", seconds.toFixed(1));
    updateNormalStats();
    nextNormalWord();
    showView("viewNormalGame");
    setStatus("通常タイピング / 記録先はplayersのみ");

    runCountdown("normalCountdown", function () {
      state.startMs = new Date().getTime();
      state.endMs = state.startMs + (state.normalSeconds * 1000);
      state.active = true;
      state.timer = window.setInterval(updateNormalClock, 50);
    });
  }

  function updateNormalClock() {
    var now = new Date().getTime();
    var remain = state.endMs - now;

    if (!state.active || state.mode !== "normal") {
      return;
    }

    if (remain <= 0) {
      text("normalTime", "0.0");
      finishNormal();
      return;
    }

    text("normalTime", (remain / 1000).toFixed(1));
  }

  function handleNormalChar(ch) {
    var result = state.engine.handleChar(ch);

    if (result.accepted) {
      state.stats.correctKeys++;
      state.stats.score += 10;
      text("normalTyped", result.typed);

      if (result.complete) {
        state.stats.completed++;
        state.stats.score += 100;

        if (!state.wordHadMiss) {
          state.stats.combo++;
          if (state.stats.combo > state.stats.maxCombo) {
            state.stats.maxCombo = state.stats.combo;
          }
        } else {
          state.stats.combo = 0;
        }

        nextNormalWord();
      }
    } else if (result.miss) {
      state.stats.missKeys++;
      state.stats.combo = 0;
      state.wordHadMiss = true;
    }

    updateNormalStats();
  }

  function finishNormal() {
    var accuracy;
    var gained;
    var oldRank;
    var newRank;

    if (state.mode !== "normal") {
      return;
    }

    state.active = false;
    stopTimer();
    cancelCountdown();

    accuracy = GameRules.calculateAccuracy(state.stats.correctKeys, state.stats.missKeys);
    gained = GameRules.calculateExp(state.stats);
    oldRank = GameRules.getRankByExp(state.player.exp);

    state.player.exp += gained;
    state.player.plays++;
    if (state.stats.score > state.player.bestScore) {
      state.player.bestScore = state.stats.score;
    }
    newRank = GameRules.getRankByExp(state.player.exp);
    state.player.rank = newRank.rank;

    text("resultScore", state.stats.score);
    text("resultCompleted", state.stats.completed);
    text("resultCorrect", state.stats.correctKeys);
    text("resultMiss", state.stats.missKeys);
    text("resultAccuracy", accuracy.toFixed(1) + "%");
    text("resultCombo", state.stats.maxCombo);
    text("resultExp", "+" + gained);
    text("resultRank", newRank.name + " / " + state.player.exp + " EXP");
    updateExpBar("resultExpBar", state.player.exp);

    if (newRank.rank > oldRank.rank) {
      $("rankUpBanner").className = "rank-up";
      text("rankUpBanner", "RANK UP!  " + oldRank.name + " → " + newRank.name);
    } else {
      $("rankUpBanner").className = "rank-up hidden";
    }

    text("resultSaveStatus", "playersへ成長情報を保存中...");
    showView("viewNormalResult");
    updateHomePlayer();

    writePlayerProfile(function (ok) {
      text("resultSaveStatus", ok ? "playersへ保存しました。通常記録リストにはまだ保存していません。" : "playersへの保存に失敗しました。接続状況を確認してください。");
    });
  }

  function abortNormal() {
    state.active = false;
    state.mode = "";
    stopTimer();
    cancelCountdown();
    showHome();
  }

  function openSettings() {
    state.romajiSettings = Settings.loadRomaji();
    Settings.renderRomaji($("romajiSettings"), state.romajiSettings);
    showView("viewSettings");
    setStatus("ローマ字入力方式を選択してください");
  }

  function saveSettings() {
    state.romajiSettings = Settings.readRomajiFrom($("romajiSettings"));
    Settings.saveRomaji(state.romajiSettings);
    setStatus("ローマ字入力設定をCookieに保存しました");
    showView("viewHome");
  }

  function resetSettings() {
    state.romajiSettings = Romaji.getDefaultSettings();
    Settings.renderRomaji($("romajiSettings"), state.romajiSettings);
    setStatus("標準設定を表示しました。「設定を保存」で確定します");
  }

  function showHome() {
    state.mode = "";
    state.active = false;
    stopTimer();
    cancelCountdown();
    updateHomePlayer();
    showView("viewHome");
    setStatus("players単独試験モード");
  }

  function handleKeyDown(e) {
    var ch;
    e = e || window.event;

    if (!state.active) {
      return;
    }

    ch = TypingInput.keyToChar(e);
    if (!ch) {
      return;
    }

    if (e.preventDefault) {
      e.preventDefault();
    } else {
      e.returnValue = false;
    }

    if (state.mode === "normal") {
      handleNormalChar(ch);
    }
  }

  function bindEvents() {
    $("btnSavePlayer").onclick = function () { savePlayerFromInputs(true, true); };
    $("btnRetryPlayers").onclick = function () { testPlayersRead(); };
    $("btnNormal").onclick = startNormal;
    $("btnOfficial").onclick = function () {
      window.alert("現在はplayersだけの接続試験中です。tournament / officialrecords はまだ接続しません。");
    };
    $("btnSettings").onclick = openSettings;

    $("btnAbortNormal").onclick = abortNormal;
    $("btnNormalAgain").onclick = startNormal;
    $("btnNormalHome").onclick = showHome;

    $("btnSaveSettings").onclick = saveSettings;
    $("btnResetSettings").onclick = resetSettings;
    $("btnSettingsBack").onclick = showHome;

    document.onkeydown = handleKeyDown;
  }

  function finishDataLoad() {
    state.clientId = Settings.getClientId();
    state.romajiSettings = Settings.loadRomaji();
    state.playerCode = Settings.loadPlayerCode();

    if (state.playerCode) {
      setPlayerInputs(state.playerCode);
      text("playerCodeDisplay", state.playerCode);
    }

    text("testModeDisplay", "players");
    showView("viewHome");
    updateHomePlayer();
    setStatus("players接続確認中...");
    testPlayersRead();
  }

  function loadNormalCSV() {
    var url = state.config.TYPING_CSV || "csv/typing.csv";

    setDiag("csv", "wait", "確認中", url);
    FileData.loadTypingCSV(url, function (words) {
      state.normalWords = words;
      setDiag("csv", "ok", "OK", url + " / " + words.length + "件");
      finishDataLoad();
    }, function (req) {
      state.normalWords = [];
      setDiag("csv", "ng", "NG", "読込失敗 / " + url + " / HTTP " + (req && typeof req.status !== "undefined" ? req.status : 0));
      finishDataLoad();
    });
  }

  function initWithConfig(config) {
    state.config = config || {};
    Settings.configure(state.config.COOKIE_DAYS || 365);
    SP.init(state.config.WEB_ROOT || "AUTO");

    setDiag("config", "ok", "OK", "config/config.txt / PLAYER_LIST=" + (state.config.PLAYER_LIST || "未設定"));
    setDiag("sp", "wait", "未確認", "API: " + (SP.api || "未設定"));
    setDiag("others", "skip", "未接続", "playersのみ試験。その他4リストへのREST通信は停止中");

    loadNormalCSV();
  }

  function init() {
    bindEvents();
    initDiagnostics();
    showView("viewLoading");
    setStatus("config/config.txtを読み込んでいます...");

    FileData.loadConfig("config/config.txt", function (config) {
      initWithConfig(config);
    }, function (req) {
      setDiag("config", "ng", "NG", "config/config.txt 読込失敗 / HTTP " + (req && typeof req.status !== "undefined" ? req.status : 0));
      setDiag("csv", "skip", "未実施", "configを読み込めないため未実施");
      setDiag("sp", "skip", "未実施", "configを読み込めないためWEB_ROOT未確定");
      setDiag("playersread", "skip", "未実施", "configを読み込めないため未実施");
      showView("viewHome");
      setStatus("config/config.txtを読み込めません。接続状況を確認してください。");
    });
  }

  if (window.addEventListener) {
    window.addEventListener("load", init, false);
  } else if (window.attachEvent) {
    window.attachEvent("onload", init);
  } else {
    window.onload = init;
  }
})();
