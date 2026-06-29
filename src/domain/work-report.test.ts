import { describe, expect, it } from "vitest";
import {
  formatDuration,
  getLocalDateKey,
  getPendingAssignmentsForDate,
  getSessionElapsedSeconds,
  getSwitchableAssignmentsForDate,
  getCurrentSwitchCandidatesForDate,
  canSwitchFromAssignment,
  canAccessAdminRoute,
  canManagePermissions,
  canWorkerRemoveAssignment,
  isActiveOperationStatus,
  isAssignmentOnDate,
  sortByNumericCode,
  type OperationAssignment,
  type UserCapabilities,
  type WorkSession,
} from "./work-report";

const session = (overrides: Partial<WorkSession> = {}): WorkSession => ({
  id: "s1", assignmentId: "a1", operatorId: "u1", operatorName: "张师傅",
  status: "paused", accumulatedSeconds: 3600, pauses: [], photos: [], ...overrides,
});

const assignment = (overrides: Partial<OperationAssignment> = {}): OperationAssignment => ({
  id: "a1", workOrderId: "o1", orderNo: "WO-1", productCode: "P-1", productName: "产品",
  partCode: "PART-1", partName: "部件",
  operationCode: "OP-1", operationName: "工序", operationNote: "", plannedQuantity: 1,
  plannedStart: "2026-06-23T08:00:00+08:00", plannedEnd: "2026-06-23T09:00:00+08:00",
  collaborators: [], source: "assigned", canWorkerRemove: false, status: "assigned", ...overrides,
});

const capabilities = (overrides: Partial<UserCapabilities> = {}): UserCapabilities => ({
  roles: ["worker"],
  canViewAdmin: false,
  canAssignWorkers: false,
  canReviewExceptions: false,
  canImportOperations: false,
  canViewTeamOperations: false,
  canForceRemoveAssignments: false,
  canViewAllTeams: false,
  ...overrides,
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

  it("allows switching only to assigned operations for the day", () => {
    const assignments = [assignment(), assignment({ id: "a2", status: "paused" }), assignment({ id: "a3", status: "completed" })];
    expect(getSwitchableAssignmentsForDate(assignments, new Date(2026, 5, 23)).map((item) => item.id)).toEqual(["a1"]);
    expect(canSwitchFromAssignment(assignment({ status: "paused" }))).toBe(true);
    expect(canSwitchFromAssignment(assignment({ status: "assigned" }))).toBe(true);
    expect(canSwitchFromAssignment(assignment({ status: "running" }))).toBe(false);
    expect(canSwitchFromAssignment(null)).toBe(true);
  });

  it("keeps paused work available when manually switching the current operation", () => {
    const assignments = [
      assignment({ id: "paused-current", status: "paused" }),
      assignment({ id: "selected", status: "assigned" }),
      assignment({ id: "next", status: "assigned" }),
      assignment({ id: "done", status: "completed" }),
    ];
    expect(getCurrentSwitchCandidatesForDate(assignments, new Date(2026, 5, 23), "selected").map((item) => item.id)).toEqual(["paused-current", "next"]);
  });

  it("lets workers remove only unstarted self-claimed assignments", () => {
    expect(canWorkerRemoveAssignment(assignment({ source: "self_claimed", canWorkerRemove: true }))).toBe(true);
    expect(canWorkerRemoveAssignment(assignment({ source: "self_claimed", canWorkerRemove: true, status: "running" }))).toBe(false);
    expect(canWorkerRemoveAssignment(assignment({ source: "assigned", canWorkerRemove: false }))).toBe(false);
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

describe("capability helpers", () => {
  it("keeps worker accounts out of admin routes", () => {
    const worker = capabilities();
    expect(canAccessAdminRoute(worker, "dashboard")).toBe(false);
    expect(canAccessAdminRoute(worker, "import")).toBe(false);
    expect(canManagePermissions(worker)).toBe(false);
  });

  it("maps leader capabilities to import, exceptions, and team views without permissions management", () => {
    const leader = capabilities({
      roles: ["worker", "leader"],
      canViewAdmin: true,
      canImportOperations: true,
      canReviewExceptions: true,
      canViewTeamOperations: true,
    });
    expect(canAccessAdminRoute(leader, "dashboard")).toBe(true);
    expect(canAccessAdminRoute(leader, "orders")).toBe(true);
    expect(canAccessAdminRoute(leader, "import")).toBe(true);
    expect(canAccessAdminRoute(leader, "exceptions")).toBe(true);
    expect(canAccessAdminRoute(leader, "assignments")).toBe(false);
    expect(canAccessAdminRoute(leader, "permissions")).toBe(false);
    expect(canManagePermissions(leader)).toBe(false);
  });

  it("derives admin permissions management from assign, force remove, and all-team capabilities", () => {
    const admin = capabilities({
      roles: ["worker", "leader", "admin"],
      canViewAdmin: true,
      canAssignWorkers: true,
      canReviewExceptions: true,
      canImportOperations: true,
      canViewTeamOperations: true,
      canForceRemoveAssignments: true,
      canViewAllTeams: true,
    });
    expect(canAccessAdminRoute(admin, "assignments")).toBe(true);
    expect(canAccessAdminRoute(admin, "permissions")).toBe(true);
    expect(canManagePermissions(admin)).toBe(true);
  });
});

describe("numeric code sorting", () => {
  it("sorts numeric strings by numeric value and leaves invalid values at the end", () => {
    const items = [{ code: "10" }, { code: "" }, { code: "2" }, { code: "OP-1" }, { code: "01" }, { code: undefined }];
    expect(sortByNumericCode(items, (item) => item.code).map((item) => item.code)).toEqual(["01", "2", "10", "", "OP-1", undefined]);
  });
});
