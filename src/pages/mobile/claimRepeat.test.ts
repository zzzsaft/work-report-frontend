import { describe, expect, it } from "vitest";
import type { ClaimableOperation, OperationAssignment } from "@/domain/work-report";
import { shouldConfirmRepeatedClaim } from "./claimRepeat";

const operation: ClaimableOperation = {
  id: "op-1",
  productId: "order-1",
  partId: "part-1",
  orderNo: "WO-1",
  productCode: "PRD-1",
  productName: "产品",
  partNo: "1",
  partCode: "PART-1",
  partName: "零件",
  operationNo: "10",
  operationCode: "OP-010",
  operationName: "粗加工",
  operationNote: "",
  plannedQuantity: 1,
  estimatedHours: 1,
  claimedWorkers: 1,
  status: "available",
};

const assignment = (claimedAt: string, overrides: Partial<OperationAssignment> = {}): OperationAssignment => ({
  id: "assignment-1",
  workOrderId: "order-1",
  orderNo: "WO-1",
  productCode: "PRD-1",
  productName: "产品",
  partNo: "1",
  partCode: "PART-1",
  partName: "零件",
  operationNo: "10",
  operationCode: "OP-010",
  operationName: "粗加工",
  operationNote: "",
  plannedQuantity: 1,
  plannedStart: "2026-06-25T08:00:00+08:00",
  plannedEnd: "2026-06-25T09:00:00+08:00",
  collaborators: ["张师傅"],
  source: "self_claimed",
  canWorkerRemove: true,
  status: "assigned",
  claimedAt,
  ...overrides,
});

describe("shouldConfirmRepeatedClaim", () => {
  it("does not ask for confirmation inside the 30 minute cooldown", () => {
    expect(shouldConfirmRepeatedClaim([assignment("2026-06-25T08:45:00+08:00")], operation, new Date("2026-06-25T09:00:00+08:00"))).toBe(false);
  });

  it("asks for confirmation when the same operation was claimed at least 30 minutes ago", () => {
    expect(shouldConfirmRepeatedClaim([assignment("2026-06-25T08:30:00+08:00")], operation, new Date("2026-06-25T09:00:00+08:00"))).toBe(true);
  });

  it("ignores other operations", () => {
    expect(shouldConfirmRepeatedClaim([assignment("2026-06-25T08:00:00+08:00", { operationNo: "20", operationCode: "OP-020" })], operation, new Date("2026-06-25T09:00:00+08:00"))).toBe(false);
  });
});
