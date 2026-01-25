import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Docker build config - uses Babel instead of SWC for ARM64 compatibility
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Suppress sourcemaps in production to reduce image size
    sourcemap: false,
  },
});
