// settings.js
// Cookie保存: プレイヤーコード / ローマ字入力方式 / ローカル識別子
(function (global) {
  "use strict";

  var ROMAJI_COOKIE = "typ_romaji";
  var PLAYER_COOKIE = "typ_player";
  var CLIENT_COOKIE = "typ_client_id";
  var cookieDays = 365;

  function getCookie(name) {
    var target = name + "=";
    var parts = document.cookie ? document.cookie.split(";") : [];
    var i;
    var item;

    for (i = 0; i < parts.length; i++) {
      item = parts[i].replace(/^\s+/, "");
      if (item.indexOf(target) === 0) {
        try {
          return decodeURIComponent(item.substring(target.length));
        } catch (e) {
          return item.substring(target.length);
        }
      }
    }
    return "";
  }

  function setCookie(name, value, days) {
    var expires = "";
    var date;

    if (days && days > 0) {
      date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }

    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/";
  }

  function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  }

  function clearSavedData() {
    deleteCookie(ROMAJI_COOKIE);
    deleteCookie(PLAYER_COOKIE);
    deleteCookie(CLIENT_COOKIE);
  }

  function cloneSettings(source) {
    var result = {};
    var key;
    for (key in source) {
      if (source.hasOwnProperty(key)) {
        result[key] = source[key] && source[key].slice ? source[key].slice(0) : source[key];
      }
    }
    return result;
  }

  function loadRomaji() {
    var defaults = Romaji.getDefaultSettings();
    var raw = getCookie(ROMAJI_COOKIE);
    var saved;
    var groups;
    var i;
    var key;
    var valid = {};
    var j;
    var value;

    if (!raw) {
      return defaults;
    }

    try {
      saved = JSON.parse(raw);
    } catch (e) {
      return defaults;
    }

    groups = Romaji.getConfigurableGroups();
    for (i = 0; i < groups.length; i++) {
      key = groups[i].key;
      valid = {};
      for (j = 0; j < groups[i].options.length; j++) {
        valid[groups[i].options[j].value] = true;
      }

      if (saved[key] && saved[key].length) {
        defaults[key] = [];
        for (j = 0; j < saved[key].length; j++) {
          value = saved[key][j];
          if (valid[value]) {
            defaults[key].push(value);
          }
        }
        if (defaults[key].length === 0) {
          defaults[key] = Romaji.getDefaultSettings()[key];
        }
      }
    }

    return defaults;
  }

  function saveRomaji(settings) {
    setCookie(ROMAJI_COOKIE, JSON.stringify(settings), cookieDays);
  }

  function pad3(numberText) {
    var n = parseInt(numberText, 10);
    if (isNaN(n) || n < 0 || n > 999) {
      return "";
    }
    if (n < 10) {
      return "00" + n;
    }
    if (n < 100) {
      return "0" + n;
    }
    return String(n);
  }

  function makePlayerCode(numberText, nickText) {
    var number = pad3(numberText);
    var nick = String(nickText || "").replace(/\s/g, "").toUpperCase();

    if (!number || !/^[A-Z]{2}$/.test(nick)) {
      return "";
    }

    return number + "-" + nick;
  }

  function savePlayerCode(code) {
    if (!/^\d{3}-[A-Z]{2}$/.test(String(code || ""))) {
      return false;
    }
    setCookie(PLAYER_COOKIE, code, cookieDays);
    return true;
  }

  function loadPlayerCode() {
    var value = getCookie(PLAYER_COOKIE).toUpperCase();
    if (/^\d{3}-[A-Z]{2}$/.test(value)) {
      return value;
    }
    return "";
  }

  function createClientId() {
    var now = new Date().getTime().toString(36);
    var random = Math.floor(Math.random() * 2147483647).toString(36);
    return "C" + now + random;
  }

  function getClientId() {
    var value = getCookie(CLIENT_COOKIE);
    if (!value) {
      value = createClientId();
      setCookie(CLIENT_COOKIE, value, 3650);
    }
    return value;
  }

  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function renderRomaji(container, settings) {
    var groups = Romaji.getConfigurableGroups();
    var categories = ["基本", "拗音", "小文字", "特殊", "外来語"];
    var c;
    var i;
    var j;
    var group;
    var section;
    var title;
    var row;
    var kana;
    var label;
    var check;

    clearElement(container);

    for (c = 0; c < categories.length; c++) {
      section = document.createElement("div");
      section.className = "setting-section";

      title = document.createElement("h3");
      title.appendChild(document.createTextNode(categories[c]));
      section.appendChild(title);

      for (i = 0; i < groups.length; i++) {
        group = groups[i];
        if (group.category !== categories[c]) {
          continue;
        }

        row = document.createElement("div");
        row.className = "romaji-setting-row";

        kana = document.createElement("span");
        kana.className = "setting-kana";
        kana.appendChild(document.createTextNode(group.label));
        row.appendChild(kana);

        for (j = 0; j < group.options.length; j++) {
          label = document.createElement("label");
          label.className = "setting-option";

          check = document.createElement("input");
          check.type = "checkbox";
          check.setAttribute("data-romaji-key", group.key);
          check.setAttribute("data-romaji-value", group.options[j].value);
          check.checked = settings[group.key] && arrayContains(settings[group.key], group.options[j].value);

          label.appendChild(check);
          label.appendChild(document.createTextNode(" " + group.options[j].label));
          row.appendChild(label);
        }

        section.appendChild(row);
      }

      container.appendChild(section);
    }
  }

  function arrayContains(list, value) {
    var i;
    if (!list) {
      return false;
    }
    for (i = 0; i < list.length; i++) {
      if (list[i] === value) {
        return true;
      }
    }
    return false;
  }

  function readRomajiFrom(container) {
    var groups = Romaji.getConfigurableGroups();
    var defaults = Romaji.getDefaultSettings();
    var result = {};
    var inputs = container.getElementsByTagName("input");
    var i;
    var key;
    var value;

    for (i = 0; i < groups.length; i++) {
      result[groups[i].key] = [];
    }

    for (i = 0; i < inputs.length; i++) {
      if (inputs[i].type !== "checkbox" || !inputs[i].checked) {
        continue;
      }
      key = inputs[i].getAttribute("data-romaji-key");
      value = inputs[i].getAttribute("data-romaji-value");
      if (key && value && result[key]) {
        result[key].push(value);
      }
    }

    for (key in result) {
      if (result.hasOwnProperty(key) && result[key].length === 0) {
        result[key] = defaults[key].slice(0);
      }
    }

    return result;
  }

  global.Settings = {
    configure: function (days) {
      var n = parseInt(days, 10);
      if (!isNaN(n) && n > 0) {
        cookieDays = n;
      }
    },
    loadRomaji: loadRomaji,
    saveRomaji: saveRomaji,
    renderRomaji: renderRomaji,
    readRomajiFrom: readRomajiFrom,
    makePlayerCode: makePlayerCode,
    savePlayerCode: savePlayerCode,
    loadPlayerCode: loadPlayerCode,
    getClientId: getClientId,
    getCookie: getCookie,
    setCookie: setCookie,
    clearSavedData: clearSavedData,
    cloneSettings: cloneSettings
  };
})(this);
