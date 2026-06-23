# 真实 API 接入指南

## 只需修改的位置

1. 在部署环境填写 `VITE_WORK_REPORT_API_BASE_URL`，将 `VITE_USE_MOCK_DATA` 设为 `false`。
2. 打开 `src/api/services/realWorkReport.repository.ts`，把示例 endpoint 和后端路径对齐。
3. 如果后端 DTO 与领域模型不同，在该文件内增加 DTO 类型和映射函数；不要让页面依赖后端 DTO。

不要修改 `VITE_AUTH_API_BASE_URL`，也不要把报工请求加入 `authClient`。

## 当前建议接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/me/capabilities` | 业务角色与权限 |
| GET | `/assignments/current` | 当前工序 |
| GET | `/assignments` | 历史、当前、未来工序 |
| POST | `/assignments/:id/start` | 开始 |
| POST | `/assignments/:id/pause` | 暂停，body `{ reason? }` |
| POST | `/assignments/:id/resume` | 恢复 |
| POST | `/assignments/:id/complete` | 完工，body `{ photos, completedQuantity?, note? }` |
| GET | `/statistics/me?period=day|week|month` | 个人统计 |
| GET | `/attendance/me` | 个人出勤 |
| GET | `/admin/dashboard` | 后台概览 |
| GET | `/admin/orders` | 工单列表 |
| GET | `/admin/reports` | 报工记录 |
| GET | `/admin/exceptions` | 异常列表 |
| POST | `/admin/exceptions/:id/resolve` | 处理异常 |

## 鉴权与照片

`workReportClient` 通过公共拦截器发送 `Authorization: Bearer <token>`。若业务服务器将来采用令牌交换，仅替换该 client 的鉴权适配器。

Demo 将照片保存为 Data URL。生产接口推荐先上传文件获得 `fileId/url`，再把返回值传给 `completeAssignment`；该转换应放在真实 repository 内，页面流程无需变化。
