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
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
        case "GET_PROFILE": {
          console.log("📩 GET_PROFILE received in background");
          const respond = sendResponse;
          (async () => {
            try {
              await chrome.storage.local.set({
                profile: {
                  firstName: "John",
                  lastName: "Doe",
                  email: "john.doe@example.com",
                  phone: "555-0123",
                  linkedin: "https://linkedin.com/in/johndoe",
                  portfolio: "https://johndoe.com",
                  address: "123 Main St",
                  city: "San Francisco",
                  state: "CA",
                  zip: "94102",
                  currentCompany: "Tech Corp",
                  currentTitle: "Software Engineer",
                  yearsExperience: 5,
                  needsSponsorship: false,
                  willingToRelocate: true
                }
              });
              console.log("✅ Test profile saved");
              const data = await chrome.storage.local.get("profile");
              console.log("📤 Sending profile to content:", data);
              respond({ ok: true, profile: data.profile });
            } catch (err) {
              console.error("❌ Error in GET_PROFILE:", err);
              respond({ ok: false, error: err.toString() });
            }
          })();
          return true;
        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zcmMvbGliL2JhY2tncm91bmQtaGVscC9qb2Itc3VtbWFyaXplci50cyIsIi4uLy4uL3NyYy9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG4gIGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuICByZXR1cm4gYXJnO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiaW50ZXJmYWNlIFNraWxsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBtYXRjaDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSm9iRGF0YSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGNvbXBhbnk6IHN0cmluZztcbiAgbG9jYXRpb246IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzYWxhcnk6IHN0cmluZztcbiAgcG9zdGVkOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTY3JhcGVkRGF0YSB7XG4gIGpvYkRhdGE6IEpvYkRhdGE7XG4gIHJlcXVpcmVtZW50czogc3RyaW5nW107XG4gIHNraWxsczogU2tpbGxbXTtcbn1cblxuaW50ZXJmYWNlIFVzZXJQcm9maWxlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICBwaG9uZT86IHN0cmluZztcbiAgY3VycmVudFJvbGU/OiBzdHJpbmc7XG4gIHllYXJzRXhwZXJpZW5jZT86IHN0cmluZztcbiAgc2tpbGxzPzogc3RyaW5nW107XG4gIGFjaGlldmVtZW50cz86IHN0cmluZ1tdO1xufVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlQ292ZXJMZXR0ZXIoXG4gIGpvYkRhdGE6IEpvYkRhdGEsIFxuICBhbmFseXplZERhdGE6IFNjcmFwZWREYXRhLFxuICB1c2VyUHJvZmlsZT86IFVzZXJQcm9maWxlXG4pIHtcbiAgdHJ5IHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3QgYXZhaWxhYmlsaXR5ID0gYXdhaXQgTGFuZ3VhZ2VNb2RlbC5hdmFpbGFiaWxpdHkoKTtcblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdubycpIHtcbiAgICAgIGNvbnNvbGUud2FybihcIuKdjCBHZW1pbmkgTmFubyBub3QgYXZhaWxhYmxlXCIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGF2YWlsYWJpbGl0eSA9PT0gJ2FmdGVyLWRvd25sb2FkJykge1xuICAgICAgY29uc29sZS5sb2coXCLij7MgVHJpZ2dlcmluZyBHZW1pbmkgTmFubyBkb3dubG9hZC4uLlwiKTtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG5cbiAgICBjb25zdCBkZXNjcmlwdGlvbiA9IGpvYkRhdGEuZGVzY3JpcHRpb24gXG4gICAgICA/IGpvYkRhdGEuZGVzY3JpcHRpb24uc3Vic3RyaW5nKDAsIDIwMDApXG4gICAgICA6ICdObyBkZXNjcmlwdGlvbiBhdmFpbGFibGUnO1xuXG4gICAgLy8gQnVpbGQgdXNlciBjb250ZXh0IGlmIHByb2ZpbGUgcHJvdmlkZWRcbiAgICBjb25zdCB1c2VyQ29udGV4dCA9IHVzZXJQcm9maWxlID8gYFxuVXNlciBQcm9maWxlOlxuLSBOYW1lOiAke3VzZXJQcm9maWxlLm5hbWUgfHwgJ05vdCBwcm92aWRlZCd9XG4tIEN1cnJlbnQgUm9sZTogJHt1c2VyUHJvZmlsZS5jdXJyZW50Um9sZSB8fCAnTm90IHByb3ZpZGVkJ31cbi0gWWVhcnMgb2YgRXhwZXJpZW5jZTogJHt1c2VyUHJvZmlsZS55ZWFyc0V4cGVyaWVuY2UgfHwgJ05vdCBwcm92aWRlZCd9XG4tIEtleSBTa2lsbHM6ICR7dXNlclByb2ZpbGUuc2tpbGxzPy5qb2luKCcsICcpIHx8ICdOb3QgcHJvdmlkZWQnfVxuLSBOb3RhYmxlIEFjaGlldmVtZW50czogJHt1c2VyUHJvZmlsZS5hY2hpZXZlbWVudHM/LmpvaW4oJzsgJykgfHwgJ05vdCBwcm92aWRlZCd9XG5gIDogJyc7XG5cbiAgICBjb25zdCBrZXlSZXF1aXJlbWVudHMgPSBhbmFseXplZERhdGEucmVxdWlyZW1lbnRzPy5zbGljZSgwLCA1KS5qb2luKCdcXG4tICcpIHx8ICdOb3QgYW5hbHl6ZWQnO1xuICAgIGNvbnN0IGtleVNraWxscyA9IGFuYWx5emVkRGF0YS5za2lsbHM/LnNsaWNlKDAsIDUpLm1hcChzID0+IHMubmFtZSkuam9pbignLCAnKSB8fCAnTm90IGFuYWx5emVkJztcblxuICAgIGNvbnN0IHByb21wdCA9IGBHZW5lcmF0ZSBhIHByb2Zlc3Npb25hbCBjb3ZlciBsZXR0ZXIgZm9yIHRoZSBmb2xsb3dpbmcgam9iIGFwcGxpY2F0aW9uLlxuXG5Kb2IgRGV0YWlsczpcbi0gUG9zaXRpb246ICR7am9iRGF0YS50aXRsZX1cbi0gQ29tcGFueTogJHtqb2JEYXRhLmNvbXBhbnl9XG4tIExvY2F0aW9uOiAke2pvYkRhdGEubG9jYXRpb259XG5cbktleSBSZXF1aXJlbWVudHMgZnJvbSBKb2IgUG9zdGluZzpcbi0gJHtrZXlSZXF1aXJlbWVudHN9XG5cbktleSBTa2lsbHMgTmVlZGVkOlxuJHtrZXlTa2lsbHN9XG5cbiR7dXNlckNvbnRleHR9XG5cbkpvYiBEZXNjcmlwdGlvbiBTdW1tYXJ5OlxuJHtkZXNjcmlwdGlvbn1cblxuSW5zdHJ1Y3Rpb25zOlxuMS4gV3JpdGUgYSBwcm9mZXNzaW9uYWwsIGVuZ2FnaW5nIGNvdmVyIGxldHRlciAoMjUwLTM1MCB3b3JkcylcbjIuIE9wZW4gd2l0aCBhIHN0cm9uZyBob29rIHRoYXQgc2hvd3MgZW50aHVzaWFzbSBmb3IgdGhlIHJvbGVcbjMuIEhpZ2hsaWdodCAyLTMgcmVsZXZhbnQgZXhwZXJpZW5jZXMgb3Igc2tpbGxzIHRoYXQgbWF0Y2ggdGhlIGpvYiByZXF1aXJlbWVudHNcbjQuIFNob3cga25vd2xlZGdlIG9mIHRoZSBjb21wYW55IChrZWVwIGl0IGJyaWVmIGFuZCBwcm9mZXNzaW9uYWwpXG41LiBFeHByZXNzIGdlbnVpbmUgaW50ZXJlc3QgaW4gY29udHJpYnV0aW5nIHRvIHRoZSB0ZWFtXG42LiBDbG9zZSB3aXRoIGEgY2FsbCB0byBhY3Rpb25cbjcuIFVzZSBhIHByb2Zlc3Npb25hbCBidXQgd2FybSB0b25lXG44LiBETyBOT1QgdXNlIG92ZXJseSBnZW5lcmljIHBocmFzZXMgbGlrZSBcIkkgYW0gd3JpdGluZyB0byBleHByZXNzIG15IGludGVyZXN0XCJcbjkuIEJlIHNwZWNpZmljIGFib3V0IHNraWxscyBhbmQgZXhwZXJpZW5jZXMgcmF0aGVyIHRoYW4gdmFndWUgY2xhaW1zXG4xMC4gS2VlcCBwYXJhZ3JhcGhzIGNvbmNpc2UgYW5kIGltcGFjdGZ1bFxuXG5Gb3JtYXQgdGhlIGxldHRlciB3aXRoOlxuW0RhdGVdXG5cbltIaXJpbmcgTWFuYWdlci9IaXJpbmcgVGVhbV1cbiR7am9iRGF0YS5jb21wYW55fVxuXG5bQm9keSBwYXJhZ3JhcGhzXVxuXG5TaW5jZXJlbHksXG4ke3VzZXJQcm9maWxlPy5uYW1lIHx8ICdbWW91ciBOYW1lXSd9XG5cblJldHVybiBPTkxZIHRoZSBjb3ZlciBsZXR0ZXIgdGV4dCwgbm8gYWRkaXRpb25hbCBjb21tZW50YXJ5LmA7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzZXNzaW9uLnByb21wdChwcm9tcHQpO1xuICAgIGNvbnNvbGUubG9nKFwi8J+TnSBHZW5lcmF0ZWQgY292ZXIgbGV0dGVyXCIpO1xuXG4gICAgc2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgcmV0dXJuIHJlc3VsdC50cmltKCk7XG5cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcihcIuKdjCBDb3ZlciBsZXR0ZXIgZ2VuZXJhdGlvbiBlcnJvcjpcIiwgZXJyKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBhbmFseXplSm9iV2l0aEFJKGpvYkRhdGE6IGFueSkge1xuICB0cnkge1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBhdmFpbGFiaWxpdHkgPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmF2YWlsYWJpbGl0eSgpO1xuICAgIGNvbnNvbGUubG9nKCfinKggQUkgQXZhaWxhYmlsaXR5OicsIGF2YWlsYWJpbGl0eSk7XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnbm8nKSB7XG4gICAgICBjb25zb2xlLndhcm4oXCLinYwgR2VtaW5pIE5hbm8gbm90IGF2YWlsYWJsZVwiKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdhZnRlci1kb3dubG9hZCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwi4o+zIFRyaWdnZXJpbmcgR2VtaW5pIE5hbm8gZG93bmxvYWQuLi5cIik7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuXG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSBqb2JEYXRhLmRlc2NyaXB0aW9uIFxuICAgICAgPyBqb2JEYXRhLmRlc2NyaXB0aW9uLnN1YnN0cmluZygwLCAxNTAwKVxuICAgICAgOiAnTm8gZGVzY3JpcHRpb24gYXZhaWxhYmxlJztcblxuICAgIGNvbnN0IHNjaGVtYSA9IHtcbiAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICByZXF1aXJlZDogW1wiY2xlYW5TdW1tYXJ5XCIsIFwic2FsYXJ5XCIsIFwic2tpbGxzXCIsIFwicmVxdWlyZW1lbnRzXCJdLFxuICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBjbGVhblN1bW1hcnk6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICBzYWxhcnk6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICBza2lsbHM6IHtcbiAgICAgICAgICB0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICAgICAgICByZXF1aXJlZDogW1wibmFtZVwiLCBcIm1hdGNoXCJdLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICBuYW1lOiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgICAgICAgbWF0Y2g6IHsgdHlwZTogXCJudW1iZXJcIiB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlbWVudHM6IHt0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH07XG5cbiAgICBjb25zdCBwcm9tcHQgPSBgQW5hbHl6ZSB0aGlzIGpvYiBwb3N0aW5nIGFuZCBleHRyYWN0IGtleSBpbmZvcm1hdGlvbi5cblxuSm9iIERldGFpbHM6XG4tIFRpdGxlOiAke2pvYkRhdGEudGl0bGUgfHwgJ1Vua25vd24nfVxuLSBDb21wYW55OiAke2pvYkRhdGEuY29tcGFueSB8fCAnVW5rbm93bid9XG4tIExvY2F0aW9uOiAke2pvYkRhdGEubG9jYXRpb24gfHwgJ05vdCBzcGVjaWZpZWQnfVxuLSBUeXBlOiAke2pvYkRhdGEudHlwZSB8fCAnTm90IHNwZWNpZmllZCd9XG4tIEN1cnJlbnQgU2FsYXJ5OiAke2pvYkRhdGEuc2FsYXJ5IHx8IFwiTm90IHNwZWNpZmllZFwifVxuXG5GdWxsIERlc2NyaXB0aW9uOlxuJHtkZXNjcmlwdGlvbn1cblxuSU1QT1JUQU5UOiBPbmx5IGV4dHJhY3QgaW5mb3JtYXRpb24gdGhhdCBpcyBleHBsaWNpdGx5IHN0YXRlZCBpbiB0aGUgZGVzY3JpcHRpb24uIERvIG5vdCBtYWtlIHVwIG9yIGluZmVyIGluZm9ybWF0aW9uLlxuXG5Qcm92aWRlIGEgSlNPTiByZXNwb25zZSB3aXRoOlxuMS4gY2xlYW5TdW1tYXJ5OiBBIDItMyBzZW50ZW5jZSBjb25jaXNlIHN1bW1hcnkgb2YgdGhlIHJvbGVcbjIuIHNhbGFyeTogRXh0cmFjdCBzYWxhcnkgYXMgXCIkWFgsWFhYIC0gJFhYLFhYWFwiIG9yIFwiTi9BXCIgaWYgbm90IG1lbnRpb25lZFxuMy4gcmVxdWlyZW1lbnRzOiBFeHRyYWN0IDUtNyBrZXkgcXVhbGlmaWNhdGlvbnMvcmVxdWlyZW1lbnRzIChwcmlvcml0aXplIGJhc2ljIHF1YWxpZmljYXRpb25zKVxuNC4gc2tpbGxzOiBBcnJheSBvZiA1LTcga2V5IHRlY2huaWNhbCBza2lsbHMgd2l0aCBpbXBvcnRhbmNlIHJhdGluZyAoMC0xMDApXG5cbkV4YW1wbGUgZm9ybWF0Olxue1xuICBcImNsZWFuU3VtbWFyeVwiOiBcIlNvZnR3YXJlIGVuZ2luZWVyIHJvbGUgZm9jdXNpbmcgb24uLi5cIixcbiAgXCJzYWxhcnlcIjogXCIkODAsMDAwIC0gJDEyMCwwMDBcIixcbiAgXCJyZXF1aXJlbWVudHNcIjogW1wiQmFjaGVsb3IncyBkZWdyZWUgaW4gQ1NcIiwgXCIzKyB5ZWFycyBleHBlcmllbmNlXCJdLFxuICBcInNraWxsc1wiOiBbe1wibmFtZVwiOiBcIkphdmFTY3JpcHRcIiwgXCJtYXRjaFwiOiA5MH0sIHtcIm5hbWVcIjogXCJSZWFjdFwiLCBcIm1hdGNoXCI6IDg1fV1cbn1cblxuUmV0dXJuIE9OTFkgdmFsaWQgSlNPTiBtYXRjaGluZyB0aGlzIHN0cnVjdHVyZS5gO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc2Vzc2lvbi5wcm9tcHQocHJvbXB0LCB7cmVzcG9uc2VDb25zdHJhaW50OiBzY2hlbWF9KTtcbiAgICBjb25zb2xlLmxvZyhcIvCfpJYgUmF3IEFJIFJlc3BvbnNlOlwiLCByZXN1bHQpO1xuXG4gICAgICBsZXQgY2xlYW5lZFJlc3VsdCA9IHJlc3VsdC50cmltKCk7XG4gICAgXG4gICAgLy8gUmVtb3ZlIGBgYGpzb24gYW5kIGBgYCBpZiBwcmVzZW50XG4gICAgaWYgKGNsZWFuZWRSZXN1bHQuc3RhcnRzV2l0aCgnYGBganNvbicpKSB7XG4gICAgICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBganNvblxccyovLCAnJykucmVwbGFjZSgvXFxzKmBgYCQvLCAnJyk7XG4gICAgfSBlbHNlIGlmIChjbGVhbmVkUmVzdWx0LnN0YXJ0c1dpdGgoJ2BgYCcpKSB7XG4gICAgICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBgXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqYGBgJC8sICcnKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShjbGVhbmVkUmVzdWx0KTtcbiAgICBcbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICByZXR1cm4gcGFyc2VkO1xuXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCB7IGFuYWx5emVKb2JXaXRoQUksIGdlbmVyYXRlQ292ZXJMZXR0ZXIgfTtcbiIsImltcG9ydCB7IGFuYWx5emVKb2JXaXRoQUkgfSBmcm9tICcuLi9saWIvYmFja2dyb3VuZC1oZWxwL2pvYi1zdW1tYXJpemVyJ1xuXG5pbnRlcmZhY2UgU2tpbGwge1xuICBuYW1lOiBzdHJpbmc7XG4gIG1hdGNoOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBKb2JEYXRhIHtcbiAgdGl0bGU6IHN0cmluZztcbiAgY29tcGFueTogc3RyaW5nO1xuICBsb2NhdGlvbjogc3RyaW5nO1xuICB0eXBlOiBzdHJpbmc7XG4gIHNhbGFyeTogc3RyaW5nO1xuICBwb3N0ZWQ6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFNjcmFwZWREYXRhIHtcbiAgam9iRGF0YTogSm9iRGF0YTtcbiAgcmVxdWlyZW1lbnRzOiBzdHJpbmdbXTtcbiAgc2tpbGxzOiBTa2lsbFtdO1xufVxuXG5sZXQgbGF0ZXN0U2NyYXBlZDogU2NyYXBlZERhdGEgfCBudWxsID0gbnVsbDtcbmxldCBpc1Byb2Nlc3NpbmcgPSBmYWxzZTsgLy8gVHJhY2sgaWYgQUkgYW5hbHlzaXMgaXMgaW4gcHJvZ3Jlc3NcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XG4gIGNvbnNvbGUubG9nKCfwn46vIEJhY2tncm91bmQgc2NyaXB0IGluaXRpYWxpemVkJyk7XG5cbiAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIHN3aXRjaCAobWVzc2FnZS50eXBlKSB7XG4gICAgICBjYXNlICdTQ1JBUElOR19TVEFSVEVEJzpcbiAgICAgICAgLy8gTWFyayBhcyBwcm9jZXNzaW5nXG4gICAgICAgIGNvbnNvbGUubG9nKCfwn5SEIFNDUkFQSU5HX1NUQVJURUQgLSBzZXR0aW5nIGlzUHJvY2Vzc2luZyA9IHRydWUnKTtcbiAgICAgICAgaXNQcm9jZXNzaW5nID0gdHJ1ZTtcbiAgICAgICAgXG4gICAgICAgIC8vIFRyeSB0byBub3RpZnkgcG9wdXAgaWYgaXQncyBvcGVuXG4gICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgdHlwZTogJ1NDUkFQSU5HX1NUQVJURUQnLFxuICAgICAgICB9KS5jYXRjaCgoKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1BvcHVwIG5vdCBvcGVuLCBzdGF0ZSBzdG9yZWQgaW4gYmFja2dyb3VuZCcpO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgY2FzZSAnR0VUX1BST0ZJTEUnOiB7XG4gIGNvbnNvbGUubG9nKFwi8J+TqSBHRVRfUFJPRklMRSByZWNlaXZlZCBpbiBiYWNrZ3JvdW5kXCIpO1xuXG4gIC8vIFdlIE1VU1QgcmV0dXJuIHRydWUgbm93LCBzbyB0aGUgcG9ydCBzdGF5cyBvcGVuXG4gIGNvbnN0IHJlc3BvbmQgPSBzZW5kUmVzcG9uc2U7XG4gIChhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIDEpIFNhdmUgdGVzdCBwcm9maWxlXG4gICAgICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoe1xuICAgICAgICBwcm9maWxlOiB7XG4gICAgICAgICAgZmlyc3ROYW1lOiAnSm9obicsXG4gICAgICAgICAgbGFzdE5hbWU6ICdEb2UnLFxuICAgICAgICAgIGVtYWlsOiAnam9obi5kb2VAZXhhbXBsZS5jb20nLFxuICAgICAgICAgIHBob25lOiAnNTU1LTAxMjMnLFxuICAgICAgICAgIGxpbmtlZGluOiAnaHR0cHM6Ly9saW5rZWRpbi5jb20vaW4vam9obmRvZScsXG4gICAgICAgICAgcG9ydGZvbGlvOiAnaHR0cHM6Ly9qb2huZG9lLmNvbScsXG4gICAgICAgICAgYWRkcmVzczogJzEyMyBNYWluIFN0JyxcbiAgICAgICAgICBjaXR5OiAnU2FuIEZyYW5jaXNjbycsXG4gICAgICAgICAgc3RhdGU6ICdDQScsXG4gICAgICAgICAgemlwOiAnOTQxMDInLFxuICAgICAgICAgIGN1cnJlbnRDb21wYW55OiAnVGVjaCBDb3JwJyxcbiAgICAgICAgICBjdXJyZW50VGl0bGU6ICdTb2Z0d2FyZSBFbmdpbmVlcicsXG4gICAgICAgICAgeWVhcnNFeHBlcmllbmNlOiA1LFxuICAgICAgICAgIG5lZWRzU3BvbnNvcnNoaXA6IGZhbHNlLFxuICAgICAgICAgIHdpbGxpbmdUb1JlbG9jYXRlOiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBjb25zb2xlLmxvZygn4pyFIFRlc3QgcHJvZmlsZSBzYXZlZCcpO1xuXG4gICAgICAvLyAyKSBSZXRyaWV2ZSAmIHNlbmQgYmFja1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldCgncHJvZmlsZScpO1xuICAgICAgY29uc29sZS5sb2coJ/Cfk6QgU2VuZGluZyBwcm9maWxlIHRvIGNvbnRlbnQ6JywgZGF0YSk7XG4gICAgICByZXNwb25kKHsgb2s6IHRydWUsIHByb2ZpbGU6IGRhdGEucHJvZmlsZSB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCLinYwgRXJyb3IgaW4gR0VUX1BST0ZJTEU6XCIsIGVycik7XG4gICAgICByZXNwb25kKHsgb2s6IGZhbHNlLCBlcnJvcjogZXJyLnRvU3RyaW5nKCkgfSk7XG4gICAgfVxuICB9KSgpO1xuXG4gIHJldHVybiB0cnVlO1xufVxuXG5cbiAgICAgIGNhc2UgJ0pPQl9TQ1JBUEVEX0RBVEEnOlxuICAgICAgICAvLyBTdG9yZSB0aGUgc2NyYXBlZCBkYXRhXG4gICAgICAgIGNvbnN0IHNjcmFwZWREYXRhID0gbWVzc2FnZS5kYXRhIGFzIFNjcmFwZWREYXRhO1xuICAgICAgICBjb25zb2xlLmxvZygn8J+TpiBKT0JfU0NSQVBFRF9EQVRBIHJlY2VpdmVkJyk7XG5cbiAgICAgICAgaWYgKHNjcmFwZWREYXRhPy5qb2JEYXRhLmRlc2NyaXB0aW9uICYmIHNjcmFwZWREYXRhLmpvYkRhdGEuZGVzY3JpcHRpb24ubGVuZ3RoID4gMTAwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ/CflIQgU3RhcnRpbmcgQUkgYW5hbHlzaXMgaW4gYmFja2dyb3VuZC4uLicpO1xuICAgICAgICAgIFxuICAgICAgICAgIGFuYWx5emVKb2JXaXRoQUkoc2NyYXBlZERhdGEuam9iRGF0YSlcbiAgICAgICAgICAgIC50aGVuKGFpUmVzdWx0ID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+KchSBBSSBSZXN1bHQ6JywgYWlSZXN1bHQpO1xuXG4gICAgICAgICAgICAgIGlmIChhaVJlc3VsdCkge1xuICAgICAgICAgICAgICAgIC8vIEVucmljaCB0aGUgZGF0YSB3aXRoIEFJIHJlc3VsdHNcbiAgICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkID0ge1xuICAgICAgICAgICAgICAgICAgam9iRGF0YToge1xuICAgICAgICAgICAgICAgICAgICAuLi5zY3JhcGVkRGF0YS5qb2JEYXRhLFxuICAgICAgICAgICAgICAgICAgICBzYWxhcnk6IGFpUmVzdWx0LnNhbGFyeSB8fCBzY3JhcGVkRGF0YS5qb2JEYXRhLnNhbGFyeSxcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGFpUmVzdWx0LmNsZWFuU3VtbWFyeSB8fCBzY3JhcGVkRGF0YS5qb2JEYXRhLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHJlcXVpcmVtZW50czogYWlSZXN1bHQucmVxdWlyZW1lbnRzIHx8IHNjcmFwZWREYXRhLnJlcXVpcmVtZW50cyB8fCBbXSxcbiAgICAgICAgICAgICAgICAgIHNraWxsczogYWlSZXN1bHQuc2tpbGxzIHx8IFtdLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQUkgZmFpbGVkLCB1c2Ugb3JpZ2luYWwgZGF0YVxuICAgICAgICAgICAgICAgIGxhdGVzdFNjcmFwZWQgPSBzY3JhcGVkRGF0YTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIE1hcmsgYXMgZG9uZSBwcm9jZXNzaW5nXG4gICAgICAgICAgICAgIGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgIC8vIFJlbGF5IGVucmljaGVkIGRhdGEgdG8gcG9wdXBcbiAgICAgICAgICAgICAgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnUkVMQVlFRF9KT0JfU0NSQVBFRF9EQVRBJyxcbiAgICAgICAgICAgICAgICBkYXRhOiBsYXRlc3RTY3JhcGVkLFxuICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1BvcHVwIG5vdCBvcGVuLCBkYXRhIHN0b3JlZCBpbiBiYWNrZ3JvdW5kJyk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfinYwgQUkgYW5hbHlzaXMgZXJyb3I6JywgZXJyKTtcbiAgICAgICAgICAgICAgLy8gVXNlIG9yaWdpbmFsIGRhdGEgb24gZXJyb3JcbiAgICAgICAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IHNjcmFwZWREYXRhO1xuICAgICAgICAgICAgICBpc1Byb2Nlc3NpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ1JFTEFZRURfSk9CX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICAgICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdQb3B1cCBub3Qgb3BlbiwgZGF0YSBzdG9yZWQgaW4gYmFja2dyb3VuZCcpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE5vIGRlc2NyaXB0aW9uIG9yIHRvbyBzaG9ydCwgc2tpcCBBSVxuICAgICAgICAgIGNvbnNvbGUubG9nKCfij63vuI8gU2tpcHBpbmcgQUkgYW5hbHlzaXMgKG5vIGRlc2NyaXB0aW9uKScpO1xuICAgICAgICAgIGxhdGVzdFNjcmFwZWQgPSBzY3JhcGVkRGF0YTtcbiAgICAgICAgICBpc1Byb2Nlc3NpbmcgPSBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgdHlwZTogJ1JFTEFZRURfSk9CX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICBkYXRhOiBsYXRlc3RTY3JhcGVkLFxuICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdQb3B1cCBub3Qgb3BlbiwgZGF0YSBzdG9yZWQgaW4gYmFja2dyb3VuZCcpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdQUk9GSUxFX1NDUkFQRURfREFUQSc6XG4gICAgICAgIGNvbnNvbGUubG9nKCdCYWNrZ3JvdW5kIHJlY2VpdmluZyBjb250ZW50IHNjcmlwdCBjYWxsJyk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdHRVRfTEFURVNUX0pPQl9TQ1JBUEVEJzpcbiAgICAgICAgLy8gUG9wdXAgcmVxdWVzdGluZyBzdG9yZWQgZGF0YSBhbmQgcHJvY2Vzc2luZyBzdGF0ZVxuICAgICAgICBjb25zb2xlLmxvZygn8J+TpCBTZW5kaW5nIGRhdGEgdG8gcG9wdXA6JywgeyBoYXNEYXRhOiAhIWxhdGVzdFNjcmFwZWQsIGlzUHJvY2Vzc2luZyB9KTtcbiAgICAgICAgc2VuZFJlc3BvbnNlKHsgZGF0YTogbGF0ZXN0U2NyYXBlZCwgaXNQcm9jZXNzaW5nIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gS2VlcCBjaGFubmVsIG9wZW4gZm9yIGFzeW5jXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfSk7XG59KTsiLCIvLyBzcmMvaW5kZXgudHNcbnZhciBfTWF0Y2hQYXR0ZXJuID0gY2xhc3Mge1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4pIHtcbiAgICBpZiAobWF0Y2hQYXR0ZXJuID09PSBcIjxhbGxfdXJscz5cIikge1xuICAgICAgdGhpcy5pc0FsbFVybHMgPSB0cnVlO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBbLi4uX01hdGNoUGF0dGVybi5QUk9UT0NPTFNdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gXCIqXCI7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZ3JvdXBzID0gLyguKik6XFwvXFwvKC4qPykoXFwvLiopLy5leGVjKG1hdGNoUGF0dGVybik7XG4gICAgICBpZiAoZ3JvdXBzID09IG51bGwpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgXCJJbmNvcnJlY3QgZm9ybWF0XCIpO1xuICAgICAgY29uc3QgW18sIHByb3RvY29sLCBob3N0bmFtZSwgcGF0aG5hbWVdID0gZ3JvdXBzO1xuICAgICAgdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKTtcbiAgICAgIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSk7XG4gICAgICB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBwcm90b2NvbCA9PT0gXCIqXCIgPyBbXCJodHRwXCIsIFwiaHR0cHNcIl0gOiBbcHJvdG9jb2xdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gaG9zdG5hbWU7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBwYXRobmFtZTtcbiAgICB9XG4gIH1cbiAgaW5jbHVkZXModXJsKSB7XG4gICAgaWYgKHRoaXMuaXNBbGxVcmxzKVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgdSA9IHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIgPyBuZXcgVVJMKHVybCkgOiB1cmwgaW5zdGFuY2VvZiBMb2NhdGlvbiA/IG5ldyBVUkwodXJsLmhyZWYpIDogdXJsO1xuICAgIHJldHVybiAhIXRoaXMucHJvdG9jb2xNYXRjaGVzLmZpbmQoKHByb3RvY29sKSA9PiB7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwc1wiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBzTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZmlsZVwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0ZpbGVNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmdHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGdHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJ1cm5cIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNVcm5NYXRjaCh1KTtcbiAgICB9KTtcbiAgfVxuICBpc0h0dHBNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHA6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0h0dHBzTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwczpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSG9zdFBhdGhNYXRjaCh1cmwpIHtcbiAgICBpZiAoIXRoaXMuaG9zdG5hbWVNYXRjaCB8fCAhdGhpcy5wYXRobmFtZU1hdGNoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGhvc3RuYW1lTWF0Y2hSZWdleHMgPSBbXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gpLFxuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoLnJlcGxhY2UoL15cXCpcXC4vLCBcIlwiKSlcbiAgICBdO1xuICAgIGNvbnN0IHBhdGhuYW1lTWF0Y2hSZWdleCA9IHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMucGF0aG5hbWVNYXRjaCk7XG4gICAgcmV0dXJuICEhaG9zdG5hbWVNYXRjaFJlZ2V4cy5maW5kKChyZWdleCkgPT4gcmVnZXgudGVzdCh1cmwuaG9zdG5hbWUpKSAmJiBwYXRobmFtZU1hdGNoUmVnZXgudGVzdCh1cmwucGF0aG5hbWUpO1xuICB9XG4gIGlzRmlsZU1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmaWxlOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc0Z0cE1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmdHA6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzVXJuTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IHVybjovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgY29udmVydFBhdHRlcm5Ub1JlZ2V4KHBhdHRlcm4pIHtcbiAgICBjb25zdCBlc2NhcGVkID0gdGhpcy5lc2NhcGVGb3JSZWdleChwYXR0ZXJuKTtcbiAgICBjb25zdCBzdGFyc1JlcGxhY2VkID0gZXNjYXBlZC5yZXBsYWNlKC9cXFxcXFwqL2csIFwiLipcIik7XG4gICAgcmV0dXJuIFJlZ0V4cChgXiR7c3RhcnNSZXBsYWNlZH0kYCk7XG4gIH1cbiAgZXNjYXBlRm9yUmVnZXgoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG4gIH1cbn07XG52YXIgTWF0Y2hQYXR0ZXJuID0gX01hdGNoUGF0dGVybjtcbk1hdGNoUGF0dGVybi5QUk9UT0NPTFMgPSBbXCJodHRwXCIsIFwiaHR0cHNcIiwgXCJmaWxlXCIsIFwiZnRwXCIsIFwidXJuXCJdO1xudmFyIEludmFsaWRNYXRjaFBhdHRlcm4gPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuLCByZWFzb24pIHtcbiAgICBzdXBlcihgSW52YWxpZCBtYXRjaCBwYXR0ZXJuIFwiJHttYXRjaFBhdHRlcm59XCI6ICR7cmVhc29ufWApO1xuICB9XG59O1xuZnVuY3Rpb24gdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKSB7XG4gIGlmICghTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5pbmNsdWRlcyhwcm90b2NvbCkgJiYgcHJvdG9jb2wgIT09IFwiKlwiKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYCR7cHJvdG9jb2x9IG5vdCBhIHZhbGlkIHByb3RvY29sICgke01hdGNoUGF0dGVybi5QUk9UT0NPTFMuam9pbihcIiwgXCIpfSlgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSkge1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCI6XCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYEhvc3RuYW1lIGNhbm5vdCBpbmNsdWRlIGEgcG9ydGApO1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCIqXCIpICYmIGhvc3RuYW1lLmxlbmd0aCA+IDEgJiYgIWhvc3RuYW1lLnN0YXJ0c1dpdGgoXCIqLlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGBJZiB1c2luZyBhIHdpbGRjYXJkICgqKSwgaXQgbXVzdCBnbyBhdCB0aGUgc3RhcnQgb2YgdGhlIGhvc3RuYW1lYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpIHtcbiAgcmV0dXJuO1xufVxuZXhwb3J0IHtcbiAgSW52YWxpZE1hdGNoUGF0dGVybixcbiAgTWF0Y2hQYXR0ZXJuXG59O1xuIl0sIm5hbWVzIjpbImJyb3dzZXIiLCJfYnJvd3NlciIsInJlc3VsdCJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLGlCQUFpQixLQUFLO0FBQ3BDLFFBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxXQUFZLFFBQU8sRUFBRSxNQUFNLElBQUc7QUFDaEUsV0FBTztBQUFBLEVBQ1Q7QUNGTyxRQUFNQSxZQUFVLFdBQVcsU0FBUyxTQUFTLEtBQ2hELFdBQVcsVUFDWCxXQUFXO0FDRlIsUUFBTSxVQUFVQztBQytIdkIsaUJBQWUsaUJBQWlCLFNBQWM7QUFDNUMsUUFBSTtBQUVGLFlBQU0sZUFBZSxNQUFNLGNBQWMsYUFBQTtBQUN6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
