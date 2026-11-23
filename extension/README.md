# Chrome 扩展（推荐，替代油猴）

## 做什么
在 `sem.3ue.co` Backlinks 列表：**每一页点「导出」→ 等下载 → 翻页 → 重复**。

## 为什么不用油猴
3ue 把 Semrush 放在 **iframe** 里。油猴在错误文档里找按钮，屡次失败。扩展用 `chrome.scripting.executeScript({ frameIds })` **在真正的表格那一帧里点击**（与公开 Semrush 自动化同一思路）。

## 安装
1. **关掉 Tampermonkey 里旧脚本**（避免两套一起跑）。
2. Chrome 打开 `chrome://extensions` → **开发者模式** → **加载已解压的扩展程序** → 选本仓库的 **`extension`** 文件夹。
3. 浏览器允许 `sem.3ue.co` **自动下载多个文件**。
4. 打开你的 backlinks URL，登录，等表格出来。
5. 右下角 **「BackLinkSourceBot 扩展」** → **开始**（或点工具栏扩展图标 → 在本页开始）。

## 日志应出现
- `第 N 页 | 使用 frameId=…`（frameId 通常不是 0）
- `已点击导出 (Excel)`
- `已翻页 (页码+Enter 或 Pagination.NextPage)`

## 仍失败
把日志全文发 Issue；说明 iframe 是否跨域（扩展无法注入时列表为空）。
