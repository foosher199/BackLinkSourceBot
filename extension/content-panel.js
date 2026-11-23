(function () {
  if (!/\/analytics\/backlinks/i.test(location.pathname + location.search)) return;
  if (document.getElementById("blsb-panel")) return;

  const root = document.createElement("div");
  root.id = "blsb-panel";
  root.innerHTML = `
    <style>
      #blsb-panel { position:fixed; right:16px; bottom:16px; z-index:2147483647; width:300px; font:13px/1.45 system-ui,sans-serif; background:#111; color:#eee; border:1px solid #444; border-radius:10px; box-shadow:0 8px 28px rgba(0,0,0,.5); }
      #blsb-panel .hd { padding:10px 12px; font-weight:600; border-bottom:1px solid #333; display:flex; justify-content:space-between; }
      #blsb-panel .bd { padding:10px 12px; }
      #blsb-panel label { font-size:11px; color:#aaa; display:block; margin-top:6px; }
      #blsb-panel input, #blsb-panel select { width:100%; margin-top:4px; padding:6px; background:#222; border:1px solid #444; color:#eee; border-radius:6px; }
      #blsb-panel .row { display:flex; gap:8px; margin-top:10px; }
      #blsb-panel button { flex:1; padding:8px; border:0; border-radius:8px; font-weight:600; cursor:pointer; }
      #blsb-panel .go { background:#7c3aed; color:#fff; }
      #blsb-panel .stop { background:#444; color:#fff; }
      #blsb-panel .log { margin-top:8px; max-height:160px; overflow:auto; font-size:11px; background:#0a0a0a; padding:8px; border-radius:6px; color:#9ab; }
      #blsb-panel .tag { font-size:10px; padding:2px 8px; border-radius:999px; background:#333; }
      #blsb-panel .tag.run { background:#065f46; }
    </style>
    <div class="hd"><span>BackLinkSourceBot 扩展</span><span class="tag" data-st>就绪</span></div>
    <div class="bd">
      <p style="margin:0 0 8px;font-size:11px;color:#9ab">后台用 Chrome API 在<strong>正确 iframe</strong>里点导出/翻页。</p>
      <label>导出格式</label><select data-fmt><option value="xls">Excel</option><option value="csv">CSV</option></select>
      <label>导出后等待 ms</label><input type="number" data-de value="5500" min="1000" step="500">
      <label>翻页后等待 ms</label><input type="number" data-dn value="6000" min="1000" step="500">
      <div class="row"><button type="button" class="go" data-go>开始</button><button type="button" class="stop" data-stop>停止</button></div>
      <div class="log" data-log></div>
    </div>`;
  document.documentElement.appendChild(root);

  const logEl = root.querySelector("[data-log]");
  const stEl = root.querySelector("[data-st]");
  const log = (line) => {
    const d = document.createElement("div");
    d.textContent = "[" + new Date().toLocaleTimeString() + "] " + line;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
  };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== "log") return;
    log(msg.line);
    if (msg.status === "run") { stEl.textContent = "运行中…"; stEl.classList.add("run"); }
    if (msg.status === "idle") { stEl.textContent = "就绪"; stEl.classList.remove("run"); }
  });

  function prefs() {
    return {
      format: root.querySelector("[data-fmt]").value,
      delayAfterExportMs: Number(root.querySelector("[data-de]").value) || 5500,
      delayAfterNextMs: Number(root.querySelector("[data-dn]").value) || 6000,
      maxPages: 500,
    };
  }

  root.querySelector("[data-go]").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "start-loop", prefs: prefs() });
    log("已请求后台开始（自动选 iframe）");
  });
  root.querySelector("[data-stop]").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "stop-loop" });
    log("正在停止…");
  });

  log("扩展面板就绪。请关闭油猴版避免冲突。");
})();
