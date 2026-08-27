// name-unique.js
// 6文字プレイヤー名の重複登録防止
// ES5 only: IE11 / Edge 95 IE mode compatible
(function () {
  "use strict";

  var checking = false;

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeName(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
  }

  function isSixName(value) {
    return /^[A-Z0-9]{6}$/.test(String(value || "").toUpperCase());
  }

  function setMessage(message) {
    var el = $("playerNameDialogMessage");
    if (el) { el.innerText = message || ""; }
  }

  function setBusy(busy) {
    var button = $("btnPlayerNameDialogSave");
    if (!button) { return; }
    button.disabled = !!busy;
    button.innerText = busy ? "確認中..." : "決定";
  }

  function stopEvent(e) {
    e = e || window.event;
    if (e.preventDefault) { e.preventDefault(); }
    e.returnValue = false;
    if (e.stopImmediatePropagation) { e.stopImmediatePropagation(); }
    else if (e.stopPropagation) { e.stopPropagation(); }
    e.cancelBubble = true;
  }

  function nameExists(items, name) {
    var i;
    var itemName;
    for (i = 0; i < items.length; i++) {
      itemName = normalizeName(items[i].Title || "");
      if (itemName === name) { return true; }
    }
    return false;
  }

  function approveAndSave(button) {
    checking = false;
    setBusy(false);
    button.__nameUniqueApproved = true;
    if (button.click) {
      button.click();
    } else if (button.fireEvent) {
      button.fireEvent("onclick");
    }
  }

  function loadPlayers(success, failure) {
    if (!window.FileData || !FileData.loadConfig || !window.SP || !SP.load) {
      if (failure) { failure(); }
      return;
    }

    FileData.loadConfig("config/config.txt", function (config) {
      var listName;
      config = config || {};
      listName = config.PLAYER_LIST || "players";

      try {
        if (!SP.api && SP.init) { SP.init(config.WEB_ROOT || "AUTO"); }
      } catch (e) {}

      SP.load(
        listName,
        ["Id", "Title", "ClientId"],
        function (items) {
          if (success) { success(items || []); }
        },
        function () {
          if (failure) { failure(); }
        }
      );
    }, function () {
      if (failure) { failure(); }
    });
  }

  function handleSaveClick(e) {
    var button = $("btnPlayerNameDialogSave");
    var target = e ? (e.target || e.srcElement) : null;
    var input;
    var name;
    var currentName = "";

    if (!button || target !== button) { return; }

    if (button.__nameUniqueApproved) {
      button.__nameUniqueApproved = false;
      return;
    }

    stopEvent(e);
    if (checking) { return; }

    input = $("playerNameDialogInput");
    name = normalizeName(input ? input.value : "");

    if (!isSixName(name)) {
      setMessage("英数字6文字で入力してください。");
      return;
    }

    try {
      if (window.Settings && Settings.loadPlayerCode) {
        currentName = normalizeName(Settings.loadPlayerCode());
      }
    } catch (ex) {}

    // 変更画面で現在の名前をそのまま確定する場合は重複チェック不要。
    if (currentName && name === currentName) {
      approveAndSave(button);
      return;
    }

    checking = true;
    setBusy(true);
    setMessage("名前の重複を確認中...");

    loadPlayers(function (items) {
      if (nameExists(items, name)) {
        checking = false;
        setBusy(false);
        setMessage("この名前はすでに登録されています。別の名前を入力してください。");
        try {
          if (input) { input.focus(); input.select(); }
        } catch (focusError) {}
        return;
      }

      setMessage("");
      approveAndSave(button);
    }, function () {
      // SharePoint未接続でも、従来どおりゲーム全体を停止させない。
      setMessage("");
      approveAndSave(button);
    });
  }

  // 既存の保存処理より先に捕捉して、重複確認が終わるまで保存を止める。
  if (document.addEventListener) {
    document.addEventListener("click", handleSaveClick, true);
  } else if (document.attachEvent) {
    document.attachEvent("onclick", handleSaveClick);
  }
})();
