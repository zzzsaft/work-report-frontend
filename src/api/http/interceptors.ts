import type { AxiosInstance } from "axios";

const getStoredToken = () => {
  try {
    const authStorage = JSON.parse(localStorage.getItem("auth-storage") ?? "{}");
    return authStorage?.state?.token ?? "";
  } catch {
    return "";
  }
};

const getMockToken = () => {
  return import.meta.env.VITE_MOCK_AUTH_TOKEN || "mock-token";
};

export const setupAuthInterceptors = (instance: AxiosInstance) => {
  instance.interceptors.request.use((config) => {
    const requireAuth = import.meta.env.VITE_REQUIRE_AUTH !== "false";
    const storedToken = getStoredToken();
    const mockToken = getMockToken();
    const token = requireAuth 
      ? (storedToken || mockToken) 
      : (mockToken || storedToken);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
};
