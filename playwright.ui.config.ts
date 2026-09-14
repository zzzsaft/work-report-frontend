import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/ui",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:5186", locale: "zh-CN", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5186 --strictPort",
    url: "http://127.0.0.1:5186",
    reuseExistingServer: false,
    env: {
      VITE_REQUIRE_AUTH: "false", VITE_USE_MOCK_DATA: "true",
      VITE_API_BASE_URL: "http://127.0.0.1:5186/__test_api",
      VITE_MSG_PROXY_TARGET: "http://127.0.0.1:5186/__test_api",
    },
  },
});
