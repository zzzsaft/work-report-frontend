import { Search, ChevronDown, X } from "lucide-react";
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
    </>
  );
}
