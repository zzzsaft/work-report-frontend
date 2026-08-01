import { useCallback, useState } from "react";
import { UsersRound } from "lucide-react";
import { workReportRepository } from "@/api/services/workReport.service";
import { type StaffStat } from "@/api/services/workReport.repository";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { AdminHeader, AdminError, LoadingTable } from "./adminShared";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";

export default function PeoplePage() {
  const [period, setPeriod] = useState<"month" | "lastMonth">("month");
  const load = useCallback(async () => workReportRepository.getStaffStats(period), [period]);
  const { data: staff = [], loading, error, reload } = useAsyncResource<StaffStat[]>(load);

  const maxHours = Math.max(1, ...staff.map((s) => s.totalHours));
  const totalHours = staff.reduce((sum, s) => sum + s.totalHours, 0);

  const periodLabel = period === "lastMonth" ? "上月" : "本月";

  return <>
    <AdminHeader title="人员统计" description={`${periodLabel}员工工时汇总`} action={
      <div className={styles["period-tabs"]}>
        <button className={period === "month" ? styles.periodActive : undefined} onClick={() => setPeriod("month")}>本月</button>
        <button className={period === "lastMonth" ? styles.periodActive : undefined} onClick={() => setPeriod("lastMonth")}>上月</button>
      </div>
    } />
    {loading ? <LoadingTable /> : error ? <AdminError message={error} retry={() => void reload()} /> : staff.length === 0 ? <section className={cx(styles["admin-panel"])}><div className={styles["empty-inline"]}>暂无{periodLabel}工时数据</div></section> : <>
      <section className={cx(styles["admin-panel"], styles["staff-summary"])}>
        <div className={styles["staff-summary-item"]}>
          <span>总工时</span>
          <strong>{totalHours.toFixed(1)}h</strong>
        </div>
        <div className={styles["staff-summary-item"]}>
          <span>参与人数</span>
          <strong>{staff.length}人</strong>
        </div>
        <div className={styles["staff-summary-item"]}>
          <span>人均工时</span>
          <strong>{(totalHours / staff.length).toFixed(1)}h</strong>
        </div>
      </section>
      <section className={cx(styles["admin-panel"])}>
        <div className={styles["table-wrap"]}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>排名</th>
                <th>生产人员</th>
                <th>总工时</th>
                <th>工时占比</th>
                <th>完成工序</th>
                <th>出勤天数</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((item, index) => {
                const pct = totalHours > 0 ? (item.totalHours / totalHours) * 100 : 0;
                const barWidth = (item.totalHours / maxHours) * 100;
                return <tr key={item.workerId}>
                  <td><span className={cx(styles["rank-badge"], index < 3 && styles[`rank-${index + 1}`])}>{index + 1}</span></td>
                  <td>
                    <div className={styles["person-cell"]}>
                      <span>{item.workerName.slice(0, 1)}</span>
                      <strong>{item.workerName}</strong>
                    </div>
                  </td>
                  <td><strong className={styles["hours-value"]}>{item.totalHours.toFixed(1)}h</strong></td>
                  <td>
                    <div className={styles["hours-bar-wrap"]}>
                      <div className={styles["hours-bar"]} style={{ width: `${barWidth}%` }} />
                      <span className={styles["hours-bar-label"]}>{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td>{item.completedOperations} 道</td>
                  <td>{item.attendanceDays} 天</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>}
  </>;
}
