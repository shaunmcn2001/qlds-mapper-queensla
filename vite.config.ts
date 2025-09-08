import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from "path";

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
  ],
  resolve: {
    alias: {
      "@": resolve(projectRoot, "src"),
    },
  },
  // IMPORTANT: must be '/<repo>/' for GitHub Project Pages
  // Ensures proper deployment to https://shaunmcn2001.github.io/qlds-mapper-queensla/
  base: "/qlds-mapper-queensla/",
});
