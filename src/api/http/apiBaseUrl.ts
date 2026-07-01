const normalizeBaseUrl = (value?: string) => value?.trim().replace(/\/+$/, "");

export const getApiBaseUrl = (fallback = "") => {
  const configuredBaseUrl = normalizeBaseUrl(
    import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_AUTH_API_BASE_URL ||
      import.meta.env.VITE_WORK_REPORT_API_BASE_URL ||
      import.meta.env.VITE_ACCOUNT_API_BASE_URL,
  );

  return configuredBaseUrl || fallback;
};
