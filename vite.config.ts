import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/Msg": {
        // target: "http://localhost:44366",
        target: "http://122.226.146.110:777",
        changeOrigin: true,
      },
    },
  },
});
