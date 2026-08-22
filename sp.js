// 2026-08-22 22:31 sp.js
// SharePoint REST API 共通処理
// 接続・読込・追加・修正・削除

(function (global) {
  "use strict";

  var SP = {
    webRoot: "",
    api: "",
    digest: "",
    digestExpire: 0,
    entityTypes: {}
  };


  /* =========================================================
     1. 初期化
     現在URLから SharePoint Webルートと _api を自動取得
     ========================================================= */

  SP.init = function () {

    var path = window.location.pathname;
    var lower = path.toLowerCase();
    var pos = lower.indexOf("/doclib/");

    if (pos >= 0) {
      SP.webRoot = path.substring(0, pos);
    } else {
      var last = path.lastIndexOf("/");
      SP.webRoot = last > 0 ? path.substring(0, last) : "";
    }

    SP.api = SP.webRoot + "/_api";
  };


  /* =========================================================
     共通 XHR
     ========================================================= */

  function xhr(method, url, headers, body, success, error) {

    var req = new XMLHttpRequest();

    req.open(method, url, true);

    if (headers) {
      for (var key in headers) {
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

      } else {

        if (error) {
          error(req);
        }
      }
    };

    req.send(body || null);
  }


  /* =========================================================
     リスト名の ' 対策
     ========================================================= */

  function escapeListTitle(title) {
    return String(title).replace(/'/g, "''");
  }


  /* =========================================================
     2. FormDigest取得
     ========================================================= */

  function getDigest(success, error) {

    var now = new Date().getTime();

    if (SP.digest && SP.digestExpire > now) {
      success(SP.digest);
      return;
    }

    xhr(
      "POST",
      SP.api + "/contextinfo",
      {
        "Accept": "application/json;odata=verbose"
      },
      null,

      function (req) {

        try {

          var data = JSON.parse(req.responseText);
          var info = data.d.GetContextWebInformation;

          SP.digest = info.FormDigestValue;

          SP.digestExpire =
            new Date().getTime() +
            ((info.FormDigestTimeoutSeconds - 30) * 1000);

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


  /* =========================================================
     EntityType取得
     ========================================================= */

  function getEntityType(listTitle, success, error) {

    if (SP.entityTypes[listTitle]) {
      success(SP.entityTypes[listTitle]);
      return;
    }

    var title = escapeListTitle(listTitle);

    var url =
      SP.api +
      "/web/lists/getbytitle('" +
      title +
      "')?$select=ListItemEntityTypeFullName";

    xhr(
      "GET",
      url,
      {
        "Accept": "application/json;odata=verbose"
      },
      null,

      function (req) {

        try {

          var data = JSON.parse(req.responseText);

          var entityType =
            data.d.ListItemEntityTypeFullName;

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


  /* =========================================================
     3. 読込

     listTitle : リスト名
     columns   : ["Id","Title","Category"] 等
     ========================================================= */

  SP.load = function (listTitle, columns, success, error) {

    var title = escapeListTitle(listTitle);

    var url =
      SP.api +
      "/web/lists/getbytitle('" +
      title +
      "')/items?$top=5000";

    if (columns && columns.length) {

      url +=
        "&$select=" +
        encodeURIComponent(columns.join(","));
    }

    xhr(
      "GET",
      url,
      {
        "Accept": "application/json;odata=verbose"
      },
      null,

      function (req) {

        try {

          var data = JSON.parse(req.responseText);

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


  /* =========================================================
     4. 追加

     data例
     {
       Title: "○○商事",
       Phone: "011-123-4567"
     }
     ========================================================= */

  SP.add = function (listTitle, data, success, error) {

    getEntityType(
      listTitle,

      function (entityType) {

        getDigest(
          function (digest) {

            var title = escapeListTitle(listTitle);

            var body = {
              "__metadata": {
                "type": entityType
              }
            };

            var key;

            for (key in data) {
              if (data.hasOwnProperty(key)) {
                body[key] = data[key];
              }
            }

            xhr(
              "POST",

              SP.api +
              "/web/lists/getbytitle('" +
              title +
              "')/items",

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
                  }
                }

                if (success) {
                  success(result);
                }
              },

              error
            );
          },

          error
        );
      },

      error
    );
  };


  /* =========================================================
     5. 修正

     itemId : SharePoint ID

     data例
     {
       Title: "変更後名称",
       Phone: "011-999-9999"
     }
     ========================================================= */

  SP.update = function (
    listTitle,
    itemId,
    data,
    success,
    error
  ) {

    getEntityType(
      listTitle,

      function (entityType) {

        getDigest(
          function (digest) {

            var title = escapeListTitle(listTitle);

            var body = {
              "__metadata": {
                "type": entityType
              }
            };

            var key;

            for (key in data) {
              if (data.hasOwnProperty(key)) {
                body[key] = data[key];
              }
            }

            xhr(
              "POST",

              SP.api +
              "/web/lists/getbytitle('" +
              title +
              "')/items(" +
              itemId +
              ")",

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
          },

          error
        );
      },

      error
    );
  };


  /* =========================================================
     6. 削除
     ========================================================= */

  SP.remove = function (
    listTitle,
    itemId,
    success,
    error
  ) {

    getDigest(
      function (digest) {

        var title = escapeListTitle(listTitle);

        xhr(
          "POST",

          SP.api +
          "/web/lists/getbytitle('" +
          title +
          "')/items(" +
          itemId +
          ")",

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
      },

      error
    );
  };


  global.SP = SP;

})(this);
