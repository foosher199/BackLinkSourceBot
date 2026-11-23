# 翻页失败根因（已验证）

## 现象
- 能导出第 1 页
- 之后无动作；用户手动滚到底才能看到 Next

## 根因（非延迟时间）
1. **Next 不是纯文本按钮**  
   Semrush 使用 Intergalactic 组件 `Pagination.NextPage`：DOM 上为 `button[data-ui-name="Pagination.NextPage"]`，常为图标或 i18n 文案，旧脚本用全文匹配 `Next` 经常失败。

2. **列表不在 window 上滚动**  
   主内容在 **内部 overflow 容器**；`window.scrollTo` 不会让列表动，用户看不到滚动。

3. **v1.0.x 的修复方向不完整**  
   只滚 window，未找真实 scroll 容器，也未使用页码输入框翻页。

## v1.1.0 策略
1. **优先页码框**：`Pagination.PageInput` + Enter（多数情况无需滚到底）
2. **备选**：`Pagination.NextPage` + `scrollIntoView` + 滚动主容器
3. 启动时输出 **诊断日志**（是否找到 Next / 页码框 / 滚动容器）

## 参考
- [Intergalactic Pagination](https://developer.semrush.com/intergalactic/components/pagination/pagination)
- 社区自动化：`button.getAttribute("data-ui-name") === "Pagination.NextPage"`
