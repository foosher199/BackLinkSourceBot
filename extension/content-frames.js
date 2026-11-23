(function () {
  const path = location.pathname + location.search;
  if (!/\/analytics\/backlinks\/backlinks/i.test(path) && !(/\/analytics\/backlinks/i.test(path) && /searchType=/i.test(path))) {
    return;
  }

  function scoreFrame() {
    let s = 0;
    if (document.querySelector('[data-ui-name="DataTable.Row"], table tbody tr')) s += 100;
    if (document.querySelector('[data-ui-name="Pagination.NextPage"], [data-ui-name="Pagination.PageInput"]')) s += 40;
    for (const el of document.querySelectorAll('[data-ui-name="Button.Text"], button')) {
      const t = (el.textContent || "").trim();
      if (/导出|export/i.test(t)) {
        s += 120;
        break;
      }
    }
    if (/\/backlinks\/backlinks/i.test(location.pathname)) s += 30;
    return s;
  }

  function report() {
    chrome.runtime.sendMessage({
      type: "frame-report",
      score: scoreFrame(),
      href: location.href,
    }).catch(() => {});
  }

  report();
  setInterval(report, 2000);
})();