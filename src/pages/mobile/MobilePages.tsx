import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Box, CalendarClock, Camera, CheckCircle2, ChevronRight, CircleAlert, ClipboardList,
  Clock3, FileText, Hash, LogOut, MessageSquareText, PackageCheck, Pause, Play, RefreshCw,
  RotateCcw, Search, Target, Trash2, UsersRound, X,
} from "lucide-react";
import { useLogout } from "@/hooks/useLogout";
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { canSwitchFromAssignment, canWorkerRemoveAssignment, formatDuration, getSessionElapsedSeconds, statusLabel, type ClaimableOperation, type ClaimablePart, type ClaimableProduct, type OperationAssignment } from "@/domain/work-report";
import { createImagePreviews, filesToCompletionPhotos, revokeImagePreviews, selectImageFiles, type ImagePreview } from "@/utils/imageFiles";
import { getErrorMessage } from "@/utils/errors";
import { useNavigate } from "react-router-dom";

function LoadingState() { return <div className="page-state"><span className="spinner" /><p>正在加载报工数据...</p></div>; }
function ErrorBanner({ message, retry }: { message: string; retry?: () => void }) { return <div className="error-banner"><CircleAlert /><span>{message}</span>{retry && <button onClick={retry}>重试</button>}</div>; }

function StatusPill({ status }: { status: OperationAssignment["status"] }) {
  return <span className={`status-pill status-${status}`}><span />{statusLabel[status]}</span>;
}

type ClaimOperationFilter = "all" | "available" | "claimed";
type ClaimPanelView = "search" | "recent";
type ClaimRecentDateFilter = "today" | "all";
type OperationListRange = "today" | "7" | "30" | "all";
const claimOperationFilterOptions: Array<[ClaimOperationFilter, string]> = [["all", "全部"], ["available", "可领取"], ["claimed", "已满"]];
const claimRecentStatusOptions: Array<[Exclude<ClaimOperationFilter, "claimed">, string]> = [["available", "可领取"], ["all", "全部"]];
const operationListRangeOptions: Array<[OperationListRange, string]> = [["today", "今天"], ["7", "最近7天"], ["30", "最近一个月"], ["all", "全部"]];
const operationListPageSize = 6;
const requireAuth = import.meta.env.VITE_REQUIRE_AUTH !== "false";
const getTimeValue = (date?: string) => date ? new Date(date).getTime() : 0;
const getAssignmentSortTime = (item: OperationAssignment) => getTimeValue(item.claimedAt) || getTimeValue(item.plannedStart);
const isSameLocalDay = (left?: string | number | Date, right: string | number | Date = new Date()) => {
  if (!left) return false;
  const a = new Date(left);
  const b = new Date(right);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};
const isAssignmentInRange = (item: OperationAssignment, range: OperationListRange) => {
  const time = getAssignmentSortTime(item);
  if (!time) return range === "all";
  if (range === "today") return isSameLocalDay(time);
  if (range === "all") return true;
  return time >= Date.now() - Number(range) * 24 * 3600_000;
};

function BottomSheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <div className="sheet-handle" /><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭"><X /></button></header>{children}
    </section>
  </div>;
}

