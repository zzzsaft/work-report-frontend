import type {
  DashboardSummary,
  DailyAttendance,
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

export interface WorkReportRepository {
  getCapabilities(): Promise<UserCapabilities>;
  getCurrentAssignment(): Promise<OperationAssignment | null>;
  getAssignments(): Promise<OperationAssignment[]>;
  startAssignment(id: string): Promise<OperationAssignment>;
  pauseAssignment(id: string, reason?: string): Promise<OperationAssignment>;
  resumeAssignment(id: string): Promise<OperationAssignment>;
  completeAssignment(id: string, input: CompletionInput): Promise<OperationAssignment>;
  getStatistics(period: LaborStatistics["period"]): Promise<LaborStatistics>;
  getAttendance(): Promise<DailyAttendance[]>;
  getDashboard(): Promise<DashboardSummary>;
  getOrders(): Promise<WorkOrder[]>;
  getReports(): Promise<ReportRecord[]>;
  getExceptions(): Promise<ProductionException[]>;
  resolveException(id: string): Promise<void>;
  resetDemo?(scenario?: "assigned" | "running" | "paused"): Promise<void>;
}
