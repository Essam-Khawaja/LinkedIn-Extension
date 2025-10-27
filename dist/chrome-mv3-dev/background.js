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
        console.warn("Gemini Nano not available");
        return null;
      }
      if (availability === "after-download") {
        console.log("Triggering Gemini Nano download...");
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
      console.log("AI Availability:", availability);
      if (availability === "no") {
        console.warn("Gemini Nano not available");
        return null;
      }
      if (availability === "after-download") {
        console.log("Triggering Gemini Nano download...");
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
      console.log("Raw AI Response:", result2);
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
    console.log("Background script initialized");
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case "SCRAPING_STARTED":
          console.log("SCRAPING_STARTED");
          isProcessing = true;
          browser.runtime.sendMessage({
            type: "SCRAPING_STARTED"
          }).catch(() => {
            console.log("Popup not open");
          });
          break;
        case "GET_PROFILE": {
          console.log("GET_PROFILE received");
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
              console.log("AI Result:", aiResult);
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
        case "SAVE_PROFILE": {
          console.log("SAVE_PROFILE received");
          (async () => {
            try {
              const profileData = message.data;
              if (!profileData.firstName || !profileData.lastName || !profileData.email) {
                sendResponse({
                  ok: false,
                  error: "Missing required fields: First Name, Last Name, Email"
                });
                return;
              }
              await chrome.storage.local.set({ profile: profileData });
              console.log("Profile saved successfully");
              sendResponse({ ok: true });
            } catch (err) {
              console.error("Error in SAVE_PROFILE:", err);
              sendResponse({ ok: false, error: err.toString() });
            }
          })();
          return true;
        }
        case "GENERATE_COVER_LETTER": {
          console.log("GENERATE_COVER_LETTER request received");
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
              console.log("Cover letter generated successfully");
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zcmMvbGliL2JhY2tncm91bmQtaGVscC9qb2Itc3VtbWFyaXplci50cyIsIi4uLy4uL3NyYy9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG4gIGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuICByZXR1cm4gYXJnO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiaW50ZXJmYWNlIFNraWxsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBtYXRjaDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSm9iRGF0YSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGNvbXBhbnk6IHN0cmluZztcbiAgbG9jYXRpb246IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzYWxhcnk6IHN0cmluZztcbiAgcG9zdGVkOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTY3JhcGVkRGF0YSB7XG4gIGpvYkRhdGE6IEpvYkRhdGE7XG4gIHJlcXVpcmVtZW50czogc3RyaW5nW107XG4gIHNraWxsczogU2tpbGxbXTtcbn1cblxuaW50ZXJmYWNlIFVzZXJQcm9maWxlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICBwaG9uZT86IHN0cmluZztcbiAgY3VycmVudFJvbGU/OiBzdHJpbmc7XG4gIHllYXJzRXhwZXJpZW5jZT86IHN0cmluZztcbiAgc2tpbGxzPzogc3RyaW5nW107XG4gIGFjaGlldmVtZW50cz86IHN0cmluZ1tdO1xufVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlQ292ZXJMZXR0ZXIoXG4gIGpvYkRhdGE6IEpvYkRhdGEsIFxuICBhbmFseXplZERhdGE6IFNjcmFwZWREYXRhLFxuICB1c2VyUHJvZmlsZT86IFVzZXJQcm9maWxlXG4pIHtcbiAgdHJ5IHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3QgYXZhaWxhYmlsaXR5ID0gYXdhaXQgTGFuZ3VhZ2VNb2RlbC5hdmFpbGFiaWxpdHkoKTtcblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdubycpIHtcbiAgICAgIGNvbnNvbGUud2FybihcIkdlbWluaSBOYW5vIG5vdCBhdmFpbGFibGVcIik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnYWZ0ZXItZG93bmxvYWQnKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIlRyaWdnZXJpbmcgR2VtaW5pIE5hbm8gZG93bmxvYWQuLi5cIik7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuXG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSBqb2JEYXRhLmRlc2NyaXB0aW9uIFxuICAgICAgPyBqb2JEYXRhLmRlc2NyaXB0aW9uLnN1YnN0cmluZygwLCAyMDAwKVxuICAgICAgOiAnTm8gZGVzY3JpcHRpb24gYXZhaWxhYmxlJztcblxuICAgIC8vIEJ1aWxkIHVzZXIgY29udGV4dCBpZiBwcm9maWxlIHByb3ZpZGVkXG4gICAgY29uc3QgdXNlckNvbnRleHQgPSB1c2VyUHJvZmlsZSA/IGBcblVzZXIgUHJvZmlsZTpcbi0gTmFtZTogJHt1c2VyUHJvZmlsZS5uYW1lIHx8ICdOb3QgcHJvdmlkZWQnfVxuLSBDdXJyZW50IFJvbGU6ICR7dXNlclByb2ZpbGUuY3VycmVudFJvbGUgfHwgJ05vdCBwcm92aWRlZCd9XG4tIFllYXJzIG9mIEV4cGVyaWVuY2U6ICR7dXNlclByb2ZpbGUueWVhcnNFeHBlcmllbmNlIHx8ICdOb3QgcHJvdmlkZWQnfVxuLSBLZXkgU2tpbGxzOiAke3VzZXJQcm9maWxlLnNraWxscz8uam9pbignLCAnKSB8fCAnTm90IHByb3ZpZGVkJ31cbi0gTm90YWJsZSBBY2hpZXZlbWVudHM6ICR7dXNlclByb2ZpbGUuYWNoaWV2ZW1lbnRzPy5qb2luKCc7ICcpIHx8ICdOb3QgcHJvdmlkZWQnfVxuYCA6ICcnO1xuXG4gICAgY29uc3Qga2V5UmVxdWlyZW1lbnRzID0gYW5hbHl6ZWREYXRhLnJlcXVpcmVtZW50cz8uc2xpY2UoMCwgNSkuam9pbignXFxuLSAnKSB8fCAnTm90IGFuYWx5emVkJztcbiAgICBjb25zdCBrZXlTa2lsbHMgPSBhbmFseXplZERhdGEuc2tpbGxzPy5zbGljZSgwLCA1KS5tYXAocyA9PiBzLm5hbWUpLmpvaW4oJywgJykgfHwgJ05vdCBhbmFseXplZCc7XG5cbiAgICBjb25zdCBwcm9tcHQgPSBgR2VuZXJhdGUgYSBwcm9mZXNzaW9uYWwgY292ZXIgbGV0dGVyIGZvciB0aGUgZm9sbG93aW5nIGpvYiBhcHBsaWNhdGlvbi5cblxuSm9iIERldGFpbHM6XG4tIFBvc2l0aW9uOiAke2pvYkRhdGEudGl0bGV9XG4tIENvbXBhbnk6ICR7am9iRGF0YS5jb21wYW55fVxuLSBMb2NhdGlvbjogJHtqb2JEYXRhLmxvY2F0aW9ufVxuXG5LZXkgUmVxdWlyZW1lbnRzIGZyb20gSm9iIFBvc3Rpbmc6XG4tICR7a2V5UmVxdWlyZW1lbnRzfVxuXG5LZXkgU2tpbGxzIE5lZWRlZDpcbiR7a2V5U2tpbGxzfVxuXG4ke3VzZXJDb250ZXh0fVxuXG5Kb2IgRGVzY3JpcHRpb24gU3VtbWFyeTpcbiR7ZGVzY3JpcHRpb259XG5cbkluc3RydWN0aW9uczpcbjEuIFdyaXRlIGEgcHJvZmVzc2lvbmFsLCBlbmdhZ2luZyBjb3ZlciBsZXR0ZXIgKDI1MC0zNTAgd29yZHMpXG4yLiBPcGVuIHdpdGggYSBzdHJvbmcgaG9vayB0aGF0IHNob3dzIGVudGh1c2lhc20gZm9yIHRoZSByb2xlXG4zLiBIaWdobGlnaHQgMi0zIHJlbGV2YW50IGV4cGVyaWVuY2VzIG9yIHNraWxscyB0aGF0IG1hdGNoIHRoZSBqb2IgcmVxdWlyZW1lbnRzXG40LiBTaG93IGtub3dsZWRnZSBvZiB0aGUgY29tcGFueSAoa2VlcCBpdCBicmllZiBhbmQgcHJvZmVzc2lvbmFsKVxuNS4gRXhwcmVzcyBnZW51aW5lIGludGVyZXN0IGluIGNvbnRyaWJ1dGluZyB0byB0aGUgdGVhbVxuNi4gQ2xvc2Ugd2l0aCBhIGNhbGwgdG8gYWN0aW9uXG43LiBVc2UgYSBwcm9mZXNzaW9uYWwgYnV0IHdhcm0gdG9uZVxuOC4gRE8gTk9UIHVzZSBvdmVybHkgZ2VuZXJpYyBwaHJhc2VzIGxpa2UgXCJJIGFtIHdyaXRpbmcgdG8gZXhwcmVzcyBteSBpbnRlcmVzdFwiXG45LiBCZSBzcGVjaWZpYyBhYm91dCBza2lsbHMgYW5kIGV4cGVyaWVuY2VzIHJhdGhlciB0aGFuIHZhZ3VlIGNsYWltc1xuMTAuIEtlZXAgcGFyYWdyYXBocyBjb25jaXNlIGFuZCBpbXBhY3RmdWxcblxuRm9ybWF0IHRoZSBsZXR0ZXIgd2l0aDpcbltEYXRlXVxuXG5bSGlyaW5nIE1hbmFnZXIvSGlyaW5nIFRlYW1dXG4ke2pvYkRhdGEuY29tcGFueX1cblxuW0JvZHkgcGFyYWdyYXBoc11cblxuU2luY2VyZWx5LFxuJHt1c2VyUHJvZmlsZT8ubmFtZSB8fCAnW1lvdXIgTmFtZV0nfVxuXG5SZXR1cm4gT05MWSB0aGUgY292ZXIgbGV0dGVyIHRleHQsIG5vIGFkZGl0aW9uYWwgY29tbWVudGFyeS5gO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc2Vzc2lvbi5wcm9tcHQocHJvbXB0KTtcbiAgICBjb25zb2xlLmxvZyhcIkdlbmVyYXRlZCBjb3ZlciBsZXR0ZXJcIik7XG5cbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICByZXR1cm4gcmVzdWx0LnRyaW0oKTtcblxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiQ292ZXIgbGV0dGVyIGdlbmVyYXRpb24gZXJyb3I6XCIsIGVycik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gYW5hbHl6ZUpvYldpdGhBSShqb2JEYXRhOiBhbnkpIHtcbiAgdHJ5IHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3QgYXZhaWxhYmlsaXR5ID0gYXdhaXQgTGFuZ3VhZ2VNb2RlbC5hdmFpbGFiaWxpdHkoKTtcbiAgICBjb25zb2xlLmxvZygnQUkgQXZhaWxhYmlsaXR5OicsIGF2YWlsYWJpbGl0eSk7XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnbm8nKSB7XG4gICAgICBjb25zb2xlLndhcm4oXCJHZW1pbmkgTmFubyBub3QgYXZhaWxhYmxlXCIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGF2YWlsYWJpbGl0eSA9PT0gJ2FmdGVyLWRvd25sb2FkJykge1xuICAgICAgY29uc29sZS5sb2coXCJUcmlnZ2VyaW5nIEdlbWluaSBOYW5vIGRvd25sb2FkLi4uXCIpO1xuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgYXdhaXQgTGFuZ3VhZ2VNb2RlbC5jcmVhdGUoKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgTGFuZ3VhZ2VNb2RlbC5jcmVhdGUoKTtcblxuICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gam9iRGF0YS5kZXNjcmlwdGlvbiBcbiAgICAgID8gam9iRGF0YS5kZXNjcmlwdGlvbi5zdWJzdHJpbmcoMCwgMTUwMClcbiAgICAgIDogJ05vIGRlc2NyaXB0aW9uIGF2YWlsYWJsZSc7XG5cbiAgICBjb25zdCBzY2hlbWEgPSB7XG4gICAgICB0eXBlOiBcIm9iamVjdFwiLFxuICAgICAgcmVxdWlyZWQ6IFtcImNsZWFuU3VtbWFyeVwiLCBcInNhbGFyeVwiLCBcInNraWxsc1wiLCBcInJlcXVpcmVtZW50c1wiXSxcbiAgICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgY2xlYW5TdW1tYXJ5OiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgc2FsYXJ5OiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgc2tpbGxzOiB7XG4gICAgICAgICAgdHlwZTogXCJhcnJheVwiLFxuICAgICAgICAgIGl0ZW1zOiB7XG4gICAgICAgICAgICB0eXBlOiBcIm9iamVjdFwiLFxuICAgICAgICAgICAgcmVxdWlyZWQ6IFtcIm5hbWVcIiwgXCJtYXRjaFwiXSxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgbmFtZTogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgICAgICAgIG1hdGNoOiB7IHR5cGU6IFwibnVtYmVyXCIgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZW1lbnRzOiB7dHlwZTogXCJhcnJheVwiLFxuICAgICAgICAgIGl0ZW1zOiB7XG4gICAgICAgICAgICB0eXBlOiBcInN0cmluZ1wiLFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgcHJvbXB0ID0gYEFuYWx5emUgdGhpcyBqb2IgcG9zdGluZyBhbmQgZXh0cmFjdCBrZXkgaW5mb3JtYXRpb24uXG5cbkpvYiBEZXRhaWxzOlxuLSBUaXRsZTogJHtqb2JEYXRhLnRpdGxlIHx8ICdVbmtub3duJ31cbi0gQ29tcGFueTogJHtqb2JEYXRhLmNvbXBhbnkgfHwgJ1Vua25vd24nfVxuLSBMb2NhdGlvbjogJHtqb2JEYXRhLmxvY2F0aW9uIHx8ICdOb3Qgc3BlY2lmaWVkJ31cbi0gVHlwZTogJHtqb2JEYXRhLnR5cGUgfHwgJ05vdCBzcGVjaWZpZWQnfVxuLSBDdXJyZW50IFNhbGFyeTogJHtqb2JEYXRhLnNhbGFyeSB8fCBcIk5vdCBzcGVjaWZpZWRcIn1cblxuRnVsbCBEZXNjcmlwdGlvbjpcbiR7ZGVzY3JpcHRpb259XG5cbklNUE9SVEFOVDogT25seSBleHRyYWN0IGluZm9ybWF0aW9uIHRoYXQgaXMgZXhwbGljaXRseSBzdGF0ZWQgaW4gdGhlIGRlc2NyaXB0aW9uLiBEbyBub3QgbWFrZSB1cCBvciBpbmZlciBpbmZvcm1hdGlvbi5cblxuUHJvdmlkZSBhIEpTT04gcmVzcG9uc2Ugd2l0aDpcbjEuIGNsZWFuU3VtbWFyeTogQSAyLTMgc2VudGVuY2UgY29uY2lzZSBzdW1tYXJ5IG9mIHRoZSByb2xlXG4yLiBzYWxhcnk6IEV4dHJhY3Qgc2FsYXJ5IGFzIFwiJFhYLFhYWCAtICRYWCxYWFhcIiBvciBcIk4vQVwiIGlmIG5vdCBtZW50aW9uZWRcbjMuIHJlcXVpcmVtZW50czogRXh0cmFjdCA1LTcga2V5IHF1YWxpZmljYXRpb25zL3JlcXVpcmVtZW50cyAocHJpb3JpdGl6ZSBiYXNpYyBxdWFsaWZpY2F0aW9ucylcbjQuIHNraWxsczogQXJyYXkgb2YgNS03IGtleSB0ZWNobmljYWwgc2tpbGxzIHdpdGggaW1wb3J0YW5jZSByYXRpbmcgKDAtMTAwKVxuXG5FeGFtcGxlIGZvcm1hdDpcbntcbiAgXCJjbGVhblN1bW1hcnlcIjogXCJTb2Z0d2FyZSBlbmdpbmVlciByb2xlIGZvY3VzaW5nIG9uLi4uXCIsXG4gIFwic2FsYXJ5XCI6IFwiJDgwLDAwMCAtICQxMjAsMDAwXCIsXG4gIFwicmVxdWlyZW1lbnRzXCI6IFtcIkJhY2hlbG9yJ3MgZGVncmVlIGluIENTXCIsIFwiMysgeWVhcnMgZXhwZXJpZW5jZVwiXSxcbiAgXCJza2lsbHNcIjogW3tcIm5hbWVcIjogXCJKYXZhU2NyaXB0XCIsIFwibWF0Y2hcIjogOTB9LCB7XCJuYW1lXCI6IFwiUmVhY3RcIiwgXCJtYXRjaFwiOiA4NX1dXG59XG5cblJldHVybiBPTkxZIHZhbGlkIEpTT04gbWF0Y2hpbmcgdGhpcyBzdHJ1Y3R1cmUuYDtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlc3Npb24ucHJvbXB0KHByb21wdCwge3Jlc3BvbnNlQ29uc3RyYWludDogc2NoZW1hfSk7XG4gICAgY29uc29sZS5sb2coXCJSYXcgQUkgUmVzcG9uc2U6XCIsIHJlc3VsdCk7XG5cbiAgICAgIGxldCBjbGVhbmVkUmVzdWx0ID0gcmVzdWx0LnRyaW0oKTtcbiAgICBcbiAgICAvLyBSZW1vdmUgYGBganNvbiBhbmQgYGBgIGlmIHByZXNlbnRcbiAgICBpZiAoY2xlYW5lZFJlc3VsdC5zdGFydHNXaXRoKCdgYGBqc29uJykpIHtcbiAgICAgIGNsZWFuZWRSZXN1bHQgPSBjbGVhbmVkUmVzdWx0LnJlcGxhY2UoL15gYGBqc29uXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqYGBgJC8sICcnKTtcbiAgICB9IGVsc2UgaWYgKGNsZWFuZWRSZXN1bHQuc3RhcnRzV2l0aCgnYGBgJykpIHtcbiAgICAgIGNsZWFuZWRSZXN1bHQgPSBjbGVhbmVkUmVzdWx0LnJlcGxhY2UoL15gYGBcXHMqLywgJycpLnJlcGxhY2UoL1xccypgYGAkLywgJycpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGNsZWFuZWRSZXN1bHQpO1xuICAgIFxuICAgIHNlc3Npb24uZGVzdHJveSgpO1xuICAgIHJldHVybiBwYXJzZWQ7XG5cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IHsgYW5hbHl6ZUpvYldpdGhBSSwgZ2VuZXJhdGVDb3ZlckxldHRlciB9O1xuIiwiaW1wb3J0IFVzZXJQcm9maWxlIGZyb20gJ0AvbGliL3R5cGVzL3VzZXInO1xuaW1wb3J0IHsgYW5hbHl6ZUpvYldpdGhBSSwgZ2VuZXJhdGVDb3ZlckxldHRlciB9IGZyb20gJy4uL2xpYi9iYWNrZ3JvdW5kLWhlbHAvam9iLXN1bW1hcml6ZXInXG5cbmludGVyZmFjZSBTa2lsbCB7XG4gIG5hbWU6IHN0cmluZztcbiAgbWF0Y2g6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIEpvYkRhdGEge1xuICB0aXRsZTogc3RyaW5nO1xuICBjb21wYW55OiBzdHJpbmc7XG4gIGxvY2F0aW9uOiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbiAgc2FsYXJ5OiBzdHJpbmc7XG4gIHBvc3RlZDogc3RyaW5nO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgU2NyYXBlZERhdGEge1xuICBqb2JEYXRhOiBKb2JEYXRhO1xuICByZXF1aXJlbWVudHM6IHN0cmluZ1tdO1xuICBza2lsbHM6IFNraWxsW107XG59XG5cbmxldCBsYXRlc3RTY3JhcGVkOiBTY3JhcGVkRGF0YSB8IG51bGwgPSBudWxsO1xubGV0IGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcbiAgY29uc29sZS5sb2coJ0JhY2tncm91bmQgc2NyaXB0IGluaXRpYWxpemVkJyk7XG5cbiAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIHN3aXRjaCAobWVzc2FnZS50eXBlKSB7XG4gICAgICBjYXNlICdTQ1JBUElOR19TVEFSVEVEJzpcbiAgICAgICAgY29uc29sZS5sb2coJ1NDUkFQSU5HX1NUQVJURUQnKTtcbiAgICAgICAgaXNQcm9jZXNzaW5nID0gdHJ1ZTtcbiAgICAgICAgXG4gICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgdHlwZTogJ1NDUkFQSU5HX1NUQVJURUQnLFxuICAgICAgICB9KS5jYXRjaCgoKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1BvcHVwIG5vdCBvcGVuJyk7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnR0VUX1BST0ZJTEUnOiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiR0VUX1BST0ZJTEUgcmVjZWl2ZWRcIik7XG4gICAgICAgIFxuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KCdwcm9maWxlJyk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnU2VuZGluZyBwcm9maWxlOicsIGRhdGEucHJvZmlsZSk7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogdHJ1ZSwgcHJvZmlsZTogZGF0YS5wcm9maWxlIH0pO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIEdFVF9QUk9GSUxFOlwiLCBlcnIpO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IGZhbHNlLCBlcnJvcjogZXJyIS50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkoKTtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIEtlZXAgY2hhbm5lbCBvcGVuXG4gICAgICB9XG5cbiAgICAgIGNhc2UgJ0pPQl9TQ1JBUEVEX0RBVEEnOiB7XG4gICAgICAgIGNvbnN0IHNjcmFwZWREYXRhID0gbWVzc2FnZS5kYXRhIGFzIFNjcmFwZWREYXRhO1xuICAgICAgICBjb25zb2xlLmxvZygn8J+TpiBKT0JfU0NSQVBFRF9EQVRBIHJlY2VpdmVkJyk7XG5cbiAgICAgICAgaWYgKHNjcmFwZWREYXRhPy5qb2JEYXRhLmRlc2NyaXB0aW9uICYmIHNjcmFwZWREYXRhLmpvYkRhdGEuZGVzY3JpcHRpb24ubGVuZ3RoID4gMTAwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1N0YXJ0aW5nIEFJIGFuYWx5c2lzLi4uJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgYW5hbHl6ZUpvYldpdGhBSShzY3JhcGVkRGF0YS5qb2JEYXRhKVxuICAgICAgICAgICAgLnRoZW4oYWlSZXN1bHQgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnQUkgUmVzdWx0OicsIGFpUmVzdWx0KTtcblxuICAgICAgICAgICAgICBpZiAoYWlSZXN1bHQpIHtcbiAgICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkID0ge1xuICAgICAgICAgICAgICAgICAgam9iRGF0YToge1xuICAgICAgICAgICAgICAgICAgICAuLi5zY3JhcGVkRGF0YS5qb2JEYXRhLFxuICAgICAgICAgICAgICAgICAgICBzYWxhcnk6IGFpUmVzdWx0LnNhbGFyeSB8fCBzY3JhcGVkRGF0YS5qb2JEYXRhLnNhbGFyeSxcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGFpUmVzdWx0LmNsZWFuU3VtbWFyeSB8fCBzY3JhcGVkRGF0YS5qb2JEYXRhLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHJlcXVpcmVtZW50czogYWlSZXN1bHQucmVxdWlyZW1lbnRzIHx8IFtdLFxuICAgICAgICAgICAgICAgICAgc2tpbGxzOiBhaVJlc3VsdC5za2lsbHMgfHwgW10sXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkID0gc2NyYXBlZERhdGE7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBpc1Byb2Nlc3NpbmcgPSBmYWxzZTtcblxuICAgICAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdSRUxBWUVEX0pPQl9TQ1JBUEVEX0RBVEEnLFxuICAgICAgICAgICAgICAgIGRhdGE6IGxhdGVzdFNjcmFwZWQsXG4gICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IGNvbnNvbGUubG9nKCdQb3B1cCBub3Qgb3BlbicpKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQUkgYW5hbHlzaXMgZXJyb3I6JywgZXJyKTtcbiAgICAgICAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IHNjcmFwZWREYXRhO1xuICAgICAgICAgICAgICBpc1Byb2Nlc3NpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ1JFTEFZRURfSk9CX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICAgICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gY29uc29sZS5sb2coJ1BvcHVwIG5vdCBvcGVuJykpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1NraXBwaW5nIEFJIChubyBkZXNjcmlwdGlvbiknKTtcbiAgICAgICAgICBsYXRlc3RTY3JhcGVkID0gc2NyYXBlZERhdGE7XG4gICAgICAgICAgaXNQcm9jZXNzaW5nID0gZmFsc2U7XG4gICAgICAgICAgXG4gICAgICAgICAgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgIHR5cGU6ICdSRUxBWUVEX0pPQl9TQ1JBUEVEX0RBVEEnLFxuICAgICAgICAgICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBjb25zb2xlLmxvZygnUG9wdXAgbm90IG9wZW4nKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNhc2UgJ1NBVkVfUFJPRklMRSc6IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJTQVZFX1BST0ZJTEUgcmVjZWl2ZWRcIik7XG4gICAgICAgIFxuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwcm9maWxlRGF0YSA9IG1lc3NhZ2UuZGF0YSBhcyBVc2VyUHJvZmlsZTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVmFsaWRhdGUgcmVxdWlyZWQgZmllbGRzXG4gICAgICAgICAgICBpZiAoIXByb2ZpbGVEYXRhLmZpcnN0TmFtZSB8fCAhcHJvZmlsZURhdGEubGFzdE5hbWUgfHwgIXByb2ZpbGVEYXRhLmVtYWlsKSB7XG4gICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IFxuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSwgXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkczogRmlyc3QgTmFtZSwgTGFzdCBOYW1lLCBFbWFpbCcgXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNhdmUgdG8gY2hyb21lLnN0b3JhZ2VcbiAgICAgICAgICAgIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IHByb2ZpbGU6IHByb2ZpbGVEYXRhIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUHJvZmlsZSBzYXZlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IHRydWUgfSk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gU0FWRV9QUk9GSUxFOlwiLCBlcnIpO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IGZhbHNlLCBlcnJvcjogZXJyIS50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkoKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNhc2UgJ0dFTkVSQVRFX0NPVkVSX0xFVFRFUic6IHtcbiAgICAgICAgY29uc29sZS5sb2coJ0dFTkVSQVRFX0NPVkVSX0xFVFRFUiByZXF1ZXN0IHJlY2VpdmVkJyk7XG4gICAgICAgIFxuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBHZXQgdXNlciBwcm9maWxlXG4gICAgICAgICAgICBjb25zdCB7IHByb2ZpbGUgfSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldCgncHJvZmlsZScpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXByb2ZpbGUpIHtcbiAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgXG4gICAgICAgICAgICAgICAgb2s6IGZhbHNlLCBcbiAgICAgICAgICAgICAgICBlcnJvcjogJ05vIHByb2ZpbGUgZm91bmQuIFBsZWFzZSBzZXQgdXAgeW91ciBwcm9maWxlIGZpcnN0LicgXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFVzZSBsYXRlc3Qgc2NyYXBlZCBkYXRhXG4gICAgICAgICAgICBpZiAoIWxhdGVzdFNjcmFwZWQpIHtcbiAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgXG4gICAgICAgICAgICAgICAgb2s6IGZhbHNlLCBcbiAgICAgICAgICAgICAgICBlcnJvcjogJ05vIGpvYiBkYXRhIGF2YWlsYWJsZS4gUGxlYXNlIG9wZW4gYSBqb2IgcG9zdGluZyBmaXJzdC4nIFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnR2VuZXJhdGluZyBjb3ZlciBsZXR0ZXIgd2l0aDonLCB7XG4gICAgICAgICAgICAgIGpvYjogbGF0ZXN0U2NyYXBlZC5qb2JEYXRhLnRpdGxlLFxuICAgICAgICAgICAgICB1c2VyOiBwcm9maWxlLmZpcnN0TmFtZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIEdlbmVyYXRlIHRoZSBjb3ZlciBsZXR0ZXJcbiAgICAgICAgICAgIGNvbnN0IGNvdmVyTGV0dGVyID0gYXdhaXQgZ2VuZXJhdGVDb3ZlckxldHRlcihcbiAgICAgICAgICAgICAgbGF0ZXN0U2NyYXBlZC5qb2JEYXRhLFxuICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkLFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogYCR7cHJvZmlsZS5maXJzdE5hbWV9ICR7cHJvZmlsZS5sYXN0TmFtZX1gLFxuICAgICAgICAgICAgICAgIGVtYWlsOiBwcm9maWxlLmVtYWlsLFxuICAgICAgICAgICAgICAgIHBob25lOiBwcm9maWxlLnBob25lLFxuICAgICAgICAgICAgICAgIGN1cnJlbnRSb2xlOiBwcm9maWxlLmN1cnJlbnRUaXRsZSxcbiAgICAgICAgICAgICAgICB5ZWFyc0V4cGVyaWVuY2U6IHByb2ZpbGUueWVhcnNFeHBlcmllbmNlPy50b1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHNraWxsczogW10sIC8vIFlvdSBjYW4gYWRkIHNraWxscyB0byBwcm9maWxlIGlmIG5lZWRlZFxuICAgICAgICAgICAgICAgIGFjaGlldmVtZW50czogW11cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaWYgKCFjb3ZlckxldHRlcikge1xuICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBcbiAgICAgICAgICAgICAgICBvazogZmFsc2UsIFxuICAgICAgICAgICAgICAgIGVycm9yOiAnRmFpbGVkIHRvIGdlbmVyYXRlIGNvdmVyIGxldHRlci4gQUkgbWF5IG5vdCBiZSBhdmFpbGFibGUuJyBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0NvdmVyIGxldHRlciBnZW5lcmF0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBcbiAgICAgICAgICAgICAgb2s6IHRydWUsIFxuICAgICAgICAgICAgICBjb3ZlckxldHRlcjogY292ZXJMZXR0ZXIgXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ292ZXIgbGV0dGVyIGdlbmVyYXRpb24gZXJyb3I6JywgZXJyKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IFxuICAgICAgICAgICAgICBvazogZmFsc2UsIFxuICAgICAgICAgICAgICBlcnJvcjogZXJyIS50b1N0cmluZygpIFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KSgpO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIEtlZXAgY2hhbm5lbCBvcGVuIGZvciBhc3luYyByZXNwb25zZVxuICAgICAgfVxuXG4gICAgICBjYXNlICdHRVRfTEFURVNUX0pPQl9TQ1JBUEVEJzpcbiAgICAgICAgY29uc29sZS5sb2coJ1NlbmRpbmcgZGF0YSB0byBwb3B1cDonLCB7IGhhc0RhdGE6ICEhbGF0ZXN0U2NyYXBlZCwgaXNQcm9jZXNzaW5nIH0pO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBkYXRhOiBsYXRlc3RTY3JhcGVkLCBpc1Byb2Nlc3NpbmcgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH0pO1xufSk7IiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJuYW1lcyI6WyJicm93c2VyIiwiX2Jyb3dzZXIiLCJyZXN1bHQiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxpQkFBaUIsS0FBSztBQUNwQyxRQUFJLE9BQU8sUUFBUSxPQUFPLFFBQVEsV0FBWSxRQUFPLEVBQUUsTUFBTSxJQUFHO0FBQ2hFLFdBQU87QUFBQSxFQUNUO0FDRk8sUUFBTUEsWUFBVSxXQUFXLFNBQVMsU0FBUyxLQUNoRCxXQUFXLFVBQ1gsV0FBVztBQ0ZSLFFBQU0sVUFBVUM7QUMrQnZCLGlCQUFlLG9CQUNiLFNBQ0EsY0FDQSxhQUNBO0FBQ0EsUUFBSTtBQUVGLFlBQU0sZUFBZSxNQUFNLGNBQWMsYUFBQTtBQUV6QyxVQUFJLGlCQUFpQixNQUFNO0FBQ3pCLGdCQUFRLEtBQUssMkJBQTJCO0FBQ3hDLGVBQU87QUFBQSxNQUNUO0FBRUEsVUFBSSxpQkFBaUIsa0JBQWtCO0FBQ3JDLGdCQUFRLElBQUksb0NBQW9DO0FBRWhELGNBQU0sY0FBYyxPQUFBO0FBQ3BCLGVBQU87QUFBQSxNQUNUO0FBR0EsWUFBTSxVQUFVLE1BQU0sY0FBYyxPQUFBO0FBRXBD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
