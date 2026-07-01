import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const msgProxyTarget = env.VITE_MSG_PROXY_TARGET?.trim();

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/Msg": {
          target: msgProxyTarget || "http://122.226.146.110:777",
          changeOrigin: true,
        },
      },
    },
  };
});
