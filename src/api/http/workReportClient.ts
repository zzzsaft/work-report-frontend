import axios from "axios";
import { setupAuthInterceptors } from "./interceptors";

const baseURL = import.meta.env.VITE_WORK_REPORT_API_BASE_URL;

export const workReportClient = axios.create({
  baseURL: baseURL || "/work-report-api",
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

setupAuthInterceptors(workReportClient);
