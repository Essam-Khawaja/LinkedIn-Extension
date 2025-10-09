var background = (function() {
  "use strict";
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  let latestScraped = null;
  async function tryAI(jobData) {
    try {
      const availability = await LanguageModel.availability();
      if (availability === "no") {
        console.warn("Gemini Nano not available.");
        return null;
      }
      const session = await LanguageModel.create();
      const schema = {
        type: "object",
        required: ["cleanSummary", "salary", "skills"],
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
      const requirements = Array.isArray(jobData.requirements) ? jobData.requirements.slice(0, 10).join("\n- ") : "Not specified";
      const description = jobData.description ? jobData.description.substring(0, 1500) : "No description available";
      const prompt = `
You are analyzing a job posting. Extract key information and provide a structured response.

Job Details:
- Title: ${jobData.title || "Unknown"}
- Company: ${jobData.company || "Unknown"}
- Location: ${jobData.location || "Not specified"}
- Type: ${jobData.types || "Not specified"}
- Current Salary Info: ${jobData.salary || "Not specified"}
- Experience: ${jobData.experience || "Not specified"}
- Posted: ${jobData.posted || "Recently"}

Requirements:
None right now, use the description text below to figure it out.

Description:
${description}

Please provide:
1. A concise 2-3 sentence summary (cleanSummary)
2. Extracted salary information in format "$XX,XXX - $XX,XXX" or "N/A" if not found (salary)
3. Top 5-7 technical skills required with match percentage 0-100 (skills)
4. Update the requirements to a max of 5-7, and always include the basic qualifications or job requirements as first priority! (requirements)

Always return a valid JSON response according to the schema.
`;
      const testPrompt = "Hey, reply with a 'Yes' in all the fields for now if you can read this";
      const result2 = await session.prompt(prompt, {
        responseConstraint: schema
      });
      const parsed = JSON.parse(result2);
      console.log("AI Analysis Result:", parsed);
      session.destroy();
      return parsed;
    } catch (err) {
      console.error("Error in tryAI:", err);
      return null;
    }
  }
  const definition = defineBackground(() => {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case "SCRAPED_DATA":
          latestScraped = message.data;
          console.log("Description: ", latestScraped?.description);
          tryAI(latestScraped).then((aiResult) => {
            console.log("AI Result:", aiResult);
            if (latestScraped && aiResult) {
              latestScraped = {
                ...latestScraped,
                // aiSummary: aiResult.cleanSummary,
                requirements: aiResult.requirements,
                salary: aiResult.salary || latestScraped.salary,
                skills: aiResult.skills || []
              };
            }
            browser.runtime.sendMessage({
              type: "RELAYED_SCRAPED_DATA",
              data: latestScraped
            }).catch(() => {
            });
          }).catch((err) => {
            console.error("Error in tryAI:", err);
          });
          console.log("Background: Received job data", {
            company: latestScraped?.company,
            title: latestScraped?.title
          });
          browser.runtime.sendMessage({
            type: "RELAYED_SCRAPED_DATA",
            data: latestScraped
          }).catch(() => {
          });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zcmMvZW50cnlwb2ludHMvYmFja2dyb3VuZC50cyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVCYWNrZ3JvdW5kKGFyZykge1xuICBpZiAoYXJnID09IG51bGwgfHwgdHlwZW9mIGFyZyA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyBtYWluOiBhcmcgfTtcbiAgcmV0dXJuIGFyZztcbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImludGVyZmFjZSBTa2lsbCB7XG4gIG5hbWU6IHN0cmluZztcbiAgbWF0Y2g6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIEpvYkRhdGEge1xuICBqb2JJZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBjb21wYW55OiBzdHJpbmc7XG4gIGxvY2F0aW9uOiBzdHJpbmc7XG4gIHBvc3RlZDogc3RyaW5nO1xuICBhcHBsaWNhbnRzOiBzdHJpbmc7XG4gIHR5cGVzOiBzdHJpbmc7XG4gIHNhbGFyeTogc3RyaW5nO1xuICBleHBlcmllbmNlOiBzdHJpbmc7XG4gIHJlcXVpcmVtZW50czogc3RyaW5nW107XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gIHNraWxsczogU2tpbGxbXTtcbn1cblxuaW50ZXJmYWNlIFNjcmFwZWREYXRhIHtcbiAgam9iRGF0YTogSm9iRGF0YTtcbiAgcmVxdWlyZW1lbnRzOiBzdHJpbmdbXTtcbiAgc2tpbGxzOiBTa2lsbFtdO1xufVxuXG5sZXQgbGF0ZXN0U2NyYXBlZDogSm9iRGF0YSB8IG51bGwgPSBudWxsO1xuXG5hc3luYyBmdW5jdGlvbiB0cnlBSShqb2JEYXRhOiBKb2JEYXRhKSB7XG4gIHRyeSB7XG4gICAgLy8gQ2hlY2sgaWYgR2VtaW5pIE5hbm8gaXMgYXZhaWxhYmxlXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IGF2YWlsYWJpbGl0eSA9IGF3YWl0IExhbmd1YWdlTW9kZWwuYXZhaWxhYmlsaXR5KCk7XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnbm8nKSB7XG4gICAgICBjb25zb2xlLndhcm4oXCJHZW1pbmkgTmFubyBub3QgYXZhaWxhYmxlLlwiKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBzZXNzaW9uXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuXG4gICAgLy8gRGVmaW5lIHNjaGVtYSBmb3Igc3RydWN0dXJlZCBvdXRwdXRcbiAgICBjb25zdCBzY2hlbWEgPSB7XG4gICAgICB0eXBlOiBcIm9iamVjdFwiLFxuICAgICAgcmVxdWlyZWQ6IFtcImNsZWFuU3VtbWFyeVwiLCBcInNhbGFyeVwiLCBcInNraWxsc1wiXSxcbiAgICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgY2xlYW5TdW1tYXJ5OiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgc2FsYXJ5OiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgc2tpbGxzOiB7XG4gICAgICAgICAgdHlwZTogXCJhcnJheVwiLFxuICAgICAgICAgIGl0ZW1zOiB7XG4gICAgICAgICAgICB0eXBlOiBcIm9iamVjdFwiLFxuICAgICAgICAgICAgcmVxdWlyZWQ6IFtcIm5hbWVcIiwgXCJtYXRjaFwiXSxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgbmFtZTogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgICAgICAgIG1hdGNoOiB7IHR5cGU6IFwibnVtYmVyXCIgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZW1lbnRzOiB7dHlwZTogXCJhcnJheVwiLFxuICAgICAgICAgIGl0ZW1zOiB7XG4gICAgICAgICAgICB0eXBlOiBcInN0cmluZ1wiLFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgLy8gQ3JlYXRlIHByb21wdFxuICAgICAgICBjb25zdCByZXF1aXJlbWVudHMgPSBBcnJheS5pc0FycmF5KGpvYkRhdGEucmVxdWlyZW1lbnRzKSBcbiAgICAgID8gam9iRGF0YS5yZXF1aXJlbWVudHMuc2xpY2UoMCwgMTApLmpvaW4oJ1xcbi0gJylcbiAgICAgIDogJ05vdCBzcGVjaWZpZWQnO1xuICAgIFxuICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gam9iRGF0YS5kZXNjcmlwdGlvbiBcbiAgICAgID8gam9iRGF0YS5kZXNjcmlwdGlvbi5zdWJzdHJpbmcoMCwgMTUwMClcbiAgICAgIDogJ05vIGRlc2NyaXB0aW9uIGF2YWlsYWJsZSc7XG4gICAgY29uc3QgcHJvbXB0ID0gYFxuWW91IGFyZSBhbmFseXppbmcgYSBqb2IgcG9zdGluZy4gRXh0cmFjdCBrZXkgaW5mb3JtYXRpb24gYW5kIHByb3ZpZGUgYSBzdHJ1Y3R1cmVkIHJlc3BvbnNlLlxuXG5Kb2IgRGV0YWlsczpcbi0gVGl0bGU6ICR7am9iRGF0YS50aXRsZSB8fCAnVW5rbm93bid9XG4tIENvbXBhbnk6ICR7am9iRGF0YS5jb21wYW55IHx8ICdVbmtub3duJ31cbi0gTG9jYXRpb246ICR7am9iRGF0YS5sb2NhdGlvbiB8fCAnTm90IHNwZWNpZmllZCd9XG4tIFR5cGU6ICR7am9iRGF0YS50eXBlcyB8fCAnTm90IHNwZWNpZmllZCd9XG4tIEN1cnJlbnQgU2FsYXJ5IEluZm86ICR7am9iRGF0YS5zYWxhcnkgfHwgXCJOb3Qgc3BlY2lmaWVkXCJ9XG4tIEV4cGVyaWVuY2U6ICR7am9iRGF0YS5leHBlcmllbmNlIHx8IFwiTm90IHNwZWNpZmllZFwifVxuLSBQb3N0ZWQ6ICR7am9iRGF0YS5wb3N0ZWQgfHwgJ1JlY2VudGx5J31cblxuUmVxdWlyZW1lbnRzOlxuTm9uZSByaWdodCBub3csIHVzZSB0aGUgZGVzY3JpcHRpb24gdGV4dCBiZWxvdyB0byBmaWd1cmUgaXQgb3V0LlxuXG5EZXNjcmlwdGlvbjpcbiR7ZGVzY3JpcHRpb259XG5cblBsZWFzZSBwcm92aWRlOlxuMS4gQSBjb25jaXNlIDItMyBzZW50ZW5jZSBzdW1tYXJ5IChjbGVhblN1bW1hcnkpXG4yLiBFeHRyYWN0ZWQgc2FsYXJ5IGluZm9ybWF0aW9uIGluIGZvcm1hdCBcIiRYWCxYWFggLSAkWFgsWFhYXCIgb3IgXCJOL0FcIiBpZiBub3QgZm91bmQgKHNhbGFyeSlcbjMuIFRvcCA1LTcgdGVjaG5pY2FsIHNraWxscyByZXF1aXJlZCB3aXRoIG1hdGNoIHBlcmNlbnRhZ2UgMC0xMDAgKHNraWxscylcbjQuIFVwZGF0ZSB0aGUgcmVxdWlyZW1lbnRzIHRvIGEgbWF4IG9mIDUtNywgYW5kIGFsd2F5cyBpbmNsdWRlIHRoZSBiYXNpYyBxdWFsaWZpY2F0aW9ucyBvciBqb2IgcmVxdWlyZW1lbnRzIGFzIGZpcnN0IHByaW9yaXR5ISAocmVxdWlyZW1lbnRzKVxuXG5BbHdheXMgcmV0dXJuIGEgdmFsaWQgSlNPTiByZXNwb25zZSBhY2NvcmRpbmcgdG8gdGhlIHNjaGVtYS5cbmA7XG5cbmNvbnN0IHRlc3RQcm9tcHQgPSBcIkhleSwgcmVwbHkgd2l0aCBhICdZZXMnIGluIGFsbCB0aGUgZmllbGRzIGZvciBub3cgaWYgeW91IGNhbiByZWFkIHRoaXNcIlxuXG4gICAgLy8gR2V0IEFJIHJlc3BvbnNlXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc2Vzc2lvbi5wcm9tcHQocHJvbXB0LCB7IFxuICAgICAgcmVzcG9uc2VDb25zdHJhaW50OiBzY2hlbWEgXG4gICAgfSk7XG5cbiAgICAvLyBQYXJzZSBhbmQgcmV0dXJuXG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShyZXN1bHQpO1xuICAgIGNvbnNvbGUubG9nKFwiQUkgQW5hbHlzaXMgUmVzdWx0OlwiLCBwYXJzZWQpO1xuICAgIFxuICAgIC8vIERlc3Ryb3kgc2Vzc2lvbiB0byBmcmVlIHJlc291cmNlc1xuICAgIHNlc3Npb24uZGVzdHJveSgpO1xuICAgIFxuICAgIHJldHVybiBwYXJzZWQ7XG5cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIHRyeUFJOlwiLCBlcnIpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcbiAgLy8gTGlzdGVuIGZvciBtZXNzYWdlcyBmcm9tIGNvbnRlbnQgc2NyaXB0cyBvciBwb3B1cFxuICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIHN3aXRjaCAobWVzc2FnZS50eXBlKSB7XG4gICAgICBjYXNlICdTQ1JBUEVEX0RBVEEnOlxuICAgICAgICAvLyBTdG9yZSB0aGUgbGF0ZXN0IHNjcmFwZWQgam9iIGRhdGFcbiAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IG1lc3NhZ2UuZGF0YTtcblxuICAgICAgICBjb25zb2xlLmxvZygnRGVzY3JpcHRpb246ICcsIGxhdGVzdFNjcmFwZWQ/LmRlc2NyaXB0aW9uKTtcblxuICAgICAgICB0cnlBSShsYXRlc3RTY3JhcGVkISkudGhlbihhaVJlc3VsdCA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQUkgUmVzdWx0OlwiLCBhaVJlc3VsdCk7XG5cbiAgICAgICAgaWYgKGxhdGVzdFNjcmFwZWQgJiYgYWlSZXN1bHQpIHtcbiAgICAgICAgICBsYXRlc3RTY3JhcGVkID0ge1xuICAgICAgICAgICAgLi4ubGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICAgIC8vIGFpU3VtbWFyeTogYWlSZXN1bHQuY2xlYW5TdW1tYXJ5LFxuICAgICAgICAgICAgcmVxdWlyZW1lbnRzOiBhaVJlc3VsdC5yZXF1aXJlbWVudHMsXG4gICAgICAgICAgICBzYWxhcnk6IGFpUmVzdWx0LnNhbGFyeSB8fCBsYXRlc3RTY3JhcGVkLnNhbGFyeSxcbiAgICAgICAgICAgIHNraWxsczogYWlSZXN1bHQuc2tpbGxzIHx8IFtdLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAvLyBOb3cgcmVsYXkgdGhlIGVucmljaGVkIGRhdGFcbiAgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICB0eXBlOiBcIlJFTEFZRURfU0NSQVBFRF9EQVRBXCIsXG4gICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgfSkuY2F0Y2goKCkgPT4ge1xuICAgIC8vIFBvcHVwIG5vdCBvcGVuLCBpZ25vcmUgZXJyb3JcbiAgfSk7XG59KS5jYXRjaChlcnIgPT4ge1xuICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gdHJ5QUk6XCIsIGVycik7XG59KTtcblxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coJ0JhY2tncm91bmQ6IFJlY2VpdmVkIGpvYiBkYXRhJywge1xuICAgICAgICAgIGNvbXBhbnk6IGxhdGVzdFNjcmFwZWQ/LmNvbXBhbnksXG4gICAgICAgICAgdGl0bGU6IGxhdGVzdFNjcmFwZWQ/LnRpdGxlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFJlbGF5IHRvIHBvcHVwIGlmIGl0J3Mgb3BlblxuICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgIHR5cGU6ICdSRUxBWUVEX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgfSkuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgIC8vIFBvcHVwIG5vdCBvcGVuLCBpZ25vcmUgZXJyb3JcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdHRVRfTEFURVNUX1NDUkFQRUQnOlxuICAgICAgICAvLyBTZW5kIHRoZSBsYXRlc3Qgc2NyYXBlZCBkYXRhIHRvIHJlcXVlc3RlclxuICAgICAgICBzZW5kUmVzcG9uc2UobGF0ZXN0U2NyYXBlZCk7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBLZWVwIG1lc3NhZ2UgY2hhbm5lbCBvcGVuIGZvciBhc3luYyByZXNwb25zZVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH0pO1xufSk7IiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJuYW1lcyI6WyJicm93c2VyIiwiX2Jyb3dzZXIiLCJyZXN1bHQiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxpQkFBaUIsS0FBSztBQUNwQyxRQUFJLE9BQU8sUUFBUSxPQUFPLFFBQVEsV0FBWSxRQUFP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QUFZLEtBQUs7QUFDZixZQUFNLE1BQU0scUVBQXFFO0FBQUEsSUFDbkY7QUFBQSxJQUNBLFdBQVcsS0FBSztBQUNkLFlBQU0sTUFBTSxvRUFBb0U7QUFBQSxJQUNsRjtBQUFBLElBQ0EsV0FBVyxLQUFLO0FBQ2QsWUFBTSxNQUFNLG9FQUFvRTtBQUFBLElBQ2xGO0FBQUEsSUFDQSxzQkFBc0IsU0FBUztBQUM3QixZQUFNLFVBQVUsS0FBSyxlQUFlLE9BQU87QUFDM0MsWUFBTSxnQkFBZ0IsUUFBUSxRQUFRLFNBQVMsSUFBSTtBQUNuRCxhQUFPLE9BQU8sSUFBSSxhQUFhLEdBQUc7QUFBQSxJQUNwQztBQUFBLElBQ0EsZUFBZSxRQUFRO0FBQ3JCLGFBQU8sT0FBTyxRQUFRLHVCQUF1QixNQUFNO0FBQUEsSUFDckQ7QUFBQSxFQUNGO0FBQ0EsTUFBSSxlQUFlO0FBQ25CLGVBQWEsWUFBWSxDQUFDLFFBQVEsU0FBUyxRQUFRLE9BQU8sS0FBSztBQUMvRCxNQUFJLHNCQUFzQixjQUFjLE1BQU07QUFBQSxJQUM1QyxZQUFZLGNBQWMsUUFBUTtBQUNoQyxZQUFNLDBCQUEwQixZQUFZLE1BQU0sTUFBTSxFQUFFO0FBQUEsSUFDNUQ7QUFBQSxFQUNGO0FBQ0EsV0FBUyxpQkFBaUIsY0FBYyxVQUFVO0FBQ2hELFFBQUksQ0FBQyxhQUFhLFVBQVUsU0FBUyxRQUFRLEtBQUssYUFBYTtBQUM3RCxZQUFNLElBQUk7QUFBQSxRQUNSO0FBQUEsUUFDQSxHQUFHLFFBQVEsMEJBQTBCLGFBQWEsVUFBVSxLQUFLLElBQUksQ0FBQztBQUFBLE1BQzVFO0FBQUEsRUFDQTtBQUNBLFdBQVMsaUJBQWlCLGNBQWMsVUFBVTtBQUNoRCxRQUFJLFNBQVMsU0FBUyxHQUFHO0FBQ3ZCLFlBQU0sSUFBSSxvQkFBb0IsY0FBYyxnQ0FBZ0M7QUFDOUUsUUFBSSxTQUFTLFNBQVMsR0FBRyxLQUFLLFNBQVMsU0FBUyxLQUFLLENBQUMsU0FBUyxXQUFXLElBQUk7QUFDNUUsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxNQUNOO0FBQUEsRUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDEsMiw0XX0=
