// accesscounter.js
// SharePoint accesscounter リストの読込・加算・診断表示
// 1ページ読込につき1回だけカウントアップする。
// ES5 only: IE11 / Edge 95 IE mode compatible
(function () {
  "use strict";

  var countedThisPage = false;
  var config = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var el = $(id);
    if (el) {
      el.innerText = String(value === null || value === undefined ? "" : value);
    }
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

  function numberValue(value, fallback) {
    var n = parseInt(value, 10);
    return isNaN(n) ? fallback : n;
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
        message = "要求が不正です。accesscounter の列名・内部名を確認してください。";
      } else if (status === 401) {
        message = "SharePointの認証が必要です。";
      } else if (status === 403) {
        message = "権限がありません。accesscounter の閲覧・追加・編集権限を確認してください。";
      } else if (status === 404) {
        message = "見つかりません。WEB_ROOTまたはaccesscounterリスト名を確認してください。";
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

  function findTotal(items) {
    var i;
    for (i = 0; i < items.length; i++) {
      if (String(items[i].Title || "").toLowerCase() === "total") {
        return items[i];
      }
    }
    return null;
  }

  function readCounter(increment) {
    var listName;

    if (!config) {
      setDiag("counterread", "ng", "NG", "config未読込");
      return;
    }

    listName = config.COUNTER_LIST || "accesscounter";
    setDiag("counterread", "wait", "確認中", listName + " を読み込んでいます...");

    SP.load(
      listName,
      ["Id", "Title", "Count"],
      function (items) {
        var total = findTotal(items);
        var current = total ? numberValue(total.Count, 0) : 0;

        setDiag("counterread", "ok", "OK", listName + " / " + items.length + "件読込成功 / 現在 " + current);
        setText("accessCount", current);

        if (!increment || countedThisPage) {
          setDiag("counterwrite", "ok", "OK", "読込のみ / 現在 " + current);
          return;
        }

        countedThisPage = true;
        writeCounter(listName, total, current + 1);
      },
      function (req) {
        var detail = getSharePointError(req);
        setDiag("counterread", "ng", "NG", detail);
        setDiag("counterwrite", "skip", "未実施", "読込に失敗したため加算しません");
        setText("accessCount", "---");
      }
    );
  }

  function writeCounter(listName, total, next) {
    setDiag("counterwrite", "wait", "書込中", "アクセス数を " + next + " に更新中...");

    function success() {
      setText("accessCount", next);
      setDiag("counterwrite", "ok", "OK", "カウントアップ成功 / " + next);
    }

    function error(req) {
      setDiag("counterwrite", "ng", "NG", getSharePointError(req));
    }

    if (total) {
      SP.update(listName, total.Id, { Count: next }, success, error);
    } else {
      SP.add(listName, { Title: "total", Count: next }, success, error);
    }
  }

  function loadConfigAndRun(increment) {
    setDiag("counterread", "wait", "確認中", "config/config.txt を確認しています...");
    setDiag("counterwrite", "wait", "未確認", "accesscounter 読込後に確認");

    FileData.loadConfig("config/config.txt", function (loaded) {
      config = loaded || {};
      SP.init(config.WEB_ROOT || "AUTO");
      readCounter(increment);
    }, function (req) {
      setDiag("counterread", "ng", "NG", "config/config.txt 読込失敗 / HTTP " + (req && typeof req.status !== "undefined" ? req.status : 0));
      setDiag("counterwrite", "skip", "未実施", "configを読み込めないため未実施");
      setText("accessCount", "---");
    });
  }

  function bindRetry() {
    var button = $("btnRetryAccessCounter");
    if (button) {
      button.onclick = function () {
        loadConfigAndRun(false);
      };
    }
  }

  function init() {
    bindRetry();
    loadConfigAndRun(true);
  }

  if (window.addEventListener) {
    window.addEventListener("load", init, false);
  } else if (window.attachEvent) {
    window.attachEvent("onload", init);
  } else {
    window.onload = init;
  }
})();
