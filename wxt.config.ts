import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: "src",
  modulesDir: "wxt-modules",
  outDir: "dist",
  publicDir: "public",

  manifest: {
    name: "SwiftApply",
    description: "All your job application needs in one place!",
    permissions: ["tabs", "activeTab", "scripting", "storage"],

    action: {
      default_icon: {
        "16": "icon/Logo.png",
        "32": "icon/Logo.png",
        "48": "icon/Logo.png",
        "96": "icon/Logo.png",
        "128": "icon/Logo.png",
      },
      default_title: "SwiftApply",
    },

    icons: {
  "16": "icon/Logo.png",
  "32": "icon/Logo.png",
  "48": "icon/Logo.png",
  "128": "icon/Logo.png",
},

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
