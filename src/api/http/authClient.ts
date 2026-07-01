import axios from "axios";
import { setupAuthInterceptors } from "./interceptors";
import { getApiBaseUrl } from "./apiBaseUrl";

const baseURL = getApiBaseUrl();

if (!baseURL) {
  throw new Error("缺少 VITE_API_BASE_URL 配置");
}

export const authClient = axios.create({
  baseURL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
  },
});

setupAuthInterceptors(authClient);
