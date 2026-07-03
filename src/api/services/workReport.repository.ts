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
  ProductionException,
  ReportRecord,
  UserCapabilities,
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
}
