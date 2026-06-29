import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HotTable } from "@handsontable/react-wrapper";
import { registerAllModules } from "handsontable/registry";
import type Handsontable from "handsontable/base";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";
import { AlertTriangle, CheckCircle2, ChevronDown, Check, Clock3, Factory, RefreshCw, Search, ShieldCheck, Timer, Trash2, Upload, UserPlus, UsersRound, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { workReportRepository } from "@/api/services/workReport.service";
import { isMockMode } from "@/api/services/workReport.service";
import { canWorkerRemoveAssignment, statusLabel, type ClaimableOperation, type ClaimablePart, type LeaderImportDraft, type DashboardSummary, type LaborStatistics, type OperationAssignment, type PermissionGroup, type ProductionException, type ReportRecord, type WorkerPermission, type WorkerSummary, type WorkOrder } from "@/domain/work-report";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { getErrorMessage } from "@/utils/errors";

registerAllModules();

function AdminHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <header className="admin-page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>; }
function LoadingTable() { return <div className="admin-loading"><span className="spinner" />正在读取生产数据...</div>; }
function AdminError({ message, retry }: { message: string; retry: () => void }) { return <div className="admin-loading"><span>{message}</span><button className="table-action" onClick={retry}>重试</button></div>; }
function AdminStatus({ status }: { status: string }) { return <span className={`admin-status ${status}`}>{statusLabel[status as keyof typeof statusLabel] || ({ in_progress: "生产中", completed: "已完成", pending: "待生产", exception: "异常", available: "可分配", claimed: "已满", closed: "已关闭" }[status] || status)}</span>; }

const importColumns = [
  { key: "productCode", title: "产品号", width: 180 },
  { key: "partCode", title: "部件号", width: 170 },
  { key: "operationCode", title: "工序号", width: 130 },
  { key: "operationName", title: "工序名", width: 180 },
  { key: "quantity", title: "数量", width: 100 },
  { key: "estimatedHours", title: "工时", width: 100 },
] as const;
type ImportColumnKey = (typeof importColumns)[number]["key"];
type LeaderImportGridRow = Record<ImportColumnKey, string>;
type ImportCellError = { row: number; column: ImportColumnKey; message: string };
const permissionOptions: Array<{ value: PermissionGroup; label: string; description: string }> = [
  { value: "worker", label: "普通员工", description: "移动端领取、报工和查看个人统计" },
  { value: "leader", label: "小组长", description: "可导入工序并查看小组任务" },
  { value: "admin", label: "管理员", description: "可进入后台并管理分配、异常和权限" },
];
const createEmptyImportRow = (): LeaderImportGridRow => ({ productCode: "", partCode: "", operationCode: "", operationName: "", quantity: "", estimatedHours: "" });
const createImportRows = () => [
  { productCode: "CP-JSJ-240623-07", partCode: "PART-CASE-001", operationCode: "OP-080", operationName: "终检复核", quantity: "40", estimatedHours: "1.5" },
  { productCode: "CP-FL-240623-02", partCode: "PART-FLANGE-001", operationCode: "OP-040", operationName: "清洗包装", quantity: "52", estimatedHours: "2" },
  ...Array.from({ length: 18 }, createEmptyImportRow),
];
const hasImportRowValue = (row: LeaderImportGridRow) => Object.values(row).some((value) => value.trim());
const getImportDraftRows = (rows: LeaderImportGridRow[]): LeaderImportDraft[] => rows.filter(hasImportRowValue).map((row) => ({
  productCode: row.productCode.trim(),
  partCode: row.partCode.trim(),
  operationCode: row.operationCode.trim(),
  operationName: row.operationName.trim(),
  quantity: Number(row.quantity),
  estimatedHours: Number(row.estimatedHours),
}));
function validateImportGridRows(rows: LeaderImportGridRow[]) {
  const errors: ImportCellError[] = [];
  const seen = new Map<string, number>();
  rows.forEach((row, rowIndex) => {
    if (!hasImportRowValue(row)) return;
    (["productCode", "partCode", "operationCode", "operationName"] as const).forEach((column) => {
      if (!row[column].trim()) errors.push({ row: rowIndex, column, message: "必填" });
    });
    const quantity = Number(row.quantity);
    if (!row.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0) errors.push({ row: rowIndex, column: "quantity", message: "请输入大于 0 的数字" });
    const estimatedHours = Number(row.estimatedHours);
    if (!row.estimatedHours.trim() || !Number.isFinite(estimatedHours) || estimatedHours <= 0) errors.push({ row: rowIndex, column: "estimatedHours", message: "请输入大于 0 的数字" });
    const key = `${row.productCode.trim()}-${row.partCode.trim()}-${row.operationCode.trim()}`;
    if (row.productCode.trim() && row.partCode.trim() && row.operationCode.trim()) {
      const firstRow = seen.get(key);
      if (firstRow !== undefined) {
        errors.push({ row: rowIndex, column: "operationCode", message: `与第 ${firstRow + 1} 行重复` });
        errors.push({ row: firstRow, column: "operationCode", message: `与第 ${rowIndex + 1} 行重复` });
      } else {
        seen.set(key, rowIndex);
      }
    }
  });
  return errors;
}

export function DashboardPage() {
  const load = useCallback(async () => { const [summary, stats] = await Promise.all([workReportRepository.getDashboard(), workReportRepository.getStatistics("week")]); return { summary, stats }; }, []);
  const { data, loading, error, reload } = useAsyncResource<{ summary: DashboardSummary; stats: LaborStatistics }>(load);
  if (loading && !data) return <><AdminHeader title="生产总览" description="今日生产、人员与异常情况" /><LoadingTable /></>;
  if (error && !data) return <><AdminHeader title="生产总览" description="今日生产、人员与异常情况" /><AdminError message={error} retry={() => void reload()} /></>;
  const summary = data?.summary; const stats = data?.stats;
  return <><AdminHeader title="生产总览" description="今日生产、人员与异常情况" /><div className="kpi-grid"><Kpi icon={Factory} label="在制工单" value={summary?.activeOrders ?? "-"} unit="单" /><Kpi icon={UsersRound} label="进行中人数" value={summary?.runningWorkers ?? "-"} unit="人" /><Kpi icon={Timer} label="今日累计工时" value={summary?.todayHours ?? "-"} unit="小时" /><Kpi icon={AlertTriangle} label="待处理异常" value={summary?.exceptionCount ?? "-"} unit="条" danger /></div><section className="admin-panel chart-panel"><div className="panel-heading"><div><h2>本周工时趋势</h2><p>正常工时与加班工时</p></div><span>单位：小时</span></div>{stats && <ResponsiveContainer width="100%" height={300}><BarChart data={stats.trend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e9f0" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="hours" name="总工时" fill="#1455c0" radius={[5,5,0,0]} /><Bar dataKey="overtime" name="加班" fill="#f59e0b" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer>}</section></>;
}
function Kpi({ icon: Icon, label, value, unit, danger }: { icon: typeof Factory; label: string; value: string | number; unit: string; danger?: boolean }) { return <article className={`kpi-card ${danger ? "danger" : ""}`}><div><Icon /></div><span>{label}</span><p><strong>{value}</strong>{unit}</p></article>; }

export function OrdersPage() {
  const [search, setSearch] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [parts, setParts] = useState<Record<string, ClaimablePart[]>>({});
  const [operations, setOperations] = useState<Record<string, ClaimableOperation[]>>({});
  const [panelLoading, setPanelLoading] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(() => workReportRepository.getOrders(), []);
  const { data: orders = [], loading, error, reload } = useAsyncResource<WorkOrder[]>(load);
  const filtered = orders.filter((item) => `${item.orderNo}${item.productName}${item.productCode}`.toLowerCase().includes(search.toLowerCase()));
  const openOrder = async (order: WorkOrder) => {
    setMessage("");
    const nextOpen = expandedOrderId === order.id ? "" : order.id;
    setExpandedOrderId(nextOpen);
    setSelectedPartId("");
    if (!nextOpen || parts[order.id]) return;
    setPanelLoading(order.id);
    try {
      const products = await workReportRepository.searchClaimableProducts(order.orderNo);
      const product = products.find((item) => item.orderNo === order.orderNo || item.productCode === order.productCode) || products[0];
      const loadedParts = product ? await workReportRepository.getClaimableParts(product.id) : [];
      setParts((current) => ({ ...current, [order.id]: loadedParts }));
      const firstPart = loadedParts[0];
      if (firstPart) {
        setSelectedPartId(firstPart.id);
        if (!operations[firstPart.id]) {
          const loadedOperations = await workReportRepository.getClaimableOperations(firstPart.id);
          setOperations((current) => ({ ...current, [firstPart.id]: loadedOperations }));
        }
      }
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setPanelLoading("");
    }
  };
  const choosePart = async (partId: string) => {
    setSelectedPartId(partId);
    if (operations[partId]) return;
    setPanelLoading(partId);
    try {
      const loadedOperations = await workReportRepository.getClaimableOperations(partId);
      setOperations((current) => ({ ...current, [partId]: loadedOperations }));
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setPanelLoading("");
    }
  };
  const assignOperation = async (operation: ClaimableOperation, worker: WorkerSummary) => {
    setMessage("");
    await workReportRepository.adminAssignOperation({ operationId: operation.id, workerId: worker.id, workerName: worker.name });
    setMessage(`已将 ${operation.operationName} 分配给 ${worker.name}`);
    const loadedOperations = await workReportRepository.getClaimableOperations(operation.partId);
    setOperations((current) => ({ ...current, [operation.partId]: loadedOperations }));
  };
  if (error && !loading) return <><AdminHeader title="工单与工序" description="查看源工单进度并管理人员分配" action={<SearchBox value={search} onChange={setSearch} />} /><section className="admin-panel"><AdminError message={error} retry={() => void reload()} /></section></>;
  return <><AdminHeader title="工单管理" description="搜索工单，展开工序并手动分配生产人员" action={<SearchBox value={search} onChange={setSearch} placeholder="搜索工单、产品编号或名称" />} />{message && <div className="admin-message">{message}</div>}<section className="admin-panel order-management-panel">{loading ? <LoadingTable /> : <div className="order-management-list">{filtered.map((item) => {
    const orderParts = parts[item.id] || [];
    const activePart = selectedPartId && orderParts.some((part) => part.id === selectedPartId) ? selectedPartId : orderParts[0]?.id || "";
    const activeOperations = activePart ? operations[activePart] || [] : [];
    const isOpen = expandedOrderId === item.id;
    return <article className="order-management-card" key={item.id}><button className="order-summary-row" onClick={() => void openOrder(item)} aria-expanded={isOpen}><div><strong>{item.orderNo}</strong><span>{item.productName} · {item.productCode}</span></div><div className="progress-cell"><span><i style={{ width: `${item.progress}%` }} /></span>{item.progress}%</div><AdminStatus status={item.status} /><ChevronDown className={isOpen ? "rotated" : ""} /></button>{isOpen && <div className="order-operation-panel">{panelLoading === item.id ? <LoadingTable /> : <><div className="part-tabs">{orderParts.map((part) => <button key={part.id} className={activePart === part.id ? "active" : ""} onClick={() => void choosePart(part.id)}><strong>{part.partCode}</strong><span>{part.partNo && `[${part.partNo}] `}{part.partName}</span></button>)}</div>{panelLoading === activePart ? <LoadingTable /> : activeOperations.length ? <div className="operation-assignment-list">{activeOperations.map((operation) => <OperationAssignRow key={operation.id} operation={operation} onAssign={assignOperation} />)}</div> : <div className="empty-inline">当前工单暂无可分配工序。</div>}</>}</div>}</article>;
  })}{!filtered.length && <div className="empty-inline">没有匹配的工单。</div>}</div>}</section></>;
}

function OperationAssignRow({ operation, onAssign }: { operation: ClaimableOperation; onAssign: (operation: ClaimableOperation, worker: WorkerSummary) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const full = operation.maxClaimWorkers ? operation.claimedWorkers >= operation.maxClaimWorkers : false;
  const disabled = operation.status !== "available" || full;
  return <article className="operation-assignment-row"><div><strong>{operation.operationCode} · {operation.operationNo && `[${operation.operationNo}] `}{operation.operationName}</strong><span>{operation.partName} · {operation.plannedQuantity} 件 · {operation.estimatedHours} 小时</span></div><div className="operation-capacity"><span>{operation.claimedWorkers}{operation.maxClaimWorkers ? `/${operation.maxClaimWorkers}` : ""} 人</span><AdminStatus status={operation.status} /></div><button className="admin-primary-action slim" disabled={disabled} onClick={() => setOpen((value) => !value)}><UserPlus />分配人员</button>{open && !disabled && <WorkerPicker operation={operation} onAssigned={async (worker) => { await onAssign(operation, worker); setOpen(false); }} />}</article>;
}

function WorkerPicker({ operation, onAssigned }: { operation: ClaimableOperation; onAssigned: (worker: WorkerSummary) => Promise<void> }) {
  const pageSize = 5;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef(0);
  const [keyword, setKeyword] = useState("");
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState("");
  const [error, setError] = useState("");
  const loadWorkers = useCallback(async (nextPage: number, mode: "replace" | "append") => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await workReportRepository.searchWorkers(keyword, nextPage, pageSize);
      if (requestId !== requestRef.current) return;
      setWorkers((current) => mode === "append" ? [...current, ...result.items] : result.items);
      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch (err) {
      if (requestId === requestRef.current) setError(getErrorMessage(err));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [keyword]);
  useEffect(() => { void loadWorkers(1, "replace"); }, [loadWorkers]);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !loading) void loadWorkers(page + 1, "append");
    }, { rootMargin: "80px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadWorkers, loading, page]);
  const assign = async (worker: WorkerSummary) => {
    setAssigningId(worker.id);
    setError("");
    try { await onAssigned(worker); }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setAssigningId(""); }
  };
  return <div className="worker-picker"><div className="worker-picker-head"><label className="search-box compact"><Search /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜姓名、工号、首字母" /></label><span>{operation.operationCode}</span></div><div className="worker-result-list">{workers.map((worker) => <button key={worker.id} disabled={!!assigningId} onClick={() => void assign(worker)}><span className="worker-avatar-mini">{worker.name.slice(0, 1)}</span><div><strong>{worker.name}</strong><small>{worker.employeeNo} · {worker.nameInitials.toUpperCase()} · {worker.teamName}</small></div><em>{worker.activeAssignmentCount} 道</em>{assigningId === worker.id ? <span className="spinner small" /> : <Check />}</button>)}{!workers.length && !loading && <div className="empty-inline">没有找到人员。</div>}<div ref={sentinelRef} className="lazy-load-state">{loading ? "正在加载人员..." : hasMore ? "继续下滑加载更多人员" : "人员已显示完"}</div></div>{error && <div className="admin-message danger">{error}</div>}</div>;
}

export function LeaderImportPage() {
  const [tableRows, setTableRows] = useState<LeaderImportGridRow[]>(createImportRows);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const rows = useMemo(() => getImportDraftRows(tableRows), [tableRows]);
  const errors = useMemo(() => validateImportGridRows(tableRows), [tableRows]);
  const errorByCell = useMemo(() => {
    const map = new Map<string, string>();
    errors.forEach((error) => map.set(`${error.row}-${error.column}`, error.message));
    return map;
  }, [errors]);
  const updateRows = (changes: Handsontable.CellChange[] | null, source: Handsontable.ChangeSource) => {
    if (!changes || source === "loadData") return;
    setMessage("");
    setTableRows((currentRows) => {
      const nextRows = currentRows.map((row) => ({ ...row }));
      changes.forEach(([rowIndex, prop, , nextValue]) => {
        if (typeof prop !== "string" || !importColumns.some((column) => column.key === prop)) return;
        while (!nextRows[rowIndex]) nextRows.push(createEmptyImportRow());
        nextRows[rowIndex] = { ...nextRows[rowIndex], [prop]: String(nextValue ?? "") };
      });
      return nextRows;
    });
  };
  const submit = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      const result = await workReportRepository.importLeaderOperations(rows);
      setMessage(result.errors.length ? `导入失败：${result.errors.map((item) => `第${item.row}行 ${item.message}`).join("；")}` : `已导入 ${result.accepted} 道工序，可供员工领取`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };
  return <><AdminHeader title="小组长工序导入" description="直接从 Excel 粘贴或在单元格内编辑，格式错误会标红" action={<button className="admin-primary-action" disabled={submitting || !rows.length || errors.length > 0} onClick={() => void submit()}><Upload />确认导入</button>} /><section className="admin-panel import-panel"><div className="import-summary"><span>已填写 {rows.length} 行</span>{errors.length > 0 ? <strong className="danger-text">{errors.length} 个单元格需修正</strong> : <strong className="success-text">校验通过</strong>}</div>{message && <div className="admin-message">{message}</div>}<div className="leader-import-sheet ht-theme-main"><HotTable data={tableRows} columns={importColumns.map((column) => ({ data: column.key, width: column.width }))} colHeaders={importColumns.map((column) => column.title)} rowHeaders={true} height={520} width="100%" stretchH="all" autoWrapRow={true} autoWrapCol={true} minSpareRows={6} manualColumnResize={true} contextMenu={["row_above", "row_below", "remove_row", "---------", "undo", "redo"]} copyPaste={true} comments={true} cells={(row, column) => { const key = importColumns[column]?.key; const error = key ? errorByCell.get(`${row}-${key}`) : undefined; const cellProperties: Handsontable.CellProperties = {} as Handsontable.CellProperties; if (error) { cellProperties.className = "leader-import-invalid"; cellProperties.comment = { value: error }; } return cellProperties; }} afterChange={updateRows} licenseKey="non-commercial-and-evaluation" /></div></section></>;
}

export function AssignmentAdminPage() {
  const [keyword, setKeyword] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [operations, setOperations] = useState<ClaimableOperation[]>([]);
  const [assignTargetId, setAssignTargetId] = useState("");
  const [message, setMessage] = useState("");
  const loadProducts = useCallback(() => workReportRepository.searchClaimableProducts(keyword), [keyword]);
  const { data: products = [], loading: productsLoading, reload } = useAsyncResource(loadProducts);
  const { data: assignments = [], loading: assignmentsLoading, reload: reloadAssignments } = useAsyncResource<OperationAssignment[]>(useCallback(() => workReportRepository.getAssignments(), []));
  const loadParts = async (productId: string) => {
    setSelectedProduct(productId);
    setSelectedPart("");
    setOperations([]);
  };
  const { data: parts = [] } = useAsyncResource(useCallback(() => selectedProduct ? workReportRepository.getClaimableParts(selectedProduct) : Promise.resolve([]), [selectedProduct]));
  const choosePart = async (partId: string) => {
    setSelectedPart(partId);
    setAssignTargetId("");
    setOperations(await workReportRepository.getClaimableOperations(partId));
  };
  const assign = async (operation: ClaimableOperation, worker: WorkerSummary) => {
    setMessage("");
    await workReportRepository.adminAssignOperation({ operationId: operation.id, workerId: worker.id, workerName: worker.name });
    setMessage(`已将 ${operation.operationName} 分配给 ${worker.name}`);
    setAssignTargetId("");
    setOperations(await workReportRepository.getClaimableOperations(operation.partId));
    await reloadAssignments();
  };
  const forceRemove = async (assignmentId: string) => {
    const reason = "管理员调整工单项目";
    await workReportRepository.adminRemoveAssignment(assignmentId, reason);
    setMessage("已由高级后台移除，并写入报工记录");
    await reloadAssignments();
  };
  return <><AdminHeader title="人员工序分配" description="高级后台可分配工序，也可处理已开始或不可自删的工序" action={<div className="admin-inline-actions"><SearchBox value={keyword} onChange={setKeyword} /><button className="admin-primary-action" onClick={() => void reload()}><Search />搜索</button></div>} />{message && <div className="admin-message">{message}</div>}<div className="assignment-admin-grid"><section className="admin-panel settings-card"><div className="settings-icon"><UserPlus /></div><h2>产品与部件</h2>{productsLoading ? <LoadingTable /> : <div className="admin-choice-list">{products.map((item) => <button key={item.id} className={selectedProduct === item.id ? "selected" : ""} onClick={() => void loadParts(item.id)}><strong>{item.productCode}</strong><span>{item.productName}</span></button>)}</div>}<div className="admin-choice-list compact">{parts.map((item) => <button key={item.id} className={selectedPart === item.id ? "selected" : ""} onClick={() => void choosePart(item.id)}><strong>{item.partCode}</strong><span>{item.partNo && `[${item.partNo}] `}{item.partName}</span></button>)}</div></section><section className="admin-panel"><div className="table-wrap"><table><thead><tr><th>工序</th><th>部件</th><th>数量</th><th>工时</th><th>已领</th><th>操作</th></tr></thead><tbody>{operations.map((item) => <Fragment key={item.id}><tr><td><strong>{item.operationCode}</strong><small>{item.operationNo && `[${item.operationNo}] `}{item.operationName}</small></td><td>{item.partCode}</td><td>{item.plannedQuantity}</td><td>{item.estimatedHours}</td><td>{item.claimedWorkers}</td><td><button className="table-action" disabled={item.status !== "available"} onClick={() => setAssignTargetId((value) => value === item.id ? "" : item.id)}>选择人员</button></td></tr>{assignTargetId === item.id && <tr><td colSpan={6}><WorkerPicker operation={item} onAssigned={(worker) => assign(item, worker)} /></td></tr>}</Fragment>)}{!operations.length && <tr><td colSpan={6}>请选择产品和部件后查看工序。</td></tr>}</tbody></table></div></section></div><section className="admin-panel chart-panel"><div className="panel-heading"><div><h2>当前人员工序</h2><p>高级后台可移除已开始、自领或后台分配的异常工序</p></div></div>{assignmentsLoading ? <LoadingTable /> : <div className="table-wrap"><table><thead><tr><th>工单</th><th>产品/部件</th><th>工序</th><th>人员</th><th>来源</th><th>状态</th><th>员工可删</th><th>高级操作</th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id}><td><strong>{item.orderNo}</strong></td><td>{item.productCode}<small>{item.partCode}</small></td><td>{item.operationName}</td><td>{item.collaborators.join(" / ")}</td><td>{item.source === "self_claimed" ? "自主领取" : "后台分配"}</td><td><AdminStatus status={item.status} /></td><td>{canWorkerRemoveAssignment(item) ? "是" : "否"}</td><td><button className="table-action danger-action" onClick={() => void forceRemove(item.id)}><Trash2 />移除</button></td></tr>)}</tbody></table></div>}</section></>;
}

