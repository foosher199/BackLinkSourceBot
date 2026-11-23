// ==UserScript==
// @name         SEMrush 反向链接 · 自动翻页导出当前页
// @namespace    https://fontchanger.art/
// @version      1.0.3
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
    for (const label of EXPORT_LABELS) {
      for (const el of document.querySelectorAll('[data-ui-name="Button.Text"], button, [role="button"]')) {
        if (!isVisible(el)) continue;
        const text = norm(el.textContent);
        if (text === label || text.startsWith(label)) {
          return el.closest("button") || el;
        }
      }
    }
    return null;
  }

  function findExportMenuItem(format) {
    const want = format === "csv" ? "csv" : "xls";
    const byAttr = document.querySelector(
      `[data-ui-name="DropdownMenu.Item"][value="${want}"], [data-test-export-type="${want}"]`
    );
    if (byAttr && isVisible(byAttr)) return byAttr;

    const labels = format === "csv"
      ? ["CSV", "Csv", ".csv"]
      : ["Excel", "XLS", "XLSX", ".xlsx"];

    for (const sel of ['[role="menuitem"]', '[data-ui-name="DropdownMenu.Item"]', 'a', 'button']) {
      for (const el of document.querySelectorAll(sel)) {
        if (!isVisible(el)) continue;
        const t = norm(el.textContent);
        if (labels.some((l) => t === l || t.includes(l))) return el;
      }
    }
    return null;
  }

  const NEXT_LABELS = ["Next", "下一页", "下页", "›", "→"];

  function isNextCandidate(el) {
    if (!el || !isVisible(el)) return false;
    const aria = norm(el.getAttribute("aria-label"));
    const text = norm(el.textContent);
    if (/previous|prev|上一|back/i.test(aria + " " + text)) return false;
    if (/^next( page)?$/i.test(aria) || /下一页|下页/i.test(aria)) return true;
    if (NEXT_LABELS.some((l) => text === l || text.toLowerCase() === l.toLowerCase())) return true;
    if (text.length <= 4 && /next|›|→/i.test(text)) return true;
    return false;
  }

  function resolveClickable(el) {
    return el.closest("button") || el.closest('[role="button"]') || el;
  }

  function paginationScopes() {
    const scopes = [];
    for (const sel of [
      '[data-ui-name="Pagination"]',
      '[data-test="pagination"]',
      'nav[aria-label*="Pagination" i]',
      'nav[aria-label*="分页" i]',
    ]) {
      for (const el of document.querySelectorAll(sel)) scopes.push(el);
    }
    for (const el of document.querySelectorAll('[class*="pagination" i], [class*="Pagination"]')) {
      if (el.tagName !== "BUTTON") scopes.push(el);
    }
    scopes.push(document.body);
    return scopes;
  }

  function scrollableRoots() {
    const roots = new Set([document.documentElement, document.body, document.scrollingElement].filter(Boolean));
    for (const sel of [
      "main",
      '[data-ui-name="DataTable"]',
      '[class*="scroll" i]',
      '[class*="table" i]',
      '[role="table"]',
    ]) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.scrollHeight > el.clientHeight + 80) roots.add(el);
      }
    }
    return [...roots];
  }

  function scrollAllToBottom() {
    window.scrollTo({ top: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight), behavior: "instant" });
    for (const root of scrollableRoots()) {
      try {
        root.scrollTop = root.scrollHeight;
      } catch { /* */ }
    }
  }

  function scrollAllToTop() {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    for (const root of scrollableRoots()) {
      try {
        root.scrollTop = 0;
      } catch { /* */ }
    }
  }

  function findNextButton() {
    for (const scope of paginationScopes()) {
      for (const el of scope.querySelectorAll("button, a[role='button'], [role='button']")) {
        if (isNextCandidate(el)) return resolveClickable(el);
      }
    }
    return null;
  }

  async function revealAndFindNext(log) {
    log("滚动到列表底部以定位 Next…");
    for (let pass = 0; pass < 15; pass++) {
      scrollAllToBottom();
      await sleep(350);
      const btn = findNextButton();
      if (btn) {
        try {
          btn.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
        } catch { /* */ }
        await sleep(200);
        log(`已找到 Next（第 ${pass + 1} 次滚动）`);
        return btn;
      }
    }
    log("滚到底部后仍未找到 Next。");
    return null;
  }

  function isDisabled(el) {
    if (!el) return true;
    if (el.disabled || el.getAttribute("aria-disabled") === "true") return true;
    const cls = (el.className || "").toString().toLowerCase();
    if (cls.includes("disabled")) return true;
    return false;
  }

  /** 用表格第一行锚点 URL 判断翻页是否完成 */
  function tableFingerprint() {
    const row =
      document.querySelector('[data-ui-name="DataTable.Row"]') ||
      document.querySelector("table tbody tr") ||
      document.querySelector('[role="row"]');
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
    const ready = await waitForReady(60000);
    if (!ready) {
      ui.log("仍未找到导出按钮。请确认在反向链接列表 Tab 且表格已加载。");
      ui.setStatus("就绪", "idle");
      running = false;
      return;
    }

    ui.log(`开始自动导出（最多 ${prefs.maxPages} 页）`);

    while (!stopRequested && pageIndex <= prefs.maxPages) {
      ui.log(`—— 第 ${pageIndex} 页 ——`);
      scrollAllToTop();
      await sleep(300);
      const ok = await exportCurrentPage(prefs.format, ui.log);
      if (!ok && prefs.stopOnExportFail) {
        ui.log("导出失败，已停止。");
        break;
      }
      await sleep(prefs.delayAfterExportMs);

      const nextBtn = await revealAndFindNext(ui.log);
      if (!nextBtn) {
        ui.log("无法定位 Next。请暂时加大「翻页后等待」或 Issue 反馈分页文案。");
        break;
      }
      if (isDisabled(nextBtn)) {
        ui.log("Next 为禁用状态，已到最后一页，结束。");
        break;
      }

      const fp = tableFingerprint();
      scrollAllToBottom();
      await sleep(200);
      try {
        nextBtn.scrollIntoView({ block: "center", behavior: "instant" });
      } catch { /* */ }
      await sleep(200);
      fireClick(nextBtn);
      ui.log("已点击 Next，等待列表刷新…");
      scrollAllToTop();
      await sleep(400);
      const changed = await waitForChange(fp, Math.max(prefs.delayAfterNextMs, 2000));
      if (!changed) {
        await sleep(prefs.delayAfterNextMs);
        const fp2 = tableFingerprint();
        if (fp2 === fp) {
          ui.log("列表内容未变化，可能已是最后一页或加载超时，结束。");
          break;
        }
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
          position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;
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
    return /\/analytics\/backlinks\/backlinks/i.test(location.pathname + location.search + location.hash);
  }

  function waitForReady(timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
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
    return !!(
      findExportTrigger() ||
      document.querySelector('[data-ui-name="DataTable.Row"], table tbody tr')
    );
  }

  function shouldAttachHere() {
    if (!isBacklinksRoute()) return false;
    try {
      const inIframe = window.self !== window.top;
      if (inIframe) return true;
      if (document.querySelector("iframe") && !hasBacklinkTableUi()) return false;
    } catch {
      /* cross-origin top */
      return true;
    }
    return true;
  }

  function tryInit() {
    if (document.getElementById("semrush-bl-export-panel")) return;
    if (!shouldAttachHere()) return;
    buildPanel();
  }

  tryInit();
  const mo = new MutationObserver(() => tryInit());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();