import { describe, expect, it, vi } from "vitest";
import { loadReportsForCsvExport } from "./reportExport";
import type { ReportListResponse, WorkReportRepository } from "@/api/services/workReport.repository";

describe("loadReportsForCsvExport", () => {
  it("loads all rows matching the current filters instead of the visible page", async () => {
    const getReports = vi.fn<WorkReportRepository["getReports"]>(async (): Promise<ReportListResponse> => ({
      items: [{ id: "exported-row" }] as ReportListResponse["items"],
      page: 1,
      pageSize: 87,
      total: 87,
      hasMore: false,
    }));
    const repository = { getReports } as Pick<WorkReportRepository, "getReports">;

    const rows = await loadReportsForCsvExport(repository, { operatorName: "张师傅" }, 87);

    expect(rows).toEqual([{ id: "exported-row" }]);
    expect(getReports).toHaveBeenCalledWith({ operatorName: "张师傅", page: 1, pageSize: 87 });
  });

  it("keeps paging until every filtered report is loaded", async () => {
    const getReports = vi.fn<WorkReportRepository["getReports"]>(async ({ page = 1 } = {}): Promise<ReportListResponse> => ({
      items: [{ id: `row-${page}` }] as ReportListResponse["items"],
      page,
      pageSize: 100,
      total: 230,
      hasMore: page < 3,
    }));
    const repository = { getReports } as Pick<WorkReportRepository, "getReports">;

    const rows = await loadReportsForCsvExport(repository, { status: "completed" }, 230);

    expect(rows.map((row) => row.id)).toEqual(["row-1", "row-2", "row-3"]);
    expect(getReports).toHaveBeenNthCalledWith(1, { status: "completed", page: 1, pageSize: 100 });
    expect(getReports).toHaveBeenNthCalledWith(2, { status: "completed", page: 2, pageSize: 100 });
    expect(getReports).toHaveBeenNthCalledWith(3, { status: "completed", page: 3, pageSize: 100 });
  });
});
