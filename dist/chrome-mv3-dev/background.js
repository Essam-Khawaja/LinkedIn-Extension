var background = (function() {
  "use strict";
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  async function generateCoverLetter(jobData, analyzedData, userProfile) {
    try {
      const availability = await LanguageModel.availability();
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
      const description = jobData.description ? jobData.description.substring(0, 2e3) : "No description available";
      const userContext = userProfile ? `
User Profile:
- Name: ${userProfile.name || "Not provided"}
- Current Role: ${userProfile.currentRole || "Not provided"}
- Years of Experience: ${userProfile.yearsExperience || "Not provided"}
- Key Skills: ${userProfile.skills?.join(", ") || "Not provided"}
- Notable Achievements: ${userProfile.achievements?.join("; ") || "Not provided"}
` : "";
      const keyRequirements = analyzedData.requirements?.slice(0, 5).join("\n- ") || "Not analyzed";
      const keySkills = analyzedData.skills?.slice(0, 5).map((s) => s.name).join(", ") || "Not analyzed";
      const prompt = `Generate a professional cover letter for the following job application.

Job Details:
- Position: ${jobData.title}
- Company: ${jobData.company}
- Location: ${jobData.location}

Key Requirements from Job Posting:
- ${keyRequirements}

Key Skills Needed:
${keySkills}

${userContext}

Job Description Summary:
${description}

Instructions:
1. Write a professional, engaging cover letter (250-350 words)
2. Open with a strong hook that shows enthusiasm for the role
3. Highlight 2-3 relevant experiences or skills that match the job requirements
4. Show knowledge of the company (keep it brief and professional)
5. Express genuine interest in contributing to the team
6. Close with a call to action
7. Use a professional but warm tone
8. DO NOT use overly generic phrases like "I am writing to express my interest"
9. Be specific about skills and experiences rather than vague claims
10. Keep paragraphs concise and impactful

Format the letter with:
[Date]

[Hiring Manager/Hiring Team]
${jobData.company}

[Body paragraphs]

Sincerely,
${userProfile?.name || "[Your Name]"}

Return ONLY the cover letter text, no additional commentary.`;
      const result2 = await session.prompt(prompt);
      console.log("Generated cover letter");
      session.destroy();
      return result2.trim();
    } catch (err) {
      console.error("Cover letter generation error:", err);
      return null;
    }
  }
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
          console.log("🔄 SCRAPING_STARTED");
          isProcessing = true;
          browser.runtime.sendMessage({
            type: "SCRAPING_STARTED"
          }).catch(() => {
            console.log("Popup not open");
          });
          break;
        case "GET_PROFILE": {
          console.log("📩 GET_PROFILE received");
          (async () => {
            try {
              const data = await chrome.storage.local.get("profile");
              console.log("Sending profile:", data.profile);
              sendResponse({ ok: true, profile: data.profile });
            } catch (err) {
              console.error("Error in GET_PROFILE:", err);
              sendResponse({ ok: false, error: err.toString() });
            }
          })();
          return true;
        }
        case "JOB_SCRAPED_DATA": {
          const scrapedData = message.data;
          console.log("📦 JOB_SCRAPED_DATA received");
          if (scrapedData?.jobData.description && scrapedData.jobData.description.length > 100) {
            console.log("Starting AI analysis...");
            analyzeJobWithAI(scrapedData.jobData).then((aiResult) => {
              console.log("✅ AI Result:", aiResult);
              if (aiResult) {
                latestScraped = {
                  jobData: {
                    ...scrapedData.jobData,
                    salary: aiResult.salary || scrapedData.jobData.salary,
                    description: aiResult.cleanSummary || scrapedData.jobData.description
                  },
                  requirements: aiResult.requirements || [],
                  skills: aiResult.skills || []
                };
              } else {
                latestScraped = scrapedData;
              }
              isProcessing = false;
              browser.runtime.sendMessage({
                type: "RELAYED_JOB_SCRAPED_DATA",
                data: latestScraped
              }).catch(() => console.log("Popup not open"));
            }).catch((err) => {
              console.error("AI analysis error:", err);
              latestScraped = scrapedData;
              isProcessing = false;
              browser.runtime.sendMessage({
                type: "RELAYED_JOB_SCRAPED_DATA",
                data: latestScraped
              }).catch(() => console.log("Popup not open"));
            });
          } else {
            console.log("Skipping AI (no description)");
            latestScraped = scrapedData;
            isProcessing = false;
            browser.runtime.sendMessage({
              type: "RELAYED_JOB_SCRAPED_DATA",
              data: latestScraped
            }).catch(() => console.log("Popup not open"));
          }
          break;
        }
        case "GENERATE_COVER_LETTER": {
          console.log("📝 GENERATE_COVER_LETTER request received");
          (async () => {
            try {
              const { profile } = await chrome.storage.local.get("profile");
              if (!profile) {
                sendResponse({
                  ok: false,
                  error: "No profile found. Please set up your profile first."
                });
                return;
              }
              if (!latestScraped) {
                sendResponse({
                  ok: false,
                  error: "No job data available. Please open a job posting first."
                });
                return;
              }
              console.log("Generating cover letter with:", {
                job: latestScraped.jobData.title,
                user: profile.firstName
              });
              const coverLetter = await generateCoverLetter(
                latestScraped.jobData,
                latestScraped,
                {
                  name: `${profile.firstName} ${profile.lastName}`,
                  email: profile.email,
                  phone: profile.phone,
                  currentRole: profile.currentTitle,
                  yearsExperience: profile.yearsExperience?.toString(),
                  skills: [],
                  // You can add skills to profile if needed
                  achievements: []
                }
              );
              if (!coverLetter) {
                sendResponse({
                  ok: false,
                  error: "Failed to generate cover letter. AI may not be available."
                });
                return;
              }
              console.log("✅ Cover letter generated successfully");
              sendResponse({
                ok: true,
                coverLetter
              });
            } catch (err) {
              console.error("Cover letter generation error:", err);
              sendResponse({
                ok: false,
                error: err.toString()
              });
            }
          })();
          return true;
        }
        case "GET_LATEST_JOB_SCRAPED":
          console.log("Sending data to popup:", { hasData: !!latestScraped, isProcessing });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zcmMvbGliL2JhY2tncm91bmQtaGVscC9qb2Itc3VtbWFyaXplci50cyIsIi4uLy4uL3NyYy9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG4gIGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuICByZXR1cm4gYXJnO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiaW50ZXJmYWNlIFNraWxsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBtYXRjaDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSm9iRGF0YSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGNvbXBhbnk6IHN0cmluZztcbiAgbG9jYXRpb246IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzYWxhcnk6IHN0cmluZztcbiAgcG9zdGVkOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTY3JhcGVkRGF0YSB7XG4gIGpvYkRhdGE6IEpvYkRhdGE7XG4gIHJlcXVpcmVtZW50czogc3RyaW5nW107XG4gIHNraWxsczogU2tpbGxbXTtcbn1cblxuaW50ZXJmYWNlIFVzZXJQcm9maWxlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICBwaG9uZT86IHN0cmluZztcbiAgY3VycmVudFJvbGU/OiBzdHJpbmc7XG4gIHllYXJzRXhwZXJpZW5jZT86IHN0cmluZztcbiAgc2tpbGxzPzogc3RyaW5nW107XG4gIGFjaGlldmVtZW50cz86IHN0cmluZ1tdO1xufVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlQ292ZXJMZXR0ZXIoXG4gIGpvYkRhdGE6IEpvYkRhdGEsIFxuICBhbmFseXplZERhdGE6IFNjcmFwZWREYXRhLFxuICB1c2VyUHJvZmlsZT86IFVzZXJQcm9maWxlXG4pIHtcbiAgdHJ5IHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3QgYXZhaWxhYmlsaXR5ID0gYXdhaXQgTGFuZ3VhZ2VNb2RlbC5hdmFpbGFiaWxpdHkoKTtcblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdubycpIHtcbiAgICAgIGNvbnNvbGUud2FybihcIuKdjCBHZW1pbmkgTmFubyBub3QgYXZhaWxhYmxlXCIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGF2YWlsYWJpbGl0eSA9PT0gJ2FmdGVyLWRvd25sb2FkJykge1xuICAgICAgY29uc29sZS5sb2coXCLij7MgVHJpZ2dlcmluZyBHZW1pbmkgTmFubyBkb3dubG9hZC4uLlwiKTtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG5cbiAgICBjb25zdCBkZXNjcmlwdGlvbiA9IGpvYkRhdGEuZGVzY3JpcHRpb24gXG4gICAgICA/IGpvYkRhdGEuZGVzY3JpcHRpb24uc3Vic3RyaW5nKDAsIDIwMDApXG4gICAgICA6ICdObyBkZXNjcmlwdGlvbiBhdmFpbGFibGUnO1xuXG4gICAgLy8gQnVpbGQgdXNlciBjb250ZXh0IGlmIHByb2ZpbGUgcHJvdmlkZWRcbiAgICBjb25zdCB1c2VyQ29udGV4dCA9IHVzZXJQcm9maWxlID8gYFxuVXNlciBQcm9maWxlOlxuLSBOYW1lOiAke3VzZXJQcm9maWxlLm5hbWUgfHwgJ05vdCBwcm92aWRlZCd9XG4tIEN1cnJlbnQgUm9sZTogJHt1c2VyUHJvZmlsZS5jdXJyZW50Um9sZSB8fCAnTm90IHByb3ZpZGVkJ31cbi0gWWVhcnMgb2YgRXhwZXJpZW5jZTogJHt1c2VyUHJvZmlsZS55ZWFyc0V4cGVyaWVuY2UgfHwgJ05vdCBwcm92aWRlZCd9XG4tIEtleSBTa2lsbHM6ICR7dXNlclByb2ZpbGUuc2tpbGxzPy5qb2luKCcsICcpIHx8ICdOb3QgcHJvdmlkZWQnfVxuLSBOb3RhYmxlIEFjaGlldmVtZW50czogJHt1c2VyUHJvZmlsZS5hY2hpZXZlbWVudHM/LmpvaW4oJzsgJykgfHwgJ05vdCBwcm92aWRlZCd9XG5gIDogJyc7XG5cbiAgICBjb25zdCBrZXlSZXF1aXJlbWVudHMgPSBhbmFseXplZERhdGEucmVxdWlyZW1lbnRzPy5zbGljZSgwLCA1KS5qb2luKCdcXG4tICcpIHx8ICdOb3QgYW5hbHl6ZWQnO1xuICAgIGNvbnN0IGtleVNraWxscyA9IGFuYWx5emVkRGF0YS5za2lsbHM/LnNsaWNlKDAsIDUpLm1hcChzID0+IHMubmFtZSkuam9pbignLCAnKSB8fCAnTm90IGFuYWx5emVkJztcblxuICAgIGNvbnN0IHByb21wdCA9IGBHZW5lcmF0ZSBhIHByb2Zlc3Npb25hbCBjb3ZlciBsZXR0ZXIgZm9yIHRoZSBmb2xsb3dpbmcgam9iIGFwcGxpY2F0aW9uLlxuXG5Kb2IgRGV0YWlsczpcbi0gUG9zaXRpb246ICR7am9iRGF0YS50aXRsZX1cbi0gQ29tcGFueTogJHtqb2JEYXRhLmNvbXBhbnl9XG4tIExvY2F0aW9uOiAke2pvYkRhdGEubG9jYXRpb259XG5cbktleSBSZXF1aXJlbWVudHMgZnJvbSBKb2IgUG9zdGluZzpcbi0gJHtrZXlSZXF1aXJlbWVudHN9XG5cbktleSBTa2lsbHMgTmVlZGVkOlxuJHtrZXlTa2lsbHN9XG5cbiR7dXNlckNvbnRleHR9XG5cbkpvYiBEZXNjcmlwdGlvbiBTdW1tYXJ5OlxuJHtkZXNjcmlwdGlvbn1cblxuSW5zdHJ1Y3Rpb25zOlxuMS4gV3JpdGUgYSBwcm9mZXNzaW9uYWwsIGVuZ2FnaW5nIGNvdmVyIGxldHRlciAoMjUwLTM1MCB3b3JkcylcbjIuIE9wZW4gd2l0aCBhIHN0cm9uZyBob29rIHRoYXQgc2hvd3MgZW50aHVzaWFzbSBmb3IgdGhlIHJvbGVcbjMuIEhpZ2hsaWdodCAyLTMgcmVsZXZhbnQgZXhwZXJpZW5jZXMgb3Igc2tpbGxzIHRoYXQgbWF0Y2ggdGhlIGpvYiByZXF1aXJlbWVudHNcbjQuIFNob3cga25vd2xlZGdlIG9mIHRoZSBjb21wYW55IChrZWVwIGl0IGJyaWVmIGFuZCBwcm9mZXNzaW9uYWwpXG41LiBFeHByZXNzIGdlbnVpbmUgaW50ZXJlc3QgaW4gY29udHJpYnV0aW5nIHRvIHRoZSB0ZWFtXG42LiBDbG9zZSB3aXRoIGEgY2FsbCB0byBhY3Rpb25cbjcuIFVzZSBhIHByb2Zlc3Npb25hbCBidXQgd2FybSB0b25lXG44LiBETyBOT1QgdXNlIG92ZXJseSBnZW5lcmljIHBocmFzZXMgbGlrZSBcIkkgYW0gd3JpdGluZyB0byBleHByZXNzIG15IGludGVyZXN0XCJcbjkuIEJlIHNwZWNpZmljIGFib3V0IHNraWxscyBhbmQgZXhwZXJpZW5jZXMgcmF0aGVyIHRoYW4gdmFndWUgY2xhaW1zXG4xMC4gS2VlcCBwYXJhZ3JhcGhzIGNvbmNpc2UgYW5kIGltcGFjdGZ1bFxuXG5Gb3JtYXQgdGhlIGxldHRlciB3aXRoOlxuW0RhdGVdXG5cbltIaXJpbmcgTWFuYWdlci9IaXJpbmcgVGVhbV1cbiR7am9iRGF0YS5jb21wYW55fVxuXG5bQm9keSBwYXJhZ3JhcGhzXVxuXG5TaW5jZXJlbHksXG4ke3VzZXJQcm9maWxlPy5uYW1lIHx8ICdbWW91ciBOYW1lXSd9XG5cblJldHVybiBPTkxZIHRoZSBjb3ZlciBsZXR0ZXIgdGV4dCwgbm8gYWRkaXRpb25hbCBjb21tZW50YXJ5LmA7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzZXNzaW9uLnByb21wdChwcm9tcHQpO1xuICAgIGNvbnNvbGUubG9nKFwiR2VuZXJhdGVkIGNvdmVyIGxldHRlclwiKTtcblxuICAgIHNlc3Npb24uZGVzdHJveSgpO1xuICAgIHJldHVybiByZXN1bHQudHJpbSgpO1xuXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJDb3ZlciBsZXR0ZXIgZ2VuZXJhdGlvbiBlcnJvcjpcIiwgZXJyKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBhbmFseXplSm9iV2l0aEFJKGpvYkRhdGE6IGFueSkge1xuICB0cnkge1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBhdmFpbGFiaWxpdHkgPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmF2YWlsYWJpbGl0eSgpO1xuICAgIGNvbnNvbGUubG9nKCfinKggQUkgQXZhaWxhYmlsaXR5OicsIGF2YWlsYWJpbGl0eSk7XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnbm8nKSB7XG4gICAgICBjb25zb2xlLndhcm4oXCLinYwgR2VtaW5pIE5hbm8gbm90IGF2YWlsYWJsZVwiKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdhZnRlci1kb3dubG9hZCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwi4o+zIFRyaWdnZXJpbmcgR2VtaW5pIE5hbm8gZG93bmxvYWQuLi5cIik7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuXG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSBqb2JEYXRhLmRlc2NyaXB0aW9uIFxuICAgICAgPyBqb2JEYXRhLmRlc2NyaXB0aW9uLnN1YnN0cmluZygwLCAxNTAwKVxuICAgICAgOiAnTm8gZGVzY3JpcHRpb24gYXZhaWxhYmxlJztcblxuICAgIGNvbnN0IHNjaGVtYSA9IHtcbiAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICByZXF1aXJlZDogW1wiY2xlYW5TdW1tYXJ5XCIsIFwic2FsYXJ5XCIsIFwic2tpbGxzXCIsIFwicmVxdWlyZW1lbnRzXCJdLFxuICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBjbGVhblN1bW1hcnk6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICBzYWxhcnk6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICBza2lsbHM6IHtcbiAgICAgICAgICB0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICAgICAgICByZXF1aXJlZDogW1wibmFtZVwiLCBcIm1hdGNoXCJdLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICBuYW1lOiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgICAgICAgbWF0Y2g6IHsgdHlwZTogXCJudW1iZXJcIiB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlbWVudHM6IHt0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH07XG5cbiAgICBjb25zdCBwcm9tcHQgPSBgQW5hbHl6ZSB0aGlzIGpvYiBwb3N0aW5nIGFuZCBleHRyYWN0IGtleSBpbmZvcm1hdGlvbi5cblxuSm9iIERldGFpbHM6XG4tIFRpdGxlOiAke2pvYkRhdGEudGl0bGUgfHwgJ1Vua25vd24nfVxuLSBDb21wYW55OiAke2pvYkRhdGEuY29tcGFueSB8fCAnVW5rbm93bid9XG4tIExvY2F0aW9uOiAke2pvYkRhdGEubG9jYXRpb24gfHwgJ05vdCBzcGVjaWZpZWQnfVxuLSBUeXBlOiAke2pvYkRhdGEudHlwZSB8fCAnTm90IHNwZWNpZmllZCd9XG4tIEN1cnJlbnQgU2FsYXJ5OiAke2pvYkRhdGEuc2FsYXJ5IHx8IFwiTm90IHNwZWNpZmllZFwifVxuXG5GdWxsIERlc2NyaXB0aW9uOlxuJHtkZXNjcmlwdGlvbn1cblxuSU1QT1JUQU5UOiBPbmx5IGV4dHJhY3QgaW5mb3JtYXRpb24gdGhhdCBpcyBleHBsaWNpdGx5IHN0YXRlZCBpbiB0aGUgZGVzY3JpcHRpb24uIERvIG5vdCBtYWtlIHVwIG9yIGluZmVyIGluZm9ybWF0aW9uLlxuXG5Qcm92aWRlIGEgSlNPTiByZXNwb25zZSB3aXRoOlxuMS4gY2xlYW5TdW1tYXJ5OiBBIDItMyBzZW50ZW5jZSBjb25jaXNlIHN1bW1hcnkgb2YgdGhlIHJvbGVcbjIuIHNhbGFyeTogRXh0cmFjdCBzYWxhcnkgYXMgXCIkWFgsWFhYIC0gJFhYLFhYWFwiIG9yIFwiTi9BXCIgaWYgbm90IG1lbnRpb25lZFxuMy4gcmVxdWlyZW1lbnRzOiBFeHRyYWN0IDUtNyBrZXkgcXVhbGlmaWNhdGlvbnMvcmVxdWlyZW1lbnRzIChwcmlvcml0aXplIGJhc2ljIHF1YWxpZmljYXRpb25zKVxuNC4gc2tpbGxzOiBBcnJheSBvZiA1LTcga2V5IHRlY2huaWNhbCBza2lsbHMgd2l0aCBpbXBvcnRhbmNlIHJhdGluZyAoMC0xMDApXG5cbkV4YW1wbGUgZm9ybWF0Olxue1xuICBcImNsZWFuU3VtbWFyeVwiOiBcIlNvZnR3YXJlIGVuZ2luZWVyIHJvbGUgZm9jdXNpbmcgb24uLi5cIixcbiAgXCJzYWxhcnlcIjogXCIkODAsMDAwIC0gJDEyMCwwMDBcIixcbiAgXCJyZXF1aXJlbWVudHNcIjogW1wiQmFjaGVsb3IncyBkZWdyZWUgaW4gQ1NcIiwgXCIzKyB5ZWFycyBleHBlcmllbmNlXCJdLFxuICBcInNraWxsc1wiOiBbe1wibmFtZVwiOiBcIkphdmFTY3JpcHRcIiwgXCJtYXRjaFwiOiA5MH0sIHtcIm5hbWVcIjogXCJSZWFjdFwiLCBcIm1hdGNoXCI6IDg1fV1cbn1cblxuUmV0dXJuIE9OTFkgdmFsaWQgSlNPTiBtYXRjaGluZyB0aGlzIHN0cnVjdHVyZS5gO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc2Vzc2lvbi5wcm9tcHQocHJvbXB0LCB7cmVzcG9uc2VDb25zdHJhaW50OiBzY2hlbWF9KTtcbiAgICBjb25zb2xlLmxvZyhcIvCfpJYgUmF3IEFJIFJlc3BvbnNlOlwiLCByZXN1bHQpO1xuXG4gICAgICBsZXQgY2xlYW5lZFJlc3VsdCA9IHJlc3VsdC50cmltKCk7XG4gICAgXG4gICAgLy8gUmVtb3ZlIGBgYGpzb24gYW5kIGBgYCBpZiBwcmVzZW50XG4gICAgaWYgKGNsZWFuZWRSZXN1bHQuc3RhcnRzV2l0aCgnYGBganNvbicpKSB7XG4gICAgICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBganNvblxccyovLCAnJykucmVwbGFjZSgvXFxzKmBgYCQvLCAnJyk7XG4gICAgfSBlbHNlIGlmIChjbGVhbmVkUmVzdWx0LnN0YXJ0c1dpdGgoJ2BgYCcpKSB7XG4gICAgICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBgXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqYGBgJC8sICcnKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShjbGVhbmVkUmVzdWx0KTtcbiAgICBcbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICByZXR1cm4gcGFyc2VkO1xuXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCB7IGFuYWx5emVKb2JXaXRoQUksIGdlbmVyYXRlQ292ZXJMZXR0ZXIgfTtcbiIsImltcG9ydCB7IGFuYWx5emVKb2JXaXRoQUksIGdlbmVyYXRlQ292ZXJMZXR0ZXIgfSBmcm9tICcuLi9saWIvYmFja2dyb3VuZC1oZWxwL2pvYi1zdW1tYXJpemVyJ1xuXG5pbnRlcmZhY2UgU2tpbGwge1xuICBuYW1lOiBzdHJpbmc7XG4gIG1hdGNoOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBKb2JEYXRhIHtcbiAgdGl0bGU6IHN0cmluZztcbiAgY29tcGFueTogc3RyaW5nO1xuICBsb2NhdGlvbjogc3RyaW5nO1xuICB0eXBlOiBzdHJpbmc7XG4gIHNhbGFyeTogc3RyaW5nO1xuICBwb3N0ZWQ6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFNjcmFwZWREYXRhIHtcbiAgam9iRGF0YTogSm9iRGF0YTtcbiAgcmVxdWlyZW1lbnRzOiBzdHJpbmdbXTtcbiAgc2tpbGxzOiBTa2lsbFtdO1xufVxuXG5sZXQgbGF0ZXN0U2NyYXBlZDogU2NyYXBlZERhdGEgfCBudWxsID0gbnVsbDtcbmxldCBpc1Byb2Nlc3NpbmcgPSBmYWxzZTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XG4gIGNvbnNvbGUubG9nKCfwn46vIEJhY2tncm91bmQgc2NyaXB0IGluaXRpYWxpemVkJyk7XG5cbiAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIHN3aXRjaCAobWVzc2FnZS50eXBlKSB7XG4gICAgICBjYXNlICdTQ1JBUElOR19TVEFSVEVEJzpcbiAgICAgICAgY29uc29sZS5sb2coJ/CflIQgU0NSQVBJTkdfU1RBUlRFRCcpO1xuICAgICAgICBpc1Byb2Nlc3NpbmcgPSB0cnVlO1xuICAgICAgICBcbiAgICAgICAgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICB0eXBlOiAnU0NSQVBJTkdfU1RBUlRFRCcsXG4gICAgICAgIH0pLmNhdGNoKCgpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnUG9wdXAgbm90IG9wZW4nKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdHRVRfUFJPRklMRSc6IHtcbiAgICAgICAgY29uc29sZS5sb2coXCLwn5OpIEdFVF9QUk9GSUxFIHJlY2VpdmVkXCIpO1xuICAgICAgICBcbiAgICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldCgncHJvZmlsZScpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NlbmRpbmcgcHJvZmlsZTonLCBkYXRhLnByb2ZpbGUpO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IHRydWUsIHByb2ZpbGU6IGRhdGEucHJvZmlsZSB9KTtcbiAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBHRVRfUFJPRklMRTpcIiwgZXJyKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiBmYWxzZSwgZXJyb3I6IGVyciEudG9TdHJpbmcoKSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pKCk7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBLZWVwIGNoYW5uZWwgb3BlblxuICAgICAgfVxuXG4gICAgICBjYXNlICdKT0JfU0NSQVBFRF9EQVRBJzoge1xuICAgICAgICBjb25zdCBzY3JhcGVkRGF0YSA9IG1lc3NhZ2UuZGF0YSBhcyBTY3JhcGVkRGF0YTtcbiAgICAgICAgY29uc29sZS5sb2coJ/Cfk6YgSk9CX1NDUkFQRURfREFUQSByZWNlaXZlZCcpO1xuXG4gICAgICAgIGlmIChzY3JhcGVkRGF0YT8uam9iRGF0YS5kZXNjcmlwdGlvbiAmJiBzY3JhcGVkRGF0YS5qb2JEYXRhLmRlc2NyaXB0aW9uLmxlbmd0aCA+IDEwMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdTdGFydGluZyBBSSBhbmFseXNpcy4uLicpO1xuICAgICAgICAgIFxuICAgICAgICAgIGFuYWx5emVKb2JXaXRoQUkoc2NyYXBlZERhdGEuam9iRGF0YSlcbiAgICAgICAgICAgIC50aGVuKGFpUmVzdWx0ID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+KchSBBSSBSZXN1bHQ6JywgYWlSZXN1bHQpO1xuXG4gICAgICAgICAgICAgIGlmIChhaVJlc3VsdCkge1xuICAgICAgICAgICAgICAgIGxhdGVzdFNjcmFwZWQgPSB7XG4gICAgICAgICAgICAgICAgICBqb2JEYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLnNjcmFwZWREYXRhLmpvYkRhdGEsXG4gICAgICAgICAgICAgICAgICAgIHNhbGFyeTogYWlSZXN1bHQuc2FsYXJ5IHx8IHNjcmFwZWREYXRhLmpvYkRhdGEuc2FsYXJ5LFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYWlSZXN1bHQuY2xlYW5TdW1tYXJ5IHx8IHNjcmFwZWREYXRhLmpvYkRhdGEuZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgcmVxdWlyZW1lbnRzOiBhaVJlc3VsdC5yZXF1aXJlbWVudHMgfHwgW10sXG4gICAgICAgICAgICAgICAgICBza2lsbHM6IGFpUmVzdWx0LnNraWxscyB8fCBbXSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxhdGVzdFNjcmFwZWQgPSBzY3JhcGVkRGF0YTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ1JFTEFZRURfSk9CX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICAgICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gY29uc29sZS5sb2coJ1BvcHVwIG5vdCBvcGVuJykpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdBSSBhbmFseXNpcyBlcnJvcjonLCBlcnIpO1xuICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkID0gc2NyYXBlZERhdGE7XG4gICAgICAgICAgICAgIGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnUkVMQVlFRF9KT0JfU0NSQVBFRF9EQVRBJyxcbiAgICAgICAgICAgICAgICBkYXRhOiBsYXRlc3RTY3JhcGVkLFxuICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBjb25zb2xlLmxvZygnUG9wdXAgbm90IG9wZW4nKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnU2tpcHBpbmcgQUkgKG5vIGRlc2NyaXB0aW9uKScpO1xuICAgICAgICAgIGxhdGVzdFNjcmFwZWQgPSBzY3JhcGVkRGF0YTtcbiAgICAgICAgICBpc1Byb2Nlc3NpbmcgPSBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgdHlwZTogJ1JFTEFZRURfSk9CX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICBkYXRhOiBsYXRlc3RTY3JhcGVkLFxuICAgICAgICAgIH0pLmNhdGNoKCgpID0+IGNvbnNvbGUubG9nKCdQb3B1cCBub3Qgb3BlbicpKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2FzZSAnR0VORVJBVEVfQ09WRVJfTEVUVEVSJzoge1xuICAgICAgICBjb25zb2xlLmxvZygn8J+TnSBHRU5FUkFURV9DT1ZFUl9MRVRURVIgcmVxdWVzdCByZWNlaXZlZCcpO1xuICAgICAgICBcbiAgICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gR2V0IHVzZXIgcHJvZmlsZVxuICAgICAgICAgICAgY29uc3QgeyBwcm9maWxlIH0gPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoJ3Byb2ZpbGUnKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFwcm9maWxlKSB7XG4gICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IFxuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSwgXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdObyBwcm9maWxlIGZvdW5kLiBQbGVhc2Ugc2V0IHVwIHlvdXIgcHJvZmlsZSBmaXJzdC4nIFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBVc2UgbGF0ZXN0IHNjcmFwZWQgZGF0YVxuICAgICAgICAgICAgaWYgKCFsYXRlc3RTY3JhcGVkKSB7XG4gICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IFxuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSwgXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdObyBqb2IgZGF0YSBhdmFpbGFibGUuIFBsZWFzZSBvcGVuIGEgam9iIHBvc3RpbmcgZmlyc3QuJyBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0dlbmVyYXRpbmcgY292ZXIgbGV0dGVyIHdpdGg6Jywge1xuICAgICAgICAgICAgICBqb2I6IGxhdGVzdFNjcmFwZWQuam9iRGF0YS50aXRsZSxcbiAgICAgICAgICAgICAgdXNlcjogcHJvZmlsZS5maXJzdE5hbWVcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBHZW5lcmF0ZSB0aGUgY292ZXIgbGV0dGVyXG4gICAgICAgICAgICBjb25zdCBjb3ZlckxldHRlciA9IGF3YWl0IGdlbmVyYXRlQ292ZXJMZXR0ZXIoXG4gICAgICAgICAgICAgIGxhdGVzdFNjcmFwZWQuam9iRGF0YSxcbiAgICAgICAgICAgICAgbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6IGAke3Byb2ZpbGUuZmlyc3ROYW1lfSAke3Byb2ZpbGUubGFzdE5hbWV9YCxcbiAgICAgICAgICAgICAgICBlbWFpbDogcHJvZmlsZS5lbWFpbCxcbiAgICAgICAgICAgICAgICBwaG9uZTogcHJvZmlsZS5waG9uZSxcbiAgICAgICAgICAgICAgICBjdXJyZW50Um9sZTogcHJvZmlsZS5jdXJyZW50VGl0bGUsXG4gICAgICAgICAgICAgICAgeWVhcnNFeHBlcmllbmNlOiBwcm9maWxlLnllYXJzRXhwZXJpZW5jZT8udG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBza2lsbHM6IFtdLCAvLyBZb3UgY2FuIGFkZCBza2lsbHMgdG8gcHJvZmlsZSBpZiBuZWVkZWRcbiAgICAgICAgICAgICAgICBhY2hpZXZlbWVudHM6IFtdXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmICghY292ZXJMZXR0ZXIpIHtcbiAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgXG4gICAgICAgICAgICAgICAgb2s6IGZhbHNlLCBcbiAgICAgICAgICAgICAgICBlcnJvcjogJ0ZhaWxlZCB0byBnZW5lcmF0ZSBjb3ZlciBsZXR0ZXIuIEFJIG1heSBub3QgYmUgYXZhaWxhYmxlLicgXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCfinIUgQ292ZXIgbGV0dGVyIGdlbmVyYXRlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IFxuICAgICAgICAgICAgICBvazogdHJ1ZSwgXG4gICAgICAgICAgICAgIGNvdmVyTGV0dGVyOiBjb3ZlckxldHRlciBcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDb3ZlciBsZXR0ZXIgZ2VuZXJhdGlvbiBlcnJvcjonLCBlcnIpO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgXG4gICAgICAgICAgICAgIG9rOiBmYWxzZSwgXG4gICAgICAgICAgICAgIGVycm9yOiBlcnIhLnRvU3RyaW5nKCkgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pKCk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gS2VlcCBjaGFubmVsIG9wZW4gZm9yIGFzeW5jIHJlc3BvbnNlXG4gICAgICB9XG5cbiAgICAgIGNhc2UgJ0dFVF9MQVRFU1RfSk9CX1NDUkFQRUQnOlxuICAgICAgICBjb25zb2xlLmxvZygnU2VuZGluZyBkYXRhIHRvIHBvcHVwOicsIHsgaGFzRGF0YTogISFsYXRlc3RTY3JhcGVkLCBpc1Byb2Nlc3NpbmcgfSk7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IGRhdGE6IGxhdGVzdFNjcmFwZWQsIGlzUHJvY2Vzc2luZyB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfSk7XG59KTsiLCIvLyBzcmMvaW5kZXgudHNcbnZhciBfTWF0Y2hQYXR0ZXJuID0gY2xhc3Mge1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4pIHtcbiAgICBpZiAobWF0Y2hQYXR0ZXJuID09PSBcIjxhbGxfdXJscz5cIikge1xuICAgICAgdGhpcy5pc0FsbFVybHMgPSB0cnVlO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBbLi4uX01hdGNoUGF0dGVybi5QUk9UT0NPTFNdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gXCIqXCI7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZ3JvdXBzID0gLyguKik6XFwvXFwvKC4qPykoXFwvLiopLy5leGVjKG1hdGNoUGF0dGVybik7XG4gICAgICBpZiAoZ3JvdXBzID09IG51bGwpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgXCJJbmNvcnJlY3QgZm9ybWF0XCIpO1xuICAgICAgY29uc3QgW18sIHByb3RvY29sLCBob3N0bmFtZSwgcGF0aG5hbWVdID0gZ3JvdXBzO1xuICAgICAgdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKTtcbiAgICAgIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSk7XG4gICAgICB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBwcm90b2NvbCA9PT0gXCIqXCIgPyBbXCJodHRwXCIsIFwiaHR0cHNcIl0gOiBbcHJvdG9jb2xdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gaG9zdG5hbWU7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBwYXRobmFtZTtcbiAgICB9XG4gIH1cbiAgaW5jbHVkZXModXJsKSB7XG4gICAgaWYgKHRoaXMuaXNBbGxVcmxzKVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgdSA9IHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIgPyBuZXcgVVJMKHVybCkgOiB1cmwgaW5zdGFuY2VvZiBMb2NhdGlvbiA/IG5ldyBVUkwodXJsLmhyZWYpIDogdXJsO1xuICAgIHJldHVybiAhIXRoaXMucHJvdG9jb2xNYXRjaGVzLmZpbmQoKHByb3RvY29sKSA9PiB7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwc1wiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBzTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZmlsZVwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0ZpbGVNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmdHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGdHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJ1cm5cIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNVcm5NYXRjaCh1KTtcbiAgICB9KTtcbiAgfVxuICBpc0h0dHBNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHA6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0h0dHBzTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwczpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSG9zdFBhdGhNYXRjaCh1cmwpIHtcbiAgICBpZiAoIXRoaXMuaG9zdG5hbWVNYXRjaCB8fCAhdGhpcy5wYXRobmFtZU1hdGNoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGhvc3RuYW1lTWF0Y2hSZWdleHMgPSBbXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gpLFxuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoLnJlcGxhY2UoL15cXCpcXC4vLCBcIlwiKSlcbiAgICBdO1xuICAgIGNvbnN0IHBhdGhuYW1lTWF0Y2hSZWdleCA9IHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMucGF0aG5hbWVNYXRjaCk7XG4gICAgcmV0dXJuICEhaG9zdG5hbWVNYXRjaFJlZ2V4cy5maW5kKChyZWdleCkgPT4gcmVnZXgudGVzdCh1cmwuaG9zdG5hbWUpKSAmJiBwYXRobmFtZU1hdGNoUmVnZXgudGVzdCh1cmwucGF0aG5hbWUpO1xuICB9XG4gIGlzRmlsZU1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmaWxlOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc0Z0cE1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmdHA6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzVXJuTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IHVybjovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgY29udmVydFBhdHRlcm5Ub1JlZ2V4KHBhdHRlcm4pIHtcbiAgICBjb25zdCBlc2NhcGVkID0gdGhpcy5lc2NhcGVGb3JSZWdleChwYXR0ZXJuKTtcbiAgICBjb25zdCBzdGFyc1JlcGxhY2VkID0gZXNjYXBlZC5yZXBsYWNlKC9cXFxcXFwqL2csIFwiLipcIik7XG4gICAgcmV0dXJuIFJlZ0V4cChgXiR7c3RhcnNSZXBsYWNlZH0kYCk7XG4gIH1cbiAgZXNjYXBlRm9yUmVnZXgoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG4gIH1cbn07XG52YXIgTWF0Y2hQYXR0ZXJuID0gX01hdGNoUGF0dGVybjtcbk1hdGNoUGF0dGVybi5QUk9UT0NPTFMgPSBbXCJodHRwXCIsIFwiaHR0cHNcIiwgXCJmaWxlXCIsIFwiZnRwXCIsIFwidXJuXCJdO1xudmFyIEludmFsaWRNYXRjaFBhdHRlcm4gPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuLCByZWFzb24pIHtcbiAgICBzdXBlcihgSW52YWxpZCBtYXRjaCBwYXR0ZXJuIFwiJHttYXRjaFBhdHRlcm59XCI6ICR7cmVhc29ufWApO1xuICB9XG59O1xuZnVuY3Rpb24gdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKSB7XG4gIGlmICghTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5pbmNsdWRlcyhwcm90b2NvbCkgJiYgcHJvdG9jb2wgIT09IFwiKlwiKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYCR7cHJvdG9jb2x9IG5vdCBhIHZhbGlkIHByb3RvY29sICgke01hdGNoUGF0dGVybi5QUk9UT0NPTFMuam9pbihcIiwgXCIpfSlgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSkge1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCI6XCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYEhvc3RuYW1lIGNhbm5vdCBpbmNsdWRlIGEgcG9ydGApO1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCIqXCIpICYmIGhvc3RuYW1lLmxlbmd0aCA+IDEgJiYgIWhvc3RuYW1lLnN0YXJ0c1dpdGgoXCIqLlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGBJZiB1c2luZyBhIHdpbGRjYXJkICgqKSwgaXQgbXVzdCBnbyBhdCB0aGUgc3RhcnQgb2YgdGhlIGhvc3RuYW1lYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpIHtcbiAgcmV0dXJuO1xufVxuZXhwb3J0IHtcbiAgSW52YWxpZE1hdGNoUGF0dGVybixcbiAgTWF0Y2hQYXR0ZXJuXG59O1xuIl0sIm5hbWVzIjpbImJyb3dzZXIiLCJfYnJvd3NlciIsInJlc3VsdCJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLGlCQUFpQixLQUFLO0FBQ3BDLFFBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxXQUFZLFFBQU8sRUFBRSxNQUFNLElBQUc7QUFDaEUsV0FBTztBQUFBLEVBQ1Q7QUNGTyxRQUFNQSxZQUFVLFdBQVcsU0FBUyxTQUFTLEtBQ2hELFdBQVcsVUFDWCxXQUFXO0FDRlIsUUFBTSxVQUFVQztBQytCdkIsaUJBQWUsb0JBQ2IsU0FDQSxjQUNBLGFBQ0E7QUFDQSxRQUFJO0FBRUYsWUFBTSxlQUFlLE1BQU0sY0FBYyxhQUFBO0FBRXpDLFVBQUksaUJBQWlCLE1BQU07QUFDekIsZ0JBQVEsS0FBSyw2QkFBNkI7QUFDMUMsZUFBTztBQUFBLE1BQ1Q7QUFFQSxVQUFJLGlCQUFpQixrQkFBa0I7QUFDckMsZ0JBQVEsSUFBSSxzQ0FBc0M7QUFFbEQsY0FBTSxjQUFjLE9BQUE7QUFDcEIsZUFBTztBQUFBLE1BQ1Q7QUFHQSxZQUFNLFVBQVUsTUFBTSxjQUFjLE9BQUE7QUFFcEMsWUFBTSxjQUFjLFFBQVEsY0FDeEIsUUFBUSxZQUFZLFVBQVUsR0FBRyxHQUFJLElBQ3JDO0FBR0osWUFBTSxjQUFjLGNBQWM7QUFBQTtB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QUFFLENBQUM7QUFBQSxNQUN4RTtBQUNJLFlBQU0scUJBQXFCLEtBQUssc0JBQXNCLEtBQUssYUFBYTtBQUN4RSxhQUFPLENBQUMsQ0FBQyxvQkFBb0IsS0FBSyxDQUFDLFVBQVUsTUFBTSxLQUFLLElBQUksUUFBUSxDQUFDLEtBQUssbUJBQW1CLEtBQUssSUFBSSxRQUFRO0FBQUEsSUFDaEg7QUFBQSxJQUNBLFlBQVksS0FBSztBQUNmLFlBQU0sTUFBTSxxRUFBcUU7QUFBQSxJQUNuRjtBQUFBLElBQ0EsV0FBVyxLQUFLO0FBQ2QsWUFBTSxNQUFNLG9FQUFvRTtBQUFBLElBQ2xGO0FBQUEsSUFDQSxXQUFXLEtBQUs7QUFDZCxZQUFNLE1BQU0sb0VBQW9FO0FBQUEsSUFDbEY7QUFBQSxJQUNBLHNCQUFzQixTQUFTO0FBQzdCLFlBQU0sVUFBVSxLQUFLLGVBQWUsT0FBTztBQUMzQyxZQUFNLGdCQUFnQixRQUFRLFFBQVEsU0FBUyxJQUFJO0FBQ25ELGFBQU8sT0FBTyxJQUFJLGFBQWEsR0FBRztBQUFBLElBQ3BDO0FBQUEsSUFDQSxlQUFlLFFBQVE7QUFDckIsYUFBTyxPQUFPLFFBQVEsdUJBQXVCLE1BQU07QUFBQSxJQUNyRDtBQUFBLEVBQ0Y7QUFDQSxNQUFJLGVBQWU7QUFDbkIsZUFBYSxZQUFZLENBQUMsUUFBUSxTQUFTLFFBQVEsT0FBTyxLQUFLO0FBQy9ELE1BQUksc0JBQXNCLGNBQWMsTUFBTTtBQUFBLElBQzVDLFlBQVksY0FBYyxRQUFRO0FBQ2hDLFlBQU0sMEJBQTBCLFlBQVksTUFBTSxNQUFNLEVBQUU7QUFBQSxJQUM1RDtBQUFBLEVBQ0Y7QUFDQSxXQUFTLGlCQUFpQixjQUFjLFVBQVU7QUFDaEQsUUFBSSxDQUFDLGFBQWEsVUFBVSxTQUFTLFFBQVEsS0FBSyxhQUFhO0FBQzdELFlBQU0sSUFBSTtBQUFBLFFBQ1I7QUFBQSxRQUNBLEdBQUcsUUFBUSwwQkFBMEIsYUFBYSxVQUFVLEtBQUssSUFBSSxDQUFDO0FBQUEsTUFDNUU7QUFBQSxFQUNBO0FBQ0EsV0FBUyxpQkFBaUIsY0FBYyxVQUFVO0FBQ2hELFFBQUksU0FBUyxTQUFTLEdBQUc7QUFDdkIsWUFBTSxJQUFJLG9CQUFvQixjQUFjLGdDQUFnQztBQUM5RSxRQUFJLFNBQVMsU0FBUyxHQUFHLEtBQUssU0FBUyxTQUFTLEtBQUssQ0FBQyxTQUFTLFdBQVcsSUFBSTtBQUM1RSxZQUFNLElBQUk7QUFBQSxRQUNSO0FBQUEsUUFDQTtBQUFBLE1BQ047QUFBQSxFQUNBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMSwyLDVdfQ==
