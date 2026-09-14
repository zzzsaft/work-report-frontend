import { Badge, Button, EmptyState, MultiSelect, SegmentedControl, SelectInput } from "@jc-times/business-ui";
import { ReportTable } from "@/components/ui/ReportTable";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { workReportRepository } from "@/api/services/workReport.service";
import { AdminHeader, AdminError, LoadingTable } from "./adminShared";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";
import { companyOptions, type CompanyFilter } from "./types";
import { useStaffStats } from "./hooks/useStaffStats";
import { useTeamOperationStats } from "./hooks/useTeamOperationStats";
import { buildTeamOperationStatsCsv } from "./reportExport";

function TeamOperationStatsSection() {
  const [queryCompany, setQueryCompany] = useState<CompanyFilter>("");
  const [queryTeam, setQueryTeam] = useState("");
  const { rows, loading, error, reload } = useTeamOperationStats(queryCompany, queryTeam);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    workReportRepository.listTeams().then((list) => {
      if (!cancelled) setTeams(list.map((team) => ({ id: team.id, name: team.name })));
    }).catch(() => {
      if (!cancelled) setTeams([]);
    });
    return () => { cancelled = true; };
  }, []);

  const handleExport = () => {
    if (!rows.length) return;
    setExporting(true);
    try {
      const csvContent = buildTeamOperationStatsCsv(rows);
      const blob = new Blob([String.fromCharCode(0xfeff) + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const companyLabel = queryCompany ? `_${queryCompany === "jctimes" ? "精诚" : "精艺"}` : "";
      const teamLabel = queryTeam ? `_${queryTeam}` : "";
      link.download = `班组工序工时偏差${companyLabel}${teamLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setExporting(false);
    }
  };

  const totals = rows.reduce(
    (acc, row) => {
      acc.planned += row.totalPlannedHours;
      acc.actual += row.totalActualHours;
      acc.monthPlanned += row.monthPlannedHours;
      acc.monthActual += row.monthActualHours;
      return acc;
    },
    { planned: 0, actual: 0, monthPlanned: 0, monthActual: 0 }
  );

  return (
    <>
      <div className={cx(styles["content-header"])} style={{ flexWrap: "wrap", gap: 16 }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <h2>班组工序工时偏差</h2>
          <p>按班组-人员-工序统计累计与当月的计划/实际工时，偏差值 = 实际报工工时 − 总计划工时</p>
        </div>
        <Button variant="primary"
          style={{ flexShrink: 0, whiteSpace: "nowrap" }}
          className={cx(styles["export-csv-btn"])}
          onClick={handleExport}
          disabled={exporting || loading || rows.length === 0}
        >
          <Download />
          {exporting ? "导出中..." : "导出CSV"}
        </Button>
      </div>
      <div className={cx(styles["reports-filter"])} style={{ marginBottom: 12 }}>
        <div className={cx(styles["filter-select"])}>
          <SelectInput label="公司" value={queryCompany} onChange={(e) => setQueryCompany(e.target.value as CompanyFilter)}>
            {companyOptions.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
          </SelectInput>
        </div>
        <div className={cx(styles["filter-select"])}>
          <SelectInput label="班组" value={queryTeam} onChange={(e) => setQueryTeam(e.target.value)}>
            <option value="">全部班组</option>
            {teams.map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}
          </SelectInput>
        </div>
      </div>
      {loading ? (
        <LoadingTable />
      ) : error ? (
        <AdminError message={error} retry={() => void reload()} />
      ) : rows.length === 0 ? (
        <section className={cx(styles["admin-panel"])}>
          <EmptyState compact title="暂无可统计的报工数据" />
        </section>
      ) : (
        <section className={cx(styles["admin-panel"])}>
          <div className={styles["table-wrap"]}>
            <ReportTable columns={['班组', '生产人员', '工序名称', '总计划工时', '实际报工工时', '偏差值', '当月计划工时', '当月实际工时'].map(title => ({ title }))}
              rows={[...rows.map(row => ({ id: JSON.stringify([row.teamName, row.workerId, row.operationName]), cells: [
                row.teamName, <strong>{row.workerName}</strong>, row.operationName,
                row.totalPlannedHours.toFixed(1) + 'h', row.totalActualHours.toFixed(1) + 'h',
                <strong style={{ color: row.deviationHours > 0 ? 'var(--danger)' : row.deviationHours < 0 ? 'var(--success)' : 'var(--ink)' }}>{row.deviationHours > 0 ? '+' : ''}{row.deviationHours.toFixed(1)}h</strong>,
                row.monthPlannedHours.toFixed(1) + 'h', row.monthActualHours.toFixed(1) + 'h'
              ] })), { id: 'total', cells: [<strong>合计</strong>, '', '',
                totals.planned.toFixed(1) + 'h', totals.actual.toFixed(1) + 'h',
                <strong style={{ color: totals.actual > totals.planned ? 'var(--danger)' : totals.actual < totals.planned ? 'var(--success)' : 'var(--ink)' }}>{totals.actual > totals.planned ? '+' : ''}{(totals.actual - totals.planned).toFixed(1)}h</strong>,
                totals.monthPlanned.toFixed(1) + 'h', totals.monthActual.toFixed(1) + 'h'
              ] }]} />
          </div>
        </section>
      )}
    </>
  );
}

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
      <div style={{ marginTop: 24 }}>
        <TeamOperationStatsSection />
      </div>
    </>
  );
}
