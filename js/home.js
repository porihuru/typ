// home.js
// トップ画面のランキング表示と折りたたみ設定
// SharePoint: players / normalrecords / officialrecords
// ES5 only: IE11 / Edge 95 IE mode compatible
(function () {
  "use strict";

  var config = {};
  var currentTab = "score";
  var currentPlayerCode = "";
  var currentClientId = "";
  var rankings = {
    score: { title: "通常スコア TOP 5", condition: "", entries: [], error: "" },
    exp: { title: "EXP TOP 5", condition: "累計EXP", entries: [], error: "" },
    play: { title: "PLAY TOP 5", condition: "プレイ回数", entries: [], error: "" },
    official: { title: "公式スプリント TOP 5", condition: "最速タイム", entries: [], error: "" }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var el = $(id);
    if (el) {
      el.innerText = String(value === null || value === undefined ? "" : value);
    }
  }

  function numberValue(value, fallback) {
    var n = parseFloat(value);
    return isNaN(n) ? fallback : n;
  }

  function upper(value) {
    return String(value === null || value === undefined ? "" : value).toUpperCase();
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatOfficial(ms) {
    var n = numberValue(ms, -1);
    if (n < 0) {
      return "---";
    }
    return (n / 1000).toFixed(3) + " 秒";
  }

  function playerIdentity(item) {
    var client = String(item.ClientId || "");
    var code = upper(item.Title || "");
    if (client) {
      return "client:" + client;
    }
    if (code) {
      return "code:" + code;
    }
    return "id:" + String(item.Id || Math.random());
  }

  function normalIdentity(item) {
    var client = String(item.ClientId || "");
    var code = upper(item.Title || "");
    return client ? "client:" + client : "code:" + code;
  }

  function findCurrentPlayer(items) {
    var i;
    var code = upper(currentPlayerCode);
    for (i = 0; i < items.length; i++) {
      if (currentClientId && String(items[i].ClientId || "") === currentClientId) {
        return items[i];
      }
    }
    for (i = 0; i < items.length; i++) {
      if (code && upper(items[i].Title) === code) {
        return items[i];
      }
    }
    return null;
  }

  function buildPlayerRankings(items) {
    var rows = [];
    var used = {};
    var i;
    var key;
    var current;

    for (i = 0; i < items.length; i++) {
      key = playerIdentity(items[i]);
      if (used[key]) {
        continue;
      }
      used[key] = true;
      if (!items[i].Title) {
        continue;
      }
      rows.push({
        code: upper(items[i].Title),
        exp: numberValue(items[i].EXP, 0),
        plays: numberValue(items[i].Plays, 0),
        best: numberValue(items[i].BestScore, 0)
      });
    }

    rows.sort(function (a, b) {
      if (a.exp !== b.exp) { return b.exp - a.exp; }
      if (a.best !== b.best) { return b.best - a.best; }
      return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0);
    });
    rankings.exp.entries = [];
    for (i = 0; i < rows.length; i++) {
      rankings.exp.entries.push({ code: rows[i].code, value: rows[i].exp, display: Math.round(rows[i].exp) + " EXP" });
    }

    rows.sort(function (a, b) {
      if (a.plays !== b.plays) { return b.plays - a.plays; }
      if (a.exp !== b.exp) { return b.exp - a.exp; }
      return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0);
    });
    rankings.play.entries = [];
    for (i = 0; i < rows.length; i++) {
      rankings.play.entries.push({ code: rows[i].code, value: rows[i].plays, display: Math.round(rows[i].plays) + " 回" });
    }

    current = findCurrentPlayer(items);
    setText("recordPlayer", current ? upper(current.Title) : (currentPlayerCode || "---"));
    setText("recordBestScore", current ? Math.round(numberValue(current.BestScore, 0)) : "0");
    setText("recordExp", current ? Math.round(numberValue(current.EXP, 0)) : "0");
    setText("recordPlays", current ? Math.round(numberValue(current.Plays, 0)) : "0");
  }

  function buildNormalRanking(items) {
    var mode = String(numberValue(config.NORMAL_SECONDS, 10)) + "SEC";
    var bestByPlayer = {};
    var list = [];
    var i;
    var item;
    var key;
    var score;
    var accuracy;
    var old;
    var hasMode = false;

    for (i = 0; i < items.length; i++) {
      if (String(items[i].Mode || "")) {
        hasMode = true;
        break;
      }
    }

    for (i = 0; i < items.length; i++) {
      item = items[i];
      if (hasMode && upper(item.Mode) !== upper(mode)) {
        continue;
      }
      if (!item.Title) {
        continue;
      }
      key = normalIdentity(item);
      score = numberValue(item.Score, 0);
      accuracy = numberValue(item.Accuracy, 0);
      old = bestByPlayer[key];
      if (!old || score > old.score || (score === old.score && accuracy > old.accuracy)) {
        bestByPlayer[key] = {
          code: upper(item.Title),
          score: score,
          accuracy: accuracy
        };
      }
    }

    for (key in bestByPlayer) {
      if (bestByPlayer.hasOwnProperty(key)) {
        list.push(bestByPlayer[key]);
      }
    }

    list.sort(function (a, b) {
      if (a.score !== b.score) { return b.score - a.score; }
      if (a.accuracy !== b.accuracy) { return b.accuracy - a.accuracy; }
      return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0);
    });

    rankings.score.entries = [];
    rankings.score.condition = String(numberValue(config.NORMAL_SECONDS, 10)) + "秒";
    for (i = 0; i < list.length; i++) {
      rankings.score.entries.push({
        code: list[i].code,
        value: list[i].score,
        display: Math.round(list[i].score) + " pt"
      });
    }
  }

  function buildOfficialRanking(items) {
    var tournamentId = String(config.TOURNAMENT_ID || "official01").toLowerCase();
    var version = parseInt(config.OFFICIAL_WORDS_VERSION, 10);
    var bestByPlayer = {};
    var list = [];
    var i;
    var item;
    var code;
    var time;
    var miss;
    var old;
    var myBest = null;

    if (isNaN(version)) {
      version = 1;
    }

    for (i = 0; i < items.length; i++) {
      item = items[i];
      if (String(item.TournamentId || "").toLowerCase() !== tournamentId) {
        continue;
      }
      if (parseInt(item.CourseVersion, 10) !== version) {
        continue;
      }
      code = upper(item.Title || "");
      if (!code) {
        continue;
      }
      time = numberValue(item.TimeMs, 999999999);
      miss = numberValue(item.Miss, 999999);
      old = bestByPlayer[code];
      if (!old || time < old.time || (time === old.time && miss < old.miss)) {
        bestByPlayer[code] = { code: code, time: time, miss: miss };
      }
    }

    for (code in bestByPlayer) {
      if (bestByPlayer.hasOwnProperty(code)) {
        list.push(bestByPlayer[code]);
      }
    }

    list.sort(function (a, b) {
      if (a.time !== b.time) { return a.time - b.time; }
      if (a.miss !== b.miss) { return a.miss - b.miss; }
      return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0);
    });

    rankings.official.entries = [];
    rankings.official.condition = "official01 / v" + version;
    for (i = 0; i < list.length; i++) {
      rankings.official.entries.push({
        code: list[i].code,
        value: list[i].time,
        display: formatOfficial(list[i].time)
      });
      if (list[i].code === upper(currentPlayerCode)) {
        myBest = list[i];
      }
    }

    setText("recordOfficialBest", myBest ? formatOfficial(myBest.time) : "---");
  }

  function renderRanking() {
    var data = rankings[currentTab];
    var listEl = $("rankingList");
    var html = "";
    var i;
    var position = 0;
    var current = upper(currentPlayerCode);
    var entry;

    setText("rankingTitle", data.title);
    setText("rankingCondition", data.condition || "");

    if (!listEl) {
      return;
    }

    if (data.error) {
      listEl.innerHTML = '<div class="ranking-empty">' + escapeHtml(data.error) + '</div>';
      setText("rankingMyPosition", "あなたの順位：---");
      return;
    }

    if (!data.entries.length) {
      listEl.innerHTML = '<div class="ranking-empty">まだ記録がありません</div>';
      setText("rankingMyPosition", "あなたの順位：---");
      return;
    }

    for (i = 0; i < data.entries.length && i < 5; i++) {
      entry = data.entries[i];
      html += '<div class="ranking-row">' +
        '<span class="ranking-pos">' + (i + 1) + '位</span>' +
        '<span class="ranking-player">' + escapeHtml(entry.code) + '</span>' +
        '<span class="ranking-value">' + escapeHtml(entry.display) + '</span>' +
        '<div class="clear"></div></div>';
    }
    listEl.innerHTML = html;

    if (current) {
      for (i = 0; i < data.entries.length; i++) {
        if (upper(data.entries[i].code) === current) {
          position = i + 1;
          break;
        }
      }
    }

    if (position) {
      setText("rankingMyPosition", "あなたの順位：" + position + "位 / " + data.entries.length + "人");
    } else {
      setText("rankingMyPosition", "あなたの順位：記録なし");
    }
  }

  function selectTab(name) {
    var ids = {
      score: "rankTabScore",
      exp: "rankTabExp",
      play: "rankTabPlay",
      official: "rankTabOfficial"
    };
    var key;
    var button;

    currentTab = name;
    for (key in ids) {
      if (ids.hasOwnProperty(key)) {
        button = $(ids[key]);
        if (button) {
          button.className = key === name ? "ranking-tab selected" : "ranking-tab";
        }
      }
    }
    renderRanking();
  }

  function setRankingError(name, message) {
    rankings[name].entries = [];
    rankings[name].error = message;
    if (currentTab === name) {
      renderRanking();
    }
  }

  function clearErrors() {
    rankings.score.error = "";
    rankings.exp.error = "";
    rankings.play.error = "";
    rankings.official.error = "";
  }

  function loadRankings() {
    setText("recordPlayer", Settings.loadPlayerCode() || "---");
    currentPlayerCode = Settings.loadPlayerCode() || "";
    currentClientId = Settings.getClientId();
    clearErrors();

    FileData.loadConfig("config/config.txt", function (loaded) {
      config = loaded || {};
      SP.init(config.WEB_ROOT || "AUTO");
      rankings.score.condition = String(numberValue(config.NORMAL_SECONDS, 10)) + "秒";
      rankings.official.condition = String(config.TOURNAMENT_ID || "official01") + " / v" + String(config.OFFICIAL_WORDS_VERSION || "1");

      SP.load(
        config.PLAYER_LIST || "players",
        ["Id", "Title", "ClientId", "EXP", "Plays", "BestScore"],
        function (items) {
          buildPlayerRankings(items || []);
          if (currentTab === "exp" || currentTab === "play") {
            renderRanking();
          }
        },
        function () {
          setRankingError("exp", "players を読み込めません");
          setRankingError("play", "players を読み込めません");
        }
      );

      SP.load(
        config.NORMAL_RECORD_LIST || "normalrecords",
        ["Id", "Title", "ClientId", "Score", "Accuracy", "Mode", "PlayDate"],
        function (items) {
          buildNormalRanking(items || []);
          if (currentTab === "score") {
            renderRanking();
          }
        },
        function () {
          setRankingError("score", "normalrecords を読み込めません");
        }
      );

      SP.load(
        config.OFFICIAL_RECORD_LIST || "officialrecords",
        ["Id", "Title", "TournamentId", "CourseVersion", "TimeMs", "Miss", "PlayDate"],
        function (items) {
          buildOfficialRanking(items || []);
          if (currentTab === "official") {
            renderRanking();
          }
        },
        function () {
          setRankingError("official", "officialrecords を読み込めません");
          setText("recordOfficialBest", "---");
        }
      );
    }, function () {
      setRankingError("score", "config を読み込めません");
      setRankingError("exp", "config を読み込めません");
      setRankingError("play", "config を読み込めません");
      setRankingError("official", "config を読み込めません");
    });
  }

  function toggleTools() {
    var body = $("homeToolsBody");
    var button = $("btnToggleTools");
    var open;
    if (!body || !button) {
      return;
    }
    open = body.className.indexOf(" open") >= 0;
    if (open) {
      body.className = body.className.replace(" open", "");
      button.innerText = "設定・接続テストを表示 ▼";
      button.setAttribute("aria-expanded", "false");
    } else {
      body.className += " open";
      button.innerText = "設定・接続テストを閉じる ▲";
      button.setAttribute("aria-expanded", "true");
    }
  }

  function addRefreshAfterClick(id, delay) {
    var el = $(id);
    if (!el) {
      return;
    }
    if (el.addEventListener) {
      el.addEventListener("click", function () {
        window.setTimeout(loadRankings, delay || 800);
      }, false);
    } else if (el.attachEvent) {
      el.attachEvent("onclick", function () {
        window.setTimeout(loadRankings, delay || 800);
      });
    }
  }

  function bindEvents() {
    var button;

    button = $("btnToggleTools");
    if (button) { button.onclick = toggleTools; }

    button = $("rankTabScore");
    if (button) { button.onclick = function () { selectTab("score"); }; }
    button = $("rankTabExp");
    if (button) { button.onclick = function () { selectTab("exp"); }; }
    button = $("rankTabPlay");
    if (button) { button.onclick = function () { selectTab("play"); }; }
    button = $("rankTabOfficial");
    if (button) { button.onclick = function () { selectTab("official"); }; }

    addRefreshAfterClick("btnNormalHome", 900);
    addRefreshAfterClick("btnOfficialHome", 900);
    addRefreshAfterClick("btnSavePlayer", 1200);
    addRefreshAfterClick("btnRetryAll", 900);
  }

  function init() {
    bindEvents();
    selectTab("score");
    window.setTimeout(loadRankings, 900);
  }

  if (window.addEventListener) {
    window.addEventListener("load", init, false);
  } else if (window.attachEvent) {
    window.attachEvent("onload", init);
  } else {
    window.onload = init;
  }
})();
