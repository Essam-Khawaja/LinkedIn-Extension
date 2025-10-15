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
                    salary: aiResult.salary || scrapedData.jobData.salary,
                    description: aiResult.cleanSummary || scrapedData.jobData.description
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zcmMvbGliL2JhY2tncm91bmQtaGVscC9qb2Itc3VtbWFyaXplci50cyIsIi4uLy4uL3NyYy9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG4gIGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuICByZXR1cm4gYXJnO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiaW50ZXJmYWNlIFNraWxsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBtYXRjaDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSm9iRGF0YSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGNvbXBhbnk6IHN0cmluZztcbiAgbG9jYXRpb246IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzYWxhcnk6IHN0cmluZztcbiAgcG9zdGVkOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTY3JhcGVkRGF0YSB7XG4gIGpvYkRhdGE6IEpvYkRhdGE7XG4gIHJlcXVpcmVtZW50czogc3RyaW5nW107XG4gIHNraWxsczogU2tpbGxbXTtcbn1cblxuaW50ZXJmYWNlIFVzZXJQcm9maWxlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICBwaG9uZT86IHN0cmluZztcbiAgY3VycmVudFJvbGU/OiBzdHJpbmc7XG4gIHllYXJzRXhwZXJpZW5jZT86IHN0cmluZztcbiAgc2tpbGxzPzogc3RyaW5nW107XG4gIGFjaGlldmVtZW50cz86IHN0cmluZ1tdO1xufVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlQ292ZXJMZXR0ZXIoXG4gIGpvYkRhdGE6IEpvYkRhdGEsIFxuICBhbmFseXplZERhdGE6IFNjcmFwZWREYXRhLFxuICB1c2VyUHJvZmlsZT86IFVzZXJQcm9maWxlXG4pIHtcbiAgdHJ5IHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3QgYXZhaWxhYmlsaXR5ID0gYXdhaXQgTGFuZ3VhZ2VNb2RlbC5hdmFpbGFiaWxpdHkoKTtcblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdubycpIHtcbiAgICAgIGNvbnNvbGUud2FybihcIuKdjCBHZW1pbmkgTmFubyBub3QgYXZhaWxhYmxlXCIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGF2YWlsYWJpbGl0eSA9PT0gJ2FmdGVyLWRvd25sb2FkJykge1xuICAgICAgY29uc29sZS5sb2coXCLij7MgVHJpZ2dlcmluZyBHZW1pbmkgTmFubyBkb3dubG9hZC4uLlwiKTtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG5cbiAgICBjb25zdCBkZXNjcmlwdGlvbiA9IGpvYkRhdGEuZGVzY3JpcHRpb24gXG4gICAgICA/IGpvYkRhdGEuZGVzY3JpcHRpb24uc3Vic3RyaW5nKDAsIDIwMDApXG4gICAgICA6ICdObyBkZXNjcmlwdGlvbiBhdmFpbGFibGUnO1xuXG4gICAgLy8gQnVpbGQgdXNlciBjb250ZXh0IGlmIHByb2ZpbGUgcHJvdmlkZWRcbiAgICBjb25zdCB1c2VyQ29udGV4dCA9IHVzZXJQcm9maWxlID8gYFxuVXNlciBQcm9maWxlOlxuLSBOYW1lOiAke3VzZXJQcm9maWxlLm5hbWUgfHwgJ05vdCBwcm92aWRlZCd9XG4tIEN1cnJlbnQgUm9sZTogJHt1c2VyUHJvZmlsZS5jdXJyZW50Um9sZSB8fCAnTm90IHByb3ZpZGVkJ31cbi0gWWVhcnMgb2YgRXhwZXJpZW5jZTogJHt1c2VyUHJvZmlsZS55ZWFyc0V4cGVyaWVuY2UgfHwgJ05vdCBwcm92aWRlZCd9XG4tIEtleSBTa2lsbHM6ICR7dXNlclByb2ZpbGUuc2tpbGxzPy5qb2luKCcsICcpIHx8ICdOb3QgcHJvdmlkZWQnfVxuLSBOb3RhYmxlIEFjaGlldmVtZW50czogJHt1c2VyUHJvZmlsZS5hY2hpZXZlbWVudHM/LmpvaW4oJzsgJykgfHwgJ05vdCBwcm92aWRlZCd9XG5gIDogJyc7XG5cbiAgICBjb25zdCBrZXlSZXF1aXJlbWVudHMgPSBhbmFseXplZERhdGEucmVxdWlyZW1lbnRzPy5zbGljZSgwLCA1KS5qb2luKCdcXG4tICcpIHx8ICdOb3QgYW5hbHl6ZWQnO1xuICAgIGNvbnN0IGtleVNraWxscyA9IGFuYWx5emVkRGF0YS5za2lsbHM/LnNsaWNlKDAsIDUpLm1hcChzID0+IHMubmFtZSkuam9pbignLCAnKSB8fCAnTm90IGFuYWx5emVkJztcblxuICAgIGNvbnN0IHByb21wdCA9IGBHZW5lcmF0ZSBhIHByb2Zlc3Npb25hbCBjb3ZlciBsZXR0ZXIgZm9yIHRoZSBmb2xsb3dpbmcgam9iIGFwcGxpY2F0aW9uLlxuXG5Kb2IgRGV0YWlsczpcbi0gUG9zaXRpb246ICR7am9iRGF0YS50aXRsZX1cbi0gQ29tcGFueTogJHtqb2JEYXRhLmNvbXBhbnl9XG4tIExvY2F0aW9uOiAke2pvYkRhdGEubG9jYXRpb259XG5cbktleSBSZXF1aXJlbWVudHMgZnJvbSBKb2IgUG9zdGluZzpcbi0gJHtrZXlSZXF1aXJlbWVudHN9XG5cbktleSBTa2lsbHMgTmVlZGVkOlxuJHtrZXlTa2lsbHN9XG5cbiR7dXNlckNvbnRleHR9XG5cbkpvYiBEZXNjcmlwdGlvbiBTdW1tYXJ5OlxuJHtkZXNjcmlwdGlvbn1cblxuSW5zdHJ1Y3Rpb25zOlxuMS4gV3JpdGUgYSBwcm9mZXNzaW9uYWwsIGVuZ2FnaW5nIGNvdmVyIGxldHRlciAoMjUwLTM1MCB3b3JkcylcbjIuIE9wZW4gd2l0aCBhIHN0cm9uZyBob29rIHRoYXQgc2hvd3MgZW50aHVzaWFzbSBmb3IgdGhlIHJvbGVcbjMuIEhpZ2hsaWdodCAyLTMgcmVsZXZhbnQgZXhwZXJpZW5jZXMgb3Igc2tpbGxzIHRoYXQgbWF0Y2ggdGhlIGpvYiByZXF1aXJlbWVudHNcbjQuIFNob3cga25vd2xlZGdlIG9mIHRoZSBjb21wYW55IChrZWVwIGl0IGJyaWVmIGFuZCBwcm9mZXNzaW9uYWwpXG41LiBFeHByZXNzIGdlbnVpbmUgaW50ZXJlc3QgaW4gY29udHJpYnV0aW5nIHRvIHRoZSB0ZWFtXG42LiBDbG9zZSB3aXRoIGEgY2FsbCB0byBhY3Rpb25cbjcuIFVzZSBhIHByb2Zlc3Npb25hbCBidXQgd2FybSB0b25lXG44LiBETyBOT1QgdXNlIG92ZXJseSBnZW5lcmljIHBocmFzZXMgbGlrZSBcIkkgYW0gd3JpdGluZyB0byBleHByZXNzIG15IGludGVyZXN0XCJcbjkuIEJlIHNwZWNpZmljIGFib3V0IHNraWxscyBhbmQgZXhwZXJpZW5jZXMgcmF0aGVyIHRoYW4gdmFndWUgY2xhaW1zXG4xMC4gS2VlcCBwYXJhZ3JhcGhzIGNvbmNpc2UgYW5kIGltcGFjdGZ1bFxuXG5Gb3JtYXQgdGhlIGxldHRlciB3aXRoOlxuW0RhdGVdXG5cbltIaXJpbmcgTWFuYWdlci9IaXJpbmcgVGVhbV1cbiR7am9iRGF0YS5jb21wYW55fVxuXG5bQm9keSBwYXJhZ3JhcGhzXVxuXG5TaW5jZXJlbHksXG4ke3VzZXJQcm9maWxlPy5uYW1lIHx8ICdbWW91ciBOYW1lXSd9XG5cblJldHVybiBPTkxZIHRoZSBjb3ZlciBsZXR0ZXIgdGV4dCwgbm8gYWRkaXRpb25hbCBjb21tZW50YXJ5LmA7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzZXNzaW9uLnByb21wdChwcm9tcHQpO1xuICAgIGNvbnNvbGUubG9nKFwi8J+TnSBHZW5lcmF0ZWQgY292ZXIgbGV0dGVyXCIpO1xuXG4gICAgc2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgcmV0dXJuIHJlc3VsdC50cmltKCk7XG5cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcihcIuKdjCBDb3ZlciBsZXR0ZXIgZ2VuZXJhdGlvbiBlcnJvcjpcIiwgZXJyKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBhbmFseXplSm9iV2l0aEFJKGpvYkRhdGE6IGFueSkge1xuICB0cnkge1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBhdmFpbGFiaWxpdHkgPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmF2YWlsYWJpbGl0eSgpO1xuICAgIGNvbnNvbGUubG9nKCfinKggQUkgQXZhaWxhYmlsaXR5OicsIGF2YWlsYWJpbGl0eSk7XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnbm8nKSB7XG4gICAgICBjb25zb2xlLndhcm4oXCLinYwgR2VtaW5pIE5hbm8gbm90IGF2YWlsYWJsZVwiKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdhZnRlci1kb3dubG9hZCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwi4o+zIFRyaWdnZXJpbmcgR2VtaW5pIE5hbm8gZG93bmxvYWQuLi5cIik7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuXG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSBqb2JEYXRhLmRlc2NyaXB0aW9uIFxuICAgICAgPyBqb2JEYXRhLmRlc2NyaXB0aW9uLnN1YnN0cmluZygwLCAxNTAwKVxuICAgICAgOiAnTm8gZGVzY3JpcHRpb24gYXZhaWxhYmxlJztcblxuICAgIGNvbnN0IHNjaGVtYSA9IHtcbiAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICByZXF1aXJlZDogW1wiY2xlYW5TdW1tYXJ5XCIsIFwic2FsYXJ5XCIsIFwic2tpbGxzXCIsIFwicmVxdWlyZW1lbnRzXCJdLFxuICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBjbGVhblN1bW1hcnk6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICBzYWxhcnk6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICBza2lsbHM6IHtcbiAgICAgICAgICB0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICAgICAgICByZXF1aXJlZDogW1wibmFtZVwiLCBcIm1hdGNoXCJdLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICBuYW1lOiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgICAgICAgbWF0Y2g6IHsgdHlwZTogXCJudW1iZXJcIiB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlbWVudHM6IHt0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH07XG5cbiAgICBjb25zdCBwcm9tcHQgPSBgQW5hbHl6ZSB0aGlzIGpvYiBwb3N0aW5nIGFuZCBleHRyYWN0IGtleSBpbmZvcm1hdGlvbi5cblxuSm9iIERldGFpbHM6XG4tIFRpdGxlOiAke2pvYkRhdGEudGl0bGUgfHwgJ1Vua25vd24nfVxuLSBDb21wYW55OiAke2pvYkRhdGEuY29tcGFueSB8fCAnVW5rbm93bid9XG4tIExvY2F0aW9uOiAke2pvYkRhdGEubG9jYXRpb24gfHwgJ05vdCBzcGVjaWZpZWQnfVxuLSBUeXBlOiAke2pvYkRhdGEudHlwZSB8fCAnTm90IHNwZWNpZmllZCd9XG4tIEN1cnJlbnQgU2FsYXJ5OiAke2pvYkRhdGEuc2FsYXJ5IHx8IFwiTm90IHNwZWNpZmllZFwifVxuXG5GdWxsIERlc2NyaXB0aW9uOlxuJHtkZXNjcmlwdGlvbn1cblxuSU1QT1JUQU5UOiBPbmx5IGV4dHJhY3QgaW5mb3JtYXRpb24gdGhhdCBpcyBleHBsaWNpdGx5IHN0YXRlZCBpbiB0aGUgZGVzY3JpcHRpb24uIERvIG5vdCBtYWtlIHVwIG9yIGluZmVyIGluZm9ybWF0aW9uLlxuXG5Qcm92aWRlIGEgSlNPTiByZXNwb25zZSB3aXRoOlxuMS4gY2xlYW5TdW1tYXJ5OiBBIDItMyBzZW50ZW5jZSBjb25jaXNlIHN1bW1hcnkgb2YgdGhlIHJvbGVcbjIuIHNhbGFyeTogRXh0cmFjdCBzYWxhcnkgYXMgXCIkWFgsWFhYIC0gJFhYLFhYWFwiIG9yIFwiTi9BXCIgaWYgbm90IG1lbnRpb25lZFxuMy4gcmVxdWlyZW1lbnRzOiBFeHRyYWN0IDUtNyBrZXkgcXVhbGlmaWNhdGlvbnMvcmVxdWlyZW1lbnRzIChwcmlvcml0aXplIGJhc2ljIHF1YWxpZmljYXRpb25zKVxuNC4gc2tpbGxzOiBBcnJheSBvZiA1LTcga2V5IHRlY2huaWNhbCBza2lsbHMgd2l0aCBpbXBvcnRhbmNlIHJhdGluZyAoMC0xMDApXG5cbkV4YW1wbGUgZm9ybWF0Olxue1xuICBcImNsZWFuU3VtbWFyeVwiOiBcIlNvZnR3YXJlIGVuZ2luZWVyIHJvbGUgZm9jdXNpbmcgb24uLi5cIixcbiAgXCJzYWxhcnlcIjogXCIkODAsMDAwIC0gJDEyMCwwMDBcIixcbiAgXCJyZXF1aXJlbWVudHNcIjogW1wiQmFjaGVsb3IncyBkZWdyZWUgaW4gQ1NcIiwgXCIzKyB5ZWFycyBleHBlcmllbmNlXCJdLFxuICBcInNraWxsc1wiOiBbe1wibmFtZVwiOiBcIkphdmFTY3JpcHRcIiwgXCJtYXRjaFwiOiA5MH0sIHtcIm5hbWVcIjogXCJSZWFjdFwiLCBcIm1hdGNoXCI6IDg1fV1cbn1cblxuUmV0dXJuIE9OTFkgdmFsaWQgSlNPTiBtYXRjaGluZyB0aGlzIHN0cnVjdHVyZS5gO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc2Vzc2lvbi5wcm9tcHQocHJvbXB0LCB7cmVzcG9uc2VDb25zdHJhaW50OiBzY2hlbWF9KTtcbiAgICBjb25zb2xlLmxvZyhcIvCfpJYgUmF3IEFJIFJlc3BvbnNlOlwiLCByZXN1bHQpO1xuXG4gICAgICBsZXQgY2xlYW5lZFJlc3VsdCA9IHJlc3VsdC50cmltKCk7XG4gICAgXG4gICAgLy8gUmVtb3ZlIGBgYGpzb24gYW5kIGBgYCBpZiBwcmVzZW50XG4gICAgaWYgKGNsZWFuZWRSZXN1bHQuc3RhcnRzV2l0aCgnYGBganNvbicpKSB7XG4gICAgICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBganNvblxccyovLCAnJykucmVwbGFjZSgvXFxzKmBgYCQvLCAnJyk7XG4gICAgfSBlbHNlIGlmIChjbGVhbmVkUmVzdWx0LnN0YXJ0c1dpdGgoJ2BgYCcpKSB7XG4gICAgICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBgXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqYGBgJC8sICcnKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShjbGVhbmVkUmVzdWx0KTtcbiAgICBcbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICByZXR1cm4gcGFyc2VkO1xuXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCB7IGFuYWx5emVKb2JXaXRoQUksIGdlbmVyYXRlQ292ZXJMZXR0ZXIgfTtcbiIsImltcG9ydCB7IGFuYWx5emVKb2JXaXRoQUkgfSBmcm9tICcuLi9saWIvYmFja2dyb3VuZC1oZWxwL2pvYi1zdW1tYXJpemVyJ1xuXG5pbnRlcmZhY2UgU2tpbGwge1xuICBuYW1lOiBzdHJpbmc7XG4gIG1hdGNoOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBKb2JEYXRhIHtcbiAgdGl0bGU6IHN0cmluZztcbiAgY29tcGFueTogc3RyaW5nO1xuICBsb2NhdGlvbjogc3RyaW5nO1xuICB0eXBlOiBzdHJpbmc7XG4gIHNhbGFyeTogc3RyaW5nO1xuICBwb3N0ZWQ6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFNjcmFwZWREYXRhIHtcbiAgam9iRGF0YTogSm9iRGF0YTtcbiAgcmVxdWlyZW1lbnRzOiBzdHJpbmdbXTtcbiAgc2tpbGxzOiBTa2lsbFtdO1xufVxuXG5sZXQgbGF0ZXN0U2NyYXBlZDogU2NyYXBlZERhdGEgfCBudWxsID0gbnVsbDtcbmxldCBpc1Byb2Nlc3NpbmcgPSBmYWxzZTsgLy8gVHJhY2sgaWYgQUkgYW5hbHlzaXMgaXMgaW4gcHJvZ3Jlc3NcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XG4gIGNvbnNvbGUubG9nKCfwn46vIEJhY2tncm91bmQgc2NyaXB0IGluaXRpYWxpemVkJyk7XG5cbiAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICBzd2l0Y2ggKG1lc3NhZ2UudHlwZSkge1xuICAgICAgY2FzZSAnU0NSQVBJTkdfU1RBUlRFRCc6XG4gICAgICAgIC8vIE1hcmsgYXMgcHJvY2Vzc2luZ1xuICAgICAgICBjb25zb2xlLmxvZygn8J+UhCBTQ1JBUElOR19TVEFSVEVEIC0gc2V0dGluZyBpc1Byb2Nlc3NpbmcgPSB0cnVlJyk7XG4gICAgICAgIGlzUHJvY2Vzc2luZyA9IHRydWU7XG4gICAgICAgIFxuICAgICAgICAvLyBUcnkgdG8gbm90aWZ5IHBvcHVwIGlmIGl0J3Mgb3BlblxuICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgIHR5cGU6ICdTQ1JBUElOR19TVEFSVEVEJyxcbiAgICAgICAgfSkuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdQb3B1cCBub3Qgb3Blbiwgc3RhdGUgc3RvcmVkIGluIGJhY2tncm91bmQnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdKT0JfU0NSQVBFRF9EQVRBJzpcbiAgICAgICAgLy8gU3RvcmUgdGhlIHNjcmFwZWQgZGF0YVxuICAgICAgICBjb25zdCBzY3JhcGVkRGF0YSA9IG1lc3NhZ2UuZGF0YSBhcyBTY3JhcGVkRGF0YTtcbiAgICAgICAgY29uc29sZS5sb2coJ/Cfk6YgSk9CX1NDUkFQRURfREFUQSByZWNlaXZlZCcpO1xuXG4gICAgICAgIGlmIChzY3JhcGVkRGF0YT8uam9iRGF0YS5kZXNjcmlwdGlvbiAmJiBzY3JhcGVkRGF0YS5qb2JEYXRhLmRlc2NyaXB0aW9uLmxlbmd0aCA+IDEwMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCfwn5SEIFN0YXJ0aW5nIEFJIGFuYWx5c2lzIGluIGJhY2tncm91bmQuLi4nKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhbmFseXplSm9iV2l0aEFJKHNjcmFwZWREYXRhLmpvYkRhdGEpXG4gICAgICAgICAgICAudGhlbihhaVJlc3VsdCA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCfinIUgQUkgUmVzdWx0OicsIGFpUmVzdWx0KTtcblxuICAgICAgICAgICAgICBpZiAoYWlSZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAvLyBFbnJpY2ggdGhlIGRhdGEgd2l0aCBBSSByZXN1bHRzXG4gICAgICAgICAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IHtcbiAgICAgICAgICAgICAgICAgIGpvYkRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uc2NyYXBlZERhdGEuam9iRGF0YSxcbiAgICAgICAgICAgICAgICAgICAgc2FsYXJ5OiBhaVJlc3VsdC5zYWxhcnkgfHwgc2NyYXBlZERhdGEuam9iRGF0YS5zYWxhcnksXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBhaVJlc3VsdC5jbGVhblN1bW1hcnkgfHwgc2NyYXBlZERhdGEuam9iRGF0YS5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICByZXF1aXJlbWVudHM6IGFpUmVzdWx0LnJlcXVpcmVtZW50cyB8fCBzY3JhcGVkRGF0YS5yZXF1aXJlbWVudHMgfHwgW10sXG4gICAgICAgICAgICAgICAgICBza2lsbHM6IGFpUmVzdWx0LnNraWxscyB8fCBbXSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEFJIGZhaWxlZCwgdXNlIG9yaWdpbmFsIGRhdGFcbiAgICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkID0gc2NyYXBlZERhdGE7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBNYXJrIGFzIGRvbmUgcHJvY2Vzc2luZ1xuICAgICAgICAgICAgICBpc1Byb2Nlc3NpbmcgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAvLyBSZWxheSBlbnJpY2hlZCBkYXRhIHRvIHBvcHVwXG4gICAgICAgICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ1JFTEFZRURfSk9CX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICAgICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdQb3B1cCBub3Qgb3BlbiwgZGF0YSBzdG9yZWQgaW4gYmFja2dyb3VuZCcpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcign4p2MIEFJIGFuYWx5c2lzIGVycm9yOicsIGVycik7XG4gICAgICAgICAgICAgIC8vIFVzZSBvcmlnaW5hbCBkYXRhIG9uIGVycm9yXG4gICAgICAgICAgICAgIGxhdGVzdFNjcmFwZWQgPSBzY3JhcGVkRGF0YTtcbiAgICAgICAgICAgICAgaXNQcm9jZXNzaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdSRUxBWUVEX0pPQl9TQ1JBUEVEX0RBVEEnLFxuICAgICAgICAgICAgICAgIGRhdGE6IGxhdGVzdFNjcmFwZWQsXG4gICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnUG9wdXAgbm90IG9wZW4sIGRhdGEgc3RvcmVkIGluIGJhY2tncm91bmQnKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBObyBkZXNjcmlwdGlvbiBvciB0b28gc2hvcnQsIHNraXAgQUlcbiAgICAgICAgICBjb25zb2xlLmxvZygn4o+t77iPIFNraXBwaW5nIEFJIGFuYWx5c2lzIChubyBkZXNjcmlwdGlvbiknKTtcbiAgICAgICAgICBsYXRlc3RTY3JhcGVkID0gc2NyYXBlZERhdGE7XG4gICAgICAgICAgaXNQcm9jZXNzaW5nID0gZmFsc2U7XG4gICAgICAgICAgXG4gICAgICAgICAgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgIHR5cGU6ICdSRUxBWUVEX0pPQl9TQ1JBUEVEX0RBVEEnLFxuICAgICAgICAgICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICB9KS5jYXRjaCgoKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUG9wdXAgbm90IG9wZW4sIGRhdGEgc3RvcmVkIGluIGJhY2tncm91bmQnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnUFJPRklMRV9TQ1JBUEVEX0RBVEEnOlxuICAgICAgICBjb25zb2xlLmxvZygnQmFja2dyb3VuZCByZWNlaXZpbmcgY29udGVudCBzY3JpcHQgY2FsbCcpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnR0VUX0xBVEVTVF9KT0JfU0NSQVBFRCc6XG4gICAgICAgIC8vIFBvcHVwIHJlcXVlc3Rpbmcgc3RvcmVkIGRhdGEgYW5kIHByb2Nlc3Npbmcgc3RhdGVcbiAgICAgICAgY29uc29sZS5sb2coJ/Cfk6QgU2VuZGluZyBkYXRhIHRvIHBvcHVwOicsIHsgaGFzRGF0YTogISFsYXRlc3RTY3JhcGVkLCBpc1Byb2Nlc3NpbmcgfSk7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IGRhdGE6IGxhdGVzdFNjcmFwZWQsIGlzUHJvY2Vzc2luZyB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIEtlZXAgY2hhbm5lbCBvcGVuIGZvciBhc3luY1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH0pO1xufSk7IiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJuYW1lcyI6WyJicm93c2VyIiwiX2Jyb3dzZXIiLCJyZXN1bHQiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxpQkFBaUIsS0FBSztBQUNwQyxRQUFJLE9BQU8sUUFBUSxPQUFPLFFBQVEsV0FBWSxRQUFPLEVBQUUsTUFBTSxJQUFHO0FBQ2hFLFdBQU87QUFBQSxFQUNUO0FDRk8sUUFBTUEsWUFBVSxXQUFXLFNBQVMsU0FBUyxLQUNoRCxXQUFXLFVBQ1gsV0FBVztBQ0ZSLFFBQU0sVUFBVUM7QUMrSHZCLGlCQUFlLGlCQUFpQixTQUFjO0FBQzVDLFFBQUk7QUFFRixZQUFNLGVBQWUsTUFBTSxjQUFjLGFBQUE7QUFDekMsY0FBUSxJQUFJLHNCQUFzQixZQUFZO0FBRTlDLFVBQUksaUJBQWlCLE1BQU07QUFDekIsZ0JBQVEsS0FBSyw2QkFBNkI7QUFDMUMsZUFBTztBQUFBLE1BQ1Q7QUFFQSxVQUFJLGlCQUFpQixrQkFBa0I7QUFDckMsZ0JBQVEsSUFBSSxzQ0FBc0M7QUFFbEQsY0FBTSxjQUFjLE9BQUE7QUFDcEIsZUFBTztBQUFBLE1BQ1Q7QUFHQSxZQUFNLFVBQVUsTUFBTSxjQUFjLE9BQUE7QUFFcEMsWUFBTSxjQUFjLFFBQVEsY0FDeEIsUUFBUSxZQUFZLFVBQVUsR0FBRyxJQUFJLElBQ3JDO0FBRUosWUFBTSxTQUFTO0FBQUEsUUFDYixNQUFNO0FBQUEsUUFDTixVQUFVLENBQUMsZ0JBQWdCLFVBQVUsVUFBVSxjQUFjO0FBQUEsUUFDN0Qsc0JBQXNCO0FBQUEsUUFDdEIsWUFBWTtBQUFBLFVBQ1YsY0FB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QVMsUUFBUSxLQUFLLGFBQWE7QUFDN0QsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0EsR0FBRyxRQUFRLDBCQUEwQixhQUFhLFVBQVUsS0FBSyxJQUFJLENBQUM7QUFBQSxNQUM1RTtBQUFBLEVBQ0E7QUFDQSxXQUFTLGlCQUFpQixjQUFjLFVBQVU7QUFDaEQsUUFBSSxTQUFTLFNBQVMsR0FBRztBQUN2QixZQUFNLElBQUksb0JBQW9CLGNBQWMsZ0NBQWdDO0FBQzlFLFFBQUksU0FBUyxTQUFTLEdBQUcsS0FBSyxTQUFTLFNBQVMsS0FBSyxDQUFDLFNBQVMsV0FBVyxJQUFJO0FBQzVFLFlBQU0sSUFBSTtBQUFBLFFBQ1I7QUFBQSxRQUNBO0FBQUEsTUFDTjtBQUFBLEVBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwxLDIsNV19
