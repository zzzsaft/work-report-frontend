import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Box, CalendarClock, Camera, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, ClipboardList,
  Clock3, Factory, FileText, Hash, LogOut, MessageSquareText, PackageCheck, Pause, Play, RefreshCw,
  RotateCcw, Search, Target, Trash2, UsersRound, WalletCards, X,
} from "lucide-react";
import { useLogout } from "@/hooks/useLogout";
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { canSwitchFromAssignment, canWorkerRemoveAssignment, formatDuration, getSessionElapsedSeconds, statusLabel, type ClaimableOperation, type ClaimablePart, type ClaimableProduct, type OperationAssignment } from "@/domain/work-report";
import type { PaginatedResult } from "@/api/services/workReport.repository";
import { createImagePreviews, filesToCompletionPhotos, revokeImagePreviews, selectImageFiles, type ImagePreview } from "@/utils/imageFiles";
import { getErrorMessage } from "@/utils/errors";
import { openXft } from "@/utils/xft";
import { useNavigate } from "react-router-dom";
import { getOperationTimes } from "@/api/http/laborDataClient";
import styles from "./MobilePages.module.less";

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

function LoadingState() { return <div className={styles["page-state"]}><span className="spinner" /><p>正在加载报工数据...</p></div>; }
function ErrorBanner({ message, retry }: { message: string; retry?: () => void }) { return <div className={styles["error-banner"]}><CircleAlert /><span>{message}</span>{retry && <button onClick={retry}>重试</button>}</div>; }

function StatusPill({ status }: { status: OperationAssignment["status"] }) {
  return <span className={cx(styles["status-pill"], styles[`status-${status}`])}><span />{statusLabel[status]}</span>;
}

function AvatarCircle({ src, name, className }: { src?: string | null; name: string; className: string }) {
  const [failed, setFailed] = useState(false);
  const avatarText = Array.from(name)[0] || "用";
  if (src && !failed) {
    return <img className={className} src={src} alt={name} onError={() => setFailed(true)} />;
  }
  return <div className={className}>{avatarText}</div>;
}

type ClaimOperationFilter = "all" | "available" | "claimed";
type ClaimPanelView = "search" | "recent";
type ClaimRecentDateFilter = "today" | "all";
type OperationListRange = "today" | "7" | "30" | "all";
const claimOperationFilterOptions: Array<[ClaimOperationFilter, string]> = [["all", "全部"], ["available", "可领取"], ["claimed", "已满"]];
const claimRecentStatusOptions: Array<[Exclude<ClaimOperationFilter, "claimed">, string]> = [["available", "可领取"], ["all", "全部"]];
const operationListRangeOptions: Array<[OperationListRange, string]> = [["today", "今天"], ["7", "最近7天"], ["30", "最近一个月"], ["all", "全部"]];
const claimSearchPageSize = 4;
const operationListPageSize = 6;
const requireAuth = import.meta.env.VITE_REQUIRE_AUTH !== "false";
const getTimeValue = (date?: string) => date ? new Date(date).getTime() : 0;
const getAssignmentSortTime = (item: OperationAssignment) => getTimeValue(item.claimedAt) || getTimeValue(item.plannedStart);
const formatProductPartCode = (productCode?: string, partCode?: string) => {
  const codes = [productCode, partCode].map((code) => code?.trim()).filter(Boolean);
  return Array.from(new Set(codes)).join(" · ");
};
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
  return <div className={styles["sheet-backdrop"]} role="presentation" onMouseDown={onClose}>
    <section className={styles["bottom-sheet"]} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <div className={styles["sheet-handle"]} /><header><h2>{title}</h2><button className={styles["icon-button"]} onClick={onClose} aria-label="关闭"><X /></button></header>{children}
    </section>
  </div>;
}

