import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Box, CalendarClock, Camera, CheckCircle2, ChevronRight, CircleAlert, ClipboardList,
  Clock3, FileText, Hash, LogOut, MessageSquareText, PackageCheck, Pause, Play, RefreshCw,
  RotateCcw, Target, UsersRound, X,
} from "lucide-react";
import { useLogout } from "@/hooks/useLogout";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { formatDuration, getSessionElapsedSeconds, statusLabel, type OperationAssignment } from "@/domain/work-report";
import { createImagePreviews, fileToDataUrl, revokeImagePreviews, selectImageFiles, type ImagePreview } from "@/utils/imageFiles";
import { getErrorMessage } from "@/utils/errors";

function LoadingState() { return <div className="page-state"><span className="spinner" /><p>正在加载报工数据...</p></div>; }
function ErrorBanner({ message, retry }: { message: string; retry?: () => void }) { return <div className="error-banner"><CircleAlert /><span>{message}</span>{retry && <button onClick={retry}>重试</button>}</div>; }

function StatusPill({ status }: { status: OperationAssignment["status"] }) {
  return <span className={`status-pill status-${status}`}><span />{statusLabel[status]}</span>;
}

function BottomSheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <div className="sheet-handle" /><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭"><X /></button></header>{children}
    </section>
  </div>;
}

export function CurrentOperationPage() {
  const { current, nextCandidates, dayCompleted, currentLoading, actionLoading, error, loadCurrent, start, pause, resume, complete, selectNext, clearError } = useWorkReportStore();
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
  if (!current) return dayCompleted ? <DayCompletedPage onRefresh={() => void loadCurrent()} /> : <div className="empty-state"><PackageCheck /><h1>当前没有待报工工序</h1><p>新的工序分配后会显示在这里。</p><button className="primary-button" onClick={() => void loadCurrent()}><RefreshCw />刷新工序</button></div>;
  const primary = current.status === "completed" && nextCandidates.length > 0 ? { text: "选择下一工序", icon: ClipboardList, action: () => setShowNext(true) } : current.status === "assigned" ? { text: "开始作业", icon: Play, action: () => void start() } : current.status === "paused" ? { text: "恢复作业", icon: RotateCcw, action: () => void resume() } : { text: "暂停作业", icon: Pause, action: () => setShowPause(true) };
  const PrimaryIcon = primary.icon;
  return <div className="current-page">
    <header className="worker-header"><div className="worker-avatar">张</div><div><strong>张师傅</strong><span>白班（08:00-20:00）</span></div><StatusPill status={current.status} /></header>
    {error && <ErrorBanner message={error} retry={() => { clearError(); void loadCurrent(); }} />}
    <section className="operation-info" aria-label="当前工序信息">
      <InfoRow icon={ClipboardList} label="工单号" value={current.orderNo} strong />
      <InfoRow icon={Box} label="产品名称" value={current.productName} strong />
      <InfoRow icon={Hash} label="产品编号" value={current.productCode} />
      <div className="info-row operation-row"><div className="info-icon"><Target /></div><div className="info-copy"><span>当前工序</span><strong>{current.operationName}</strong><button className="note-button" onClick={() => setShowNote(true)}><MessageSquareText />查看工序备注<ChevronRight /></button></div></div>
      <InfoRow icon={PackageCheck} label="计划数量" value={`${current.plannedQuantity} 件`} strong />
      <InfoRow icon={UsersRound} label="协作人员" value={current.collaborators.join(" / ")} />
      <InfoRow icon={Clock3} label="已用时间" value={elapsed} timer />
    </section>
    <div className="action-dock">
      <button className="primary-action" disabled={actionLoading} onClick={primary.action}><PrimaryIcon />{actionLoading ? "正在处理..." : primary.text}</button>
      {current.status !== "assigned" && current.status !== "completed" && <button className="secondary-action" disabled={actionLoading} onClick={() => setShowComplete(true)}><Camera />结束并拍照</button>}
    </div>
    {showNote && <BottomSheet title="工序备注" onClose={() => setShowNote(false)}><div className="note-content"><FileText /><p>{current.operationNote}</p></div><button className="primary-button" onClick={() => setShowNote(false)}>我知道了</button></BottomSheet>}
    {showPause && <PauseSheet onClose={() => setShowPause(false)} onConfirm={async (reason) => { await pause(reason); setShowPause(false); }} loading={actionLoading} />}
    {showComplete && <CompleteSheet onClose={() => setShowComplete(false)} loading={actionLoading} onConfirm={async (input) => { await complete(input); setShowComplete(false); }} />}
    {showNext && nextCandidates.length > 0 && <NextOperationSheet candidates={nextCandidates} onClose={() => setShowNext(false)} onSelect={(assignment) => { selectNext(assignment); setShowNext(false); }} />}
  </div>;
}

