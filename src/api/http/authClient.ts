import axios from "axios";
import { setupAuthInterceptors } from "./interceptors";

const baseURL = import.meta.env.VITE_AUTH_API_BASE_URL;

if (!baseURL) {
  throw new Error("缺少 VITE_AUTH_API_BASE_URL 配置");
}

export const authClient = axios.create({
  baseURL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
  },
});

setupAuthInterceptors(authClient);