export function ReportsPage() {
  const [search, setSearch] = useState("");
  const load = useCallback(() => workReportRepository.getReports(), []);
  const { data: reports = [], loading, error, reload } = useAsyncResource<ReportRecord[]>(load);
  const filtered = reports.filter((item) => `${item.orderNo}${item.operatorName}${item.productName}`.includes(search));
  if (loading) return <><AdminHeader title="报工记录" description="按工单、人员和状态追踪每一次报工" /><section className="admin-panel"><LoadingTable /></section></>;
  if (error) return <><AdminHeader title="报工记录" description="按工单、人员和状态追踪每一次报工" /><section className="admin-panel"><AdminError message={error} retry={() => void reload()} /></section></>;
  return <><AdminHeader title="报工记录" description="按工单、人员和状态追踪每一次报工" action={<SearchBox value={search} onChange={setSearch} />} /><section className="admin-panel"><div className="table-wrap"><table><thead><tr><th>工单与产品</th><th>工序</th><th>报工人员</th><th>开始时间</th><th>累计工时</th><th>状态</th><th>凭证</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.orderNo}</strong><small>{item.productName}</small></td><td>{item.operationName}</td><td>{item.operatorName}</td><td>{new Date(item.startedAt).toLocaleString("zh-CN")}</td><td>{item.durationHours.toFixed(1)} 小时</td><td><AdminStatus status={item.status} /></td><td><button className="table-action">查看照片</button></td></tr>)}</tbody></table></div></section></>;
}