function DayCompletedPage({ onRefresh }: { onRefresh: () => void }) {
  return <div className="day-completed"><div className="completion-check"><CheckCircle2 /></div><h1>今日工序已全部完成</h1><p>辛苦了！今天安排的报工任务均已完成。</p><div className="completion-summary"><span>完成状态</span><strong>全部完成</strong></div><button className="ghost-button" onClick={onRefresh}><RefreshCw />刷新工序</button></div>;
}

function NextOperationSheet({ candidates, onClose, onSelect }: { candidates: OperationAssignment[]; onClose: () => void; onSelect: (assignment: OperationAssignment) => void }) {
  return <BottomSheet title="选择下一工序" onClose={onClose}><p className="sheet-help">今日还有 {candidates.length} 道未完成工序，请选择接下来要做的工序。</p><div className="next-operation-list">{candidates.map((item) => <button key={item.id} onClick={() => onSelect(item)}><div><span>{item.orderNo}</span><em>{new Date(item.plannedStart).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</em></div><strong>{item.operationName}</strong><p>{item.productName} · {item.productCode}</p><small><UsersRound />{item.collaborators.join(" / ")}</small><ChevronRight /></button>)}</div></BottomSheet>;
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
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => revokeImagePreviews(photosRef.current), []);
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
    setPreparing(true);
    try {
      const encoded = await Promise.all(photos.map(async ({ file }) => ({ name: file.name, url: await fileToDataUrl(file) })));
      await onConfirm({ photos: encoded, completedQuantity: quantity ? Number(quantity) : undefined, note: note || undefined });
    } catch (error) {
      setFileError(getErrorMessage(error));
    } finally {
      setPreparing(false);
    }
  };
  return <BottomSheet title="完成报工" onClose={onClose}><div className="completion-step"><div className="step-title"><span>1</span><strong>拍摄完工照片</strong><em>必填</em></div><input ref={fileRef} hidden type="file" accept="image/*" capture="environment" multiple onChange={onFiles} /><button className="photo-picker" onClick={() => fileRef.current?.click()}><Camera /><span>{photos.length ? "继续添加照片" : "拍照或选择照片"}</span></button>{photos.length > 0 && <div className="photo-grid">{photos.map((photo, index) => <div key={photo.previewUrl}><img src={photo.previewUrl} alt={`完工照片 ${index + 1}`} /><button aria-label="删除照片" onClick={() => removePhoto(index)}><X /></button></div>)}</div>}{fileError && <p className="validation-hint">{fileError}</p>}</div><div className="completion-step"><div className="step-title"><span>2</span><strong>补充完工信息</strong><small>选填</small></div><label className="field-label">本次完成数量<input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} placeholder="请输入数量" /></label><label className="field-label">备注<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="填写异常、质量或交接说明" rows={3} /></label></div><button className="primary-button submit-completion" disabled={!photos.length || loading || preparing} onClick={() => void submit()}><CheckCircle2 />{loading || preparing ? "正在提交..." : "确认完成报工"}</button>{!photos.length && <p className="validation-hint">请至少添加一张完工照片</p>}</BottomSheet>;
}

