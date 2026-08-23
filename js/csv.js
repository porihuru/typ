// csv.js
// IE11 / Edge IE mode compatible text and CSV loader
(function (global) {
  "use strict";

  function requestText(url, success, error) {
    var req = new XMLHttpRequest();
    var cacheBust = (url.indexOf("?") >= 0 ? "&" : "?") + "_=" + new Date().getTime();

    req.open("GET", url + cacheBust, true);
    req.onreadystatechange = function () {
      if (req.readyState !== 4) {
        return;
      }
      if (req.status >= 200 && req.status < 300) {
        if (success) {
          success(req.responseText || "");
        }
      } else {
        if (error) {
          error(req);
        }
      }
    };
    req.send(null);
  }

  function parseConfig(text) {
    var result = {};
    var lines;
    var i;
    var line;
    var pos;
    var key;
    var value;

    text = String(text || "").replace(/^\uFEFF/, "");
    lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

    for (i = 0; i < lines.length; i++) {
      line = lines[i].replace(/^\s+|\s+$/g, "");
      if (!line || line.charAt(0) === "#" || line.charAt(0) === ";") {
        continue;
      }
      pos = line.indexOf("=");
      if (pos < 1) {
        continue;
      }
      key = line.substring(0, pos).replace(/^\s+|\s+$/g, "");
      value = line.substring(pos + 1).replace(/^\s+|\s+$/g, "");
      result[key] = value;
    }

    return result;
  }

  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i;
    var ch;
    var next;

    text = String(text || "").replace(/^\uFEFF/, "");

    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      next = i + 1 < text.length ? text.charAt(i + 1) : "";

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          row.push(field);
          field = "";
        } else if (ch === "\r") {
          if (next === "\n") {
            i++;
          }
          row.push(field);
          field = "";
          rows.push(row);
          row = [];
        } else if (ch === "\n") {
          row.push(field);
          field = "";
          rows.push(row);
          row = [];
        } else {
          field += ch;
        }
      }
    }

    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function rowsToObjects(rows) {
    var result = [];
    var headers;
    var i;
    var j;
    var obj;
    var hasValue;

    if (!rows || rows.length === 0) {
      return result;
    }

    headers = rows[0];

    for (i = 1; i < rows.length; i++) {
      obj = {};
      hasValue = false;
      for (j = 0; j < headers.length; j++) {
        obj[headers[j]] = rows[i][j] !== undefined ? rows[i][j] : "";
        if (obj[headers[j]] !== "") {
          hasValue = true;
        }
      }
      if (hasValue) {
        result.push(obj);
      }
    }

    return result;
  }

  function normalizeTypingRows(objects) {
    var result = [];
    var i;
    var row;
    var id;
    var kanji;
    var kana;
    var level;

    for (i = 0; i < objects.length; i++) {
      row = objects[i];
      id = row.ID || row.Id || row.id || "";
      kanji = row["漢字"] || row.Kanji || "";
      kana = row["ひらがな"] || row.Kana || "";
      level = parseInt(row["レベル"] || row.Level || "0", 10);

      if (!kanji || !kana) {
        continue;
      }

      result.push({
        id: String(id),
        kanji: String(kanji),
        kana: String(kana),
        level: isNaN(level) || level < 1 ? 0 : level
      });
    }

    return result;
  }

  var FileData = {
    loadText: requestText,
    parseConfig: parseConfig,
    parseCSV: parseCSV,
    rowsToObjects: rowsToObjects,
    loadConfig: function (url, success, error) {
      // app.js はIE11互換を保つため従来の config.txt 名で呼ぶ。
      // 実ファイルは config フォルダに配置する。
      if (String(url || "").toLowerCase() === "config.txt") {
        url = "config/config.txt";
      }
      requestText(url, function (text) {
        success(parseConfig(text));
      }, error);
    },
    loadTypingCSV: function (url, success, error) {
      requestText(url, function (text) {
        success(normalizeTypingRows(rowsToObjects(parseCSV(text))));
      }, error);
    }
  };

  global.FileData = FileData;
})(this);
