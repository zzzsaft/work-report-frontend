import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { workReportRepository } from "@/api/services/workReport.service";
import type { ClaimableOperation, WorkerSummary } from "@/domain/work-report";
import { getErrorMessage } from "@/utils/errors";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";

export function WorkerPicker({ operation, onAssigned }: { operation: ClaimableOperation; onAssigned: (worker: WorkerSummary) => Promise<void> }) {
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
