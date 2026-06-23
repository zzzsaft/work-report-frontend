# 报工系统架构

## 系统边界

本项目是一套 React SPA，包含手机报工端和桌面管理端。认证域与报工域严格分离：

- `authClient` 只访问 `VITE_AUTH_API_BASE_URL`，负责企业微信登录、换取令牌和 `/auth/me` 校验。
- `workReportClient` 只访问 `VITE_WORK_REPORT_API_BASE_URL`，负责所有工单、工序、报工、统计和后台管理请求。
- 两个 client 都读取 `auth-storage` 中的 Bearer Token，但互不修改 baseURL。

## 分层

1. `src/domain/work-report.ts`：稳定的前端领域模型、状态和纯计算函数。
2. `src/api/services/workReport.repository.ts`：页面依赖的业务接口契约。
3. `mockWorkReport.repository.ts` / `realWorkReport.repository.ts`：Mock 与真实后端适配器。
4. `src/store/useWorkReportStore.ts`：移动端业务状态和动作。
5. `src/pages` 与 `src/components`：组合状态、交互和展示，不直接发 HTTP 请求。

## 路由

- 手机端：`/work/current`、`/work/operations`、`/work/stats`、`/me`。
- 管理端：`/admin/dashboard`、`orders`、`reports`、`people`、`exceptions`、`settings`。
- 页面与布局均使用懒加载；Mock 模式直接进入 Demo，真实模式由现有 `AuthGuard` 保护。

## 报工状态

首期每名员工只允许一个活动工序。多人可被分配到同一工序，但每人拥有独立 `WorkSession`。状态按 `assigned → running ↔ paused → completed` 流转；数据结构不限制 session 数量，可在后期开放单人并行工序。

## 工序领取与切换

- 员工只有在当前工序为 `assigned`、`paused` 或没有当前工序时可以切换工序；`running` 必须先暂停或完工。
- 切换候选只取当天 `assigned` 工序，包含后台分配和员工自主领取，不包含运行中、已完成、异常或已取消工序。
- 自主领取从工序池产生个人 `OperationAssignment`，`source` 为 `self_claimed`。未开始前员工可删除；开始后只能由高级后台移除。
- 被小组长或管理员分配的工序 `source` 为 `assigned` 或 `leader_imported`，员工不可自行删除。

## 两级后台

- 小组长后台使用同一个 `/admin` 壳，通过权限显示“小组长导入”。导入方式为从 Excel 复制表格文本，字段为产品号、部件号、工序号、工序名、数量、工时。
- 高级后台显示“人员分配”，可把工序池里的工序分配给指定员工，也可强制移除已开始或不可自删工序；移除动作应由后端记录审计原因。
- 权限由 `getCapabilities()` 返回，页面只根据能力展示入口，不在页面拼接后端请求。
