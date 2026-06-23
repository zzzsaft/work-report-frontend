export function getErrorMessage(error: unknown, fallback = "操作失败，请稍后重试") {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (typeof data === "object" && data !== null) {
      const message = (data as { message?: unknown; error?: unknown }).message ?? (data as { message?: unknown; error?: unknown }).error;
      if (typeof message === "string" && message) return message;
    }
    if (typeof data === "string" && data) return data;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
