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
  partNo?: string;
  partCode: string;
  partName?: string;
  operationNo?: string;
  operationCode: string;
  operationName: string;
  operationNote: string;
  plannedQuantity: number;
  plannedStart: string;
  plannedEnd: string;
  collaborators: string[];
  source: "assigned" | "self_claimed" | "leader_imported";
  canWorkerRemove: boolean;
  estimatedHours?: number;
  claimedAt?: string;
  assignedBy?: { id: string; name: string; role: "leader" | "admin" | "system" };
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
  canImportOperations: boolean;
  canViewTeamOperations: boolean;
  canForceRemoveAssignments: boolean;
  canViewAllTeams: boolean;
}

export type AdminRouteKey =
  | "dashboard"
  | "orders"
  | "import"
  | "assignments"
  | "reports"
  | "people"
  | "permissions"
  | "accounts"
  | "wecom"
  | "exceptions"
  | "settings";

export type PermissionGroup = "worker" | "leader" | "admin";

export interface WorkerSummary {
  id: string;
  employeeNo: string;
  name: string;
  nameInitials: string;
  teamName: string;
  activeAssignmentCount: number;
}

export interface WorkerPermission extends WorkerSummary {
  permissionGroup: PermissionGroup;
}

export interface ClaimableProduct {
  id: string;
  orderNo: string;
  productCode: string;
  productName: string;
  remainingQuantity: number;
}

export interface ClaimablePart {
  id: string;
  productId: string;
  partNo: string;
  partCode: string;
  partName: string;
  operationCount: number;
  remainingQuantity: number;
}

export interface ClaimableOperation {
  id: string;
  productId: string;
  partId: string;
  orderNo: string;
  productCode: string;
  productName: string;
  partNo?: string;
  partCode: string;
  partName: string;
  operationNo: string;
  operationCode: string;
  operationName: string;
  operationNote: string;
  plannedQuantity: number;
  plannedStart?: string;
  estimatedHours: number;
  claimedWorkers: number;
  maxClaimWorkers?: number;
  status: "available" | "claimed" | "closed";
}

export interface LeaderImportDraft {
  productCode: string;
  partCode: string;
  operationCode: string;
  operationName: string;
  quantity: number;
  estimatedHours: number;
}

export interface LeaderImportResult {
  accepted: number;
  rejected: number;
  errors: Array<{ row: number; message: string }>;
  items?: unknown[];
}

export interface XftConfig {
  host: string;
  appid: string;
  appSecret?: string;
  enterpriseId: string;
  defaultUserId: string;
  defaultPlatformUserId: string;
  dataCollectionName: string;
  importType: string;
  salaryPeriod: string;
  workHoursFieldKey: string;
  isCheckEmpty: boolean;
  enabled: boolean;
  hasAppSecret?: boolean;
}

export interface XftHoursRow {
  lineId: number;
  staffName: string;
  staffNumber: string;
  hours: number;
  identityNumber: string;
  staffId: string;
}

export interface XftManualHoursDraft {
  staffName: string;
  staffNumber: string;
  hours: number;
  identityNumber?: string;
  staffId?: string;
}

export interface XftImportResult {
  accepted: number;
  rejected: number;
  items: Array<{ lineId: number; staffName: string; staffNumber: string; hours: number }>;
  errors: Array<{ row: number; staffName?: string; staffNumber?: string; message: string; errorCode?: string }>;
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
  partCode: string;
  partName: string;
  operationCode: string;
  operationName: string;
  operatorName: string;
  status: OperationStatus;
  claimedAt: string | undefined;
  estimatedHours: number;
  durationHours: number;
  startedAt: string | undefined;
  completedAt: string | undefined;
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

export function getSwitchableAssignmentsForDate(
  assignments: OperationAssignment[],
  date: Date | string | number,
  excludeId?: string,
) {
  return assignments.filter(
    (assignment) =>
      assignment.id !== excludeId &&
      assignment.status === "assigned" &&
      isAssignmentOnDate(assignment, date),
  );
}

export function getCurrentSwitchCandidatesForDate(
  assignments: OperationAssignment[],
  date: Date | string | number,
  excludeId?: string,
) {
  return assignments.filter(
    (assignment) =>
      assignment.id !== excludeId &&
      (assignment.status === "assigned" || assignment.status === "paused") &&
      isAssignmentOnDate(assignment, date),
  );
}

export function canSwitchFromAssignment(assignment?: OperationAssignment | null) {
  return !assignment || assignment.status === "assigned" || assignment.status === "paused";
}

export function canWorkerRemoveAssignment(assignment: OperationAssignment) {
  return assignment.source === "self_claimed" && assignment.status === "assigned" && assignment.canWorkerRemove;
}

export function canManagePermissions(capabilities?: UserCapabilities | null) {
  return !!(
    capabilities?.canAssignWorkers &&
    capabilities.canForceRemoveAssignments &&
    capabilities.canViewAllTeams
  );
}

export function canAccessAdminRoute(capabilities: UserCapabilities | null | undefined, routeKey: AdminRouteKey) {
  if (!capabilities?.canViewAdmin) return false;
  const routeAccess: Record<AdminRouteKey, boolean> = {
    dashboard: capabilities.canViewAdmin,
    orders: capabilities.canViewAdmin,
    import: capabilities.canImportOperations,
    assignments: capabilities.canAssignWorkers || capabilities.canForceRemoveAssignments,
    reports: capabilities.canViewAdmin,
    people: capabilities.canViewAdmin,
    permissions: canManagePermissions(capabilities),
    accounts: canManagePermissions(capabilities),
    wecom: capabilities.canViewAdmin,
    exceptions: capabilities.canReviewExceptions,
    settings: capabilities.canViewAdmin,
  };
  return routeAccess[routeKey];
}

const parseNumericCode = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
};

export function sortByNumericCode<T>(items: T[], getCode: (item: T) => string | undefined | null) {
  return [...items].sort((left, right) => {
    const leftCode = parseNumericCode(getCode(left));
    const rightCode = parseNumericCode(getCode(right));
    if (leftCode === null && rightCode === null) return 0;
    if (leftCode === null) return 1;
    if (rightCode === null) return -1;
    return leftCode - rightCode;
  });
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