export function CurrentOperationPage() {
  const { current, nextCandidates, switchCandidates, dayCompleted, currentLoading, actionLoading, error, loadCurrent, start, pause, resume, complete, selectNext, switchCurrent, clearError } = useWorkReportStore();
  const [tick, setTick] = useState(Date.now());
  const [showNote, setShowNote] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showNext, setShowNext] = useState(false);
  useEffect(() => { void loadCurrent(); }, [loadCurrent]);
  useEffect(() => { const timer = window.setInterval(() => setTick(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (nextCandidates.length > 1) setShowNext(true); }, [nextCandidates]);
  const elapsed = useMemo(() => formatDuration(getSessionElapsedSeconds(current?.session, tick)), [current?.session, tick]);
  if (currentLoading && !current) return <LoadingState />;
  if (!current) return dayCompleted ? <DayCompletedPage onRefresh={() => void loadCurrent()} /> : <NoCurrentOperationPage candidates={switchCandidates} onRefresh={() => void loadCurrent()} onSelect={(assignment) => void switchCurrent(assignment)} loading={actionLoading} />;
  const primary = current.status === "completed" && nextCandidates.length > 0 ? { text: "选择下一工序", icon: ClipboardList, action: () => setShowNext(true) } : current.status === "assigned" ? { text: "开始作业", icon: Play, action: () => void start() } : current.status === "paused" ? { text: "恢复作业", icon: RotateCcw, action: () => void resume() } : { text: "暂停作业", icon: Pause, action: () => setShowPause(true) };
  const PrimaryIcon = primary.icon;
  const canSwitch = canSwitchFromAssignment(current) && switchCandidates.length > 0;
  return <div className="current-page">
    <header className="worker-header"><div className="worker-avatar">张</div><div><strong>张师傅</strong><span>白班（08:00-20:00）</span></div><StatusPill status={current.status} /></header>
    {error && <ErrorBanner message={error} retry={() => { clearError(); void loadCurrent(); }} />}
    <section className="operation-info" aria-label="当前工序信息">
      <InfoRow icon={ClipboardList} label="工单号" value={current.orderNo} strong />
      <InfoRow icon={Box} label="产品名称" value={current.productName} strong />
      <InfoRow icon={Hash} label="产品编号" value={current.productCode} />
      <InfoRow icon={PackageCheck} label="部件编号" value={current.partCode} />
      <div className="info-row operation-row"><div className="info-icon"><Target /></div><div className="info-copy"><span>当前工序</span><strong>{current.operationName}</strong><button className="note-button" onClick={() => setShowNote(true)}><MessageSquareText />查看工序备注<ChevronRight /></button></div></div>
      <InfoRow icon={PackageCheck} label="计划数量" value={`${current.plannedQuantity} 件`} strong />
      <InfoRow icon={UsersRound} label="协作人员" value={current.collaborators.join(" / ")} />
      <InfoRow icon={Clock3} label="已用时间" value={elapsed} timer />
    </section>
    <div className="action-dock">
      <button className="primary-action" disabled={actionLoading} onClick={primary.action}><PrimaryIcon />{actionLoading ? "正在处理..." : primary.text}</button>
      {canSwitch && <button className="secondary-action switch-action" disabled={actionLoading} onClick={() => setShowNext(true)}><ClipboardList />切换工序</button>}
      {current.status !== "assigned" && current.status !== "completed" && <button className="secondary-action" disabled={actionLoading} onClick={() => setShowComplete(true)}><Camera />结束并拍照</button>}
    </div>
    {showNote && <BottomSheet title="工序备注" onClose={() => setShowNote(false)}><div className="note-content"><FileText /><p>{current.operationNote}</p></div><button className="primary-button" onClick={() => setShowNote(false)}>我知道了</button></BottomSheet>}
    {showPause && <PauseSheet onClose={() => setShowPause(false)} onConfirm={async (reason) => { await pause(reason); setShowPause(false); }} loading={actionLoading} />}
    {showComplete && <CompleteSheet onClose={() => setShowComplete(false)} loading={actionLoading} onConfirm={async (input) => { await complete(input); setShowComplete(false); }} />}
    {showNext && (nextCandidates.length > 0 || switchCandidates.length > 0) && <NextOperationSheet title={nextCandidates.length > 0 ? "选择下一工序" : "切换工序"} help={nextCandidates.length > 0 ? `今日还有 ${nextCandidates.length} 道未完成工序，请选择接下来要做的工序。` : "当前工序已暂停或尚未开始，可以切换到其他待开始工序。"} candidates={nextCandidates.length > 0 ? nextCandidates : switchCandidates} onClose={() => setShowNext(false)} onSelect={(assignment) => { if (nextCandidates.length > 0) selectNext(assignment); else void switchCurrent(assignment); setShowNext(false); }} />}
  </div>;
}

function NoCurrentOperationPage({ candidates, onRefresh, onSelect, loading }: { candidates: OperationAssignment[]; onRefresh: () => void; onSelect: (assignment: OperationAssignment) => void; loading: boolean }) {
  if (!candidates.length) return <div className="empty-state"><PackageCheck /><h1>当前没有待报工工序</h1><p>新的工序分配或领取后会显示在这里。</p><button className="primary-button" onClick={onRefresh}><RefreshCw />刷新工序</button></div>;
  return <div className="standard-page no-current-page"><PageHeader title="选择工序开始" subtitle="当前没有正在进行的工序，请先选择一道待开始工序" /><div className="next-operation-list">{candidates.map((item) => <button key={item.id} disabled={loading} onClick={() => onSelect(item)}><div><span>{item.orderNo}</span><em>{item.source === "self_claimed" ? "自主领取" : "后台分配"}</em></div><strong>{item.operationName}</strong><p>{item.productName} · {item.productCode}</p><p>{item.partName || item.partCode} · {item.partCode}</p><small><UsersRound />{item.collaborators.join(" / ")}</small><ChevronRight /></button>)}</div><button className="ghost-button refresh-wide" onClick={onRefresh}><RefreshCw />刷新工序</button></div>;
}

function DayCompletedPage({ onRefresh }: { onRefresh: () => void }) {
  return <div className="day-completed"><div className="completion-check"><CheckCircle2 /></div><h1>今日工序已全部完成</h1><p>辛苦了！今天安排的报工任务均已完成。</p><div className="completion-summary"><span>完成状态</span><strong>全部完成</strong></div><button className="ghost-button" onClick={onRefresh}><RefreshCw />刷新工序</button></div>;
}

function NextOperationSheet({ title, help, candidates, onClose, onSelect }: { title: string; help: string; candidates: OperationAssignment[]; onClose: () => void; onSelect: (assignment: OperationAssignment) => void }) {
  return <BottomSheet title={title} onClose={onClose}><p className="sheet-help">{help}</p><div className="next-operation-list">{candidates.map((item) => <button key={item.id} onClick={() => onSelect(item)}><div><span>{item.orderNo}</span><em>{new Date(item.plannedStart).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</em></div><strong>{item.operationName}</strong><p>{item.productName} · {item.productCode}</p><p>{item.partName || item.partCode} · {item.partCode}</p><small><UsersRound />{item.collaborators.join(" / ")}</small><small className="operation-elapsed"><Clock3 />已用时长 {formatDuration(getSessionElapsedSeconds(item.session))}</small><ChevronRight /></button>)}</div></BottomSheet>;
}

function InfoRow({ icon: Icon, label, value, strong, timer }: { icon: typeof Box; label: string; value: string; strong?: boolean; timer?: boolean }) {
  return <div className="info-row"><div className="info-icon"><Icon /></div><div className="info-copy"><span>{label}</span><strong className={`${strong ? "emphasis" : ""} ${timer ? "timer-value" : ""}`}>{value}</strong></div></div>;
}

function PauseSheet({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: (reason?: string) => Promise<void>; loading: boolean }) {
  const [reason, setReason] = useState("等待质检");
  return <BottomSheet title="确认暂停作业？" onClose={onClose}><p className="sheet-help">暂停期间不会计入本次作业工时。</p><label className="field-label">暂停原因（可选）<select value={reason} onChange={(e) => setReason(e.target.value)}><option>等待质检</option><option>设备调整</option><option>等待物料</option><option>临时离岗</option></select></label><div className="sheet-actions"><button className="ghost-button" onClick={onClose}>取消</button><button className="primary-button" disabled={loading} onClick={() => void onConfirm(reason).catch(() => undefined)}><Pause />确认暂停</button></div></BottomSheet>;
}

function CompleteSheet({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: (input: { photos: Array<{ name: string; url: string }>; completedQuantity?: number; note?: string }) => Promise<void>; loading: boolean }) {
  const [photos, setPhotos] = useState<ImagePreview[]>([]);
  const photosRef = useRef<ImagePreview[]>([]);
  const [fileError, setFileError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => {
    mountedRef.current = false;
    revokeImagePreviews(photosRef.current);
  }, []);
  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const result = selectImageFiles(event.target.files || [], photos.length);
    setPhotos((items) => [...items, ...createImagePreviews(result.accepted)]);
    setFileError(result.error || "");
    event.target.value = "";
  };
  const removePhoto = (index: number) => setPhotos((items) => {
    const photo = items[index];
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    return items.filter((_, itemIndex) => itemIndex !== index);
  });
  const submit = async () => {
    if (!photos.length || preparing || loading) return;
    setPreparing(true);
    setFileError("");
    try {
      const encoded = await filesToCompletionPhotos(photos.map(({ file }) => file));
      await onConfirm({ photos: encoded, completedQuantity: quantity ? Number(quantity) : undefined, note: note || undefined });
    } catch (error) {
      if (mountedRef.current) setFileError(getErrorMessage(error));
    } finally {
      if (mountedRef.current) setPreparing(false);
    }
  };
  return <BottomSheet title="完成报工" onClose={onClose}><div className="completion-step"><div className="step-title"><span>1</span><strong>拍摄完工照片</strong><em>必填</em></div><input ref={fileRef} hidden type="file" accept="image/*" capture="environment" multiple onChange={onFiles} /><button className="photo-picker" onClick={() => fileRef.current?.click()}><Camera /><span>{photos.length ? "继续添加照片" : "拍照或选择照片"}</span></button>{photos.length > 0 && <div className="photo-grid">{photos.map((photo, index) => <div key={photo.previewUrl}><img src={photo.previewUrl} alt={`完工照片 ${index + 1}`} /><button aria-label="删除照片" onClick={() => removePhoto(index)}><X /></button></div>)}</div>}{fileError && <p className="validation-hint">{fileError}</p>}</div><div className="completion-step"><div className="step-title"><span>2</span><strong>补充完工信息</strong><small>选填</small></div><label className="field-label">本次完成数量<input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} placeholder="请输入数量" /></label><label className="field-label">备注<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="填写异常、质量或交接说明" rows={3} /></label></div><button className="primary-button submit-completion" disabled={!photos.length || loading || preparing} onClick={() => void submit()}><CheckCircle2 />{loading || preparing ? "正在提交..." : "确认完成报工"}</button>{!photos.length && <p className="validation-hint">请至少添加一张完工照片</p>}</BottomSheet>;
}

