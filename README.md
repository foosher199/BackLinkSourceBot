# BackLinkSourceBot

在 **Semrush** / **3ue 镜像站**（如 `sem.3ue.co`）的 **Backlinks 反向链接列表**页，自动模拟点击 **「导出当前页」** 与 **Next**，适合普通会员无法整表批量导出的场景。

> 使用前请自行登录 Semrush 镜像；本工具仅在浏览器内模拟点击，不收集账号信息、不绕过平台配额。

## 功能

- 从当前所在页开始：**导出当前页** → 等待下载 → **下一页** → 重复
- 支持 **Excel / CSV**（与页面导出菜单一致）
- 可配置导出间隔、翻页等待、最大页数
- 右下角浮窗：开始 / 停止、运行日志

## 安装（Tampermonkey）

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 任选一种方式添加脚本：
   - **从仓库安装**：Tampermonkey → 实用工具 → 从 URL 安装  
     `https://raw.githubusercontent.com/foosher199/BackLinkSourceBot/main/userscript/semrush-backlink-pager-export.user.js`
   - **手动粘贴**：新建脚本，复制 `userscript/semrush-backlink-pager-export.user.js` 全文保存。
3. 浏览器打开反向链接列表（URL 含 `/analytics/backlinks/backlinks`），**登录后**等表格加载完成。
4. 右下角 **「反向链接 · 翻页导出」** → **开始**（建议从第 1 页起跑）。


## 怎么用（一步步）

**「开始」不是 Semrush 网页自带的按钮**，是脚本注入后右下角紫色浮窗里的按钮。

1. **确认脚本已启用**  
   点击浏览器工具栏 **Tampermonkey 图标** → 应能看到 `SEMrush 反向链接 · 自动翻页导出当前页`，且开关为 **已启用**（绿色）。

2. **打开正确页面**  
   地址栏 URL 需包含：`/analytics/backlinks/backlinks`（就是你查域名外链、底下有很多行、右上角有「导出当前页面」的那一页）。  
   仅登录页、概览页不会出现浮窗。

3. **刷新页面**  
   进到列表页后按 **F5** 刷新一次（让脚本重新注入）。

4. **找浮窗**  
   看浏览器窗口 **右下角** 深色卡片，标题 **「反向链接 · 翻页导出」**，里面有紫色 **「开始」** 和灰色 **「停止」**。  
   若列表在 **iframe** 里，请在能看到表格的那一屏右下角找；可把页面稍微缩小或滚动一下。

5. **点「开始」**  
   脚本会先等「导出」和 **Next** 出现（最多约 60 秒），再自动：导出当前页 → 下一页 → 循环。  
   日志在浮窗下方黑框里滚动显示。

6. **仍没有浮窗时**  
   - Tampermonkey → 该脚本 →「设置」→ 运行时机选 **document-idle**（默认即可）  
   - 检查是否装在 **Chrome / Edge** 且与打开 `sem.3ue.co` 的是同一浏览器  
   - Tampermonkey → **检查更新** 或重新从 [安装链接](https://raw.githubusercontent.com/foosher199/BackLinkSourceBot/main/userscript/semrush-backlink-pager-export.user.js) 安装 **v1.0.1+**

## 使用前必做

| 项 | 说明 |
|----|------|
| 多文件下载 | Chrome：`sem.3ue.co` 站点设置 → 允许 **自动下载多个文件** |
| 导出配额 | 仍受 Semrush 账号每日导出次数限制 |
| 前台运行 | 标签页尽量保持在前台，避免定时器被节流 |

## 参数说明

| 参数 | 默认 | 说明 |
|------|------|------|
| 导出格式 | Excel | 可选 CSV |
| 导出后等待 | 3500 ms | 网络慢可调 6000–8000 |
| 翻页后等待 | 4500 ms | 列表 loading 慢可加大 |
| 最多页数 | 500 | 防止误点跑过头 |

## 匹配规则（便于二次开发）

- 导出按钮：`[data-ui-name="Button.Text"]` 等，文案含「导出当前页面 / 导出 / Export」
- 菜单项：`[data-ui-name="DropdownMenu.Item"][value="xls|csv"]`
- 下一页：文案 **Next / 下一页** 或 `aria-label` 含 next

## 故障排查

- **没有浮窗**：确认在 Backlinks 列表且表格已加载；若在 iframe 内，面板出现在有表格的那一帧。
- **找不到导出**：检查列表右上角按钮文案是否与脚本一致，可在 Issue 中反馈完整文案。
- **只下载了第一个文件**：检查站点「允许多个自动下载」。

## 仓库结构

```
userscript/
  semrush-backlink-pager-export.user.js   # Tampermonkey 主脚本
```

## 免责声明

仅供个人研究外链数据使用。请遵守 Semrush 服务条款与当地法律；频繁自动化可能触发平台限制，请自行控制频率与导出额度。
