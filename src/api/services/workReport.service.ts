import { mockWorkReportRepository } from "./mockWorkReport.repository";
import { realWorkReportRepository } from "./realWorkReport.repository";

export const isMockMode = import.meta.env.VITE_USE_MOCK_DATA === "true";
export const workReportRepository = isMockMode ? mockWorkReportRepository : realWorkReportRepository;
