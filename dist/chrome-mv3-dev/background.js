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
  const definition = defineBackground(() => {
    console.log("🎯 Background script initialized");
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case "JOB_SCRAPED_DATA":
          const scrapedData = message.data;
          if (scrapedData?.jobData.description && scrapedData.jobData.description.length > 100) {
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
                type: "RELAYED_JOB_SCRAPED_DATA",
                data: latestScraped
              }).catch(() => {
              });
            }).catch((err) => {
              latestScraped = scrapedData;
              browser.runtime.sendMessage({
                type: "RELAYED_JOB_SCRAPED_DATA",
                data: latestScraped
              }).catch(() => {
              });
            });
          } else {
            latestScraped = scrapedData;
            browser.runtime.sendMessage({
              type: "RELAYED_JOB_SCRAPED_DATA",
              data: latestScraped
            }).catch(() => {
            });
          }
          break;
        case "SCRAPING_STARTED":
          browser.runtime.sendMessage({
            type: "SCRAPING_STARTED"
          }).catch(() => {
          });
          break;
        case "PROFILE_SCRAPED_DATA":
          console.log("Background receiving content script call");
          break;
        case "GET_LATEST_JOB_SCRAPED":
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zcmMvbGliL2JhY2tncm91bmQtaGVscC9qb2Itc3VtbWFyaXplci50cyIsIi4uLy4uL3NyYy9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG4gIGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuICByZXR1cm4gYXJnO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiaW50ZXJmYWNlIFNraWxsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBtYXRjaDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSm9iRGF0YSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGNvbXBhbnk6IHN0cmluZztcbiAgbG9jYXRpb246IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzYWxhcnk6IHN0cmluZztcbiAgcG9zdGVkOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTY3JhcGVkRGF0YSB7XG4gIGpvYkRhdGE6IEpvYkRhdGE7XG4gIHJlcXVpcmVtZW50czogc3RyaW5nW107XG4gIHNraWxsczogU2tpbGxbXTtcbn1cblxuXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBhbmFseXplSm9iV2l0aEFJKGpvYkRhdGE6IGFueSkge1xuICB0cnkge1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBhdmFpbGFiaWxpdHkgPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmF2YWlsYWJpbGl0eSgpO1xuICAgIGNvbnNvbGUubG9nKCfinKggQUkgQXZhaWxhYmlsaXR5OicsIGF2YWlsYWJpbGl0eSk7XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnbm8nKSB7XG4gICAgICBjb25zb2xlLndhcm4oXCLinYwgR2VtaW5pIE5hbm8gbm90IGF2YWlsYWJsZVwiKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdhZnRlci1kb3dubG9hZCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwi4o+zIFRyaWdnZXJpbmcgR2VtaW5pIE5hbm8gZG93bmxvYWQuLi5cIik7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuXG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSBqb2JEYXRhLmRlc2NyaXB0aW9uIFxuICAgICAgPyBqb2JEYXRhLmRlc2NyaXB0aW9uLnN1YnN0cmluZygwLCAxNTAwKVxuICAgICAgOiAnTm8gZGVzY3JpcHRpb24gYXZhaWxhYmxlJztcblxuICAgIGNvbnN0IHNjaGVtYSA9IHtcbiAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICByZXF1aXJlZDogW1wiY2xlYW5TdW1tYXJ5XCIsIFwic2FsYXJ5XCIsIFwic2tpbGxzXCIsIFwicmVxdWlyZW1lbnRzXCJdLFxuICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBjbGVhblN1bW1hcnk6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICBzYWxhcnk6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICBza2lsbHM6IHtcbiAgICAgICAgICB0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICAgICAgICByZXF1aXJlZDogW1wibmFtZVwiLCBcIm1hdGNoXCJdLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICBuYW1lOiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgICAgICAgbWF0Y2g6IHsgdHlwZTogXCJudW1iZXJcIiB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlbWVudHM6IHt0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH07XG5cbiAgICBjb25zdCBwcm9tcHQgPSBgQW5hbHl6ZSB0aGlzIGpvYiBwb3N0aW5nIGFuZCBleHRyYWN0IGtleSBpbmZvcm1hdGlvbi5cblxuSm9iIERldGFpbHM6XG4tIFRpdGxlOiAke2pvYkRhdGEudGl0bGUgfHwgJ1Vua25vd24nfVxuLSBDb21wYW55OiAke2pvYkRhdGEuY29tcGFueSB8fCAnVW5rbm93bid9XG4tIExvY2F0aW9uOiAke2pvYkRhdGEubG9jYXRpb24gfHwgJ05vdCBzcGVjaWZpZWQnfVxuLSBUeXBlOiAke2pvYkRhdGEudHlwZSB8fCAnTm90IHNwZWNpZmllZCd9XG4tIEN1cnJlbnQgU2FsYXJ5OiAke2pvYkRhdGEuc2FsYXJ5IHx8IFwiTm90IHNwZWNpZmllZFwifVxuXG5GdWxsIERlc2NyaXB0aW9uOlxuJHtkZXNjcmlwdGlvbn1cblxuSU1QT1JUQU5UOiBPbmx5IGV4dHJhY3QgaW5mb3JtYXRpb24gdGhhdCBpcyBleHBsaWNpdGx5IHN0YXRlZCBpbiB0aGUgZGVzY3JpcHRpb24uIERvIG5vdCBtYWtlIHVwIG9yIGluZmVyIGluZm9ybWF0aW9uLlxuXG5Qcm92aWRlIGEgSlNPTiByZXNwb25zZSB3aXRoOlxuMS4gY2xlYW5TdW1tYXJ5OiBBIDItMyBzZW50ZW5jZSBjb25jaXNlIHN1bW1hcnkgb2YgdGhlIHJvbGVcbjIuIHNhbGFyeTogRXh0cmFjdCBzYWxhcnkgYXMgXCIkWFgsWFhYIC0gJFhYLFhYWFwiIG9yIFwiTi9BXCIgaWYgbm90IG1lbnRpb25lZFxuMy4gcmVxdWlyZW1lbnRzOiBFeHRyYWN0IDUtNyBrZXkgcXVhbGlmaWNhdGlvbnMvcmVxdWlyZW1lbnRzIChwcmlvcml0aXplIGJhc2ljIHF1YWxpZmljYXRpb25zKVxuNC4gc2tpbGxzOiBBcnJheSBvZiA1LTcga2V5IHRlY2huaWNhbCBza2lsbHMgd2l0aCBpbXBvcnRhbmNlIHJhdGluZyAoMC0xMDApXG5cbkV4YW1wbGUgZm9ybWF0Olxue1xuICBcImNsZWFuU3VtbWFyeVwiOiBcIlNvZnR3YXJlIGVuZ2luZWVyIHJvbGUgZm9jdXNpbmcgb24uLi5cIixcbiAgXCJzYWxhcnlcIjogXCIkODAsMDAwIC0gJDEyMCwwMDBcIixcbiAgXCJyZXF1aXJlbWVudHNcIjogW1wiQmFjaGVsb3IncyBkZWdyZWUgaW4gQ1NcIiwgXCIzKyB5ZWFycyBleHBlcmllbmNlXCJdLFxuICBcInNraWxsc1wiOiBbe1wibmFtZVwiOiBcIkphdmFTY3JpcHRcIiwgXCJtYXRjaFwiOiA5MH0sIHtcIm5hbWVcIjogXCJSZWFjdFwiLCBcIm1hdGNoXCI6IDg1fV1cbn1cblxuUmV0dXJuIE9OTFkgdmFsaWQgSlNPTiBtYXRjaGluZyB0aGlzIHN0cnVjdHVyZS5gO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc2Vzc2lvbi5wcm9tcHQocHJvbXB0LCB7cmVzcG9uc2VDb25zdHJhaW50OiBzY2hlbWF9KTtcbiAgICBjb25zb2xlLmxvZyhcIvCfpJYgUmF3IEFJIFJlc3BvbnNlOlwiLCByZXN1bHQpO1xuXG4gICAgICBsZXQgY2xlYW5lZFJlc3VsdCA9IHJlc3VsdC50cmltKCk7XG4gICAgXG4gICAgLy8gUmVtb3ZlIGBgYGpzb24gYW5kIGBgYCBpZiBwcmVzZW50XG4gICAgaWYgKGNsZWFuZWRSZXN1bHQuc3RhcnRzV2l0aCgnYGBganNvbicpKSB7XG4gICAgICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBganNvblxccyovLCAnJykucmVwbGFjZSgvXFxzKmBgYCQvLCAnJyk7XG4gICAgfSBlbHNlIGlmIChjbGVhbmVkUmVzdWx0LnN0YXJ0c1dpdGgoJ2BgYCcpKSB7XG4gICAgICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBgXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqYGBgJC8sICcnKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShjbGVhbmVkUmVzdWx0KTtcbiAgICBcbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICByZXR1cm4gcGFyc2VkO1xuXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59IiwiaW1wb3J0IGFuYWx5emVKb2JXaXRoQUkgZnJvbSBcIkAvbGliL2JhY2tncm91bmQtaGVscC9qb2Itc3VtbWFyaXplclwiO1xuXG5pbnRlcmZhY2UgU2tpbGwge1xuICBuYW1lOiBzdHJpbmc7XG4gIG1hdGNoOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBKb2JEYXRhIHtcbiAgdGl0bGU6IHN0cmluZztcbiAgY29tcGFueTogc3RyaW5nO1xuICBsb2NhdGlvbjogc3RyaW5nO1xuICB0eXBlOiBzdHJpbmc7XG4gIHNhbGFyeTogc3RyaW5nO1xuICBwb3N0ZWQ6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFNjcmFwZWREYXRhIHtcbiAgam9iRGF0YTogSm9iRGF0YTtcbiAgcmVxdWlyZW1lbnRzOiBzdHJpbmdbXTtcbiAgc2tpbGxzOiBTa2lsbFtdO1xufVxuXG5sZXQgbGF0ZXN0U2NyYXBlZDogU2NyYXBlZERhdGEgfCBudWxsID0gbnVsbDtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XG4gIGNvbnNvbGUubG9nKCfwn46vIEJhY2tncm91bmQgc2NyaXB0IGluaXRpYWxpemVkJyk7XG5cbiAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICBzd2l0Y2ggKG1lc3NhZ2UudHlwZSkge1xuICAgICAgY2FzZSAnSk9CX1NDUkFQRURfREFUQSc6XG4gICAgICAgIC8vIFN0b3JlIHRoZSBzY3JhcGVkIGRhdGFcbiAgICAgICAgY29uc3Qgc2NyYXBlZERhdGEgPSBtZXNzYWdlLmRhdGEgYXMgU2NyYXBlZERhdGE7XG5cbiAgICAgICAgLy8gQW5hbHl6ZSB3aXRoIEFJIGJlZm9yZSBzdG9yaW5nL3JlbGF5aW5nXG4gICAgICAgIGlmIChzY3JhcGVkRGF0YT8uam9iRGF0YS5kZXNjcmlwdGlvbiAmJiBzY3JhcGVkRGF0YS5qb2JEYXRhLmRlc2NyaXB0aW9uLmxlbmd0aCA+IDEwMCkge1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCfwn5SEIFN0YXJ0aW5nIEFJIGFuYWx5c2lzIGluIGJhY2tncm91bmQuLi4nKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhbmFseXplSm9iV2l0aEFJKHNjcmFwZWREYXRhLmpvYkRhdGEpXG4gICAgICAgICAgICAudGhlbihhaVJlc3VsdCA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdBSSBSZXN1bHQ6JywgYWlSZXN1bHQpO1xuXG4gICAgICAgICAgICAgIGlmIChhaVJlc3VsdCkge1xuICAgICAgICAgICAgICAgIC8vIEVucmljaCB0aGUgZGF0YSB3aXRoIEFJIHJlc3VsdHNcbiAgICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkID0ge1xuICAgICAgICAgICAgICAgICAgam9iRGF0YToge1xuICAgICAgICAgICAgICAgICAgICAuLi5zY3JhcGVkRGF0YS5qb2JEYXRhLFxuICAgICAgICAgICAgICAgICAgICBzYWxhcnk6IGFpUmVzdWx0LnNhbGFyeSB8fCBzY3JhcGVkRGF0YS5qb2JEYXRhLnNhbGFyeSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICByZXF1aXJlbWVudHM6IGFpUmVzdWx0LnJlcXVpcmVtZW50cyB8fCBzY3JhcGVkRGF0YS5yZXF1aXJlbWVudHMgfHwgW10sXG4gICAgICAgICAgICAgICAgICBza2lsbHM6IGFpUmVzdWx0LnNraWxscyB8fCBbXSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEFJIGZhaWxlZCwgdXNlIG9yaWdpbmFsIGRhdGFcbiAgICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkID0gc2NyYXBlZERhdGE7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBSZWxheSBlbnJpY2hlZCBkYXRhIHRvIHBvcHVwXG4gICAgICAgICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ1JFTEFZRURfSk9CX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICAgICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgICAvLyBVc2Ugb3JpZ2luYWwgZGF0YSBvbiBlcnJvclxuICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkID0gc2NyYXBlZERhdGE7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdSRUxBWUVEX0pPQl9TQ1JBUEVEX0RBVEEnLFxuICAgICAgICAgICAgICAgIGRhdGE6IGxhdGVzdFNjcmFwZWQsXG4gICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHt9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE5vIGRlc2NyaXB0aW9uIG9yIHRvbyBzaG9ydCwgc2tpcCBBSVxuICAgICAgICAgIGxhdGVzdFNjcmFwZWQgPSBzY3JhcGVkRGF0YTtcbiAgICAgICAgICBcbiAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgdHlwZTogJ1JFTEFZRURfSk9CX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICBkYXRhOiBsYXRlc3RTY3JhcGVkLFxuICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHtcbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBcbiAgICAgIGNhc2UgJ1NDUkFQSU5HX1NUQVJURUQnOlxuICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgdHlwZTogJ1NDUkFQSU5HX1NUQVJURUQnLFxuICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHtcbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdQUk9GSUxFX1NDUkFQRURfREFUQSc6XG4gICAgICAgIGNvbnNvbGUubG9nKCdCYWNrZ3JvdW5kIHJlY2VpdmluZyBjb250ZW50IHNjcmlwdCBjYWxsJylcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ0dFVF9MQVRFU1RfSk9CX1NDUkFQRUQnOlxuICAgICAgICAvLyBQb3B1cCByZXF1ZXN0aW5nIHN0b3JlZCBkYXRhXG4gICAgICAgIHNlbmRSZXNwb25zZShsYXRlc3RTY3JhcGVkKTtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIEtlZXAgY2hhbm5lbCBvcGVuIGZvciBhc3luY1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH0pO1xufSk7IiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJuYW1lcyI6WyJicm93c2VyIiwiX2Jyb3dzZXIiLCJyZXN1bHQiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxpQkFBaUIsS0FBSztBQUNwQyxRQUFJLE9BQU8sUUFBUSxPQUFPLFFBQVEsV0FBWSxRQUFPLEVBQUUsTUFBTSxJQUFHO0FBQ2hFLFdBQU87QUFBQSxFQUNUO0FDRk8sUUFBTUEsWUFBVSxXQUFXLFNBQVMsU0FBUyxLQUNoRCxXQUFXLFVBQ1gsV0FBVztBQ0ZSLFFBQU0sVUFBVUM7QUNxQnZCLGlCQUE4QixpQkFBaUIsU0FBYztBQUMzRCxRQUFJO0FBRUYsWUFBTSxlQUFlLE1BQU0sY0FBYyxhQUFBO0FBQ3pDLGNB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
