import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: "src",
  modulesDir: "wxt-modules",
  outDir: "dist",
  publicDir: "static",

  manifest: {
    name: "SwiftApply",
    description: "All your job application needs in one place!",
    permissions: ["tabs", "activeTab", "scripting", "storage"],

    // 🔹 Add background service worker (important!)
    background: {
      service_worker: "background.js",
      type: "module",
    },

    web_accessible_resources: [
      {
        resources: ['*.css', 'icons/*', 'job.content.ts', 'content.ts'],
        matches: ['<all_urls>']
      },
    ],
  },

  entrypointsDir: "entrypoints",
});