export function CurrentOperationPage() {
  const { current, nextCandidates, switchCandidates, dayCompleted, currentLoading, actionLoading, error, loadCurrent, start, pause, resume, complete, selectNext, switchCurrent, clearError } = useWorkReportStore();
  const { name, avatar } = useAuthStore();
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
  const displayName = name?.trim() || (requireAuth ? "未提供姓名" : "张师傅");
  return <div className={styles["current-page"]}>
    <header className={styles["worker-header"]}><AvatarCircle className={styles["worker-avatar"]} src={avatar} name={displayName} /><div><strong>{displayName}</strong><span>白班（08:00-20:00）</span></div><StatusPill status={current.status} /></header>
    {error && <ErrorBanner message={error} retry={() => { clearError(); void loadCurrent(); }} />}
    <section className={styles["operation-info"]} aria-label="当前工序信息">
      <InfoRow icon={ClipboardList} label="工单号" value={current.orderNo} strong />
      <InfoRow icon={Box} label="产品名称" value={current.productName} strong />
      <InfoRow icon={Hash} label="产品编号" value={current.productCode} />
      <InfoRow icon={PackageCheck} label="部件编号" value={current.partCode} />
      <div className={cx(styles["info-row"], styles["operation-row"])}><div className={styles["info-icon"]}><Target /></div><div className={styles["info-copy"]}><span>当前工序</span><strong>{current.operationName}</strong><button className={styles["note-button"]} onClick={() => setShowNote(true)}><MessageSquareText />查看工序备注<ChevronRight /></button></div></div>
      <InfoRow icon={PackageCheck} label="计划数量" value={`${current.plannedQuantity} 件`} strong />
      <InfoRow icon={UsersRound} label="协作人员" value={current.collaborators.join(" / ")} />
      <InfoRow icon={Clock3} label="已用时间" value={elapsed} timer />
    </section>
    <div className={styles["action-dock"]}>
      <button className={styles["primary-action"]} disabled={actionLoading} onClick={primary.action}><PrimaryIcon />{actionLoading ? "正在处理..." : primary.text}</button>
      {canSwitch && <button className={cx(styles["secondary-action"], styles["switch-action"])} disabled={actionLoading} onClick={() => setShowNext(true)}><ClipboardList />切换工序</button>}
      {current.status !== "assigned" && current.status !== "completed" && <button className={styles["secondary-action"]} disabled={actionLoading} onClick={() => setShowComplete(true)}><Camera />结束并拍照</button>}
    </div>
    {showNote && <BottomSheet title="工序备注" onClose={() => setShowNote(false)}><div className={styles["note-content"]}><FileText /><p>{current.operationNote}</p></div><button className={styles["primary-button"]} onClick={() => setShowNote(false)}>我知道了</button></BottomSheet>}
    {showPause && <PauseSheet onClose={() => setShowPause(false)} onConfirm={async (reason) => { await pause(reason); setShowPause(false); }} loading={actionLoading} />}
    {showComplete && <CompleteSheet onClose={() => setShowComplete(false)} loading={actionLoading} onConfirm={async (input) => { await complete(input); setShowComplete(false); }} />}
    {showNext && (nextCandidates.length > 0 || switchCandidates.length > 0) && <NextOperationSheet title={nextCandidates.length > 0 ? "选择下一工序" : "切换工序"} help={nextCandidates.length > 0 ? `今日还有 ${nextCandidates.length} 道未完成工序，请选择接下来要做的工序。` : "当前工序已暂停或尚未开始，可以切换到其他待开始工序。"} candidates={nextCandidates.length > 0 ? nextCandidates : switchCandidates} onClose={() => setShowNext(false)} onSelect={(assignment) => { if (nextCandidates.length > 0) selectNext(assignment); else void switchCurrent(assignment); setShowNext(false); }} />}
  </div>;
}

function NoCurrentOperationPage({ candidates, onRefresh, onSelect, loading }: { candidates: OperationAssignment[]; onRefresh: () => void; onSelect: (assignment: OperationAssignment) => void; loading: boolean }) {
  if (!candidates.length) return <div className={styles["empty-state"]}><PackageCheck /><h1>当前没有待报工工序</h1><p>新的工序分配或领取后会显示在这里。</p><button className={styles["primary-button"]} onClick={onRefresh}><RefreshCw />刷新工序</button></div>;
  return <div className={cx(styles["standard-page"], styles["no-current-page"])}><PageHeader title="选择工序开始" subtitle="当前没有正在进行的工序，请先选择一道待开始工序" /><div className={styles["next-operation-list"]}>{candidates.map((item) => <button key={item.id} disabled={loading} onClick={() => onSelect(item)}><div><span>{item.orderNo}</span><em>{item.source === "self_claimed" ? "自主领取" : "后台分配"}</em></div><strong>{item.operationName}</strong><p>{item.productName} · {item.productCode}</p><p>{item.partName || item.partCode} · {item.partCode}</p><small><UsersRound />{item.collaborators.join(" / ")}</small><ChevronRight /></button>)}</div><button className={cx(styles["ghost-button"], styles["refresh-wide"])} onClick={onRefresh}><RefreshCw />刷新工序</button></div>;
}

