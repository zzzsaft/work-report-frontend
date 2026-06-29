import { afterEach, describe, expect, it } from "vitest";
import { workReportRepository } from "@/api/services/workReport.service";
import type { ClaimableOperation, ClaimablePart, ClaimableProduct, LaborStatistics, OperationAssignment, UserCapabilities } from "@/domain/work-report";
import { useWorkReportStore } from "./useWorkReportStore";

const originalGetAssignments = workReportRepository.getAssignments;
const originalGetStatistics = workReportRepository.getStatistics;
const originalGetCapabilities = workReportRepository.getCapabilities;
const originalSearchClaimableProducts = workReportRepository.searchClaimableProducts;
const originalGetClaimableParts = workReportRepository.getClaimableParts;
const originalGetClaimableOperations = workReportRepository.getClaimableOperations;

const statistics = (period: LaborStatistics["period"]): LaborStatistics => ({
  period, totalHours: 1, regularHours: 1, overtimeHours: 0, completedOperations: 1,
  attendanceDays: 1, trend: [],
});

const capabilities = (canViewAdmin: boolean): UserCapabilities => ({
  roles: canViewAdmin ? ["worker", "leader"] : ["worker"],
  canViewAdmin,
  canAssignWorkers: false,
  canReviewExceptions: false,
  canImportOperations: false,
  canViewTeamOperations: false,
  canForceRemoveAssignments: false,
  canViewAllTeams: false,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => {
  workReportRepository.getAssignments = originalGetAssignments;
  workReportRepository.getStatistics = originalGetStatistics;
  workReportRepository.getCapabilities = originalGetCapabilities;
  workReportRepository.searchClaimableProducts = originalSearchClaimableProducts;
  workReportRepository.getClaimableParts = originalGetClaimableParts;
  workReportRepository.getClaimableOperations = originalGetClaimableOperations;
  useWorkReportStore.setState({
    assignments: [], statistics: null, capabilities: null, recentClaimOperations: [], assignmentsLoading: false, statisticsLoading: false, capabilitiesLoading: false, claimLoading: false, error: null,
  });
});

describe("work report request state", () => {
  it("keeps assignment and statistics loading states independent", async () => {
    const assignments = deferred<OperationAssignment[]>();
    const stats = deferred<LaborStatistics>();
    workReportRepository.getAssignments = () => assignments.promise;
    workReportRepository.getStatistics = () => stats.promise;

    const assignmentsRequest = useWorkReportStore.getState().loadAssignments();
    const statisticsRequest = useWorkReportStore.getState().loadStatistics("week");
    expect(useWorkReportStore.getState()).toMatchObject({ assignmentsLoading: true, statisticsLoading: true });

    assignments.resolve([]);
    await assignmentsRequest;
    expect(useWorkReportStore.getState()).toMatchObject({ assignmentsLoading: false, statisticsLoading: true });
    stats.resolve(statistics("week"));
    await statisticsRequest;
  });

  it("ignores a stale statistics response", async () => {
    const week = deferred<LaborStatistics>();
    const month = deferred<LaborStatistics>();
    workReportRepository.getStatistics = (period) => period === "week" ? week.promise : month.promise;

    const oldRequest = useWorkReportStore.getState().loadStatistics("week");
    const latestRequest = useWorkReportStore.getState().loadStatistics("month");
    month.resolve(statistics("month"));
    await latestRequest;
    week.resolve(statistics("week"));
    await oldRequest;

    expect(useWorkReportStore.getState().statistics?.period).toBe("month");
    expect(useWorkReportStore.getState().statisticsLoading).toBe(false);
  });

  it("reloads capabilities when force is true and overwrites the cached state", async () => {
    let calls = 0;
    workReportRepository.getCapabilities = async () => capabilities(++calls > 1);

    await useWorkReportStore.getState().loadCapabilities();
    expect(useWorkReportStore.getState().capabilities?.canViewAdmin).toBe(false);

    await useWorkReportStore.getState().loadCapabilities();
    expect(calls).toBe(1);

    await useWorkReportStore.getState().loadCapabilities({ force: true });
    expect(calls).toBe(2);
    expect(useWorkReportStore.getState().capabilities?.canViewAdmin).toBe(true);
  });

  it("keeps scanning products when the first recent batch has no operations", async () => {
    const products: ClaimableProduct[] = Array.from({ length: 7 }, (_, index) => ({
      id: `product-${index + 1}`,
      orderNo: `WO-${index + 1}`,
      productCode: `P-${index + 1}`,
      productName: "产品",
      remainingQuantity: 1,
    }));
    const part: ClaimablePart = {
      id: "part-7",
      productId: "product-7",
      partNo: "7",
      partCode: "PART-7",
      partName: "部件",
      operationCount: 1,
      remainingQuantity: 1,
    };
    const operation: ClaimableOperation = {
      id: "operation-7",
      productId: "product-7",
      partId: "part-7",
      orderNo: "WO-7",
      productCode: "P-7",
      productName: "产品",
      partCode: "PART-7",
      partName: "部件",
      operationNo: "10",
      operationCode: "OP-010",
      operationName: "加工",
      operationNote: "测试工序",
      plannedQuantity: 1,
      estimatedHours: 1,
      claimedWorkers: 0,
      status: "available",
    };

    workReportRepository.searchClaimableProducts = async () => products;
    workReportRepository.getClaimableParts = async (productId) => productId === "product-7" ? [part] : [];
    workReportRepository.getClaimableOperations = async (partId) => partId === "part-7" ? [operation] : [];

    await useWorkReportStore.getState().loadRecentClaimableOperations();

    expect(useWorkReportStore.getState().recentClaimOperations).toEqual([operation]);
  });
});
