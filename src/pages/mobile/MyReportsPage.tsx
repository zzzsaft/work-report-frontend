import { Button } from "@jc-times/business-ui";
import { useCallback } from "react";
import { ArrowLeft, CalendarClock, CheckCircle2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { workReportRepository } from "@/api/services/workReport.service";
import { type ReportRecord } from "@/domain/work-report";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { LoadingState } from "./shared";
import sharedStyles from "./mobileShared.module.less";
import pageStyles from "./MyReportsPage.module.less";

const styles = { ...pageStyles, ...sharedStyles };

const periodLabels: Record<string, string> = {
  day: "今日",
  week: "本周",
  month: "本月",
  lastMonth: "上月"
};

const formatDate = (iso: string | undefined) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return iso; }
};

const formatHours = (h: number | undefined) => (h || 0).toFixed(1);

export function MyReportsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const period = (params.get("period") || "week") as "day" | "week" | "month" | "lastMonth";

  const load = useCallback(async () => workReportRepository.getMyReports(period), [period]);
  const { data: reports = [], loading, error, reload } = useAsyncResource<ReportRecord[]>(load);

  return <div className={styles["standard-page"]}>
    <header className={styles["page-header"]}>
      <Button variant="ghost" className={styles["icon-button"]} onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft /></Button>
      <div style={{ flex: 1 }}><h1>我的领取记录</h1><p>{periodLabels[period]} · 共 {reports.length} 条</p></div>
    </header>
    {loading ? <LoadingState /> : error ? <div className={styles["error-banner"]}><span>{error}</span><Button variant="ghost" onClick={() => void reload()}>重试</Button></div> : reports.length === 0 ? <div className={styles["page-state"]}><CheckCircle2 style={{ width: 48, height: 48, color: "#cbd5e1" }} /><p>暂无领取记录</p></div> : <section className={styles["my-report-list"]}>
      {reports.map((item) => (
        <article key={item.id} className={styles["my-report-card"]}>
          <div className={styles["my-report-header"]}>
            <div className={styles["my-report-order"]}>
              <span className={styles["my-report-order-no"]}>{item.orderNo}</span>
              <span className={styles["my-report-operation-name"]}>{item.operationName}</span>
            </div>
            <span className={styles["my-report-status"]}>已完成</span>
          </div>
          <div className={styles["my-report-body"]}>
            <div className={styles["my-report-info-item"]}>
              <span className={styles["my-report-info-label"]}>产品</span>
              <span className={styles["my-report-info-value"]}>{item.productName}</span>
            </div>
            <div className={styles["my-report-info-item"]}>
              <span className={styles["my-report-info-label"]}>部件</span>
              <span className={styles["my-report-info-value"]}>{item.partNo} · {item.partName}</span>
            </div>
            <div className={styles["my-report-info-item"]}>
              <span className={styles["my-report-info-label"]}>工序号</span>
              <span className={`${styles["my-report-info-value"]} ${styles.code}`}>{item.operationCode}</span>
            </div>
            <div className={styles["my-report-info-item"]}>
              <span className={styles["my-report-info-label"]}>原工时</span>
              <span className={styles["my-report-info-value"]}>{(item.originalEstimatedHours ?? item.estimatedHours).toFixed(1)}h</span>
            </div>
            {item.operationNote && <div className={styles["my-report-note"]} title={item.operationNote.replace(/\n/g, " ")}>{item.operationNote.replace(/\n/g, " ")}</div>}
          </div>
          <div className={styles["my-report-footer"]}>
            <div className={styles["my-report-hours"]}>
              <span className={styles["my-report-hours-label"]}>工时</span>
              <span className={styles["my-report-hours-value"]}>{formatHours(item.allocatedHours)}</span>
              <span className={styles["my-report-hours-unit"]}>h</span>
            </div>
            <span className={styles["my-report-date"]}><CalendarClock style={{ width: 14, height: 14 }} />{formatDate(item.actualEndAt)}</span>
          </div>
        </article>
      ))}
    </section>}
  </div>;
}
