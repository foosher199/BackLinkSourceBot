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
