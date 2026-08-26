// app.js
// 5つのSharePointリスト対応版
// players / normalrecords / officialrecords / tournament / accesscounter
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
    officialWords: [],
    romajiSettings: {},
    playerCode: "",
    clientId: "",
    player: { itemId: null, exp: 0, rank: 1, plays: 0, bestScore: 0 },
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
    normalSeconds: 10,
    officialAuth: null,
    counterCounted: false
  };

  function $(id) { return document.getElementById(id); }

  function text(id, value) {
    var el = $(id);
    if (el) { el.innerText = String(value === null || value === undefined ? "" : value); }
  }

  function showView(id) {
    var i;
    var el;
    for (i = 0; i < VIEWS.length; i++) {
      el = $(VIEWS[i]);
      if (el) { el.className = el.className.replace(/\s*active-view/g, ""); }
    }
    el = $(id);
    if (el) { el.className += " active-view"; }
  }

  function setStatus(message) { text("statusBar", message || ""); }

  function setDiag(name, level, status, detail) {
    var row = $("diag-" + name);
    var statusEl = $("diag-" + name + "-status");
    var detailEl = $("diag-" + name + "-detail");
    if (row) { row.className = "diag-row diag-" + level; }
    if (statusEl) { statusEl.innerText = status || ""; }
    if (detailEl) { detailEl.innerText = detail || ""; }
  }

  function initDiagnostics() {
    setDiag("config", "wait", "確認中", "config/config.txt");
    setDiag("csvnormal", "wait", "確認中", "csv/typing.csv");
    setDiag("csvofficial", "wait", "確認中", "csv/official.csv");
    setDiag("sp", "wait", "未確認", "SharePoint REST API");
    setDiag("players", "wait", "未確認", "players");
    setDiag("normalrecords", "wait", "未確認", "normalrecords");
    setDiag("officialrecords", "wait", "未確認", "officialrecords");
    setDiag("tournament", "wait", "未確認", "tournament");
    setDiag("counter", "wait", "未確認", "accesscounter");
  }

  function numberValue(value, fallback) {
    var n = parseInt(value, 10);
    return isNaN(n) ? fallback : n;
  }

  function boolValue(value) {
    var s;
    if (value === true) { return true; }
    s = String(value === null || value === undefined ? "" : value).toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }

  function isoNow() {
    var d = new Date();
    function p(n) { return n < 10 ? "0" + n : String(n); }
    if (d.toISOString) { return d.toISOString(); }
    return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) +
      "T" + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds()) + "Z";
  }

  function formatSeconds(ms) { return (ms / 1000).toFixed(3); }

  function getSharePointError(req, target) {
    var status = req && typeof req.status !== "undefined" ? req.status : 0;
    var message = "";
    var data;

    if (req && req.responseText) {
      try {
        data = JSON.parse(req.responseText);
        if (data && data.error && data.error.message) {
          message = data.error.message.value || data.error.message;
        }
      } catch (e) {}
    }

    if (!message) {
      if (status === 0) { message = "通信できません。WEB_ROOT・配置場所・認証状態を確認してください。"; }
      else if (status === 400) { message = (target || "リスト") + " の列名・内部名・列型を確認してください。"; }
      else if (status === 401) { message = "SharePointの認証が必要です。"; }
      else if (status === 403) { message = (target || "リスト") + " の権限を確認してください。"; }
      else if (status === 404) { message = "WEB_ROOTまたは " + (target || "リスト") + " の名前を確認してください。"; }
      else if (status >= 500) { message = "SharePointサーバー側でエラーが発生しました。"; }
      else { message = req && req.statusText ? req.statusText : "SharePoint通信エラー"; }
    }

    if (message.length > 180) { message = message.substring(0, 180) + "..."; }
    return "HTTP " + status + " / " + message;
  }

  function stopTimer() {
    if (state.timer) { window.clearInterval(state.timer); state.timer = null; }
  }

  function cancelCountdown() {
    state.countdownToken++;
    text("normalCountdown", "");
    text("officialCountdown", "");
  }

  function runCountdown(elementId, callback) {
    var token = ++state.countdownToken;
    var value = 3;
    state.active = false;
    text(elementId, value);

    function tick() {
      if (token !== state.countdownToken) { return; }
      value--;
      if (value > 0) {
        text(elementId, value);
        window.setTimeout(tick, 800);
        return;
      }
      text(elementId, "START!");
      window.setTimeout(function () {
        if (token !== state.countdownToken) { return; }
        text(elementId, "");
        callback();
      }, 500);
    }

    window.setTimeout(tick, 800);
  }

  function blurInput() {
    try {
      if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); }
    } catch (e) {}
  }

  function setPlayerInputs(code) {
    var parts;
    if (!code) { return; }
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
    if (!bar) { return; }
    if (!next) { percent = 100; }
    else {
      percent = ((exp - current.exp) / (next.exp - current.exp)) * 100;
      if (percent < 0) { percent = 0; }
      if (percent > 100) { percent = 100; }
    }
    bar.style.width = percent.toFixed(1) + "%";
  }

  function resetPlayerState() {
    state.player = { itemId: null, exp: 0, rank: 1, plays: 0, bestScore: 0 };
    updateHomePlayer();
  }

  function updateHomePlayer() {
    var rank = GameRules.getRankByExp(state.player.exp);
    state.player.rank = rank.rank;
    text("homeRank", rank.name);
    text("homeExp", state.player.exp);
    text("homeBest", "BEST SCORE " + state.player.bestScore);
    text("homePlays", state.player.plays);
    updateExpBar("homeExpBar", state.player.exp);
    text("playerCodeDisplay", state.playerCode || "--- --");
  }

  function applyPlayerItem(item) {
    if (!item) { resetPlayerState(); return; }
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
      if (String(items[i].ClientId || "") === state.clientId) { return items[i]; }
    }
    return null;
  }

  function loadPlayers(callback) {
    var listName = state.config.PLAYER_LIST;
    if (!listName) {
      setDiag("players", "ng", "NG", "PLAYER_LIST未設定");
      if (callback) { callback(false); }
      return;
    }

    setDiag("players", "wait", "確認中", listName + " 読込中...");
    SP.load(listName, ["Id", "Title", "ClientId", "EXP", "Rank", "Plays", "BestScore"], function (items) {
      var current = findCurrentPlayer(items);
      setDiag("sp", "ok", "OK", SP.api);
      setDiag("players", "ok", "OK", items.length + "件読込成功" + (current ? " / この端末のplayerあり" : " / この端末のplayer未登録"));
      if (current) { applyPlayerItem(current); }
      else if (state.playerCode) { resetPlayerState(); }
      if (callback) { callback(true); }
    }, function (req) {
      setDiag("sp", "ng", "NG", getSharePointError(req, "SharePoint"));
      setDiag("players", "ng", "NG", getSharePointError(req, listName));
      if (callback) { callback(false); }
    });
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
    if (!state.playerCode || !listName) { if (done) { done(false); } return; }

    function ok() {
      setDiag("players", "ok", "OK", "読込・書込OK / " + state.playerCode);
      if (done) { done(true); }
    }
    function ng(req) {
      setDiag("players", "ng", "NG", getSharePointError(req, listName));
      if (done) { done(false); }
    }

    if (state.player.itemId) {
      SP.update(listName, state.player.itemId, profile, ok, ng);
    } else {
      SP.add(listName, profile, function (result) {
        try { if (result && result.d && result.d.Id) { state.player.itemId = result.d.Id; } } catch (e) {}
        ok();
      }, ng);
    }
  }

  function savePlayerFromInputs(showAlert, writeSharePoint) {
    var code = Settings.makePlayerCode($("playerNumber").value, $("playerNick").value);
    if (!code) {
      if (showAlert) { window.alert("プレイヤーコードは3桁の数字と英字2文字で入力してください。例：123-AB"); }
      return false;
    }
    state.playerCode = code;
    Settings.savePlayerCode(code);
    text("playerCodeDisplay", code);
    text("officialPlayer", code);
    text("officialReadyPlayer", code);
    setPlayerInputs(code);

    if (writeSharePoint) {
      loadPlayers(function (ok) {
        if (!ok) { return; }
        writePlayerProfile(function (writeOk) { if (writeOk) { loadPlayers(); } });
      });
    }
    return true;
  }

  function ensurePlayer() {
    if (state.playerCode && /^\d{3}-[A-Z]{2}$/.test(state.playerCode)) { return true; }
    return savePlayerFromInputs(true, false);
  }

  function testSimpleList(diagName, listName, columns, callback) {
    if (!listName) {
      setDiag(diagName, "ng", "NG", "configにリスト名がありません");
      if (callback) { callback(false, []); }
      return;
    }
    setDiag(diagName, "wait", "確認中", listName + " 読込中...");
    SP.load(listName, columns, function (items) {
      setDiag(diagName, "ok", "OK", listName + " / " + items.length + "件読込成功");
      if (callback) { callback(true, items); }
    }, function (req) {
      setDiag(diagName, "ng", "NG", getSharePointError(req, listName));
      if (callback) { callback(false, []); }
    });
  }

  function findCounterRow(items) {
    var i;
    for (i = 0; i < items.length; i++) {
      if (String(items[i].Title || "").toLowerCase() === "total") { return items[i]; }
    }
    return null;
  }

  function updateAccessCounter(increment) {
    var listName = state.config.COUNTER_LIST;
    if (!listName) { setDiag("counter", "ng", "NG", "COUNTER_LIST未設定"); return; }

    setDiag("counter", "wait", "確認中", listName + " 読込中...");
    SP.load(listName, ["Id", "Title", "Count"], function (items) {
      var total = findCounterRow(items);
      var current = total ? numberValue(total.Count, 0) : 0;
      var next;
      text("accessCount", current);

      if (!increment || state.counterCounted) {
        setDiag("counter", "ok", "OK", "読込成功 / 現在 " + current);
        return;
      }

      state.counterCounted = true;
      next = current + 1;
      function writeOk() {
        text("accessCount", next);
        setDiag("counter", "ok", "OK", "読込・加算OK / " + next);
      }
      function writeNg(req) {
        setDiag("counter", "ng", "NG", "読込OK・書込NG / " + getSharePointError(req, listName));
      }
      if (total) { SP.update(listName, total.Id, { Title: "total", Count: next }, writeOk, writeNg); }
      else { SP.add(listName, { Title: "total", Count: next }, writeOk, writeNg); }
    }, function (req) {
      text("accessCount", "---");
      setDiag("counter", "ng", "NG", getSharePointError(req, listName));
    });
  }

  function renderNormalWord() {
    var word = state.engine.word;
    if (!word) { return; }
    text("normalKanji", word.kanji);
    text("normalKana", word.kana);
    text("normalGuide", state.engine.getGuide());
    text("normalTyped", state.engine.typed);
  }

  function nextNormalWord() {
    var previous;
    var first;
    if (state.queueIndex >= state.queue.length) {
      previous = state.engine && state.engine.word ? state.engine.word.id : null;
      state.queue = GameRules.shuffle(state.queue);
      state.queueIndex = 0;
      if (state.queue.length > 1 && previous !== null && String(state.queue[0].id) === String(previous)) {
        first = state.queue[0]; state.queue[0] = state.queue[1]; state.queue[1] = first;
      }
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
    if (!ensurePlayer()) { return; }
    if (!state.normalWords.length) { window.alert("通常タイピングの問題CSVを読み込めていません。"); return; }

    blurInput(); stopTimer(); cancelCountdown();
    state.romajiSettings = Settings.cloneSettings(Settings.loadRomaji());
    state.engine = new TypingEngine(state.romajiSettings);
    rank = GameRules.getRankByExp(state.player.exp);
    pool = GameRules.filterWords(state.normalWords, rank.maxLevel);
    state.queue = GameRules.shuffle(pool);
    state.queueIndex = 0;
    state.stats = { correctKeys: 0, missKeys: 0, completed: 0, combo: 0, maxCombo: 0, score: 0 };
    state.mode = "normal";
    state.active = false;
    seconds = numberValue(state.config.NORMAL_SECONDS, 10);
    if (seconds < 1) { seconds = 10; }
    state.normalSeconds = seconds;

    text("normalTime", seconds.toFixed(1));
    updateNormalStats();
    nextNormalWord();
    showView("viewNormalGame");
    setStatus("通常タイピング / " + seconds + "秒 / " + rank.name + " / 候補" + pool.length + "問");

    runCountdown("normalCountdown", function () {
      state.startMs = new Date().getTime();
      state.endMs = state.startMs + (state.normalSeconds * 1000);
      state.active = true;
      state.timer = window.setInterval(updateNormalClock, 50);
    });
  }

  function updateNormalClock() {
    var remain = state.endMs - new Date().getTime();
    if (!state.active || state.mode !== "normal") { return; }
    if (remain <= 0) { text("normalTime", "0.0"); finishNormal(); return; }
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
          if (state.stats.combo > state.stats.maxCombo) { state.stats.maxCombo = state.stats.combo; }
        } else { state.stats.combo = 0; }
        nextNormalWord();
      }
    } else if (result.miss) {
      state.stats.missKeys++;
      state.stats.combo = 0;
      state.wordHadMiss = true;
    }
    updateNormalStats();
  }

  function saveNormalRecord(accuracy, gained, done) {
    var listName = state.config.NORMAL_RECORD_LIST;
    var record = {
      Title: state.playerCode,
      ClientId: state.clientId,
      Score: state.stats.score,
      EXP: gained,
      Accuracy: accuracy,
      CorrectKeys: state.stats.correctKeys,
      MissKeys: state.stats.missKeys,
      Completed: state.stats.completed,
      MaxCombo: state.stats.maxCombo,
      Mode: state.normalSeconds + "SEC",
      PlayDate: isoNow()
    };
    SP.add(listName, record, function () {
      setDiag("normalrecords", "ok", "OK", "読込・書込OK / 最新スコア " + state.stats.score);
      if (done) { done(true); }
    }, function (req) {
      setDiag("normalrecords", "ng", "NG", getSharePointError(req, listName));
      if (done) { done(false); }
    });
  }

  function finishNormal() {
    var accuracy;
    var gained;
    var oldRank;
    var newRank;
    var pending = 2;
    var failed = false;
    if (state.mode !== "normal") { return; }

    state.active = false; stopTimer(); cancelCountdown();
    accuracy = GameRules.calculateAccuracy(state.stats.correctKeys, state.stats.missKeys);
    gained = GameRules.calculateExp(state.stats);
    oldRank = GameRules.getRankByExp(state.player.exp);
    state.player.exp += gained;
    state.player.plays++;
    if (state.stats.score > state.player.bestScore) { state.player.bestScore = state.stats.score; }
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
    } else { $("rankUpBanner").className = "rank-up hidden"; }

    text("resultSaveStatus", "players と normalrecords へ保存中...");
    showView("viewNormalResult");
    updateHomePlayer();

    function done(ok) {
      if (!ok) { failed = true; }
      pending--;
      if (pending <= 0) {
        text("resultSaveStatus", failed ? "一部のSharePoint保存に失敗しました。接続状況を確認してください。" : "players と normalrecords へ保存しました。");
      }
    }
    writePlayerProfile(done);
    saveNormalRecord(accuracy, gained, done);
  }

  function abortNormal() {
    state.active = false; state.mode = ""; stopTimer(); cancelCountdown(); showHome();
  }

  function openOfficialLogin() {
    if (!ensurePlayer()) { return; }
    state.officialAuth = null;
    text("officialPlayer", state.playerCode);
    $("officialPassword").value = "";
    text("officialLoginMessage", "");
    showView("viewOfficialLogin");
    setStatus("公式大会 / tournamentで参加資格とパスワードを確認します");
  }

  function authenticateOfficial() {
    var password = $("officialPassword").value;
    var listName = state.config.TOURNAMENT_LIST;
    var tournamentId = state.config.TOURNAMENT_ID || "official01";
    var expectedVersion = numberValue(state.config.OFFICIAL_WORDS_VERSION, 1);
    if (!password) { text("officialLoginMessage", "大会パスワードを入力してください。"); return; }

    text("officialLoginMessage", "SharePointで参加資格を確認中...");
    SP.load(listName, ["Id", "Title", "RecordType", "TournamentId", "CourseVersion", "EntryPassword", "Active", "PlayerCode"], function (items) {
      var configRow = null;
      var participant = null;
      var duplicate = 0;
      var i;
      var type;
      setDiag("tournament", "ok", "OK", listName + " / " + items.length + "件読込成功");

      for (i = 0; i < items.length; i++) {
        if (String(items[i].TournamentId || "").toLowerCase() !== String(tournamentId).toLowerCase()) { continue; }
        type = String(items[i].RecordType || "").toLowerCase();
        if (type === "config" && boolValue(items[i].Active)) { configRow = items[i]; }
        if (type === "participant" && boolValue(items[i].Active) && String(items[i].PlayerCode || "").toUpperCase() === state.playerCode) {
          participant = items[i]; duplicate++;
        }
      }

      if (!configRow) { text("officialLoginMessage", "有効な大会設定(config)がありません。"); return; }
      if (!participant) { text("officialLoginMessage", "このプレイヤーコードは参加者に登録されていません。"); return; }
      if (duplicate > 1) { text("officialLoginMessage", "同じプレイヤーコードが複数登録されています。"); return; }
      if (String(configRow.EntryPassword || "") !== String(password)) { text("officialLoginMessage", "大会パスワードが違います。"); return; }
      if (numberValue(configRow.CourseVersion, 0) !== expectedVersion) { text("officialLoginMessage", "公式問題のバージョンが一致しません。"); return; }

      state.officialAuth = { tournamentId: tournamentId, version: expectedVersion, title: configRow.Title || tournamentId };
      text("officialTournamentTitle", state.officialAuth.title);
      text("officialReadyPlayer", state.playerCode);
      text("officialWordCount", state.officialWords.length);
      text("officialVersion", expectedVersion);
      showView("viewOfficialReady");
      setStatus("公式大会参加認証 OK");
    }, function (req) {
      setDiag("tournament", "ng", "NG", getSharePointError(req, listName));
      text("officialLoginMessage", "tournamentを読み込めません。接続状況を確認してください。");
    });
  }

  function renderOfficialWord() {
    var word = state.engine.word;
    if (!word) { return; }
    text("officialKanji", word.kanji);
    text("officialKana", word.kana);
    text("officialGuide", state.engine.getGuide());
    text("officialTyped", state.engine.typed);
    text("officialProgress", (state.queueIndex + 1) + " / " + state.queue.length);
  }

  function startOfficial() {
    if (!state.officialAuth) { openOfficialLogin(); return; }
    if (!state.officialWords.length) { window.alert("公式タイピングの問題CSVを読み込めていません。"); return; }

    blurInput(); stopTimer(); cancelCountdown();
    state.romajiSettings = Settings.cloneSettings(Settings.loadRomaji());
    state.engine = new TypingEngine(state.romajiSettings);
    state.queue = GameRules.shuffle(state.officialWords);
    state.queueIndex = 0;
    state.stats = { correctKeys: 0, missKeys: 0, completed: 0 };
    state.mode = "official";
    state.active = false;
    state.engine.setWord(state.queue[0]);
    text("officialTime", "0.000");
    text("officialMiss", "0");
    renderOfficialWord();
    showView("viewOfficialGame");
    setStatus("公式スプリント / 全" + state.queue.length + "問");

    runCountdown("officialCountdown", function () {
      state.startMs = new Date().getTime();
      state.active = true;
      state.timer = window.setInterval(updateOfficialClock, 31);
    });
  }

  function updateOfficialClock() {
    if (!state.active || state.mode !== "official") { return; }
    text("officialTime", formatSeconds(new Date().getTime() - state.startMs));
  }

  function handleOfficialChar(ch) {
    var result = state.engine.handleChar(ch);
    if (result.accepted) {
      state.stats.correctKeys++;
      text("officialTyped", result.typed);
      if (result.complete) {
        state.stats.completed++;
        state.queueIndex++;
        if (state.queueIndex >= state.queue.length) { finishOfficial(new Date().getTime() - state.startMs); return; }
        state.engine.setWord(state.queue[state.queueIndex]);
        renderOfficialWord();
      }
    } else if (result.miss) {
      state.stats.missKeys++;
      text("officialMiss", state.stats.missKeys);
    }
  }

  function finishOfficial(timeMs) {
    var accuracy;
    state.active = false; stopTimer(); cancelCountdown();
    accuracy = GameRules.calculateAccuracy(state.stats.correctKeys, state.stats.missKeys);
    text("officialResultTime", formatSeconds(timeMs) + " 秒");
    text("officialResultWords", state.stats.completed);
    text("officialResultCorrect", state.stats.correctKeys);
    text("officialResultMiss", state.stats.missKeys);
    text("officialResultAccuracy", accuracy.toFixed(1) + "%");
    text("officialBest", "");
    text("officialRank", "");
    text("officialSaveStatus", "officialrecordsへ保存中...");
    showView("viewOfficialResult");
    saveOfficialResult(timeMs, accuracy);
  }

  function saveOfficialResult(timeMs, accuracy) {
    var listName = state.config.OFFICIAL_RECORD_LIST;
    var record = {
      Title: state.playerCode,
      ClientId: state.clientId,
      TournamentId: state.officialAuth.tournamentId,
      CourseVersion: state.officialAuth.version,
      TimeMs: timeMs,
      Miss: state.stats.missKeys,
      CorrectKeys: state.stats.correctKeys,
      Accuracy: accuracy,
      PlayDate: isoNow()
    };
    SP.add(listName, record, function () {
      setDiag("officialrecords", "ok", "OK", "読込・書込OK / " + formatSeconds(timeMs) + "秒");
      text("officialSaveStatus", "公式記録を保存しました。");
      loadOfficialRanking();
    }, function (req) {
      setDiag("officialrecords", "ng", "NG", getSharePointError(req, listName));
      text("officialSaveStatus", "公式記録を保存できませんでした。この結果は公式記録になりません。");
    });
  }

  function loadOfficialRanking() {
    var listName = state.config.OFFICIAL_RECORD_LIST;
    SP.load(listName, ["Id", "Title", "TournamentId", "CourseVersion", "TimeMs", "Miss", "PlayDate"], function (items) {
      var bestByPlayer = {};
      var list = [];
      var i;
      var item;
      var code;
      var old;
      var myBest = null;
      var myRank = 0;

      for (i = 0; i < items.length; i++) {
        item = items[i];
        if (String(item.TournamentId || "").toLowerCase() !== String(state.officialAuth.tournamentId).toLowerCase()) { continue; }
        if (numberValue(item.CourseVersion, 0) !== state.officialAuth.version) { continue; }
        code = String(item.Title || "").toUpperCase();
        if (!code) { continue; }
        item.TimeMs = numberValue(item.TimeMs, 999999999);
        item.Miss = numberValue(item.Miss, 999999);
        old = bestByPlayer[code];
        if (!old || item.TimeMs < old.TimeMs || (item.TimeMs === old.TimeMs && item.Miss < old.Miss)) { bestByPlayer[code] = item; }
      }

      for (code in bestByPlayer) {
        if (bestByPlayer.hasOwnProperty(code)) { list.push({ code: code, time: bestByPlayer[code].TimeMs, miss: bestByPlayer[code].Miss }); }
      }
      list.sort(function (a, b) {
        if (a.time !== b.time) { return a.time - b.time; }
        if (a.miss !== b.miss) { return a.miss - b.miss; }
        return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0);
      });
      for (i = 0; i < list.length; i++) {
        if (list[i].code === state.playerCode) { myBest = list[i]; myRank = i + 1; break; }
      }
      if (myBest) {
        text("officialBest", "自己ベスト " + formatSeconds(myBest.time) + " 秒");
        text("officialRank", "現在 " + myRank + " 位 / " + list.length + "人");
      }
    }, function () {});
  }

  function abortOfficial() {
    state.active = false; state.mode = ""; stopTimer(); cancelCountdown();
    if (state.officialAuth) { showView("viewOfficialReady"); setStatus("公式大会：中止した競技は記録されません"); }
    else { showHome(); }
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
    state.mode = ""; state.active = false; stopTimer(); cancelCountdown(); updateHomePlayer(); showView("viewHome"); setStatus("準備完了");
  }

  function handleKeyDown(e) {
    var ch;
    e = e || window.event;
    if (!state.active) { return; }
    ch = TypingInput.keyToChar(e);
    if (!ch) { return; }
    if (e.preventDefault) { e.preventDefault(); } else { e.returnValue = false; }
    if (state.mode === "normal") { handleNormalChar(ch); }
    else if (state.mode === "official") { handleOfficialChar(ch); }
  }

  function runConnectionTests() {
    loadPlayers();
    testSimpleList("normalrecords", state.config.NORMAL_RECORD_LIST, ["Id", "Title", "ClientId", "Score", "EXP", "Accuracy", "CorrectKeys", "MissKeys", "Completed", "MaxCombo", "Mode", "PlayDate"]);
    testSimpleList("officialrecords", state.config.OFFICIAL_RECORD_LIST, ["Id", "Title", "ClientId", "TournamentId", "CourseVersion", "TimeMs", "Miss", "CorrectKeys", "Accuracy", "PlayDate"]);
    testSimpleList("tournament", state.config.TOURNAMENT_LIST, ["Id", "Title", "RecordType", "TournamentId", "CourseVersion", "EntryPassword", "Active", "PlayerCode"]);
    updateAccessCounter(false);
  }

  function bindEvents() {
    $("btnSavePlayer").onclick = function () { savePlayerFromInputs(true, true); };
    $("btnRetryAll").onclick = runConnectionTests;
    $("btnNormal").onclick = startNormal;
    $("btnOfficial").onclick = openOfficialLogin;
    $("btnSettings").onclick = openSettings;
    $("btnAbortNormal").onclick = abortNormal;
    $("btnNormalAgain").onclick = startNormal;
    $("btnNormalHome").onclick = showHome;
    $("btnOfficialEnter").onclick = authenticateOfficial;
    $("btnOfficialBack").onclick = showHome;
    $("btnOfficialStart").onclick = startOfficial;
    $("btnOfficialReadyBack").onclick = showHome;
    $("btnAbortOfficial").onclick = abortOfficial;
    $("btnOfficialAgain").onclick = function () { if (state.officialAuth) { showView("viewOfficialReady"); } else { openOfficialLogin(); } };
    $("btnOfficialHome").onclick = showHome;
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
      text("officialPlayer", state.playerCode);
      text("officialReadyPlayer", state.playerCode);
    }

    state.normalSeconds = numberValue(state.config.NORMAL_SECONDS, 10);
    text("normalModeLabel", state.normalSeconds + "秒スコアアタック");
    text("normalTime", state.normalSeconds.toFixed(1));
    showView("viewHome");
    updateHomePlayer();
    setStatus("SharePoint 5リスト接続確認中...");
    loadPlayers();
    testSimpleList("normalrecords", state.config.NORMAL_RECORD_LIST, ["Id", "Title", "ClientId", "Score", "EXP", "Accuracy", "CorrectKeys", "MissKeys", "Completed", "MaxCombo", "Mode", "PlayDate"]);
    testSimpleList("officialrecords", state.config.OFFICIAL_RECORD_LIST, ["Id", "Title", "ClientId", "TournamentId", "CourseVersion", "TimeMs", "Miss", "CorrectKeys", "Accuracy", "PlayDate"]);
    testSimpleList("tournament", state.config.TOURNAMENT_LIST, ["Id", "Title", "RecordType", "TournamentId", "CourseVersion", "EntryPassword", "Active", "PlayerCode"]);
    updateAccessCounter(true);
  }

  function loadOfficialCSV() {
    var url = state.config.OFFICIAL_CSV || "csv/official.csv";
    setDiag("csvofficial", "wait", "確認中", url);
    FileData.loadTypingCSV(url, function (words) {
      state.officialWords = words;
      setDiag("csvofficial", "ok", "OK", url + " / " + words.length + "件");
      finishDataLoad();
    }, function (req) {
      state.officialWords = [];
      setDiag("csvofficial", "ng", "NG", "読込失敗 / HTTP " + (req && typeof req.status !== "undefined" ? req.status : 0));
      finishDataLoad();
    });
  }

  function loadNormalCSV() {
    var url = state.config.TYPING_CSV || "csv/typing.csv";
    setDiag("csvnormal", "wait", "確認中", url);
    FileData.loadTypingCSV(url, function (words) {
      state.normalWords = words;
      setDiag("csvnormal", "ok", "OK", url + " / " + words.length + "件");
      loadOfficialCSV();
    }, function (req) {
      state.normalWords = [];
      setDiag("csvnormal", "ng", "NG", "読込失敗 / HTTP " + (req && typeof req.status !== "undefined" ? req.status : 0));
      loadOfficialCSV();
    });
  }

  function initWithConfig(config) {
    state.config = config || {};
    Settings.configure(state.config.COOKIE_DAYS || 365);
    SP.init(state.config.WEB_ROOT || "AUTO");
    setDiag("config", "ok", "OK", "WEB_ROOT=" + (state.config.WEB_ROOT || "未設定"));
    setDiag("sp", "wait", "確認中", "API: " + (SP.api || "未設定"));
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
      setDiag("csvnormal", "skip", "未実施", "config読込失敗");
      setDiag("csvofficial", "skip", "未実施", "config読込失敗");
      setDiag("sp", "skip", "未実施", "WEB_ROOT未確定");
      showView("viewHome");
      setStatus("config/config.txtを読み込めません。");
    });
  }

  if (window.addEventListener) { window.addEventListener("load", init, false); }
  else if (window.attachEvent) { window.attachEvent("onload", init); }
  else { window.onload = init; }
})();
