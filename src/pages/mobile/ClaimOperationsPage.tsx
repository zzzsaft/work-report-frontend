import { useEffect, useState } from "react";
import { getOperationTimes } from "@/api/http/laborDataClient";
import type { ClaimableOperation } from "@/domain/work-report";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { ClaimOperationsPanel } from "./ClaimOperationsPanel";
import { cx } from "./mobileUtils";
import { ErrorBanner, PageHeader } from "./shared";
import sharedStyles from "./mobileShared.module.less";
import pageStyles from "./ClaimOperationsPage.module.less";

const styles = { ...pageStyles, ...sharedStyles };

export function ClaimOperationsPage() {
  const {
    actionLoading, claimLoading, claimProducts, claimProductsPagination, claimParts, claimOperations, recentClaimOperations, error,
    searchClaimableProducts, loadRecentClaimableOperations, loadClaimableParts, loadClaimableOperations, claimOperation, clearError,
  } = useWorkReportStore();
  const [claimedOperation, setClaimedOperation] = useState<ClaimableOperation | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timesLoading, setTimesLoading] = useState(false);
  useEffect(() => { void loadRecentClaimableOperations(); }, [loadRecentClaimableOperations]);

  useEffect(() => {
    if (!claimedOperation) {
      setTimesLoading(false);
      return;
    }

    let cancelled = false;
    setStartTime("");
    setEndTime("");
    setTimesLoading(true);

    const fetchOperationTimes = async () => {
      try {
        const jobNum = claimedOperation.orderNo;
        const assemblySeq = claimedOperation.partNo || "0";
        const oprSeq = claimedOperation.operationNo || "0";

        const times = await getOperationTimes(jobNum, assemblySeq, oprSeq, claimedOperation.estimatedHours);
        if (cancelled) return;
        setStartTime(times.startTime);
        setEndTime(times.endTime);
      } finally {
        if (!cancelled) setTimesLoading(false);
      }
    };

    void fetchOperationTimes();
    return () => { cancelled = true; };
  }, [claimedOperation]);

  const handleConfirmClaim = async (startAt: string, endAt: string) => {
    if (!claimedOperation) return;
    if (!startAt || !endAt || new Date(startAt).getTime() > new Date(endAt).getTime()) return;
    try {
      await claimOperation(claimedOperation.id, { startTime: startAt, endTime: endAt });
      setClaimedOperation(null);
      await loadRecentClaimableOperations();
    } catch (err) {
      console.error("Failed to claim operation:", err);
    }
  };

  const handleCancelClaim = () => {
    setClaimedOperation(null);
    setStartTime("");
    setEndTime("");
  };

  return <div className={cx(styles["standard-page"], styles["claim-page"])}>
    <PageHeader title="领取工序" subtitle="搜索产品编号，选择部件后领取自己的工序" />
    {error && <ErrorBanner message={error} retry={() => { clearError(); void loadRecentClaimableOperations(); }} />}
    <ClaimOperationsPanel loading={claimLoading || actionLoading} products={claimProducts} productPagination={claimProductsPagination} parts={claimParts} operations={claimOperations} recentOperations={recentClaimOperations} claimed={claimedOperation} startTime={startTime} endTime={endTime} timesLoading={timesLoading} onSearch={searchClaimableProducts} onLoadRecent={loadRecentClaimableOperations} onLoadParts={loadClaimableParts} onLoadOperations={loadClaimableOperations} onClaim={(operationId) => { const op = claimOperations.find((o: ClaimableOperation) => o.id === operationId) || recentClaimOperations.find((o: ClaimableOperation) => o.id === operationId); if (op) setClaimedOperation(op); }} onConfirmClaim={handleConfirmClaim} onCancelClaim={handleCancelClaim} />
  </div>;
}