export function OperationsPage() {
  const {
    assignments, assignmentsLoading, actionLoading, error,
    loadAssignments, removeClaimedAssignment, clearError,
  } = useWorkReportStore();
  const [range, setRange] = useState<OperationListRange>("today");
  const [visibleCount, setVisibleCount] = useState(operationListPageSize);
  const loaderRef = useRef<HTMLDivElement>(null);
  useEffect(() => { void loadAssignments(); }, [loadAssignments]);
  useEffect(() => { setVisibleCount(operationListPageSize); }, [range]);
  const filteredAssignments = useMemo(() => assignments
    .filter((item) => item.status !== "cancelled" && item.status !== "completed" && isAssignmentInRange(item, range))
    .sort((a, b) => getAssignmentSortTime(b) - getAssignmentSortTime(a)), [assignments, range]);
  const visibleAssignments = filteredAssignments.slice(0, visibleCount);
  const hasMore = visibleCount < filteredAssignments.length;
  useEffect(() => {
    const node = loaderRef.current;
    if (!node || !hasMore) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((value) => Math.min(value + operationListPageSize, filteredAssignments.length));
      }
    }, { rootMargin: "160px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredAssignments.length, hasMore]);
  return <div className="standard-page">
    <PageHeader title="工序清单" subtitle="查看自己已领取和已分配的工序" />
    {error && <ErrorBanner message={error} retry={() => { clearError(); void loadAssignments(); }} />}
    <section className="claimed-section" aria-label="工序清单">
      <div className="section-heading"><div><h2>我的工序</h2><p>v1 仅展示领取结果，报工状态流转将在后续版本开放。</p></div><button className="ghost-button" disabled={assignmentsLoading} onClick={() => void loadAssignments()}><RefreshCw />刷新</button></div>
      <div className="history-filter operation-range-filter" aria-label="工序清单时间筛选"><div><strong>时间范围</strong><span>共 {filteredAssignments.length} 条</span></div><div>{operationListRangeOptions.map(([key, label]) => <button key={key} className={range === key ? "active" : ""} onClick={() => setRange(key)}>{label}</button>)}</div></div>
      {assignmentsLoading ? <LoadingState /> : <><div className="operation-list">{visibleAssignments.map((item) => <OperationCard key={item.id} item={item} removing={actionLoading} onRemove={() => void removeClaimedAssignment(item.id)} v1Status />)}{!visibleAssignments.length && <div className="empty-inline">当前时间范围暂无已领取工序。</div>}</div>{filteredAssignments.length > 0 && <div ref={loaderRef} className="lazy-load-state">{hasMore ? "继续下滑加载更多" : "已显示全部"}</div>}</>}
    </section>
  </div>;
}

export function ClaimOperationsPage() {
  const {
    actionLoading, claimLoading, claimProducts, claimParts, claimOperations, recentClaimOperations, error,
    searchClaimableProducts, loadRecentClaimableOperations, loadClaimableParts, loadClaimableOperations, claimOperation, clearError,
  } = useWorkReportStore();
  const [claimed, setClaimed] = useState<OperationAssignment | null>(null);
  const navigate = useNavigate();
  useEffect(() => { void loadRecentClaimableOperations(); }, [loadRecentClaimableOperations]);
  return <div className="standard-page claim-page">
    <PageHeader title="领取工序" subtitle="搜索产品编号，选择部件后领取自己的工序" />
    {error && <ErrorBanner message={error} retry={() => { clearError(); void loadRecentClaimableOperations(); }} />}
    <ClaimOperationsPanel mode="v1" loading={claimLoading || actionLoading} products={claimProducts} parts={claimParts} operations={claimOperations} recentOperations={recentClaimOperations} claimed={claimed} onSearch={searchClaimableProducts} onLoadRecent={loadRecentClaimableOperations} onLoadParts={loadClaimableParts} onLoadOperations={loadClaimableOperations} onClaim={async (operationId) => { const assignment = await claimOperation(operationId); if (assignment) setClaimed(assignment); await loadRecentClaimableOperations(); }} onContinue={() => setClaimed(null)} onViewClaimed={() => navigate("/work/operations", { replace: true })} />
  </div>;
}

function OperationCard({ item, removing, onRemove, v1Status = false }: { item: OperationAssignment; removing: boolean; onRemove: () => void; v1Status?: boolean }) {
  return <article className="operation-card"><div>{v1Status ? <span className="status-pill status-assigned"><span />已领取</span> : <StatusPill status={item.status} />}<span className="order-number">{item.orderNo}</span></div><h2>{item.operationName}</h2><p>{item.productName} · {item.productCode}</p><p>{item.partName || item.partCode} · {item.partCode}</p><div className="assignment-source"><span>{item.source === "self_claimed" ? "自主领取" : item.source === "leader_imported" ? "小组长导入" : "后台分配"}</span>{item.assignedBy && <small>{item.assignedBy.name}</small>}</div><dl><div><dt>计划数量</dt><dd>{item.plannedQuantity} 件</dd></div><div><dt>计划工时</dt><dd>{item.estimatedHours ? `${item.estimatedHours} 小时` : "未填写"}</dd></div></dl>{canWorkerRemoveAssignment(item) && <button className="remove-claim-button" disabled={removing} onClick={onRemove}><Trash2 />取消领取</button>}</article>;
}

function ClaimOperationsPanel({
  mode = "v2", loading, products, parts, operations, recentOperations = [], claimed, onSearch, onLoadRecent, onLoadParts, onLoadOperations, onClaim, onGoStart, onContinue, onViewClaimed,
}: {
  mode?: "v1" | "v2";
  loading: boolean;
  products: ClaimableProduct[];
  parts: ClaimablePart[];
  operations: ClaimableOperation[];
  recentOperations?: ClaimableOperation[];
  claimed: OperationAssignment | null;
  onSearch: (keyword: string) => Promise<void>;
  onLoadRecent?: () => Promise<void>;
  onLoadParts: (productId: string) => Promise<void>;
  onLoadOperations: (partId: string) => Promise<void>;
  onClaim: (operationId: string) => Promise<void>;
  onGoStart?: (assignment: OperationAssignment) => Promise<void>;
  onContinue: () => void;
  onViewClaimed?: () => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ClaimableProduct | null>(null);
  const [selectedPart, setSelectedPart] = useState<ClaimablePart | null>(null);
  const [view, setView] = useState<ClaimPanelView>("search");
  const [filter, setFilter] = useState<ClaimOperationFilter>("all");
  const [recentDate, setRecentDate] = useState<ClaimRecentDateFilter>("today");
  const [recentStatus, setRecentStatus] = useState<Exclude<ClaimOperationFilter, "claimed">>("available");
  const filteredSearchOperations = operations.filter((item) => filter === "all" ? true : item.status === filter);
  const filteredRecentOperations = recentOperations.filter((item) => {
    const matchesDate = recentDate === "all" ? true : isSameLocalDay(item.plannedStart);
    const matchesStatus = recentStatus === "all" ? true : item.status === "available";
    return matchesDate && matchesStatus;
  });
  const search = async () => {
    setSelectedProduct(null);
    setSelectedPart(null);
    await onSearch(keyword);
  };
  const loadRecent = async () => { await onLoadRecent?.(); };
  const renderOperation = (item: ClaimableOperation) => <article key={item.id} className={item.status !== "available" ? "disabled" : ""}><div><strong>{item.operationCode} · {item.operationNo && `[${item.operationNo}] `}{item.operationName}</strong><span className={`claim-status-${item.status}`}>{item.status === "available" ? "可领取" : item.status === "claimed" ? "已满" : "已关闭"}</span></div><p>{item.productCode} · {item.partCode}</p><p>{item.operationNote}</p><dl><div><dt>数量</dt><dd>{item.plannedQuantity} 件</dd></div><div><dt>工时</dt><dd>{item.estimatedHours} 小时</dd></div><div><dt>已领</dt><dd>{item.maxClaimWorkers ? `${item.claimedWorkers}/${item.maxClaimWorkers} 人` : `${item.claimedWorkers} 人`}</dd></div></dl><button className="primary-button" disabled={loading || item.status !== "available"} onClick={() => void onClaim(item.id)}>{item.status === "claimed" ? "人数已满" : item.status === "closed" ? "已关闭" : "领取工序"}</button></article>;
  if (claimed) return <section className="claim-success"><CheckCircle2 /><h2>{mode === "v1" ? "已领取工序" : "已加入工序清单"}</h2><p>{claimed.productCode} · {claimed.partCode}</p><strong>{claimed.operationName}</strong><div>{mode === "v1" ? <button className="primary-button" onClick={onViewClaimed}><ClipboardList />查看已领取</button> : <button className="primary-button" onClick={() => void onGoStart?.(claimed)}><Play />去开始</button>}<button className="ghost-button" onClick={onContinue}>继续领取</button></div></section>;
  return <section className="claim-panel">
    <div className="claim-view-tabs" aria-label="领取工序视图切换"><button className={view === "search" ? "active" : ""} onClick={() => setView("search")}>搜索领取</button><button className={view === "recent" ? "active" : ""} onClick={() => setView("recent")}>查看最近</button></div>
    {loading && <div className="claim-loading"><span className="spinner" />正在读取...</div>}
    {view === "search" && <section className="claim-workspace claim-search-workspace" aria-label="搜索结果">
      <div className="section-heading"><div><h2>搜索结果</h2><p>按产品、部件、工序逐级选择。</p></div></div>
      <label className="claim-search"><Search /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="输入产品编号搜索" /><button disabled={loading || !keyword.trim()} onClick={() => void search()}>搜索</button></label>
      <div className="claim-filter" aria-label="领取状态筛选">{claimOperationFilterOptions.map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <div className="claim-columns">
        <div><h3>1 产品编号</h3>{selectedProduct ? <button key={selectedProduct.id} className="selected" onClick={() => { setSelectedProduct(null); setSelectedPart(null); }}><strong>{selectedProduct.productCode}</strong><span>{selectedProduct.productName}</span><small>{selectedProduct.orderNo} · 剩余 {selectedProduct.remainingQuantity} 件</small><span className="cancel-select">点击取消选择</span></button> : products.map((item) => <button key={item.id} onClick={() => { setSelectedProduct(item); setSelectedPart(null); void onLoadParts(item.id); }}><strong>{item.productCode}</strong><span>{item.productName}</span><small>{item.orderNo} · 剩余 {item.remainingQuantity} 件</small></button>)}</div>
        <div><h3>2 部件编号</h3>{selectedPart ? <button key={selectedPart.id} className="selected" onClick={() => { setSelectedPart(null); }}><strong>{selectedPart.partCode}</strong><span>{selectedPart.partNo && `[${selectedPart.partNo}] `}{selectedPart.partName}</span><small>{selectedPart.operationCount} 道工序 · 剩余 {selectedPart.remainingQuantity} 件</small><span className="cancel-select">点击取消选择</span></button> : parts.map((item) => <button key={item.id} onClick={() => { setSelectedPart(item); void onLoadOperations(item.id); }}><strong>{item.partCode}</strong><span>{item.partNo && `[${item.partNo}] `}{item.partName}</span><small>{item.operationCount} 道工序 · 剩余 {item.remainingQuantity} 件</small></button>)}</div>
      </div>
      <div className="claim-operation-list" aria-label="搜索工序结果"><h3>3 工序</h3>{selectedPart ? filteredSearchOperations.map((item) => <article key={item.id} className={item.status !== "available" ? "disabled" : ""}><div><strong>{item.operationCode} · {item.operationNo && `[${item.operationNo}] `}{item.operationName}</strong><span className={`claim-status-${item.status}`}>{item.status === "available" ? "可领取" : item.status === "claimed" ? "已满" : "已关闭"}</span></div><p>{item.productCode} · {item.partCode}</p><p>{item.operationNote}</p><dl><div><dt>数量</dt><dd>{item.plannedQuantity} 件</dd></div><div><dt>工时</dt><dd>{item.estimatedHours} 小时</dd></div><div><dt>已领</dt><dd>{item.maxClaimWorkers ? `${item.claimedWorkers}/${item.maxClaimWorkers} 人` : `${item.claimedWorkers} 人`}</dd></div></dl><button className="primary-button" disabled={loading || item.status !== "available"} onClick={() => void onClaim(item.id)}>{item.status === "claimed" ? "人数已满" : item.status === "closed" ? "已关闭" : "领取工序"}</button></article>) : <div className="empty-inline">请先搜索并选择部件查看工序。</div>}{selectedPart && !filteredSearchOperations.length && <div className="empty-inline">当前筛选下暂无工序</div>}</div>
    </section>}
    {view === "recent" && <section className="claim-workspace claim-recent-workspace" aria-label="最近可以领取的工序">
      <div className="section-heading"><div><h2>最近可以领取的工序</h2><p>不影响上方搜索结果。</p></div><button className="ghost-button" disabled={loading} onClick={() => void loadRecent()}><RefreshCw />刷新</button></div>
      <div className="claim-filter-row"><div className="claim-filter compact-filter" aria-label="最近工序日期筛选">{([["today", "当日"], ["all", "全部"]] as const).map(([key, label]) => <button key={key} className={recentDate === key ? "active" : ""} onClick={() => setRecentDate(key)}>{label}</button>)}</div><div className="claim-filter compact-filter" aria-label="最近工序状态筛选">{claimRecentStatusOptions.map(([key, label]) => <button key={key} className={recentStatus === key ? "active" : ""} onClick={() => setRecentStatus(key)}>{label}</button>)}</div></div>
      <div className="recent-operation-list">{filteredRecentOperations.map(renderOperation)}</div>
      {!filteredRecentOperations.length && <div className="empty-inline">暂无最近工序，可点击刷新或搜索产品编号查看。</div>}
    </section>}
  </section>;
}

export function StatsPage() {
  const { statistics, statisticsLoading, loadStatistics } = useWorkReportStore();
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  useEffect(() => { void loadStatistics(period); }, [loadStatistics, period]);
  const maxTrendHours = Math.max(10, ...(statistics?.trend.map((item) => item.hours) || []));
  const trendTitle = period === "month" ? "每周工时" : "每日工时";
  const trendSubtitle = period === "month" ? "本月按周汇总" : "本周";
  return <div className="standard-page"><PageHeader title="我的统计" subtitle="已领取工序按计划工时汇总" /><div className="segmented">{([['day','今日'],['week','本周'],['month','本月']] as const).map(([key,label]) => <button key={key} className={period===key?'active':''} onClick={()=>setPeriod(key)}>{label}</button>)}</div>{statisticsLoading || !statistics ? <LoadingState /> : <><section className="stat-hero"><span>累计工时</span><strong>{statistics.totalHours.toFixed(1)}</strong><em>小时</em></section><div className="metric-grid"><Metric icon={Clock3} label="计划工时" value={`${statistics.regularHours.toFixed(1)} 小时`} /><Metric icon={CalendarClock} label="加班工时" value={`${statistics.overtimeHours.toFixed(1)} 小时`} tone="warning" /><Metric icon={CheckCircle2} label="已领工序" value={`${statistics.completedOperations} 道`} /><Metric icon={CalendarClock} label="涉及天数" value={`${statistics.attendanceDays} 天`} /></div>{period === "day" ? <section className="today-stat-note"><Clock3 /><div><strong>今日统计只显示汇总</strong><p>当前 v1 口径为领取即计入计划工时，真实报工工时将在后续版本开放。</p></div></section> : <section className="trend-list"><div className="trend-heading"><div><h2>{trendTitle}</h2><p>{trendSubtitle}</p></div><div className="trend-legend" aria-label="工时图例"><span><i className="regular" />计划</span><span><i className="overtime" />加班</span></div></div>{statistics.trend.map((item) => { const regular = Math.max(0, item.hours - item.overtime); return <div className="trend-row" key={item.label}><span>{item.label}</span><div className="stacked-hours" aria-label={`${item.label}计划工时 ${regular} 小时，加班 ${item.overtime} 小时`}><i className="regular-hours" style={{ width: `${Math.min(regular / maxTrendHours * 100, 100)}%` }} /><i className="overtime-hours" style={{ width: `${Math.min(item.overtime / maxTrendHours * 100, 100)}%` }} /></div><div className="trend-value"><strong>{item.hours}h</strong>{item.overtime > 0 && <small>加班 {item.overtime}h</small>}</div></div>})}</section>}</>}</div>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: string; tone?: string }) { return <article className={`metric-card ${tone || ""}`}><Icon /><span>{label}</span><strong>{value}</strong></article>; }
function PageHeader({ title, subtitle }: { title: string; subtitle: string }) { return <header className="page-header"><h1>{title}</h1><p>{subtitle}</p></header>; }

export function ProfilePage() {
  const logout = useLogout();
  const { name, userId } = useAuthStore();
  const displayName = name?.trim() || (requireAuth ? "未提供姓名" : "张师傅");
  const displayUserId = userId?.trim() || (requireAuth ? "未提供工号" : "EMP-20240018");
  const avatarText = Array.from(displayName)[0] || "用";
  return <div className="standard-page profile-page"><PageHeader title="我的" subtitle={requireAuth ? "企业微信登录信息" : "个人信息与演示设置"} /><section className="profile-card"><div className="profile-avatar">{avatarText}</div><div><h2>{displayName}</h2><p>{requireAuth ? "企业微信已验证" : "生产一组 · 白班"}</p></div></section><section className="profile-menu"><button><UsersRound /><span><strong>工号</strong><small>{displayUserId}</small></span></button>{requireAuth ? <button><CheckCircle2 /><span><strong>登录状态</strong><small>已验证</small></span></button> : <button><CalendarClock /><span><strong>当前班次</strong><small>08:00 - 20:00</small></span></button>}</section><button className="logout-action" onClick={logout}><LogOut />退出登录</button></div>;
}
