// sp.js
// SharePoint REST API 共通処理
// 接続・読込・追加・修正・削除
// ES5 / XMLHttpRequest only
(function (global) {
  "use strict";

  var SP = {
    webRoot: "",
    api: "",
    digest: "",
    digestExpire: 0,
    entityTypes: {}
  };

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

  /*
   * webRoot:
   *   /sites/typing のようにconfig.txtから指定
   *   AUTO または空文字なら現在URLから自動判定
   */
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

  /* listTitle, columns, success(items), error(xhr) */
  SP.load = function (listTitle, columns, success, error) {
    var title = escapeListTitle(listTitle);
    var url = SP.api + "/web/lists/getbytitle('" + title + "')/items?$top=5000";

    if (columns && columns.length) {
      url += "&$select=" + encodeURIComponent(columns.join(","));
    }

    xhr(
      "GET",
      url,
      { "Accept": "application/json;odata=verbose" },
      null,
      function (req) {
        var data;
        try {
          data = JSON.parse(req.responseText);
          success(data.d.results || []);
        } catch (e) {
          if (error) {
            error(req);
          }
        }
      },
      error
    );
  };

  SP.add = function (listTitle, data, success, error) {
    getEntityType(listTitle, function (entityType) {
      getDigest(function (digest) {
        var title = escapeListTitle(listTitle);
        var body = { "__metadata": { "type": entityType } };
        var key;

        for (key in data) {
          if (data.hasOwnProperty(key)) {
            body[key] = data[key];
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
  };

  SP.update = function (listTitle, itemId, data, success, error) {
    getEntityType(listTitle, function (entityType) {
      getDigest(function (digest) {
        var title = escapeListTitle(listTitle);
        var body = { "__metadata": { "type": entityType } };
        var key;

        for (key in data) {
          if (data.hasOwnProperty(key)) {
            body[key] = data[key];
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
