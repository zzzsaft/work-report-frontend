/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_AUTH_API_BASE_URL?: string;
  readonly VITE_WECOM_CORP_ID: string;
  readonly VITE_WECOM_AGENT_ID: string;
  readonly VITE_REQUIRE_AUTH?: "true" | "false";
  readonly VITE_WORK_REPORT_API_BASE_URL?: string;
  readonly VITE_ACCOUNT_API_BASE_URL?: string;
  readonly VITE_USE_MOCK_DATA?: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
