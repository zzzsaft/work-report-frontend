# 报工 API 对接文档

本文档是后端实现契约。后端按本文档提供接口和字段后，前端只需要配置 `VITE_WORK_REPORT_API_BASE_URL` 并将 `VITE_USE_MOCK_DATA=false`，不需要修改页面或 API 代码。

## 接入边界

- 认证接口仍使用原后端 `http://hz.jc-times.com:2000/`，不要修改 `VITE_AUTH_API_BASE_URL`。
- 报工接口使用独立后端地址 `VITE_WORK_REPORT_API_BASE_URL`，前端通过 `workReportClient` 请求。
- 每个报工请求都会带 `Authorization: Bearer <token>`，token 来自企业微信登录后的认证服务。
- 报工后端需要用该 token 识别当前用户，也可以在后端内部调用认证服务校验用户。
- 本文档字段名全部使用 camelCase，后端请直接返回 camelCase，避免前端增加 DTO 映射。

## 通用约定

### 时间和数字

- `id`：字符串，后端内部主键可以是数字，但接口统一返回字符串。
- 日期时间：ISO 8601 字符串，建议带时区，例如 `2026-06-23T08:00:00+08:00`。
- 日期：`YYYY-MM-DD`，例如 `2026-06-25`。
- 工时：小时数，允许 1 位或 2 位小数，例如 `7.5`。
- 秒数：整数，例如 `accumulatedSeconds: 8198`。
- 数量：整数，例如 `plannedQuantity: 120`。

### 成功响应

前端当前代码直接读取 Axios `response.data`，因此成功响应必须直接返回业务对象或数组，不要额外包一层 `data`。

正确：

```json
{
  "id": "assignment-001",
  "status": "running"
}
```

不要返回：

```json
{
  "code": 0,
  "data": {
    "id": "assignment-001"
  }
}
```

### 错误响应

建议错误响应使用：

```json
{
  "message": "该工序已开始，不能自行删除"
}
```

推荐状态码：

| 状态码 | 含义 |
| --- | --- |
| 400 | 请求参数错误 |
| 401 | token 缺失或失效 |
| 403 | 当前用户无权限 |
| 404 | 资源不存在 |
| 409 | 状态冲突，例如重复领取、已完工不能暂停 |
| 422 | 业务校验失败，例如完工照片为空 |
| 500 | 服务端异常 |

## 枚举值

### OperationStatus

| 值 | 含义 |
| --- | --- |
| `assigned` | 已分配，待开始 |
| `running` | 进行中 |
| `paused` | 已暂停 |
| `pending_submit` | 待提交，预留状态 |
| `completed` | 已完成 |
| `cancelled` | 已取消 |
| `exception` | 异常 |

### WorkOrderStatus

| 值 | 含义 |
| --- | --- |
| `pending` | 待生产 |
| `in_progress` | 生产中 |
| `completed` | 已完成 |
| `exception` | 异常 |

### AssignmentSource

| 值 | 含义 |
| --- | --- |
| `assigned` | 后台分配 |
| `self_claimed` | 员工自主领取 |
| `leader_imported` | 小组长导入 |

### 其他枚举

| 字段 | 可选值 |
| --- | --- |
| `AssignedBy.role` | `leader`, `admin`, `system` |
| `ClaimableOperation.status` | `available`, `claimed`, `closed` |
| `LaborStatistics.period` | `day`, `week`, `month` |
| `DailyAttendance.attendanceStatus` | `normal`, `late`, `leave` |
| `ProductionException.type` | `overtime`, `duplicate`, `missing` |
| `ProductionException.status` | `open`, `resolved` |
| `UserCapabilities.roles[]` | `worker`, `leader`, `admin` |

## 数据对象字段

### WorkOrder

用于后台工单列表。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 工单 ID |
| `orderNo` | string | 是 | 工单号 |
| `productCode` | string | 是 | 产品编号 |
| `productName` | string | 是 | 产品名称 |
| `plannedQuantity` | number | 是 | 计划数量 |
| `completedQuantity` | number | 是 | 已完成数量 |
| `dueDate` | string | 是 | 交期，`YYYY-MM-DD` |
| `progress` | number | 是 | 完成进度百分比，0 到 100 |
| `status` | WorkOrderStatus | 是 | 工单状态 |

示例：

