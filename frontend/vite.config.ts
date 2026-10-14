import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL || "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/reward": {
        target: process.env.VITE_BACKEND_URL || "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
});