export function PeoplePage() {
  const people = [{ name: "张师傅", group: "生产一组", hours: 8.6, overtime: .6, operations: 3 }, { name: "王师傅", group: "生产一组", hours: 8.2, overtime: .2, operations: 4 }, { name: "李师傅", group: "生产二组", hours: 7.8, overtime: 0, operations: 3 }, { name: "赵师傅", group: "生产二组", hours: 9.1, overtime: 1.1, operations: 5 }];
  return <><AdminHeader title="人员统计" description="查看每日工时、出勤与加班情况" /><section className="admin-panel"><div className="table-wrap"><table><thead><tr><th>生产人员</th><th>班组</th><th>今日工时</th><th>加班</th><th>完成工序</th><th>出勤状态</th></tr></thead><tbody>{people.map((item) => <tr key={item.name}><td><div className="person-cell"><span>{item.name.slice(0,1)}</span><strong>{item.name}</strong></div></td><td>{item.group}</td><td>{item.hours} 小时</td><td>{item.overtime} 小时</td><td>{item.operations} 道</td><td><span className="attendance-normal"><CheckCircle2 />正常</span></td></tr>)}</tbody></table></div></section></>;
}

export function PermissionsPage() {
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(() => workReportRepository.getWorkerPermissions(), []);
  const { data: people = [], loading, error, reload } = useAsyncResource<WorkerPermission[]>(load);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return people;
    return people.filter((item) => `${item.employeeNo}${item.name}${item.nameInitials}${item.teamName}`.toLowerCase().includes(keyword));
  }, [people, search]);
  const counts = useMemo(() => permissionOptions.map((option) => ({
    ...option,
    count: people.filter((item) => item.permissionGroup === option.value).length,
  })), [people]);
  const updatePermission = async (person: WorkerPermission, permissionGroup: PermissionGroup) => {
    if (person.permissionGroup === permissionGroup) return;
    setSavingId(person.id);
    setMessage("");
    try {
      const option = permissionOptions.find((item) => item.value === permissionGroup);
      await workReportRepository.updateWorkerPermission(person.id, permissionGroup);
      setMessage(`已将 ${person.name} 设置为${option?.label ?? permissionGroup}`);
      await reload();
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSavingId("");
    }
  };
  return <><AdminHeader title="权限设置" description="罗列所有人员，并为每个人选择权限组" action={<SearchBox value={search} onChange={setSearch} placeholder="搜索姓名、工号、班组或首字母" />} />{message && <div className="admin-message">{message}</div>}<div className="permission-summary-grid">{counts.map((item) => <article key={item.value} className="admin-panel permission-summary-card"><div className="settings-icon"><ShieldCheck /></div><div><strong>{item.count}</strong><span>{item.label}</span></div><p>{item.description}</p></article>)}</div><section className="admin-panel permission-panel">{loading ? <LoadingTable /> : error ? <AdminError message={error} retry={() => void reload()} /> : <div className="table-wrap"><table><thead><tr><th>人员</th><th>工号</th><th>班组</th><th>当前任务</th><th>权限组</th></tr></thead><tbody>{filtered.map((person) => <tr key={person.id}><td><div className="person-cell"><span>{person.name.slice(0,1)}</span><strong>{person.name}</strong></div></td><td>{person.employeeNo}</td><td>{person.teamName}</td><td>{person.activeAssignmentCount} 道</td><td><div className="permission-select-cell">{permissionOptions.map((option) => <button key={option.value} className={person.permissionGroup === option.value ? "selected" : ""} disabled={savingId === person.id} onClick={() => void updatePermission(person, option.value)}>{savingId === person.id && person.permissionGroup !== option.value ? <span className="spinner small" /> : option.label}</button>)}</div></td></tr>)}{!filtered.length && <tr><td colSpan={5}>没有匹配的人员。</td></tr>}</tbody></table></div>}</section></>;
}

