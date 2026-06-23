import { workReportClient } from "@/api/http/workReportClient";
import type { AdminAssignOperationInput, CompletionInput, WorkReportRepository } from "./workReport.repository";

export const realWorkReportRepository: WorkReportRepository = {
  async getCapabilities() { return (await workReportClient.get("/me/capabilities")).data; },
  async getCurrentAssignment() { return (await workReportClient.get("/assignments/current")).data; },
  async getAssignments() { return (await workReportClient.get("/assignments")).data; },
  async setCurrentAssignment(id) { return (await workReportClient.post(`/assignments/${id}/select`)).data; },
  async startAssignment(id) { return (await workReportClient.post(`/assignments/${id}/start`)).data; },
  async pauseAssignment(id, reason) { return (await workReportClient.post(`/assignments/${id}/pause`, { reason })).data; },
  async resumeAssignment(id) { return (await workReportClient.post(`/assignments/${id}/resume`)).data; },
  async completeAssignment(id, input: CompletionInput) { return (await workReportClient.post(`/assignments/${id}/complete`, input)).data; },
  async searchClaimableProducts(keyword) { return (await workReportClient.get("/claim/products", { params: { keyword } })).data; },
  async getClaimableParts(productId) { return (await workReportClient.get(`/claim/products/${productId}/parts`)).data; },
  async getClaimableOperations(partId) { return (await workReportClient.get(`/claim/parts/${partId}/operations`)).data; },
  async claimOperation(operationId) { return (await workReportClient.post(`/claim/operations/${operationId}/claim`)).data; },
  async removeClaimedAssignment(assignmentId) { await workReportClient.delete(`/assignments/${assignmentId}/claim`); },
  async getStatistics(period) { return (await workReportClient.get("/statistics/me", { params: { period } })).data; },
  async getAttendance() { return (await workReportClient.get("/attendance/me")).data; },
  async getDashboard() { return (await workReportClient.get("/admin/dashboard")).data; },
  async getOrders() { return (await workReportClient.get("/admin/orders")).data; },
  async getReports() { return (await workReportClient.get("/admin/reports")).data; },
  async getExceptions() { return (await workReportClient.get("/admin/exceptions")).data; },
  async resolveException(id) { await workReportClient.post(`/admin/exceptions/${id}/resolve`); },
  async importLeaderOperations(rows) { return (await workReportClient.post("/leader/operations/import", { rows })).data; },
  async adminAssignOperation(input: AdminAssignOperationInput) { await workReportClient.post("/admin/assignments", input); },
  async adminRemoveAssignment(assignmentId, reason) { await workReportClient.delete(`/admin/assignments/${assignmentId}`, { data: { reason } }); },
};
