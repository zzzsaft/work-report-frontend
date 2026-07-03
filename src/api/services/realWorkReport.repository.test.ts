import { afterEach, describe, expect, it, vi } from "vitest";
import { workReportClient } from "@/api/http/workReportClient";
import type { ReportRecord, WorkOrder } from "@/domain/work-report";
import { realWorkReportRepository } from "./realWorkReport.repository";

const order = (id: string): WorkOrder => ({
  id,
  orderNo: `WO-${id}`,
  productCode: `P-${id}`,
  productName: "产品",
  plannedQuantity: 10,
  completedQuantity: 0,
  dueDate: "2026-06-30",
  progress: 0,
  status: "pending",
});

const report = (id: string): ReportRecord => ({
  id,
  orderNo: `WO-${id}`,
  productName: "产品",
  partCode: "P-1",
  partName: "部件",
  operationCode: "OP-1",
  operationName: "工序",
  operatorName: "张师傅",
  status: "completed",
  claimedAt: "2026-07-01T08:00:00.000Z",
  estimatedHours: 1,
  durationHours: 1,
  startedAt: "2026-07-01T08:00:00.000Z",
  completedAt: "2026-07-01T09:00:00.000Z",
  actualStartAt: "2026-07-01T08:00:00.000Z",
  actualEndAt: "2026-07-01T09:00:00.000Z",
  photos: [],
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("real work report repository", () => {
  it("keeps compatibility with mock array admin order responses", async () => {
    vi.spyOn(workReportClient, "get").mockResolvedValue({ data: [order("1")] });
    await expect(realWorkReportRepository.getOrders()).resolves.toEqual([order("1")]);
  });

  it("reads items from documented admin order responses", async () => {
    vi.spyOn(workReportClient, "get").mockResolvedValue({ data: { items: [order("2")], hasMore: false } });
    await expect(realWorkReportRepository.getOrders()).resolves.toEqual([order("2")]);
  });

  it("requests claimable products with pagination params", async () => {
    const get = vi.spyOn(workReportClient, "get").mockResolvedValue({ data: { items: [], page: 2, pageSize: 4, total: 0, hasMore: false } });
    await expect(realWorkReportRepository.searchClaimableProducts("CP-1", 2, 4)).resolves.toMatchObject({ items: [], page: 2, pageSize: 4 });
    expect(get).toHaveBeenCalledWith("/claim/products", { params: { keyword: "CP-1", page: 2, pageSize: 4 } });
  });

  it("requests admin reports with filters and reads paginated responses", async () => {
    const get = vi.spyOn(workReportClient, "get").mockResolvedValue({ data: { items: [report("1")], page: 2, pageSize: 50, total: 80, hasMore: false } });
    await expect(realWorkReportRepository.getReports({ keyword: "OP", page: 2, pageSize: 50 })).resolves.toMatchObject({ items: [report("1")], page: 2, pageSize: 50, total: 80, hasMore: false });
    expect(get).toHaveBeenCalledWith("/admin/reports", { params: { keyword: "OP", page: 2, pageSize: 50 } });
  });
});
