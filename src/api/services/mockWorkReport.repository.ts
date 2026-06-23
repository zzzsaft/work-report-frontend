import type { WorkReportRepository, CompletionInput } from "./workReport.repository";
import type {
  DailyAttendance,
  OperationAssignment,
  ProductionException,
  ReportRecord,
  WorkOrder,
} from "@/domain/work-report";
import { getPendingAssignmentsForDate, getSessionElapsedSeconds } from "@/domain/work-report";

const STORAGE_KEY = "work-report-mock-db-v2";
const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();

interface MockDb {
  assignments: OperationAssignment[];
  orders: WorkOrder[];
  reports: ReportRecord[];
  exceptions: ProductionException[];
}

const makeAssignment = (status: "assigned" | "running" | "paused" = "running"): OperationAssignment => {
  const started = new Date(Date.now() - 2 * 3600_000 - 16 * 60_000 - 38_000).toISOString();
  return {
    id: "assignment-001",
    workOrderId: "order-001",
    orderNo: "WO-20260623-018",
    productCode: "CP-JSJ-240623-07",
    productName: "减速机外壳",
    operationCode: "OP-030",
    operationName: "精加工 · 铣削",
    operationNote: "加工前确认夹具定位牢固；首件完成后检查孔距与表面粗糙度，发现毛刺立即停机反馈。",
    plannedQuantity: 120,
    plannedStart: "2026-06-23T08:00:00+08:00",
    plannedEnd: "2026-06-23T17:30:00+08:00",
    collaborators: ["王师傅", "李师傅"],
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

const initialDb = (scenario: "assigned" | "running" | "paused" = "running"): MockDb => ({
  assignments: [
    makeAssignment(scenario),
    { ...makeAssignment("assigned"), id: "assignment-002", operationCode: "OP-040", operationName: "钻孔 · 攻丝", operationNote: "使用M8丝锥，完工后逐件清理铁屑。", plannedStart: "2026-06-23T14:00:00+08:00", plannedEnd: "2026-06-23T16:00:00+08:00", collaborators: ["张师傅"], session: undefined },
    { ...makeAssignment("assigned"), id: "assignment-004", operationCode: "OP-050", operationName: "去毛刺 · 清洗", operationNote: "重点检查孔口和边缘，清洗后擦干并整齐摆放。", plannedStart: "2026-06-23T16:00:00+08:00", plannedEnd: "2026-06-23T17:30:00+08:00", collaborators: ["张师傅", "赵师傅"], session: undefined },
    { ...makeAssignment("assigned"), id: "assignment-003", orderNo: "WO-20260622-011", operationName: "粗加工 · 车削", status: "completed", session: { ...makeAssignment("running").session!, id: "session-003", status: "completed", accumulatedSeconds: 24300, currentRunStartedAt: undefined, completedAt: "2026-06-22T16:10:00+08:00", photos: [{ id: "photo-1", name: "完工照片.jpg", url: "", uploadedAt: "2026-06-22T16:10:00+08:00" }] } },
  ],
  orders: [
    { id: "order-001", orderNo: "WO-20260623-018", productCode: "CP-JSJ-240623-07", productName: "减速机外壳", plannedQuantity: 120, completedQuantity: 74, dueDate: "2026-06-25", progress: 62, status: "in_progress" },
    { id: "order-002", orderNo: "WO-20260623-021", productCode: "CP-FL-240623-02", productName: "连接法兰", plannedQuantity: 80, completedQuantity: 28, dueDate: "2026-06-26", progress: 35, status: "in_progress" },
    { id: "order-003", orderNo: "WO-20260622-011", productCode: "CP-ZC-240622-03", productName: "传动轴", plannedQuantity: 60, completedQuantity: 60, dueDate: "2026-06-23", progress: 100, status: "completed" },
  ],
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
    const db = initialDb();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }
  catch { return initialDb(); }
};
const save = (db: MockDb) => localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
const updateAssignment = (id: string, updater: (item: OperationAssignment) => OperationAssignment) => {
  const db = load();
  const index = db.assignments.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("未找到工序");
  db.assignments[index] = updater(db.assignments[index]);
  save(db);
  return db.assignments[index];
};

export const mockWorkReportRepository: WorkReportRepository = {
  async getCapabilities() { await delay(); return { roles: ["worker", "leader", "admin"], canViewAdmin: true, canAssignWorkers: true, canReviewExceptions: true }; },
  async getCurrentAssignment() { await delay(); return getPendingAssignmentsForDate(load().assignments, new Date())[0] || null; },
  async getAssignments() { await delay(); return load().assignments; },
  async startAssignment(id) {
    await delay();
    return updateAssignment(id, (item) => ({ ...item, status: "running", session: { id: `session-${Date.now()}`, assignmentId: id, operatorId: "demo-worker", operatorName: "张师傅", status: "running", startedAt: nowIso(), currentRunStartedAt: nowIso(), accumulatedSeconds: 0, pauses: [], photos: [] } }));
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
      return { ...item, status: "completed", session: { ...item.session, status: "completed", accumulatedSeconds: elapsed, currentRunStartedAt: undefined, completedAt: nowIso(), photos: input.photos.map((photo, index) => ({ id: `photo-${Date.now()}-${index}`, ...photo, uploadedAt: nowIso() })), completedQuantity: input.completedQuantity, note: input.note } };
    });
  },
  async getStatistics(period) { await delay(); const multiplier = period === "day" ? 1 : period === "week" ? 5 : 22; return { period, totalHours: 8.6 * multiplier, regularHours: 8 * multiplier, overtimeHours: 0.6 * multiplier, completedOperations: 3 * multiplier, attendanceDays: multiplier, trend: ["周一", "周二", "周三", "周四", "周五", "周六"].map((label, index) => ({ label, hours: [8, 8.5, 7.8, 9.2, 8.4, 4.2][index], overtime: [0, .5, 0, 1.2, .4, 0][index] })) }; },
  async getAttendance() { await delay(); return [0, 1, 2, 3, 4].map((offset): DailyAttendance => ({ date: `2026-06-${23 - offset}`, shift: "白班", regularHours: 8, overtimeHours: offset === 0 ? .6 : offset === 2 ? 1.2 : 0, attendanceStatus: "normal" })); },
  async getDashboard() { await delay(); const db = load(); return { activeOrders: db.orders.filter((x) => x.status === "in_progress").length, runningWorkers: 18, todayHours: 146.5, exceptionCount: db.exceptions.filter((x) => x.status === "open").length }; },
  async getOrders() { await delay(); return load().orders; },
  async getReports() { await delay(); return load().reports; },
  async getExceptions() { await delay(); return load().exceptions; },
  async resolveException(id) { await delay(); const db = load(); db.exceptions = db.exceptions.map((item) => item.id === id ? { ...item, status: "resolved" } : item); save(db); },
  async resetDemo(scenario = "running") { await delay(100); save(initialDb(scenario)); },
};