```json
{
  "id": "order-001",
  "orderNo": "WO-20260623-018",
  "productCode": "CP-JSJ-240623-07",
  "productName": "减速机外壳",
  "plannedQuantity": 120,
  "completedQuantity": 74,
  "dueDate": "2026-06-25",
  "progress": 62,
  "status": "in_progress"
}
```

### OperationAssignment

用于移动端当前工序、工序清单、后台分配列表。前端依赖这个对象最多，请保持字段完整。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 员工工序分配 ID |
| `workOrderId` | string | 是 | 所属工单 ID |
| `orderNo` | string | 是 | 工单号 |
| `productCode` | string | 是 | 产品编号 |
| `productName` | string | 是 | 产品名称 |
| `partCode` | string | 是 | 部件编号 |
| `partName` | string | 否 | 部件名称；没有时前端显示部件编号 |
| `operationCode` | string | 是 | 工序编号 |
| `operationName` | string | 是 | 工序名称 |
| `operationNote` | string | 是 | 工序备注；没有备注也返回空字符串 |
| `plannedQuantity` | number | 是 | 计划数量 |
| `plannedStart` | string | 是 | 计划开始时间，ISO 8601 |
| `plannedEnd` | string | 是 | 计划结束时间，ISO 8601 |
| `collaborators` | string[] | 是 | 协作人员姓名列表，至少包含当前员工姓名 |
| `source` | AssignmentSource | 是 | 来源 |
| `canWorkerRemove` | boolean | 是 | 员工是否可自行删除；通常仅自领且未开始为 true |
| `estimatedHours` | number | 否 | 预计工时，小时 |
| `claimedAt` | string | 否 | 自主领取时间 |
| `assignedBy` | AssignedBy | 否 | 分配人信息 |
| `status` | OperationStatus | 是 | 当前状态 |
| `session` | WorkSession | 否 | 已开始后的报工会话；`assigned` 状态可以不返回 |

`AssignedBy`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 分配人用户 ID |
| `name` | string | 是 | 分配人姓名 |
| `role` | `leader` \| `admin` \| `system` | 是 | 分配来源角色 |

示例：

```json
{
  "id": "assignment-001",
  "workOrderId": "order-001",
  "orderNo": "WO-20260623-018",
  "productCode": "CP-JSJ-240623-07",
  "productName": "减速机外壳",
  "partCode": "PART-CASE-001",
  "partName": "壳体主件",
  "operationCode": "OP-030",
  "operationName": "精加工 · 铣削",
  "operationNote": "加工前确认夹具定位牢固；首件完成后检查孔距。",
  "plannedQuantity": 120,
  "plannedStart": "2026-06-23T08:00:00+08:00",
  "plannedEnd": "2026-06-23T17:30:00+08:00",
  "collaborators": ["张师傅", "李师傅"],
  "source": "assigned",
  "canWorkerRemove": false,
  "estimatedHours": 7.5,
  "assignedBy": { "id": "leader-01", "name": "周组长", "role": "leader" },
  "status": "running",
  "session": {
    "id": "session-001",
    "assignmentId": "assignment-001",
    "operatorId": "demo-worker",
    "operatorName": "张师傅",
    "status": "running",
    "startedAt": "2026-06-23T08:12:00+08:00",
    "accumulatedSeconds": 3600,
    "currentRunStartedAt": "2026-06-23T09:30:00+08:00",
    "pauses": [],
    "photos": []
  }
}
```

### WorkSession

用于记录一次员工对某个 assignment 的报工过程。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 报工会话 ID |
| `assignmentId` | string | 是 | 工序分配 ID |
| `operatorId` | string | 是 | 操作员工 ID |
| `operatorName` | string | 是 | 操作员工姓名 |
| `status` | OperationStatus | 是 | 会话状态，应与 assignment 状态一致 |
| `startedAt` | string | 否 | 首次开始时间 |
| `completedAt` | string | 否 | 完工时间 |
| `accumulatedSeconds` | number | 是 | 已累计有效作业秒数，不含当前正在跑的时间段 |
| `currentRunStartedAt` | string | 否 | 当前运行段开始时间；只有 `running` 状态需要 |
| `pauses` | PauseRecord[] | 是 | 暂停记录，没有则返回空数组 |
| `photos` | EvidencePhoto[] | 是 | 完工照片，没有则返回空数组 |
| `completedQuantity` | number | 否 | 本次完成数量 |
| `note` | string | 否 | 完工备注 |