function DayCompletedPage({ onRefresh }: { onRefresh: () => void }) {
  return <div className={styles["day-completed"]}><div className={styles["completion-check"]}><CheckCircle2 /></div><h1>今日工序已全部完成</h1><p>辛苦了！今天安排的报工任务均已完成。</p><div className={styles["completion-summary"]}><span>完成状态</span><strong>全部完成</strong></div><button className={styles["ghost-button"]} onClick={onRefresh}><RefreshCw />刷新工序</button></div>;
}

function NextOperationSheet({ title, help, candidates, onClose, onSelect }: { title: string; help: string; candidates: OperationAssignment[]; onClose: () => void; onSelect: (assignment: OperationAssignment) => void }) {
  return <BottomSheet title={title} onClose={onClose}><p className={styles["sheet-help"]}>{help}</p><div className={styles["next-operation-list"]}>{candidates.map((item) => <button key={item.id} onClick={() => onSelect(item)}><div><span>{item.orderNo}</span><em>{new Date(item.plannedStart).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</em></div><strong>{item.operationName}</strong><p>{item.productName} · {item.productCode}</p><p>{item.partName || item.partCode} · {item.partCode}</p><small><UsersRound />{item.collaborators.join(" / ")}</small><small className={styles["operation-elapsed"]}><Clock3 />已用时长 {formatDuration(getSessionElapsedSeconds(item.session))}</small><ChevronRight /></button>)}</div></BottomSheet>;
}

function InfoRow({ icon: Icon, label, value, strong, timer }: { icon: typeof Box; label: string; value: string; strong?: boolean; timer?: boolean }) {
  return <div className={styles["info-row"]}><div className={styles["info-icon"]}><Icon /></div><div className={styles["info-copy"]}><span>{label}</span><strong className={cx(strong && styles.emphasis, timer && styles["timer-value"])}>{value}</strong></div></div>;
}

function PauseSheet({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: (reason?: string) => Promise<void>; loading: boolean }) {
  const [reason, setReason] = useState("等待质检");
  return <BottomSheet title="确认暂停作业？" onClose={onClose}><p className={styles["sheet-help"]}>暂停期间不会计入本次作业工时。</p><label className={styles["field-label"]}>暂停原因（可选）<select value={reason} onChange={(e) => setReason(e.target.value)}><option>等待质检</option><option>设备调整</option><option>等待物料</option><option>临时离岗</option></select></label><div className={styles["sheet-actions"]}><button className={styles["ghost-button"]} onClick={onClose}>取消</button><button className={styles["primary-button"]} disabled={loading} onClick={() => void onConfirm(reason).catch(() => undefined)}><Pause />确认暂停</button></div></BottomSheet>;
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
  return <BottomSheet title="完成报工" onClose={onClose}><div className={styles["completion-step"]}><div className={styles["step-title"]}><span>1</span><strong>拍摄完工照片</strong><em>必填</em></div><input ref={fileRef} hidden type="file" accept="image/*" capture="environment" multiple onChange={onFiles} /><button className={styles["photo-picker"]} onClick={() => fileRef.current?.click()}><Camera /><span>{photos.length ? "继续添加照片" : "拍照或选择照片"}</span></button>{photos.length > 0 && <div className={styles["photo-grid"]}>{photos.map((photo, index) => <div key={photo.previewUrl}><img src={photo.previewUrl} alt={`完工照片 ${index + 1}`} /><button aria-label="删除照片" onClick={() => removePhoto(index)}><X /></button></div>)}</div>}{fileError && <p className={styles["validation-hint"]}>{fileError}</p>}</div><div className={styles["completion-step"]}><div className={styles["step-title"]}><span>2</span><strong>补充完工信息</strong><small>选填</small></div><label className={styles["field-label"]}>本次完成数量<input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} placeholder="请输入数量" /></label><label className={styles["field-label"]}>备注<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="填写异常、质量或交接说明" rows={3} /></label></div><button className={cx(styles["primary-button"], styles["submit-completion"])} disabled={!photos.length || loading || preparing} onClick={() => void submit()}><CheckCircle2 />{loading || preparing ? "正在提交..." : "确认完成报工"}</button>{!photos.length && <p className={styles["validation-hint"]}>请至少添加一张完工照片</p>}</BottomSheet>;
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
  return <div className={styles["standard-page"]}>
    <PageHeader title="工序清单" subtitle="查看自己已领取和已分配的工序" />
    {error && <ErrorBanner message={error} retry={() => { clearError(); void loadAssignments(); }} />}
    <section className={styles["claimed-section"]} aria-label="工序清单">
      <div className={styles["section-heading"]}><div><h2>我的工序</h2><p>v1 仅展示领取结果，报工状态流转将在后续版本开放。</p></div><button className={styles["ghost-button"]} disabled={assignmentsLoading} onClick={() => void loadAssignments()}><RefreshCw />刷新</button></div>
      <div className={cx(styles["history-filter"], styles["operation-range-filter"])} aria-label="工序清单时间筛选"><div><strong>时间范围</strong><span>共 {filteredAssignments.length} 条</span></div><div>{operationListRangeOptions.map(([key, label]) => <button key={key} className={range === key ? styles.active : undefined} onClick={() => setRange(key)}>{label}</button>)}</div></div>
      {assignmentsLoading ? <LoadingState /> : <><div className={styles["operation-list"]}>{visibleAssignments.map((item) => <OperationCard key={item.id} item={item} removing={actionLoading} onRemove={() => void removeClaimedAssignment(item.id)} v1Status />)}{!visibleAssignments.length && <div className={styles["empty-inline"]}>当前时间范围暂无已领取工序。</div>}</div>{filteredAssignments.length > 0 && <div ref={loaderRef} className={styles["lazy-load-state"]}>{hasMore ? "继续下滑加载更多" : "已显示全部"}</div>}</>}
    </section>
  </div>;
}

