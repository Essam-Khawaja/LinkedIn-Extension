var background = (function() {
  "use strict";
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
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
      const result2 = await session.prompt(prompt, { responseConstraint: schema });
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
  let latestScraped = null;
  let isProcessing = false;
  const definition = defineBackground(() => {
    console.log("🎯 Background script initialized");
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case "SCRAPING_STARTED":
          console.log("🔄 SCRAPING_STARTED - setting isProcessing = true");
          isProcessing = true;
          browser.runtime.sendMessage({
            type: "SCRAPING_STARTED"
          }).catch(() => {
            console.log("Popup not open, state stored in background");
          });
          break;
        case "JOB_SCRAPED_DATA":
          const scrapedData = message.data;
          console.log("📦 JOB_SCRAPED_DATA received");
          if (scrapedData?.jobData.description && scrapedData.jobData.description.length > 100) {
            console.log("🔄 Starting AI analysis in background...");
            analyzeJobWithAI(scrapedData.jobData).then((aiResult) => {
              console.log("✅ AI Result:", aiResult);
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
              isProcessing = false;
              browser.runtime.sendMessage({
                type: "RELAYED_JOB_SCRAPED_DATA",
                data: latestScraped
              }).catch(() => {
                console.log("Popup not open, data stored in background");
              });
            }).catch((err) => {
              console.error("❌ AI analysis error:", err);
              latestScraped = scrapedData;
              isProcessing = false;
              browser.runtime.sendMessage({
                type: "RELAYED_JOB_SCRAPED_DATA",
                data: latestScraped
              }).catch(() => {
                console.log("Popup not open, data stored in background");
              });
            });
          } else {
            console.log("⏭️ Skipping AI analysis (no description)");
            latestScraped = scrapedData;
            isProcessing = false;
            browser.runtime.sendMessage({
              type: "RELAYED_JOB_SCRAPED_DATA",
              data: latestScraped
            }).catch(() => {
              console.log("Popup not open, data stored in background");
            });
          }
          break;
        case "PROFILE_SCRAPED_DATA":
          console.log("Background receiving content script call");
          break;
        case "GET_LATEST_JOB_SCRAPED":
          console.log("📤 Sending data to popup:", { hasData: !!latestScraped, isProcessing });
          sendResponse({ data: latestScraped, isProcessing });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zcmMvbGliL2JhY2tncm91bmQtaGVscC9qb2Itc3VtbWFyaXplci50cyIsIi4uLy4uL3NyYy9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG4gIGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuICByZXR1cm4gYXJnO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiaW50ZXJmYWNlIFNraWxsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBtYXRjaDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSm9iRGF0YSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGNvbXBhbnk6IHN0cmluZztcbiAgbG9jYXRpb246IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzYWxhcnk6IHN0cmluZztcbiAgcG9zdGVkOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTY3JhcGVkRGF0YSB7XG4gIGpvYkRhdGE6IEpvYkRhdGE7XG4gIHJlcXVpcmVtZW50czogc3RyaW5nW107XG4gIHNraWxsczogU2tpbGxbXTtcbn1cblxuXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBhbmFseXplSm9iV2l0aEFJKGpvYkRhdGE6IGFueSkge1xuICB0cnkge1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBhdmFpbGFiaWxpdHkgPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmF2YWlsYWJpbGl0eSgpO1xuICAgIGNvbnNvbGUubG9nKCfinKggQUkgQXZhaWxhYmlsaXR5OicsIGF2YWlsYWJpbGl0eSk7XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnbm8nKSB7XG4gICAgICBjb25zb2xlLndhcm4oXCLinYwgR2VtaW5pIE5hbm8gbm90IGF2YWlsYWJsZVwiKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdhZnRlci1kb3dubG9hZCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwi4o+zIFRyaWdnZXJpbmcgR2VtaW5pIE5hbm8gZG93bmxvYWQuLi5cIik7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuXG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSBqb2JEYXRhLmRlc2NyaXB0aW9uIFxuICAgICAgPyBqb2JEYXRhLmRlc2NyaXB0aW9uLnN1YnN0cmluZygwLCAxNTAwKVxuICAgICAgOiAnTm8gZGVzY3JpcHRpb24gYXZhaWxhYmxlJztcblxuICAgIGNvbnN0IHNjaGVtYSA9IHtcbiAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICByZXF1aXJlZDogW1wiY2xlYW5TdW1tYXJ5XCIsIFwic2FsYXJ5XCIsIFwic2tpbGxzXCIsIFwicmVxdWlyZW1lbnRzXCJdLFxuICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBjbGVhblN1bW1hcnk6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICBzYWxhcnk6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICBza2lsbHM6IHtcbiAgICAgICAgICB0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICAgICAgICByZXF1aXJlZDogW1wibmFtZVwiLCBcIm1hdGNoXCJdLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICBuYW1lOiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgICAgICAgbWF0Y2g6IHsgdHlwZTogXCJudW1iZXJcIiB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlbWVudHM6IHt0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH07XG5cbiAgICBjb25zdCBwcm9tcHQgPSBgQW5hbHl6ZSB0aGlzIGpvYiBwb3N0aW5nIGFuZCBleHRyYWN0IGtleSBpbmZvcm1hdGlvbi5cblxuSm9iIERldGFpbHM6XG4tIFRpdGxlOiAke2pvYkRhdGEudGl0bGUgfHwgJ1Vua25vd24nfVxuLSBDb21wYW55OiAke2pvYkRhdGEuY29tcGFueSB8fCAnVW5rbm93bid9XG4tIExvY2F0aW9uOiAke2pvYkRhdGEubG9jYXRpb24gfHwgJ05vdCBzcGVjaWZpZWQnfVxuLSBUeXBlOiAke2pvYkRhdGEudHlwZSB8fCAnTm90IHNwZWNpZmllZCd9XG4tIEN1cnJlbnQgU2FsYXJ5OiAke2pvYkRhdGEuc2FsYXJ5IHx8IFwiTm90IHNwZWNpZmllZFwifVxuXG5GdWxsIERlc2NyaXB0aW9uOlxuJHtkZXNjcmlwdGlvbn1cblxuSU1QT1JUQU5UOiBPbmx5IGV4dHJhY3QgaW5mb3JtYXRpb24gdGhhdCBpcyBleHBsaWNpdGx5IHN0YXRlZCBpbiB0aGUgZGVzY3JpcHRpb24uIERvIG5vdCBtYWtlIHVwIG9yIGluZmVyIGluZm9ybWF0aW9uLlxuXG5Qcm92aWRlIGEgSlNPTiByZXNwb25zZSB3aXRoOlxuMS4gY2xlYW5TdW1tYXJ5OiBBIDItMyBzZW50ZW5jZSBjb25jaXNlIHN1bW1hcnkgb2YgdGhlIHJvbGVcbjIuIHNhbGFyeTogRXh0cmFjdCBzYWxhcnkgYXMgXCIkWFgsWFhYIC0gJFhYLFhYWFwiIG9yIFwiTi9BXCIgaWYgbm90IG1lbnRpb25lZFxuMy4gcmVxdWlyZW1lbnRzOiBFeHRyYWN0IDUtNyBrZXkgcXVhbGlmaWNhdGlvbnMvcmVxdWlyZW1lbnRzIChwcmlvcml0aXplIGJhc2ljIHF1YWxpZmljYXRpb25zKVxuNC4gc2tpbGxzOiBBcnJheSBvZiA1LTcga2V5IHRlY2huaWNhbCBza2lsbHMgd2l0aCBpbXBvcnRhbmNlIHJhdGluZyAoMC0xMDApXG5cbkV4YW1wbGUgZm9ybWF0Olxue1xuICBcImNsZWFuU3VtbWFyeVwiOiBcIlNvZnR3YXJlIGVuZ2luZWVyIHJvbGUgZm9jdXNpbmcgb24uLi5cIixcbiAgXCJzYWxhcnlcIjogXCIkODAsMDAwIC0gJDEyMCwwMDBcIixcbiAgXCJyZXF1aXJlbWVudHNcIjogW1wiQmFjaGVsb3IncyBkZWdyZWUgaW4gQ1NcIiwgXCIzKyB5ZWFycyBleHBlcmllbmNlXCJdLFxuICBcInNraWxsc1wiOiBbe1wibmFtZVwiOiBcIkphdmFTY3JpcHRcIiwgXCJtYXRjaFwiOiA5MH0sIHtcIm5hbWVcIjogXCJSZWFjdFwiLCBcIm1hdGNoXCI6IDg1fV1cbn1cblxuUmV0dXJuIE9OTFkgdmFsaWQgSlNPTiBtYXRjaGluZyB0aGlzIHN0cnVjdHVyZS5gO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc2Vzc2lvbi5wcm9tcHQocHJvbXB0LCB7cmVzcG9uc2VDb25zdHJhaW50OiBzY2hlbWF9KTtcbiAgICBjb25zb2xlLmxvZyhcIvCfpJYgUmF3IEFJIFJlc3BvbnNlOlwiLCByZXN1bHQpO1xuXG4gICAgICBsZXQgY2xlYW5lZFJlc3VsdCA9IHJlc3VsdC50cmltKCk7XG4gICAgXG4gICAgLy8gUmVtb3ZlIGBgYGpzb24gYW5kIGBgYCBpZiBwcmVzZW50XG4gICAgaWYgKGNsZWFuZWRSZXN1bHQuc3RhcnRzV2l0aCgnYGBganNvbicpKSB7XG4gICAgICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBganNvblxccyovLCAnJykucmVwbGFjZSgvXFxzKmBgYCQvLCAnJyk7XG4gICAgfSBlbHNlIGlmIChjbGVhbmVkUmVzdWx0LnN0YXJ0c1dpdGgoJ2BgYCcpKSB7XG4gICAgICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBgXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqYGBgJC8sICcnKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShjbGVhbmVkUmVzdWx0KTtcbiAgICBcbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICByZXR1cm4gcGFyc2VkO1xuXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59IiwiaW1wb3J0IGFuYWx5emVKb2JXaXRoQUkgZnJvbSBcIkAvbGliL2JhY2tncm91bmQtaGVscC9qb2Itc3VtbWFyaXplclwiO1xuXG5pbnRlcmZhY2UgU2tpbGwge1xuICBuYW1lOiBzdHJpbmc7XG4gIG1hdGNoOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBKb2JEYXRhIHtcbiAgdGl0bGU6IHN0cmluZztcbiAgY29tcGFueTogc3RyaW5nO1xuICBsb2NhdGlvbjogc3RyaW5nO1xuICB0eXBlOiBzdHJpbmc7XG4gIHNhbGFyeTogc3RyaW5nO1xuICBwb3N0ZWQ6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFNjcmFwZWREYXRhIHtcbiAgam9iRGF0YTogSm9iRGF0YTtcbiAgcmVxdWlyZW1lbnRzOiBzdHJpbmdbXTtcbiAgc2tpbGxzOiBTa2lsbFtdO1xufVxuXG5sZXQgbGF0ZXN0U2NyYXBlZDogU2NyYXBlZERhdGEgfCBudWxsID0gbnVsbDtcbmxldCBpc1Byb2Nlc3NpbmcgPSBmYWxzZTsgLy8gVHJhY2sgaWYgQUkgYW5hbHlzaXMgaXMgaW4gcHJvZ3Jlc3NcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XG4gIGNvbnNvbGUubG9nKCfwn46vIEJhY2tncm91bmQgc2NyaXB0IGluaXRpYWxpemVkJyk7XG5cbiAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICBzd2l0Y2ggKG1lc3NhZ2UudHlwZSkge1xuICAgICAgY2FzZSAnU0NSQVBJTkdfU1RBUlRFRCc6XG4gICAgICAgIC8vIE1hcmsgYXMgcHJvY2Vzc2luZ1xuICAgICAgICBjb25zb2xlLmxvZygn8J+UhCBTQ1JBUElOR19TVEFSVEVEIC0gc2V0dGluZyBpc1Byb2Nlc3NpbmcgPSB0cnVlJyk7XG4gICAgICAgIGlzUHJvY2Vzc2luZyA9IHRydWU7XG4gICAgICAgIFxuICAgICAgICAvLyBUcnkgdG8gbm90aWZ5IHBvcHVwIGlmIGl0J3Mgb3BlblxuICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgIHR5cGU6ICdTQ1JBUElOR19TVEFSVEVEJyxcbiAgICAgICAgfSkuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdQb3B1cCBub3Qgb3Blbiwgc3RhdGUgc3RvcmVkIGluIGJhY2tncm91bmQnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdKT0JfU0NSQVBFRF9EQVRBJzpcbiAgICAgICAgLy8gU3RvcmUgdGhlIHNjcmFwZWQgZGF0YVxuICAgICAgICBjb25zdCBzY3JhcGVkRGF0YSA9IG1lc3NhZ2UuZGF0YSBhcyBTY3JhcGVkRGF0YTtcbiAgICAgICAgY29uc29sZS5sb2coJ/Cfk6YgSk9CX1NDUkFQRURfREFUQSByZWNlaXZlZCcpO1xuXG4gICAgICAgIGlmIChzY3JhcGVkRGF0YT8uam9iRGF0YS5kZXNjcmlwdGlvbiAmJiBzY3JhcGVkRGF0YS5qb2JEYXRhLmRlc2NyaXB0aW9uLmxlbmd0aCA+IDEwMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCfwn5SEIFN0YXJ0aW5nIEFJIGFuYWx5c2lzIGluIGJhY2tncm91bmQuLi4nKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhbmFseXplSm9iV2l0aEFJKHNjcmFwZWREYXRhLmpvYkRhdGEpXG4gICAgICAgICAgICAudGhlbihhaVJlc3VsdCA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCfinIUgQUkgUmVzdWx0OicsIGFpUmVzdWx0KTtcblxuICAgICAgICAgICAgICBpZiAoYWlSZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAvLyBFbnJpY2ggdGhlIGRhdGEgd2l0aCBBSSByZXN1bHRzXG4gICAgICAgICAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IHtcbiAgICAgICAgICAgICAgICAgIGpvYkRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uc2NyYXBlZERhdGEuam9iRGF0YSxcbiAgICAgICAgICAgICAgICAgICAgc2FsYXJ5OiBhaVJlc3VsdC5zYWxhcnkgfHwgc2NyYXBlZERhdGEuam9iRGF0YS5zYWxhcnksXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgcmVxdWlyZW1lbnRzOiBhaVJlc3VsdC5yZXF1aXJlbWVudHMgfHwgc2NyYXBlZERhdGEucmVxdWlyZW1lbnRzIHx8IFtdLFxuICAgICAgICAgICAgICAgICAgc2tpbGxzOiBhaVJlc3VsdC5za2lsbHMgfHwgW10sXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBBSSBmYWlsZWQsIHVzZSBvcmlnaW5hbCBkYXRhXG4gICAgICAgICAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IHNjcmFwZWREYXRhO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gTWFyayBhcyBkb25lIHByb2Nlc3NpbmdcbiAgICAgICAgICAgICAgaXNQcm9jZXNzaW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgLy8gUmVsYXkgZW5yaWNoZWQgZGF0YSB0byBwb3B1cFxuICAgICAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdSRUxBWUVEX0pPQl9TQ1JBUEVEX0RBVEEnLFxuICAgICAgICAgICAgICAgIGRhdGE6IGxhdGVzdFNjcmFwZWQsXG4gICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnUG9wdXAgbm90IG9wZW4sIGRhdGEgc3RvcmVkIGluIGJhY2tncm91bmQnKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+KdjCBBSSBhbmFseXNpcyBlcnJvcjonLCBlcnIpO1xuICAgICAgICAgICAgICAvLyBVc2Ugb3JpZ2luYWwgZGF0YSBvbiBlcnJvclxuICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkID0gc2NyYXBlZERhdGE7XG4gICAgICAgICAgICAgIGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnUkVMQVlFRF9KT0JfU0NSQVBFRF9EQVRBJyxcbiAgICAgICAgICAgICAgICBkYXRhOiBsYXRlc3RTY3JhcGVkLFxuICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1BvcHVwIG5vdCBvcGVuLCBkYXRhIHN0b3JlZCBpbiBiYWNrZ3JvdW5kJyk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gTm8gZGVzY3JpcHRpb24gb3IgdG9vIHNob3J0LCBza2lwIEFJXG4gICAgICAgICAgY29uc29sZS5sb2coJ+KPre+4jyBTa2lwcGluZyBBSSBhbmFseXNpcyAobm8gZGVzY3JpcHRpb24pJyk7XG4gICAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IHNjcmFwZWREYXRhO1xuICAgICAgICAgIGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICB0eXBlOiAnUkVMQVlFRF9KT0JfU0NSQVBFRF9EQVRBJyxcbiAgICAgICAgICAgIGRhdGE6IGxhdGVzdFNjcmFwZWQsXG4gICAgICAgICAgfSkuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1BvcHVwIG5vdCBvcGVuLCBkYXRhIHN0b3JlZCBpbiBiYWNrZ3JvdW5kJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ1BST0ZJTEVfU0NSQVBFRF9EQVRBJzpcbiAgICAgICAgY29uc29sZS5sb2coJ0JhY2tncm91bmQgcmVjZWl2aW5nIGNvbnRlbnQgc2NyaXB0IGNhbGwnKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ0dFVF9MQVRFU1RfSk9CX1NDUkFQRUQnOlxuICAgICAgICAvLyBQb3B1cCByZXF1ZXN0aW5nIHN0b3JlZCBkYXRhIGFuZCBwcm9jZXNzaW5nIHN0YXRlXG4gICAgICAgIGNvbnNvbGUubG9nKCfwn5OkIFNlbmRpbmcgZGF0YSB0byBwb3B1cDonLCB7IGhhc0RhdGE6ICEhbGF0ZXN0U2NyYXBlZCwgaXNQcm9jZXNzaW5nIH0pO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBkYXRhOiBsYXRlc3RTY3JhcGVkLCBpc1Byb2Nlc3NpbmcgfSk7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBLZWVwIGNoYW5uZWwgb3BlbiBmb3IgYXN5bmNcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9KTtcbn0pOyIsIi8vIHNyYy9pbmRleC50c1xudmFyIF9NYXRjaFBhdHRlcm4gPSBjbGFzcyB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybikge1xuICAgIGlmIChtYXRjaFBhdHRlcm4gPT09IFwiPGFsbF91cmxzPlwiKSB7XG4gICAgICB0aGlzLmlzQWxsVXJscyA9IHRydWU7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IFsuLi5fTWF0Y2hQYXR0ZXJuLlBST1RPQ09MU107XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBncm91cHMgPSAvKC4qKTpcXC9cXC8oLio/KShcXC8uKikvLmV4ZWMobWF0Y2hQYXR0ZXJuKTtcbiAgICAgIGlmIChncm91cHMgPT0gbnVsbClcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBcIkluY29ycmVjdCBmb3JtYXRcIik7XG4gICAgICBjb25zdCBbXywgcHJvdG9jb2wsIGhvc3RuYW1lLCBwYXRobmFtZV0gPSBncm91cHM7XG4gICAgICB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpO1xuICAgICAgdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKTtcbiAgICAgIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSk7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IHByb3RvY29sID09PSBcIipcIiA/IFtcImh0dHBcIiwgXCJodHRwc1wiXSA6IFtwcm90b2NvbF07XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBob3N0bmFtZTtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IHBhdGhuYW1lO1xuICAgIH1cbiAgfVxuICBpbmNsdWRlcyh1cmwpIHtcbiAgICBpZiAodGhpcy5pc0FsbFVybHMpXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCB1ID0gdHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIiA/IG5ldyBVUkwodXJsKSA6IHVybCBpbnN0YW5jZW9mIExvY2F0aW9uID8gbmV3IFVSTCh1cmwuaHJlZikgOiB1cmw7XG4gICAgcmV0dXJuICEhdGhpcy5wcm90b2NvbE1hdGNoZXMuZmluZCgocHJvdG9jb2wpID0+IHtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBzXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cHNNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmaWxlXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRmlsZU1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZ0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0Z0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcInVyblwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc1Vybk1hdGNoKHUpO1xuICAgIH0pO1xuICB9XG4gIGlzSHR0cE1hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cDpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSHR0cHNNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHBzOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIb3N0UGF0aE1hdGNoKHVybCkge1xuICAgIGlmICghdGhpcy5ob3N0bmFtZU1hdGNoIHx8ICF0aGlzLnBhdGhuYW1lTWF0Y2gpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgaG9zdG5hbWVNYXRjaFJlZ2V4cyA9IFtcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaCksXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gucmVwbGFjZSgvXlxcKlxcLi8sIFwiXCIpKVxuICAgIF07XG4gICAgY29uc3QgcGF0aG5hbWVNYXRjaFJlZ2V4ID0gdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5wYXRobmFtZU1hdGNoKTtcbiAgICByZXR1cm4gISFob3N0bmFtZU1hdGNoUmVnZXhzLmZpbmQoKHJlZ2V4KSA9PiByZWdleC50ZXN0KHVybC5ob3N0bmFtZSkpICYmIHBhdGhuYW1lTWF0Y2hSZWdleC50ZXN0KHVybC5wYXRobmFtZSk7XG4gIH1cbiAgaXNGaWxlTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZpbGU6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzRnRwTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZ0cDovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNVcm5NYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogdXJuOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBjb252ZXJ0UGF0dGVyblRvUmVnZXgocGF0dGVybikge1xuICAgIGNvbnN0IGVzY2FwZWQgPSB0aGlzLmVzY2FwZUZvclJlZ2V4KHBhdHRlcm4pO1xuICAgIGNvbnN0IHN0YXJzUmVwbGFjZWQgPSBlc2NhcGVkLnJlcGxhY2UoL1xcXFxcXCovZywgXCIuKlwiKTtcbiAgICByZXR1cm4gUmVnRXhwKGBeJHtzdGFyc1JlcGxhY2VkfSRgKTtcbiAgfVxuICBlc2NhcGVGb3JSZWdleChzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcbiAgfVxufTtcbnZhciBNYXRjaFBhdHRlcm4gPSBfTWF0Y2hQYXR0ZXJuO1xuTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUyA9IFtcImh0dHBcIiwgXCJodHRwc1wiLCBcImZpbGVcIiwgXCJmdHBcIiwgXCJ1cm5cIl07XG52YXIgSW52YWxpZE1hdGNoUGF0dGVybiA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4sIHJlYXNvbikge1xuICAgIHN1cGVyKGBJbnZhbGlkIG1hdGNoIHBhdHRlcm4gXCIke21hdGNoUGF0dGVybn1cIjogJHtyZWFzb259YCk7XG4gIH1cbn07XG5mdW5jdGlvbiB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpIHtcbiAgaWYgKCFNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmluY2x1ZGVzKHByb3RvY29sKSAmJiBwcm90b2NvbCAhPT0gXCIqXCIpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgJHtwcm90b2NvbH0gbm90IGEgdmFsaWQgcHJvdG9jb2wgKCR7TWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5qb2luKFwiLCBcIil9KWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKSB7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIjpcIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBgSG9zdG5hbWUgY2Fubm90IGluY2x1ZGUgYSBwb3J0YCk7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIipcIikgJiYgaG9zdG5hbWUubGVuZ3RoID4gMSAmJiAhaG9zdG5hbWUuc3RhcnRzV2l0aChcIiouXCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYElmIHVzaW5nIGEgd2lsZGNhcmQgKCopLCBpdCBtdXN0IGdvIGF0IHRoZSBzdGFydCBvZiB0aGUgaG9zdG5hbWVgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSkge1xuICByZXR1cm47XG59XG5leHBvcnQge1xuICBJbnZhbGlkTWF0Y2hQYXR0ZXJuLFxuICBNYXRjaFBhdHRlcm5cbn07XG4iXSwibmFtZXMiOlsiYnJvd3NlciIsIl9icm93c2VyIiwicmVzdWx0Il0sIm1hcHBpbmdzIjoiOztBQUFPLFdBQVMsaUJBQWlCLEtBQUs7QUFDcEMsUUFBSSxPQUFPLFFBQVEsT0FBTyxRQUFRLFdBQVksUUFBTyxFQUFFLE1BQU0sSUFBRztBQUNoRSxXQUFPO0FBQUEsRUFDVDtBQ0ZPLFFBQU1BLFlBQVUsV0FBVyxTQUFTLFNBQVMsS0FDaEQsV0FBVyxVQUNYLFdBQVc7QUNGUixRQUFNLFVBQVVDO0FDcUJ2QixpQkFBOEIsaUJBQWlCLFNBQWM7QUFDM0QsUUFBSTtBQUVG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