前端计时规则：显示耗时 = `accumulatedSeconds` + 当前时间与 `currentRunStartedAt` 的差值。暂停和完成时，后端需要把当前运行段累加进 `accumulatedSeconds`，并清空 `currentRunStartedAt`。

### PauseRecord

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 暂停记录 ID |
| `startedAt` | string | 是 | 暂停开始时间 |
| `endedAt` | string | 否 | 恢复时间；当前暂停中的记录没有该字段 |
| `reason` | string | 否 | 暂停原因 |

### EvidencePhoto

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 照片 ID |
| `name` | string | 是 | 文件名 |
| `url` | string | 是 | 可访问地址。当前前端也能传 Data URL，但生产建议后端保存为文件 URL |
| `uploadedAt` | string | 是 | 上传时间 |

### UserCapabilities

用于控制后台入口和功能权限。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `roles` | string[] | 是 | 当前用户角色列表 |
| `canViewAdmin` | boolean | 是 | 是否可进入后台 |
| `canAssignWorkers` | boolean | 是 | 是否可分配员工 |
| `canReviewExceptions` | boolean | 是 | 是否可处理异常 |
| `canImportOperations` | boolean | 是 | 是否可导入工序 |
| `canViewTeamOperations` | boolean | 是 | 是否可看团队工序 |
| `canForceRemoveAssignments` | boolean | 是 | 是否可强制移除分配 |
| `canViewAllTeams` | boolean | 是 | 是否可看所有班组 |

普通员工示例：

```json
{
  "roles": ["worker"],
  "canViewAdmin": false,
  "canAssignWorkers": false,
  "canReviewExceptions": false,
  "canImportOperations": false,
  "canViewTeamOperations": false,
  "canForceRemoveAssignments": false,
  "canViewAllTeams": false
}
```

### ClaimableProduct

用于员工或后台搜索可领取产品。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 可领取产品 ID，通常可用工单产品行 ID |
| `orderNo` | string | 是 | 工单号 |
| `productCode` | string | 是 | 产品编号 |
| `productName` | string | 是 | 产品名称 |
| `remainingQuantity` | number | 是 | 当前剩余可领取数量 |

### ClaimablePart

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 部件 ID |
| `productId` | string | 是 | 所属 ClaimableProduct ID |
| `partCode` | string | 是 | 部件编号 |
| `partName` | string | 是 | 部件名称 |
| `operationCount` | number | 是 | 可领取工序数量 |
| `remainingQuantity` | number | 是 | 部件剩余数量 |

### ClaimableOperation

用于员工领取、后台分配、小组长导入后的工序池。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 工序池 ID |
| `productId` | string | 是 | 所属产品 ID |
| `partId` | string | 是 | 所属部件 ID |
| `orderNo` | string | 是 | 工单号 |
| `productCode` | string | 是 | 产品编号 |
| `productName` | string | 是 | 产品名称 |
| `partCode` | string | 是 | 部件编号 |
| `partName` | string | 是 | 部件名称 |
| `operationCode` | string | 是 | 工序编号 |
| `operationName` | string | 是 | 工序名称 |
| `operationNote` | string | 是 | 工序备注；没有备注返回空字符串 |
| `plannedQuantity` | number | 是 | 计划数量 |
| `estimatedHours` | number | 是 | 预计工时 |
| `claimedWorkers` | number | 是 | 已领取或已分配人数 |
| `status` | string | 是 | `available` 可领取，`claimed` 已领满，`closed` 已关闭 |

### LeaderImportDraft

小组长导入请求体中的单行数据。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `productCode` | string | 是 | 产品编号 |
| `partCode` | string | 是 | 部件编号 |
| `operationCode` | string | 是 | 工序编号 |
| `operationName` | string | 是 | 工序名称 |
| `quantity` | number | 是 | 数量，必须大于 0 |
| `estimatedHours` | number | 是 | 预计工时，必须大于 0 |

### LeaderImportResult

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `accepted` | number | 是 | 成功导入行数 |
| `rejected` | number | 是 | 拒绝行数 |
| `errors` | array | 是 | 错误列表，没有错误返回空数组 |
| `errors[].row` | number | 是 | 第几行，从 1 开始 |
| `errors[].message` | string | 是 | 错误说明 |