export function ClaimOperationsPage() {
  const {
    actionLoading, claimLoading, claimProducts, claimProductsPagination, claimParts, claimOperations, recentClaimOperations, error,
    searchClaimableProducts, loadRecentClaimableOperations, loadClaimableParts, loadClaimableOperations, claimOperation, clearError,
  } = useWorkReportStore();
  const [claimedOperation, setClaimedOperation] = useState<ClaimableOperation | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timesLoading, setTimesLoading] = useState(false);
  useEffect(() => { void loadRecentClaimableOperations(); }, [loadRecentClaimableOperations]);

  useEffect(() => {
    if (claimedOperation) {
      setStartTime("");
      setEndTime("");
      setTimesLoading(true);

      const fetchOperationTimes = async () => {
        try {
          const jobNum = claimedOperation.orderNo;
          const assemblySeq = claimedOperation.partNo || "0";
          const oprSeq = claimedOperation.operationNo || "0";

          const times = await getOperationTimes(jobNum, assemblySeq, oprSeq, claimedOperation.estimatedHours);
          setStartTime(times.startTime);
          setEndTime(times.endTime);
        } finally {
          setTimesLoading(false);
        }
      };

      void fetchOperationTimes();
    }
  }, [claimedOperation]);

  const handleConfirmClaim = async (startAt: string, endAt: string) => {
    if (!claimedOperation) return;
    try {
      await claimOperation(claimedOperation.id, { startTime: startAt, endTime: endAt });
      setClaimedOperation(null);
      await loadRecentClaimableOperations();
    } catch (err) {
      console.error("Failed to claim operation:", err);
    }
  };

  const handleCancelClaim = () => {
    setClaimedOperation(null);
    setStartTime("");
    setEndTime("");
  };

  return <div className={cx(styles["standard-page"], styles["claim-page"])}>
    <PageHeader title="领取工序" subtitle="搜索产品编号，选择部件后领取自己的工序" />
    {error && <ErrorBanner message={error} retry={() => { clearError(); void loadRecentClaimableOperations(); }} />}
    <ClaimOperationsPanel loading={claimLoading || actionLoading} products={claimProducts} productPagination={claimProductsPagination} parts={claimParts} operations={claimOperations} recentOperations={recentClaimOperations} claimed={claimedOperation} startTime={startTime} endTime={endTime} timesLoading={timesLoading} onSearch={searchClaimableProducts} onLoadRecent={loadRecentClaimableOperations} onLoadParts={loadClaimableParts} onLoadOperations={loadClaimableOperations} onClaim={(operationId) => { const op = claimOperations.find((o: ClaimableOperation) => o.id === operationId) || recentClaimOperations.find((o: ClaimableOperation) => o.id === operationId); if (op) setClaimedOperation(op); }} onConfirmClaim={handleConfirmClaim} onCancelClaim={handleCancelClaim} />
  </div>;
}

