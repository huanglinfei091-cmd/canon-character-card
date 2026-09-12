import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve("public"),
  publicDir: false,
  base: "./",
  build: {
    outDir: path.resolve("dist-native"),
    emptyOutDir: true,
    rollupOptions: { input: path.resolve("public/index.html") }
  }
});
