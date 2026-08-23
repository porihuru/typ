// romaji.js
// かな -> ローマ字入力候補 / prefix判定
// ES5 only: IE11 / Edge IE mode compatible
(function (global) {
  "use strict";

  var TABLE = {};
  var CONFIG_ORDER = [];

  function add(kana, options, category, defaults) {
    TABLE[kana] = {
      kana: kana,
      options: options,
      category: category || "基本",
      defaults: defaults && defaults.length ? defaults : [options[0]],
      configurable: options.length > 1
    };
    if (TABLE[kana].configurable) {
      CONFIG_ORDER.push(kana);
    }
  }

  function addSimple(kana, romaji) {
    TABLE[kana] = {
      kana: kana,
      options: [romaji],
      category: "基本",
      defaults: [romaji],
      configurable: false
    };
  }

  // 基本かな
  addSimple("あ", "a"); addSimple("い", "i"); addSimple("う", "u"); addSimple("え", "e"); addSimple("お", "o");
  addSimple("か", "ka"); addSimple("き", "ki"); addSimple("く", "ku"); addSimple("け", "ke"); addSimple("こ", "ko");
  addSimple("さ", "sa"); add("し", ["shi", "si"], "基本"); addSimple("す", "su"); addSimple("せ", "se"); addSimple("そ", "so");
  addSimple("た", "ta"); add("ち", ["chi", "ti"], "基本"); add("つ", ["tsu", "tu"], "基本"); addSimple("て", "te"); addSimple("と", "to");
  addSimple("な", "na"); addSimple("に", "ni"); addSimple("ぬ", "nu"); addSimple("ね", "ne"); addSimple("の", "no");
  addSimple("は", "ha"); addSimple("ひ", "hi"); add("ふ", ["fu", "hu"], "基本"); addSimple("へ", "he"); addSimple("ほ", "ho");
  addSimple("ま", "ma"); addSimple("み", "mi"); addSimple("む", "mu"); addSimple("め", "me"); addSimple("も", "mo");
  addSimple("や", "ya"); addSimple("ゆ", "yu"); addSimple("よ", "yo");
  addSimple("ら", "ra"); addSimple("り", "ri"); addSimple("る", "ru"); addSimple("れ", "re"); addSimple("ろ", "ro");
  addSimple("わ", "wa"); add("を", ["wo", "o"], "基本");

  // 濁音・半濁音
  addSimple("が", "ga"); addSimple("ぎ", "gi"); addSimple("ぐ", "gu"); addSimple("げ", "ge"); addSimple("ご", "go");
  addSimple("ざ", "za"); add("じ", ["ji", "zi"], "基本"); addSimple("ず", "zu"); addSimple("ぜ", "ze"); addSimple("ぞ", "zo");
  addSimple("だ", "da"); add("ぢ", ["ji", "di"], "基本"); add("づ", ["zu", "du"], "基本"); addSimple("で", "de"); addSimple("ど", "do");
  addSimple("ば", "ba"); addSimple("び", "bi"); addSimple("ぶ", "bu"); addSimple("べ", "be"); addSimple("ぼ", "bo");
  addSimple("ぱ", "pa"); addSimple("ぴ", "pi"); addSimple("ぷ", "pu"); addSimple("ぺ", "pe"); addSimple("ぽ", "po");
  addSimple("ゔ", "vu");

  // 拗音
  addSimple("きゃ", "kya"); addSimple("きゅ", "kyu"); addSimple("きょ", "kyo");
  add("しゃ", ["sha", "sya"], "拗音"); add("しゅ", ["shu", "syu"], "拗音"); add("しょ", ["sho", "syo"], "拗音");
  add("ちゃ", ["cha", "tya", "cya"], "拗音"); add("ちゅ", ["chu", "tyu", "cyu"], "拗音"); add("ちょ", ["cho", "tyo", "cyo"], "拗音");
  addSimple("にゃ", "nya"); addSimple("にゅ", "nyu"); addSimple("にょ", "nyo");
  addSimple("ひゃ", "hya"); addSimple("ひゅ", "hyu"); addSimple("ひょ", "hyo");
  addSimple("みゃ", "mya"); addSimple("みゅ", "myu"); addSimple("みょ", "myo");
  addSimple("りゃ", "rya"); addSimple("りゅ", "ryu"); addSimple("りょ", "ryo");
  addSimple("ぎゃ", "gya"); addSimple("ぎゅ", "gyu"); addSimple("ぎょ", "gyo");
  add("じゃ", ["ja", "jya", "zya"], "拗音"); add("じゅ", ["ju", "jyu", "zyu"], "拗音"); add("じょ", ["jo", "jyo", "zyo"], "拗音");
  addSimple("びゃ", "bya"); addSimple("びゅ", "byu"); addSimple("びょ", "byo");
  addSimple("ぴゃ", "pya"); addSimple("ぴゅ", "pyu"); addSimple("ぴょ", "pyo");

  // 外来語・拡張入力
  add("うぃ", ["wi", "whi"], "外来語"); add("うぇ", ["we", "whe"], "外来語"); add("うぉ", ["wo", "who"], "外来語");
  add("いぇ", ["ye", "ixe"], "外来語");
  add("てぃ", ["thi", "texi"], "外来語"); add("でぃ", ["dhi", "dexi"], "外来語");
  add("とぅ", ["twu", "toxu"], "外来語"); add("どぅ", ["dwu", "doxu"], "外来語");
  add("ふぁ", ["fa", "fuxa"], "外来語"); add("ふぃ", ["fi", "fuxi"], "外来語"); add("ふぇ", ["fe", "fuxe"], "外来語"); add("ふぉ", ["fo", "fuxo"], "外来語");
  add("ふゅ", ["fyu", "huxyu"], "外来語");
  add("ゔぁ", ["va", "vuxa"], "外来語"); add("ゔぃ", ["vi", "vuxi"], "外来語"); add("ゔぇ", ["ve", "vuxe"], "外来語"); add("ゔぉ", ["vo", "vuxo"], "外来語");
  add("くぁ", ["qa", "kwa"], "外来語"); add("くぃ", ["qi", "kwi"], "外来語"); add("くぇ", ["qe", "kwe"], "外来語"); add("くぉ", ["qo", "kwo"], "外来語");
  add("ぐぁ", ["gwa", "guxa"], "外来語");

  // 小文字
  add("ぁ", ["xa", "la"], "小文字"); add("ぃ", ["xi", "li"], "小文字"); add("ぅ", ["xu", "lu"], "小文字");
  add("ぇ", ["xe", "le"], "小文字"); add("ぉ", ["xo", "lo"], "小文字");
  add("ゃ", ["xya", "lya"], "小文字"); add("ゅ", ["xyu", "lyu"], "小文字"); add("ょ", ["xyo", "lyo"], "小文字");
  add("ゎ", ["xwa", "lwa"], "小文字");

  // 特殊
  TABLE["ん"] = {
    kana: "ん",
    options: ["n", "nn", "n'"],
    category: "特殊",
    defaults: ["n", "nn"],
    configurable: true
  };
  CONFIG_ORDER.push("ん");

  TABLE["っ"] = {
    kana: "っ",
    options: ["@geminate", "xtu", "ltu"],
    category: "特殊",
    defaults: ["@geminate"],
    configurable: true
  };
  CONFIG_ORDER.push("っ");

  addSimple("ー", "-");
  addSimple("。", ".");
  addSimple("、", ",");
  addSimple("・", "/");
  addSimple(" ", " ");

  function unique(list) {
    var result = [];
    var seen = {};
    var i;
    for (i = 0; i < list.length; i++) {
      if (!seen[list[i]]) {
        seen[list[i]] = true;
        result.push(list[i]);
      }
    }
    return result;
  }

  function contains(list, value) {
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] === value) {
        return true;
      }
    }
    return false;
  }

  function getConfigured(entry, settings) {
    var selected;
    var result = [];
    var i;

    if (!entry) {
      return [];
    }

    selected = settings && settings[entry.kana] ? settings[entry.kana] : entry.defaults;

    for (i = 0; i < entry.options.length; i++) {
      if (contains(selected, entry.options[i])) {
        result.push(entry.options[i]);
      }
    }

    if (result.length === 0) {
      result = entry.defaults.slice(0);
    }

    return result;
  }

  function tokenize(kana) {
    var tokens = [];
    var i = 0;
    var len;
    var part;
    var found;

    kana = String(kana || "");

    while (i < kana.length) {
      found = "";
      for (len = 3; len >= 1; len--) {
        part = kana.substr(i, len);
        if (TABLE[part]) {
          found = part;
          break;
        }
      }

      if (!found) {
        found = kana.charAt(i);
      }

      tokens.push(found);
      i += found.length;
    }

    return tokens;
  }

  function normalOptions(token, settings) {
    var entry = TABLE[token];
    if (entry) {
      return getConfigured(entry, settings);
    }

    // ASCII文字はそのまま入力可能。未対応かなは入力不能にする。
    if (/^[\x20-\x7E]$/.test(token)) {
      return [token.toLowerCase()];
    }

    return [];
  }

  function isAmbiguousAfterN(tokens, index, settings) {
    var next;
    var opts;
    var i;
    var c;

    if (index + 1 >= tokens.length) {
      return false;
    }

    next = tokens[index + 1];
    if (next === "っ") {
      return false;
    }

    opts = normalOptions(next, settings);
    for (i = 0; i < opts.length; i++) {
      c = opts[i].charAt(0);
      if (c === "a" || c === "i" || c === "u" || c === "e" || c === "o" || c === "y" || c === "n") {
        return true;
      }
    }

    return false;
  }

  function optionsFor(tokens, index, settings) {
    var token = tokens[index];
    var entry;
    var selected;
    var result = [];
    var nextOptions;
    var i;
    var c;

    if (token === "ん") {
      entry = TABLE[token];
      selected = getConfigured(entry, settings);
      for (i = 0; i < selected.length; i++) {
        if (selected[i] === "n" && isAmbiguousAfterN(tokens, index, settings)) {
          continue;
        }
        result.push(selected[i]);
      }
      return result.length ? result : ["nn"];
    }

    if (token === "っ") {
      entry = TABLE[token];
      selected = getConfigured(entry, settings);

      for (i = 0; i < selected.length; i++) {
        if (selected[i] !== "@geminate") {
          result.push(selected[i]);
        }
      }

      if (contains(selected, "@geminate") && index + 1 < tokens.length) {
        nextOptions = optionsFor(tokens, index + 1, settings);
        for (i = 0; i < nextOptions.length; i++) {
          c = nextOptions[i].charAt(0);
          if (c && "aiueon".indexOf(c) < 0 && c !== "'" && c !== "-") {
            result.push(c);
          }
        }
      }

      return unique(result.length ? result : ["xtu"]);
    }

    return normalOptions(token, settings);
  }

  function isValidPrefix(kana, input, settings) {
    var tokens = tokenize(kana);
    var memo = {};
    input = String(input || "").toLowerCase();

    function walk(ti, ii) {
      var key = ti + ":" + ii;
      var options;
      var i;
      var opt;
      var remain;
      var compareLen;

      if (memo[key] !== undefined) {
        return memo[key];
      }

      if (ii === input.length) {
        memo[key] = true;
        return true;
      }

      if (ti >= tokens.length) {
        memo[key] = false;
        return false;
      }

      options = optionsFor(tokens, ti, settings);
      remain = input.substring(ii);

      for (i = 0; i < options.length; i++) {
        opt = options[i];
        compareLen = remain.length < opt.length ? remain.length : opt.length;

        if (remain.substring(0, compareLen) !== opt.substring(0, compareLen)) {
          continue;
        }

        if (remain.length < opt.length) {
          memo[key] = true;
          return true;
        }

        if (walk(ti + 1, ii + opt.length)) {
          memo[key] = true;
          return true;
        }
      }

      memo[key] = false;
      return false;
    }

    return walk(0, 0);
  }

  function isComplete(kana, input, settings) {
    var tokens = tokenize(kana);
    var memo = {};
    input = String(input || "").toLowerCase();

    function walk(ti, ii) {
      var key = ti + ":" + ii;
      var options;
      var i;
      var opt;

      if (memo[key] !== undefined) {
        return memo[key];
      }

      if (ti === tokens.length && ii === input.length) {
        memo[key] = true;
        return true;
      }

      if (ti >= tokens.length || ii >= input.length) {
        memo[key] = false;
        return false;
      }

      options = optionsFor(tokens, ti, settings);
      for (i = 0; i < options.length; i++) {
        opt = options[i];
        if (input.substr(ii, opt.length) === opt && walk(ti + 1, ii + opt.length)) {
          memo[key] = true;
          return true;
        }
      }

      memo[key] = false;
      return false;
    }

    return walk(0, 0);
  }

  function getGuide(kana, settings) {
    var tokens = tokenize(kana);
    var result = "";
    var i;
    var opts;

    for (i = 0; i < tokens.length; i++) {
      opts = optionsFor(tokens, i, settings);
      result += opts.length ? opts[0] : "?";
    }

    return result;
  }

  function optionLabel(value) {
    if (value === "@geminate") {
      return "子音を重ねる";
    }
    return value;
  }

  function getConfigurableGroups() {
    var groups = [];
    var i;
    var entry;
    var j;
    var opts;

    for (i = 0; i < CONFIG_ORDER.length; i++) {
      entry = TABLE[CONFIG_ORDER[i]];
      opts = [];
      for (j = 0; j < entry.options.length; j++) {
        opts.push({
          value: entry.options[j],
          label: optionLabel(entry.options[j]),
          defaultOn: contains(entry.defaults, entry.options[j])
        });
      }
      groups.push({
        key: entry.kana,
        label: entry.kana,
        category: entry.category,
        options: opts
      });
    }

    return groups;
  }

  function getDefaultSettings() {
    var result = {};
    var i;
    var entry;
    for (i = 0; i < CONFIG_ORDER.length; i++) {
      entry = TABLE[CONFIG_ORDER[i]];
      result[entry.kana] = entry.defaults.slice(0);
    }
    return result;
  }

  global.Romaji = {
    tokenize: tokenize,
    isValidPrefix: isValidPrefix,
    isComplete: isComplete,
    getGuide: getGuide,
    getConfigurableGroups: getConfigurableGroups,
    getDefaultSettings: getDefaultSettings
  };
})(this);