function OperationCard({ item, removing, onRemove, v1Status = false }: { item: OperationAssignment; removing: boolean; onRemove: () => void; v1Status?: boolean }) {
  return <article className={styles["operation-card"]}><div>{v1Status ? <span className={cx(styles["status-pill"], styles["status-assigned"])}><span />已领取</span> : <StatusPill status={item.status} />}<span className={styles["order-number"]}>{item.orderNo}</span></div><h2>{item.operationName}</h2><p>{item.productName} · {item.productCode}</p><p>{item.partName || item.partCode} · {item.partCode}</p><div className={styles["assignment-source"]}><span>{item.source === "self_claimed" ? "自主领取" : item.source === "leader_imported" ? "小组长导入" : "后台分配"}</span>{item.assignedBy && <small>{item.assignedBy.name}</small>}</div><dl><div><dt>计划数量</dt><dd>{item.plannedQuantity} 件</dd></div><div><dt>计划工时</dt><dd>{item.estimatedHours ? `${item.estimatedHours} 小时` : "未填写"}</dd></div></dl>{canWorkerRemoveAssignment(item) && <button className={styles["remove-claim-button"]} disabled={removing} onClick={onRemove}><Trash2 />取消领取</button>}</article>;
}

function ClaimOperationsPanel({
  loading, products, productPagination, parts, operations, recentOperations = [], claimed, startTime, endTime, timesLoading, onSearch, onLoadRecent, onLoadParts, onLoadOperations, onClaim, onConfirmClaim, onCancelClaim,
}: {
  loading: boolean;
  products: ClaimableProduct[];
  productPagination: PaginatedResult<ClaimableProduct>;
  parts: ClaimablePart[];
  operations: ClaimableOperation[];
  recentOperations?: ClaimableOperation[];
  claimed: ClaimableOperation | null;
  startTime: string;
  endTime: string;
  timesLoading: boolean;
  onSearch: (keyword: string, page?: number, pageSize?: number) => Promise<void>;
  onLoadRecent?: () => Promise<void>;
  onLoadParts: (productId: string) => Promise<void>;
  onLoadOperations: (partId: string) => Promise<void>;
  onClaim: (operationId: string) => void;
  onConfirmClaim: (startTime: string, endTime: string) => void;
  onCancelClaim: () => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ClaimableProduct | null>(null);
  const [selectedPart, setSelectedPart] = useState<ClaimablePart | null>(null);
  const [dismissedAutoProductId, setDismissedAutoProductId] = useState<string | null>(null);
  const [dismissedAutoPartId, setDismissedAutoPartId] = useState<string | null>(null);
  const [view, setView] = useState<ClaimPanelView>("search");
  const [filter, setFilter] = useState<ClaimOperationFilter>("all");
  const [searchPage, setSearchPage] = useState(1);
  const [recentDate, setRecentDate] = useState<ClaimRecentDateFilter>("all");
  const [recentStatus, setRecentStatus] = useState<Exclude<ClaimOperationFilter, "claimed">>("available");
  const [localStartTime, setLocalStartTime] = useState(startTime);
  const [localEndTime, setLocalEndTime] = useState(endTime);
  const productPageCount = Math.max(1, Math.ceil(productPagination.total / productPagination.pageSize));
  const filteredSearchOperations = operations.filter((item) => filter === "all" ? true : item.status === filter);
  const searchPageCount = Math.max(1, Math.ceil(filteredSearchOperations.length / claimSearchPageSize));
  const visibleSearchOperations = filteredSearchOperations.slice((searchPage - 1) * claimSearchPageSize, searchPage * claimSearchPageSize);
  const filteredRecentOperations = recentOperations.filter((item) => {
    const matchesDate = recentDate === "all" ? true : isSameLocalDay(item.plannedStart);
    const matchesStatus = recentStatus === "all" ? true : item.status === "available";
    return matchesDate && matchesStatus;
  });

  useEffect(() => {
    setLocalStartTime(startTime);
    setLocalEndTime(endTime);
  }, [startTime, endTime]);

  const search = async () => {
    setSelectedProduct(null);
    setSelectedPart(null);
    setDismissedAutoProductId(null);
    setDismissedAutoPartId(null);
    setSearchPage(1);
    await onSearch(keyword, 1, productPagination.pageSize);
  };
  const loadProductPage = async (page: number) => {
    setSelectedProduct(null);
    setSelectedPart(null);
    setDismissedAutoProductId(null);
    setDismissedAutoPartId(null);
    setSearchPage(1);
    await onSearch(keyword, page, productPagination.pageSize);
  };
  useEffect(() => { setSearchPage(1); }, [filter, selectedPart?.id]);
  useEffect(() => {
    if (searchPage > searchPageCount) setSearchPage(searchPageCount);
  }, [searchPage, searchPageCount]);
  useEffect(() => {
    if (view !== "search" || selectedProduct || productPagination.total !== 1 || products.length !== 1) return;
    const [product] = products;
    if (!product || dismissedAutoProductId === product.id) return;

    setSelectedProduct(product);
    setSelectedPart(null);
    setDismissedAutoPartId(null);
    void onLoadParts(product.id);
  }, [dismissedAutoProductId, onLoadParts, productPagination.total, products, selectedProduct, view]);
  useEffect(() => {
    if (view !== "search" || !selectedProduct || selectedPart || parts.length !== 1) return;
    const [part] = parts;
    if (!part || dismissedAutoPartId === part.id) return;

    setSelectedPart(part);
    setSearchPage(1);
    void onLoadOperations(part.id);
  }, [dismissedAutoPartId, onLoadOperations, parts, selectedPart, selectedProduct, view]);
  const loadRecent = async () => { await onLoadRecent?.(); };
  const renderOperation = (item: ClaimableOperation) => <article key={item.id} className={item.status !== "available" ? styles.disabled : undefined}><div><strong>{item.operationName}</strong><span className={styles[`claim-status-${item.status}`]}>{item.status === "available" ? "可领取" : item.status === "claimed" ? "已满" : "已关闭"}</span></div><p>{formatProductPartCode(item.productCode, item.partCode)}</p><p>{item.operationNote}</p><dl><div><dt>数量</dt><dd>{item.plannedQuantity} 件</dd></div><div><dt>工时</dt><dd>{item.estimatedHours} 小时</dd></div><div><dt>已领</dt><dd>{item.maxClaimWorkers ? `${item.claimedWorkers}/${item.maxClaimWorkers} 人` : `${item.claimedWorkers} 人`}</dd></div></dl><button className={styles["primary-button"]} disabled={loading || item.status !== "available"} onClick={() => void onClaim(item.id)}>{item.status === "claimed" ? "人数已满" : item.status === "closed" ? "已关闭" : "领取工序"}</button></article>;

  if (claimed) return <section className={styles["claim-success"]}><h2>工序确认</h2><p>{formatProductPartCode(claimed.productCode, claimed.partCode)}</p><strong>{claimed.operationName}</strong><div className={styles["time-input-form"]}><div className={styles["time-input-section"]}><label className={styles["field-label"]}>开工时间</label><input type="datetime-local" value={localStartTime} onChange={(e) => setLocalStartTime(e.target.value)} disabled={timesLoading} className={styles["time-input"]} /></div><div className={styles["time-input-section"]}><label className={styles["field-label"]}>完工时间</label><input type="datetime-local" value={localEndTime} onChange={(e) => setLocalEndTime(e.target.value)} disabled={timesLoading} className={styles["time-input"]} /></div></div><div className={styles["claim-actions"]}><button className={styles["ghost-button"]} onClick={onCancelClaim}><X />取消</button><button className={styles["primary-button"]} disabled={loading} onClick={() => onConfirmClaim(localStartTime, localEndTime)}><CheckCircle2 />确认领取</button></div></section>;

  return <section className={styles["claim-panel"]}>
    <div className={styles["claim-view-tabs"]} aria-label="领取工序视图切换"><button className={view === "search" ? styles.active : undefined} onClick={() => setView("search")}>搜索领取</button><button className={view === "recent" ? styles.active : undefined} onClick={() => setView("recent")}>查看最近</button></div>
    {loading && <div className={styles["claim-loading"]}><span className="spinner" />正在读取...</div>}
    {view === "search" && <section className={cx(styles["claim-workspace"], styles["claim-search-workspace"])} aria-label="搜索结果">
      <div className={styles["section-heading"]}><div><h2>搜索结果</h2><p>按产品、部件、工序逐级选择。</p></div></div>
      <label className={styles["claim-search"]}><Search /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="输入产品编号搜索" /><button disabled={loading || !keyword.trim()} onClick={() => void search()}>搜索</button></label>
      <div className={styles["claim-filter"]} aria-label="领取状态筛选">{claimOperationFilterOptions.map(([key, label]) => <button key={key} className={filter === key ? styles.active : undefined} onClick={() => { setFilter(key); setSearchPage(1); }}>{label}</button>)}</div>
      <div className={styles["claim-columns"]}>
        <div><div className={styles["claim-list-title"]}><h3>1 产品编号</h3>{!selectedProduct && productPagination.total > 0 && <span>共 {productPagination.total} 个</span>}</div>{selectedProduct ? <button key={selectedProduct.id} className={styles.selected} onClick={() => { setDismissedAutoProductId(selectedProduct.id); setSelectedProduct(null); setSelectedPart(null); setSearchPage(1); }}><strong>{selectedProduct.productCode}</strong><span>{selectedProduct.productName}</span><small>{selectedProduct.orderNo} · 剩余 {selectedProduct.remainingQuantity} 件</small><span className={styles["cancel-select"]}>点击取消选择</span></button> : products.map((item) => <button key={item.id} onClick={() => { setSelectedProduct(item); setSelectedPart(null); setSearchPage(1); setDismissedAutoPartId(null); void onLoadParts(item.id); }}><strong>{item.productCode}</strong><span>{item.productName}</span><small>{item.orderNo} · 剩余 {item.remainingQuantity} 件</small></button>)}{!selectedProduct && productPagination.total > productPagination.pageSize && <div className={styles["claim-pagination"]} aria-label="产品搜索分页"><button disabled={loading || productPagination.page <= 1} onClick={() => void loadProductPage(Math.max(1, productPagination.page - 1))} aria-label="上一页"><ChevronLeft />上一页</button><span>第 {productPagination.page} / {productPageCount} 页</span><button disabled={loading || !productPagination.hasMore} onClick={() => void loadProductPage(Math.min(productPageCount, productPagination.page + 1))} aria-label="下一页">下一页<ChevronRight /></button></div>}</div>
        <div><h3>2 部件编号</h3>{selectedPart ? <button key={selectedPart.id} className={styles.selected} onClick={() => { setDismissedAutoPartId(selectedPart.id); setSelectedPart(null); setSearchPage(1); }}><strong>{selectedPart.partCode}</strong><span>{selectedPart.partNo && `[${selectedPart.partNo}] `}{selectedPart.partName}</span><small>{selectedPart.operationCount} 道工序 · 剩余 {selectedPart.remainingQuantity} 件</small><span className={styles["cancel-select"]}>点击取消选择</span></button> : parts.map((item) => <button key={item.id} onClick={() => { setSelectedPart(item); setSearchPage(1); void onLoadOperations(item.id); }}><strong>{item.partCode}</strong><span>{item.partNo && `[${item.partNo}] `}{item.partName}</span><small>{item.operationCount} 道工序 · 剩余 {item.remainingQuantity} 件</small></button>)}</div>
      </div>
      <div className={styles["claim-operation-list"]} aria-label="搜索工序结果"><div className={styles["claim-list-title"]}><h3>3 工序</h3>{selectedPart && filteredSearchOperations.length > 0 && <span>共 {filteredSearchOperations.length} 道</span>}</div>{selectedPart ? visibleSearchOperations.map(renderOperation) : <div className={styles["empty-inline"]}>请先搜索并选择部件查看工序。</div>}{selectedPart && !filteredSearchOperations.length && <div className={styles["empty-inline"]}>当前筛选下暂无工序</div>}{selectedPart && filteredSearchOperations.length > claimSearchPageSize && <div className={styles["claim-pagination"]} aria-label="工序搜索分页"><button disabled={loading || searchPage <= 1} onClick={() => setSearchPage((page) => Math.max(1, page - 1))} aria-label="上一页"><ChevronLeft />上一页</button><span>第 {searchPage} / {searchPageCount} 页</span><button disabled={loading || searchPage >= searchPageCount} onClick={() => setSearchPage((page) => Math.min(searchPageCount, page + 1))} aria-label="下一页">下一页<ChevronRight /></button></div>}</div>
    </section>}
    {view === "recent" && <section className={cx(styles["claim-workspace"], styles["claim-recent-workspace"])} aria-label="最近可以领取的工序">
      <div className={styles["section-heading"]}><div><h2>最近可以领取的工序</h2><p>不影响上方搜索结果。</p></div><button className={styles["ghost-button"]} disabled={loading} onClick={() => void loadRecent()}><RefreshCw />刷新</button></div>
      <div className={styles["claim-filter-row"]}><div className={cx(styles["claim-filter"], styles["compact-filter"])} aria-label="最近工序日期筛选">{([["today", "当日"], ["all", "全部"]] as const).map(([key, label]) => <button key={key} className={recentDate === key ? styles.active : undefined} onClick={() => setRecentDate(key)}>{label}</button>)}</div><div className={cx(styles["claim-filter"], styles["compact-filter"])} aria-label="最近工序状态筛选">{claimRecentStatusOptions.map(([key, label]) => <button key={key} className={recentStatus === key ? styles.active : undefined} onClick={() => setRecentStatus(key)}>{label}</button>)}</div></div>
      <div className={styles["recent-operation-list"]}>{filteredRecentOperations.map(renderOperation)}</div>
      {!filteredRecentOperations.length && <div className={styles["empty-inline"]}>暂无最近工序，可点击刷新或搜索产品编号查看。</div>}
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
  return <div className={styles["standard-page"]}><PageHeader title="我的统计" subtitle="已领取工序按计划工时汇总" /><div className={styles["segmented"]}>{([['day','今日'],['week','本周'],['month','本月']] as const).map(([key,label]) => <button key={key} className={period === key ? styles.active : undefined} onClick={()=>setPeriod(key)}>{label}</button>)}</div>{statisticsLoading || !statistics ? <LoadingState /> : <><section className={styles["stat-hero"]}><span>累计工时</span><strong>{statistics.totalHours.toFixed(1)}</strong><em>小时</em></section><div className={styles["metric-grid"]}><Metric icon={Clock3} label="计划工时" value={`${statistics.regularHours.toFixed(1)} 小时`} /><Metric icon={CalendarClock} label="加班工时" value={`${statistics.overtimeHours.toFixed(1)} 小时`} tone="warning" /><Metric icon={CheckCircle2} label="已领工序" value={`${statistics.completedOperations} 道`} /><Metric icon={CalendarClock} label="涉及天数" value={`${statistics.attendanceDays} 天`} /></div>{period === "day" ? <section className={styles["today-stat-note"]}><Clock3 /><div><strong>今日统计只显示汇总</strong><p>当前 v1 口径为领取即计入计划工时，真实报工工时将在后续版本开放。</p></div></section> : <section className={styles["trend-list"]}><div className={styles["trend-heading"]}><div><h2>{trendTitle}</h2><p>{trendSubtitle}</p></div><div className={styles["trend-legend"]} aria-label="工时图例"><span><i className={styles["regular"]} />计划</span><span><i className={styles["overtime"]} />加班</span></div></div>{statistics.trend.map((item) => { const regular = Math.max(0, item.hours - item.overtime); return <div className={styles["trend-row"]} key={item.label}><span>{item.label}</span><div className={styles["stacked-hours"]} aria-label={`${item.label}计划工时 ${regular} 小时，加班 ${item.overtime} 小时`}><i className={styles["regular-hours"]} style={{ width: `${Math.min(regular / maxTrendHours * 100, 100)}%` }} /><i className={styles["overtime-hours"]} style={{ width: `${Math.min(item.overtime / maxTrendHours * 100, 100)}%` }} /></div><div className={styles["trend-value"]}><strong>{item.hours}h</strong>{item.overtime > 0 && <small>加班 {item.overtime}h</small>}</div></div>})}</section>}</>}</div>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: string; tone?: string }) { return <article className={cx(styles["metric-card"], tone && styles[tone])}><Icon /><span>{label}</span><strong>{value}</strong></article>; }
function PageHeader({ title, subtitle }: { title: string; subtitle: string }) { return <header className={styles["page-header"]}><h1>{title}</h1><p>{subtitle}</p></header>; }

export function ProfilePage() {
  const logout = useLogout();
  const navigate = useNavigate();
  const { name, userId, avatar, token } = useAuthStore();
  const capabilities = useWorkReportStore((state) => state.capabilities);
  const canViewAdmin = capabilities?.canViewAdmin ?? false;
  const displayName = name?.trim() || (requireAuth ? "未提供姓名" : "张师傅");
  const displayUserId = userId?.trim() || (requireAuth ? "未提供工号" : "EMP-20240018");
  return <div className={cx(styles["standard-page"], styles["profile-page"])}><PageHeader title="我的" subtitle={requireAuth ? "企业微信登录信息" : "个人信息与演示设置"} /><section className={styles["profile-card"]}><AvatarCircle className={styles["profile-avatar"]} src={avatar} name={displayName} /><div><h2>{displayName}</h2><p>{requireAuth ? "企业微信已验证" : "生产一组 · 白班"}</p></div></section><section className={styles["profile-menu"]}><button><UsersRound /><span><strong>工号</strong><small>{displayUserId}</small></span></button>{requireAuth ? <button><CheckCircle2 /><span><strong>登录状态</strong><small>已验证</small></span></button> : <button><CalendarClock /><span><strong>当前班次</strong><small>08:00 - 20:00</small></span></button>}{canViewAdmin && <button onClick={() => navigate("/admin/dashboard")}><Factory /><span><strong>进入管理后台</strong><small>查看生产数据</small></span></button>}<button onClick={() => openXft("", token)}><WalletCards /><span><strong>进入薪福通</strong><small>打开薪福通工作台</small></span></button></section><button className={styles["logout-action"]} onClick={logout}><LogOut />退出登录</button></div>;
}
