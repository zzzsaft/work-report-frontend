import type { AdminAssignOperationInput, CompletionInput, WorkReportRepository } from "./workReport.repository";
import type {
  ClaimableOperation,
  ClaimablePart,
  ClaimableProduct,
  DailyAttendance,
  LeaderImportDraft,
  OperationAssignment,
  ProductionException,
  ReportRecord,
  WorkOrder,
} from "@/domain/work-report";
import { canWorkerRemoveAssignment, getSessionElapsedSeconds, getSwitchableAssignmentsForDate } from "@/domain/work-report";

const STORAGE_KEY = "work-report-mock-db-v3";
const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();
const todayStart = (hour: number) => `2026-06-23T${String(hour).padStart(2, "0")}:00:00+08:00`;
const todayEnd = (hour: number, minute = 0) => `2026-06-23T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;

interface MockDb {
  assignments: OperationAssignment[];
  orders: WorkOrder[];
  claimProducts: ClaimableProduct[];
  claimParts: ClaimablePart[];
  claimOperations: ClaimableOperation[];
  reports: ReportRecord[];
  exceptions: ProductionException[];
}

const baseAssignment = (status: "assigned" | "running" | "paused" = "running"): OperationAssignment => {
  const started = new Date(Date.now() - 2 * 3600_000 - 16 * 60_000 - 38_000).toISOString();
  return {
    id: "assignment-001",
    workOrderId: "order-001",
    orderNo: "WO-20260623-018",
    productCode: "CP-JSJ-240623-07",
    productName: "减速机外壳",
    partCode: "PART-CASE-001",
    partName: "壳体主件",
    operationCode: "OP-030",
    operationName: "精加工 · 铣削",
    operationNote: "加工前确认夹具定位牢固；首件完成后检查孔距与表面粗糙度，发现毛刺立即停机反馈。",
    plannedQuantity: 120,
    plannedStart: todayStart(8),
    plannedEnd: todayEnd(17, 30),
    collaborators: ["王师傅", "李师傅"],
    source: "assigned",
    canWorkerRemove: false,
    estimatedHours: 7.5,
    assignedBy: { id: "leader-01", name: "周组长", role: "leader" },
    status,
    session: status === "assigned" ? undefined : {
      id: "session-001",
      assignmentId: "assignment-001",
      operatorId: "demo-worker",
      operatorName: "张师傅",
      status,
      startedAt: started,
      accumulatedSeconds: status === "paused" ? 8198 : 0,
      currentRunStartedAt: status === "running" ? started : undefined,
      pauses: status === "paused" ? [{ id: "pause-001", startedAt: nowIso(), reason: "等待质检" }] : [],
      photos: [],
    },
  };
};

const claimProducts: ClaimableProduct[] = [
  { id: "claim-product-001", orderNo: "WO-20260623-018", productCode: "CP-JSJ-240623-07", productName: "减速机外壳", remainingQuantity: 46 },
  { id: "claim-product-002", orderNo: "WO-20260623-021", productCode: "CP-FL-240623-02", productName: "连接法兰", remainingQuantity: 52 },
];

const claimParts: ClaimablePart[] = [
  { id: "part-001", productId: "claim-product-001", partCode: "PART-CASE-001", partName: "壳体主件", operationCount: 3, remainingQuantity: 46 },
  { id: "part-002", productId: "claim-product-001", partCode: "PART-COVER-002", partName: "端盖", operationCount: 2, remainingQuantity: 28 },
  { id: "part-003", productId: "claim-product-002", partCode: "PART-FLANGE-001", partName: "法兰盘", operationCount: 2, remainingQuantity: 52 },
];

const claimOperations: ClaimableOperation[] = [
  { id: "pool-op-001", productId: "claim-product-001", partId: "part-001", orderNo: "WO-20260623-018", productCode: "CP-JSJ-240623-07", productName: "减速机外壳", partCode: "PART-CASE-001", partName: "壳体主件", operationCode: "OP-060", operationName: "终检前倒角", operationNote: "重点检查窗口边、孔口倒角，完成后流转终检。", plannedQuantity: 40, estimatedHours: 2.5, claimedWorkers: 1, maxClaimWorkers: 2, status: "available" },
  { id: "pool-op-002", productId: "claim-product-001", partId: "part-001", orderNo: "WO-20260623-018", productCode: "CP-JSJ-240623-07", productName: "减速机外壳", partCode: "PART-CASE-001", partName: "壳体主件", operationCode: "OP-070", operationName: "清洗包装", operationNote: "清洗后擦干，按周转箱标签摆放。", plannedQuantity: 40, estimatedHours: 1.5, claimedWorkers: 0, status: "available" },
  { id: "pool-op-003", productId: "claim-product-001", partId: "part-002", orderNo: "WO-20260623-018", productCode: "CP-JSJ-240623-07", productName: "减速机外壳", partCode: "PART-COVER-002", partName: "端盖", operationCode: "OP-020", operationName: "端盖钻孔", operationNote: "孔位按图纸 A2 面基准，首件需复核。", plannedQuantity: 28, estimatedHours: 2, claimedWorkers: 0, status: "available" },
  { id: "pool-op-004", productId: "claim-product-002", partId: "part-003", orderNo: "WO-20260623-021", productCode: "CP-FL-240623-02", productName: "连接法兰", partCode: "PART-FLANGE-001", partName: "法兰盘", operationCode: "OP-030", operationName: "法兰攻丝", operationNote: "M10 丝孔，攻丝后吹净铁屑。", plannedQuantity: 52, estimatedHours: 3, claimedWorkers: 2, maxClaimWorkers: 2, status: "claimed" },
];

const completedAssignment = (id: string, daysAgo: number, operationCode: string, operationName: string, productCode: string, productName: string): OperationAssignment => {
  const date = new Date(new Date("2026-06-23T08:00:00+08:00").getTime() - daysAgo * 24 * 3600_000);
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const compactDate = dateKey.replace(/-/g, "").slice(2);
  const plannedStart = `${dateKey}T08:00:00+08:00`;
  const completedAt = `${dateKey}T16:20:00+08:00`;
  return {
    ...baseAssignment("assigned"),
    id,
    orderNo: `WO-${compactDate}-${String(10 + daysAgo).padStart(3, "0")}`,
    productCode,
    productName,
    operationCode,
    operationName,
    operationNote: "历史完工记录，用于演示按时间筛选和加载更多。",
    plannedStart,
    plannedEnd: `${dateKey}T16:30:00+08:00`,
    status: "completed",
    session: {
      id: `session-${id}`,
      assignmentId: id,
      operatorId: "demo-worker",
      operatorName: "张师傅",
      status: "completed",
      startedAt: plannedStart,
      completedAt,
      accumulatedSeconds: Math.round((6.5 + (daysAgo % 3) * 0.5) * 3600),
      pauses: [],
      photos: [{ id: `photo-${id}`, name: "完工照片.jpg", url: "", uploadedAt: completedAt }],
    },
  };
};

const initialDb = (scenario: "assigned" | "running" | "paused" = "running"): MockDb => ({
  assignments: [
    baseAssignment(scenario),
    { ...baseAssignment("assigned"), id: "assignment-002", operationCode: "OP-040", operationName: "钻孔 · 攻丝", operationNote: "使用M8丝锥，完工后逐件清理铁屑。", plannedStart: todayStart(14), plannedEnd: todayEnd(16), collaborators: ["张师傅"], session: undefined },
    { ...baseAssignment("assigned"), id: "assignment-004", operationCode: "OP-050", operationName: "去毛刺 · 清洗", operationNote: "重点检查孔口和边缘，清洗后擦干并整齐摆放。", plannedStart: todayStart(16), plannedEnd: todayEnd(17, 30), collaborators: ["张师傅", "赵师傅"], session: undefined },
    { ...baseAssignment("assigned"), id: "assignment-003", orderNo: "WO-20260622-011", productCode: "CP-ZC-240622-03", productName: "传动轴", partCode: "PART-SHAFT-001", partName: "轴体", operationName: "粗加工 · 车削", status: "completed", plannedStart: "2026-06-22T08:00:00+08:00", plannedEnd: "2026-06-22T16:30:00+08:00", session: { ...baseAssignment("running").session!, id: "session-003", status: "completed", accumulatedSeconds: 24300, currentRunStartedAt: undefined, completedAt: "2026-06-22T16:10:00+08:00", photos: [{ id: "photo-1", name: "完工照片.jpg", url: "", uploadedAt: "2026-06-22T16:10:00+08:00" }] } },
    completedAssignment("history-004", 2, "OP-020", "半精车削", "CP-ZC-240621-02", "传动轴"),
    completedAssignment("history-005", 3, "OP-030", "键槽铣削", "CP-ZC-240620-08", "花键轴"),
    completedAssignment("history-006", 4, "OP-010", "下料检验", "CP-FL-240619-01", "连接法兰"),
    completedAssignment("history-007", 5, "OP-040", "外圆磨削", "CP-ZC-240618-05", "定位轴"),
    completedAssignment("history-008", 8, "OP-050", "清洗包装", "CP-JSJ-240615-03", "减速机端盖"),
    completedAssignment("history-009", 12, "OP-020", "钻孔攻丝", "CP-FL-240611-06", "安装法兰"),
    completedAssignment("history-010", 18, "OP-030", "精铣平面", "CP-JSJ-240605-02", "箱体盖板"),
    completedAssignment("history-011", 31, "OP-010", "粗加工", "CP-ZC-240523-09", "主动轴"),
    completedAssignment("history-012", 45, "OP-060", "终检复核", "CP-FL-240509-04", "法兰盘"),
  ],
  orders: [
    { id: "order-001", orderNo: "WO-20260623-018", productCode: "CP-JSJ-240623-07", productName: "减速机外壳", plannedQuantity: 120, completedQuantity: 74, dueDate: "2026-06-25", progress: 62, status: "in_progress" },
    { id: "order-002", orderNo: "WO-20260623-021", productCode: "CP-FL-240623-02", productName: "连接法兰", plannedQuantity: 80, completedQuantity: 28, dueDate: "2026-06-26", progress: 35, status: "in_progress" },
    { id: "order-003", orderNo: "WO-20260622-011", productCode: "CP-ZC-240622-03", productName: "传动轴", plannedQuantity: 60, completedQuantity: 60, dueDate: "2026-06-23", progress: 100, status: "completed" },
  ],
  claimProducts,
  claimParts,
  claimOperations,
  reports: [
    { id: "report-001", orderNo: "WO-20260622-011", productName: "传动轴", operationName: "粗加工 · 车削", operatorName: "张师傅", status: "completed", startedAt: "2026-06-22T08:12:00+08:00", durationHours: 6.75, photos: [] },
    { id: "report-002", orderNo: "WO-20260623-021", productName: "连接法兰", operationName: "钻孔", operatorName: "王师傅", status: "running", startedAt: "2026-06-23T09:05:00+08:00", durationHours: 3.4, photos: [] },
    { id: "report-003", orderNo: "WO-20260623-018", productName: "减速机外壳", operationName: "精加工 · 铣削", operatorName: "李师傅", status: "paused", startedAt: "2026-06-23T08:20:00+08:00", durationHours: 2.1, photos: [] },
  ],
  exceptions: [
    { id: "ex-001", type: "overtime", title: "工序用时超过计划", detail: "精加工 · 铣削已超过计划工时 45 分钟", orderNo: "WO-20260623-018", createdAt: "2026-06-23T14:20:00+08:00", status: "open" },
    { id: "ex-002", type: "missing", title: "完工信息待补充", detail: "报工记录缺少完工数量", orderNo: "WO-20260622-009", createdAt: "2026-06-23T10:12:00+08:00", status: "open" },
  ],
});

const load = (): MockDb => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
    const legacy = localStorage.getItem("work-report-mock-db-v2");
    if (legacy) localStorage.removeItem("work-report-mock-db-v2");
    const db = initialDb();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  } catch {
    return initialDb();
  }
};
const save = (db: MockDb) => localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
const findAssignment = (db: MockDb, id: string) => {
  const assignment = db.assignments.find((item) => item.id === id);
  if (!assignment) throw new Error("未找到工序");
  return assignment;
};
const updateAssignment = (id: string, updater: (item: OperationAssignment) => OperationAssignment) => {
  const db = load();
  const index = db.assignments.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("未找到工序");
  db.assignments[index] = updater(db.assignments[index]);
  save(db);
  return db.assignments[index];
};

const createAssignmentFromPool = (operation: ClaimableOperation, source: OperationAssignment["source"], workerName = "张师傅"): OperationAssignment => ({
  id: `assignment-${Date.now()}`,
  workOrderId: operation.productId,
  orderNo: operation.orderNo,
  productCode: operation.productCode,
  productName: operation.productName,
  partCode: operation.partCode,
  partName: operation.partName,
  operationCode: operation.operationCode,
  operationName: operation.operationName,
  operationNote: operation.operationNote,
  plannedQuantity: operation.plannedQuantity,
  plannedStart: todayStart(13),
  plannedEnd: todayEnd(18),
  collaborators: [workerName],
  source,
  canWorkerRemove: source === "self_claimed",
  estimatedHours: operation.estimatedHours,
  claimedAt: source === "self_claimed" ? nowIso() : undefined,
  assignedBy: source === "self_claimed" ? undefined : { id: "admin-01", name: "生产管理员", role: "admin" },
  status: "assigned",
});

export const mockWorkReportRepository: WorkReportRepository = {
  async getCapabilities() {
    await delay();
    return { roles: ["worker", "leader", "admin"], canViewAdmin: true, canAssignWorkers: true, canReviewExceptions: true, canImportOperations: true, canViewTeamOperations: true, canForceRemoveAssignments: true, canViewAllTeams: true };
  },
  async getCurrentAssignment() {
    await delay();
    const today = new Date();
    const assignments = load().assignments;
    return assignments.find((item) => ["running", "paused"].includes(item.status)) || getSwitchableAssignmentsForDate(assignments, today)[0] || null;
  },
  async getAssignments() { await delay(); return load().assignments; },
  async setCurrentAssignment(id) { await delay(); return findAssignment(load(), id); },
  async startAssignment(id) {
    await delay();
    return updateAssignment(id, (item) => ({ ...item, canWorkerRemove: false, status: "running", session: { id: `session-${Date.now()}`, assignmentId: id, operatorId: "demo-worker", operatorName: "张师傅", status: "running", startedAt: nowIso(), currentRunStartedAt: nowIso(), accumulatedSeconds: 0, pauses: [], photos: [] } }));
  },
  async pauseAssignment(id, reason) {
    await delay();
    return updateAssignment(id, (item) => {
      if (!item.session) throw new Error("当前工序尚未开始");
      const elapsed = getSessionElapsedSeconds(item.session);
      return { ...item, status: "paused", session: { ...item.session, status: "paused", accumulatedSeconds: elapsed, currentRunStartedAt: undefined, pauses: [...item.session.pauses, { id: `pause-${Date.now()}`, startedAt: nowIso(), reason }] } };
    });
  },
  async resumeAssignment(id) {
    await delay();
    return updateAssignment(id, (item) => {
      if (!item.session) throw new Error("当前工序尚未开始");
      const pauses = item.session.pauses.map((pause, index, all) => index === all.length - 1 ? { ...pause, endedAt: nowIso() } : pause);
      return { ...item, status: "running", session: { ...item.session, status: "running", currentRunStartedAt: nowIso(), pauses } };
    });
  },
  async completeAssignment(id, input: CompletionInput) {
    await delay(420);
    if (!input.photos.length) throw new Error("请至少上传一张完工照片");
    return updateAssignment(id, (item) => {
      if (!item.session) throw new Error("当前工序尚未开始");
      const elapsed = getSessionElapsedSeconds(item.session);
      return { ...item, status: "completed", canWorkerRemove: false, session: { ...item.session, status: "completed", accumulatedSeconds: elapsed, currentRunStartedAt: undefined, completedAt: nowIso(), photos: input.photos.map((photo, index) => ({ id: `photo-${Date.now()}-${index}`, ...photo, uploadedAt: nowIso() })), completedQuantity: input.completedQuantity, note: input.note } };
    });
  },
  async searchClaimableProducts(keyword) {
    await delay();
    const key = keyword.trim().toLowerCase();
    if (!key) return load().claimProducts;
    return load().claimProducts.filter((item) => `${item.productCode}${item.productName}${item.orderNo}`.toLowerCase().includes(key));
  },
  async getClaimableParts(productId) { await delay(); return load().claimParts.filter((item) => item.productId === productId); },
  async getClaimableOperations(partId) { await delay(); return load().claimOperations.filter((item) => item.partId === partId); },
  async claimOperation(operationId) {
    await delay();
    const db = load();
    const operation = db.claimOperations.find((item) => item.id === operationId);
    if (!operation || operation.status !== "available") throw new Error("该工序暂不可领取");
    if (operation.maxClaimWorkers && operation.claimedWorkers >= operation.maxClaimWorkers) throw new Error("该工序领取人数已满");
    const duplicate = db.assignments.some((item) => item.operationCode === operation.operationCode && item.partCode === operation.partCode && item.productCode === operation.productCode && item.status !== "cancelled");
    if (duplicate) throw new Error("你已经有这道工序，不能重复领取");
    const assignment = createAssignmentFromPool(operation, "self_claimed");
    db.assignments.unshift(assignment);
    db.claimOperations = db.claimOperations.map((item) => {
      if (item.id !== operationId) return item;
      const claimedWorkers = item.claimedWorkers + 1;
      return { ...item, claimedWorkers, status: item.maxClaimWorkers && claimedWorkers >= item.maxClaimWorkers ? "claimed" : item.status };
    });
    save(db);
    return assignment;
  },
  async removeClaimedAssignment(assignmentId) {
    await delay();
    const db = load();
    const assignment = findAssignment(db, assignmentId);
    if (!canWorkerRemoveAssignment(assignment)) throw new Error("该工序已开始或由后台分配，不能自行删除");
    db.assignments = db.assignments.filter((item) => item.id !== assignmentId);
    db.claimOperations = db.claimOperations.map((item) => {
      const sameOperation = item.productCode === assignment.productCode && item.partCode === assignment.partCode && item.operationCode === assignment.operationCode;
      if (!sameOperation) return item;
      const claimedWorkers = Math.max(0, item.claimedWorkers - 1);
      return { ...item, claimedWorkers, status: item.status === "closed" ? item.status : "available" };
    });
    save(db);
  },
  async getStatistics(period) {
    await delay();
    if (period === "day") {
      return { period, totalHours: 8.6, regularHours: 8, overtimeHours: 0.6, completedOperations: 3, attendanceDays: 1, trend: [] };
    }
    if (period === "month") {
      return {
        period,
        totalHours: 356.5,
        regularHours: 336,
        overtimeHours: 20.5,
        completedOperations: 118,
        attendanceDays: 42,
        trend: ["5月第1周", "5月第2周", "5月第3周", "5月第4周", "6月第1周", "6月第2周", "6月第3周", "本周"].map((label, index) => ({ label, hours: [38, 42.5, 40, 45, 41, 43.5, 44, 42.5][index], overtime: [1, 2.5, 0, 4, 1.5, 3.5, 4.5, 3.5][index] })),
      };
    }
    return { period, totalHours: 43, regularHours: 40, overtimeHours: 3, completedOperations: 15, attendanceDays: 5, trend: ["周一", "周二", "周三", "周四", "周五", "周六"].map((label, index) => ({ label, hours: [8, 8.5, 7.8, 9.2, 8.4, 4.2][index], overtime: [0, .5, 0, 1.2, .4, 0][index] })) };
  },
  async getAttendance() { await delay(); return [0, 1, 2, 3, 4].map((offset): DailyAttendance => ({ date: `2026-06-${23 - offset}`, shift: "白班", regularHours: 8, overtimeHours: offset === 0 ? .6 : offset === 2 ? 1.2 : 0, attendanceStatus: "normal" })); },
  async getDashboard() { await delay(); const db = load(); return { activeOrders: db.orders.filter((x) => x.status === "in_progress").length, runningWorkers: 18, todayHours: 146.5, exceptionCount: db.exceptions.filter((x) => x.status === "open").length }; },
  async getOrders() { await delay(); return load().orders; },
  async getReports() { await delay(); return load().reports; },
  async getExceptions() { await delay(); return load().exceptions; },
  async resolveException(id) { await delay(); const db = load(); db.exceptions = db.exceptions.map((item) => item.id === id ? { ...item, status: "resolved" } : item); save(db); },
  async importLeaderOperations(rows: LeaderImportDraft[]) {
    await delay(260);
    const db = load();
    const errors: Array<{ row: number; message: string }> = [];
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      const key = `${row.productCode}-${row.partCode}-${row.operationCode}`;
      if (!row.productCode || !row.partCode || !row.operationCode || !row.operationName) errors.push({ row: index + 1, message: "产品号、部件号、工序号、工序名不能为空" });
      if (!Number.isFinite(row.quantity) || row.quantity <= 0) errors.push({ row: index + 1, message: "数量必须为大于 0 的数字" });
      if (!Number.isFinite(row.estimatedHours) || row.estimatedHours <= 0) errors.push({ row: index + 1, message: "工时必须为大于 0 的数字" });
      if (seen.has(key)) errors.push({ row: index + 1, message: "粘贴内容中存在重复工序" });
      seen.add(key);
    });
    if (errors.length) return { accepted: 0, rejected: errors.length, errors };
    rows.forEach((row, index) => {
      const product = db.claimProducts.find((item) => item.productCode === row.productCode) || { id: `claim-product-import-${Date.now()}-${index}`, orderNo: `LEADER-${row.productCode}`, productCode: row.productCode, productName: row.productCode, remainingQuantity: row.quantity };
      if (!db.claimProducts.some((item) => item.id === product.id)) db.claimProducts.push(product);
      const part = db.claimParts.find((item) => item.productId === product.id && item.partCode === row.partCode) || { id: `part-import-${Date.now()}-${index}`, productId: product.id, partCode: row.partCode, partName: row.partCode, operationCount: 0, remainingQuantity: row.quantity };
      if (!db.claimParts.some((item) => item.id === part.id)) db.claimParts.push(part);
      part.operationCount += 1;
      db.claimOperations.push({ id: `pool-op-import-${Date.now()}-${index}`, productId: product.id, partId: part.id, orderNo: product.orderNo, productCode: product.productCode, productName: product.productName, partCode: part.partCode, partName: part.partName, operationCode: row.operationCode, operationName: row.operationName, operationNote: "小组长导入工序，请按现场工艺要求执行。", plannedQuantity: row.quantity, estimatedHours: row.estimatedHours, claimedWorkers: 0, status: "available" });
    });
    save(db);
    return { accepted: rows.length, rejected: 0, errors: [] };
  },
  async adminAssignOperation(input: AdminAssignOperationInput) {
    await delay();
    const db = load();
    const operation = db.claimOperations.find((item) => item.id === input.operationId);
    if (!operation) throw new Error("未找到可分配工序");
    db.assignments.unshift(createAssignmentFromPool(operation, "assigned", input.workerName));
    save(db);
  },
  async adminRemoveAssignment(assignmentId, reason) {
    await delay();
    const db = load();
    const assignment = findAssignment(db, assignmentId);
    db.assignments = db.assignments.filter((item) => item.id !== assignmentId);
    db.reports.unshift({ id: `report-remove-${Date.now()}`, orderNo: assignment.orderNo, productName: assignment.productName, operationName: `${assignment.operationName}（后台移除：${reason}）`, operatorName: assignment.collaborators[0] || "张师傅", status: "cancelled", startedAt: nowIso(), durationHours: 0, photos: [] });
    save(db);
  },
  async resetDemo(scenario = "running") { await delay(100); save(initialDb(scenario)); },
};
