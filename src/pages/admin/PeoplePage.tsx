import { useEffect, useState } from "react";
import { Search, ChevronDown, X, Download } from "lucide-react";
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
      <div className={cx(styles["content-header"])}>
        <div>
          <h2>班组工序工时偏差</h2>
          <p>按班组-人员-工序统计累计与当月的计划/实际工时，偏差值 = 实际报工工时 − 总计划工时</p>
        </div>
        <button
          className={cx(styles["export-csv-btn"])}
          onClick={handleExport}
          disabled={exporting || loading || rows.length === 0}
        >
          <Download />
          {exporting ? "导出中..." : "导出CSV"}
        </button>
      </div>
      <div className={cx(styles["reports-filter"])} style={{ marginBottom: 12 }}>
        <div className={cx(styles["filter-select"])}>
          <label>公司</label>
          <select value={queryCompany} onChange={(e) => setQueryCompany(e.target.value as CompanyFilter)}>
            {companyOptions.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className={cx(styles["filter-select"])}>
          <label>班组</label>
          <select value={queryTeam} onChange={(e) => setQueryTeam(e.target.value)}>
            <option value="">全部班组</option>
            {teams.map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}
          </select>
        </div>
      </div>
      {loading ? (
        <LoadingTable />
      ) : error ? (
        <AdminError message={error} retry={() => void reload()} />
      ) : rows.length === 0 ? (
        <section className={cx(styles["admin-panel"])}>
          <div className={styles["empty-inline"]}>暂无可统计的报工数据</div>
        </section>
      ) : (
        <section className={cx(styles["admin-panel"])}>
          <div className={styles["table-wrap"]}>
            <table>
              <thead>
                <tr>
                  <th>班组</th>
                  <th>生产人员</th>
                  <th>工序名称</th>
                  <th>总计划工时</th>
                  <th>实际报工工时</th>
                  <th>偏差值</th>
                  <th>当月计划工时</th>
                  <th>当月实际工时</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const positive = row.deviationHours > 0;
                  const negative = row.deviationHours < 0;
                  return (
                    <tr key={`${row.workerId}-${row.operationName}`}>
                      <td>{row.teamName}</td>
                      <td>
                        <strong>{row.workerName}</strong>
                      </td>
                      <td>{row.operationName}</td>
                      <td>{row.totalPlannedHours.toFixed(1)}h</td>
                      <td>{row.totalActualHours.toFixed(1)}h</td>
                      <td>
                        <strong
                          style={{
                            color: positive ? "#d83931" : negative ? "#1a9c54" : "#333"
                          }}
                        >
                          {positive ? "+" : ""}
                          {row.deviationHours.toFixed(1)}h
                        </strong>
                      </td>
                      <td>{row.monthPlannedHours.toFixed(1)}h</td>
                      <td>{row.monthActualHours.toFixed(1)}h</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <strong>合计</strong>
                  </td>
                  <td>
                    <strong>{totals.planned.toFixed(1)}h</strong>
                  </td>
                  <td>
                    <strong>{totals.actual.toFixed(1)}h</strong>
                  </td>
                  <td>
                    <strong
                      style={{
                        color:
                          totals.actual - totals.planned > 0
                            ? "#d83931"
                            : totals.actual - totals.planned < 0
                              ? "#1a9c54"
                              : "#333"
                      }}
                    >
                      {(totals.actual - totals.planned > 0 ? "+" : "") +
                        (totals.actual - totals.planned).toFixed(1)}
                      h
                    </strong>
                  </td>
                  <td>
                    <strong>{totals.monthPlanned.toFixed(1)}h</strong>
                  </td>
                  <td>
                    <strong>{totals.monthActual.toFixed(1)}h</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
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
    dropdownOpen,
    setDropdownOpen,
    nameOptions,
    searchKeyword,
    setSearchKeyword,
    staff,
    loading,
    error,
    reload,
    maxHours,
    totalHours,
    periodLabel,
    filteredOptions,
    toggleName,
    removeName,
    selectAll
  } = useStaffStats();

  return (
    <>
      <AdminHeader
        title="人员统计"
        description={`${periodLabel}员工工时汇总`}
        action={
          <div className={styles["staff-controls"]}>
            <div className={styles["filter-select"]}>
              <label>公司</label>
              <select value={company} onChange={(event) => setCompany(event.target.value as CompanyFilter)}>
                {companyOptions.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className={styles["dropdown-filter"]}>
              <div
                className={styles["dropdown-display"]}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <Search className={styles["search-icon"]} />
                {selectedNames.length === 0 ? (
                  <span className={styles["dropdown-placeholder"]}>选择工序名称筛选</span>
                ) : (
                  <span className={styles["dropdown-count"]}>已选 {selectedNames.length} 个</span>
                )}
                <ChevronDown className={styles["dropdown-arrow"]} />
              </div>
              {dropdownOpen && (
                <div className={styles["dropdown-panel"]}>
                  <div className={styles["dropdown-search"]}>
                    <Search className={styles["search-icon"]} />
                    <input
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      placeholder="搜索工序名称"
                      className={styles["dropdown-search-input"]}
                    />
                  </div>
                  <div className={styles["dropdown-actions"]}>
                    <button onClick={selectAll} className={styles["dropdown-action-btn"]}>
                      {selectedNames.length === nameOptions.length && nameOptions.length > 0
                        ? "取消全选"
                        : "全选"}
                    </button>
                    {selectedNames.length > 0 && (
                      <button
                        onClick={() => setSelectedNames([])}
                        className={styles["dropdown-action-btn"]}
                      >
                        清空
                      </button>
                    )}
                  </div>
                  <div className={styles["dropdown-options"]}>
                    {filteredOptions.length === 0 ? (
                      <div className={styles["dropdown-empty"]}>无可选工序</div>
                    ) : (
                      filteredOptions.map((name) => (
                        <label key={name} className={styles["dropdown-option"]}>
                          <input
                            type="checkbox"
                            checked={selectedNames.includes(name)}
                            onChange={() => toggleName(name)}
                          />
                          <span>{name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {selectedNames.length > 0 && (
              <div className={styles["selected-tags"]}>
                {selectedNames.map((name) => (
                  <span key={name} className={styles["selected-tag"]}>
                    {name}
                    <X className={styles["tag-close"]} onClick={() => removeName(name)} />
                  </span>
                ))}
              </div>
            )}
            <div className={styles["period-tabs"]}>
              <button
                className={period === "month" ? styles.periodActive : undefined}
                onClick={() => setPeriod("month")}
              >
                本月
              </button>
              <button
                className={period === "lastMonth" ? styles.periodActive : undefined}
                onClick={() => setPeriod("lastMonth")}
              >
                上月
              </button>
            </div>
          </div>
        }
      />
      {loading ? (
        <LoadingTable />
      ) : error ? (
        <AdminError message={error} retry={() => void reload()} />
      ) : staff.length === 0 ? (
        <section className={cx(styles["admin-panel"])}>
          <div className={styles["empty-inline"]}>暂无{periodLabel}工时数据</div>
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
                    return (
                      <tr key={item.workerId}>
                        <td>
                          <span
                            className={cx(styles["rank-badge"], index < 3 && styles[`rank-${index + 1}`])}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td>
                          <div className={styles["person-cell"]}>
                            <span>{item.workerName.slice(0, 1)}</span>
                            <strong>{item.workerName}</strong>
                          </div>
                        </td>
                        <td>
                          <strong className={styles["hours-value"]}>{item.totalHours.toFixed(1)}h</strong>
                        </td>
                        <td>
                          <div className={styles["hours-bar-wrap"]}>
                            <div className={styles["hours-bar"]} style={{ width: `${barWidth}%` }} />
                            <span className={styles["hours-bar-label"]}>{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td>
                          {item.completedOperations} 道
                        </td>
                        <td>
                          {item.attendanceDays} 天
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
