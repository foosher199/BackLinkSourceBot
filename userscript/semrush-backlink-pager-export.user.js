// ==UserScript==
// @name         SEMrush 反向链接 · 自动翻页导出当前页
// @namespace    https://fontchanger.art/
// @version      1.2.0
// @description  在已登录的 Semrush / 3ue 镜像反向链接列表页，自动「导出当前页」后点「Next」，直至最后一页
// @author       foosher199
// @updateURL    https://raw.githubusercontent.com/foosher199/BackLinkSourceBot/main/userscript/semrush-backlink-pager-export.user.js
// @downloadURL  https://raw.githubusercontent.com/foosher199/BackLinkSourceBot/main/userscript/semrush-backlink-pager-export.user.js
// @match        *://*.3ue.co/analytics/backlinks/backlinks*
// @match        *://*.semrush.com/analytics/backlinks/backlinks*
// @match        *://sem.3ue.co/*
// @include      *://sem.3ue.co/analytics/backlinks/backlinks*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE_KEY = "semrushBlExportPrefs";
  let activeDoc = document;
  let activeWin = window;

  function enumerateFrames() {
    const frames = [{ doc: document, win: window, label: "top" }];
    for (const iframe of document.querySelectorAll("iframe")) {
      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (doc && win) frames.push({ doc, win, label: "iframe" });
      } catch { /* cross-origin */ }
    }
    return frames;
  }

  function scoreFrame(doc) {
    if (!doc || !doc.body) return 0;
    let score = 0;
    if (doc.querySelector('[data-ui-name="DataTable.Row"], table tbody tr, [role="row"] [role="cell"]')) score += 80;
    if (doc.querySelector('[data-ui-name="Pagination.NextPage"], [data-ui-name="Pagination.PageInput"]')) score += 40;
    for (const el of doc.querySelectorAll('[data-ui-name="Button.Text"], button')) {
      const tx = norm(el.textContent);
      if (/导出|export/i.test(tx)) { score += 120; break; }
    }
  return score;
  }

  function pickAutomationFrame(log) {
    let best = { doc: document, win: window, label: "top", score: scoreFrame(document) };
    for (const f of enumerateFrames()) {
      const s = scoreFrame(f.doc);
      if (s > best.score) best = { doc: f.doc, win: f.win, label: f.label, score: s };
    }
    activeDoc = best.doc;
    activeWin = best.win;
    if (log) {
      log(`目标文档: ${best.label} 帧 score=${best.score} (${best.doc.location?.href || location.href})`);
    }
    return best.score > 0;
  }

  function logFrameScores(log) {
    for (const f of enumerateFrames()) {
      const s = scoreFrame(f.doc);
      let href = "";
      try { href = f.doc.location?.href || ""; } catch { href = "(blocked)"; }
      log(`  · ${f.label} score=${s} ${href}`);
    }
  }


  const DEFAULTS = {
    format: "xls", // xls | csv
    delayAfterExportMs: 3500,
    delayAfterNextMs: 4500,
    maxPages: 500,
    stopOnExportFail: false,
  };

  function loadPrefs() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function savePrefs(partial) {
    const next = { ...loadPrefs(), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function norm(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function fireClick(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    if (typeof el.click === "function") el.click();
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
  }

  const EXPORT_LABELS = [
    "导出当前页面",
    "导出当前页",
    "Export current page",
    "Export this page",
    "导出",
    "Export",
  ];

  function findExportTrigger() {
    const doc = activeDoc;
    for (const sel of [
      '[data-test="export"]',
      '[data-test="export-button"]',
      'button[aria-label*="导出"]',
      'button[aria-label*="Export" i]',
    ]) {
      const el = doc.querySelector(sel);
      if (el && isVisible(el)) return el.closest("button") || el;
    }
    for (const label of EXPORT_LABELS) {
      for (const el of doc.querySelectorAll('[data-ui-name="Button.Text"], button, [role="button"]')) {
        if (!isVisible(el)) continue;
        const text = norm(el.textContent);
        if (text === label || text.startsWith(label) || (label.length >= 2 && text.includes(label))) {
          return el.closest("button") || el;
        }
      }
    }
    for (const el of doc.querySelectorAll('button, [role="button"]')) {
      if (!isVisible(el)) continue;
      const text = norm(el.textContent);
      if (/^导出/.test(text) || /^export$/i.test(text)) return el.closest("button") || el;
    }
    return null;
  }

  function findExportMenuItem(format) {
    const want = format === "csv" ? "csv" : "xls";
    const byAttr = activeDoc.querySelector(
      `[data-ui-name="DropdownMenu.Item"][value="${want}"], [data-test-export-type="${want}"]`
    );
    if (byAttr && isVisible(byAttr)) return byAttr;

    const labels = format === "csv"
      ? ["CSV", "Csv", ".csv"]
      : ["Excel", "XLS", "XLSX", ".xlsx"];

    for (const sel of ['[role="menuitem"]', '[data-ui-name="DropdownMenu.Item"]', 'a', 'button']) {
      for (const el of activeDoc.querySelectorAll(sel)) {
        if (!isVisible(el)) continue;
        const t = norm(el.textContent);
        if (labels.some((l) => t === l || t.includes(l))) return el;
      }
    }
    return null;
  }

  function resolveClickable(el) {
    if (!el) return null;
    if (el.tagName === "BUTTON") return el;
    const btn = el.closest("button") || el.querySelector("button");
    return btn || el;
  }

  function elementClickable(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
  }

  function findSemrushNextButton() {
    const byAttr = activeDoc.querySelector('[data-ui-name="Pagination.NextPage"]');
    if (byAttr) {
      const btn = resolveClickable(byAttr);
      if (btn) return btn;
    }
    for (const btn of activeDoc.querySelectorAll("button[data-ui-name='Pagination.NextPage']")) {
      if (elementClickable(btn)) return btn;
    }
    const navs = [...activeDoc.querySelectorAll("nav")].filter(elementClickable);
    for (const nav of navs) {
      const aria = norm(nav.getAttribute("aria-label"));
      if (aria && !/pag|分页/i.test(aria) && navs.length > 3) continue;
      for (const btn of nav.querySelectorAll("button")) {
        if (!elementClickable(btn)) continue;
        if (btn.getAttribute("data-ui-name") === "Pagination.NextPage") return btn;
        const text = norm(btn.textContent);
        if (/^(next|下一页)$/i.test(text)) return btn;
      }
    }
    return null;
  }

  function getPageNumberInput() {
    const selectors = [
      '[data-ui-name="Pagination.PageInput.Value"] input',
      '[data-ui-name="Pagination.PageInput"] input',
      'nav input[inputmode="numeric"]',
      'nav input[type="text"]',
    ];
    for (const sel of selectors) {
      const input = activeDoc.querySelector(sel);
      if (input && elementClickable(input)) return input;
    }
    return null;
  }

  function readCurrentPage(input) {
    const v = input?.value ?? input?.getAttribute("value") ?? "";
    const n = parseInt(String(v).replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function findPrimaryScroller() {
    let best = null;
    let bestGap = 0;
    for (const el of activeDoc.querySelectorAll("*")) {
      if (!(el instanceof HTMLElement)) continue;
      const gap = el.scrollHeight - el.clientHeight;
      if (gap < 200) continue;
      const st = getComputedStyle(el);
      const scrollable = /(auto|scroll)/.test(st.overflowY + st.overflow);
      if (!scrollable) continue;
      if (gap > bestGap) {
        bestGap = gap;
        best = el;
      }
    }
    return best;
  }

  function scrollableRoots() {
    const roots = new Set([document.documentElement, document.body, document.scrollingElement].filter(Boolean));
    const primary = findPrimaryScroller();
    if (primary) roots.add(primary);
    for (const el of activeDoc.querySelectorAll('[data-ui-name="DataTable"], main, [class*="scroll" i]')) {
      if (el.scrollHeight > el.clientHeight + 80) roots.add(el);
    }
    return [...roots];
  }

  function scrollAllToBottom() {
    for (const root of scrollableRoots()) {
      try { root.scrollTop = root.scrollHeight; } catch { /* */ }
    }
    try { activeWin.scrollTo(0, Math.max(activeDoc.body.scrollHeight, activeDoc.documentElement.scrollHeight)); } catch { /* */ }
  }

  function scrollAllToTop() {
    try { activeWin.scrollTo(0, 0); } catch { /* */ }
    for (const root of scrollableRoots()) {
      try { root.scrollTop = 0; } catch { /* */ }
    }
  }

  async function revealPaginationControls(log) {
    const primary = findPrimaryScroller();
    if (primary) {
      log(`主滚动容器: <${primary.tagName.toLowerCase()}> Δ${primary.scrollHeight - primary.clientHeight}px`);
    } else {
      log("未检测到内部滚动容器，使用 window 滚动");
    }
    for (let step = 0; step < 20; step++) {
      scrollAllToBottom();
      await sleep(200);
      if (findSemrushNextButton() || getPageNumberInput()) return true;
    }
    return Boolean(findSemrushNextButton() || getPageNumberInput());
  }

  async function goNextViaPageInput(log) {
    const input = getPageNumberInput();
    if (!input || isDisabled(input)) return false;
    const cur = readCurrentPage(input);
    const next = cur + 1;
    input.focus();
    input.value = String(next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    const addon = input.closest('[data-ui-name*="PageInput"]')?.querySelector("button, [role='button']");
    if (addon && !isDisabled(addon)) fireClick(addon);
    log(`已用页码框翻页 ${cur} → ${next}（无需点底部 Next）`);
    return true;
  }

  async function goNextViaButton(log) {
    let btn = findSemrushNextButton();
    if (!btn) await revealPaginationControls(log);
    btn = findSemrushNextButton();
    if (!btn) return false;
    if (isDisabled(btn)) return false;
    try {
      btn.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    } catch { /* */ }
    await sleep(250);
    fireClick(btn);
    log("已点击 Pagination.NextPage");
    return true;
  }

  async function goToNextPage(log) {
    if (await goNextViaPageInput(log)) return "input";
    if (await goNextViaButton(log)) return "button";
    log("翻页失败：无页码框也无 Pagination.NextPage");
    return null;
  }

  function diagnosePagination(log) {
    const next = findSemrushNextButton();
    const input = getPageNumberInput();
    log(`诊断: Next按钮=${next ? "有" : "无"} 页码框=${input ? "有(当前" + readCurrentPage(input) + ")" : "无"}`);
    log(`诊断: data-ui-name Pagination.NextPage 数量=${activeDoc.querySelectorAll('[data-ui-name="Pagination.NextPage"]').length}`);
  }

  function isDisabled(el) {
    if (!el) return true;
    if (el.disabled || el.getAttribute("aria-disabled") === "true") return true;
    const cls = (el.className || "").toString().toLowerCase();
    if (cls.includes("disabled") || cls.includes("_disabled")) return true;
    try {
      if (getComputedStyle(el).pointerEvents === "none") return true;
    } catch { /* */ }
    return false;
  }

  /** 用表格第一行锚点 URL 判断翻页是否完成 */
  function tableFingerprint() {
    const row =
      activeDoc.querySelector('[data-ui-name="DataTable.Row"]') ||
      activeDoc.querySelector("table tbody tr") ||
      activeDoc.querySelector('[role="row"]');
    if (!row) return String(document.body?.innerText?.length || 0);
    const link = row.querySelector('a[href^="http"]');
    return link ? link.href : norm(row.textContent).slice(0, 120);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function waitForChange(prevFp, timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const fp = tableFingerprint();
        if (fp && fp !== prevFp) {
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          resolve(false);
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  function waitForMenuItem(format, timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const item = findExportMenuItem(format);
        if (item) {
          resolve(item);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          resolve(null);
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  let running = false;
  let stopRequested = false;
  let pageIndex = 1;

  async function exportCurrentPage(format, log) {
    const trigger = findExportTrigger();
    if (!trigger) {
      log("未找到「导出当前页」按钮，请确认在 Backlinks 列表页。");
      return false;
    }
    fireClick(trigger);
    const menuItem = await waitForMenuItem(format, 8000);
    if (!menuItem) {
      log("导出菜单未出现或未找到 CSV/Excel 选项。");
      return false;
    }
    fireClick(menuItem);
    log(`已触发导出（${format === "csv" ? "CSV" : "Excel"}）`);
    return true;
  }

  async function runLoop(prefs, ui) {
    running = true;
    stopRequested = false;
    pageIndex = 1;
    ui.setStatus("运行中…", "run");
    ui.log("正在等待「导出」按钮出现（最多 60 秒）…");
    pickAutomationFrame(ui.log);
    const ready = await waitForReady(60000, ui.log);
    if (!ready) {
      logFrameScores(ui.log);
      ui.log("仍未找到导出按钮（若表格在 iframe，请用 v1.2.0+）。确认在 Backlinks 列表 Tab。");
      ui.setStatus("就绪", "idle");
      running = false;
      return;
    }

    diagnosePagination(ui.log);
    ui.log(`开始自动导出（最多 ${prefs.maxPages} 页）`);

    while (!stopRequested && pageIndex <= prefs.maxPages) {
      pickAutomationFrame(ui.log);
      ui.log(`—— 第 ${pageIndex} 页 ——`);
      scrollAllToTop();
      await sleep(300);
      const ok = await exportCurrentPage(prefs.format, ui.log);
      if (!ok && prefs.stopOnExportFail) {
        ui.log("导出失败，已停止。");
        break;
      }
      await sleep(prefs.delayAfterExportMs);

      const nextBtn = findSemrushNextButton();
      if (nextBtn && isDisabled(nextBtn)) {
        ui.log("Next 已禁用，已到最后一页，结束。");
        break;
      }

      const fp = tableFingerprint();
      const inputBefore = getPageNumberInput();
      const pageBefore = inputBefore ? readCurrentPage(inputBefore) : pageIndex;

      const method = await goToNextPage(ui.log);
      if (!method) {
        diagnosePagination(ui.log);
        break;
      }

      scrollAllToTop();
      await sleep(400);
      const waitMs = Math.max(prefs.delayAfterNextMs, 3000);
      let changed = await waitForChange(fp, waitMs);
      if (!changed && inputBefore) {
        const inputAfter = getPageNumberInput();
        if (inputAfter && readCurrentPage(inputAfter) > pageBefore) changed = true;
      }
      if (!changed) {
        await sleep(prefs.delayAfterNextMs);
        const fp2 = tableFingerprint();
        const inputAfter = getPageNumberInput();
        if (fp2 !== fp) changed = true;
        if (inputAfter && readCurrentPage(inputAfter) > pageBefore) changed = true;
      }
      if (!changed) {
        ui.log(`翻页后 ${waitMs}ms 内列表/页码未变，结束或加大「翻页后等待」`);
        break;
      }
      pageIndex += 1;
    }

    ui.log(stopRequested ? "已手动停止。" : `完成，共处理约 ${pageIndex} 页。`);
    ui.setStatus("就绪", "idle");
    running = false;
  }

  function buildPanel() {
    const prefs = loadPrefs();
    const root = document.createElement("div");
    root.id = "semrush-bl-export-panel";
    root.innerHTML = `
      <style>
        #semrush-bl-export-panel {
          position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
          width: 300px; font: 13px/1.4 system-ui, sans-serif;
          background: #1a1d26; color: #e8eaed; border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,.45); border: 1px solid #3d4450;
        }
        #semrush-bl-export-panel * { box-sizing: border-box; }
        #semrush-bl-export-panel .hd {
          padding: 10px 12px; font-weight: 600; border-bottom: 1px solid #3d4450;
          display: flex; justify-content: space-between; align-items: center;
        }
        #semrush-bl-export-panel .bd { padding: 10px 12px; }
        #semrush-bl-export-panel label { display: block; margin: 8px 0 4px; color: #9aa0a6; font-size: 11px; }
        #semrush-bl-export-panel input, #semrush-bl-export-panel select {
          width: 100%; padding: 6px 8px; border-radius: 6px; border: 1px solid #3d4450;
          background: #0f1115; color: #e8eaed;
        }
        #semrush-bl-export-panel .row { display: flex; gap: 8px; margin-top: 10px; }
        #semrush-bl-export-panel button {
          flex: 1; padding: 8px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;
        }
        #semrush-bl-export-panel .start { background: #7c3aed; color: #fff; }
        #semrush-bl-export-panel .stop { background: #374151; color: #fff; }
        #semrush-bl-export-panel .start:disabled { opacity: .5; cursor: not-allowed; }
        #semrush-bl-export-panel .log {
          margin-top: 10px; max-height: 140px; overflow: auto; font-size: 11px;
          background: #0f1115; border-radius: 8px; padding: 8px; color: #b0b8c4;
        }
        #semrush-bl-export-panel .pill {
          font-size: 10px; padding: 2px 8px; border-radius: 999px; background: #374151;
        }
        #semrush-bl-export-panel .pill.run { background: #065f46; }
        #semrush-bl-export-panel .hint { font-size: 11px; color: #9aa0a6; margin-top: 8px; }
        #semrush-bl-export-panel .min { cursor: pointer; opacity: .7; font-size: 18px; user-select: none; }
      </style>
      <div class="hd">
        <span>反向链接 · 翻页导出</span>
        <span><span class="pill" data-status>就绪</span>
        <span class="min" title="收起/展开">−</span></span>
      </div>
      <div class="bd" data-body>
        <label>导出格式</label>
        <select data-format>
          <option value="xls">Excel</option>
          <option value="csv">CSV</option>
        </select>
        <label>导出后等待（毫秒，给下载留时间）</label>
        <input type="number" data-delay-export min="1000" step="500" value="${prefs.delayAfterExportMs}">
        <label>翻页后等待（毫秒）</label>
        <input type="number" data-delay-next min="1000" step="500" value="${prefs.delayAfterNextMs}">
        <label>最多页数（防止误跑）</label>
        <input type="number" data-max-pages min="1" value="${prefs.maxPages}">
        <div class="row">
          <button type="button" class="start" data-start>开始</button>
          <button type="button" class="stop" data-stop>停止</button>
        </div>
        <p class="hint">本面板即开始按钮；不在 Semrush 页上。先允许「自动下载多个文件」，登录后打开反向链接列表再点紫色「开始」。</p>
        <div class="log" data-log></div>
      </div>
    `;
    document.documentElement.appendChild(root);

    const fmt = root.querySelector("[data-format]");
    fmt.value = prefs.format;

    const ui = {
      logEl: root.querySelector("[data-log]"),
      statusEl: root.querySelector("[data-status]"),
      log(msg) {
        const line = document.createElement("div");
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        this.logEl.appendChild(line);
        this.logEl.scrollTop = this.logEl.scrollHeight;
      },
      setStatus(text, kind) {
        this.statusEl.textContent = text;
        this.statusEl.classList.toggle("run", kind === "run");
      },
    };

    function readPrefsFromForm() {
      return savePrefs({
        format: fmt.value,
        delayAfterExportMs: Number(root.querySelector("[data-delay-export]").value) || DEFAULTS.delayAfterExportMs,
        delayAfterNextMs: Number(root.querySelector("[data-delay-next]").value) || DEFAULTS.delayAfterNextMs,
        maxPages: Number(root.querySelector("[data-max-pages]").value) || DEFAULTS.maxPages,
      });
    }

    root.querySelector("[data-start]").addEventListener("click", () => {
      if (running) return;
      const p = readPrefsFromForm();
      root.querySelector("[data-start]").disabled = true;
      runLoop(p, ui).finally(() => {
        root.querySelector("[data-start]").disabled = false;
      });
    });

    root.querySelector("[data-stop]").addEventListener("click", () => {
      stopRequested = true;
      ui.log("正在停止…");
    });

    const body = root.querySelector("[data-body]");
    const minBtn = root.querySelector(".min");
    minBtn.addEventListener("click", () => {
      const hidden = body.style.display === "none";
      body.style.display = hidden ? "" : "none";
      minBtn.textContent = hidden ? "−" : "+";
    });

    ui.log("面板已加载。确认在反向链接列表页，点紫色「开始」。");
    return ui;
  }

  function isBacklinksRoute() {
    const loc = location.pathname + location.search + location.hash + location.href;
    return /\/analytics\/backlinks\/backlinks/i.test(loc)
      || (/\/analytics\/backlinks/i.test(loc) && /searchType=/i.test(loc));
  }

  function waitForReady(timeoutMs, log) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        pickAutomationFrame(log);
        if (findExportTrigger()) {
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(tick, 500);
      };
      tick();
    });
  }

  function hasBacklinkTableUi() {
    for (const f of enumerateFrames()) {
      const prevDoc = activeDoc;
      const prevWin = activeWin;
      activeDoc = f.doc;
      activeWin = f.win;
      const ok = !!(findExportTrigger() || activeDoc.querySelector('[data-ui-name="DataTable.Row"], table tbody tr'));
      activeDoc = prevDoc;
      activeWin = prevWin;
      if (ok) return true;
    }
    return false;
  }

  function shouldAttachHere() {
    if (!isBacklinksRoute()) return false;
    if (hasBacklinkTableUi()) return true;
    try {
      if (window.self === window.top) return true;
    } catch {
      return true;
    }
    return false;
  }

  function tryInit() {
    try {
      if (document.getElementById("semrush-bl-export-panel")) return;
      if (!shouldAttachHere()) return;
      buildPanel();
      const frame = window.self === window.top ? "top" : "iframe";
      console.info("[BackLinkSourceBot] 面板已注入 @" + frame + " " + location.pathname);
    } catch (err) {
      console.error("[BackLinkSourceBot] 初始化失败", err);
    }
  }

  tryInit();
  const mo = new MutationObserver(() => tryInit());
  mo.observe(document.documentElement, { childList: true, subtree: true });
  let attachAttempts = 0;
  const attachTimer = setInterval(() => {
    tryInit();
    if (document.getElementById("semrush-bl-export-panel") || ++attachAttempts >= 20) {
      clearInterval(attachTimer);
    }
  }, 1500);
})();