### LaborStatistics

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `period` | `day` \| `week` \| `month` | 是 | 统计周期 |
| `totalHours` | number | 是 | 总工时 |
| `regularHours` | number | 是 | 正常工时 |
| `overtimeHours` | number | 是 | 加班工时 |
| `completedOperations` | number | 是 | 完成工序数 |
| `attendanceDays` | number | 是 | 出勤天数 |
| `trend` | array | 是 | 趋势数据 |
| `trend[].label` | string | 是 | 横轴标签，例如 `周一`、`06-23` |
| `trend[].hours` | number | 是 | 当期总工时 |
| `trend[].overtime` | number | 是 | 当期加班工时 |

### DailyAttendance

当前前端接口已预留，后续个人出勤页使用。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `date` | string | 是 | 日期，`YYYY-MM-DD` |
| `shift` | string | 是 | 班次名称 |
| `regularHours` | number | 是 | 正常工时 |
| `overtimeHours` | number | 是 | 加班工时 |
| `attendanceStatus` | string | 是 | `normal`、`late`、`leave` |

### DashboardSummary

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `activeOrders` | number | 是 | 在制工单数 |
| `runningWorkers` | number | 是 | 当前进行中人数 |
| `todayHours` | number | 是 | 今日累计有效工时 |
| `exceptionCount` | number | 是 | 待处理异常数 |

### ReportRecord

后台报工记录列表。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 报工记录 ID |
| `orderNo` | string | 是 | 工单号 |
| `productName` | string | 是 | 产品名称 |
| `operationName` | string | 是 | 工序名称 |
| `operatorName` | string | 是 | 报工人员姓名 |
| `status` | OperationStatus | 是 | 报工状态 |
| `startedAt` | string | 是 | 开始时间 |
| `durationHours` | number | 是 | 累计工时，小时 |
| `photos` | EvidencePhoto[] | 是 | 凭证照片，没有则返回空数组 |

### ProductionException

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 异常 ID |
| `type` | string | 是 | `overtime` 超时、`duplicate` 重复、`missing` 信息缺失 |
| `title` | string | 是 | 异常标题 |
| `detail` | string | 是 | 异常详情 |
| `orderNo` | string | 是 | 工单号 |
| `createdAt` | string | 是 | 创建时间 |
| `status` | string | 是 | `open` 或 `resolved` |

## 接口清单

### 1. 获取当前用户业务权限

`GET /me/capabilities`

用途：前端登录后判断当前用户是否可以进入后台、导入工序、分配人员、处理异常。

请求：无 query，无 body。

返回：`UserCapabilities`

### 2. 获取当前工序

`GET /assignments/current`

用途：移动端首页展示当前正在做、已暂停、或今天可开始的第一道工序。

后端建议逻辑：

1. 优先返回当前用户 `running` 的 assignment。
2. 其次返回当前用户 `paused` 的 assignment。
3. 再返回今天 `plannedStart` 日期内、状态为 `assigned` 的第一条。
4. 没有则返回 `null`。

返回：`OperationAssignment | null`

### 3. 获取当前用户工序列表

`GET /assignments`

用途：移动端“工序清单”以及后台当前人员工序列表。

请求：无 query。当前前端会自己按状态分历史、当前、未来。

返回：`OperationAssignment[]`

排序建议：`running`、`paused`、今日 `assigned`、未来 `assigned`、历史 `completed`，同类按 `plannedStart` 升序。

### 4. 切换当前选中工序

`POST /assignments/:id/select`

用途：当前没有工序、或当前工序未开始/已暂停时，选择一道待开始工序作为当前工序。

路径参数：

| 字段 | 说明 |
| --- | --- |
| `id` | assignment ID |

请求 body：无。

业务规则：

- 只能选择当前用户自己的 assignment。
- 目标 assignment 应为 `assigned`。
- 如果用户已有 `running` 工序，返回 409。

返回：选中的 `OperationAssignment`

### 5. 开始工序

`POST /assignments/:id/start`

用途：员工点击“开始作业”。

请求 body：无。

业务规则：

