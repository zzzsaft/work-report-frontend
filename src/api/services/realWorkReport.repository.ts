import { workReportClient } from "@/api/http/workReportClient";
import type { AdminAssignOperationInput, CompletionInput, PaginatedResult, WorkReportRepository } from "./workReport.repository";
import { sortByNumericCode, type WorkOrder } from "@/domain/work-report";

const normalizeOrders = (data: WorkOrder[] | { items?: WorkOrder[] }) => Array.isArray(data) ? data : data.items ?? [];
const normalizePage = <T>(data: T[] | Partial<PaginatedResult<T>>, page: number, pageSize: number): PaginatedResult<T> => {
  if (Array.isArray(data)) return { items: data, page, pageSize, total: data.length, hasMore: false };
  const items = data.items ?? [];
  const total = data.total ?? items.length;
  return { items, page: data.page ?? page, pageSize: data.pageSize ?? pageSize, total, hasMore: data.hasMore ?? page * pageSize < total };
};

export const realWorkReportRepository: WorkReportRepository = {
  async getCapabilities() { return (await workReportClient.get("/me/capabilities")).data; },
  async getCurrentAssignment() { return (await workReportClient.get("/assignments/current")).data; },
  async getAssignments() { return (await workReportClient.get("/assignments")).data; },
  async setCurrentAssignment(id) { return (await workReportClient.post(`/assignments/${id}/select`)).data; },
  async startAssignment(id) { return (await workReportClient.post(`/assignments/${id}/start`)).data; },
  async pauseAssignment(id, reason) { return (await workReportClient.post(`/assignments/${id}/pause`, { reason })).data; },
  async resumeAssignment(id) { return (await workReportClient.post(`/assignments/${id}/resume`)).data; },
  async completeAssignment(id, input: CompletionInput) { return (await workReportClient.post(`/assignments/${id}/complete`, input)).data; },
  async searchClaimableProducts(keyword, page, pageSize) { return normalizePage((await workReportClient.get("/claim/products", { params: { keyword, page, pageSize } })).data, page, pageSize); },
  async getClaimableParts(productId) { return sortByNumericCode((await workReportClient.get(`/claim/products/${productId}/parts`)).data, (item) => item.partNo); },
  async getClaimableOperations(partId) { return sortByNumericCode((await workReportClient.get(`/claim/parts/${partId}/operations`)).data, (item) => item.operationNo); },
  async claimOperation(operationId) { return (await workReportClient.post(`/claim/operations/${operationId}/claim`)).data; },
  async removeClaimedAssignment(assignmentId) { await workReportClient.delete(`/assignments/${assignmentId}/claim`); },
  async getStatistics(period) { return (await workReportClient.get("/statistics/me", { params: { period } })).data; },
  async getAttendance() { return (await workReportClient.get("/attendance/me")).data; },
  async getDashboard() { return (await workReportClient.get("/admin/dashboard")).data; },
  async getOrders() { return normalizeOrders((await workReportClient.get("/admin/orders", { params: { page: 1, pageSize: 50 } })).data); },
  async searchWorkers(keyword, page, pageSize) { return (await workReportClient.get("/admin/workers", { params: { keyword, page, pageSize } })).data; },
  async getWorkerPermissions() { return (await workReportClient.get("/admin/worker-permissions")).data; },
  async updateWorkerPermission(workerId, permissionGroup) { return (await workReportClient.patch(`/admin/workers/${workerId}/permission`, { permissionGroup })).data; },
  async getReports(filters) { return (await workReportClient.get("/admin/reports", { params: filters })).data; },
  async updateReportHours(id, estimatedHours) { return (await workReportClient.patch(`/admin/reports/${id}/hours`, { estimatedHours })).data; },
  async getExceptions() { return (await workReportClient.get("/admin/exceptions")).data; },
  async resolveException(id) { await workReportClient.post(`/admin/exceptions/${id}/resolve`); },
  async importLeaderOperations(rows) { return (await workReportClient.post("/leader/operations/import", { rows })).data; },
  async getXftConfig() { return (await workReportClient.get("/admin/xft/config")).data; },
  async saveXftConfig(config) { return (await workReportClient.put("/admin/xft/config", config)).data; },
  async previewXftHours(salaryPeriod) { return (await workReportClient.post("/admin/xft/import-hours/preview", { salaryPeriod })).data; },
  async importXftHours(salaryPeriod) { return (await workReportClient.post("/admin/xft/import-hours", { salaryPeriod })).data; },
  async importManualXftHours(rows, salaryPeriod) { return (await workReportClient.post("/admin/xft/import-hours/manual", { rows, salaryPeriod })).data; },
  async adminAssignOperation(input: AdminAssignOperationInput) { await workReportClient.post("/admin/assignments", input); },
  async adminRemoveAssignment(assignmentId, reason) { await workReportClient.delete(`/admin/assignments/${assignmentId}`, { data: { reason } }); },
};
