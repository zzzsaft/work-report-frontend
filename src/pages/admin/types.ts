export type Period = "month" | "lastMonth";

export const companyOptions = [
  { value: "", label: "全部公司" },
  { value: "jctimes", label: "精诚" },
  { value: "JingyiMT", label: "精艺" },
] as const;

export type CompanyFilter = (typeof companyOptions)[number]["value"];

export type ConfirmDelete =
  | null
  | { type: "single"; id: string; label: string }
  | { type: "batch"; count: number };

export type { OperationWorkerAssignment, UnmappedWorker, WorkerSummary } from "@/domain/work-report";
export type { StaffStat } from "@/api/services/workReport.repository";