export function OperationsPage() {
  const { assignments, assignmentsLoading, loadAssignments } = useWorkReportStore();
  const [tab, setTab] = useState<"history" | "current" | "future">("current");
  useEffect(() => { void loadAssignments(); }, [loadAssignments]);
  const filtered = assignments.filter((item) => tab === "history" ? item.status === "completed" : tab === "future" ? item.status === "assigned" : ["running", "paused", "pending_submit"].includes(item.status));
  return <div className="standard-page"><PageHeader title="工序清单" subtitle="查看历史、当前和未来任务" /><div className="segmented">{([['history','历史'],['current','当前'],['future','未来']] as const).map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>{assignmentsLoading ? <LoadingState /> : <div className="operation-list">{filtered.map((item) => <article key={item.id} className="operation-card"><div><StatusPill status={item.status} /><span className="order-number">{item.orderNo}</span></div><h2>{item.operationName}</h2><p>{item.productName} · {item.productCode}</p><dl><div><dt>计划数量</dt><dd>{item.plannedQuantity} 件</dd></div><div><dt>计划时间</dt><dd>{new Date(item.plannedStart).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</dd></div></dl></article>)}</div>}</div>;
}

export function StatsPage() {
  const { statistics, statisticsLoading, loadStatistics } = useWorkReportStore();
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  useEffect(() => { void loadStatistics(period); }, [loadStatistics, period]);
  return <div className="standard-page"><PageHeader title="我的统计" subtitle="工时、出勤与加班一目了然" /><div className="segmented">{([['day','今日'],['week','本周'],['month','本月']] as const).map(([key,label]) => <button key={key} className={period===key?'active':''} onClick={()=>setPeriod(key)}>{label}</button>)}</div>{statisticsLoading || !statistics ? <LoadingState /> : <><section className="stat-hero"><span>累计工时</span><strong>{statistics.totalHours.toFixed(1)}</strong><em>小时</em></section><div className="metric-grid"><Metric icon={Clock3} label="正常工时" value={`${statistics.regularHours.toFixed(1)} 小时`} /><Metric icon={CalendarClock} label="加班工时" value={`${statistics.overtimeHours.toFixed(1)} 小时`} tone="warning" /><Metric icon={CheckCircle2} label="完成工序" value={`${statistics.completedOperations} 道`} /><Metric icon={CalendarClock} label="出勤天数" value={`${statistics.attendanceDays} 天`} /></div><section className="trend-list"><div className="trend-heading"><h2>每日工时</h2><div className="trend-legend" aria-label="工时图例"><span><i className="regular" />正常</span><span><i className="overtime" />加班</span></div></div>{statistics.trend.map((item) => { const regular = Math.max(0, item.hours - item.overtime); return <div className="trend-row" key={item.label}><span>{item.label}</span><div className="stacked-hours" aria-label={`${item.label}正常工时 ${regular} 小时，加班 ${item.overtime} 小时`}><i className="regular-hours" style={{ width: `${Math.min(regular / 10 * 100, 100)}%` }} /><i className="overtime-hours" style={{ width: `${Math.min(item.overtime / 10 * 100, 100)}%` }} /></div><div className="trend-value"><strong>{item.hours}h</strong>{item.overtime > 0 && <small>加班 {item.overtime}h</small>}</div></div>})}</section></>}</div>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: string; tone?: string }) { return <article className={`metric-card ${tone || ""}`}><Icon /><span>{label}</span><strong>{value}</strong></article>; }
function PageHeader({ title, subtitle }: { title: string; subtitle: string }) { return <header className="page-header"><h1>{title}</h1><p>{subtitle}</p></header>; }

export function ProfilePage() {
  const logout = useLogout();
  return <div className="standard-page profile-page"><PageHeader title="我的" subtitle="个人信息与演示设置" /><section className="profile-card"><div className="profile-avatar">张</div><div><h2>张师傅</h2><p>生产一组 · 白班</p></div></section><section className="profile-menu"><button><UsersRound /><span><strong>工号</strong><small>EMP-20240018</small></span></button><button><CalendarClock /><span><strong>当前班次</strong><small>08:00 - 20:00</small></span></button></section><button className="logout-action" onClick={logout}><LogOut />退出登录</button></div>;
}
