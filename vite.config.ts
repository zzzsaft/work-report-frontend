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
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("handsontable") || id.includes("@handsontable")) return "vendor-handsontable";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) return "vendor-react";
            return undefined;
          },
        },
      },
    },
  };
});
