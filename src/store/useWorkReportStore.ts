import { create } from "zustand";
import { workReportRepository } from "@/api/services/workReport.service";
import type { LaborStatistics, OperationAssignment, UserCapabilities } from "@/domain/work-report";
import type { CompletionInput } from "@/api/services/workReport.repository";
import { getPendingAssignmentsForDate } from "@/domain/work-report";
import { getErrorMessage } from "@/utils/errors";

interface WorkReportState {
  current: OperationAssignment | null;
  assignments: OperationAssignment[];
  statistics: LaborStatistics | null;
  capabilities: UserCapabilities | null;
  nextCandidates: OperationAssignment[];
  dayCompleted: boolean;
  currentLoading: boolean;
  assignmentsLoading: boolean;
  statisticsLoading: boolean;
  capabilitiesLoading: boolean;
  actionLoading: boolean;
  error: string | null;
  loadCurrent: () => Promise<void>;
  loadAssignments: () => Promise<void>;
  loadStatistics: (period: LaborStatistics["period"]) => Promise<void>;
  loadCapabilities: () => Promise<void>;
  start: () => Promise<void>;
  pause: (reason?: string) => Promise<void>;
  resume: () => Promise<void>;
  complete: (input: CompletionInput) => Promise<void>;
  selectNext: (assignment: OperationAssignment) => void;
  clearError: () => void;
}

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
    current: null, assignments: [], statistics: null, capabilities: null, nextCandidates: [], dayCompleted: false,
    currentLoading: false, assignmentsLoading: false, statisticsLoading: false, capabilitiesLoading: false,
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
        set({ current, capabilities, assignments, dayCompleted: !current && todayPending.length === 0 });
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
        if (request === assignmentsRequest) set({ assignments });
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
    loadCapabilities: async () => {
      if (get().capabilities || get().capabilitiesLoading) return;
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
        const nextCandidates = getPendingAssignmentsForDate(assignments, completed.plannedStart, completed.id);
        if (nextCandidates.length === 1) set({ current: nextCandidates[0], assignments, nextCandidates: [], dayCompleted: false });
        else if (nextCandidates.length > 1) set({ current: completed, assignments, nextCandidates, dayCompleted: false });
        else set({ current: null, assignments, nextCandidates: [], dayCompleted: true });
      } catch (error) { set({ error: getErrorMessage(error) }); throw error; }
      finally { set({ actionLoading: false }); }
    },
    selectNext: (assignment) => set({ current: assignment, nextCandidates: [], dayCompleted: false }),
    clearError: () => set({ error: null }),
  };
});
