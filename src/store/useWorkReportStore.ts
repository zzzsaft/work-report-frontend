import { create } from "zustand";
import { workReportRepository } from "@/api/services/workReport.service";
import type { ClaimableOperation, ClaimablePart, ClaimableProduct, LaborStatistics, OperationAssignment, UserCapabilities } from "@/domain/work-report";
import type { CompletionInput, PaginatedResult } from "@/api/services/workReport.repository";
import { canSwitchFromAssignment, getCurrentSwitchCandidatesForDate, getPendingAssignmentsForDate, getSwitchableAssignmentsForDate } from "@/domain/work-report";
import { getErrorMessage } from "@/utils/errors";

interface WorkReportState {
  current: OperationAssignment | null;
  assignments: OperationAssignment[];
  statistics: LaborStatistics | null;
  capabilities: UserCapabilities | null;
  nextCandidates: OperationAssignment[];
  switchCandidates: OperationAssignment[];
  claimProducts: ClaimableProduct[];
  claimProductsPagination: PaginatedResult<ClaimableProduct>;
  claimParts: ClaimablePart[];
  claimOperations: ClaimableOperation[];
  recentClaimOperations: ClaimableOperation[];
  dayCompleted: boolean;
  currentLoading: boolean;
  assignmentsLoading: boolean;
  statisticsLoading: boolean;
  capabilitiesLoading: boolean;
  claimLoading: boolean;
  actionLoading: boolean;
  error: string | null;
  loadCurrent: () => Promise<void>;
  loadAssignments: () => Promise<void>;
  loadStatistics: (period: LaborStatistics["period"]) => Promise<void>;
  loadCapabilities: (options?: { force?: boolean }) => Promise<void>;
  searchClaimableProducts: (keyword: string, page?: number, pageSize?: number) => Promise<void>;
  loadRecentClaimableOperations: () => Promise<void>;
  loadClaimableParts: (productId: string) => Promise<void>;
  loadClaimableOperations: (partId: string) => Promise<void>;
  claimOperation: (operationId: string, input?: { startTime?: string; endTime?: string }) => Promise<OperationAssignment | null>;
  removeClaimedAssignment: (assignmentId: string) => Promise<void>;
  start: () => Promise<void>;
  pause: (reason?: string) => Promise<void>;
  resume: () => Promise<void>;
  complete: (input: CompletionInput) => Promise<void>;
  selectNext: (assignment: OperationAssignment) => void;
  switchCurrent: (assignment: OperationAssignment) => Promise<void>;
  clearWorkReportState: () => void;
  clearError: () => void;
}

const emptyWorkReportState = {
  current: null,
  assignments: [],
  statistics: null,
  capabilities: null,
  nextCandidates: [],
  switchCandidates: [],
  claimProducts: [],
  claimProductsPagination: { items: [], page: 1, pageSize: 4, total: 0, hasMore: false },
  claimParts: [],
  claimOperations: [],
  recentClaimOperations: [],
  dayCompleted: false,
};

const recentClaimProductBatchSize = 6;
const recentClaimOperationLimit = 12;
const claimProductPageSize = 4;

const loadRecentClaimableOperations = async () => {
  const products: ClaimableProduct[] = [];
  const operations: ClaimableOperation[] = [];

  for (let page = 1; products.length < recentClaimProductBatchSize || operations.length < recentClaimOperationLimit; page += 1) {
    const result = await workReportRepository.searchClaimableProducts("", page, recentClaimProductBatchSize);
    products.push(...result.items);
    if (!result.hasMore || products.length >= recentClaimProductBatchSize * 3) break;
  }

  for (let start = 0; start < products.length && operations.length < recentClaimOperationLimit; start += recentClaimProductBatchSize) {
    const productBatch = products.slice(start, start + recentClaimProductBatchSize);
    const partsByProduct = await Promise.all(productBatch.map((product) => workReportRepository.getClaimableParts(product.id)));
    const parts = partsByProduct.flat();
    const operationsByPart = await Promise.all(parts.map((part) => workReportRepository.getClaimableOperations(part.id)));
    operations.push(...operationsByPart.flat());
  }

  return operations.slice(0, recentClaimOperationLimit);
};

