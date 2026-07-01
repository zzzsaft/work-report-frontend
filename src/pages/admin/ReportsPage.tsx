import { useCallback, useState } from "react";
import { Check, Download, Edit3, Search, X } from "lucide-react";
import { workReportRepository } from "@/api/services/workReport.service";
import { statusLabel, type ReportRecord } from "@/domain/work-report";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { AdminError, AdminHeader, LoadingTable } from "./adminShared";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";

export default function ReportsPage() {
  const [filters, setFilters] = useState<{
    keyword: string;
    orderNo: string;
    operatorName: string;
    status: string;
    operationCode: string;
    operationName: string;
    startTime: string;
    endTime: string;
  }>({ keyword: "", orderNo: "", operatorName: "", status: "", operationCode: "", operationName: "", startTime: "", endTime: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editingHours, setEditingHours] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const data = await workReportRepository.getReports({ ...filters, page, pageSize });
    setTotal(data.total);
    setPage(data.page);
    setPageSize(Math.min(100, Math.max(1, data.pageSize)));
    setHasMore(data.hasMore);
    return data.items;
  }, [filters, page, pageSize]);
  const { data: reports = [], loading, error, reload } = useAsyncResource<ReportRecord[]>(load);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setPage(1);
    setFilters({ keyword: "", orderNo: "", operatorName: "", status: "", operationCode: "", operationName: "", startTime: "", endTime: "" });
  };

  const handlePageSizeChange = (value: string) => {
    setPage(1);
    setPageSize(Math.min(100, Number(value) || 50));
  };

  const handleEditHours = (record: ReportRecord) => {
    setEditingId(record.id);
    setEditingHours(String(record.estimatedHours));
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

  const exportToExcel = () => {
    const headers = ["工单", "产品名称", "产品编号", "部件号", "部件名称", "工序号", "工序名称", "数量", "预估工时", "领取人员", "来源", "状态", "领取时间", "实际工时"];
    const rows = reports.map((item) => [
      item.orderNo,
      item.productName,
      "",
      item.partCode,
      item.partName,
      item.operationCode,
      item.operationName,
      1,
      item.estimatedHours,
      item.operatorName,
      "自主领取",
      statusLabel[item.status as keyof typeof statusLabel] || item.status,
      item.claimedAt ? new Date(item.claimedAt).toLocaleString("zh-CN") : "",
      item.durationHours
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `报工记录_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setMessage("导出成功");
    setTimeout(() => setMessage(""), 3000);
  };

  if (loading) return <><AdminHeader title="报工记录" description="按工单、人员和状态追踪每一次报工" action={<button className={cx(styles["export-csv-btn"])} disabled><Download />导出CSV</button>} /><section className={cx(styles["admin-panel"])}><LoadingTable /></section></>;
  if (error) return <><AdminHeader title="报工记录" description="按工单、人员和状态追踪每一次报工" action={<button className={cx(styles["export-csv-btn"])} disabled><Download />导出CSV</button>} /><section className={cx(styles["admin-panel"])}><AdminError message={error} retry={() => void reload()} /></section></>;

  return (<>
    <AdminHeader title="报工记录" description="按工单、人员和状态追踪每一次报工" action={<button className={cx(styles["export-csv-btn"])} onClick={exportToExcel}><Download />导出CSV</button>} />
    <section className={cx(styles["admin-panel"])}>
      {message && <div className={cx(styles["reports-message"])}>{message}</div>}
      <div className={cx(styles["reports-filter"])}>
        <div className={cx(styles["filter-search"])}>
          <Search />
          <input type="text" value={filters.keyword} onChange={(e) => handleFilterChange("keyword", e.target.value)} placeholder="搜索工单、产品、工序或人员" />
        </div>
        <div className={cx(styles["filter-input"])}>
          <label>工单编号</label>
          <input type="text" value={filters.orderNo} onChange={(e) => handleFilterChange("orderNo", e.target.value)} placeholder="工单编号" />
        </div>
        <div className={cx(styles["filter-input"])}>
          <label>人员姓名</label>
          <input type="text" value={filters.operatorName} onChange={(e) => handleFilterChange("operatorName", e.target.value)} placeholder="人员姓名" />
        </div>
        <div className={cx(styles["filter-select"])}>
          <label>状态</label>
          <select value={filters.status} onChange={(e) => handleFilterChange("status", e.target.value)}>
            <option value="">全部</option>
            <option value="claimed">待开始</option>
            <option value="running">进行中</option>
            <option value="paused">已暂停</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
        <div className={cx(styles["filter-input"])}>
          <label>工序号</label>
          <input type="text" value={filters.operationCode} onChange={(e) => handleFilterChange("operationCode", e.target.value)} placeholder="工序号" />
        </div>
        <div className={cx(styles["filter-input"])}>
          <label>工序名称</label>
          <input type="text" value={filters.operationName} onChange={(e) => handleFilterChange("operationName", e.target.value)} placeholder="工序名称" />
        </div>
        <div className={cx(styles["filter-date"])}>
          <input type="date" value={filters.startTime} onChange={(e) => handleFilterChange("startTime", e.target.value)} />
          <span>至</span>
          <input type="date" value={filters.endTime} onChange={(e) => handleFilterChange("endTime", e.target.value)} />
        </div>
        <div className={cx(styles["filter-actions"])}>
          <button className={cx(styles["filter-search-btn"])} onClick={() => void reload()}><Search />搜索</button>
          <button className={cx(styles["filter-reset-btn"])} onClick={handleResetFilters}>重置</button>
        </div>
      </div>
      <div className={cx(styles["table-wrap"])}>
        <table className={cx(styles["reports-table"])}>
          <thead>
            <tr>
              <th>工单</th>
              <th>产品</th>
              <th>部件</th>
              <th>工序</th>
              <th>数量/工时</th>
              <th>领取人员</th>
              <th>来源</th>
              <th>状态</th>
              <th>领取时间</th>
              <th>实际工时</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((item) => (<tr key={item.id}>
              <td><strong>{item.orderNo}</strong></td>
              <td><div className={cx(styles["cell-with-sub"])}><strong>{item.productName}</strong><span>{item.partCode}</span></div></td>
              <td><div className={cx(styles["cell-with-sub"])}><strong>{item.partCode}</strong><span>{item.partName}</span></div></td>
              <td><div className={cx(styles["cell-with-sub"])}><strong>{item.operationCode}</strong><span>{item.operationName}</span></div></td>
              <td><div className={cx(styles["cell-with-sub"])}><strong>1</strong><span>{item.estimatedHours}小时</span></div></td>
              <td className={cx(styles["operator-cell"])}>{item.operatorName}</td>
              <td>自主领取</td>
              <td><span className={cx(styles["status-tag"], styles[`status-${item.status}`])}>{statusLabel[item.status as keyof typeof statusLabel] || item.status}</span></td>
              <td>{item.claimedAt ? new Date(item.claimedAt).toLocaleString("zh-CN") : "-"}</td>
              <td>
                {editingId === item.id ? (<div className={cx(styles["edit-cell"])}>
                  <input type="number" min="0" step="0.1" value={editingHours} onChange={(e) => setEditingHours(e.target.value)} />
                </div>) : (<span className={cx(styles["hours-value"])}>{item.durationHours.toFixed(2)} 小时</span>)}
              </td>
              <td>
                {editingId === item.id ? (<div className={cx(styles["edit-actions"])}>
                  <button className={cx(styles["table-action"], styles["confirm-btn"])} onClick={() => handleSaveHours(item)}><Check /></button>
                  <button className={cx(styles["table-action"], styles["cancel-btn"])} onClick={handleCancelEdit}><X /></button>
                </div>) : (<button className={cx(styles["edit-btn"])} onClick={() => handleEditHours(item)}><Edit3 />修改</button>)}
              </td>
            </tr>))}
            {!reports.length && <tr><td colSpan={11}>没有匹配的报工记录。</td></tr>}
          </tbody>
        </table>
      </div>
      <div className={cx(styles["reports-pagination"])}>
        <span>共 {total} 条记录，本页 {reports.length} 条</span>
        <div className={cx(styles["pagination-buttons"])}>
          <select className={cx(styles["pagination-size"])} value={pageSize} onChange={(e) => handlePageSizeChange(e.target.value)}>
            <option value={20}>20 条/页</option>
            <option value={50}>50 条/页</option>
            <option value={100}>100 条/页</option>
          </select>
          <button className={cx(styles["pagination-btn"])} disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button>
          <span className={cx(styles["pagination-current"])}>第 {page} / {totalPages} 页</span>
          <button className={cx(styles["pagination-btn"])} disabled={!hasMore} onClick={() => setPage((current) => current + 1)}>下一页</button>
        </div>
      </div>
    </section>
  </>);
}
