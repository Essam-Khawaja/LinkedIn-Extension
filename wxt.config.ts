import { defineConfig } from 'wxt';

export default defineConfig({
  // Relative to project root
  srcDir: "src",
  modulesDir: "wxt-modules",
  outDir: "dist",
  publicDir: "static",

  manifest: {
    web_accessible_resources: [
      {
        resources: ['*.css', 'icons/*', 'job.content.ts', 'content.ts'],
        matches: ['<all_urls>']
      },
    ],
    permissions: ["tabs", "activeTab", "scripting"],
  },

  // Relative to srcDir
  entrypointsDir: "entrypoints",
});