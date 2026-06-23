export type OperationStatus =
  | "assigned"
  | "running"
  | "paused"
  | "pending_submit"
  | "completed"
  | "cancelled"
  | "exception";

export interface WorkOrder {
  id: string;
  orderNo: string;
  productCode: string;
  productName: string;
  plannedQuantity: number;
  completedQuantity: number;
  dueDate: string;
  progress: number;
  status: "pending" | "in_progress" | "completed" | "exception";
}

export interface PauseRecord {
  id: string;
  startedAt: string;
  endedAt?: string;
  reason?: string;
}

export interface EvidencePhoto {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
}

export interface WorkSession {
  id: string;
  assignmentId: string;
  operatorId: string;
  operatorName: string;
  status: OperationStatus;
  startedAt?: string;
  completedAt?: string;
  accumulatedSeconds: number;
  currentRunStartedAt?: string;
  pauses: PauseRecord[];
  photos: EvidencePhoto[];
  completedQuantity?: number;
  note?: string;
}

export interface OperationAssignment {
  id: string;
  workOrderId: string;
  orderNo: string;
  productCode: string;
  productName: string;
  operationCode: string;
  operationName: string;
  operationNote: string;
  plannedQuantity: number;
  plannedStart: string;
  plannedEnd: string;
  collaborators: string[];
  status: OperationStatus;
  session?: WorkSession;
}

export interface DailyAttendance {
  date: string;
  shift: string;
  regularHours: number;
  overtimeHours: number;
  attendanceStatus: "normal" | "late" | "leave";
}

export interface LaborStatistics {
  period: "day" | "week" | "month";
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  completedOperations: number;
  attendanceDays: number;
  trend: Array<{ label: string; hours: number; overtime: number }>;
}

export interface UserCapabilities {
  roles: Array<"worker" | "leader" | "admin">;
  canViewAdmin: boolean;
  canAssignWorkers: boolean;
  canReviewExceptions: boolean;
}

export interface DashboardSummary {
  activeOrders: number;
  runningWorkers: number;
  todayHours: number;
  exceptionCount: number;
}

export interface ReportRecord {
  id: string;
  orderNo: string;
  productName: string;
  operationName: string;
  operatorName: string;
  status: OperationStatus;
  startedAt: string;
  durationHours: number;
  photos: EvidencePhoto[];
}

export interface ProductionException {
  id: string;
  type: "overtime" | "duplicate" | "missing";
  title: string;
  detail: string;
  orderNo: string;
  createdAt: string;
  status: "open" | "resolved";
}

export const statusLabel: Record<OperationStatus, string> = {
  assigned: "待开始",
  running: "进行中",
  paused: "已暂停",
  pending_submit: "待提交",
  completed: "已完成",
  cancelled: "已取消",
  exception: "异常",
};

const activeOperationStatuses = new Set<OperationStatus>([
  "assigned",
  "running",
  "paused",
  "pending_submit",
]);

export function getLocalDateKey(date: Date | string | number) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isAssignmentOnDate(
  assignment: OperationAssignment,
  date: Date | string | number,
) {
  return getLocalDateKey(assignment.plannedStart) === getLocalDateKey(date);
}

export function isActiveOperationStatus(status: OperationStatus) {
  return activeOperationStatuses.has(status);
}

export function getPendingAssignmentsForDate(
  assignments: OperationAssignment[],
  date: Date | string | number,
  excludeId?: string,
) {
  return assignments.filter(
    (assignment) =>
      assignment.id !== excludeId &&
      isActiveOperationStatus(assignment.status) &&
      isAssignmentOnDate(assignment, date),
  );
}

export function getSessionElapsedSeconds(session?: WorkSession, now = Date.now()) {
  if (!session) return 0;
  const currentRun =
    session.status === "running" && session.currentRunStartedAt
      ? Math.max(0, Math.floor((now - new Date(session.currentRunStartedAt).getTime()) / 1000))
      : 0;
  return session.accumulatedSeconds + currentRun;
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
