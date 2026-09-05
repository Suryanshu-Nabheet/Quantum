/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react-swc";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const require = createRequire(import.meta.url);

function agentCopyWebviewPlugin(): Plugin {
  return {
    name: "agent-copy-webview",
    closeBundle() {
      if (process.env.AGENT_COPY_WEBVIEW !== "1") {
        return;
      }
      require("../scripts/utils").copyGuiDistToWebview();
      console.log("[watch-gui] Copied out/agent-gui to out/agent/webview/");
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), agentCopyWebviewPlugin()],
  resolve: {
    alias: {
      yaml: require.resolve("yaml"),
    },
  },
  build: {
    outDir: resolve(__dirname, "../../../../../../out/agent-gui"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  server: {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["*", "Content-Type", "Authorization"],
      credentials: true,
    },
    sourcemapIgnoreList(sourcePath) {
      return (
        sourcePath.includes("node_modules") ||
        sourcePath.includes("/packages/") ||
        sourcePath.includes("\\packages\\")
      );
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/util/test/setupTests.ts",
    onConsoleLog(log, type) {
      if (type === "stderr") {
        if (
          [
            "contentEditable",
            "An update to Chat inside a test was not wrapped in act",
            "An update to TipTapEditor inside a test was not wrapped in act",
            "An update to ThinkingIndicator inside a test was not wrapped in act",
            "The current testing environment is not configured to support act",
            "target.getClientRects is not a function",
            "prosemirror",
          ].some((text) => log.includes(text))
        ) {
          return false;
        }
      }
      return true;
    },
  },
});
