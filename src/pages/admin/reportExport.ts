import type { ReportFilters, TeamOperationStat, WorkReportRepository } from "@/api/services/workReport.repository";
import type { ReportRecord } from "@/domain/work-report";

const maxReportExportPageSize = 100;

export function escapeCsvField(value: string | number): string {
  const str = String(value).replace(/\r?\n/g, " ").replace(/"/g, '""');
  if (str.includes(",") || str.includes('"') || str.includes(" ")) {
    return `"${str}"`;
  }
  return str;
}

export async function loadReportsForCsvExport(
  repository: Pick<WorkReportRepository, "getReports">,
  filters: ReportFilters,
  total: number,
) {
  const pageSize = Math.max(1, Math.min(total || maxReportExportPageSize, maxReportExportPageSize));
  const rows: ReportRecord[] = [];

  for (let page = 1; ; page += 1) {
    const result = await repository.getReports({ ...filters, page, pageSize });
    rows.push(...result.items);
    if (!result.hasMore || rows.length >= result.total) return rows;
  }
}

export function buildTeamOperationStatsCsv(rows: TeamOperationStat[]): string {
  const headers = [
    "班组",
    "生产人员",
    "工序名称",
    "总计划工时",
    "实际报工工时",
    "偏差值",
    "当月计划工时",
    "当月实际工时"
  ];

  const dataRows = rows.map((row) => [
    escapeCsvField(row.teamName),
    escapeCsvField(row.workerName),
    escapeCsvField(row.operationName),
    row.totalPlannedHours.toFixed(2),
    row.totalActualHours.toFixed(2),
    row.deviationHours.toFixed(2),
    row.monthPlannedHours.toFixed(2),
    row.monthActualHours.toFixed(2)
  ]);

  const totals = rows.reduce(
    (acc, row) => {
      acc.totalPlanned += row.totalPlannedHours;
      acc.totalActual += row.totalActualHours;
      acc.monthPlanned += row.monthPlannedHours;
      acc.monthActual += row.monthActualHours;
      return acc;
    },
    { totalPlanned: 0, totalActual: 0, monthPlanned: 0, monthActual: 0 }
  );
  const summaryRow = [
    escapeCsvField("合计"),
    "",
    "",
    totals.totalPlanned.toFixed(2),
    totals.totalActual.toFixed(2),
    (totals.totalActual - totals.totalPlanned).toFixed(2),
    totals.monthPlanned.toFixed(2),
    totals.monthActual.toFixed(2)
  ];

  return [headers.join(","), ...dataRows.map((row) => row.join(",")), summaryRow.join(",")].join("\n");
}
