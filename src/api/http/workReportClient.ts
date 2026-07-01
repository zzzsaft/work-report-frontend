import axios from "axios";
import { setupAuthInterceptors } from "./interceptors";
import { getApiBaseUrl } from "./apiBaseUrl";

const baseURL = getApiBaseUrl("/work-report-api");

export const workReportClient = axios.create({
  baseURL,
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

setupAuthInterceptors(workReportClient);
