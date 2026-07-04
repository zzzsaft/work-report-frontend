import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, type LucideIcon } from "lucide-react";
import {
  hourAllocationFallbackText, hourAllocationTooltip,
} from "@/domain/work-report";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { LoadingState, PageHeader } from "./shared";
import { cx } from "./mobileUtils";
import sharedStyles from "./mobileShared.module.less";
import pageStyles from "./StatsPage.module.less";

const styles = { ...pageStyles, ...sharedStyles };

export function StatsPage() {
  const { statistics, statisticsLoading, loadStatistics } = useWorkReportStore();
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  useEffect(() => { void loadStatistics(period); }, [loadStatistics, period]);
  const maxTrendHours = Math.max(10, ...(statistics?.trend.map((item) => item.hours) || []));
  const trendTitle = period === "month" ? "每周工时" : "每日工时";
  const trendSubtitle = period === "month" ? "本月按周汇总" : "本周";
  const allocation = statistics?.hourAllocation;
  return <div className={styles["standard-page"]}><PageHeader title="我的统计" subtitle="已领取工序按计划工时汇总" /><div className={styles["segmented"]}>{([['day','今日'],['week','本周'],['month','本月']] as const).map(([key,label]) => <button key={key} className={period === key ? styles.active : undefined} onClick={()=>setPeriod(key)}>{label}</button>)}</div>{statisticsLoading || !statistics ? <LoadingState /> : <><section className={styles["stat-hero"]}><span>累计工时</span>{allocation?.allocationTemporary && <small className={styles["allocation-tag"]} title={hourAllocationTooltip}>临时分摊</small>}<strong>{statistics.totalHours.toFixed(2)}</strong><em>小时</em></section><div className={styles["metric-grid"]}><Metric icon={Clock3} label="计划工时" value={`${statistics.regularHours.toFixed(2)} 小时`} /><Metric icon={CalendarClock} label="加班工时" value={`${statistics.overtimeHours.toFixed(2)} 小时`} tone="warning" /><Metric icon={CheckCircle2} label="已领工序" value={`${statistics.completedOperations} 道`} /><Metric icon={CalendarClock} label="涉及天数" value={`${statistics.attendanceDays} 天`} /></div>{allocation && <section className={styles["today-stat-note"]} title={hourAllocationTooltip}><Clock3 /><div><strong>工时分摊说明 <span className={styles["allocation-tag"]}>临时分摊</span></strong><p>{allocation.allocationApplied === false ? hourAllocationFallbackText : "当前工时按实际开工-完工时长占比分摊标准工时。该规则为临时口径，后续可能调整。"}</p></div></section>}{period === "day" ? <section className={styles["today-stat-note"]}><Clock3 /><div><strong>今日统计只显示汇总</strong><p>当前统计工时由后端返回；如存在多人报工分摊，会按临时分摊口径计入。</p></div></section> : <section className={styles["trend-list"]}><div className={styles["trend-heading"]}><div><h2>{trendTitle}</h2><p>{trendSubtitle}</p></div><div className={styles["trend-legend"]} aria-label="工时图例"><span><i className={styles["regular"]} />计划</span><span><i className={styles["overtime"]} />加班</span></div></div>{statistics.trend.map((item) => { const regular = Math.max(0, item.hours - item.overtime); return <div className={styles["trend-row"]} key={item.label}><span>{item.label}</span><div className={styles["stacked-hours"]} aria-label={`${item.label}计划工时 ${regular.toFixed(2)} 小时，加班 ${item.overtime.toFixed(2)} 小时`}><i className={styles["regular-hours"]} style={{ width: `${Math.min(regular / maxTrendHours * 100, 100)}%` }} /><i className={styles["overtime-hours"]} style={{ width: `${Math.min(item.overtime / maxTrendHours * 100, 100)}%` }} /></div><div className={styles["trend-value"]}><strong>{item.hours.toFixed(2)}h</strong>{item.overtime > 0 && <small>加班 {item.overtime.toFixed(2)}h</small>}</div></div>})}</section>}</>}</div>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: string }) {
  return <article className={cx(styles["metric-card"], tone && styles[tone])}><Icon /><span>{label}</span><strong>{value}</strong></article>;
}
