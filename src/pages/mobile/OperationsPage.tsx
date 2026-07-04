import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import {
  canWorkerRemoveAssignment, formatHours, getAllocatedHours, getOriginalEstimatedHours,
  hourAllocationFallbackText, hourAllocationTooltip, type OperationAssignment,
} from "@/domain/work-report";
import { ErrorBanner, LoadingState, PageHeader, StatusPill } from "./shared";
import {
  cx, getAssignmentSortTime, isAssignmentInRange, operationListPageSize, operationListRangeOptions,
  type OperationListRange,
} from "./mobileUtils";
import sharedStyles from "./mobileShared.module.less";
import pageStyles from "./OperationsPage.module.less";

const styles = { ...pageStyles, ...sharedStyles };

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
      <div className={styles["history-filter"]} aria-label="工序清单时间筛选"><div><strong>时间范围</strong><span>共 {filteredAssignments.length} 条</span></div><div>{operationListRangeOptions.map(([key, label]) => <button key={key} className={range === key ? styles.active : undefined} onClick={() => setRange(key)}>{label}</button>)}</div></div>
      {assignmentsLoading ? <LoadingState /> : <><div className={styles["operation-list"]}>{visibleAssignments.map((item) => <OperationCard key={item.id} item={item} removing={actionLoading} onRemove={() => void removeClaimedAssignment(item.id)} v1Status />)}{!visibleAssignments.length && <div className={styles["empty-inline"]}>当前时间范围暂无已领取工序。</div>}</div>{filteredAssignments.length > 0 && <div ref={loaderRef} className={styles["lazy-load-state"]}>{hasMore ? "继续下滑加载更多" : "已显示全部"}</div>}</>}
    </section>
  </div>;
}

function OperationCard({ item, removing, onRemove, v1Status = false }: { item: OperationAssignment; removing: boolean; onRemove: () => void; v1Status?: boolean }) {
  const allocation = item.hourAllocation;
  const hasAllocation = !!allocation;
  return <article className={styles["operation-card"]}><div>{v1Status ? <span className={cx(styles["status-pill"], styles["status-assigned"])}><span />已领取</span> : <StatusPill status={item.status} />}<span className={styles["order-number"]}>{item.orderNo}</span></div><h2>{item.operationName}</h2><p>{item.productName} · {item.productCode}</p><p>{item.partName || item.partCode} · {item.partCode}</p><div className={styles["assignment-source"]}><span>{item.source === "self_claimed" ? "自主领取" : item.source === "leader_imported" ? "小组长导入" : "后台分配"}</span>{item.assignedBy && <small>{item.assignedBy.name}</small>}</div><dl><div><dt>计划数量</dt><dd>{item.plannedQuantity} 件</dd></div><div><dt>{hasAllocation ? "分摊工时" : "计划工时"}</dt><dd>{hasAllocation ? `${formatHours(getAllocatedHours(item))} 小时` : item.estimatedHours ? `${formatHours(item.estimatedHours)} 小时` : "未填写"}</dd></div>{hasAllocation && <div><dt>原标准工时</dt><dd>{formatHours(getOriginalEstimatedHours(item))} 小时</dd></div>}</dl>{allocation?.allocationTemporary && <div className={styles["allocation-note"]} title={hourAllocationTooltip}><span>临时分摊</span><p>{allocation.allocationApplied === false ? hourAllocationFallbackText : "当前工时按实际开工-完工时长占比分摊，属于临时分摊口径，后续规则可能调整。"}</p></div>}{canWorkerRemoveAssignment(item) && <button className={styles["remove-claim-button"]} disabled={removing} onClick={onRemove}><Trash2 />取消领取</button>}</article>;
}
