import { useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { workReportRepository } from "@/api/services/workReport.service";
import type { ProductionException } from "@/domain/work-report";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { AdminError, AdminHeader, LoadingTable } from "./adminShared";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";

export default function ExceptionsPage() {
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
