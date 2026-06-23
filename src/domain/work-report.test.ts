import { describe, expect, it } from "vitest";
import {
  formatDuration,
  getLocalDateKey,
  getPendingAssignmentsForDate,
  getSessionElapsedSeconds,
  isActiveOperationStatus,
  isAssignmentOnDate,
  type OperationAssignment,
  type WorkSession,
} from "./work-report";

const session = (overrides: Partial<WorkSession> = {}): WorkSession => ({
  id: "s1", assignmentId: "a1", operatorId: "u1", operatorName: "张师傅",
  status: "paused", accumulatedSeconds: 3600, pauses: [], photos: [], ...overrides,
});

const assignment = (overrides: Partial<OperationAssignment> = {}): OperationAssignment => ({
  id: "a1", workOrderId: "o1", orderNo: "WO-1", productCode: "P-1", productName: "产品",
  operationCode: "OP-1", operationName: "工序", operationNote: "", plannedQuantity: 1,
  plannedStart: "2026-06-23T08:00:00+08:00", plannedEnd: "2026-06-23T09:00:00+08:00",
  collaborators: [], status: "assigned", ...overrides,
});

describe("assignment date and status selectors", () => {
  it("creates stable local date keys and rejects invalid dates", () => {
    expect(getLocalDateKey(new Date(2026, 5, 23, 23, 59))).toBe("2026-06-23");
    expect(getLocalDateKey("not-a-date")).toBe("");
  });

  it("matches assignments by local calendar date", () => {
    expect(isAssignmentOnDate(assignment(), new Date(2026, 5, 23, 12))).toBe(true);
    expect(isAssignmentOnDate(assignment(), new Date(2026, 5, 24, 0))).toBe(false);
  });

  it("keeps only active assignments and supports excluding one", () => {
    expect(isActiveOperationStatus("paused")).toBe(true);
    expect(isActiveOperationStatus("completed")).toBe(false);
    const assignments = [assignment(), assignment({ id: "a2", status: "running" }), assignment({ id: "a3", status: "completed" })];
    expect(getPendingAssignmentsForDate(assignments, new Date(2026, 5, 23), "a1").map((item) => item.id)).toEqual(["a2"]);
  });
});

describe("work session time", () => {
  it("keeps accumulated time while paused", () => {
    expect(getSessionElapsedSeconds(session(), Date.parse("2026-06-23T10:00:00Z"))).toBe(3600);
  });

  it("adds the active run to accumulated time", () => {
    const now = Date.parse("2026-06-23T10:00:00Z");
    const running = session({ status: "running", currentRunStartedAt: "2026-06-23T09:30:00Z" });
    expect(getSessionElapsedSeconds(running, now)).toBe(5400);
  });

  it("formats long durations without wrapping at 24 hours", () => {
    expect(formatDuration(27 * 3600 + 62)).toBe("27:01:02");
  });
});
