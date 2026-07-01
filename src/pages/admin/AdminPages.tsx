import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { HotTable } from "@handsontable/react-wrapper";
import { registerAllModules } from "handsontable/registry";
import type Handsontable from "handsontable/base";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";
import { AlertTriangle, CheckCircle2, ChevronDown, Check, Clock3, Download, Edit3, Factory, KeyRound, Power, RefreshCw, Save, Search, ShieldCheck, Timer, Trash2, Upload, UserCog, UserPlus, UsersRound, Wrench, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AuthService, type AccountRole, type AdminAccount, type WeComDepartment, type WeComUser } from "@/api/services/auth.service";
import { workReportRepository } from "@/api/services/workReport.service";
import { isMockMode } from "@/api/services/workReport.service";
import { canWorkerRemoveAssignment, statusLabel, type ClaimableOperation, type ClaimablePart, type LeaderImportDraft, type DashboardSummary, type LaborStatistics, type OperationAssignment, type PermissionGroup, type ProductionException, type ReportRecord, type WorkerPermission, type WorkerSummary, type WorkOrder, type XftConfig, type XftHoursRow, type XftManualHoursDraft } from "@/domain/work-report";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { getErrorMessage } from "@/utils/errors";
import styles from "./AdminPages.module.less";

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

registerAllModules();

function AdminHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <header className={cx(styles["admin-page-header"])}><div><h1>{title}</h1><p>{description}</p></div>{action}</header>; }
function LoadingTable() { return <div className={styles["admin-loading"]}><span className="spinner" />正在读取生产数据...</div>; }
function AdminError({ message, retry }: { message: string; retry: () => void }) { return <div className={cx(styles["admin-loading"])}><span>{message}</span><button className={cx(styles["table-action"])} onClick={retry}>重试</button></div>; }
function AdminStatus({ status }: { status: string }) { return <span className={cx(styles["admin-status"], styles[status])}>{statusLabel[status as keyof typeof statusLabel] || ({ in_progress: "生产中", completed: "已完成", pending: "待生产", exception: "异常", available: "可分配", claimed: "已满", closed: "已关闭" }[status] || status)}</span>; }

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
  return <><AdminHeader title="生产总览" description="今日生产、人员与异常情况" /><div className={cx(styles["kpi-grid"])}><Kpi icon={Factory} label="在制工单" value={summary?.activeOrders ?? "-"} unit="单" /><Kpi icon={UsersRound} label="进行中人数" value={summary?.runningWorkers ?? "-"} unit="人" /><Kpi icon={Timer} label="今日累计工时" value={summary?.todayHours ?? "-"} unit="小时" /><Kpi icon={AlertTriangle} label="待处理异常" value={summary?.exceptionCount ?? "-"} unit="条" danger /></div><section className={cx(styles["admin-panel"], styles["chart-panel"])}><div className={cx(styles["panel-heading"])}><div><h2>本周工时趋势</h2><p>正常工时与加班工时</p></div><span>单位：小时</span></div>{stats && <ResponsiveContainer width="100%" height={300}><BarChart data={stats.trend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e9f0" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="hours" name="总工时" fill="#1455c0" radius={[5,5,0,0]} /><Bar dataKey="overtime" name="加班" fill="#f59e0b" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer>}</section></>;
}
function Kpi({ icon: Icon, label, value, unit, danger }: { icon: typeof Factory; label: string; value: string | number; unit: string; danger?: boolean }) { return <article className={cx(styles["kpi-card"], danger && styles.danger)}><div><Icon /></div><span>{label}</span><p><strong>{value}</strong>{unit}</p></article>; }

export function OrdersPage() {
  const canAssignWorkers = useWorkReportStore((state) => !!state.capabilities?.canAssignWorkers);
  const canViewTeamOperations = useWorkReportStore((state) => !!(state.capabilities?.canViewTeamOperations || state.capabilities?.canViewAllTeams));
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
    if (!canViewTeamOperations) {
      setMessage("当前账号没有团队工序视图权限。");
      return;
    }
    const nextOpen = expandedOrderId === order.id ? "" : order.id;
    setExpandedOrderId(nextOpen);
    setSelectedPartId("");
    if (!nextOpen || parts[order.id]) return;
    setPanelLoading(order.id);
    try {
      const { items: products } = await workReportRepository.searchClaimableProducts(order.orderNo, 1, 20);
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
    if (!canAssignWorkers) {
      setMessage("当前账号没有员工派工权限。");
      return;
    }
    setMessage("");
    await workReportRepository.adminAssignOperation({ operationId: operation.id, workerId: worker.id, workerName: worker.name });
    setMessage(`已将 ${operation.operationName} 分配给 ${worker.name}`);
    const loadedOperations = await workReportRepository.getClaimableOperations(operation.partId);
    setOperations((current) => ({ ...current, [operation.partId]: loadedOperations }));
  };
  if (error && !loading) return <><AdminHeader title="工单与工序" description="查看源工单进度并管理人员分配" action={<SearchBox value={search} onChange={setSearch} />} /><section className={cx(styles["admin-panel"])}><AdminError message={error} retry={() => void reload()} /></section></>;
  return <><AdminHeader title="工单管理" description="搜索工单，展开工序并手动分配生产人员" action={<SearchBox value={search} onChange={setSearch} placeholder="搜索工单、产品编号或名称" />} />{message && <div className={cx(styles["admin-message"])}>{message}</div>}<section className={cx(styles["admin-panel"], styles["order-management-panel"])}>{loading ? <LoadingTable /> : <div className={cx(styles["order-management-list"])}>{filtered.map((item) => {
    const orderParts = parts[item.id] || [];
    const activePart = selectedPartId && orderParts.some((part) => part.id === selectedPartId) ? selectedPartId : orderParts[0]?.id || "";
    const activeOperations = activePart ? operations[activePart] || [] : [];
    const isOpen = expandedOrderId === item.id;
    return <article className={cx(styles["order-management-card"])} key={item.id}><button className={cx(styles["order-summary-row"])} onClick={() => void openOrder(item)} aria-expanded={isOpen}><div><strong>{item.orderNo}</strong><span>{item.productName} · {item.productCode}</span></div><div className={cx(styles["progress-cell"])}><span><i style={{ width: `${item.progress}%` }} /></span>{item.progress}%</div><AdminStatus status={item.status} />{canViewTeamOperations && <ChevronDown className={isOpen ? styles.rotated : undefined} />}</button>{isOpen && canViewTeamOperations && <div className={cx(styles["order-operation-panel"])}>{panelLoading === item.id ? <LoadingTable /> : <><div className={cx(styles["part-tabs"])}>{orderParts.map((part) => <button key={part.id} className={activePart === part.id ? styles.active : undefined} onClick={() => void choosePart(part.id)}><strong>{part.partCode}</strong><span>{part.partNo && `[${part.partNo}] `}{part.partName}</span></button>)}</div>{panelLoading === activePart ? <LoadingTable /> : activeOperations.length ? <div className={cx(styles["operation-assignment-list"])}>{activeOperations.map((operation) => <OperationAssignRow key={operation.id} operation={operation} canAssign={canAssignWorkers} onAssign={assignOperation} />)}</div> : <div className={cx(styles["empty-inline"])}>当前工单暂无可分配工序。</div>}</>}</div>}</article>;
  })}{!filtered.length && <div className={cx(styles["empty-inline"])}>没有匹配的工单。</div>}</div>}</section></>;
}

function OperationAssignRow({ operation, canAssign, onAssign }: { operation: ClaimableOperation; canAssign: boolean; onAssign: (operation: ClaimableOperation, worker: WorkerSummary) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const full = operation.maxClaimWorkers ? operation.claimedWorkers >= operation.maxClaimWorkers : false;
  const disabled = !canAssign || operation.status !== "available" || full;
  return <article className={cx(styles["operation-assignment-row"])}><div><strong>{operation.operationCode} · {operation.operationNo && `[${operation.operationNo}] `}{operation.operationName}</strong><span>{operation.partName} · {operation.plannedQuantity} 件 · {operation.estimatedHours} 小时</span></div><div className={cx(styles["operation-capacity"])}><span>{operation.claimedWorkers}{operation.maxClaimWorkers ? `/${operation.maxClaimWorkers}` : ""} 人</span><AdminStatus status={operation.status} /></div>{canAssign && <button className={cx(styles["admin-primary-action"], styles["slim"])} disabled={disabled} onClick={() => setOpen((value) => !value)}><UserPlus />分配人员</button>}{open && !disabled && <WorkerPicker operation={operation} onAssigned={async (worker) => { await onAssign(operation, worker); setOpen(false); }} />}</article>;
}

function WorkerPicker({ operation, onAssigned }: { operation: ClaimableOperation; onAssigned: (worker: WorkerSummary) => Promise<void> }) {
  const pageSize = 5;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const [keyword, setKeyword] = useState("");
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);
  const loadWorkers = useCallback(async (nextPage: number, mode: "replace" | "append") => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await workReportRepository.searchWorkers(keyword, nextPage, pageSize);
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setWorkers((current) => mode === "append" ? [...current, ...result.items] : result.items);
      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch (err) {
      if (mountedRef.current && requestId === requestRef.current) setError(getErrorMessage(err));
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setLoading(false);
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
    catch (err) { if (mountedRef.current) setError(getErrorMessage(err)); }
    finally { if (mountedRef.current) setAssigningId(""); }
  };
  return <div className={cx(styles["worker-picker"])}><div className={cx(styles["worker-picker-head"])}><label className={cx(styles["search-box"], styles["compact"])}><Search /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜姓名、工号、首字母" /></label><span>{operation.operationCode}</span></div><div className={cx(styles["worker-result-list"])}>{workers.map((worker) => <button key={worker.id} disabled={!!assigningId} onClick={() => void assign(worker)}><span className={cx(styles["worker-avatar-mini"])}>{worker.name.slice(0, 1)}</span><div><strong>{worker.name}</strong><small>{worker.employeeNo} · {worker.nameInitials.toUpperCase()} · {worker.teamName}</small></div><em>{worker.activeAssignmentCount} 道</em>{assigningId === worker.id ? <span className="spinner small" /> : <Check />}</button>)}{!workers.length && !loading && <div className={cx(styles["empty-inline"])}>没有找到人员。</div>}<div ref={sentinelRef} className={cx(styles["lazy-load-state"])}>{loading ? "正在加载人员..." : hasMore ? "继续下滑加载更多人员" : "人员已显示完"}</div></div>{error && <div className={cx(styles["admin-message"], styles["danger"])}>{error}</div>}</div>;
}

const currentSalaryPeriod = () => { const now = new Date(); return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`; };
const defaultXftConfig = (): XftConfig => ({ host: "https://api.cmbchina.com", appid: "", appSecret: "", enterpriseId: "", defaultUserId: "U0000", defaultPlatformUserId: "AUTO0001", dataCollectionName: "", importType: "ADD", salaryPeriod: currentSalaryPeriod(), workHoursFieldKey: "", isCheckEmpty: false, enabled: true });
const createManualXftRows = () => [{ staffName: "小灰16", staffNumber: "000002", hours: "8", identityNumber: "", staffId: "" }, ...Array.from({ length: 7 }, () => ({ staffName: "", staffNumber: "", hours: "", identityNumber: "", staffId: "" }))];
type ManualXftGridRow = ReturnType<typeof createManualXftRows>[number];
const hasManualXftValue = (row: ManualXftGridRow) => [row.staffName, row.staffNumber, row.hours, row.identityNumber, row.staffId].some((value) => value.trim());
const getManualXftDraftRows = (rows: ManualXftGridRow[]): XftManualHoursDraft[] => rows.filter(hasManualXftValue).map((row) => ({ staffName: row.staffName.trim(), staffNumber: row.staffNumber.trim(), hours: Number(row.hours), identityNumber: row.identityNumber.trim(), staffId: row.staffId.trim() }));

function XftConfigPanel({ onSaved }: { onSaved: (config: XftConfig) => void }) {
  const [config, setConfig] = useState<XftConfig>(defaultXftConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { let active = true; workReportRepository.getXftConfig().then((data) => { if (!active) return; setConfig({ ...defaultXftConfig(), ...data, appSecret: "" }); onSaved(data); }).catch((error) => { if (active) setMessage(getErrorMessage(error)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [onSaved]);
  const update = (key: keyof XftConfig, value: string | boolean) => { setMessage(""); setConfig((current) => ({ ...current, [key]: value })); };
  const save = async () => { setSaving(true); setMessage(""); try { const saved = await workReportRepository.saveXftConfig(config); setConfig({ ...saved, appSecret: "" }); onSaved(saved); setMessage("薪福通配置已保存"); } catch (error) { setMessage(getErrorMessage(error)); } finally { setSaving(false); } };
  return <section className={cx(styles["admin-panel"], styles["xft-panel"])}><div className={cx(styles["panel-heading"])}><div><h2>薪福通配置</h2><p>{loading ? "正在读取配置" : config.hasAppSecret ? "密钥已配置，留空不会覆盖" : "请填写薪福通必填配置"}</p></div><button className={cx(styles["admin-primary-action"])} disabled={saving || loading} onClick={() => void save()}><Save />保存配置</button></div>{message && <div className={cx(styles["admin-message"])}>{message}</div>}<div className={cx(styles["xft-config-grid"])}><label className={cx(styles["admin-field"])}>接口地址<input value={config.host} onChange={(event) => update("host", event.target.value)} /></label><label className={cx(styles["admin-field"])}>应用 ID<input value={config.appid} onChange={(event) => update("appid", event.target.value)} /></label><label className={cx(styles["admin-field"])}>应用密钥<input type="password" value={config.appSecret || ""} placeholder={config.hasAppSecret ? "已保存，留空不变" : "必填"} onChange={(event) => update("appSecret", event.target.value)} /></label><label className={cx(styles["admin-field"])}>企业 ID<input value={config.enterpriseId} onChange={(event) => update("enterpriseId", event.target.value)} /></label><label className={cx(styles["admin-field"])}>采集表名称<input value={config.dataCollectionName} onChange={(event) => update("dataCollectionName", event.target.value)} /></label><label className={cx(styles["admin-field"])}>导入类型<input value={config.importType} onChange={(event) => update("importType", event.target.value)} /></label><label className={cx(styles["admin-field"])}>薪资期间<input value={config.salaryPeriod} onChange={(event) => update("salaryPeriod", event.target.value)} /></label><label className={cx(styles["admin-field"])}>工时字段<input value={config.workHoursFieldKey} onChange={(event) => update("workHoursFieldKey", event.target.value)} /></label><label className={cx(styles["admin-field"])}>调用用户<input value={config.defaultUserId} onChange={(event) => update("defaultUserId", event.target.value)} /></label><label className={cx(styles["admin-field"])}>平台用户<input value={config.defaultPlatformUserId} onChange={(event) => update("defaultPlatformUserId", event.target.value)} /></label></div><div className={cx(styles["xft-toggle-row"])}><label><input type="checkbox" checked={config.isCheckEmpty} onChange={(event) => update("isCheckEmpty", event.target.checked)} />校验空值</label><label><input type="checkbox" checked={config.enabled} onChange={(event) => update("enabled", event.target.checked)} />启用集成</label></div></section>;
}

function XftHoursImportPanel({ salaryPeriod }: { salaryPeriod: string }) {
  const [period, setPeriod] = useState(salaryPeriod || currentSalaryPeriod());
  const [preview, setPreview] = useState<XftHoursRow[]>([]);
  const [manualRows, setManualRows] = useState<ManualXftGridRow[]>(createManualXftRows);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (salaryPeriod) setPeriod(salaryPeriod); }, [salaryPeriod]);
  const previewHours = async () => { setLoading(true); setMessage(""); try { const rows = await workReportRepository.previewXftHours(period); setPreview(rows); setMessage(rows.length ? `预览到 ${rows.length} 名员工工时` : "该期间暂无可导入工时"); } catch (error) { setMessage(getErrorMessage(error)); } finally { setLoading(false); } };
  const importSummary = async () => { setLoading(true); setMessage(""); try { const result = await workReportRepository.importXftHours(period); setMessage(result.errors.length ? `薪福通返回错误：${result.errors.map((item) => `第${item.row}行 ${item.message}`).join("；")}` : `已推送 ${result.accepted} 名员工工时`); } catch (error) { setMessage(getErrorMessage(error)); } finally { setLoading(false); } };
  const updateManualRows = (changes: Handsontable.CellChange[] | null, source: Handsontable.ChangeSource) => { if (!changes || source === "loadData") return; setMessage(""); setManualRows((currentRows) => { const nextRows = currentRows.map((row) => ({ ...row })); changes.forEach(([rowIndex, prop, , nextValue]) => { if (typeof prop !== "string" || !(prop in createManualXftRows()[0])) return; while (!nextRows[rowIndex]) nextRows.push({ staffName: "", staffNumber: "", hours: "", identityNumber: "", staffId: "" }); nextRows[rowIndex] = { ...nextRows[rowIndex], [prop]: String(nextValue ?? "") }; }); return nextRows; }); };
  const manualDraftRows = useMemo(() => getManualXftDraftRows(manualRows), [manualRows]);
  const manualErrors = useMemo(() => manualRows.flatMap((row, index) => { if (!hasManualXftValue(row)) return []; const errors: string[] = []; if (!row.staffName.trim()) errors.push("姓名必填"); if (!row.staffNumber.trim()) errors.push("工号必填"); const hours = Number(row.hours); if (!row.hours.trim() || !Number.isFinite(hours) || hours <= 0) errors.push("工时需大于0"); return errors.map((message) => ({ row: index + 1, message })); }), [manualRows]);
  const importManual = async () => { setLoading(true); setMessage(""); try { const result = await workReportRepository.importManualXftHours(manualDraftRows, period); setMessage(result.errors.length ? `薪福通返回错误：${result.errors.map((item) => `第${item.row}行 ${item.message}`).join("；")}` : `已手工推送 ${result.accepted} 名员工工时`); } catch (error) { setMessage(getErrorMessage(error)); } finally { setLoading(false); } };
  return <section className={cx(styles["admin-panel"], styles["xft-panel"])}><div className={cx(styles["panel-heading"])}><div><h2>薪福通工时导入</h2><p>按期间汇总或手工填写员工工时后推送到采集表</p></div><label className={cx(styles["xft-period-input"])}>薪资期间<input value={period} onChange={(event) => setPeriod(event.target.value)} /></label></div>{message && <div className={cx(styles["admin-message"])}>{message}</div>}<div className={cx(styles["xft-import-grid"])}><section><div className={cx(styles["xft-section-head"])}><h3>按员工汇总</h3><div><button className={cx(styles["table-action"])} disabled={loading} onClick={() => void previewHours()}><RefreshCw />预览</button><button className={cx(styles["admin-primary-action"])} disabled={loading} onClick={() => void importSummary()}><Upload />推送</button></div></div><div className={cx(styles["table-wrap"], styles["compact"])}><table><thead><tr><th>姓名</th><th>工号</th><th>工时</th></tr></thead><tbody>{preview.map((row) => <tr key={`${row.staffNumber}-${row.lineId}`}><td>{row.staffName}</td><td>{row.staffNumber}</td><td>{row.hours}</td></tr>)}{!preview.length && <tr><td colSpan={3}>尚未预览</td></tr>}</tbody></table></div></section><section><div className={cx(styles["xft-section-head"])}><h3>手工导入</h3><button className={cx(styles["admin-primary-action"])} disabled={loading || !manualDraftRows.length || manualErrors.length > 0} onClick={() => void importManual()}><Upload />推送手工表</button></div>{manualErrors.length > 0 && <div className={cx(styles["admin-message"], styles["danger"])}>{manualErrors.slice(0, 3).map((item) => `第${item.row}行 ${item.message}`).join("；")}</div>}<div className={cx(styles["leader-import-sheet"], "ht-theme-main")}><HotTable data={manualRows} columns={[{ data: "staffName", width: 110 }, { data: "staffNumber", width: 120 }, { data: "hours", width: 80 }, { data: "identityNumber", width: 150 }, { data: "staffId", width: 110 }]} colHeaders={["姓名", "工号", "工时", "证件号", "员工序号"]} rowHeaders={true} height={240} width="100%" stretchH="all" minSpareRows={3} afterChange={updateManualRows} licenseKey="non-commercial-and-evaluation" /></div></section></div></section>;
}

export function LeaderImportPage() {
  const canImportOperations = useWorkReportStore((state) => !!state.capabilities?.canImportOperations);
  const [tableRows, setTableRows] = useState<LeaderImportGridRow[]>(createImportRows);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [xftConfig, setXftConfig] = useState<XftConfig>(defaultXftConfig);
  const [searchKeyword, setSearchKeyword] = useState("");
  const rows = useMemo(() => getImportDraftRows(tableRows), [tableRows]);
  const errors = useMemo(() => validateImportGridRows(tableRows), [tableRows]);
  const errorByCell = useMemo(() => {
    const map = new Map<string, string>();
    errors.forEach((error) => map.set(`${error.row}-${error.column}`, error.message));
    return map;
  }, [errors]);

  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return tableRows;
    const keyword = searchKeyword.toLowerCase();
    return tableRows.filter((row) => 
      row.productCode.toLowerCase().includes(keyword) ||
      row.partCode.toLowerCase().includes(keyword) ||
      row.operationCode.toLowerCase().includes(keyword) ||
      row.operationName.toLowerCase().includes(keyword)
    );
  }, [tableRows, searchKeyword]);

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
    if (!canImportOperations) {
      setMessage("当前账号没有工序导入权限。");
      return;
    }
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

  return (<>
    <AdminHeader title="小组长工序导入" description="直接从 Excel 粘贴或在单元格内编辑，格式错误会标红" action={canImportOperations && <button className={cx(styles["admin-primary-action"])} disabled={submitting || !rows.length || errors.length > 0} onClick={() => void submit()}><Upload />确认导入</button>} />
    <XftConfigPanel onSaved={setXftConfig} />
    <XftHoursImportPanel salaryPeriod={xftConfig.salaryPeriod} />
    <section className={cx(styles["admin-panel"], styles["import-panel"])}>
      <div className={cx(styles["import-header"])}>
        <div className={cx(styles["import-summary"])}>
          <span>已填写 {rows.length} 行</span>
          {errors.length > 0 ? <strong className={cx(styles["danger-text"])}>{errors.length} 个单元格需修正</strong> : <strong className={cx(styles["success-text"])}>校验通过</strong>}
        </div>
        <div className={cx(styles["import-search"])}>
          <SearchBox value={searchKeyword} onChange={setSearchKeyword} placeholder="搜索产品号、部件号、工序号或工序名" />
          {searchKeyword && <button className={cx(styles["table-action"])} onClick={() => setSearchKeyword("")}><X />清除</button>}
        </div>
      </div>
      {message && <div className={cx(styles["admin-message"])}>{message}</div>}
      <div className={cx(styles["leader-import-sheet"], "ht-theme-main")}>
        <HotTable
          data={filteredRows}
          columns={importColumns.map((column) => ({ data: column.key, width: column.width }))}
          colHeaders={importColumns.map((column) => column.title)}
          rowHeaders={true}
          height={520}
          width="100%"
          stretchH="all"
          autoWrapRow={true}
          autoWrapCol={true}
          minSpareRows={6}
          manualColumnResize={true}
          contextMenu={["row_above", "row_below", "remove_row", "---------", "undo", "redo"]}
          copyPaste={true}
          comments={true}
          cells={(row, column) => {
            const key = importColumns[column]?.key;
            const error = key ? errorByCell.get(`${row}-${key}`) : undefined;
            const cellProperties: Handsontable.CellProperties = {} as Handsontable.CellProperties;
            if (error) {
              cellProperties.className = "leader-import-invalid";
              cellProperties.comment = { value: error };
            }
            return cellProperties;
          }}
          afterChange={updateRows}
          licenseKey="non-commercial-and-evaluation"
        />
      </div>
    </section>
  </>);
}

export function AssignmentAdminPage() {
  const canAssignWorkers = useWorkReportStore((state) => !!state.capabilities?.canAssignWorkers);
  const canForceRemoveAssignments = useWorkReportStore((state) => !!state.capabilities?.canForceRemoveAssignments);
  const [keyword, setKeyword] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [operations, setOperations] = useState<ClaimableOperation[]>([]);
  const [assignTargetId, setAssignTargetId] = useState("");
  const [message, setMessage] = useState("");
  const loadProducts = useCallback(async () => canAssignWorkers ? (await workReportRepository.searchClaimableProducts(keyword, 1, 20)).items : [], [canAssignWorkers, keyword]);
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
    if (!canAssignWorkers) {
      setMessage("当前账号没有员工派工权限。");
      return;
    }
    setMessage("");
    await workReportRepository.adminAssignOperation({ operationId: operation.id, workerId: worker.id, workerName: worker.name });
    setMessage(`已将 ${operation.operationName} 分配给 ${worker.name}`);
    setAssignTargetId("");
    setOperations(await workReportRepository.getClaimableOperations(operation.partId));
    await reloadAssignments();
  };
  const forceRemove = async (assignmentId: string) => {
    if (!canForceRemoveAssignments) {
      setMessage("当前账号没有强制移除权限。");
      return;
    }
    const reason = "管理员调整工单项目";
    await workReportRepository.adminRemoveAssignment(assignmentId, reason);
    setMessage("已由高级后台移除，并写入报工记录");
    await reloadAssignments();
  };
  return <><AdminHeader title="人员工序分配" description="高级后台可分配工序，也可处理已开始或不可自删的工序" action={canAssignWorkers && <div className={cx(styles["admin-inline-actions"])}><SearchBox value={keyword} onChange={setKeyword} /><button className={cx(styles["admin-primary-action"])} onClick={() => void reload()}><Search />搜索</button></div>} />{message && <div className={cx(styles["admin-message"])}>{message}</div>}{canAssignWorkers && <div className={cx(styles["assignment-admin-grid"])}><section className={cx(styles["admin-panel"], styles["settings-card"])}><div className={cx(styles["settings-icon"])}><UserPlus /></div><h2>产品与部件</h2>{productsLoading ? <LoadingTable /> : <div className={cx(styles["admin-choice-list"])}>{products.map((item) => <button key={item.id} className={selectedProduct === item.id ? styles.selected : undefined} onClick={() => void loadParts(item.id)}><strong>{item.productCode}</strong><span>{item.productName}</span></button>)}</div>}<div className={cx(styles["admin-choice-list"], styles["compact"])}>{parts.map((item) => <button key={item.id} className={selectedPart === item.id ? styles.selected : undefined} onClick={() => void choosePart(item.id)}><strong>{item.partCode}</strong><span>{item.partNo && `[${item.partNo}] `}{item.partName}</span></button>)}</div></section><section className={cx(styles["admin-panel"])}><div className={cx(styles["table-wrap"])}><table><thead><tr><th>工序</th><th>部件</th><th>数量</th><th>工时</th><th>已领</th><th>操作</th></tr></thead><tbody>{operations.map((item) => <Fragment key={item.id}><tr><td><strong>{item.operationCode}</strong><small>{item.operationNo && `[${item.operationNo}] `}{item.operationName}</small></td><td>{item.partCode}</td><td>{item.plannedQuantity}</td><td>{item.estimatedHours}</td><td>{item.claimedWorkers}</td><td><button className={cx(styles["table-action"])} disabled={item.status !== "available"} onClick={() => setAssignTargetId((value) => value === item.id ? "" : item.id)}>选择人员</button></td></tr>{assignTargetId === item.id && <tr><td colSpan={6}><WorkerPicker operation={item} onAssigned={(worker) => assign(item, worker)} /></td></tr>}</Fragment>)}{!operations.length && <tr><td colSpan={6}>请选择产品和部件后查看工序。</td></tr>}</tbody></table></div></section></div>}<section className={cx(styles["admin-panel"], styles["chart-panel"])}><div className={cx(styles["panel-heading"])}><div><h2>当前人员工序</h2><p>高级后台可移除已开始、自领或后台分配的异常工序</p></div></div>{assignmentsLoading ? <LoadingTable /> : <div className={cx(styles["table-wrap"])}><table><thead><tr><th>工单</th><th>产品/部件</th><th>工序</th><th>人员</th><th>来源</th><th>状态</th><th>员工可删</th>{canForceRemoveAssignments && <th>高级操作</th>}</tr></thead><tbody>{assignments.map((item) => <tr key={item.id}><td><strong>{item.orderNo}</strong></td><td>{item.productCode}<small>{item.partCode}</small></td><td>{item.operationName}</td><td>{item.collaborators.join(" / ")}</td><td>{item.source === "self_claimed" ? "自主领取" : "后台分配"}</td><td><AdminStatus status={item.status} /></td><td>{canWorkerRemoveAssignment(item) ? "是" : "否"}</td>{canForceRemoveAssignments && <td><button className={cx(styles["table-action"], styles["danger-action"])} onClick={() => void forceRemove(item.id)}><Trash2 />移除</button></td>}</tr>)}</tbody></table></div>}</section></>;
}

export function ReportsPage() {
  const [filters, setFilters] = useState<{
    keyword: string;
    orderNo: string;
    operatorName: string;
    status: string;
    startTime: string;
    endTime: string;
  }>({ keyword: "", orderNo: "", operatorName: "", status: "", startTime: "", endTime: "" });
  const [editingId, setEditingId] = useState("");
  const [editingHours, setEditingHours] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(() => workReportRepository.getReports(filters), [filters]);
  const { data: reports = [], loading, error, reload } = useAsyncResource<ReportRecord[]>(load);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({ keyword: "", orderNo: "", operatorName: "", status: "", startTime: "", endTime: "" });
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
        <span>共 {reports.length} 条记录</span>
        <div className={cx(styles["pagination-buttons"])}>
          <button className={cx(styles["pagination-btn"])} disabled>上一页</button>
          <span className={cx(styles["pagination-current"])}>第 1 页</span>
          <button className={cx(styles["pagination-btn"])} disabled>下一页</button>
        </div>
      </div>
    </section>
  </>);
}

export function PeoplePage() {
  const people = [{ name: "张师傅", group: "生产一组", hours: 8.6, overtime: .6, operations: 3 }, { name: "王师傅", group: "生产一组", hours: 8.2, overtime: .2, operations: 4 }, { name: "李师傅", group: "生产二组", hours: 7.8, overtime: 0, operations: 3 }, { name: "赵师傅", group: "生产二组", hours: 9.1, overtime: 1.1, operations: 5 }];
  return <><AdminHeader title="人员统计" description="查看每日工时、出勤与加班情况" /><section className={cx(styles["admin-panel"])}><div className={cx(styles["table-wrap"])}><table><thead><tr><th>生产人员</th><th>班组</th><th>今日工时</th><th>加班</th><th>完成工序</th><th>出勤状态</th></tr></thead><tbody>{people.map((item) => <tr key={item.name}><td><div className={cx(styles["person-cell"])}><span>{item.name.slice(0,1)}</span><strong>{item.name}</strong></div></td><td>{item.group}</td><td>{item.hours} 小时</td><td>{item.overtime} 小时</td><td>{item.operations} 道</td><td><span className={cx(styles["attendance-normal"])}><CheckCircle2 />正常</span></td></tr>)}</tbody></table></div></section></>;
}

type WeComUserForm = {
  userid: string;
  name: string;
  alias: string;
  mobile: string;
  position: string;
  gender: string;
  email: string;
  telephone: string;
  enable: boolean;
  departmentInput: string;
  orderInput: string;
};

type WeComDepartmentForm = {
  name: string;
  parentid: number;
  order: number;
  name_en: string;
};

const defaultWeComUserForm: WeComUserForm = {
  userid: "",
  name: "",
  alias: "",
  mobile: "",
  position: "",
  gender: "1",
  email: "",
  telephone: "",
  enable: true,
  departmentInput: "",
  orderInput: "",
};

const defaultWeComDepartmentForm: WeComDepartmentForm = {
  name: "",
  parentid: 1,
  order: 1,
  name_en: "",
};

export function WeComPage() {
  const [tab, setTab] = useState<"users" | "departments">("users");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [joinQrCode, setJoinQrCode] = useState<string>("");
  const [joinQrError, setJoinQrError] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [userForm, setUserForm] = useState<WeComUserForm>(defaultWeComUserForm);
  const [departmentForm, setDepartmentForm] = useState<WeComDepartmentForm>(defaultWeComDepartmentForm);
  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string>("");
  const [syncingDepartments, setSyncingDepartments] = useState(false);
  const [syncingUserDepartments, setSyncingUserDepartments] = useState(false);

  const loadUsers = useCallback(() => AuthService.getWeComUsers(), []);
  const {
    data: users = [],
    loading: usersLoading,
    error: usersError,
    reload: reloadUsers,
  } = useAsyncResource(loadUsers);

  const loadDepartments = useCallback(
    () => AuthService.getWeComDepartments(),
    [],
  );
  const {
    data: departments = [],
    loading: departmentsLoading,
    error: departmentsError,
    reload: reloadDepartments,
  } = useAsyncResource(loadDepartments);

  useEffect(() => {
    let active = true;
    AuthService.getWeComJoinQrCode(3)
      .then((result) => {
        if (!active) return;
        setJoinQrCode(result.joinQrcode || result.join_qrcode || "");
      })
      .catch((error) => {
        if (!active) return;
        setJoinQrError(getErrorMessage(error));
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((item) => {
      const text = `${item.userid || ""}${item.name || ""}${item.alias || ""}${item.mobile || ""}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [search, users]);

  const updateUserForm = (key: keyof WeComUserForm, value: string | boolean) => {
    setMessage("");
    setUserForm((current) => ({ ...current, [key]: value }));
  };

  const resetUserForm = () => {
    setSelectedUser("");
    setUserForm(defaultWeComUserForm);
  };

  const buildUserPayload = () => {
    const departments = userForm.departmentInput
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((value) => Number.isFinite(value));
    const order = userForm.orderInput
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((value) => Number.isFinite(value));

    return {
      userid: userForm.userid.trim(),
      name: userForm.name.trim(),
      alias: userForm.alias.trim() || undefined,
      mobile: userForm.mobile.trim() || undefined,
      position: userForm.position.trim() || undefined,
      gender: userForm.gender || undefined,
      email: userForm.email.trim() || undefined,
      telephone: userForm.telephone.trim() || undefined,
      enable: userForm.enable ? 1 : 0,
      department: departments.length ? departments : undefined,
      order: order.length ? order : undefined,
    };
  };

  const selectUser = (user: WeComUser) => {
    setSelectedUser(user.userid);
    setMessage("");
    setUserForm({
      userid: user.userid,
      name: user.name,
      alias: user.alias || "",
      mobile: user.mobile || "",
      position: user.position || "",
      gender: user.gender || "1",
      email: user.email || "",
      telephone: user.telephone || "",
      enable: user.enable === 1,
      departmentInput: Array.isArray(user.department) ? user.department.join(",") : "",
      orderInput: Array.isArray(user.order) ? user.order.join(",") : "",
    });
  };

  const saveUser = async () => {
    const payload = buildUserPayload();
    if (!payload.userid || !payload.name) {
      setMessage("请输入员工账号和姓名");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      if (selectedUser) {
        await AuthService.updateWeComUser(selectedUser, payload);
        setMessage(`已更新员工 ${payload.name}`);
      } else {
        await AuthService.createWeComUser(payload);
        setMessage(`已新增员工 ${payload.name}`);
      }
      await reloadUsers();
      resetUserForm();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (userid: string) => {
    if (!window.confirm(`确认删除企业微信用户 ${userid} 吗？`)) return;
    setDeletingUserId(userid);
    setMessage("");
    try {
      await AuthService.deleteWeComUsers([userid]);
      setMessage(`已删除员工 ${userid}`);
      if (selectedUser === userid) resetUserForm();
      await reloadUsers();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setDeletingUserId("");
    }
  };

  const startEditDepartment = (department: WeComDepartment) => {
    setEditingDepartmentId(department.id);
    setDepartmentForm({
      name: department.name || "",
      parentid: department.parentid ?? 1,
      order: department.order ?? 1,
      name_en: department.name_en || "",
    });
    setMessage("");
  };

  const resetDepartmentForm = () => {
    setEditingDepartmentId(null);
    setDepartmentForm(defaultWeComDepartmentForm);
  };

  const saveDepartment = async () => {
    if (!departmentForm.name.trim()) {
      setMessage("请输入部门名称");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      if (editingDepartmentId) {
        await AuthService.updateWeComDepartment(editingDepartmentId, {
          name: departmentForm.name.trim(),
          parentid: departmentForm.parentid,
          order: departmentForm.order,
          name_en: departmentForm.name_en.trim() || undefined,
        });
        setMessage(`已更新部门 ${departmentForm.name}`);
      } else {
        await AuthService.createWeComDepartment({
          name: departmentForm.name.trim(),
          parentid: departmentForm.parentid,
          order: departmentForm.order,
          name_en: departmentForm.name_en.trim() || undefined,
        });
        setMessage(`已创建部门 ${departmentForm.name}`);
      }
      await reloadDepartments();
      resetDepartmentForm();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const deleteDepartment = async (id: number) => {
    if (!window.confirm(`确认删除部门 ${id} 吗？`)) return;
    setSaving(true);
    setMessage("");
    try {
      await AuthService.deleteWeComDepartment(id);
      setMessage(`已删除部门 ${id}`);
      await reloadDepartments();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const syncDepartments = async () => {
    setSyncingDepartments(true);
    setMessage("");
    try {
      await AuthService.syncWeComDepartments();
      setMessage("已同步部门结构");
      await reloadDepartments();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSyncingDepartments(false);
    }
  };

  const syncUserDepartments = async () => {
    setSyncingUserDepartments(true);
    setMessage("");
    try {
      await AuthService.syncWeComUserDepartments();
      setMessage("已同步员工部门关系");
      await reloadUsers();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSyncingUserDepartments(false);
    }
  };

  return (
    <>
      <AdminHeader title="企业微信管理" description="HR 可在此分享入职二维码、管理员工账号与部门" />
      <section className={cx(styles["admin-panel"], styles["wecom-tabs"]) }>
        <div className={styles["wecom-tab-buttons"]}>
          <button className={tab === "users" ? styles.active : undefined} onClick={() => setTab("users")}>员工管理</button>
          <button className={tab === "departments" ? styles.active : undefined} onClick={() => setTab("departments")}>部门管理</button>
        </div>
        {message && <div className={cx(styles["admin-message"])}>{message}</div>}
        {tab === "users" ? (
          <WeComUsersSection
            users={users}
            filteredUsers={filteredUsers}
            usersLoading={usersLoading}
            usersError={usersError}
            reloadUsers={reloadUsers}
            joinQrCode={joinQrCode}
            joinQrError={joinQrError}
            search={search}
            setSearch={setSearch}
            selectedUser={selectedUser}
            userForm={userForm}
            updateUserForm={updateUserForm}
            resetUserForm={resetUserForm}
            saveUser={saveUser}
            deleteUser={deleteUser}
            selectUser={selectUser}
            saving={saving}
            deletingUserId={deletingUserId}
            syncUserDepartments={syncUserDepartments}
            syncingUserDepartments={syncingUserDepartments}
          />
        ) : (
          <WeComDepartmentsSection
            departments={departments}
            departmentsLoading={departmentsLoading}
            departmentsError={departmentsError}
            reloadDepartments={reloadDepartments}
            departmentForm={departmentForm}
            setDepartmentForm={setDepartmentForm}
            editingDepartmentId={editingDepartmentId}
            startEditDepartment={startEditDepartment}
            resetDepartmentForm={resetDepartmentForm}
            saveDepartment={saveDepartment}
            deleteDepartment={deleteDepartment}
            saving={saving}
            syncDepartments={syncDepartments}
            syncingDepartments={syncingDepartments}
          />
        )}
      </section>
    </>
  );
}

function WeComUsersSection({
  users,
  filteredUsers,
  usersLoading,
  usersError,
  reloadUsers,
  joinQrCode,
  joinQrError,
  search,
  setSearch,
  selectedUser,
  userForm,
  updateUserForm,
  resetUserForm,
  saveUser,
  deleteUser,
  selectUser,
  saving,
  deletingUserId,
  syncUserDepartments,
  syncingUserDepartments,
}: {
  users: WeComUser[];
  filteredUsers: WeComUser[];
  usersLoading: boolean;
  usersError: string | null;
  reloadUsers: () => Promise<WeComUser[] | undefined>;
  joinQrCode: string;
  joinQrError: string;
  search: string;
  setSearch: (value: string) => void;
  selectedUser: string;
  userForm: WeComUserForm;
  updateUserForm: (key: keyof WeComUserForm, value: string | boolean) => void;
  resetUserForm: () => void;
  saveUser: () => Promise<void>;
  deleteUser: (userid: string) => Promise<void>;
  selectUser: (user: WeComUser) => void;
  saving: boolean;
  deletingUserId: string;
  syncUserDepartments: () => Promise<void>;
  syncingUserDepartments: boolean;
}) {
  return (
    <div className={styles["wecom-grid"]}>
      <section className={cx(styles["admin-panel"], styles["wecom-qr-panel"])}>
        <div className={styles["panel-heading"]}>
          <div>
            <h2>邀请二维码</h2>
            <p>分享给新员工，填写企业微信入职申请。</p>
          </div>
        </div>
        {joinQrCode ? (
          <div className={styles["wecom-qr-preview"]}>
            <img src={joinQrCode} alt="企业微信入职二维码" />
            <a className={styles["admin-primary-action"]} href={joinQrCode} target="_blank" rel="noreferrer">打开二维码</a>
            <button className={styles["admin-primary-action"]} onClick={() => navigator.clipboard.writeText(joinQrCode)}>
              复制邀请链接
            </button>
          </div>
        ) : joinQrError ? (
          <div className={styles["admin-message"]}>{joinQrError}</div>
        ) : (
          <div className={styles["admin-loading"]}>正在加载邀请二维码…</div>
        )}
      </section>
      <section className={cx(styles["admin-panel"], styles["wecom-user-panel"])}>
        <div className={styles["panel-heading"]}>
          <div>
            <h2>员工管理</h2>
            <p>搜索、创建、修改或删除企业微信员工。</p>
          </div>
          <div className={styles["panel-actions"]}>
            <button className={styles["admin-primary-action"]} disabled={syncingUserDepartments} onClick={syncUserDepartments}>
              {syncingUserDepartments ? "同步中..." : "同步员工部门关系"}
            </button>
            <button className={styles["admin-primary-action"]} onClick={resetUserForm}>
              新建员工
            </button>
          </div>
        </div>
        <div className={styles["wecom-user-layout"]}>
          <div className={styles["wecom-user-list"]}>
            <div className={styles["panel-actions"]}>
              <SearchBox value={search} onChange={setSearch} placeholder="搜索员工账号、姓名或手机号" />
              <button className={styles["admin-primary-action"]} onClick={() => void reloadUsers()}>
                刷新列表
              </button>
            </div>
            {usersLoading ? (
              <LoadingTable />
            ) : usersError ? (
              <AdminError message={usersError} retry={() => void reloadUsers()} />
            ) : (
              <div className={styles["table-wrap"]}>
                <table>
                  <thead>
                    <tr>
                      <th>账号</th>
                      <th>姓名</th>
                      <th>手机号</th>
                      <th>部门</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.userid}>
                        <td>{user.userid}</td>
                        <td>{user.name}</td>
                        <td>{user.mobile || "-"}</td>
                        <td>{Array.isArray(user.department) ? user.department.join(",") : "-"}</td>
                        <td>
                          <button className={styles["table-action"]} onClick={() => selectUser(user)}>
                            编辑
                          </button>
                          <button className={styles["table-action"]} disabled={deletingUserId === user.userid} onClick={() => void deleteUser(user.userid)}>
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filteredUsers.length && (
                      <tr>
                        <td colSpan={5}>没有匹配的员工。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <WeComUserFormCard
            selectedUser={selectedUser}
            userForm={userForm}
            updateUserForm={updateUserForm}
            resetUserForm={resetUserForm}
            saveUser={saveUser}
            saving={saving}
          />
        </div>
      </section>
    </div>
  );
}

function WeComUserFormCard({
  selectedUser,
  userForm,
  updateUserForm,
  resetUserForm,
  saveUser,
  saving,
}: {
  selectedUser: string;
  userForm: WeComUserForm;
  updateUserForm: (key: keyof WeComUserForm, value: string | boolean) => void;
  resetUserForm: () => void;
  saveUser: () => Promise<void>;
  saving: boolean;
}) {
  return (
    <div className={styles["wecom-user-form"]}>
      <h3>{selectedUser ? "编辑员工" : "创建员工"}</h3>
      <div className={styles["form-grid"]}>
        <label className={styles["admin-field"]}>员工账号<input value={userForm.userid} disabled={Boolean(selectedUser)} onChange={(event) => updateUserForm("userid", event.target.value)} /></label>
        <label className={styles["admin-field"]}>姓名<input value={userForm.name} onChange={(event) => updateUserForm("name", event.target.value)} /></label>
        <label className={styles["admin-field"]}>手机号<input value={userForm.mobile} onChange={(event) => updateUserForm("mobile", event.target.value)} /></label>
        <label className={styles["admin-field"]}>别名<input value={userForm.alias} onChange={(event) => updateUserForm("alias", event.target.value)} /></label>
        <label className={styles["admin-field"]}>职位<input value={userForm.position} onChange={(event) => updateUserForm("position", event.target.value)} /></label>
        <label className={styles["admin-field"]}>邮箱<input value={userForm.email} onChange={(event) => updateUserForm("email", event.target.value)} /></label>
        <label className={styles["admin-field"]}>电话<input value={userForm.telephone} onChange={(event) => updateUserForm("telephone", event.target.value)} /></label>
        <label className={styles["admin-field"]}>部门<input value={userForm.departmentInput} placeholder="例如 1,2" onChange={(event) => updateUserForm("departmentInput", event.target.value)} /></label>
        <label className={styles["admin-field"]}>部门排序<input value={userForm.orderInput} placeholder="例如 10,20" onChange={(event) => updateUserForm("orderInput", event.target.value)} /></label>
        <label className={styles["admin-field"]}>性别<select value={userForm.gender} onChange={(event) => updateUserForm("gender", event.target.value)}><option value="1">男</option><option value="2">女</option><option value="0">未知</option></select></label>
        <label className={styles["admin-field"]}><span>启用</span><input type="checkbox" checked={userForm.enable} onChange={(event) => updateUserForm("enable", event.target.checked)} /></label>
      </div>
      <div className={styles["form-actions"]}>
        <button className={cx(styles["admin-primary-action"], styles["full-width"])} disabled={saving} onClick={() => void saveUser()}>
          {selectedUser ? "保存修改" : "创建员工"}
        </button>
        {selectedUser && <button className={styles["table-action"]} disabled={saving} onClick={resetUserForm}>取消编辑</button>}
      </div>
    </div>
  );
}

function WeComDepartmentsSection({
  departments,
  departmentsLoading,
  departmentsError,
  reloadDepartments,
  departmentForm,
  setDepartmentForm,
  editingDepartmentId,
  startEditDepartment,
  resetDepartmentForm,
  saveDepartment,
  deleteDepartment,
  saving,
  syncDepartments,
  syncingDepartments,
}: {
  departments: WeComDepartment[];
  departmentsLoading: boolean;
  departmentsError: string | null;
  reloadDepartments: () => Promise<WeComDepartment[] | undefined>;
  departmentForm: WeComDepartmentForm;
  setDepartmentForm: Dispatch<SetStateAction<WeComDepartmentForm>>;
  editingDepartmentId: number | null;
  startEditDepartment: (department: WeComDepartment) => void;
  resetDepartmentForm: () => void;
  saveDepartment: () => Promise<void>;
  deleteDepartment: (id: number) => Promise<void>;
  saving: boolean;
  syncDepartments: () => Promise<void>;
  syncingDepartments: boolean;
}) {
  return (
    <div className={styles["wecom-grid"]}>
      <section className={cx(styles["admin-panel"], styles["wecom-department-panel"])}>
        <div className={styles["panel-heading"]}>
          <div>
            <h2>部门管理</h2>
            <p>把企业微信部门结构同步到本地，并创建或修改部门信息。</p>
          </div>
          <div className={styles["panel-actions"]}>
            <button className={styles["admin-primary-action"]} disabled={syncingDepartments} onClick={syncDepartments}>
              {syncingDepartments ? "同步中..." : "同步部门"}
            </button>
          </div>
        </div>
        <div className={styles["wecom-department-layout"]}>
          <div className={styles["wecom-department-list"]}>
            <div className={styles["panel-actions"]}>
              <button className={styles["admin-primary-action"]} onClick={() => void reloadDepartments()}>
                刷新列表
              </button>
            </div>
            {departmentsLoading ? (
              <LoadingTable />
            ) : departmentsError ? (
              <AdminError message={departmentsError} retry={() => void reloadDepartments()} />
            ) : (
              <div className={styles["table-wrap"]}>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>父部门</th>
                      <th>排序</th>
                      <th>名称</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.parentid ?? "-"}</td>
                        <td>{item.order ?? "-"}</td>
                        <td>{item.name || "-"}</td>
                        <td>
                          <button className={styles["table-action"]} onClick={() => startEditDepartment(item)}>
                            编辑
                          </button>
                          <button className={styles["table-action"]} onClick={() => void deleteDepartment(item.id)}>
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!departments.length && (
                      <tr>
                        <td colSpan={5}>没有可用部门数据。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className={styles["wecom-department-form"]}>
            <h3>{editingDepartmentId ? "编辑部门" : "新增部门"}</h3>
            <div className={styles["form-grid"]}>
              <label className={styles["admin-field"]}>名称<input value={departmentForm.name} onChange={(event) => setDepartmentForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className={styles["admin-field"]}>父部门<input type="number" value={departmentForm.parentid} onChange={(event) => setDepartmentForm((current) => ({ ...current, parentid: Number(event.target.value) }))} /></label>
              <label className={styles["admin-field"]}>排序<input type="number" value={departmentForm.order} onChange={(event) => setDepartmentForm((current) => ({ ...current, order: Number(event.target.value) }))} /></label>
              <label className={styles["admin-field"]}>英文名<input value={departmentForm.name_en} onChange={(event) => setDepartmentForm((current) => ({ ...current, name_en: event.target.value }))} /></label>
            </div>
            <div className={styles["form-actions"]}>
              <button className={cx(styles["admin-primary-action"], styles["full-width"])} disabled={saving} onClick={() => void saveDepartment()}>
                {editingDepartmentId ? "保存部门" : "创建部门"}
              </button>
              {editingDepartmentId && <button className={styles["table-action"]} disabled={saving} onClick={resetDepartmentForm}>取消</button>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
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
  return <><AdminHeader title="权限设置" description="罗列所有人员，并为每个人选择权限组" action={<SearchBox value={search} onChange={setSearch} placeholder="搜索姓名、工号、班组或首字母" />} />{message && <div className={cx(styles["admin-message"])}>{message}</div>}<div className={cx(styles["permission-summary-grid"])}>{counts.map((item) => <article key={item.value} className={cx(styles["admin-panel"], styles["permission-summary-card"])}><div className={cx(styles["settings-icon"])}><ShieldCheck /></div><div><strong>{item.count}</strong><span>{item.label}</span></div><p>{item.description}</p></article>)}</div><section className={cx(styles["admin-panel"], styles["permission-panel"])}>{loading ? <LoadingTable /> : error ? <AdminError message={error} retry={() => void reload()} /> : <div className={cx(styles["table-wrap"])}><table><thead><tr><th>人员</th><th>工号</th><th>班组</th><th>当前任务</th><th>权限组</th></tr></thead><tbody>{filtered.map((person) => <tr key={person.id}><td><div className={cx(styles["person-cell"])}><span>{person.name.slice(0,1)}</span><strong>{person.name}</strong></div></td><td>{person.employeeNo}</td><td>{person.teamName}</td><td>{person.activeAssignmentCount} 道</td><td><div className={cx(styles["permission-select-cell"])}>{permissionOptions.map((option) => <button key={option.value} className={person.permissionGroup === option.value ? styles.selected : undefined} disabled={savingId === person.id} onClick={() => void updatePermission(person, option.value)}>{savingId === person.id && person.permissionGroup !== option.value ? <span className="spinner small" /> : option.label}</button>)}</div></td></tr>)}{!filtered.length && <tr><td colSpan={5}>没有匹配的人员。</td></tr>}</tbody></table></div>}</section></>;
}

const accountRoleOptions: Array<{ value: AccountRole; label: string }> = permissionOptions.map((option) => ({
  value: option.value,
  label: option.label,
}));
const emptyAccountForm = { username: "", name: "", password: "", enabled: true, roles: ["worker"] as AccountRole[] };

function normalizeAccountRoles(roles: AccountRole[], role: AccountRole) {
  return roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role];
}

export function AccountsPage() {
  const [keyword, setKeyword] = useState("");
  const [form, setForm] = useState(emptyAccountForm);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [resetPasswordById, setResetPasswordById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const load = useCallback(() => AuthService.getAdminAccounts(keyword.trim()), [keyword]);
  const { data: accounts = [], loading, error, reload } = useAsyncResource<AdminAccount[]>(load);
  const createAccount = async () => {
    const username = form.username.trim();
    const name = form.name.trim();
    if (!username || !name || !form.password || form.roles.length === 0) {
      setMessage("请填写账号、姓名、初始密码并至少选择一个权限组");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await AuthService.createAdminAccount({ username, name, password: form.password, roles: form.roles, enabled: form.enabled });
      setForm(emptyAccountForm);
      setMessage(`已创建账号 ${username}`);
      await reload();
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const updateAccount = async (account: AdminAccount, input: { roles?: AccountRole[]; enabled?: boolean }) => {
    setSavingId(account.id);
    setMessage("");
    try {
      await AuthService.updateAdminAccount(account.id, input);
      setMessage(`已更新账号 ${account.username}`);
      await reload();
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSavingId("");
    }
  };
  const resetPassword = async (account: AdminAccount) => {
    const password = resetPasswordById[account.id] || "";
    if (!password) {
      setMessage("请输入新密码");
      return;
    }
    setSavingId(account.id);
    setMessage("");
    try {
      await AuthService.resetAdminAccountPassword(account.id, password);
      setResetPasswordById((current) => ({ ...current, [account.id]: "" }));
      setMessage(`已重置 ${account.username} 的密码`);
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSavingId("");
    }
  };
  return <><AdminHeader title="账号管理" description="管理员创建网页登录账号，外部不开放注册" action={<div className={cx(styles["admin-inline-actions"])}><SearchBox value={keyword} onChange={setKeyword} placeholder="搜索账号或姓名" /><button className={cx(styles["admin-primary-action"])} onClick={() => void reload()}><Search />搜索</button></div>} />{message && <div className={cx(styles["admin-message"])}>{message}</div>}<div className={cx(styles["account-admin-grid"])}><section className={cx(styles["admin-panel"], styles["settings-card"])}><div className={cx(styles["settings-icon"])}><UserCog /></div><h2>创建账号</h2><label className={cx(styles["admin-field"])}>账号<input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="例如 zhangsan" /></label><label className={cx(styles["admin-field"])}>姓名<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="员工姓名" /></label><label className={cx(styles["admin-field"])}>初始密码<input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="由管理员设置" /></label><div className={cx(styles["admin-field"])}><span>权限组</span><div className={cx(styles["permission-select-cell"])}>{accountRoleOptions.map((option) => <button key={option.value} className={form.roles.includes(option.value) ? styles.selected : undefined} type="button" onClick={() => setForm((current) => ({ ...current, roles: normalizeAccountRoles(current.roles, option.value) }))}>{option.label}</button>)}</div></div><label className={cx(styles["admin-toggle-row"])}><input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />启用账号</label><button className={cx(styles["admin-primary-action"], styles["full-width"])} disabled={saving} onClick={() => void createAccount()}><UserPlus />创建账号</button></section><section className={cx(styles["admin-panel"], styles["account-list-panel"])}>{loading ? <LoadingTable /> : error ? <AdminError message={error} retry={() => void reload()} /> : <div className={cx(styles["table-wrap"])}><table><thead><tr><th>账号</th><th>姓名</th><th>权限组</th><th>状态</th><th>最近登录</th><th>重置密码</th><th>操作</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><strong>{account.username}</strong></td><td>{account.name}</td><td><div className={cx(styles["permission-select-cell"])}>{accountRoleOptions.map((option) => <button key={option.value} className={account.roles.includes(option.value) ? styles.selected : undefined} disabled={savingId === account.id} onClick={() => void updateAccount(account, { roles: normalizeAccountRoles(account.roles, option.value) })}>{option.label}</button>)}</div></td><td><span className={cx(styles["admin-status"], account.enabled ? styles.completed : styles.paused)}>{account.enabled ? "已启用" : "已停用"}</span></td><td>{account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString("zh-CN") : "未登录"}</td><td><div className={cx(styles["reset-password-cell"])}><input type="password" value={resetPasswordById[account.id] || ""} onChange={(event) => setResetPasswordById((current) => ({ ...current, [account.id]: event.target.value }))} placeholder="新密码" /><button className={cx(styles["table-action"])} disabled={savingId === account.id} onClick={() => void resetPassword(account)}><KeyRound />重置</button></div></td><td><button className={cx(styles["table-action"], account.enabled && styles["danger-action"])} disabled={savingId === account.id} onClick={() => void updateAccount(account, { enabled: !account.enabled })}><Power />{account.enabled ? "停用" : "启用"}</button></td></tr>)}{!accounts.length && <tr><td colSpan={7}>没有匹配的账号。</td></tr>}</tbody></table></div>}</section></div></>;
}

export function ExceptionsPage() {
  const canReviewExceptions = useWorkReportStore((state) => !!state.capabilities?.canReviewExceptions);
  const load = useCallback(() => workReportRepository.getExceptions(), []);
  const { data: items = [], loading, error, reload } = useAsyncResource<ProductionException[]>(load);
  const resolve = async (id: string) => {
    if (!canReviewExceptions) return;
    await workReportRepository.resolveException(id);
    await reload();
  };
  if (loading) return <><AdminHeader title="异常审核" description="集中处理超时、重复报工和信息缺失" /><LoadingTable /></>;
  if (error) return <><AdminHeader title="异常审核" description="集中处理超时、重复报工和信息缺失" /><AdminError message={error} retry={() => void reload()} /></>;
  return <><AdminHeader title="异常审核" description="集中处理超时、重复报工和信息缺失" /><div className={cx(styles["exception-list"])}>{items.map((item) => <article key={item.id} className={styles[item.status]}><div className={cx(styles["exception-icon"])}><AlertTriangle /></div><div><div><h2>{item.title}</h2><span>{item.status === "open" ? "待处理" : "已处理"}</span></div><p>{item.detail}</p><small>{item.orderNo} · {new Date(item.createdAt).toLocaleString("zh-CN")}</small></div>{canReviewExceptions && item.status === "open" && <button onClick={() => void resolve(item.id)}>标记为已处理</button>}</article>)}</div></>;
}

export function SettingsPage() {
  const [resetting, setResetting] = useState(false); const [message, setMessage] = useState("");
  const reset = async (scenario: "assigned" | "running" | "paused") => { setResetting(true); setMessage(""); try { await workReportRepository.resetDemo?.(scenario); setMessage("演示数据已重置，移动端刷新后生效"); } catch (error) { setMessage(getErrorMessage(error)); } finally { setResetting(false); } };
  return <><AdminHeader title="系统设置" description="接口环境、统计口径与演示数据" /><div className={cx(styles["settings-grid"])}><section className={cx(styles["admin-panel"], styles["settings-card"])}><div className={cx(styles["settings-icon"])}><Wrench /></div><h2>业务 API</h2><dl><div><dt>当前模式</dt><dd><span className={isMockMode ? styles["mode-mock"] : styles["mode-real"]}>{isMockMode ? "Mock 演示" : "真实接口"}</span></dd></div><div><dt>业务服务地址</dt><dd>{import.meta.env.VITE_API_BASE_URL || "未配置"}</dd></div><div><dt>认证服务</dt><dd>统一使用 VITE_API_BASE_URL</dd></div></dl></section><section className={cx(styles["admin-panel"], styles["settings-card"])}><div className={cx(styles["settings-icon"], styles["orange"])}><RefreshCw /></div><h2>重置演示场景</h2><p>快速切换当前工序状态，用于演示完整报工流程。</p><div className={cx(styles["scenario-buttons"])}><button disabled={resetting} onClick={() => void reset("assigned")}>待开始</button><button disabled={resetting} onClick={() => void reset("running")}>进行中</button><button disabled={resetting} onClick={() => void reset("paused")}>已暂停</button></div>{message && <div className={cx(styles["success-message"])}><CheckCircle2 />{message}</div>}</section><section className={cx(styles["admin-panel"], styles["settings-card"])}><div className={cx(styles["settings-icon"])}><Clock3 /></div><h2>统计口径</h2><p>v1：领取或分配后即计入计划工时。</p><p>后续完整报工版本再按实际开始、暂停、完工记录计算有效工时。</p></section></div></>;
}

function SearchBox({ value, onChange, placeholder = "搜索工单、产品或人员" }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className={cx(styles["search-box"])}><Search /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>; }
