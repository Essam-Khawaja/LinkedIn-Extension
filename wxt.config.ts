import { defineConfig } from 'wxt';

export default defineConfig({
  // Relative to project root
  srcDir: "src",             // default: "."
  modulesDir: "wxt-modules", // default: "modules"
  outDir: "dist",            // default: ".output"
  publicDir: "static",       // default: "public"

  manifest: {
    web_accessible_resources: [
      {
        resources: ['*.css', 'icons/*', 'job.content.ts'],
        matches: ['<all_urls>']
      },
    ],
    permissions: ["tabs", "activeTab"],
  },

  // Relative to srcDir
  entrypointsDir: "entrypoints", // default: "entrypoints"
})