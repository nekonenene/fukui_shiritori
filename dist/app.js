// 福井しりとりスクリーンセーバー（漢字しりとり版）
// 「福井」から開始し、全国名字ランキング2000位以内の名字だけでつなげる。
// つながりは漢字で判定：前の名字の最後の一文字 → 次の名字の最初の一文字（例：池田→田中→中川）。
// 読み・順位・人数もあわせて表示。2秒ごとに表示、次がなければ「ここでおわり」を出して5秒後に再開。一度使った名字は再利用しない。

(function () {
  "use strict";

  var STEP_MS = 2000;
  var END_MS = 5000;
  var START_KANJI = "福井";

  // 漢字しりとりの判定：最初の一文字・最後の一文字（1文字の名字はその1文字が両方になる）
  function firstKanji(entry) {
    return entry.kanji.charAt(0);
  }
  function lastKanji(entry) {
    return entry.kanji.charAt(entry.kanji.length - 1);
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

  function candidatesFor(ch) {
    return MYOJI_DATA.filter(function (d) {
      return !used.has(d.kanji) && firstKanji(d) === ch;
    });
  }

  function onwardCount(d) {
    var lk = lastKanji(d);
    var n = 0;
    for (var i = 0; i < MYOJI_DATA.length; i++) {
      var x = MYOJI_DATA[i];
      if (x.kanji === d.kanji || used.has(x.kanji)) continue;
      if (firstKanji(x) === lk) n++;
    }
    return n;
  }

  function chooseNext(current) {
    var need = lastKanji(current);
    var cand = candidatesFor(need);
    if (cand.length === 0) return null;
    // 行き止まりの字で終わる名字は避ける（全候補が行き止まりのときだけ許す）。
    // あとは純粋ランダムで毎回違う展開にする。
    var alive = cand.filter(function (d) { return onwardCount(d) > 0; });
    var pool = alive.length > 0 ? alive : cand;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function fmt(n) { return n.toLocaleString("ja-JP"); }

  // ウィンドウの縦・横から「できるだけ大きい」基本サイズを決め、
  // 横にはみ出す場合だけ自動で縮小する。
  function fitLine(el, base) {
    var size = Math.max(12, Math.floor(base));
    el.style.fontSize = size + "px";
    var min = Math.max(10, Math.floor(base * 0.3));
    var guard = 400;
    while (guard-- > 0 && size > min &&
           (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)) {
      size -= 2;
      el.style.fontSize = size + "px";
    }
  }
  function pageOverflows() {
    return document.body.scrollHeight > window.innerHeight + 1;
  }
  function fitMain() {
    if (elCard.classList.contains("hidden")) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var klen = Array.from(elKanji.textContent).length;
    var kBase = Math.min(
      vw * (klen <= 2 ? 0.30 : klen === 3 ? 0.20 : 0.15),
      vh * 0.32
    );
    fitLine(elKanji, kBase);
    fitLine(elYomi, Math.min(vw * 0.055, vh * 0.075));
    // ページ全体が縦にはみ出す場合は名字をさらに縮小し、スクロールを出さない
    var size = parseFloat(elKanji.style.fontSize) || kBase;
    var guard = 200;
    while (guard-- > 0 && size > 24 && pageOverflows()) {
      size -= 4;
      elKanji.style.fontSize = size + "px";
    }
  }
  function fitEnd() {
    if (elEnd.classList.contains("hidden")) return;
    var title = elEnd.querySelector(".end-title");
    var size = Math.min(window.innerWidth * 0.09, window.innerHeight * 0.12);
    title.style.fontSize = Math.floor(size) + "px";
    var guard = 200;
    while (guard-- > 0 && size > 24 && pageOverflows()) {
      size -= 4;
      title.style.fontSize = Math.floor(size) + "px";
    }
  }

  function render(entry, prev) {
    elYomi.textContent = entry.yomi;
    elKanji.textContent = entry.kanji;
    elRank.textContent = fmt(entry.rank);
    elPop.textContent = entry.pop;
    if (!prev) {
      elLink.textContent = "「福井」から スタート（全国" + fmt(entry.rank) + "位）";
    } else {
      elLink.textContent =
        "「" + prev.kanji + "」の おわり「" + lastKanji(prev) + "」 → 「" + entry.kanji + "」のはじまり「" + firstKanji(entry) + "」";
    }
    var lk = lastKanji(entry);
    elBridge.innerHTML = "";
    var a = document.createElement("span");
    a.className = "bridge-end";
    a.textContent = "おわり「" + lastKanji(entry) + "」";
    var ar = document.createElement("span");
    ar.className = "bridge-arrow";
    ar.textContent = "→";
    var b = document.createElement("span");
    b.className = "bridge-next";
    b.textContent = "つぎは「" + lk + "」からはじまる名字";
    elBridge.appendChild(a); elBridge.appendChild(ar); elBridge.appendChild(b);
    elStep.textContent = chain.length + " 手目";
    elCard.classList.remove("swap");
    void elCard.offsetWidth;
    elCard.classList.add("swap");
    renderHistory();
    fitMain();
  }

  function renderHistory() {
    elHistory.innerHTML = "";
    var tail = chain.slice(-8);
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
    var lk = lastKanji(last);
    var reason = "「" + last.kanji + "（" + last.yomi + "）」の おわり「" + lk + "」からはじまる、まだ使っていない名字（2000位以内）が ありません。";
    elEndReason.textContent = reason;
    elEndStat.textContent = "今回の しりとり： 全 " + chain.length + " 手（「福井」から「" + last.kanji + "」まで・重複なし）";
    elStep.textContent = "おわり（全" + chain.length + "手）";
    fitEnd();

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
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = null;
      if (phase === "show" && chain.length > 0) fitMain();
      else if (phase === "end") fitEnd();
    }, 150);
  });

  // ---- start ----
  restart();
})();
