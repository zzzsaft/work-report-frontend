import { useCallback, useState } from "react";
import { ChevronDown, UserPlus } from "lucide-react";
import { workReportRepository } from "@/api/services/workReport.service";
import type { ClaimableOperation, ClaimablePart, WorkerSummary, WorkOrder } from "@/domain/work-report";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { getErrorMessage } from "@/utils/errors";
import { AdminError, AdminHeader, AdminStatus, LoadingTable, SearchBox } from "./adminShared";
import { cx } from "./adminUtils";
import { WorkerPicker } from "./WorkerPicker";
import styles from "./AdminPages.module.less";

export default function OrdersPage() {
  const canAssignWorkers = useWorkReportStore((state) => !!state.capabilities?.canAssignWorkers);
  const canViewTeamOperations = useWorkReportStore((state) => !!(state.capabilities?.canViewTeamOperations || state.capabilities?.canViewAllTeams));
  const [search, setSearch] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [parts, setParts] = useState<Record<string, ClaimablePart[]>>({});
  const [operations, setOperations] = useState<Record<string, ClaimableOperation[]>>({});
  const [panelLoading, setPanelLoading] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(() => workReportRepository.getOrders(), []);
  const { data: orders = [], loading, error, reload } = useAsyncResource<WorkOrder[]>(load);
  const filtered = orders.filter((item) => `${item.orderNo}${item.productName}${item.productCode}`.toLowerCase().includes(search.toLowerCase()));
  const openOrder = async (order: WorkOrder) => {
    setMessage("");
    if (!canViewTeamOperations) {
      setMessage("当前账号没有团队工序视图权限。");
      return;
    }
    const nextOpen = expandedOrderId === order.id ? "" : order.id;
    setExpandedOrderId(nextOpen);
    setSelectedPartId("");
    if (!nextOpen || parts[order.id]) return;
    setPanelLoading(order.id);
    try {
      const { items: products } = await workReportRepository.searchClaimableProducts(order.orderNo, 1, 20);
      const product = products.find((item) => item.orderNo === order.orderNo || item.productCode === order.productCode) || products[0];
      const loadedParts = product ? await workReportRepository.getClaimableParts(product.id) : [];
      setParts((current) => ({ ...current, [order.id]: loadedParts }));
      const firstPart = loadedParts[0];
      if (firstPart) {
        setSelectedPartId(firstPart.id);
        if (!operations[firstPart.id]) {
          const loadedOperations = await workReportRepository.getClaimableOperations(firstPart.id);
          setOperations((current) => ({ ...current, [firstPart.id]: loadedOperations }));
        }
      }
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setPanelLoading("");
    }
  };
  const choosePart = async (partId: string) => {
    setSelectedPartId(partId);
    if (operations[partId]) return;
    setPanelLoading(partId);
    try {
      const loadedOperations = await workReportRepository.getClaimableOperations(partId);
      setOperations((current) => ({ ...current, [partId]: loadedOperations }));
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setPanelLoading("");
    }
  };
  const assignOperation = async (operation: ClaimableOperation, worker: WorkerSummary) => {
    if (!canAssignWorkers) {
      setMessage("当前账号没有员工派工权限。");
      return;
    }
    setMessage("");
    await workReportRepository.adminAssignOperation({ operationId: operation.id, workerId: worker.id, workerName: worker.name });
    setMessage(`已将 ${operation.operationName} 分配给 ${worker.name}`);
    const loadedOperations = await workReportRepository.getClaimableOperations(operation.partId);
    setOperations((current) => ({ ...current, [operation.partId]: loadedOperations }));
  };
  if (error && !loading) return <><AdminHeader title="工单与工序" description="查看源工单进度并管理人员分配" action={<SearchBox value={search} onChange={setSearch} />} /><section className={cx(styles["admin-panel"])}><AdminError message={error} retry={() => void reload()} /></section></>;
  return <><AdminHeader title="工单管理" description="搜索工单，展开工序并手动分配生产人员" action={<SearchBox value={search} onChange={setSearch} placeholder="搜索工单、产品编号或名称" />} />{message && <div className={cx(styles["admin-message"])}>{message}</div>}<section className={cx(styles["admin-panel"], styles["order-management-panel"])}>{loading ? <LoadingTable /> : <div className={cx(styles["order-management-list"])}>{filtered.map((item) => {
    const orderParts = parts[item.id] || [];
    const activePart = selectedPartId && orderParts.some((part) => part.id === selectedPartId) ? selectedPartId : orderParts[0]?.id || "";
    const activeOperations = activePart ? operations[activePart] || [] : [];
    const isOpen = expandedOrderId === item.id;
    return <article className={cx(styles["order-management-card"])} key={item.id}><button className={cx(styles["order-summary-row"])} onClick={() => void openOrder(item)} aria-expanded={isOpen}><div><strong>{item.orderNo}</strong><span>{item.productName} · {item.productCode}</span></div><div className={cx(styles["progress-cell"])}><span><i style={{ width: `${item.progress}%` }} /></span>{item.progress}%</div><AdminStatus status={item.status} />{canViewTeamOperations && <ChevronDown className={isOpen ? styles.rotated : undefined} />}</button>{isOpen && canViewTeamOperations && <div className={cx(styles["order-operation-panel"])}>{panelLoading === item.id ? <LoadingTable /> : <><div className={cx(styles["part-tabs"])}>{orderParts.map((part) => <button key={part.id} className={activePart === part.id ? styles.active : undefined} onClick={() => void choosePart(part.id)}><strong>{part.partCode}</strong><span>{part.partNo && `[${part.partNo}] `}{part.partName}</span></button>)}</div>{panelLoading === activePart ? <LoadingTable /> : activeOperations.length ? <div className={cx(styles["operation-assignment-list"])}>{activeOperations.map((operation) => <OperationAssignRow key={operation.id} operation={operation} canAssign={canAssignWorkers} onAssign={assignOperation} />)}</div> : <div className={cx(styles["empty-inline"])}>当前工单暂无可分配工序。</div>}</>}</div>}</article>;
  })}{!filtered.length && <div className={cx(styles["empty-inline"])}>没有匹配的工单。</div>}</div>}</section></>;
}

function OperationAssignRow({ operation, canAssign, onAssign }: { operation: ClaimableOperation; canAssign: boolean; onAssign: (operation: ClaimableOperation, worker: WorkerSummary) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const full = operation.maxClaimWorkers ? operation.claimedWorkers >= operation.maxClaimWorkers : false;
  const disabled = !canAssign || operation.status !== "available" || full;
  return <article className={cx(styles["operation-assignment-row"])}><div><strong>{operation.operationCode} · {operation.operationNo && `[${operation.operationNo}] `}{operation.operationName}</strong><span>{operation.partName} · {operation.plannedQuantity} 件 · {operation.estimatedHours} 小时</span></div><div className={cx(styles["operation-capacity"])}><span>{operation.claimedWorkers}{operation.maxClaimWorkers ? `/${operation.maxClaimWorkers}` : ""} 人</span><AdminStatus status={operation.status} /></div>{canAssign && <button className={cx(styles["admin-primary-action"], styles["slim"])} disabled={disabled} onClick={() => setOpen((value) => !value)}><UserPlus />分配人员</button>}{open && !disabled && <WorkerPicker operation={operation} onAssigned={async (worker) => { await onAssign(operation, worker); setOpen(false); }} />}</article>;
}
