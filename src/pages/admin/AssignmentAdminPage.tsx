import { Fragment, useCallback, useState } from "react";
import { Search, Trash2, UserPlus } from "lucide-react";
import { workReportRepository } from "@/api/services/workReport.service";
import { canWorkerRemoveAssignment, type ClaimableOperation, type OperationAssignment, type WorkerSummary } from "@/domain/work-report";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { AdminHeader, AdminStatus, LoadingTable, SearchBox } from "./adminShared";
import { cx } from "./adminUtils";
import { WorkerPicker } from "./WorkerPicker";
import styles from "./AdminPages.module.less";

export default function AssignmentAdminPage() {
  const canAssignWorkers = useWorkReportStore((state) => !!state.capabilities?.canAssignWorkers);
  const canForceRemoveAssignments = useWorkReportStore((state) => !!state.capabilities?.canForceRemoveAssignments);
  const [keyword, setKeyword] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [operations, setOperations] = useState<ClaimableOperation[]>([]);
  const [assignTargetId, setAssignTargetId] = useState("");
  const [message, setMessage] = useState("");
  const loadProducts = useCallback(async () => canAssignWorkers ? (await workReportRepository.searchClaimableProducts(keyword, 1, 20)).items : [], [canAssignWorkers, keyword]);
  const { data: products = [], loading: productsLoading, reload } = useAsyncResource(loadProducts);
  const { data: assignments = [], loading: assignmentsLoading, reload: reloadAssignments } = useAsyncResource<OperationAssignment[]>(useCallback(() => workReportRepository.getAssignments(), []));
  const loadParts = async (productId: string) => {
    setSelectedProduct(productId);
    setSelectedPart("");
    setOperations([]);
  };
  const { data: parts = [] } = useAsyncResource(useCallback(() => selectedProduct ? workReportRepository.getClaimableParts(selectedProduct) : Promise.resolve([]), [selectedProduct]));
  const choosePart = async (partId: string) => {
    setSelectedPart(partId);
    setAssignTargetId("");
    setOperations(await workReportRepository.getClaimableOperations(partId));
  };
  const assign = async (operation: ClaimableOperation, worker: WorkerSummary) => {
    if (!canAssignWorkers) {
      setMessage("当前账号没有员工派工权限。");
      return;
    }
    setMessage("");
    await workReportRepository.adminAssignOperation({ operationId: operation.id, workerId: worker.id, workerName: worker.name });
    setMessage(`已将 ${operation.operationName} 分配给 ${worker.name}`);
    setAssignTargetId("");
    setOperations(await workReportRepository.getClaimableOperations(operation.partId));
    await reloadAssignments();
  };
  const forceRemove = async (assignmentId: string) => {
    if (!canForceRemoveAssignments) {
      setMessage("当前账号没有强制移除权限。");
      return;
    }
    const reason = "管理员调整工单项目";
    await workReportRepository.adminRemoveAssignment(assignmentId, reason);
    setMessage("已由高级后台移除，并写入报工记录");
    await reloadAssignments();
  };
  return <><AdminHeader title="人员工序分配" description="高级后台可分配工序，也可处理已开始或不可自删的工序" action={canAssignWorkers && <div className={cx(styles["admin-inline-actions"])}><SearchBox value={keyword} onChange={setKeyword} /><button className={cx(styles["admin-primary-action"])} onClick={() => void reload()}><Search />搜索</button></div>} />{message && <div className={cx(styles["admin-message"])}>{message}</div>}{canAssignWorkers && <div className={cx(styles["assignment-admin-grid"])}><section className={cx(styles["admin-panel"], styles["settings-card"])}><div className={cx(styles["settings-icon"])}><UserPlus /></div><h2>产品与部件</h2>{productsLoading ? <LoadingTable /> : <div className={cx(styles["admin-choice-list"])}>{products.map((item) => <button key={item.id} className={selectedProduct === item.id ? styles.selected : undefined} onClick={() => void loadParts(item.id)}><strong>{item.productCode}</strong><span>{item.productName}</span></button>)}</div>}<div className={cx(styles["admin-choice-list"], styles["compact"])}>{parts.map((item) => <button key={item.id} className={selectedPart === item.id ? styles.selected : undefined} onClick={() => void choosePart(item.id)}><strong>{item.partCode}</strong><span>{item.partNo && `[${item.partNo}] `}{item.partName}</span></button>)}</div></section><section className={cx(styles["admin-panel"])}><div className={cx(styles["table-wrap"])}><table><thead><tr><th>工序</th><th>部件</th><th>数量</th><th>工时</th><th>已领</th><th>操作</th></tr></thead><tbody>{operations.map((item) => <Fragment key={item.id}><tr><td><strong>{item.operationCode}</strong><small>{item.operationNo && `[${item.operationNo}] `}{item.operationName}</small></td><td>{item.partCode}</td><td>{item.plannedQuantity}</td><td>{item.estimatedHours}</td><td>{item.claimedWorkers}</td><td><button className={cx(styles["table-action"])} disabled={item.status !== "available"} onClick={() => setAssignTargetId((value) => value === item.id ? "" : item.id)}>选择人员</button></td></tr>{assignTargetId === item.id && <tr><td colSpan={6}><WorkerPicker operation={item} onAssigned={(worker) => assign(item, worker)} /></td></tr>}</Fragment>)}{!operations.length && <tr><td colSpan={6}>请选择产品和部件后查看工序。</td></tr>}</tbody></table></div></section></div>}<section className={cx(styles["admin-panel"], styles["chart-panel"])}><div className={cx(styles["panel-heading"])}><div><h2>当前人员工序</h2><p>高级后台可移除已开始、自领或后台分配的异常工序</p></div></div>{assignmentsLoading ? <LoadingTable /> : <div className={cx(styles["table-wrap"])}><table><thead><tr><th>工单</th><th>产品/部件</th><th>工序</th><th>人员</th><th>来源</th><th>状态</th><th>员工可删</th>{canForceRemoveAssignments && <th>高级操作</th>}</tr></thead><tbody>{assignments.map((item) => <tr key={item.id}><td><strong>{item.orderNo}</strong></td><td>{item.productCode}<small>{item.partCode}</small></td><td>{item.operationName}</td><td>{item.collaborators.join(" / ")}</td><td>{item.source === "self_claimed" ? "自主领取" : "后台分配"}</td><td><AdminStatus status={item.status} /></td><td>{canWorkerRemoveAssignment(item) ? "是" : "否"}</td>{canForceRemoveAssignments && <td><button className={cx(styles["table-action"], styles["danger-action"])} onClick={() => void forceRemove(item.id)}><Trash2 />移除</button></td>}</tr>)}</tbody></table></div>}</section></>;
}
