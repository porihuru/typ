// labels-ja.js
// 右側の記録・ランキングカードを日本語表記に統一する。
// home.js のランキング描画後にも再適用するため、タブ操作時は遅延して反映する。
// ES5 only: IE11 / Edge 95 IE mode compatible
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    var el = $(id);
    if (el) {
      el.innerText = text;
    }
  }

  function findByClass(root, className) {
    if (!root) {
      return [];
    }
    if (root.getElementsByClassName) {
      return root.getElementsByClassName(className);
    }
    return [];
  }

  function translateStaticLabels() {
    var card = findByClass(document, "home-ranking-card")[0];
    var titles;
    var rows;
    var labels = ["プレイヤー", "最高スコア", "経験値", "プレイ回数", "公式ベスト"];
    var i;

    if (!card) {
      return;
    }

    titles = findByClass(card, "home-card-title");
    if (titles.length) {
      if (titles[0].firstChild) {
        titles[0].firstChild.nodeValue = "記録・ランキング\n                ";
      }
    }

    setText("rankTabScore", "スコア");
    setText("rankTabExp", "経験値");
    setText("rankTabPlay", "プレイ回数");
    setText("rankTabOfficial", "公式");

    titles = findByClass(card, "record-summary-title");
    if (titles.length) {
      titles[0].innerText = "自分の記録";
    }

    rows = findByClass(card, "record-summary-row");
    for (i = 0; i < rows.length && i < labels.length; i++) {
      if (rows[i].getElementsByTagName("span").length) {
        rows[i].getElementsByTagName("span")[0].innerText = labels[i];
      }
    }
  }

  function selectedTabName() {
    var ids = ["rankTabScore", "rankTabExp", "rankTabPlay", "rankTabOfficial"];
    var names = ["score", "exp", "play", "official"];
    var i;
    var el;

    for (i = 0; i < ids.length; i++) {
      el = $(ids[i]);
      if (el && (" " + el.className + " ").indexOf(" selected ") >= 0) {
        return names[i];
      }
    }
    return "score";
  }

  function translateDynamicLabels() {
    var tab = selectedTabName();
    var titleMap = {
      score: "通常スコア 上位5名",
      exp: "経験値 上位5名",
      play: "プレイ回数 上位5名",
      official: "公式タイピング 上位5名"
    };
    var condition = $("rankingCondition");
    var list = $("rankingList");
    var text;

    setText("rankingTitle", titleMap[tab] || titleMap.score);

    if (condition) {
      text = condition.innerText || condition.textContent || "";
      if (text === "累計EXP") {
        condition.innerText = "累計経験値";
      }
    }

    if (list && tab === "exp") {
      text = list.innerHTML;
      if (text.indexOf(" EXP") >= 0) {
        list.innerHTML = text.replace(/ EXP/g, " 経験値");
      }
    }
  }

  function applyJapaneseLabels() {
    translateStaticLabels();
    translateDynamicLabels();
  }

  function afterRankingChange() {
    window.setTimeout(applyJapaneseLabels, 0);
    window.setTimeout(applyJapaneseLabels, 1200);
  }

  function bindRankingTabs() {
    var ids = ["rankTabScore", "rankTabExp", "rankTabPlay", "rankTabOfficial"];
    var i;
    var el;

    for (i = 0; i < ids.length; i++) {
      el = $(ids[i]);
      if (!el) {
        continue;
      }
      if (el.addEventListener) {
        el.addEventListener("click", afterRankingChange, false);
      } else if (el.attachEvent) {
        el.attachEvent("onclick", afterRankingChange);
      }
    }
  }

  applyJapaneseLabels();

  if (window.addEventListener) {
    window.addEventListener("load", function () {
      bindRankingTabs();
      applyJapaneseLabels();
      window.setTimeout(applyJapaneseLabels, 1200);
    }, false);
  } else if (window.attachEvent) {
    window.attachEvent("onload", function () {
      bindRankingTabs();
      applyJapaneseLabels();
      window.setTimeout(applyJapaneseLabels, 1200);
    });
  }
})();
