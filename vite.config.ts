import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => {
  const embed = mode === "embed";

  return {
    plugins: [react(), tailwindcss()],
    define: {
      "process.env": {},
      "process.env.NODE_ENV": JSON.stringify(
        mode === "development" ? "development" : "production"
      ),
      "process.platform": JSON.stringify("browser"),
      __APP_VERSION__: JSON.stringify(
        process.env.npm_package_version || "0.1.0",
      ),
    },
    clearScreen: false,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
      watch: { ignored: ["**/crates/**"] },
      proxy: {
        "/api": {
          target: "http://127.0.0.1:7070",
          changeOrigin: true,
        },
      },
    },
    build: embed
      ? {
          outDir:
            process.env.HARNESSKIT_EMBED_OUT_DIR ||
            path.resolve(__dirname, "../../frontend/dist/embed"),
          emptyOutDir: false,
          sourcemap: true,
          lib: {
            entry: path.resolve(__dirname, "src/embed.tsx"),
            formats: ["es"],
            fileName: () => "harnesskit-embed.js",
          },
          rollupOptions: {
            output: {
              inlineDynamicImports: true,
            },
          },
        }
      : {
          rollupOptions: {
            output: {
              manualChunks: {
                "vendor-react": ["react", "react-dom", "react-router-dom"],
                "vendor-ui": [
                  "lucide-react",
                  "@tanstack/react-table",
                  "@dnd-kit/core",
                  "@dnd-kit/sortable",
                ],
                "vendor-tauri": [
                  "@tauri-apps/api",
                  "@tauri-apps/plugin-dialog",
                  "@tauri-apps/plugin-opener",
                ],
                "vendor-utils": ["zustand", "clsx"],
              },
            },
          },
        },
  };
});
