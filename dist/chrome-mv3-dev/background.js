var background = (function() {
  "use strict";
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  let latestScraped = null;
  async function analyzeJobWithAI(jobData) {
    try {
      const availability = await LanguageModel.availability();
      console.log("✨ AI Availability:", availability);
      if (availability === "no") {
        console.warn("❌ Gemini Nano not available");
        return null;
      }
      if (availability === "after-download") {
        console.log("⏳ Triggering Gemini Nano download...");
        await LanguageModel.create();
        return null;
      }
      const session = await LanguageModel.create();
      const description = jobData.description ? jobData.description.substring(0, 1500) : "No description available";
      const schema = {
        type: "object",
        required: ["cleanSummary", "salary", "skills", "requirements"],
        additionalProperties: false,
        properties: {
          cleanSummary: { type: "string" },
          salary: { type: "string" },
          skills: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "match"],
              properties: {
                name: { type: "string" },
                match: { type: "number" }
              }
            }
          },
          requirements: {
            type: "array",
            items: {
              type: "string"
            }
          }
        }
      };
      const prompt = `Analyze this job posting and extract key information.

Job Details:
- Title: ${jobData.title || "Unknown"}
- Company: ${jobData.company || "Unknown"}
- Location: ${jobData.location || "Not specified"}
- Type: ${jobData.type || "Not specified"}
- Current Salary: ${jobData.salary || "Not specified"}

Full Description:
${description}

IMPORTANT: Only extract information that is explicitly stated in the description. Do not make up or infer information.

Provide a JSON response with:
1. cleanSummary: A 2-3 sentence concise summary of the role
2. salary: Extract salary as "$XX,XXX - $XX,XXX" or "N/A" if not mentioned
3. requirements: Extract 5-7 key qualifications/requirements (prioritize basic qualifications)
4. skills: Array of 5-7 key technical skills with importance rating (0-100)

Example format:
{
  "cleanSummary": "Software engineer role focusing on...",
  "salary": "$80,000 - $120,000",
  "requirements": ["Bachelor's degree in CS", "3+ years experience"],
  "skills": [{"name": "JavaScript", "match": 90}, {"name": "React", "match": 85}]
}

Return ONLY valid JSON matching this structure.`;
      const result2 = await session.prompt(prompt);
      console.log("🤖 Raw AI Response:", result2);
      let cleanedResult = result2.trim();
      if (cleanedResult.startsWith("```json")) {
        cleanedResult = cleanedResult.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanedResult.startsWith("```")) {
        cleanedResult = cleanedResult.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      const parsed = JSON.parse(cleanedResult);
      session.destroy();
      return parsed;
    } catch (err) {
      return null;
    }
  }
  const definition = defineBackground(() => {
    console.log("🎯 Background script initialized");
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case "SCRAPED_DATA":
          const scrapedData = message.data;
          if (scrapedData?.jobData.description && scrapedData.jobData.description.length > 100) {
            console.log("🔄 Starting AI analysis in background...");
            analyzeJobWithAI(scrapedData.jobData).then((aiResult) => {
              console.log("AI Result:", aiResult);
              if (aiResult) {
                latestScraped = {
                  jobData: {
                    ...scrapedData.jobData,
                    salary: aiResult.salary || scrapedData.jobData.salary
                  },
                  requirements: aiResult.requirements || scrapedData.requirements || [],
                  skills: aiResult.skills || []
                };
              } else {
                latestScraped = scrapedData;
              }
              browser.runtime.sendMessage({
                type: "RELAYED_SCRAPED_DATA",
                data: latestScraped
              }).catch(() => {
              });
            }).catch((err) => {
              latestScraped = scrapedData;
              browser.runtime.sendMessage({
                type: "RELAYED_SCRAPED_DATA",
                data: latestScraped
              }).catch(() => {
              });
            });
          } else {
            latestScraped = scrapedData;
            browser.runtime.sendMessage({
              type: "RELAYED_SCRAPED_DATA",
              data: latestScraped
            }).catch(() => {
            });
          }
          break;
        case "GET_LATEST_SCRAPED":
          sendResponse(latestScraped);
          return true;
      }
    });
  });
  function initPlugins() {
  }
  var _MatchPattern = class {
    constructor(matchPattern) {
      if (matchPattern === "<all_urls>") {
        this.isAllUrls = true;
        this.protocolMatches = [..._MatchPattern.PROTOCOLS];
        this.hostnameMatch = "*";
        this.pathnameMatch = "*";
      } else {
        const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
        if (groups == null)
          throw new InvalidMatchPattern(matchPattern, "Incorrect format");
        const [_, protocol, hostname, pathname] = groups;
        validateProtocol(matchPattern, protocol);
        validateHostname(matchPattern, hostname);
        this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
        this.hostnameMatch = hostname;
        this.pathnameMatch = pathname;
      }
    }
    includes(url) {
      if (this.isAllUrls)
        return true;
      const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
      return !!this.protocolMatches.find((protocol) => {
        if (protocol === "http")
          return this.isHttpMatch(u);
        if (protocol === "https")
          return this.isHttpsMatch(u);
        if (protocol === "file")
          return this.isFileMatch(u);
        if (protocol === "ftp")
          return this.isFtpMatch(u);
        if (protocol === "urn")
          return this.isUrnMatch(u);
      });
    }
    isHttpMatch(url) {
      return url.protocol === "http:" && this.isHostPathMatch(url);
    }
    isHttpsMatch(url) {
      return url.protocol === "https:" && this.isHostPathMatch(url);
    }
    isHostPathMatch(url) {
      if (!this.hostnameMatch || !this.pathnameMatch)
        return false;
      const hostnameMatchRegexs = [
        this.convertPatternToRegex(this.hostnameMatch),
        this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))
      ];
      const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
      return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
    }
    isFileMatch(url) {
      throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
    }
    isFtpMatch(url) {
      throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
    }
    isUrnMatch(url) {
      throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
    }
    convertPatternToRegex(pattern) {
      const escaped = this.escapeForRegex(pattern);
      const starsReplaced = escaped.replace(/\\\*/g, ".*");
      return RegExp(`^${starsReplaced}$`);
    }
    escapeForRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  };
  var MatchPattern = _MatchPattern;
  MatchPattern.PROTOCOLS = ["http", "https", "file", "ftp", "urn"];
  var InvalidMatchPattern = class extends Error {
    constructor(matchPattern, reason) {
      super(`Invalid match pattern "${matchPattern}": ${reason}`);
    }
  };
  function validateProtocol(matchPattern, protocol) {
    if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*")
      throw new InvalidMatchPattern(
        matchPattern,
        `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`
      );
  }
  function validateHostname(matchPattern, hostname) {
    if (hostname.includes(":"))
      throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
    if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*."))
      throw new InvalidMatchPattern(
        matchPattern,
        `If using a wildcard (*), it must go at the start of the hostname`
      );
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  let ws;
  function getDevServerWebSocket() {
    if (ws == null) {
      const serverUrl = "ws://localhost:3000";
      logger.debug("Connecting to dev server @", serverUrl);
      ws = new WebSocket(serverUrl, "vite-hmr");
      ws.addWxtEventListener = ws.addEventListener.bind(ws);
      ws.sendCustom = (event, payload) => ws?.send(JSON.stringify({ type: "custom", event, payload }));
      ws.addEventListener("open", () => {
        logger.debug("Connected to dev server");
      });
      ws.addEventListener("close", () => {
        logger.debug("Disconnected from dev server");
      });
      ws.addEventListener("error", (event) => {
        logger.error("Failed to connect to dev server", event);
      });
      ws.addEventListener("message", (e) => {
        try {
          const message = JSON.parse(e.data);
          if (message.type === "custom") {
            ws?.dispatchEvent(
              new CustomEvent(message.event, { detail: message.data })
            );
          }
        } catch (err) {
          logger.error("Failed to handle message", err);
        }
      });
    }
    return ws;
  }
  function keepServiceWorkerAlive() {
    setInterval(async () => {
      await browser.runtime.getPlatformInfo();
    }, 5e3);
  }
  function reloadContentScript(payload) {
    const manifest = browser.runtime.getManifest();
    if (manifest.manifest_version == 2) {
      void reloadContentScriptMv2();
    } else {
      void reloadContentScriptMv3(payload);
    }
  }
  async function reloadContentScriptMv3({
    registration,
    contentScript
  }) {
    if (registration === "runtime") {
      await reloadRuntimeContentScriptMv3(contentScript);
    } else {
      await reloadManifestContentScriptMv3(contentScript);
    }
  }
  async function reloadManifestContentScriptMv3(contentScript) {
    const id = `wxt:${contentScript.js[0]}`;
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const existing = registered.find((cs) => cs.id === id);
    if (existing) {
      logger.debug("Updating content script", existing);
      await browser.scripting.updateContentScripts([
        {
          ...contentScript,
          id,
          css: contentScript.css ?? []
        }
      ]);
    } else {
      logger.debug("Registering new content script...");
      await browser.scripting.registerContentScripts([
        {
          ...contentScript,
          id,
          css: contentScript.css ?? []
        }
      ]);
    }
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadRuntimeContentScriptMv3(contentScript) {
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const matches = registered.filter((cs) => {
      const hasJs = contentScript.js?.find((js) => cs.js?.includes(js));
      const hasCss = contentScript.css?.find((css) => cs.css?.includes(css));
      return hasJs || hasCss;
    });
    if (matches.length === 0) {
      logger.log(
        "Content script is not registered yet, nothing to reload",
        contentScript
      );
      return;
    }
    await browser.scripting.updateContentScripts(matches);
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadTabsForContentScript(contentScript) {
    const allTabs = await browser.tabs.query({});
    const matchPatterns = contentScript.matches.map(
      (match) => new MatchPattern(match)
    );
    const matchingTabs = allTabs.filter((tab) => {
      const url = tab.url;
      if (!url) return false;
      return !!matchPatterns.find((pattern) => pattern.includes(url));
    });
    await Promise.all(
      matchingTabs.map(async (tab) => {
        try {
          await browser.tabs.reload(tab.id);
        } catch (err) {
          logger.warn("Failed to reload tab:", err);
        }
      })
    );
  }
  async function reloadContentScriptMv2(_payload) {
    throw Error("TODO: reloadContentScriptMv2");
  }
  {
    try {
      const ws2 = getDevServerWebSocket();
      ws2.addWxtEventListener("wxt:reload-extension", () => {
        browser.runtime.reload();
      });
      ws2.addWxtEventListener("wxt:reload-content-script", (event) => {
        reloadContentScript(event.detail);
      });
      if (true) {
        ws2.addEventListener(
          "open",
          () => ws2.sendCustom("wxt:background-initialized")
        );
        keepServiceWorkerAlive();
      }
    } catch (err) {
      logger.error("Failed to setup web socket connection with dev server", err);
    }
    browser.commands.onCommand.addListener((command) => {
      if (command === "wxt:reload-extension") {
        browser.runtime.reload();
      }
    });
  }
  let result;
  try {
    initPlugins();
    result = definition.main();
    if (result instanceof Promise) {
      console.warn(
        "The background's main() function return a promise, but it must be synchronous"
      );
    }
  } catch (err) {
    logger.error("The background crashed on startup!");
    throw err;
  }
  const result$1 = result;
  return result$1;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zcmMvZW50cnlwb2ludHMvYmFja2dyb3VuZC50cyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVCYWNrZ3JvdW5kKGFyZykge1xuICBpZiAoYXJnID09IG51bGwgfHwgdHlwZW9mIGFyZyA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyBtYWluOiBhcmcgfTtcbiAgcmV0dXJuIGFyZztcbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImludGVyZmFjZSBTa2lsbCB7XG4gIG5hbWU6IHN0cmluZztcbiAgbWF0Y2g6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIEpvYkRhdGEge1xuICB0aXRsZTogc3RyaW5nO1xuICBjb21wYW55OiBzdHJpbmc7XG4gIGxvY2F0aW9uOiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbiAgc2FsYXJ5OiBzdHJpbmc7XG4gIHBvc3RlZDogc3RyaW5nO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgU2NyYXBlZERhdGEge1xuICBqb2JEYXRhOiBKb2JEYXRhO1xuICByZXF1aXJlbWVudHM6IHN0cmluZ1tdO1xuICBza2lsbHM6IFNraWxsW107XG59XG5cbmxldCBsYXRlc3RTY3JhcGVkOiBTY3JhcGVkRGF0YSB8IG51bGwgPSBudWxsO1xuXG5cbmFzeW5jIGZ1bmN0aW9uIGFuYWx5emVKb2JXaXRoQUkoam9iRGF0YTogYW55KSB7XG4gIHRyeSB7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IGF2YWlsYWJpbGl0eSA9IGF3YWl0IExhbmd1YWdlTW9kZWwuYXZhaWxhYmlsaXR5KCk7XG4gICAgY29uc29sZS5sb2coJ+KcqCBBSSBBdmFpbGFiaWxpdHk6JywgYXZhaWxhYmlsaXR5KTtcblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdubycpIHtcbiAgICAgIGNvbnNvbGUud2FybihcIuKdjCBHZW1pbmkgTmFubyBub3QgYXZhaWxhYmxlXCIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGF2YWlsYWJpbGl0eSA9PT0gJ2FmdGVyLWRvd25sb2FkJykge1xuICAgICAgY29uc29sZS5sb2coXCLij7MgVHJpZ2dlcmluZyBHZW1pbmkgTmFubyBkb3dubG9hZC4uLlwiKTtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG5cbiAgICBjb25zdCBkZXNjcmlwdGlvbiA9IGpvYkRhdGEuZGVzY3JpcHRpb24gXG4gICAgICA/IGpvYkRhdGEuZGVzY3JpcHRpb24uc3Vic3RyaW5nKDAsIDE1MDApXG4gICAgICA6ICdObyBkZXNjcmlwdGlvbiBhdmFpbGFibGUnO1xuXG4gICAgY29uc3Qgc2NoZW1hID0ge1xuICAgICAgdHlwZTogXCJvYmplY3RcIixcbiAgICAgIHJlcXVpcmVkOiBbXCJjbGVhblN1bW1hcnlcIiwgXCJzYWxhcnlcIiwgXCJza2lsbHNcIiwgXCJyZXF1aXJlbWVudHNcIl0sXG4gICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIGNsZWFuU3VtbWFyeTogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgIHNhbGFyeTogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgIHNraWxsczoge1xuICAgICAgICAgIHR5cGU6IFwiYXJyYXlcIixcbiAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgdHlwZTogXCJvYmplY3RcIixcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbXCJuYW1lXCIsIFwibWF0Y2hcIl0sXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIG5hbWU6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICAgICAgICBtYXRjaDogeyB0eXBlOiBcIm51bWJlclwiIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVtZW50czoge3R5cGU6IFwiYXJyYXlcIixcbiAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgdHlwZTogXCJzdHJpbmdcIixcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IHByb21wdCA9IGBBbmFseXplIHRoaXMgam9iIHBvc3RpbmcgYW5kIGV4dHJhY3Qga2V5IGluZm9ybWF0aW9uLlxuXG5Kb2IgRGV0YWlsczpcbi0gVGl0bGU6ICR7am9iRGF0YS50aXRsZSB8fCAnVW5rbm93bid9XG4tIENvbXBhbnk6ICR7am9iRGF0YS5jb21wYW55IHx8ICdVbmtub3duJ31cbi0gTG9jYXRpb246ICR7am9iRGF0YS5sb2NhdGlvbiB8fCAnTm90IHNwZWNpZmllZCd9XG4tIFR5cGU6ICR7am9iRGF0YS50eXBlIHx8ICdOb3Qgc3BlY2lmaWVkJ31cbi0gQ3VycmVudCBTYWxhcnk6ICR7am9iRGF0YS5zYWxhcnkgfHwgXCJOb3Qgc3BlY2lmaWVkXCJ9XG5cbkZ1bGwgRGVzY3JpcHRpb246XG4ke2Rlc2NyaXB0aW9ufVxuXG5JTVBPUlRBTlQ6IE9ubHkgZXh0cmFjdCBpbmZvcm1hdGlvbiB0aGF0IGlzIGV4cGxpY2l0bHkgc3RhdGVkIGluIHRoZSBkZXNjcmlwdGlvbi4gRG8gbm90IG1ha2UgdXAgb3IgaW5mZXIgaW5mb3JtYXRpb24uXG5cblByb3ZpZGUgYSBKU09OIHJlc3BvbnNlIHdpdGg6XG4xLiBjbGVhblN1bW1hcnk6IEEgMi0zIHNlbnRlbmNlIGNvbmNpc2Ugc3VtbWFyeSBvZiB0aGUgcm9sZVxuMi4gc2FsYXJ5OiBFeHRyYWN0IHNhbGFyeSBhcyBcIiRYWCxYWFggLSAkWFgsWFhYXCIgb3IgXCJOL0FcIiBpZiBub3QgbWVudGlvbmVkXG4zLiByZXF1aXJlbWVudHM6IEV4dHJhY3QgNS03IGtleSBxdWFsaWZpY2F0aW9ucy9yZXF1aXJlbWVudHMgKHByaW9yaXRpemUgYmFzaWMgcXVhbGlmaWNhdGlvbnMpXG40LiBza2lsbHM6IEFycmF5IG9mIDUtNyBrZXkgdGVjaG5pY2FsIHNraWxscyB3aXRoIGltcG9ydGFuY2UgcmF0aW5nICgwLTEwMClcblxuRXhhbXBsZSBmb3JtYXQ6XG57XG4gIFwiY2xlYW5TdW1tYXJ5XCI6IFwiU29mdHdhcmUgZW5naW5lZXIgcm9sZSBmb2N1c2luZyBvbi4uLlwiLFxuICBcInNhbGFyeVwiOiBcIiQ4MCwwMDAgLSAkMTIwLDAwMFwiLFxuICBcInJlcXVpcmVtZW50c1wiOiBbXCJCYWNoZWxvcidzIGRlZ3JlZSBpbiBDU1wiLCBcIjMrIHllYXJzIGV4cGVyaWVuY2VcIl0sXG4gIFwic2tpbGxzXCI6IFt7XCJuYW1lXCI6IFwiSmF2YVNjcmlwdFwiLCBcIm1hdGNoXCI6IDkwfSwge1wibmFtZVwiOiBcIlJlYWN0XCIsIFwibWF0Y2hcIjogODV9XVxufVxuXG5SZXR1cm4gT05MWSB2YWxpZCBKU09OIG1hdGNoaW5nIHRoaXMgc3RydWN0dXJlLmA7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzZXNzaW9uLnByb21wdChwcm9tcHQpO1xuICAgIGNvbnNvbGUubG9nKFwi8J+kliBSYXcgQUkgUmVzcG9uc2U6XCIsIHJlc3VsdCk7XG5cbiAgICAgIGxldCBjbGVhbmVkUmVzdWx0ID0gcmVzdWx0LnRyaW0oKTtcbiAgICBcbiAgICAvLyBSZW1vdmUgYGBganNvbiBhbmQgYGBgIGlmIHByZXNlbnRcbiAgICBpZiAoY2xlYW5lZFJlc3VsdC5zdGFydHNXaXRoKCdgYGBqc29uJykpIHtcbiAgICAgIGNsZWFuZWRSZXN1bHQgPSBjbGVhbmVkUmVzdWx0LnJlcGxhY2UoL15gYGBqc29uXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqYGBgJC8sICcnKTtcbiAgICB9IGVsc2UgaWYgKGNsZWFuZWRSZXN1bHQuc3RhcnRzV2l0aCgnYGBgJykpIHtcbiAgICAgIGNsZWFuZWRSZXN1bHQgPSBjbGVhbmVkUmVzdWx0LnJlcGxhY2UoL15gYGBcXHMqLywgJycpLnJlcGxhY2UoL1xccypgYGAkLywgJycpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGNsZWFuZWRSZXN1bHQpO1xuICAgIFxuICAgIHNlc3Npb24uZGVzdHJveSgpO1xuICAgIHJldHVybiBwYXJzZWQ7XG5cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XG4gIGNvbnNvbGUubG9nKCfwn46vIEJhY2tncm91bmQgc2NyaXB0IGluaXRpYWxpemVkJyk7XG5cbiAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICBzd2l0Y2ggKG1lc3NhZ2UudHlwZSkge1xuICAgICAgY2FzZSAnU0NSQVBFRF9EQVRBJzpcbiAgICAgICAgLy8gU3RvcmUgdGhlIHNjcmFwZWQgZGF0YVxuICAgICAgICBjb25zdCBzY3JhcGVkRGF0YSA9IG1lc3NhZ2UuZGF0YSBhcyBTY3JhcGVkRGF0YTtcbiAgICAgICAgXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdCYWNrZ3JvdW5kIHJlY2VpdmVkIGpvYiBkYXRhOicsIHtcbiAgICAgICAgLy8gICBjb21wYW55OiBzY3JhcGVkRGF0YT8uam9iRGF0YS5jb21wYW55LFxuICAgICAgICAvLyAgIHRpdGxlOiBzY3JhcGVkRGF0YT8uam9iRGF0YS50aXRsZSxcbiAgICAgICAgLy8gICBoYXNEZXNjcmlwdGlvbjogISFzY3JhcGVkRGF0YT8uam9iRGF0YS5kZXNjcmlwdGlvbixcbiAgICAgICAgLy8gICBkZXNjTGVuZ3RoOiBzY3JhcGVkRGF0YT8uam9iRGF0YS5kZXNjcmlwdGlvbj8ubGVuZ3RoIHx8IDAsXG4gICAgICAgIC8vIH0pO1xuXG4gICAgICAgIC8vIEFuYWx5emUgd2l0aCBBSSBiZWZvcmUgc3RvcmluZy9yZWxheWluZ1xuICAgICAgICBpZiAoc2NyYXBlZERhdGE/LmpvYkRhdGEuZGVzY3JpcHRpb24gJiYgc2NyYXBlZERhdGEuam9iRGF0YS5kZXNjcmlwdGlvbi5sZW5ndGggPiAxMDApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygn8J+UhCBTdGFydGluZyBBSSBhbmFseXNpcyBpbiBiYWNrZ3JvdW5kLi4uJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgYW5hbHl6ZUpvYldpdGhBSShzY3JhcGVkRGF0YS5qb2JEYXRhKVxuICAgICAgICAgICAgLnRoZW4oYWlSZXN1bHQgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnQUkgUmVzdWx0OicsIGFpUmVzdWx0KTtcblxuICAgICAgICAgICAgICBpZiAoYWlSZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAvLyBFbnJpY2ggdGhlIGRhdGEgd2l0aCBBSSByZXN1bHRzXG4gICAgICAgICAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IHtcbiAgICAgICAgICAgICAgICAgIGpvYkRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uc2NyYXBlZERhdGEuam9iRGF0YSxcbiAgICAgICAgICAgICAgICAgICAgc2FsYXJ5OiBhaVJlc3VsdC5zYWxhcnkgfHwgc2NyYXBlZERhdGEuam9iRGF0YS5zYWxhcnksXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgcmVxdWlyZW1lbnRzOiBhaVJlc3VsdC5yZXF1aXJlbWVudHMgfHwgc2NyYXBlZERhdGEucmVxdWlyZW1lbnRzIHx8IFtdLFxuICAgICAgICAgICAgICAgICAgc2tpbGxzOiBhaVJlc3VsdC5za2lsbHMgfHwgW10sXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBBSSBmYWlsZWQsIHVzZSBvcmlnaW5hbCBkYXRhXG4gICAgICAgICAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IHNjcmFwZWREYXRhO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gUmVsYXkgZW5yaWNoZWQgZGF0YSB0byBwb3B1cFxuICAgICAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdSRUxBWUVEX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICAgICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgICAvLyBVc2Ugb3JpZ2luYWwgZGF0YSBvbiBlcnJvclxuICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkID0gc2NyYXBlZERhdGE7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdSRUxBWUVEX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICAgICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4ge30pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gTm8gZGVzY3JpcHRpb24gb3IgdG9vIHNob3J0LCBza2lwIEFJXG4gICAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IHNjcmFwZWREYXRhO1xuICAgICAgICAgIFxuICAgICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICB0eXBlOiAnUkVMQVlFRF9TQ1JBUEVEX0RBVEEnLFxuICAgICAgICAgICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICB9KS5jYXRjaCgoKSA9PiB7XG4gICAgICAgICAgICAvL1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdHRVRfTEFURVNUX1NDUkFQRUQnOlxuICAgICAgICAvLyBQb3B1cCByZXF1ZXN0aW5nIHN0b3JlZCBkYXRhXG4gICAgICAgIHNlbmRSZXNwb25zZShsYXRlc3RTY3JhcGVkKTtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIEtlZXAgY2hhbm5lbCBvcGVuIGZvciBhc3luY1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH0pO1xufSk7IiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJuYW1lcyI6WyJicm93c2VyIiwiX2Jyb3dzZXIiLCJyZXN1bHQiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxpQkFBaUIsS0FBSztBQUNwQyxRQUFJLE9BQU8sUUFBUSxPQUFPLFFBQVEsV0FBWSxRQUFPLEVBQUUsTUFBTSxJQUFHO0FBQ2hFLFdBQU87QUFBQSxFQUNUO0FDRk8sUUFBTUEsWUFBVSxXQUFXLFNBQVMsU0FBUyxLQUNoRCxXQUFXLFVBQ1gsV0FBVztBQ0ZSLFFBQU0sVUFBVUM7QUNvQnZCLE1BQUEsZ0JBQUE7QUFHQSxpQkFBQSxpQkFBQSxTQUFBO0FBQ0UsUUFBQTtBQUVFLFlBQUEsZUFBQSxNQUFBLGNBQUEsYUFBQTtBQUNBLGNBQUEsSUFBQSxzQkFBQSxZQUFBO0FBRUEsVUFBQSxpQkFBQSxNQUFBO0FBQ0UsZ0JBQUEsS0FBQSw2QkFBQTtBQUNBLGVBQUE7QUFBQSxNQUFPO0FBR1QsVUFBQSxpQkFBQSxrQkFBQTtBQUNFLGdCQUFBLElBQUEsc0NBQUE7QUFFQSxjQUFBLGNBQUEsT0FBQTtBQUNBLGVBQUE7QUFBQSxNQUFPO0FBSVQsWUFBQSxVQUFBLE1BQUEsY0FBQSxPQUFBO0FBRUEsWUFBQSxjQUFBLFFBQUEsY0FBQSxRQUFBLFlBQUEsVUFBQSxHQUFBLElBQUEsSUFBQTtBQUlBLFlBQUEsU0FBQTtBQUFBLFFBQWUsTUFBQTtBQUFBLFFBQ1AsVUFBQSxDQUFBLGdCQUFBLFVBQUEsVUFBQSxjQUFBO0FBQUEsUUFDdUQsc0JBQUE7QUFBQSxRQUN2QyxZQUFBO0FBQUEsVUFDVixjQUFBLEVBQUEsTUFBQSxTQUFBO0FBQUEsVUFDcUIsUUFBQSxFQUFBLE1BQUEsU0FBQTtBQUFBLFVBQ04sUUFBQTtBQUFBLFlBQ2pCLE1BQUE7QUFBQSxZQUNBLE9BQUE7QUFBQSxjQUNDLE1BQUE7QUFBQSxjQUND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
