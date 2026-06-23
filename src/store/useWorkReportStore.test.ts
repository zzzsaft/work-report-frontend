import { afterEach, describe, expect, it } from "vitest";
import { workReportRepository } from "@/api/services/workReport.service";
import type { LaborStatistics, OperationAssignment } from "@/domain/work-report";
import { useWorkReportStore } from "./useWorkReportStore";

const originalGetAssignments = workReportRepository.getAssignments;
const originalGetStatistics = workReportRepository.getStatistics;

const statistics = (period: LaborStatistics["period"]): LaborStatistics => ({
  period, totalHours: 1, regularHours: 1, overtimeHours: 0, completedOperations: 1,
  attendanceDays: 1, trend: [],
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => {
  workReportRepository.getAssignments = originalGetAssignments;
  workReportRepository.getStatistics = originalGetStatistics;
  useWorkReportStore.setState({
    assignments: [], statistics: null, assignmentsLoading: false, statisticsLoading: false, error: null,
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
});
