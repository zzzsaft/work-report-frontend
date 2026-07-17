import type { ReportFilters, WorkReportRepository } from "@/api/services/workReport.repository";
import type { ReportRecord } from "@/domain/work-report";

const maxReportExportPageSize = 100;

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
