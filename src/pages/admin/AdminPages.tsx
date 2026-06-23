import { useCallback, useMemo, useState, type ReactNode } from "react";
import { HotTable } from "@handsontable/react-wrapper";
import { registerAllModules } from "handsontable/registry";
import type Handsontable from "handsontable/base";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";
import { AlertTriangle, CheckCircle2, Clock3, Factory, RefreshCw, Search, Timer, Trash2, Upload, UserPlus, UsersRound, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { workReportRepository } from "@/api/services/workReport.service";
import { isMockMode } from "@/api/services/workReport.service";
import { canWorkerRemoveAssignment, statusLabel, type ClaimableOperation, type LeaderImportDraft, type DashboardSummary, type LaborStatistics, type OperationAssignment, type ProductionException, type ReportRecord, type WorkOrder } from "@/domain/work-report";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { getErrorMessage } from "@/utils/errors";

registerAllModules();

function AdminHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <header className="admin-page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>; }
function LoadingTable() { return <div className="admin-loading"><span className="spinner" />正在读取生产数据...</div>; }
function AdminError({ message, retry }: { message: string; retry: () => void }) { return <div className="admin-loading"><span>{message}</span><button className="table-action" onClick={retry}>重试</button></div>; }
function AdminStatus({ status }: { status: string }) { return <span className={`admin-status ${status}`}>{statusLabel[status as keyof typeof statusLabel] || ({ in_progress: "生产中", completed: "已完成", pending: "待生产", exception: "异常" }[status] || status)}</span>; }

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
  const load = useCallback(() => workReportRepository.getOrders(), []);
  const { data: orders = [], loading, error, reload } = useAsyncResource<WorkOrder[]>(load);
  const filtered = orders.filter((item) => `${item.orderNo}${item.productName}${item.productCode}`.toLowerCase().includes(search.toLowerCase()));
  if (error && !loading) return <><AdminHeader title="工单与工序" description="查看源工单进度并管理人员分配" action={<SearchBox value={search} onChange={setSearch} />} /><section className="admin-panel"><AdminError message={error} retry={() => void reload()} /></section></>;
  return <><AdminHeader title="工单与工序" description="查看源工单进度并管理人员分配" action={<SearchBox value={search} onChange={setSearch} />} /><section className="admin-panel">{loading ? <LoadingTable /> : <div className="table-wrap"><table><thead><tr><th>工单号</th><th>产品</th><th>计划数量</th><th>完成进度</th><th>交期</th><th>状态</th><th>操作</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.orderNo}</strong></td><td>{item.productName}<small>{item.productCode}</small></td><td>{item.plannedQuantity} 件</td><td><div className="progress-cell"><span><i style={{ width: `${item.progress}%` }} /></span>{item.progress}%</div></td><td>{item.dueDate}</td><td><AdminStatus status={item.status} /></td><td><button className="table-action">查看工序</button></td></tr>)}</tbody></table></div>}</section></>;
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
  const [keyword, setKeyword] = useState("CP-JSJ-240623-07");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [operations, setOperations] = useState<ClaimableOperation[]>([]);
  const [workerId, setWorkerId] = useState("EMP-20240018");
  const [workerName, setWorkerName] = useState("张师傅");
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
    setOperations(await workReportRepository.getClaimableOperations(partId));
  };
  const assign = async (operationId: string) => {
    setMessage("");
    await workReportRepository.adminAssignOperation({ operationId, workerId, workerName });
    setMessage(`已分配给 ${workerName}`);
    await reloadAssignments();
  };
  const forceRemove = async (assignmentId: string) => {
    const reason = "管理员调整工单项目";
    await workReportRepository.adminRemoveAssignment(assignmentId, reason);
    setMessage("已由高级后台移除，并写入报工记录");
    await reloadAssignments();
  };
  return <><AdminHeader title="人员工序分配" description="高级后台可分配工序，也可处理已开始或不可自删的工序" action={<div className="admin-inline-actions"><SearchBox value={keyword} onChange={setKeyword} /><button className="admin-primary-action" onClick={() => void reload()}><Search />搜索</button></div>} />{message && <div className="admin-message">{message}</div>}<div className="assignment-admin-grid"><section className="admin-panel settings-card"><div className="settings-icon"><UserPlus /></div><h2>分配对象</h2><label className="admin-field">工号<input value={workerId} onChange={(event) => setWorkerId(event.target.value)} /></label><label className="admin-field">姓名<input value={workerName} onChange={(event) => setWorkerName(event.target.value)} /></label><h2>产品与部件</h2>{productsLoading ? <LoadingTable /> : <div className="admin-choice-list">{products.map((item) => <button key={item.id} className={selectedProduct === item.id ? "selected" : ""} onClick={() => void loadParts(item.id)}><strong>{item.productCode}</strong><span>{item.productName}</span></button>)}</div>}<div className="admin-choice-list compact">{parts.map((item) => <button key={item.id} className={selectedPart === item.id ? "selected" : ""} onClick={() => void choosePart(item.id)}><strong>{item.partCode}</strong><span>{item.partName}</span></button>)}</div></section><section className="admin-panel"><div className="table-wrap"><table><thead><tr><th>工序</th><th>部件</th><th>数量</th><th>工时</th><th>已领</th><th>操作</th></tr></thead><tbody>{operations.map((item) => <tr key={item.id}><td><strong>{item.operationCode}</strong><small>{item.operationName}</small></td><td>{item.partCode}</td><td>{item.plannedQuantity}</td><td>{item.estimatedHours}</td><td>{item.claimedWorkers}</td><td><button className="table-action" onClick={() => void assign(item.id)}>分配给人员</button></td></tr>)}</tbody></table></div></section></div><section className="admin-panel chart-panel"><div className="panel-heading"><div><h2>当前人员工序</h2><p>高级后台可移除已开始、自领或后台分配的异常工序</p></div></div>{assignmentsLoading ? <LoadingTable /> : <div className="table-wrap"><table><thead><tr><th>工单</th><th>产品/部件</th><th>工序</th><th>人员</th><th>来源</th><th>状态</th><th>员工可删</th><th>高级操作</th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id}><td><strong>{item.orderNo}</strong></td><td>{item.productCode}<small>{item.partCode}</small></td><td>{item.operationName}</td><td>{item.collaborators.join(" / ")}</td><td>{item.source === "self_claimed" ? "自主领取" : "后台分配"}</td><td><AdminStatus status={item.status} /></td><td>{canWorkerRemoveAssignment(item) ? "是" : "否"}</td><td><button className="table-action danger-action" onClick={() => void forceRemove(item.id)}><Trash2 />移除</button></td></tr>)}</tbody></table></div>}</section></>;
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
  return <><AdminHeader title="系统设置" description="接口环境、统计口径与演示数据" /><div className="settings-grid"><section className="admin-panel settings-card"><div className="settings-icon"><Wrench /></div><h2>业务 API</h2><dl><div><dt>当前模式</dt><dd><span className={isMockMode ? "mode-mock" : "mode-real"}>{isMockMode ? "Mock 演示" : "真实接口"}</span></dd></div><div><dt>业务服务地址</dt><dd>{import.meta.env.VITE_WORK_REPORT_API_BASE_URL || "未配置"}</dd></div><div><dt>认证服务</dt><dd>独立 authClient，不受业务配置影响</dd></div></dl></section><section className="admin-panel settings-card"><div className="settings-icon orange"><RefreshCw /></div><h2>重置演示场景</h2><p>快速切换当前工序状态，用于演示完整报工流程。</p><div className="scenario-buttons"><button disabled={resetting} onClick={() => void reset("assigned")}>待开始</button><button disabled={resetting} onClick={() => void reset("running")}>进行中</button><button disabled={resetting} onClick={() => void reset("paused")}>已暂停</button></div>{message && <div className="success-message"><CheckCircle2 />{message}</div>}</section><section className="admin-panel settings-card"><div className="settings-icon"><Clock3 /></div><h2>统计口径</h2><p>正常班次：08:00 - 17:00</p><p>超过班次的有效报工时间计入加班，最终口径以后端返回为准。</p></section></div></>;
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <label className="search-box"><Search /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder="搜索工单、产品或人员" /></label>; }
