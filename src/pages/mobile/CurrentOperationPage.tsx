import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Box, Camera, CheckCircle2, ChevronRight, ClipboardList, Clock3, FileText, Hash, MessageSquareText,
  PackageCheck, Pause, Play, RefreshCw, RotateCcw, Target, UsersRound, X,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import {
  canSwitchFromAssignment, formatDuration, getSessionElapsedSeconds,
  type OperationAssignment,
} from "@/domain/work-report";
import {
  createImagePreviews, filesToCompletionPhotos, revokeImagePreviews, selectImageFiles,
  type ImagePreview,
} from "@/utils/imageFiles";
import { getErrorMessage } from "@/utils/errors";
import { AvatarCircle, BottomSheet, ErrorBanner, LoadingState, PageHeader, StatusPill } from "./shared";
import { cx, requireAuth } from "./mobileUtils";
import sharedStyles from "./mobileShared.module.less";
import pageStyles from "./CurrentOperationPage.module.less";

const styles = { ...pageStyles, ...sharedStyles };

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
  return <div className={styles["day-completed"]}><div className={styles["completion-check"]}><CheckCircle2 /></div><h1>今日工序已全部完成</h1><p>辛苦了！今天安排的报工任务均已完成。</p><div className={styles["completion-summary"]}><span>完成状态</span><strong>全部完成</strong></div><button className={cx(styles["ghost-button"], styles["day-completed-action"])} onClick={onRefresh}><RefreshCw />刷新工序</button></div>;
}

function NextOperationSheet({ title, help, candidates, onClose, onSelect }: { title: string; help: string; candidates: OperationAssignment[]; onClose: () => void; onSelect: (assignment: OperationAssignment) => void }) {
  return <BottomSheet title={title} onClose={onClose}><p className={styles["sheet-help"]}>{help}</p><div className={styles["next-operation-list"]}>{candidates.map((item) => <button key={item.id} onClick={() => onSelect(item)}><div><span>{item.orderNo}</span><em>{new Date(item.plannedStart).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</em></div><strong>{item.operationName}</strong><p>{item.productName} · {item.productCode}</p><p>{item.partName || item.partCode} · {item.partCode}</p><small><UsersRound />{item.collaborators.join(" / ")}</small><small className={styles["operation-elapsed"]}><Clock3 />已用时长 {formatDuration(getSessionElapsedSeconds(item.session))}</small><ChevronRight /></button>)}</div></BottomSheet>;
}

function InfoRow({ icon: Icon, label, value, strong, timer }: { icon: LucideIcon; label: string; value: string; strong?: boolean; timer?: boolean }) {
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
