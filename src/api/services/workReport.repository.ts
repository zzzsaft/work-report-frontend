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
  WorkOrder,
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

export interface WorkReportRepository {
  getCapabilities(): Promise<UserCapabilities>;
  getCurrentAssignment(): Promise<OperationAssignment | null>;
  getAssignments(): Promise<OperationAssignment[]>;
  setCurrentAssignment(id: string): Promise<OperationAssignment>;
  startAssignment(id: string): Promise<OperationAssignment>;
  pauseAssignment(id: string, reason?: string): Promise<OperationAssignment>;
  resumeAssignment(id: string): Promise<OperationAssignment>;
  completeAssignment(id: string, input: CompletionInput): Promise<OperationAssignment>;
  searchClaimableProducts(keyword: string): Promise<ClaimableProduct[]>;
  getClaimableParts(productId: string): Promise<ClaimablePart[]>;
  getClaimableOperations(partId: string): Promise<ClaimableOperation[]>;
  claimOperation(operationId: string): Promise<OperationAssignment>;
  removeClaimedAssignment(assignmentId: string): Promise<void>;
  getStatistics(period: LaborStatistics["period"]): Promise<LaborStatistics>;
  getAttendance(): Promise<DailyAttendance[]>;
  getDashboard(): Promise<DashboardSummary>;
  getOrders(): Promise<WorkOrder[]>;
  getReports(): Promise<ReportRecord[]>;
  getExceptions(): Promise<ProductionException[]>;
  resolveException(id: string): Promise<void>;
  importLeaderOperations(rows: LeaderImportDraft[]): Promise<LeaderImportResult>;
  adminAssignOperation(input: AdminAssignOperationInput): Promise<void>;
  adminRemoveAssignment(assignmentId: string, reason: string): Promise<void>;
  resetDemo?(scenario?: "assigned" | "running" | "paused"): Promise<void>;
}