- assignment 必须属于当前用户。
- 只有 `assigned` 或 `paused` 可开始。若是 `paused`，也可以按恢复处理。
- 开始后 assignment.status = `running`。
- 若没有 session，创建 session。
- session.startedAt 为首次开始时间。
- session.currentRunStartedAt 为当前时间。
- 自领工序开始后 `canWorkerRemove=false`。

返回：更新后的 `OperationAssignment`

### 6. 暂停工序

`POST /assignments/:id/pause`

用途：员工选择暂停原因并暂停计时。

请求 body：

```json
{
  "reason": "等待质检"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `reason` | string | 否 | 暂停原因 |

业务规则：

- 只有 `running` 可暂停。
- 将 `currentRunStartedAt` 至当前时间的秒数累加到 `accumulatedSeconds`。
- 清空 `currentRunStartedAt`。
- 新增一条 `PauseRecord`，`startedAt` 为当前时间，`endedAt` 为空。
- assignment.status 和 session.status 改为 `paused`。

返回：更新后的 `OperationAssignment`

### 7. 恢复工序

`POST /assignments/:id/resume`

用途：员工从暂停状态恢复作业。

请求 body：无。

业务规则：

- 只有 `paused` 可恢复。
- 将最后一条未结束的 pause.endedAt 设置为当前时间。
- session.currentRunStartedAt 设置为当前时间。
- assignment.status 和 session.status 改为 `running`。

返回：更新后的 `OperationAssignment`

### 8. 完成工序

`POST /assignments/:id/complete`

用途：员工上传完工照片并提交完成。

请求 body：

```json
{
  "photos": [
    {
      "name": "完工照片.jpg",
      "url": "data:image/jpeg;base64,..."
    }
  ],
  "completedQuantity": 40,
  "note": "首件已检查，正常流转"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `photos` | array | 是 | 至少 1 张 |
| `photos[].name` | string | 是 | 文件名 |
| `photos[].url` | string | 是 | 当前前端传 Data URL；生产可由后端保存后转换为文件 URL |
| `completedQuantity` | number | 否 | 本次完成数量 |
| `note` | string | 否 | 备注 |

业务规则：

- 只有 `running` 或 `paused` 可完成。
- 必须至少 1 张照片，否则返回 422。
- 若当前为 `running`，将当前运行段累加到 `accumulatedSeconds`。
- assignment.status 和 session.status 改为 `completed`。
- 设置 session.completedAt。
- 保存照片，返回时补全 `id`、`uploadedAt`。如果后端把 Data URL 存成文件，返回可访问 URL。
- 更新工单、工序池剩余数量和报工记录。

返回：更新后的 `OperationAssignment`

### 9. 搜索可领取产品

`GET /claim/products?keyword=CP-JSJ-240623-07`

用途：员工领取工序、后台分配工序时，按产品编号、产品名称或工单号搜索。

Query：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `keyword` | string | 是 | 搜索关键词 |

返回：`ClaimableProduct[]`

规则：

- keyword 为空时建议返回空数组。
- 只返回仍有可领取工序的产品。

### 10. 查询产品下可领取部件

`GET /claim/products/:productId/parts`

用途：选择产品后展示部件列表。

返回：`ClaimablePart[]`

### 11. 查询部件下可领取工序

`GET /claim/parts/:partId/operations`

用途：选择部件后展示可领取或可分配的工序。

返回：`ClaimableOperation[]`

### 12. 员工自主领取工序

`POST /claim/operations/:operationId/claim`

用途：员工把工序池中的工序领取到自己的工序清单。

请求 body：无。

业务规则：

- operation.status 必须是 `available`。
- 当前员工不能重复领取同一产品、部件、工序。
- 创建 assignment，source = `self_claimed`，status = `assigned`，canWorkerRemove = true。
- assignment.collaborators 至少包含当前员工姓名。
- 更新 operation.claimedWorkers。

返回：新建的 `OperationAssignment`

### 13. 员工删除未开始的自领工序

`DELETE /assignments/:assignmentId/claim`

用途：员工删除自己误领且未开始的工序。

业务规则：

- assignment 必须属于当前用户。
- 只有 source = `self_claimed`、status = `assigned`、canWorkerRemove = true 时允许删除。
- 删除后回退 operation.claimedWorkers。
- 不满足条件返回 409。

成功返回：HTTP 204 或空响应。

### 14. 获取个人统计

`GET /statistics/me?period=week`

用途：移动端“我的统计”和后台总览趋势。

Query：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `period` | string | 是 | `day`、`week`、`month` |

返回：`LaborStatistics`

### 15. 获取个人出勤

`GET /attendance/me`

用途：预留个人出勤明细。

返回：`DailyAttendance[]`

### 16. 后台生产总览

`GET /admin/dashboard`

权限：`canViewAdmin=true`

用途：后台首页 KPI。

返回：`DashboardSummary`

### 17. 后台工单列表

`GET /admin/orders`

权限：`canViewAdmin=true`

用途：后台查看工单进度。

返回：`WorkOrder[]`

### 18. 小组长导入工序池

`POST /leader/operations/import`

权限：`canImportOperations=true`

用途：小组长从 Excel 粘贴产品号、部件号、工序号、工序名、数量、工时，导入到可领取工序池。

请求 body：

```json
{
  "rows": [
    {
      "productCode": "CP-JSJ-240623-07",
      "partCode": "PART-CASE-001",
      "operationCode": "OP-080",
      "operationName": "终检复核",
      "quantity": 40,
      "estimatedHours": 1.5
    }
  ]
}
```

业务规则：

- 产品号、部件号、工序号、工序名不能为空。
- `quantity` 和 `estimatedHours` 必须大于 0。
- 同一次导入内相同 `productCode + partCode + operationCode` 应判为重复。
- 若校验失败，返回 200 和 `LeaderImportResult`，其中 `accepted=0`、`errors` 填明细，方便前端展示。
- 导入成功后创建或复用产品、部件，并创建 `ClaimableOperation`。

返回：`LeaderImportResult`

### 19. 高级后台分配工序

`POST /admin/assignments`

权限：`canAssignWorkers=true`

用途：管理员把可领取工序直接分配给某个员工。

请求 body：

```json
{
  "operationId": "pool-op-001",
  "workerId": "EMP-20240018",
  "workerName": "张师傅"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `operationId` | string | 是 | 工序池 ID |
| `workerId` | string | 是 | 员工 ID 或工号 |
| `workerName` | string | 是 | 员工姓名 |

业务规则：

- 创建 assignment，source = `assigned`，status = `assigned`，canWorkerRemove = false。
- assignment.collaborators 至少包含 `workerName`。
- assignedBy 使用当前管理员。
- 更新 operation.claimedWorkers。

成功返回：HTTP 204 或空响应。

### 20. 高级后台移除工序

`DELETE /admin/assignments/:assignmentId`

权限：`canForceRemoveAssignments=true`

用途：管理员移除员工无法自删的工序，包括已开始、自领或后台分配的异常工序。

请求 body：

```json
{
  "reason": "管理员调整工单项目"
}
```

业务规则：

- assignment.status 改为 `cancelled`，或从有效列表移除后保留历史记录。
- 写入报工记录或操作日志，记录原因、管理员、时间。
- 如果 assignment 尚未完成，应回退工序池可领取数量或 claimedWorkers。

成功返回：HTTP 204 或空响应。

### 21. 后台报工记录

`GET /admin/reports`

权限：`canViewAdmin=true`

用途：后台查看所有报工记录。

返回：`ReportRecord[]`

### 22. 后台异常列表

`GET /admin/exceptions`

权限：`canReviewExceptions=true`

用途：后台查看超时、重复报工、信息缺失等异常。

返回：`ProductionException[]`

### 23. 处理异常

`POST /admin/exceptions/:id/resolve`

权限：`canReviewExceptions=true`

用途：把异常标记为已处理。

请求 body：无。

业务规则：

- exception.status 改为 `resolved`。
- 记录处理人和处理时间。

成功返回：HTTP 204 或空响应。

## 推荐数据库表

表名仅为建议，后端可按现有规范调整，但字段需要能完整支撑上面的接口。

### users

用户表，可以同步企业微信或认证服务用户。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 用户 ID |
| `wecom_user_id` | varchar(128) | 企业微信 userId |
| `employee_no` | varchar(64) | 工号 |
| `name` | varchar(100) | 姓名 |
| `team_id` | varchar(64) | 班组 ID |
| `shift_id` | varchar(64) | 班次 ID |
| `status` | varchar(20) | `active`、`disabled` |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

### roles

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 角色 ID |
| `code` | varchar(50) | `worker`、`leader`、`admin` |
| `name` | varchar(100) | 角色名称 |

### user_roles

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user_id` | varchar(64) | 用户 ID |
| `role_id` | varchar(64) | 角色 ID |

建议联合唯一索引：`user_id + role_id`。

### teams

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 班组 ID |
| `name` | varchar(100) | 班组名称 |
| `leader_id` | varchar(64) | 组长用户 ID |

### shifts

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 班次 ID |
| `name` | varchar(100) | 班次名称，例如白班 |
| `start_time` | time | 开始时间 |
| `end_time` | time | 结束时间 |
| `regular_hours` | decimal(5,2) | 标准工时 |

### work_orders

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 工单 ID |
| `order_no` | varchar(100) UNIQUE | 工单号 |
| `product_code` | varchar(100) | 产品编号 |
| `product_name` | varchar(200) | 产品名称 |
| `planned_quantity` | int | 计划数量 |
| `completed_quantity` | int | 已完成数量 |
| `due_date` | date | 交期 |
| `status` | varchar(20) | `pending`、`in_progress`、`completed`、`exception` |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

建议索引：`order_no`、`product_code`、`status`、`due_date`。

### work_order_parts

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 部件 ID |
| `work_order_id` | varchar(64) | 工单 ID |
| `part_code` | varchar(100) | 部件编号 |
| `part_name` | varchar(200) | 部件名称 |
| `planned_quantity` | int | 计划数量 |
| `completed_quantity` | int | 已完成数量 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

建议联合索引：`work_order_id + part_code`。

### operation_pool

工序池，支撑领取、后台分配、小组长导入。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 工序池 ID |
| `work_order_id` | varchar(64) | 工单 ID |
| `part_id` | varchar(64) | 部件 ID |
| `operation_code` | varchar(100) | 工序编号 |
| `operation_name` | varchar(200) | 工序名称 |
| `operation_note` | text | 工序备注 |
| `planned_quantity` | int | 计划数量 |
| `remaining_quantity` | int | 剩余数量 |
| `estimated_hours` | decimal(8,2) | 预计工时 |
| `claimed_workers` | int | 已领取或已分配人数 |
| `status` | varchar(20) | `available`、`claimed`、`closed` |
| `source` | varchar(20) | `leader_imported`、`system`、`admin` |
| `created_by` | varchar(64) | 创建人 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

建议联合唯一索引：`work_order_id + part_id + operation_code`。

### operation_assignments

员工工序分配表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | assignment ID |
| `operation_pool_id` | varchar(64) | 工序池 ID |
| `work_order_id` | varchar(64) | 工单 ID |
| `part_id` | varchar(64) | 部件 ID |
| `worker_id` | varchar(64) | 员工 ID |
| `worker_name` | varchar(100) | 员工姓名快照 |
| `source` | varchar(20) | `assigned`、`self_claimed`、`leader_imported` |
| `status` | varchar(20) | OperationStatus |
| `planned_start` | datetime | 计划开始 |
| `planned_end` | datetime | 计划结束 |
| `planned_quantity` | int | 计划数量快照 |
| `estimated_hours` | decimal(8,2) | 预计工时快照 |
| `can_worker_remove` | boolean | 员工是否可删除 |
| `claimed_at` | datetime | 领取时间 |
| `assigned_by_id` | varchar(64) | 分配人 ID |
| `assigned_by_name` | varchar(100) | 分配人姓名快照 |
| `assigned_by_role` | varchar(20) | `leader`、`admin`、`system` |
| `cancelled_reason` | varchar(500) | 取消原因 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

建议索引：`worker_id + status`、`worker_id + planned_start`、`operation_pool_id`。

### assignment_collaborators

如果一道工序可能显示多名协作人员，建议单独建表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `assignment_id` | varchar(64) | assignment ID |
| `user_id` | varchar(64) | 协作人员 ID，可为空 |
| `name` | varchar(100) | 协作人员姓名 |

### work_sessions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | session ID |
| `assignment_id` | varchar(64) UNIQUE | assignment ID |
| `operator_id` | varchar(64) | 操作人 ID |
| `operator_name` | varchar(100) | 操作人姓名快照 |
| `status` | varchar(20) | OperationStatus |
| `started_at` | datetime | 首次开始时间 |
| `completed_at` | datetime | 完成时间 |
| `accumulated_seconds` | int | 累计有效秒数 |
| `current_run_started_at` | datetime | 当前运行段开始时间 |
| `completed_quantity` | int | 完成数量 |
| `note` | text | 完工备注 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

### pause_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 暂停记录 ID |
| `session_id` | varchar(64) | session ID |
| `started_at` | datetime | 暂停开始 |
| `ended_at` | datetime | 恢复时间 |
| `reason` | varchar(255) | 暂停原因 |

建议索引：`session_id + started_at`。

### evidence_photos

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 照片 ID |
| `session_id` | varchar(64) | session ID |
| `assignment_id` | varchar(64) | assignment ID |
| `name` | varchar(255) | 文件名 |
| `url` | text | 文件访问 URL |
| `storage_key` | varchar(500) | 对象存储 key，可选 |
| `uploaded_by` | varchar(64) | 上传人 |
| `uploaded_at` | datetime | 上传时间 |

### report_records

可以是物化表，也可以由 `operation_assignments + work_sessions` 查询生成。若需要审计和快速查询，建议保留。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 报工记录 ID |
| `assignment_id` | varchar(64) | assignment ID |
| `session_id` | varchar(64) | session ID |
| `work_order_id` | varchar(64) | 工单 ID |
| `order_no` | varchar(100) | 工单号快照 |
| `product_name` | varchar(200) | 产品名称快照 |
| `operation_name` | varchar(200) | 工序名称快照 |
| `operator_id` | varchar(64) | 操作人 ID |
| `operator_name` | varchar(100) | 操作人姓名快照 |
| `status` | varchar(20) | OperationStatus |
| `started_at` | datetime | 开始时间 |
| `duration_hours` | decimal(8,2) | 持续小时 |
| `created_at` | datetime | 创建时间 |

建议索引：`order_no`、`operator_id`、`started_at`、`status`。

### production_exceptions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 异常 ID |
| `assignment_id` | varchar(64) | assignment ID，可为空 |
| `work_order_id` | varchar(64) | 工单 ID，可为空 |
| `type` | varchar(20) | `overtime`、`duplicate`、`missing` |
| `title` | varchar(200) | 标题 |
| `detail` | text | 详情 |
| `order_no` | varchar(100) | 工单号快照 |
| `status` | varchar(20) | `open`、`resolved` |
| `created_at` | datetime | 创建时间 |
| `resolved_at` | datetime | 处理时间 |
| `resolved_by` | varchar(64) | 处理人 ID |

### attendance_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 出勤记录 ID |
| `user_id` | varchar(64) | 用户 ID |
| `date` | date | 日期 |
| `shift_id` | varchar(64) | 班次 ID |
| `regular_hours` | decimal(5,2) | 正常工时 |
| `overtime_hours` | decimal(5,2) | 加班工时 |
| `attendance_status` | varchar(20) | `normal`、`late`、`leave` |

建议唯一索引：`user_id + date`。

### operation_audit_logs

记录后台强制移除、异常处理、导入等关键动作。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) PK | 日志 ID |
| `action` | varchar(50) | 操作类型 |
| `target_type` | varchar(50) | 目标类型 |
| `target_id` | varchar(64) | 目标 ID |
| `operator_id` | varchar(64) | 操作人 ID |
| `operator_name` | varchar(100) | 操作人姓名 |
| `reason` | varchar(500) | 原因 |
| `payload_json` | json/text | 变更详情 |
| `created_at` | datetime | 创建时间 |

## 后端实现重点

1. 保持报工接口和认证接口隔离：报工后端不要接管 `/auth/wecom/token` 或 `/auth/me`。
2. 返回字段必须完整，数组字段没有数据时返回 `[]`，不要返回 `null`。
3. `OperationAssignment` 是核心聚合对象，建议后端查询时从工单、部件、工序池、assignment、session、pause、photo 聚合生成。
4. 所有状态变更接口要做幂等和状态校验，错误时返回明确 `message`。
5. 自主领取、后台分配、完工、强制移除都需要事务，避免 claimedWorkers、remainingQuantity、assignment 状态不一致。
6. 照片生产环境建议上传到对象存储或文件服务，并在 `complete` 响应里返回可访问 URL。