export const useWorkReportStore = create<WorkReportState>((set, get) => {
  let currentRequest = 0;
  let assignmentsRequest = 0;
  let statisticsRequest = 0;
  let capabilitiesRequest = 0;

  const act = async (action: (id: string) => Promise<OperationAssignment>) => {
    const current = get().current;
    if (!current || get().actionLoading) return;
    set({ actionLoading: true, error: null });
    try { set({ current: await action(current.id) }); }
    catch (error) { set({ error: getErrorMessage(error) }); throw error; }
    finally { set({ actionLoading: false }); }
  };
  return {
    ...emptyWorkReportState,
    currentLoading: false, assignmentsLoading: false, statisticsLoading: false, capabilitiesLoading: false, claimLoading: false,
    actionLoading: false, error: null,
    loadCurrent: async () => {
      const request = ++currentRequest;
      set({ currentLoading: true, error: null });
      try {
        const [current, capabilities, assignments] = await Promise.all([
          workReportRepository.getCurrentAssignment(),
          workReportRepository.getCapabilities(),
          workReportRepository.getAssignments(),
        ]);
        if (request !== currentRequest) return;
        const todayPending = getPendingAssignmentsForDate(assignments, new Date());
        const switchCandidates = getCurrentSwitchCandidatesForDate(assignments, new Date(), current?.id);
        set({ current, capabilities, assignments, switchCandidates, dayCompleted: !current && todayPending.length === 0 });
      } catch (error) {
        if (request === currentRequest) set({ error: getErrorMessage(error) });
      } finally {
        if (request === currentRequest) set({ currentLoading: false });
      }
    },
    loadAssignments: async () => {
      const request = ++assignmentsRequest;
      set({ assignmentsLoading: true, error: null });
      try {
        const assignments = await workReportRepository.getAssignments();
        if (request === assignmentsRequest) set({ assignments, switchCandidates: getCurrentSwitchCandidatesForDate(assignments, new Date(), get().current?.id) });
      } catch (error) {
        if (request === assignmentsRequest) set({ error: getErrorMessage(error) });
      } finally {
        if (request === assignmentsRequest) set({ assignmentsLoading: false });
      }
    },
    loadStatistics: async (period) => {
      const request = ++statisticsRequest;
      set({ statisticsLoading: true, error: null });
      try {
        const statistics = await workReportRepository.getStatistics(period);
        if (request === statisticsRequest) set({ statistics });
      } catch (error) {
        if (request === statisticsRequest) set({ error: getErrorMessage(error) });
      } finally {
        if (request === statisticsRequest) set({ statisticsLoading: false });
      }
    },
    loadCapabilities: async (options) => {
      if (!options?.force && (get().capabilities || get().capabilitiesLoading)) return;
      const request = ++capabilitiesRequest;
      set({ capabilitiesLoading: true, error: null });
      try {
        const capabilities = await workReportRepository.getCapabilities();
        if (request === capabilitiesRequest) set({ capabilities });
      } catch (error) {
        if (request === capabilitiesRequest) set({ error: getErrorMessage(error) });
      } finally {
        if (request === capabilitiesRequest) set({ capabilitiesLoading: false });
      }
    },
    searchClaimableProducts: async (keyword, page = 1, pageSize = claimProductPageSize) => {
      set({ claimLoading: true, error: null });
      try {
        const result = await workReportRepository.searchClaimableProducts(keyword, page, pageSize);
        set({ claimProducts: result.items, claimProductsPagination: result, claimParts: [], claimOperations: [] });
      }
      catch (error) { set({ error: getErrorMessage(error) }); }
      finally { set({ claimLoading: false }); }
    },
    loadRecentClaimableOperations: async () => {
      set({ claimLoading: true, error: null });
      try {
        set({ recentClaimOperations: await loadRecentClaimableOperations() });
      } catch (error) { set({ error: getErrorMessage(error) }); }
      finally { set({ claimLoading: false }); }
    },
    loadClaimableParts: async (productId) => {
      set({ claimLoading: true, error: null });
      try { set({ claimParts: await workReportRepository.getClaimableParts(productId), claimOperations: [] }); }
      catch (error) { set({ error: getErrorMessage(error) }); }
      finally { set({ claimLoading: false }); }
    },
    loadClaimableOperations: async (partId) => {
      set({ claimLoading: true, error: null });
      try { set({ claimOperations: await workReportRepository.getClaimableOperations(partId) }); }
      catch (error) { set({ error: getErrorMessage(error) }); }
      finally { set({ claimLoading: false }); }
    },
    claimOperation: async (operationId, input) => {
      if (get().actionLoading) return null;
      set({ actionLoading: true, error: null });
      try {
        const assignment = await workReportRepository.claimOperation(operationId, input);
        const assignments = await workReportRepository.getAssignments();
        set({ assignments, switchCandidates: getCurrentSwitchCandidatesForDate(assignments, new Date(), get().current?.id), dayCompleted: false });
        return assignment;
      } catch (error) { set({ error: getErrorMessage(error) }); throw error; }
      finally { set({ actionLoading: false }); }
    },
    removeClaimedAssignment: async (assignmentId) => {
      if (get().actionLoading) return;
      set({ actionLoading: true, error: null });
      try {
        await workReportRepository.removeClaimedAssignment(assignmentId);
        const assignments = await workReportRepository.getAssignments();
        const current = get().current?.id === assignmentId ? null : get().current;
        set({ current, assignments, switchCandidates: getCurrentSwitchCandidatesForDate(assignments, new Date(), current?.id) });
      } catch (error) { set({ error: getErrorMessage(error) }); throw error; }
      finally { set({ actionLoading: false }); }
    },
    start: () => act((id) => workReportRepository.startAssignment(id)),
    pause: (reason) => act((id) => workReportRepository.pauseAssignment(id, reason)),
    resume: () => act((id) => workReportRepository.resumeAssignment(id)),
    complete: async (input) => {
      const current = get().current;
      if (!current || get().actionLoading) return;
      set({ actionLoading: true, error: null });
      try {
        const completed = await workReportRepository.completeAssignment(current.id, input);
        const assignments = await workReportRepository.getAssignments();
        const nextCandidates = getSwitchableAssignmentsForDate(assignments, completed.plannedStart, completed.id);
        if (nextCandidates.length === 1) set({ current: nextCandidates[0], assignments, nextCandidates: [], dayCompleted: false });
        else if (nextCandidates.length > 1) set({ current: completed, assignments, nextCandidates, dayCompleted: false });
        else set({ current: null, assignments, nextCandidates: [], dayCompleted: true });
      } catch (error) { set({ error: getErrorMessage(error) }); throw error; }
      finally { set({ actionLoading: false }); }
    },
    selectNext: (assignment) => set({ current: assignment, nextCandidates: [], dayCompleted: false }),
    switchCurrent: async (assignment) => {
      const current = get().current;
      if (!canSwitchFromAssignment(current) || get().actionLoading) return;
      set({ actionLoading: true, error: null });
      try {
        const selected = await workReportRepository.setCurrentAssignment(assignment.id);
        const assignments = await workReportRepository.getAssignments();
        set({ current: selected, assignments, switchCandidates: getCurrentSwitchCandidatesForDate(assignments, new Date(), selected.id), dayCompleted: false });
      } catch (error) { set({ error: getErrorMessage(error) }); throw error; }
      finally { set({ actionLoading: false }); }
    },
    clearWorkReportState: () => {
      currentRequest += 1;
      assignmentsRequest += 1;
      statisticsRequest += 1;
      capabilitiesRequest += 1;
      set({
        ...emptyWorkReportState,
        currentLoading: false,
        assignmentsLoading: false,
        statisticsLoading: false,
        capabilitiesLoading: false,
        claimLoading: false,
        actionLoading: false,
        error: null,
      });
    },
    clearError: () => set({ error: null }),
  };
});
