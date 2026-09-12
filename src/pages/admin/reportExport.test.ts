import { describe, expect, it, vi } from "vitest";
import { buildTeamOperationStatsCsv, loadReportsForCsvExport } from "./reportExport";
import type { ReportListResponse, TeamOperationStat, WorkReportRepository } from "@/api/services/workReport.repository";

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

describe("buildTeamOperationStatsCsv", () => {
  const makeRow = (overrides: Partial<TeamOperationStat> = {}): TeamOperationStat => ({
    teamName: "磨床组",
    workerId: "w1",
    workerName: "张师傅",
    operationName: "精磨",
    totalPlannedHours: 10,
    totalActualHours: 12.5,
    deviationHours: 2.5,
    monthPlannedHours: 5,
    monthActualHours: 6,
    ...overrides
  });

  it("writes headers, data rows and a summary totals row", () => {
    const csv = buildTeamOperationStatsCsv([
      makeRow(),
      makeRow({ teamName: "装配组", workerName: "李师傅", totalPlannedHours: 8, totalActualHours: 7, deviationHours: -1, monthPlannedHours: 0, monthActualHours: 0 })
    ]);
    const lines = csv.split("\n");

    expect(lines[0]).toBe("班组,生产人员,工序名称,总计划工时,实际报工工时,偏差值,当月计划工时,当月实际工时");
    expect(lines[1]).toBe("磨床组,张师傅,精磨,10.00,12.50,2.50,5.00,6.00");
    expect(lines[2]).toBe("装配组,李师傅,精磨,8.00,7.00,-1.00,0.00,0.00");
    expect(lines[3]).toBe("合计,,,18.00,19.50,1.50,5.00,6.00");
    expect(lines).toHaveLength(4);
  });

  it("escapes fields containing commas or double quotes", () => {
    const csv = buildTeamOperationStatsCsv([
      makeRow({ operationName: '钻孔,攻丝 "M8"' })
    ]);
    const lines = csv.split("\n");
    expect(lines[1]).toBe('磨床组,张师傅,"钻孔,攻丝 ""M8""",10.00,12.50,2.50,5.00,6.00');
  });
});
