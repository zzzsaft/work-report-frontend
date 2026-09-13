import { Alert, Button } from "@jc-times/business-ui";
import { ReportTable } from "@/components/ui/ReportTable";
import { useCallback, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { workReportRepository } from "@/api/services/workReport.service";
import type { PermissionGroup, WorkerPermission } from "@/domain/work-report";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { getErrorMessage } from "@/utils/errors";
import { AdminError, AdminHeader, LoadingTable, SearchBox } from "./adminShared";
import { cx, permissionOptions } from "./adminUtils";
import styles from "./AdminPages.module.less";

export default function PermissionsPage() {
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(() => workReportRepository.getWorkerPermissions(), []);
  const { data: people = [], loading, error, reload } = useAsyncResource<WorkerPermission[]>(load);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return people;
    return people.filter((item) => `${item.employeeNo}${item.name}${item.nameInitials}${item.teamName}`.toLowerCase().includes(keyword));
  }, [people, search]);
  const counts = useMemo(() => permissionOptions.map((option) => ({
    ...option,
    count: people.filter((item) => item.permissionGroup === option.value).length,
  })), [people]);
  const updatePermission = async (person: WorkerPermission, permissionGroup: PermissionGroup) => {
    if (person.permissionGroup === permissionGroup) return;
    setSavingId(person.id);
    setMessage("");
    try {
      const option = permissionOptions.find((item) => item.value === permissionGroup);
      await workReportRepository.updateWorkerPermission(person.id, permissionGroup);
      setMessage(`已将 ${person.name} 设置为${option?.label ?? permissionGroup}`);
      await reload();
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSavingId("");
    }
  };
  return <><AdminHeader title="权限设置" description="罗列所有人员，并为每个人选择权限组" action={<SearchBox value={search} onChange={setSearch} placeholder="搜索姓名、工号、班组或首字母" />} />{message && <Alert className={cx(styles["admin-message"])} tone={"info"} description={<>{message}</>} />}<div className={cx(styles["permission-summary-grid"])}>{counts.map((item) => <article key={item.value} className={cx(styles["admin-panel"], styles["permission-summary-card"])}><div className={cx(styles["settings-icon"])}><ShieldCheck /></div><div><strong>{item.count}</strong><span>{item.label}</span></div><p>{item.description}</p></article>)}</div><section className={cx(styles["admin-panel"], styles["permission-panel"])}>{loading ? <LoadingTable /> : error ? <AdminError message={error} retry={() => void reload()} /> : <div className={cx(styles["table-wrap"])}><ReportTable  columns={[{ title: "人员" },
{ title: "工号" },
{ title: "班组" },
{ title: "当前任务" },
{ title: "权限组" }]} rows={filtered.map((person) => ({ id: String(person.id), cells: [<><div className={cx(styles["person-cell"])}><span>{person.name.slice(0,1)}</span><strong>{person.name}</strong></div></>,
<>{person.employeeNo}</>,
<>{person.teamName}</>,
<>{person.activeAssignmentCount}道</>,
<><div className={cx(styles["permission-select-cell"])}>{permissionOptions.map((option) => <Button variant="ghost" key={option.value} className={person.permissionGroup === option.value ? styles.selected : undefined} disabled={savingId === person.id} onClick={() => void updatePermission(person, option.value)}>{savingId === person.id && person.permissionGroup !== option.value ? <span className="spinner small" /> : option.label}</Button>)}</div></> ] }))} emptyTitle={"没有匹配的人员。"} /></div>}</section></>;
}
