import type { AxiosInstance } from "axios";

const getStoredToken = () => {
  try {
    const authStorage = JSON.parse(localStorage.getItem("auth-storage") ?? "{}");
    return authStorage?.state?.token ?? "";
  } catch {
    return "";
  }
};

export const setupAuthInterceptors = (instance: AxiosInstance) => {
  instance.interceptors.request.use((config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
};
