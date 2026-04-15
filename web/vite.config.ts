import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react")) {
            return "react-vendor";
          }

          if (id.includes("node_modules/react-dom")) {
            return "react-vendor";
          }

          if (id.includes("node_modules/lightweight-charts")) {
            return "charting";
          }

          if (
            id.includes("/src/pages/StageTestsPage") ||
            id.includes("/src/pages/StageTestsPageContent") ||
            id.includes("/src/components/stage-tests/") ||
            id.includes("/src/services/stageTests") ||
            id.includes("/src/types/stageTests")
          ) {
            return "stage-tests";
          }

          return undefined;
        },
      },
    },
  },
});