export function ExceptionsPage() {
  const load = useCallback(() => workReportRepository.getExceptions(), []);
  const { data: items = [], loading, error, reload } = useAsyncResource<ProductionException[]>(load);
  if (loading) return <><AdminHeader title="异常审核" description="集中处理超时、重复报工和信息缺失" /><LoadingTable /></>;
  if (error) return <><AdminHeader title="异常审核" description="集中处理超时、重复报工和信息缺失" /><AdminError message={error} retry={() => void reload()} /></>;
  return <><AdminHeader title="异常审核" description="集中处理超时、重复报工和信息缺失" /><div className="exception-list">{items.map((item) => <article key={item.id} className={item.status}><div className="exception-icon"><AlertTriangle /></div><div><div><h2>{item.title}</h2><span>{item.status === "open" ? "待处理" : "已处理"}</span></div><p>{item.detail}</p><small>{item.orderNo} · {new Date(item.createdAt).toLocaleString("zh-CN")}</small></div>{item.status === "open" && <button onClick={() => void workReportRepository.resolveException(item.id).then(() => reload())}>标记为已处理</button>}</article>)}</div></>;
}

export function SettingsPage() {
  const [resetting, setResetting] = useState(false); const [message, setMessage] = useState("");
  const reset = async (scenario: "assigned" | "running" | "paused") => { setResetting(true); setMessage(""); try { await workReportRepository.resetDemo?.(scenario); setMessage("演示数据已重置，移动端刷新后生效"); } catch (error) { setMessage(getErrorMessage(error)); } finally { setResetting(false); } };
  return <><AdminHeader title="系统设置" description="接口环境、统计口径与演示数据" /><div className="settings-grid"><section className="admin-panel settings-card"><div className="settings-icon"><Wrench /></div><h2>业务 API</h2><dl><div><dt>当前模式</dt><dd><span className={isMockMode ? "mode-mock" : "mode-real"}>{isMockMode ? "Mock 演示" : "真实接口"}</span></dd></div><div><dt>业务服务地址</dt><dd>{import.meta.env.VITE_WORK_REPORT_API_BASE_URL || "未配置"}</dd></div><div><dt>认证服务</dt><dd>独立 authClient，不受业务配置影响</dd></div></dl></section><section className="admin-panel settings-card"><div className="settings-icon orange"><RefreshCw /></div><h2>重置演示场景</h2><p>快速切换当前工序状态，用于演示完整报工流程。</p><div className="scenario-buttons"><button disabled={resetting} onClick={() => void reset("assigned")}>待开始</button><button disabled={resetting} onClick={() => void reset("running")}>进行中</button><button disabled={resetting} onClick={() => void reset("paused")}>已暂停</button></div>{message && <div className="success-message"><CheckCircle2 />{message}</div>}</section><section className="admin-panel settings-card"><div className="settings-icon"><Clock3 /></div><h2>统计口径</h2><p>v1：领取或分配后即计入计划工时。</p><p>后续完整报工版本再按实际开始、暂停、完工记录计算有效工时。</p></section></div></>;
}

function SearchBox({ value, onChange, placeholder = "搜索工单、产品或人员" }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="search-box"><Search /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>; }
