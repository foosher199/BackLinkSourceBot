/** @type {Map<number, Map<number, { score: number, href: string, t: number }>>} */
const frameRegistry = new Map();
/** @type {Map<number, { running: boolean, stop: boolean }>} */
const tabRuns = new Map();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "frame-report" && sender.tab?.id != null) {
    const tabId = sender.tab.id;
    const frameId = sender.frameId ?? 0;
    if (!frameRegistry.has(tabId)) frameRegistry.set(tabId, new Map());
    frameRegistry.get(tabId).set(frameId, {
      score: msg.score,
      href: msg.href,
      t: Date.now(),
    });
    return;
  }
  if (msg.type === "start-loop") {
    const tabId = msg.tabId ?? sender.tab?.id;
    if (tabId == null) return;
    startLoop(tabId, msg.prefs).catch((e) => broadcast(tabId, `错误: ${e.message}`));
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === "stop-loop") {
    const tabId = msg.tabId ?? sender.tab?.id;
    const run = tabId != null ? tabRuns.get(tabId) : null;
    if (run) run.stop = true;
    sendResponse({ ok: true });
    return;
  }
});

function broadcast(tabId, line, extra = {}) {
  chrome.tabs.sendMessage(tabId, { type: "log", line, ...extra }).catch(() => {});
}

function pickFrameId(tabId) {
  const frames = frameRegistry.get(tabId);
  if (!frames || frames.size === 0) return 0;
  let bestId = 0;
  let bestScore = -1;
  for (const [fid, data] of frames) {
    if (data.score > bestScore) {
      bestScore = data.score;
      bestId = fid;
    }
  }
  return bestId;
}

async function exec(tabId, frameId, func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: frameId > 0 ? { tabId, frameIds: [frameId] } : { tabId, frameIds: [0] },
    func,
    args,
  });
  return results[0]?.result;
}


async function resolveExportFrame(tabId) {
  await sleep(800);
  const map = frameRegistry.get(tabId);
  const ids = map ? [...map.keys()] : [0];
  ids.sort((a, b) => (map.get(b)?.score ?? 0) - (map.get(a)?.score ?? 0));
  for (const fid of ids.length ? ids : [0]) {
    const hit = await exec(tabId, fid, () => {
      for (const el of document.querySelectorAll('[data-ui-name="Button.Text"], button')) {
        const t = (el.textContent || "").trim();
        if (/导出|export/i.test(t)) return { ok: true };
      }
      return { ok: false };
    });
    if (hit?.ok) return fid;
  }
  return pickFrameId(tabId);
}

async function startLoop(tabId, prefs) {
  const existing = tabRuns.get(tabId);
  if (existing?.running) {
    broadcast(tabId, "已在运行中");
    return;
  }
  tabRuns.set(tabId, { running: true, stop: false });
  const delayExport = prefs.delayAfterExportMs ?? 5500;
  const delayNext = prefs.delayAfterNextMs ?? 4500;
  const maxPages = prefs.maxPages ?? 500;
  const format = prefs.format ?? "xls";

  broadcast(tabId, "扩展后台启动", { status: "run" });
  await sleep(500);

  for (let page = 1; page <= maxPages; page++) {
    const run = tabRuns.get(tabId);
    if (!run || run.stop) break;

    const frameId = await resolveExportFrame(tabId);
    broadcast(tabId, `--- 第 ${page} 页 | 使用 frameId=${frameId} ---`);

    const exp = await exec(tabId, frameId, doExportPage, [format]);
    if (!exp?.ok) {
      broadcast(tabId, `导出失败: ${exp?.reason || "unknown"}`);
      if (exp?.frameScores) exp.frameScores.forEach((s) => broadcast(tabId, `  · ${s}`));
      break;
    }
    broadcast(tabId, `已点击导出 (${exp.method})`);
    await sleep(delayExport);

    if (run.stop) break;
    const nav = await exec(tabId, frameId, doNextPage, []);
    if (!nav?.ok) {
      broadcast(tabId, `翻页失败: ${nav?.reason || "unknown"}`);
      break;
    }
    if (nav.last) {
      broadcast(tabId, "已到最后一页");
      break;
    }
    broadcast(tabId, `已翻页 (${nav.method})`);
    await sleep(delayNext);

    let changed = false;
    for (let w = 0; w < 12; w++) {
      await sleep(Math.max(400, Math.floor(delayNext / 12)));
      const chk = await exec(tabId, frameId, (prev) => {
        const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
        const row = document.querySelector('[data-ui-name="DataTable.Row"]') || document.querySelector("table tbody tr");
        if (!row) return { changed: false };
        const a = row.querySelector('a[href^="http"]');
        const sig = a ? a.href : norm(row.textContent).slice(0, 100);
        return { changed: !!(sig && sig !== prev) };
      }, [nav.signature || ""]);
      if (chk?.changed) { changed = true; break; }
    }
    if (!changed) {
      broadcast(tabId, "翻页后数据未变化，停止或加大「翻页后等待」");
      break;
    }
  }

  tabRuns.set(tabId, { running: false, stop: false });
  broadcast(tabId, "已结束", { status: "idle" });
}

