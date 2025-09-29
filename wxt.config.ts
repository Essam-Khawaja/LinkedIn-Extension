import { defineConfig } from 'wxt';

export default defineConfig({
  // Relative to project root
  srcDir: "src",             // default: "."
  modulesDir: "wxt-modules", // default: "modules"
  outDir: "dist",            // default: ".output"
  publicDir: "static",       // default: "public"

  // Relative to srcDir
  entrypointsDir: "entrypoints", // default: "entrypoints"
})