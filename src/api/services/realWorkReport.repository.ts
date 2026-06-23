import { workReportClient } from "@/api/http/workReportClient";
import type { WorkReportRepository, CompletionInput } from "./workReport.repository";

export const realWorkReportRepository: WorkReportRepository = {
  async getCapabilities() { return (await workReportClient.get("/me/capabilities")).data; },
  async getCurrentAssignment() { return (await workReportClient.get("/assignments/current")).data; },
  async getAssignments() { return (await workReportClient.get("/assignments")).data; },
  async startAssignment(id) { return (await workReportClient.post(`/assignments/${id}/start`)).data; },
  async pauseAssignment(id, reason) { return (await workReportClient.post(`/assignments/${id}/pause`, { reason })).data; },
  async resumeAssignment(id) { return (await workReportClient.post(`/assignments/${id}/resume`)).data; },
  async completeAssignment(id, input: CompletionInput) { return (await workReportClient.post(`/assignments/${id}/complete`, input)).data; },
  async getStatistics(period) { return (await workReportClient.get("/statistics/me", { params: { period } })).data; },
  async getAttendance() { return (await workReportClient.get("/attendance/me")).data; },
  async getDashboard() { return (await workReportClient.get("/admin/dashboard")).data; },
  async getOrders() { return (await workReportClient.get("/admin/orders")).data; },
  async getReports() { return (await workReportClient.get("/admin/reports")).data; },
  async getExceptions() { return (await workReportClient.get("/admin/exceptions")).data; },
  async resolveException(id) { await workReportClient.post(`/admin/exceptions/${id}/resolve`); },
};
