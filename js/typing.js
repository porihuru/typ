// typing.js
// タイピング判定・ランク・スコア共通処理
(function (global) {
  "use strict";

  function TypingEngine(settings) {
    this.settings = settings || Romaji.getDefaultSettings();
    this.word = null;
    this.typed = "";
  }

  TypingEngine.prototype.setSettings = function (settings) {
    this.settings = settings || Romaji.getDefaultSettings();
  };

  TypingEngine.prototype.setWord = function (word) {
    this.word = word || null;
    this.typed = "";
  };

  TypingEngine.prototype.getGuide = function () {
    if (!this.word) {
      return "";
    }
    return Romaji.getGuide(this.word.kana, this.settings);
  };

  TypingEngine.prototype.handleChar = function (ch) {
    var candidate;

    if (!this.word || !ch) {
      return { accepted: false, miss: false, complete: false, typed: this.typed };
    }

    ch = String(ch).toLowerCase();
    candidate = this.typed + ch;

    if (Romaji.isValidPrefix(this.word.kana, candidate, this.settings)) {
      this.typed = candidate;
      return {
        accepted: true,
        miss: false,
        complete: Romaji.isComplete(this.word.kana, this.typed, this.settings),
        typed: this.typed
      };
    }

    return {
      accepted: false,
      miss: true,
      complete: false,
      typed: this.typed
    };
  };

  function keyToChar(e) {
    var code = e.which || e.keyCode;

    if (e.ctrlKey || e.altKey || e.metaKey) {
      return "";
    }

    if (code >= 65 && code <= 90) {
      return String.fromCharCode(code + 32);
    }
    if (code >= 48 && code <= 57) {
      return String.fromCharCode(code);
    }
    if (code === 189 || code === 109) {
      return "-";
    }
    if (code === 188) {
      return ",";
    }
    if (code === 190 || code === 110) {
      return ".";
    }
    if (code === 191 || code === 111) {
      return "/";
    }
    if (code === 222) {
      return "'";
    }
    if (code === 32) {
      return " ";
    }

    return "";
  }

  function shuffle(list) {
    var array = list.slice(0);
    var i;
    var j;
    var temp;

    for (i = array.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }

    return array;
  }

  function estimateLevel(word) {
    var kana = word && word.kana ? String(word.kana) : "";
    var len = kana.length;
    var level;

    if (word && word.level && word.level > 0) {
      return word.level > 5 ? 5 : word.level;
    }

    if (len <= 3) {
      level = 1;
    } else if (len <= 5) {
      level = 2;
    } else if (len <= 8) {
      level = 3;
    } else if (len <= 12) {
      level = 4;
    } else {
      level = 5;
    }

    if (/[っゃゅょぁぃぅぇぉゔ]/.test(kana) && level < 5) {
      level++;
    }

    return level;
  }

  function filterWords(words, maxLevel) {
    var result = [];
    var i;
    for (i = 0; i < words.length; i++) {
      if (estimateLevel(words[i]) <= maxLevel) {
        result.push(words[i]);
      }
    }
    return result.length ? result : words.slice(0);
  }

  var RANKS = [
    { rank: 1, name: "ビギナー", exp: 0, maxLevel: 1 },
    { rank: 2, name: "ルーキー", exp: 500, maxLevel: 1 },
    { rank: 3, name: "ブロンズ", exp: 1500, maxLevel: 2 },
    { rank: 4, name: "シルバー", exp: 3000, maxLevel: 2 },
    { rank: 5, name: "ゴールド", exp: 5000, maxLevel: 3 },
    { rank: 6, name: "プラチナ", exp: 8000, maxLevel: 3 },
    { rank: 7, name: "ダイヤモンド", exp: 12000, maxLevel: 4 },
    { rank: 8, name: "マスター", exp: 18000, maxLevel: 4 },
    { rank: 9, name: "エキスパート", exp: 25000, maxLevel: 5 },
    { rank: 10, name: "タイピングマスター", exp: 35000, maxLevel: 5 }
  ];

  function getRankByExp(exp) {
    var value = parseInt(exp, 10);
    var result = RANKS[0];
    var i;

    if (isNaN(value) || value < 0) {
      value = 0;
    }

    for (i = 0; i < RANKS.length; i++) {
      if (value >= RANKS[i].exp) {
        result = RANKS[i];
      } else {
        break;
      }
    }

    return result;
  }

  function getRankByNumber(rankNumber) {
    var n = parseInt(rankNumber, 10);
    if (isNaN(n) || n < 1) {
      n = 1;
    }
    if (n > RANKS.length) {
      n = RANKS.length;
    }
    return RANKS[n - 1];
  }

  function getNextRank(exp) {
    var current = getRankByExp(exp);
    if (current.rank >= RANKS.length) {
      return null;
    }
    return RANKS[current.rank];
  }

  function calculateAccuracy(correct, miss) {
    var total = correct + miss;
    if (total <= 0) {
      return 100;
    }
    return Math.round((correct / total) * 1000) / 10;
  }

  function calculateExp(stats) {
    var accuracy = calculateAccuracy(stats.correctKeys, stats.missKeys);
    var exp = (stats.completed * 10) + stats.correctKeys;

    if (accuracy >= 100) {
      exp += 200;
    } else if (accuracy >= 98) {
      exp += 100;
    } else if (accuracy >= 95) {
      exp += 50;
    }

    if (stats.maxCombo >= 30) {
      exp += 100;
    } else if (stats.maxCombo >= 20) {
      exp += 50;
    } else if (stats.maxCombo >= 10) {
      exp += 20;
    }

    return exp;
  }

  function calculateScore(stats) {
    return (stats.correctKeys * 10) + (stats.completed * 100);
  }

  global.TypingEngine = TypingEngine;
  global.TypingInput = {
    keyToChar: keyToChar
  };
  global.GameRules = {
    ranks: RANKS,
    shuffle: shuffle,
    estimateLevel: estimateLevel,
    filterWords: filterWords,
    getRankByExp: getRankByExp,
    getRankByNumber: getRankByNumber,
    getNextRank: getNextRank,
    calculateAccuracy: calculateAccuracy,
    calculateExp: calculateExp,
    calculateScore: calculateScore
  };
})(this);
