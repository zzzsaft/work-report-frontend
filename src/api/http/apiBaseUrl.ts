const normalizeBaseUrl = (value?: string) => value?.trim().replace(/\/+$/, "");

export const getApiBaseUrl = (fallback = "") => {
  const configuredBaseUrl = normalizeBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
  );

  return configuredBaseUrl || fallback;
};
