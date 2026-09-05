// 福井しりとりスクリーンセーバー
// 「福井」から開始し、全国名字ランキング1000位以内の名字だけでしりとりする。
// 2秒ごとに表示、次がなければ「ここでおわり」を出して5秒後に再開。一度使った名字は再利用しない。

(function () {
  "use strict";

  var STEP_MS = 2000;
  var END_MS = 5000;
  var START_KANJI = "福井";

  var SMALL = {
    "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お",
    "ゃ": "や", "ゅ": "ゆ", "ょ": "よ", "っ": "つ", "ゎ": "わ", "ゔ": "う"
  };
  var VOICED = {
    "が": "か", "ぎ": "き", "ぐ": "く", "げ": "け", "ご": "こ",
    "ざ": "さ", "じ": "し", "ず": "す", "ぜ": "せ", "ぞ": "そ",
    "だ": "た", "ぢ": "ち", "づ": "つ", "で": "て", "ど": "と",
    "ば": "は", "び": "ひ", "ぶ": "ふ", "べ": "へ", "ぼ": "ほ",
    "ぱ": "は", "ぴ": "ひ", "ぷ": "ふ", "ぺ": "へ", "ぽ": "ほ", "ゔ": "う"
  };

  function normChar(ch) {
    if (SMALL[ch]) ch = SMALL[ch];
    if (VOICED[ch]) ch = VOICED[ch];
    return ch;
  }
  function firstKana(yomi) {
    return normChar(yomi.charAt(0));
  }
  function lastKana(yomi) {
    var s = yomi.replace(/ー+$/, "");
    if (!s) return "ん";
    var ch = s.charAt(s.length - 1);
    if (ch === "ー" && s.length >= 2) ch = s.charAt(s.length - 2);
    return normChar(ch);
  }
  function rawLast(yomi) {
    var s = yomi.replace(/ー+$/, "");
    return s.charAt(s.length - 1);
  }

  var byKanji = {};
  MYOJI_DATA.forEach(function (d) { byKanji[d.kanji] = d; });

  var used = new Set();
  var chain = [];
  var timerId = null;
  var paused = false;
  var phase = "show"; // 'show' | 'end'
  var endCountdownId = null;
  var endTimeoutId = null;

  var elCard = document.getElementById("card");
  var elEnd = document.getElementById("endCard");
  var elYomi = document.getElementById("yomi");
  var elKanji = document.getElementById("kanji");
  var elRank = document.getElementById("rank");
  var elPop = document.getElementById("pop");
  var elLink = document.getElementById("linkLine");
  var elBridge = document.getElementById("bridge");
  var elStep = document.getElementById("stepBadge");
  var elHistory = document.getElementById("history");
  var elEndReason = document.getElementById("endReason");
  var elEndStat = document.getElementById("endStat");
  var elCountNum = document.getElementById("countNum");
  var elCountBar = document.getElementById("countBar");

  function candidatesFor(kana) {
    return MYOJI_DATA.filter(function (d) {
      return !used.has(d.kanji) && firstKana(d.yomi) === kana;
    });
  }

  function chooseNext(current) {
    var need = lastKana(current.yomi);
    var cand = candidatesFor(need);
    if (cand.length === 0) return null;
    // 「ん」で終わる名字を選ぶと直後に詰むので強く避ける。
    // 1手先の候補数を数えて、行き止まりになりにくいものを優先（上位3つからランダム）。
    function score(d) {
      if (d.yomi.endsWith("ん")) return -10000;
      var lk = lastKana(d.yomi);
      var onward = 0;
      for (var i = 0; i < MYOJI_DATA.length; i++) {
        var x = MYOJI_DATA[i];
        if (x.kanji === d.kanji || used.has(x.kanji)) continue;
        if (firstKana(x.yomi) === lk) onward++;
      }
      if (onward === 0) return -1000;
      return onward * 10 + Math.random();
    }
    var scored = cand.map(function (d) { return { d: d, s: score(d) }; });
    scored.sort(function (a, b) { return b.s - a.s; });
    var top = scored.slice(0, Math.min(3, scored.length));
    return top[Math.floor(Math.random() * top.length)].d;
  }

  function fmt(n) { return n.toLocaleString("ja-JP"); }

  function render(entry, prev) {
    elYomi.textContent = entry.yomi;
    elKanji.textContent = entry.kanji;
    elRank.textContent = fmt(entry.rank);
    elPop.textContent = entry.pop;
    if (!prev) {
      elLink.textContent = "「福井」から スタート（全国" + fmt(entry.rank) + "位）";
    } else {
      elLink.textContent =
        "「" + prev.kanji + "（" + prev.yomi + "）」の おわり「" + rawLast(prev.yomi) + "」 → 「" + entry.kanji + "（" + entry.yomi + "）」";
    }
    var lk = lastKana(entry.yomi);
    elBridge.innerHTML = "";
    var a = document.createElement("span");
    a.className = "bridge-end";
    a.textContent = "おわり「" + rawLast(entry.yomi) + "」";
    var ar = document.createElement("span");
    ar.className = "bridge-arrow";
    ar.textContent = "→";
    var b = document.createElement("span");
    b.className = "bridge-next";
    b.textContent = "つぎは「" + lk + "」から";
    elBridge.appendChild(a); elBridge.appendChild(ar); elBridge.appendChild(b);
    elStep.textContent = chain.length + " 手目";
    elCard.classList.remove("swap");
    void elCard.offsetWidth;
    elCard.classList.add("swap");
    renderHistory();
  }

  function renderHistory() {
    elHistory.innerHTML = "";
    var tail = chain.slice(-10);
    tail.forEach(function (d, i) {
      var chip = document.createElement("span");
      chip.className = "chip" + (i === tail.length - 1 ? " current" : "");
      chip.textContent = d.kanji;
      var sm = document.createElement("small");
      sm.textContent = d.yomi;
      chip.appendChild(sm);
      elHistory.appendChild(chip);
    });
  }

  function clearTimers() {
    if (timerId) { clearTimeout(timerId); timerId = null; }
    if (endCountdownId) { clearInterval(endCountdownId); endCountdownId = null; }
    if (endTimeoutId) { clearTimeout(endTimeoutId); endTimeoutId = null; }
  }

  function schedule(ms, fn) {
    clearTimeout(timerId);
    timerId = setTimeout(function () {
      timerId = null;
      if (!paused) fn();
      else schedule(300, fn); // 一時停止中は待機
    }, ms);
  }

  function tick() {
    if (phase !== "show") return;
    var cur = chain[chain.length - 1];
    var nxt = chooseNext(cur);
    if (!nxt) {
      showEnd(cur);
      return;
    }
    chain.push(nxt);
    used.add(nxt.kanji);
    render(nxt, cur);
    schedule(STEP_MS, tick);
  }

  function showEnd(last) {
    phase = "end";
    elCard.classList.add("hidden");
    elEnd.classList.remove("hidden");
    var lk = lastKana(last.yomi);
    var reason;
    if (rawLast(last.yomi) === "ん" || lk === "ん") {
      reason = "「" + last.kanji + "（" + last.yomi + "）」は「ん」で おわるので、つぎに つなげられません。";
    } else {
      reason = "「" + last.kanji + "（" + last.yomi + "）」の おわり「" + rawLast(last.yomi) + "」から はじまる、まだ使っていない名字（1000位以内）が ありません。";
    }
    elEndReason.textContent = reason;
    elEndStat.textContent = "今回の しりとり： 全 " + chain.length + " 手（「福井」から「" + last.kanji + "」まで・重複なし）";
    elStep.textContent = "おわり（全" + chain.length + "手）";

    var remain = END_MS / 1000;
    elCountNum.textContent = String(remain);
    elCountBar.style.width = "100%";
    endCountdownId = setInterval(function () {
      if (paused) return;
      remain -= 1;
      if (remain < 0) remain = 0;
      elCountNum.textContent = String(remain);
      elCountBar.style.width = (remain / (END_MS / 1000)) * 100 + "%";
    }, 1000);
    endTimeoutId = setTimeout(function () {
      if (paused) {
        // 一時停止中なら再開まで待つ
        var waiter = setInterval(function () {
          if (!paused) { clearInterval(waiter); restart(); }
        }, 300);
        return;
      }
      restart();
    }, END_MS);
  }

  function restart() {
    clearTimers();
    used = new Set();
    chain = [];
    phase = "show";
    elEnd.classList.add("hidden");
    elCard.classList.remove("hidden");
    var start = byKanji[START_KANJI];
    chain.push(start);
    used.add(start.kanji);
    render(start, null);
    schedule(STEP_MS, tick);
  }

  // ---- controls ----
  var btnPause = document.getElementById("btnPause");
  var btnRestart = document.getElementById("btnRestart");
  var btnFull = document.getElementById("btnFull");
  var btnRule = document.getElementById("btnRule");
  var ruleModal = document.getElementById("ruleModal");
  var btnCloseRule = document.getElementById("btnCloseRule");

  function setPaused(p) {
    paused = p;
    btnPause.textContent = paused ? "▶ 再開" : "⏸ 一時停止";
  }
  btnPause.addEventListener("click", function () { setPaused(!paused); });
  btnRestart.addEventListener("click", function () { setPaused(false); restart(); });
  btnFull.addEventListener("click", function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(function () {});
  });
  btnRule.addEventListener("click", function () { ruleModal.classList.remove("hidden"); });
  btnCloseRule.addEventListener("click", function () { ruleModal.classList.add("hidden"); });
  ruleModal.addEventListener("click", function (e) { if (e.target === ruleModal) ruleModal.classList.add("hidden"); });
  document.addEventListener("keydown", function (e) {
    if (e.code === "Space") { e.preventDefault(); setPaused(!paused); }
    else if (e.key === "r" || e.key === "R") { setPaused(false); restart(); }
    else if (e.key === "f" || e.key === "F") { btnFull.click(); }
    else if (e.key === "Escape") { ruleModal.classList.add("hidden"); }
  });

  // ---- start ----
  restart();
})();
