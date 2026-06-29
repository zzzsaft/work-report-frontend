import { afterEach, describe, expect, it, vi } from "vitest";
import { workReportClient } from "@/api/http/workReportClient";
import type { WorkOrder } from "@/domain/work-report";
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
});
