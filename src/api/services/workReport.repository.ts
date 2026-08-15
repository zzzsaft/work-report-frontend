import type {
  DashboardSummary,
  ClaimableOperation,
  ClaimablePart,
  ClaimableProduct,
  DailyAttendance,
  LeaderImportDraft,
  LeaderImportResult,
  LaborStatistics,
  OperationAssignment,
  OperationWorkerAssignment,
  ProductionException,
  ReportRecord,
  SystemConfig,
  UserCapabilities,
  UnmappedWorker,
  PermissionGroup,
  WorkerPermission,
  WorkerSummary,
  WorkOrder,
  XftConfig,
  XftHoursRow,
  XftImportResult,
  XftManualHoursDraft,
} from "@/domain/work-report";

export interface CompletionInput {
  photos: Array<{ name: string; url: string }>;
  completedQuantity?: number;
  note?: string;
}

export interface AdminAssignOperationInput {
  operationId: string;
  workerId: string;
  workerName: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ReportFilters {
  keyword?: string;
  orderNo?: string;
  company?: CompanyCode;
  operatorName?: string;
  status?: string;
  operationCode?: string;
  operationName?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}

export type ReportListResponse = PaginatedResult<ReportRecord>;

export type CompanyCode = "jctimes" | "JingyiMT";

export interface StaffStat {
  workerId: string;
  workerName: string;
  totalHours: number;
  completedOperations: number;
  attendanceDays: number;
}

export interface TeamInfo {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  users: Array<{
    id: string;
    name: string;
    employeeNo: string | null;
    teamName: string | null;
  }>;
  operations: Array<{
    id: string;
    operationCode: string;
    operationName: string;
  }>;
}

export interface TeamMember {
  id: string;
  name: string;
  employeeNo: string | null;
  teamName: string | null;
  nameInitials: string | null;
}

export interface TeamOperation {
  id: string;
  teamId: string;
  operationCode: string;
  operationName: string;
  createdAt: string;
}

export interface WorkReportRepository {
  getCapabilities(): Promise<UserCapabilities>;
  getCurrentAssignment(): Promise<OperationAssignment | null>;
  getAssignments(): Promise<OperationAssignment[]>;
  setCurrentAssignment(id: string): Promise<OperationAssignment>;
  startAssignment(id: string): Promise<OperationAssignment>;
  pauseAssignment(id: string, reason?: string): Promise<OperationAssignment>;
  resumeAssignment(id: string): Promise<OperationAssignment>;
  completeAssignment(id: string, input: CompletionInput): Promise<OperationAssignment>;
  searchClaimableProducts(keyword: string, page: number, pageSize: number): Promise<PaginatedResult<ClaimableProduct>>;
  getClaimableParts(productId: string): Promise<ClaimablePart[]>;
  getClaimableOperations(partId: string): Promise<ClaimableOperation[]>;
  claimOperation(operationId: string, input?: { startTime?: string; endTime?: string }): Promise<OperationAssignment>;
  removeClaimedAssignment(assignmentId: string): Promise<void>;
  getStatistics(period: LaborStatistics["period"]): Promise<LaborStatistics>;
  getMyReports(period: LaborStatistics["period"]): Promise<ReportRecord[]>;
  getStaffStats(period: "month" | "lastMonth", operationNames?: string[], company?: CompanyCode): Promise<StaffStat[]>;
  listOperationNames(period: "month" | "lastMonth", company?: CompanyCode): Promise<string[]>;
  getOperationWorkerAssignments(operationCode?: string): Promise<OperationWorkerAssignment[]>;
  createOperationWorkerAssignment(data: { operationCode: string; workerId: string; workerName: string }): Promise<OperationWorkerAssignment>;
  deleteOperationWorkerAssignment(id: string): Promise<{ count: number }>;
  batchDeleteOperationWorkerAssignments(ids: string[]): Promise<{ count: number }>;
  syncOperationWorkerAssignments(): Promise<{ count: number }>;
  getUnmappedWorkers(keyword: string, page: number, pageSize: number): Promise<{ items: UnmappedWorker[]; total: number }>;
  getAttendance(): Promise<DailyAttendance[]>;
  getDashboard(): Promise<DashboardSummary>;
  getOrders(): Promise<WorkOrder[]>;
  searchWorkers(keyword: string, page: number, pageSize: number): Promise<{ items: WorkerSummary[]; hasMore: boolean }>;
  getWorkerPermissions(): Promise<WorkerPermission[]>;
  updateWorkerPermission(workerId: string, permissionGroup: PermissionGroup): Promise<WorkerPermission>;
  getReports(filters?: ReportFilters): Promise<ReportListResponse>;
  updateReportHours(id: string, estimatedHours: number): Promise<ReportRecord>;
  getExceptions(): Promise<ProductionException[]>;
  resolveException(id: string): Promise<void>;
  importLeaderOperations(rows: LeaderImportDraft[]): Promise<LeaderImportResult>;
  getXftConfig(): Promise<XftConfig>;
  saveXftConfig(config: XftConfig): Promise<XftConfig>;
  previewXftHours(salaryPeriod?: string): Promise<XftHoursRow[]>;
  importXftHours(salaryPeriod?: string): Promise<XftImportResult>;
  importManualXftHours(rows: XftManualHoursDraft[], salaryPeriod?: string): Promise<XftImportResult>;
  adminAssignOperation(input: AdminAssignOperationInput): Promise<void>;
  adminRemoveAssignment(assignmentId: string, reason: string): Promise<void>;
  resetDemo?(scenario?: "assigned" | "running" | "paused"): Promise<void>;

  // Team management
  listTeams(): Promise<TeamInfo[]>;
  createTeam(name: string, description?: string): Promise<TeamInfo>;
  updateTeam(id: string, name: string, description?: string): Promise<TeamInfo>;
  deleteTeam(id: string): Promise<{ count: number }>;
  getTeamMembers(teamId: string): Promise<TeamMember[]>;
  addTeamMember(teamId: string, userId: string): Promise<void>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;
  setWorkerTeam(userId: string, teamId: string | null): Promise<void>;

  // Team operation assignments
  listTeamOperations(teamId: string): Promise<TeamOperation[]>;
  createTeamOperation(teamId: string, operationCode: string, operationName?: string): Promise<TeamOperation>;
  deleteTeamOperation(id: string): Promise<{ count: number }>;
  batchDeleteTeamOperations(ids: string[]): Promise<{ count: number }>;
  syncTeamOperations(): Promise<{ count: number }>;

  // System config
  getSystemConfig(): Promise<SystemConfig>;
  saveSystemConfig(config: { teamOperationPermissionEnabled?: boolean }): Promise<SystemConfig>;
}
