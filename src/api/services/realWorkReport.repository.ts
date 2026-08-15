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
  async claimOperation(operationId, input) { return (await workReportClient.post(`/claim/operations/${operationId}/claim`, input)).data; },
  async removeClaimedAssignment(assignmentId) { await workReportClient.delete(`/assignments/${assignmentId}/claim`); },
  async getStatistics(period) { return (await workReportClient.get("/statistics/me", { params: { period } })).data; },
  async getMyReports(period) { return (await workReportClient.get("/reports/me", { params: { period } })).data; },
  async getStaffStats(period, operationNames, company) {
    const params: Record<string, string | string[]> = { period };
    if (operationNames && operationNames.length) {
      params.operationNames = operationNames.length === 1 ? operationNames[0] : operationNames;
    }
    if (company) params.company = company;
    return (await workReportClient.get("/admin/staff-stats", { params })).data;
  },
  async listOperationNames(period, company) {
    return (await workReportClient.get("/admin/staff-operation-names", { params: { period, company } })).data;
  },
  async getOperationWorkerAssignments(operationCode) {
    const params = operationCode ? { operationCode } : {};
    return (await workReportClient.get("/admin/operation-worker-assignments", { params })).data;
  },
  async createOperationWorkerAssignment(data) {
    return (await workReportClient.post("/admin/operation-worker-assignments", data)).data;
  },
  async deleteOperationWorkerAssignment(id) {
    return (await workReportClient.delete(`/admin/operation-worker-assignments/${encodeURIComponent(id)}`)).data;
  },
  async batchDeleteOperationWorkerAssignments(ids) {
    return (await workReportClient.post("/admin/operation-worker-assignments/batch-delete", { ids })).data;
  },
  async syncOperationWorkerAssignments() {
    return (await workReportClient.post("/admin/operation-worker-assignments/sync")).data;
  },
  async getUnmappedWorkers(keyword, page, pageSize) {
    return (await workReportClient.get("/admin/operation-worker-assignments/unmapped-workers", { params: { keyword, page, pageSize } })).data;
  },
  async getAttendance() { return (await workReportClient.get("/attendance/me")).data; },
  async getDashboard() { return (await workReportClient.get("/admin/dashboard")).data; },
  async getOrders() { return normalizeOrders((await workReportClient.get("/admin/orders", { params: { page: 1, pageSize: 50 } })).data); },
  async searchWorkers(keyword, page, pageSize) { return (await workReportClient.get("/admin/workers", { params: { keyword, page, pageSize } })).data; },
  async getWorkerPermissions() { return (await workReportClient.get("/admin/worker-permissions")).data; },
  async updateWorkerPermission(workerId, permissionGroup) { return (await workReportClient.patch(`/admin/workers/${workerId}/permission`, { permissionGroup })).data; },
  async getReports(filters) {
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 50));
    return normalizePage((await workReportClient.get("/admin/reports", { params: { ...filters, page, pageSize } })).data, page, pageSize);
  },
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

  // Team management
  async listTeams() { return (await workReportClient.get("/admin/teams")).data; },
  async createTeam(name, description) { return (await workReportClient.post("/admin/teams", { name, description })).data; },
  async updateTeam(id, name, description) { return (await workReportClient.put(`/admin/teams/${encodeURIComponent(id)}`, { name, description })).data; },
  async deleteTeam(id) { return (await workReportClient.delete(`/admin/teams/${encodeURIComponent(id)}`)).data; },
  async getTeamMembers(teamId) { return (await workReportClient.get(`/admin/teams/${encodeURIComponent(teamId)}/members`)).data; },
  async addTeamMember(teamId, userId) { await workReportClient.post(`/admin/teams/${encodeURIComponent(teamId)}/members`, { userId }); },
  async removeTeamMember(teamId, userId) { await workReportClient.delete(`/admin/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`); },
  async setWorkerTeam(userId, teamId) { await workReportClient.patch(`/admin/workers/${encodeURIComponent(userId)}/team`, { teamId }); },

  // Team operation assignments
  async listTeamOperations(teamId) { return (await workReportClient.get(`/admin/teams/${encodeURIComponent(teamId)}/operations`)).data; },
  async createTeamOperation(teamId, operationCode, operationName) {
    return (await workReportClient.post(`/admin/teams/${encodeURIComponent(teamId)}/operations`, { operationCode, operationName })).data;
  },
  async deleteTeamOperation(id) { return (await workReportClient.delete(`/admin/team-operations/${encodeURIComponent(id)}`)).data; },
  async batchDeleteTeamOperations(ids) { return (await workReportClient.post("/admin/team-operations/batch-delete", { ids })).data; },
  async syncTeamOperations() { return (await workReportClient.post("/admin/team-operations/sync")).data; },

  // System config
  async getSystemConfig() { return (await workReportClient.get("/admin/system-config")).data; },
  async saveSystemConfig(config) { return (await workReportClient.put("/admin/system-config", config)).data; },
};
