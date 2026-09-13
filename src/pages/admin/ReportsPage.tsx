import { Badge, Button, DateInput, NumericInput, Pagination, SelectInput, TextInput } from "@jc-times/business-ui";
import { ReportTable } from "@/components/ui/ReportTable";
import { useCallback, useMemo, useState } from "react";
import { Check, Download, Edit3, Search, X } from "lucide-react";
import { workReportRepository } from "@/api/services/workReport.service";
import { allocationMethodLabel, formatAllocationBasisHours, formatAllocationRatio, formatHours, getAllocatedHours, getOriginalEstimatedHours, hourAllocationFallbackText, hourAllocationTooltip, type ReportRecord } from "@/domain/work-report";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { AdminError, AdminHeader, LoadingTable } from "./adminShared";
import { cx } from "./adminUtils";
import { loadReportsForCsvExport, escapeCsvField } from "./reportExport";
import { companyOptions, type CompanyFilter } from "./types";
import styles from "./AdminPages.module.less";

export default function ReportsPage() {
  const [filters, setFilters] = useState<{
    keyword: string;
    orderNo: string;
    company: CompanyFilter;
    operatorName: string;
    status: string;
    operationCode: string;
    operationName: string;
    startTime: string;
    endTime: string;
  }>({ keyword: "", orderNo: "", company: "", operatorName: "", status: "", operationCode: "", operationName: "", startTime: "", endTime: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState("");
  const [editingHours, setEditingHours] = useState("");
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const reportFilters = useMemo(() => ({ ...appliedFilters, company: appliedFilters.company || undefined }), [appliedFilters]);
  const load = useCallback(async () => {
    const data = await workReportRepository.getReports({ ...reportFilters, page, pageSize });
    setTotal(data.total);
    setPage(data.page);
    setPageSize(Math.min(100, Math.max(1, data.pageSize)));
    return data.items;
  }, [reportFilters, page, pageSize]);
  const { data: reports = [], loading, error, reload } = useAsyncResource<ReportRecord[]>(load);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    setPage(1);
    setAppliedFilters(filters);
  };

  const handleResetFilters = () => {
    const empty: typeof filters = { keyword: "", orderNo: "", company: "", operatorName: "", status: "", operationCode: "", operationName: "", startTime: "", endTime: "" };
    setPage(1);
    setFilters(empty);
    setAppliedFilters(empty);
  };

  const handlePageSizeChange = (value: string) => {
    setPage(1);
    setPageSize(Math.min(100, Number(value) || 50));
  };

  const handleEditHours = (record: ReportRecord) => {
    setEditingId(record.id);
    setEditingHours(String(getOriginalEstimatedHours(record)));
  };

  const handleSaveHours = async (record: ReportRecord) => {
    const hours = parseFloat(editingHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      setMessage("工时必须大于0");
      return;
    }
    try {
      await workReportRepository.updateReportHours(record.id, hours);
      setMessage("修改成功");
      await reload();
    } catch (err) {
      setMessage("修改失败");
      console.error("Failed to update hours:", err);
    } finally {
      setEditingId("");
      setEditingHours("");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleCancelEdit = () => {
    setEditingId("");
    setEditingHours("");
  };

  const exportToExcel = async () => {
    setExporting(true);
    setMessage("");
    try {
      const exportReports = await loadReportsForCsvExport(workReportRepository, reportFilters, total);
      const headers = ["工单", "产品名称", "产品编号", "部件序号", "部件号", "部件名称", "工序号", "工序名称", "工艺内容", "数量", "分摊工时", "原工时", "领取人员", "来源", "开工时间", "完工时间", "领取时间", "实际工时"];
      const rows = exportReports.map((item) => [
        escapeCsvField(item.orderNo),
        escapeCsvField(item.productName),
        "",
        escapeCsvField(item.partNo),
        escapeCsvField(item.partCode),
        escapeCsvField(item.partName),
        escapeCsvField(item.operationCode),
        escapeCsvField(item.operationName),
        escapeCsvField(item.operationNote || ""),
        escapeCsvField(item.plannedQuantity),
        escapeCsvField(formatHours(getAllocatedHours(item))),
        escapeCsvField(formatHours(getOriginalEstimatedHours(item))),
        escapeCsvField(item.operatorName),
        "自主领取",
        escapeCsvField(item.actualStartAt ? new Date(item.actualStartAt).toLocaleString("zh-CN") : ""),
        escapeCsvField(item.actualEndAt ? new Date(item.actualEndAt).toLocaleString("zh-CN") : ""),
        escapeCsvField(item.claimedAt ? new Date(item.claimedAt).toLocaleString("zh-CN") : ""),
        escapeCsvField(item.durationHours)
      ]);

      const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `报工记录_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setMessage(`导出成功，共 ${exportReports.length} 条`);
    } catch (err) {
      setMessage("导出失败");
      console.error("Failed to export reports:", err);
    } finally {
      setExporting(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  if (loading) return <><AdminHeader title="报工记录" description="按工单、人员和状态追踪每一次报工" action={<Button variant="ghost" className={cx(styles["export-csv-btn"])} disabled><Download />导出CSV</Button>} /><section className={cx(styles["admin-panel"])}><LoadingTable /></section></>;
  if (error) return <><AdminHeader title="报工记录" description="按工单、人员和状态追踪每一次报工" action={<Button variant="ghost" className={cx(styles["export-csv-btn"])} disabled><Download />导出CSV</Button>} /><section className={cx(styles["admin-panel"])}><AdminError message={error} retry={() => void reload()} /></section></>;

  return (<>
    <AdminHeader title="报工记录" description="按工单、人员和状态追踪每一次报工" action={<Button variant="ghost" className={cx(styles["export-csv-btn"])} onClick={() => void exportToExcel()} disabled={exporting}><Download />{exporting ? "导出中..." : "导出CSV"}</Button>} />
    <section className={cx(styles["admin-panel"])}>
      {message && <div className={cx(styles["reports-message"])}>{message}</div>}
      <div className={cx(styles["reports-filter"])}>
        <div className={cx(styles["filter-search"])}>
          <Search />
          <TextInput aria-label="搜索工单、产品、工序或人员" type="text" value={filters.keyword} onChange={(e) => handleFilterChange("keyword", e.target.value)} placeholder="搜索工单、产品、工序或人员" />
        </div>
        <div className={cx(styles["filter-input"])}>

          <TextInput label={<>工单编号</>} type="text" value={filters.orderNo} onChange={(e) => handleFilterChange("orderNo", e.target.value)} placeholder="工单编号" />
        </div>
        <div className={cx(styles["filter-select"])}>

          <SelectInput label={<>公司</>} value={filters.company} onChange={(e) => handleFilterChange("company", e.target.value as CompanyFilter)}>
            {companyOptions.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
          </SelectInput>
        </div>
        <div className={cx(styles["filter-input"])}>

          <TextInput label={<>人员姓名</>} type="text" value={filters.operatorName} onChange={(e) => handleFilterChange("operatorName", e.target.value)} placeholder="人员姓名" />
        </div>
        <div className={cx(styles["filter-select"])}>

          <SelectInput label={<>状态</>} value={filters.status} onChange={(e) => handleFilterChange("status", e.target.value)}>
            <option value="">全部</option>
            <option value="claimed">待开始</option>
            <option value="running">进行中</option>
            <option value="paused">已暂停</option>
            <option value="completed">已完成</option>
          </SelectInput>
        </div>
        <div className={cx(styles["filter-input"])}>

          <TextInput label={<>工序号</>} type="text" value={filters.operationCode} onChange={(e) => handleFilterChange("operationCode", e.target.value)} placeholder="工序号" />
        </div>
        <div className={cx(styles["filter-input"])}>

          <TextInput label={<>工序名称</>} type="text" value={filters.operationName} onChange={(e) => handleFilterChange("operationName", e.target.value)} placeholder="工序名称" />
        </div>
        <div className={cx(styles["filter-date"])}>
          <label>开始日期<DateInput aria-label="开始日期" value={filters.startTime} onValueChange={(value) => handleFilterChange("startTime", value)} /></label>
          <label>结束日期<DateInput aria-label="结束日期" value={filters.endTime} onValueChange={(value) => handleFilterChange("endTime", value)} /></label>
        </div>
        <div className={cx(styles["filter-actions"])}>
          <Button variant="primary" className={cx(styles["filter-search-btn"])} onClick={handleSearch}><Search />搜索</Button>
          <Button variant="ghost" className={cx(styles["filter-reset-btn"])} onClick={handleResetFilters}>重置</Button>
        </div>
      </div>
      <div className={cx(styles["table-wrap"])}>
        <ReportTable className={cx(styles["reports-table"])} columns={[{ title: "工单", width: 100 },
{ title: "产品", width: 110 },
{ title: "部件序号", width: 60 },
{ title: "部件", width: 110 },
{ title: "工序", width: 120 },
{ title: "工艺内容", width: 140 },
{ title: "数量", width: 70 },
{ title: "分摊工时", width: 100 },
{ title: "原工时", width: 80 },
{ title: "领取人员", width: 80 },
{ title: "来源", width: 70 },
{ title: "开工时间", width: 130 },
{ title: "完工时间", width: 130 },
{ title: "领取时间", width: 130 },
{ title: "实际工时", width: 80 },
{ title: "操作", width: 80 }]} rows={reports.map((item) => {
              const allocation = item.hourAllocation;
              const allocationTitle = allocation ? `工时分摊说明\n${hourAllocationTooltip}\n分摊方式：${allocationMethodLabel(allocation.allocationMethod)}\n分摊比例：${formatAllocationRatio(allocation.allocationRatio)}\n实际时长：${formatAllocationBasisHours(allocation.allocationBasisSeconds)}\n参与人数：${allocation.allocationParticipantCount ?? "-"}${allocation.allocationApplied === false ? `\n${hourAllocationFallbackText}` : ""}` : undefined;
              return (({ id: String(item.id), cells: [<><strong>{item.orderNo}</strong></>,
<><div className={cx(styles["cell-with-sub"])}><strong>{item.productName}</strong><span>{item.partCode}</span></div></>,
<><strong>{item.partNo}</strong></>,
<><div className={cx(styles["cell-with-sub"])}><strong>{item.partCode}</strong><span>{item.partName}</span></div></>,
<><div className={cx(styles["cell-with-sub"])}><strong>{item.operationCode}</strong><span>{item.operationName}</span></div></>,
<div className={cx(styles["operation-note-cell"])} title={(item.operationNote || "").replace(/\n/g, " ")}>{(item.operationNote || "").replace(/\n/g, " ") || "-"}</div>,
<strong>{item.plannedQuantity}</strong>,
<><div className={cx(styles["cell-with-sub"], styles["hours-allocation-cell"])}><strong>{formatHours(getAllocatedHours(item))} 小时</strong>{allocation?.allocationTemporary && <Badge className={cx(styles["allocation-tag"])} title={allocationTitle}>临时分摊</Badge>}{allocation?.allocationApplied === false && <em title={hourAllocationFallbackText}>{hourAllocationFallbackText}</em>}</div></>,
<><div className={cx(styles["cell-with-sub"])}><strong>{formatHours(getOriginalEstimatedHours(item))} 小时</strong><span>原标准工时</span></div></>,
<div className={cx(styles["operator-cell"])}>{item.operatorName}</div>,
<>自主领取</>,
<>{item.actualStartAt ? new Date(item.actualStartAt).toLocaleString("zh-CN") : "-"}</>,
<>{item.actualEndAt ? new Date(item.actualEndAt).toLocaleString("zh-CN") : "-"}</>,
<>{item.claimedAt ? new Date(item.claimedAt).toLocaleString("zh-CN") : "-"}</>,
<>{editingId === item.id ? (<div className={cx(styles["edit-cell"])}>
                  <NumericInput  min="0" step="0.1" value={String(editingHours)} useGrouping={false} onValueCommit={(value) => setEditingHours(value)} onDraftChange={(value) => setEditingHours(value)} />
                </div>) : (<span className={cx(styles["hours-value"])}>{item.durationHours.toFixed(2)} 小时</span>)}</>,
<>{editingId === item.id ? (<div className={cx(styles["edit-actions"])}>
                  <Button aria-label={"确认"} variant="primary" className={cx(styles["table-action"], styles["confirm-btn"])} onClick={() => handleSaveHours(item)}><Check /></Button>
                  <Button aria-label={"关闭"} variant="ghost" className={cx(styles["table-action"], styles["cancel-btn"])} onClick={handleCancelEdit}><X /></Button>
                </div>) : (<Button variant="ghost" className={cx(styles["edit-btn"])} onClick={() => handleEditHours(item)}><Edit3 />修改</Button>)}</> ] }));
            })} emptyTitle={"没有匹配的报工记录。"} />
      </div>
      <Pagination totalItems={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => handlePageSizeChange(String(size))} pageSizeOptions={[20, 50, 100]} />
    </section>
  </>);
}
