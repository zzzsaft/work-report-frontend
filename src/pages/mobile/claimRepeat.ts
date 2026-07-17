import type { ClaimableOperation, OperationAssignment } from "@/domain/work-report";

const repeatClaimConfirmMs = 30 * 60 * 1000;

const sameOperation = (assignment: OperationAssignment, operation: ClaimableOperation) =>
  assignment.orderNo === operation.orderNo &&
  assignment.partNo === operation.partNo &&
  assignment.partCode === operation.partCode &&
  assignment.operationNo === operation.operationNo &&
  assignment.operationCode === operation.operationCode;

export function shouldConfirmRepeatedClaim(
  assignments: OperationAssignment[],
  operation: ClaimableOperation,
  now = new Date(),
) {
  return assignments.some((assignment) => {
    if (!sameOperation(assignment, operation) || !assignment.claimedAt) return false;
    return now.getTime() - new Date(assignment.claimedAt).getTime() >= repeatClaimConfirmMs;
  });
}
