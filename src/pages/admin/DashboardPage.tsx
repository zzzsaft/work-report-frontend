import { useCallback } from "react";
import { AlertTriangle, Factory, Timer, UsersRound, type LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { workReportRepository } from "@/api/services/workReport.service";
import type { DashboardSummary, LaborStatistics } from "@/domain/work-report";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { AdminError, AdminHeader, LoadingTable } from "./adminShared";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";

export default function DashboardPage() {
  const load = useCallback(async () => { const [summary, stats] = await Promise.all([workReportRepository.getDashboard(), workReportRepository.getStatistics("week")]); return { summary, stats }; }, []);
  const { data, loading, error, reload } = useAsyncResource<{ summary: DashboardSummary; stats: LaborStatistics }>(load);
  if (loading && !data) return <><AdminHeader title="生产总览" description="今日生产、人员与异常情况" /><LoadingTable /></>;
  if (error && !data) return <><AdminHeader title="生产总览" description="今日生产、人员与异常情况" /><AdminError message={error} retry={() => void reload()} /></>;
  const summary = data?.summary; const stats = data?.stats;
  return <><AdminHeader title="生产总览" description="今日生产、人员与异常情况" /><div className={cx(styles["kpi-grid"])}><Kpi icon={Factory} label="在制工单" value={summary?.activeOrders ?? "-"} unit="单" /><Kpi icon={UsersRound} label="进行中人数" value={summary?.runningWorkers ?? "-"} unit="人" /><Kpi icon={Timer} label="今日累计工时" value={summary?.todayHours ?? "-"} unit="小时" /><Kpi icon={AlertTriangle} label="待处理异常" value={summary?.exceptionCount ?? "-"} unit="条" danger /></div><section className={cx(styles["admin-panel"], styles["chart-panel"])}><div className={cx(styles["panel-heading"])}><div><h2>本周工时趋势</h2><p>正常工时与加班工时</p></div><span>单位：小时</span></div>{stats && <ResponsiveContainer width="100%" height={300}><BarChart data={stats.trend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e9f0" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="hours" name="总工时" fill="#1455c0" radius={[5,5,0,0]} /><Bar dataKey="overtime" name="加班" fill="#f59e0b" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer>}</section></>;
}
function Kpi({ icon: Icon, label, value, unit, danger }: { icon: LucideIcon; label: string; value: string | number; unit: string; danger?: boolean }) { return <article className={cx(styles["kpi-card"], danger && styles.danger)}><div><Icon /></div><span>{label}</span><p><strong>{value}</strong>{unit}</p></article>; }
