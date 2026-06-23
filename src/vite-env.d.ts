/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_API_BASE_URL: string;
  readonly VITE_WECOM_CORP_ID: string;
  readonly VITE_WECOM_AGENT_ID: string;
  readonly VITE_WORK_REPORT_API_BASE_URL?: string;
  readonly VITE_USE_MOCK_DATA?: "true" | "false";
}

interface ImportMeta { readonly env: ImportMetaEnv; }

interface ImportMetaEnv {
  readonly VITE_AUTH_API_BASE_URL: string;
  readonly VITE_WECOM_CORP_ID: string;
  readonly VITE_WECOM_AGENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
