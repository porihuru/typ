// sp.js
// SharePoint REST API 共通処理
// 接続・読込・追加・修正・削除
// SharePointカスタム列は英小文字で統一
// 表示名からInternalNameを自動解決する
// ES5 / XMLHttpRequest only
(function (global) {
  "use strict";

  var FIELD_MAP = {
    "Title": "key",
    "ClientId": "clientid",
    "EXP": "exp",
    "Rank": "rank",
    "Plays": "plays",
    "BestScore": "bestscore",
    "Score": "score",
    "Accuracy": "accuracy",
    "CorrectKeys": "correctkeys",
    "MissKeys": "misskeys",
    "Completed": "completed",
    "MaxCombo": "maxcombo",
    "Mode": "mode",
    "PlayDate": "playdate",
    "TournamentId": "tournamentid",
    "CourseVersion": "courseversion",
    "TimeMs": "timems",
    "Miss": "miss",
    "RecordType": "recordtype",
    "EntryPassword": "entrypassword",
    "Active": "active",
    "PlayerCode": "playercode",
    "Count": "count"
  };

  /* 現在のSharePoint側の表記ゆれも吸収する */
  var FIELD_ALIASES = {
    "tournamentid": ["tournamentid", "tournamentyid"],
    "timems": ["timems", "times"]
  };

  var SP = {
    webRoot: "",
    api: "",
    digest: "",
    digestExpire: 0,
    entityTypes: {},
    fieldSchemas: {},
    fieldMap: FIELD_MAP
  };

  function trimLower(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/^\s+|\s+$/g, "")
      .toLowerCase();
  }

  function detectWebRoot() {
    var path = window.location.pathname;
    var lower = path.toLowerCase();
    var pos = lower.indexOf("/doclib/");
    var last;

    if (pos >= 0) {
      return path.substring(0, pos);
    }

    last = path.lastIndexOf("/");
    return last > 0 ? path.substring(0, last) : "";
  }

  SP.init = function (webRoot) {
    var root = String(webRoot || "").replace(/^\s+|\s+$/g, "");

    if (!root || root.toUpperCase() === "AUTO") {
      root = detectWebRoot();
    }

    if (root.length > 1 && root.charAt(root.length - 1) === "/") {
      root = root.substring(0, root.length - 1);
    }

    SP.webRoot = root;
    SP.api = SP.webRoot + "/_api";
    SP.digest = "";
    SP.digestExpire = 0;
    SP.entityTypes = {};
    SP.fieldSchemas = {};

    return SP.webRoot;
  };

  function xhr(method, url, headers, body, success, error) {
    var req = new XMLHttpRequest();
    var key;

    req.open(method, url, true);

    if (headers) {
      for (key in headers) {
        if (headers.hasOwnProperty(key)) {
          req.setRequestHeader(key, headers[key]);
        }
      }
    }

    req.onreadystatechange = function () {
      if (req.readyState !== 4) {
        return;
      }

      if (req.status >= 200 && req.status < 300) {
        if (success) {
          success(req);
        }
      } else if (error) {
        error(req);
      }
    };

    req.send(body || null);
  }

  function escapeListTitle(title) {
    return String(title).replace(/'/g, "''");
  }

  function getDigest(success, error) {
    var now = new Date().getTime();

    if (SP.digest && SP.digestExpire > now) {
      success(SP.digest);
      return;
    }

    xhr(
      "POST",
      SP.api + "/contextinfo",
      { "Accept": "application/json;odata=verbose" },
      null,
      function (req) {
        var data;
        var info;
        try {
          data = JSON.parse(req.responseText);
          info = data.d.GetContextWebInformation;
          SP.digest = info.FormDigestValue;
          SP.digestExpire = new Date().getTime() + ((info.FormDigestTimeoutSeconds - 30) * 1000);
          success(SP.digest);
        } catch (e) {
          if (error) {
            error(req);
          }
        }
      },
      error
    );
  }

  function getEntityType(listTitle, success, error) {
    var title;
    var url;

    if (SP.entityTypes[listTitle]) {
      success(SP.entityTypes[listTitle]);
      return;
    }

    title = escapeListTitle(listTitle);
    url = SP.api + "/web/lists/getbytitle('" + title + "')?$select=ListItemEntityTypeFullName";

    xhr(
      "GET",
      url,
      { "Accept": "application/json;odata=verbose" },
      null,
      function (req) {
        var data;
        var entityType;
        try {
          data = JSON.parse(req.responseText);
          entityType = data.d.ListItemEntityTypeFullName;
          SP.entityTypes[listTitle] = entityType;
          success(entityType);
        } catch (e) {
          if (error) {
            error(req);
          }
        }
      },
      error
    );
  }

  function loadFieldSchema(listTitle, success, error) {
    var title;
    var url;

    if (SP.fieldSchemas[listTitle]) {
      success(SP.fieldSchemas[listTitle]);
      return;
    }

    title = escapeListTitle(listTitle);
    url = SP.api + "/web/lists/getbytitle('" + title + "')/fields?$select=Title,InternalName,TypeAsString";

    xhr(
      "GET",
      url,
      { "Accept": "application/json;odata=verbose" },
      null,
      function (req) {
        var data;
        var fields;
        var schema = { byName: {}, fields: [] };
        var i;
        var info;

        try {
          data = JSON.parse(req.responseText);
          fields = data.d.results || [];

          for (i = 0; i < fields.length; i++) {
            info = {
              title: fields[i].Title,
              internalName: fields[i].InternalName,
              type: fields[i].TypeAsString || ""
            };
            schema.fields.push(info);
            schema.byName[trimLower(info.title)] = info;
            schema.byName[trimLower(info.internalName)] = info;
          }

          SP.fieldSchemas[listTitle] = schema;
          success(schema);
        } catch (e) {
          if (error) {
            error(req);
          }
        }
      },
      error
    );
  }

  function preferredName(logicalName) {
    var s = String(logicalName || "");
    if (s === "Id" || s === "ID") {
      return "Id";
    }
    if (FIELD_MAP.hasOwnProperty(s)) {
      return FIELD_MAP[s];
    }
    return s.toLowerCase();
  }

  function resolveFieldInfo(logicalName, schema) {
    var preferred = preferredName(logicalName);
    var aliases;
    var i;
    var info;

    if (preferred === "Id") {
      return { title: "ID", internalName: "Id", type: "Counter" };
    }

    info = schema.byName[trimLower(preferred)];
    if (info) {
      return info;
    }

    aliases = FIELD_ALIASES[trimLower(preferred)] || [];
    for (i = 0; i < aliases.length; i++) {
      info = schema.byName[trimLower(aliases[i])];
      if (info) {
        return info;
      }
    }

    return { title: preferred, internalName: preferred, type: "" };
  }

  function mapColumns(columns, schema) {
    var result = [];
    var used = {};
    var i;
    var info;
    var name;

    for (i = 0; i < columns.length; i++) {
      info = resolveFieldInfo(columns[i], schema);
      name = info.internalName;
      if (!used[name]) {
        used[name] = true;
        result.push(name);
      }
    }

    return result;
  }

  function normalizeItem(item, schema) {
    var logical;
    var info;

    if (!item) {
      return item;
    }

    for (logical in FIELD_MAP) {
      if (FIELD_MAP.hasOwnProperty(logical)) {
        info = resolveFieldInfo(logical, schema);
        if (typeof item[logical] === "undefined" && typeof item[info.internalName] !== "undefined") {
          item[logical] = item[info.internalName];
        }
      }
    }

    if (typeof item.Id === "undefined" && typeof item.ID !== "undefined") {
      item.Id = item.ID;
    }

    return item;
  }

  function coerceValue(value, info, logicalName) {
    var type = trimLower(info.type);
    var n;
    var d;

    if (value === null || value === undefined) {
      return value;
    }

    if (type === "text" || type === "note" || type === "choice") {
      return String(value);
    }

    if (type === "boolean") {
      if (value === true || value === false) {
        return value;
      }
      return trimLower(value) === "true" || String(value) === "1" || trimLower(value) === "yes";
    }

    if (type === "number" || type === "currency" || type === "integer" || type === "counter") {
      if (typeof value === "number") {
        return value;
      }

      n = parseFloat(value);
      if (!isNaN(n)) {
        return n;
      }

      if (String(logicalName) === "PlayDate") {
        d = new Date(value);
        if (!isNaN(d.getTime())) {
          return d.getTime();
        }
      }
    }

    if (type === "datetime") {
      if (typeof value === "number") {
        d = new Date(value);
        if (d.toISOString) {
          return d.toISOString();
        }
      }
      return value;
    }

    return value;
  }

  function mapData(data, includeSystemTitle, schema) {
    var result = {};
    var key;
    var info;

    for (key in data) {
      if (data.hasOwnProperty(key)) {
        info = resolveFieldInfo(key, schema);
        result[info.internalName] = coerceValue(data[key], info, key);

        if (includeSystemTitle && key === "Title") {
          result.Title = String(data[key]);
        }
      }
    }

    return result;
  }

  SP.load = function (listTitle, columns, success, error) {
    loadFieldSchema(listTitle, function (schema) {
      var title = escapeListTitle(listTitle);
      var selectColumns;
      var url = SP.api + "/web/lists/getbytitle('" + title + "')/items?$top=5000";

      if (columns && columns.length) {
        selectColumns = mapColumns(columns, schema);
        url += "&$select=" + encodeURIComponent(selectColumns.join(","));
      }

      xhr(
        "GET",
        url,
        { "Accept": "application/json;odata=verbose" },
        null,
        function (req) {
          var data;
          var items;
          var i;

          try {
            data = JSON.parse(req.responseText);
            items = data.d.results || [];

            for (i = 0; i < items.length; i++) {
              normalizeItem(items[i], schema);
            }

            success(items);
          } catch (e) {
            if (error) {
              error(req);
            }
          }
        },
        error
      );
    }, error);
  };

  SP.add = function (listTitle, data, success, error) {
    loadFieldSchema(listTitle, function (schema) {
      getEntityType(listTitle, function (entityType) {
        getDigest(function (digest) {
          var title = escapeListTitle(listTitle);
          var mapped = mapData(data, true, schema);
          var body = { "__metadata": { "type": entityType } };
          var key;

          for (key in mapped) {
            if (mapped.hasOwnProperty(key)) {
              body[key] = mapped[key];
            }
          }

          xhr(
            "POST",
            SP.api + "/web/lists/getbytitle('" + title + "')/items",
            {
              "Accept": "application/json;odata=verbose",
              "Content-Type": "application/json;odata=verbose",
              "X-RequestDigest": digest
            },
            JSON.stringify(body),
            function (req) {
              var result = null;
              if (req.responseText) {
                try {
                  result = JSON.parse(req.responseText);
                  if (result && result.d) {
                    normalizeItem(result.d, schema);
                  }
                } catch (e) {
                  result = null;
                }
              }
              if (success) {
                success(result);
              }
            },
            error
          );
        }, error);
      }, error);
    }, error);
  };

  SP.update = function (listTitle, itemId, data, success, error) {
    loadFieldSchema(listTitle, function (schema) {
      getEntityType(listTitle, function (entityType) {
        getDigest(function (digest) {
          var title = escapeListTitle(listTitle);
          var mapped = mapData(data, true, schema);
          var body = { "__metadata": { "type": entityType } };
          var key;

          for (key in mapped) {
            if (mapped.hasOwnProperty(key)) {
              body[key] = mapped[key];
            }
          }

          xhr(
            "POST",
            SP.api + "/web/lists/getbytitle('" + title + "')/items(" + itemId + ")",
            {
              "Accept": "application/json;odata=verbose",
              "Content-Type": "application/json;odata=verbose",
              "X-RequestDigest": digest,
              "X-HTTP-Method": "MERGE",
              "IF-MATCH": "*"
            },
            JSON.stringify(body),
            function () {
              if (success) {
                success();
              }
            },
            error
          );
        }, error);
      }, error);
    }, error);
  };

  SP.remove = function (listTitle, itemId, success, error) {
    getDigest(function (digest) {
      var title = escapeListTitle(listTitle);

      xhr(
        "POST",
        SP.api + "/web/lists/getbytitle('" + title + "')/items(" + itemId + ")",
        {
          "Accept": "application/json;odata=verbose",
          "X-RequestDigest": digest,
          "X-HTTP-Method": "DELETE",
          "IF-MATCH": "*"
        },
        null,
        function () {
          if (success) {
            success();
          }
        },
        error
      );
    }, error);
  };

  global.SP = SP;
})(this);