/** 在目标 frame 的 MAIN 世界执行：寻找并点击导出 */
function doExportPage(format) {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(el);
    return st.display !== "none" && st.visibility !== "hidden";
  }
  function click(el) {
    if (!el) return;
    ["mousedown", "mouseup", "click"].forEach((t) =>
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))
    );
    el.click?.();
  }

  let trigger = null;
  for (const el of document.querySelectorAll('[data-ui-name="Button.Text"]')) {
    const t = norm(el.textContent);
    if (t === "导出" || t.includes("导出当前") || /^export$/i.test(t)) {
      trigger = el.closest("button") || el;
      break;
    }
  }
  if (!trigger) {
    for (const btn of document.querySelectorAll("button")) {
      const t = norm(btn.textContent);
      if (/^导出/.test(t) || t === "Export") {
        trigger = btn;
        break;
      }
    }
  }
  if (!trigger) return { ok: false, reason: "未找到导出按钮（导出/导出当前页面）" };

  click(trigger);

  const want = format === "csv" ? "csv" : "xls";
  const deadline = Date.now() + 8000;
  let menu = null;
  while (Date.now() < deadline) {
    menu =
      document.querySelector(`[data-ui-name="DropdownMenu.Item"][value="${want}"]`) ||
      document.querySelector(`[data-test-export-type="${want}"]`);
    if (menu && visible(menu)) break;
    for (const el of document.querySelectorAll('[role="menuitem"], [data-ui-name="DropdownMenu.Item"]')) {
      const tx = norm(el.textContent);
      if ((want === "xls" && /excel/i.test(tx)) || (want === "csv" && /csv/i.test(tx))) {
        menu = el;
        break;
      }
    }
    if (menu) break;
  }
  if (!menu) return { ok: false, reason: "导出菜单未出现或无 Excel/CSV 项" };
  click(menu);
  return { ok: true, method: want === "xls" ? "Excel" : "CSV" };
}

function doNextPage() {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  function click(el) {
    if (!el) return;
    el.scrollIntoView?.({ block: "center" });
    ["mousedown", "mouseup", "click"].forEach((t) =>
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))
    );
    el.click?.();
  }
  function tableSig() {
    const row =
      document.querySelector('[data-ui-name="DataTable.Row"]') ||
      document.querySelector("table tbody tr");
    if (!row) return String(document.body?.innerText?.length || 0);
    const a = row.querySelector('a[href^="http"]');
    return a ? a.href : norm(row.textContent).slice(0, 100);
  }
  function disabled(el) {
    if (!el) return true;
    if (el.disabled || el.getAttribute("aria-disabled") === "true") return true;
    return String(el.className).toLowerCase().includes("disabled");
  }

  const sig = tableSig();

  const input =
    document.querySelector('[data-ui-name="Pagination.PageInput.Value"] input') ||
    document.querySelector('[data-ui-name="Pagination.PageInput"] input');
  if (input && !disabled(input)) {
    const cur = parseInt(String(input.value).replace(/\D/g, ""), 10) || 1;
    input.focus();
    input.value = String(cur + 1);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
    return { ok: true, method: "页码+Enter", signature: sig, last: false };
  }

  let next =
    document.querySelector('button[data-ui-name="Pagination.NextPage"]') ||
    document.querySelector('[data-ui-name="Pagination.NextPage"] button') ||
    document.querySelector('[data-ui-name="Pagination.NextPage"]');
  if (next && !disabled(next)) {
    click(next);
    return { ok: true, method: "Pagination.NextPage", signature: sig, last: false };
  }
  for (const btn of document.querySelectorAll("nav button")) {
    if (disabled(btn)) continue;
    if (btn.getAttribute("data-ui-name") === "Pagination.NextPage") {
      click(btn);
      return { ok: true, method: "Next", signature: sig, last: false };
    }
    const t = norm(btn.textContent);
    if (t === "Next" || t === "下一页") {
      click(btn);
      return { ok: true, method: t, signature: sig, last: false };
    }
  }
  return { ok: false, reason: "无页码框且无 Pagination.NextPage" };
}

function waitPageChanged(prevSig, timeoutMs) {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const read = () => {
    const row =
      document.querySelector('[data-ui-name="DataTable.Row"]') ||
      document.querySelector("table tbody tr");
    if (!row) return "";
    const a = row.querySelector('a[href^="http"]');
    return a ? a.href : norm(row.textContent).slice(0, 100);
  };
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const sig = read();
    if (sig && sig !== prevSig) return { changed: true };
  }
  return { changed: false };
}