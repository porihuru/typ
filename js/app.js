// app.js
// 通常タイピング / EXP・ランク / 公式スプリント / SharePoint記録
// ES5 only: IE11 / Edge IE mode compatible
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
    officialAuth: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function text(id, value) {
    var el = $(id);
    if (el) {
      el.innerText = String(value);
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

  function boolValue(value) {
    var s;
    if (value === true) {
      return true;
    }
    s = String(value === null || value === undefined ? "" : value).toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }

  function isoNow() {
    var d = new Date();
    if (d.toISOString) {
      return d.toISOString();
    }
    function p(n) { return n < 10 ? "0" + n : String(n); }
    return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) +
      "T" + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds()) + "Z";
  }

  function formatSeconds(ms) {
    return (ms / 1000).toFixed(3);
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
    text("officialCountdown", "");
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

  function savePlayerFromInputs(showAlert) {
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
    text("officialPlayer", code);
    text("officialReadyPlayer", code);
    setPlayerInputs(code);
    loadPlayerState();
    return true;
  }

  function ensurePlayer() {
    if (state.playerCode && /^\d{3}-[A-Z]{2}$/.test(state.playerCode)) {
      return true;
    }
    return savePlayerFromInputs(true);
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

  function updateExpBar(barId, exp) {
    var current = GameRules.getRankByExp(exp);
    var next = GameRules.getNextRank(exp);
    var percent;

    if (!next) {
      percent = 100;
    } else {
      percent = ((exp - current.exp) / (next.exp - current.exp)) * 100;
      if (percent < 0) { percent = 0; }
      if (percent > 100) { percent = 100; }
    }

    $(barId).style.width = percent.toFixed(1) + "%";
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

  function loadPlayerState() {
    var listName;

    if (!state.playerCode || !state.config.PLAYER_LIST) {
      resetPlayerState();
      return;
    }

    listName = state.config.PLAYER_LIST;

    SP.load(
      listName,
      ["Id", "Title", "ClientId", "EXP", "Rank", "Plays", "BestScore"],
      function (items) {
        var i;
        var item = null;
        for (i = 0; i < items.length; i++) {
          if (String(items[i].ClientId || "") === state.clientId) {
            item = items[i];
            break;
          }
        }

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
      },
      function () {
        // SharePointが使えなくてもゲームは止めない。
        updateHomePlayer();
      }
    );
  }

  function updateAccessCounter() {
    var listName = state.config.COUNTER_LIST;

    if (!listName) {
      return;
    }

    SP.load(listName, ["Id", "Title", "Count"], function (items) {
      var i;
      var total = null;
      var next;

      for (i = 0; i < items.length; i++) {
        if (String(items[i].Title || "").toLowerCase() === "total") {
          total = items[i];
          break;
        }
      }

      if (total) {
        next = numberValue(total.Count, 0) + 1;
        text("accessCount", next);
        SP.update(listName, total.Id, { Count: next }, function () {
          setStatus("SharePoint接続済み");
        }, function () {
          setStatus("ゲーム利用可能 / アクセスカウンター更新失敗");
        });
      } else {
        text("accessCount", 1);
        SP.add(listName, { Title: "Total", Count: 1 }, function () {
          setStatus("SharePoint接続済み");
        }, function () {
          setStatus("ゲーム利用可能 / アクセスカウンター作成失敗");
        });
      }
    }, function () {
      text("accessCount", "---");
      setStatus("SharePoint未接続またはリスト未作成 / 通常ゲームは利用できます");
    });
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
      window.alert("通常タイピングの問題がありません。");
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
    setStatus("通常タイピング / " + rank.name + " / LEVEL " + rank.maxLevel);

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
    var oldExp;

    if (state.mode !== "normal") {
      return;
    }

    state.active = false;
    stopTimer();
    cancelCountdown();

    accuracy = GameRules.calculateAccuracy(state.stats.correctKeys, state.stats.missKeys);
    gained = GameRules.calculateExp(state.stats);
    oldExp = state.player.exp;
    oldRank = GameRules.getRankByExp(oldExp);

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

    text("resultSaveStatus", "SharePointへ記録を保存中...");
    showView("viewNormalResult");
    updateHomePlayer();
    saveNormalResult(accuracy, gained);
  }

  function saveNormalResult(accuracy, gained) {
    var pending = 2;
    var failed = false;
    var record;
    var profile;

    function done(ok) {
      if (!ok) {
        failed = true;
      }
      pending--;
      if (pending <= 0) {
        text("resultSaveStatus", failed ? "一部のSharePoint記録を保存できませんでした。" : "SharePointへ保存しました。");
      }
    }

    record = {
      Title: state.playerCode,
      ClientId: state.clientId,
      Score: state.stats.score,
      EXP: gained,
      Accuracy: accuracy,
      CorrectKeys: state.stats.correctKeys,
      MissKeys: state.stats.missKeys,
      Completed: state.stats.completed,
      MaxCombo: state.stats.maxCombo,
      Mode: "60SEC",
      PlayDate: isoNow()
    };

    profile = {
      Title: state.playerCode,
      ClientId: state.clientId,
      EXP: state.player.exp,
      Rank: state.player.rank,
      Plays: state.player.plays,
      BestScore: state.player.bestScore
    };

    SP.add(state.config.NORMAL_RECORD_LIST, record, function () {
      done(true);
    }, function () {
      done(false);
    });

    if (state.player.itemId) {
      SP.update(state.config.PLAYER_LIST, state.player.itemId, profile, function () {
        done(true);
      }, function () {
        done(false);
      });
    } else {
      SP.add(state.config.PLAYER_LIST, profile, function (result) {
        try {
          if (result && result.d && result.d.Id) {
            state.player.itemId = result.d.Id;
          }
        } catch (e) {
        }
        done(true);
      }, function () {
        done(false);
      });
    }
  }

  function abortNormal() {
    state.active = false;
    state.mode = "";
    stopTimer();
    cancelCountdown();
    showHome();
  }

  function openOfficialLogin() {
    if (!ensurePlayer()) {
      return;
    }
    state.officialAuth = null;
    text("officialPlayer", state.playerCode);
    $("officialPassword").value = "";
    text("officialLoginMessage", "");
    showView("viewOfficialLogin");
    setStatus("公式大会：参加者コードと大会パスワードを確認します");
  }

  function authenticateOfficial() {
    var password = $("officialPassword").value;
    var tournamentId = state.config.TOURNAMENT_ID || "OFFICIAL-01";
    var expectedVersion = numberValue(state.config.OFFICIAL_WORDS_VERSION, 1);

    if (!password) {
      text("officialLoginMessage", "大会パスワードを入力してください。");
      return;
    }

    text("officialLoginMessage", "SharePointで参加資格を確認中...");

    SP.load(
      state.config.TOURNAMENT_LIST,
      ["Id", "Title", "RecordType", "TournamentId", "CourseVersion", "EntryPassword", "Active", "PlayerCode"],
      function (items) {
        var configRow = null;
        var participants = [];
        var i;
        var type;

        for (i = 0; i < items.length; i++) {
          if (String(items[i].TournamentId || "") !== tournamentId) {
            continue;
          }

          type = String(items[i].RecordType || "").toUpperCase();
          if (type === "CONFIG" && boolValue(items[i].Active)) {
            configRow = items[i];
          } else if (type === "PARTICIPANT" && boolValue(items[i].Active) && String(items[i].PlayerCode || "").toUpperCase() === state.playerCode) {
            participants.push(items[i]);
          }
        }

        if (!configRow) {
          text("officialLoginMessage", "現在有効な大会がありません。");
          return;
        }

        if (participants.length === 0) {
          text("officialLoginMessage", "このプレイヤーコードは大会参加者に登録されていません。");
          return;
        }

        if (participants.length > 1) {
          text("officialLoginMessage", "参加者コードが重複登録されています。管理者に確認してください。");
          return;
        }

        if (String(configRow.EntryPassword || "") !== String(password)) {
          text("officialLoginMessage", "大会パスワードが違います。");
          return;
        }

        if (numberValue(configRow.CourseVersion, 0) !== expectedVersion) {
          text("officialLoginMessage", "公式問題のバージョンが一致しません。管理者に確認してください。");
          return;
        }

        state.officialAuth = {
          tournamentId: tournamentId,
          version: expectedVersion,
          title: configRow.Title || tournamentId
        };

        text("officialTournamentTitle", state.officialAuth.title);
        text("officialReadyPlayer", state.playerCode);
        text("officialWordCount", state.officialWords.length);
        text("officialVersion", expectedVersion);
        showView("viewOfficialReady");
        setStatus("公式大会参加認証 OK");
      },
      function () {
        text("officialLoginMessage", "SharePointの大会設定を読み込めません。公式大会には入れません。");
      }
    );
  }

  function renderOfficialWord() {
    var word = state.engine.word;
    if (!word) {
      return;
    }
    text("officialKanji", word.kanji);
    text("officialKana", word.kana);
    text("officialGuide", state.engine.getGuide());
    text("officialTyped", state.engine.typed);
    text("officialProgress", (state.queueIndex + 1) + " / " + state.queue.length);
  }

  function startOfficial() {
    if (!state.officialAuth) {
      openOfficialLogin();
      return;
    }
    if (!state.officialWords.length) {
      window.alert("公式タイピングの問題がありません。");
      return;
    }

    blurInput();
    stopTimer();
    cancelCountdown();

    state.romajiSettings = Settings.cloneSettings(Settings.loadRomaji());
    state.engine = new TypingEngine(state.romajiSettings);
    state.queue = GameRules.shuffle(state.officialWords);
    state.queueIndex = 0;
    state.stats = {
      correctKeys: 0,
      missKeys: 0,
      completed: 0
    };
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
    var elapsed;
    if (!state.active || state.mode !== "official") {
      return;
    }
    elapsed = new Date().getTime() - state.startMs;
    text("officialTime", formatSeconds(elapsed));
  }

  function handleOfficialChar(ch) {
    var result = state.engine.handleChar(ch);
    var finishMs;

    if (result.accepted) {
      state.stats.correctKeys++;
      text("officialTyped", result.typed);

      if (result.complete) {
        state.stats.completed++;
        state.queueIndex++;

        if (state.queueIndex >= state.queue.length) {
          finishMs = new Date().getTime();
          finishOfficial(finishMs - state.startMs);
          return;
        }

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

    state.active = false;
    stopTimer();
    cancelCountdown();

    accuracy = GameRules.calculateAccuracy(state.stats.correctKeys, state.stats.missKeys);

    text("officialResultTime", formatSeconds(timeMs) + " 秒");
    text("officialResultWords", state.stats.completed);
    text("officialResultCorrect", state.stats.correctKeys);
    text("officialResultMiss", state.stats.missKeys);
    text("officialResultAccuracy", accuracy.toFixed(1) + "%");
    text("officialBest", "");
    text("officialRank", "");
    text("officialSaveStatus", "公式記録をSharePointへ保存中...");
    showView("viewOfficialResult");

    saveOfficialResult(timeMs, accuracy);
  }

  function saveOfficialResult(timeMs, accuracy) {
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

    SP.add(state.config.OFFICIAL_RECORD_LIST, record, function () {
      text("officialSaveStatus", "公式記録を保存しました。");
      loadOfficialRanking();
    }, function () {
      text("officialSaveStatus", "公式記録を保存できませんでした。この結果は公式記録になりません。");
    });
  }

  function loadOfficialRanking() {
    SP.load(
      state.config.OFFICIAL_RECORD_LIST,
      ["Id", "Title", "TournamentId", "CourseVersion", "TimeMs", "Miss", "PlayDate"],
      function (items) {
        var bestByPlayer = {};
        var i;
        var item;
        var code;
        var old;
        var list = [];
        var myBest = null;
        var myRank = 0;

        for (i = 0; i < items.length; i++) {
          item = items[i];
          if (String(item.TournamentId || "") !== state.officialAuth.tournamentId) {
            continue;
          }
          if (numberValue(item.CourseVersion, 0) !== state.officialAuth.version) {
            continue;
          }

          code = String(item.Title || "").toUpperCase();
          if (!code) {
            continue;
          }

          item.TimeMs = numberValue(item.TimeMs, 999999999);
          item.Miss = numberValue(item.Miss, 999999);
          old = bestByPlayer[code];

          if (!old || item.TimeMs < old.TimeMs || (item.TimeMs === old.TimeMs && item.Miss < old.Miss)) {
            bestByPlayer[code] = item;
          }
        }

        for (code in bestByPlayer) {
          if (bestByPlayer.hasOwnProperty(code)) {
            list.push({ code: code, time: bestByPlayer[code].TimeMs, miss: bestByPlayer[code].Miss });
          }
        }

        list.sort(function (a, b) {
          if (a.time !== b.time) {
            return a.time - b.time;
          }
          if (a.miss !== b.miss) {
            return a.miss - b.miss;
          }
          return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0);
        });

        for (i = 0; i < list.length; i++) {
          if (list[i].code === state.playerCode) {
            myBest = list[i];
            myRank = i + 1;
            break;
          }
        }

        if (myBest) {
          text("officialBest", "自己ベスト " + formatSeconds(myBest.time) + " 秒");
          text("officialRank", "現在 " + myRank + " 位 / " + list.length + "人");
        }
      },
      function () {
        // 記録保存後のランキング取得失敗は競技結果自体には影響させない。
      }
    );
  }

  function abortOfficial() {
    state.active = false;
    state.mode = "";
    stopTimer();
    cancelCountdown();
    if (state.officialAuth) {
      showView("viewOfficialReady");
      setStatus("公式大会：中止した競技は記録されません");
    } else {
      showHome();
    }
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
    setStatus("準備完了");
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
    } else if (state.mode === "official") {
      handleOfficialChar(ch);
    }
  }

  function bindEvents() {
    $("btnSavePlayer").onclick = function () { savePlayerFromInputs(true); };
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
    $("btnOfficialAgain").onclick = function () {
      if (state.officialAuth) {
        showView("viewOfficialReady");
      } else {
        openOfficialLogin();
      }
    };
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

    showView("viewHome");
    setStatus("問題データ読込完了 / SharePoint接続確認中...");
    updateHomePlayer();
    updateAccessCounter();

    if (state.playerCode) {
      loadPlayerState();
    }
  }

  function loadOfficialCSV() {
    var url = state.config.OFFICIAL_CSV || "official.csv";
    FileData.loadTypingCSV(url, function (words) {
      state.officialWords = words;
      finishDataLoad();
    }, function () {
      state.officialWords = [];
      finishDataLoad();
      setStatus("通常ゲーム利用可能 / official.csvを読み込めないため公式大会は利用できません");
    });
  }

  function loadNormalCSV() {
    var url = state.config.TYPING_CSV || "typing.csv";
    FileData.loadTypingCSV(url, function (words) {
      state.normalWords = words;
      loadOfficialCSV();
    }, function () {
      setStatus("typing.csvを読み込めません。配置場所とファイル名を確認してください。");
      text("viewLoading", "typing.csvを読み込めません。");
    });
  }

  function initWithConfig(config) {
    state.config = config || {};
    Settings.configure(state.config.COOKIE_DAYS || 365);
    SP.init(state.config.WEB_ROOT || "AUTO");
    loadNormalCSV();
  }

  function init() {
    bindEvents();
    showView("viewLoading");
    setStatus("config.txtを読み込んでいます...");

    FileData.loadConfig("config.txt", function (config) {
      initWithConfig(config);
    }, function () {
      setStatus("config.txtを読み込めません。SharePoint上の配置を確認してください。");
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
