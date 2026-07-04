import type { OperationAssignment } from "@/domain/work-report";

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

export type ClaimOperationFilter = "all" | "available" | "claimed";
export type ClaimPanelView = "search" | "recent";
export type ClaimRecentDateFilter = "today" | "all";
export type OperationListRange = "today" | "7" | "30" | "all";

export const claimOperationFilterOptions: Array<[ClaimOperationFilter, string]> = [["all", "全部"], ["available", "可领取"], ["claimed", "已满"]];
export const claimRecentStatusOptions: Array<[Exclude<ClaimOperationFilter, "claimed">, string]> = [["available", "可领取"], ["all", "全部"]];
export const operationListRangeOptions: Array<[OperationListRange, string]> = [["today", "今天"], ["7", "最近7天"], ["30", "最近一个月"], ["all", "全部"]];
export const claimSearchPageSize = 4;
export const operationListPageSize = 6;
export const requireAuth = import.meta.env.VITE_REQUIRE_AUTH !== "false";

export const getTimeValue = (date?: string) => date ? new Date(date).getTime() : 0;
export const getAssignmentSortTime = (item: OperationAssignment) => getTimeValue(item.claimedAt) || getTimeValue(item.plannedStart);

export const formatProductPartCode = (productCode?: string, partCode?: string) => {
  const codes = [productCode, partCode].map((code) => code?.trim()).filter(Boolean);
  return Array.from(new Set(codes)).join(" · ");
};

export const isSameLocalDay = (left?: string | number | Date, right: string | number | Date = new Date()) => {
  if (!left) return false;
  const a = new Date(left);
  const b = new Date(right);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

export const isAssignmentInRange = (item: OperationAssignment, range: OperationListRange) => {
  const time = getAssignmentSortTime(item);
  if (!time) return range === "all";
  if (range === "today") return isSameLocalDay(time);
  if (range === "all") return true;
  return time >= Date.now() - Number(range) * 24 * 3600_000;
};

export const splitDateTimeLocal = (value: string) => {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
};

export const combineDateTimeLocal = (date: string, time: string) => date && time ? `${date}T${time}` : "";
