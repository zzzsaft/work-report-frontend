import { Badge, Button, EmptyState, MultiSelect, SegmentedControl, SelectInput } from "@jc-times/business-ui";
import { ReportTable } from "@/components/ui/ReportTable";
import { AdminHeader, AdminError, LoadingTable } from "./adminShared";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";
import { companyOptions, type CompanyFilter } from "./types";
import { useStaffStats } from "./hooks/useStaffStats";

export default function PeoplePage() {
  const {
    period,
    setPeriod,
    company,
    setCompany,
    selectedNames,
    setSelectedNames,
    nameOptions,
    staff,
    loading,
    error,
    reload,
    maxHours,
    totalHours,
    periodLabel,
  } = useStaffStats();

  return (
    <>
      <AdminHeader
        title="人员统计"
        description={`${periodLabel}员工工时汇总`}
        action={
          <div className={styles["staff-controls"]}>
            <div>

              <SelectInput label={<>公司</>} value={company} onChange={(event) => setCompany(event.target.value as CompanyFilter)}>
                {companyOptions.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
              </SelectInput>
            </div>
            <div className={styles["staff-process-filter"]}>
              <MultiSelect label="工序名称" placeholder="选择工序名称筛选" values={selectedNames}
                onValuesChange={setSelectedNames} items={nameOptions.map((name) => ({ id: name, label: name }))} />
              <Button variant="ghost" disabled={!nameOptions.length}
                onClick={() => setSelectedNames(selectedNames.length === nameOptions.length ? [] : [...nameOptions])}>
                {nameOptions.length > 0 && selectedNames.length === nameOptions.length ? "取消全选" : "全选"}
              </Button>
            </div>
            <SegmentedControl<"month" | "lastMonth"> aria-label="统计期间" value={period} onChange={setPeriod}
              options={[{ value: "month", label: "本月" }, { value: "lastMonth", label: "上月" }]} block={false} variant="soft" />
          </div>
        }
      />
      {loading ? (
        <LoadingTable />
      ) : error ? (
        <AdminError message={error} retry={() => void reload()} />
      ) : staff.length === 0 ? (
        <section className={cx(styles["admin-panel"])}>
          <EmptyState className={styles["empty-inline"]} compact title={<>暂无{periodLabel}工时数据</>} />
        </section>
      ) : (
        <>
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
              <ReportTable  columns={[{ title: "排名", width: 60 },
{ title: "生产人员" },
{ title: "总工时" },
{ title: "工时占比" },
{ title: "完成工序" },
{ title: "出勤天数" }]} rows={staff.map((item, index) => {
                    const pct = totalHours > 0 ? (item.totalHours / totalHours) * 100 : 0;
                    const barWidth = (item.totalHours / maxHours) * 100;
                    return (
                      ({ id: String(item.workerId), cells: [<><Badge
                            className={cx(styles["rank-badge"], index < 3 && styles[`rank-${index + 1}`])}
                          >
                            {index + 1}
                          </Badge></>,
<><div className={styles["person-cell"]}>
                            <span>{item.workerName.slice(0, 1)}</span>
                            <strong>{item.workerName}</strong>
                          </div></>,
<><strong className={styles["hours-value"]}>{item.totalHours.toFixed(1)}h</strong></>,
<><div className={styles["hours-bar-wrap"]}>
                            <div className={styles["hours-bar"]} style={{ width: `${barWidth}%` }} />
                            <span className={styles["hours-bar-label"]}>{pct.toFixed(1)}%</span>
                          </div></>,
<>{item.completedOperations}道
                        </>,
<>{item.attendanceDays}天
                        </> ] })
                    );
                  })} emptyTitle={"暂无数据"} />
            </div>
          </section>
        </>
      )}
    </>
  );
}
