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
- Name: ${userProfile.firstName} ${userProfile.lastName}
- Contact: ${userProfile.email} | ${userProfile.phone}
- Location: ${userProfile.city}, ${userProfile.state} ${userProfile.zip}
- Years of Experience: ${userProfile.yearsExperience} years
- Key Skills: ${userProfile.skills?.join(", ") || "Not provided"}
${userProfile.certifications?.length ? `- Certifications: ${userProfile.certifications.join(", ")}` : ""}
${userProfile.education ? `- Education: ${userProfile.education}` : ""}
${userProfile.linkedin ? `- LinkedIn: ${userProfile.linkedin}` : ""}
${userProfile.github ? `- GitHub: ${userProfile.github}` : ""}
${userProfile.portfolio ? `- Portfolio: ${userProfile.portfolio}` : ""}
${userProfile.salaryExpectation ? `- Salary Expectation: ${userProfile.salaryExpectation}` : ""}
${userProfile.needsSponsorship ? "- Note: Requires visa sponsorship" : ""}
${userProfile.willingToRelocate ? "- Willing to relocate" : "- Prefers local opportunities"}

${userProfile.resumeSummary ? `Professional Summary:
${userProfile.resumeSummary}
` : ""}

${userProfile.employmentHistory?.length ? `Recent Employment History:
${userProfile.employmentHistory.slice(0, 3).map(
        (job) => `- ${job.jobTitle} at ${job.company} (${job.startDate} - ${job.isCurrent ? "Present" : job.endDate || "N/A"})${job.description ? "\n  " + job.description : ""}`
      ).join("\n")}` : ""}
` : "";
      const keyRequirements = analyzedData.requirements?.slice(0, 5).join("\n- ") || "Not analyzed";
      const keySkills = analyzedData.skills?.slice(0, 5).map((s) => s.name).join(", ") || "Not analyzed";
      const prompt = `Generate a professional cover letter for the following job application.

Job Details:
- Position: ${jobData.title}
- Company: ${jobData.company}
- Location: ${jobData.location}
- Job Type: ${jobData.type}
${jobData.salary !== "N/A" ? `- Salary Range: ${jobData.salary}` : ""}

Key Requirements from Job Posting:
- ${keyRequirements}

Key Skills Needed:
${keySkills}

${userContext}

Job Description Summary:
${description}

Instructions:
1. Write a professional, engaging cover letter (300-400 words)
2. Open with a strong hook that shows genuine enthusiasm and explains why this specific role interests you
3. Highlight 2-3 relevant experiences from employment history that directly match job requirements
4. Reference specific skills from the user's profile that align with the job needs
5. If user has relevant certifications or education, weave them naturally into the narrative
6. Show knowledge of ${jobData.company} and explain why you want to work there specifically
7. Address any important considerations (sponsorship needs, relocation willingness) naturally if relevant
8. Express genuine interest in contributing to the team's goals
9. Close with a confident call to action
10. Use a professional but warm, conversational tone
11. DO NOT use generic opening lines like "I am writing to express my interest"
12. Be specific about experiences and achievements rather than vague claims
13. Quantify achievements when possible based on employment descriptions
14. Keep paragraphs concise and impactful (3-4 sentences each)
15. Ensure the letter tells a cohesive story about why this candidate is perfect for this role

Format the letter with proper business letter structure:

${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}

Hiring Manager
${jobData.company}
${jobData.location}

[Body paragraphs - 3-4 paragraphs total]

Sincerely,
${userProfile?.firstName || "[Your Name]"} ${userProfile?.lastName || "[Last Name]"}
${userProfile?.email || "[Your Email]"}
${userProfile?.phone || "[Your Phone]"}

Return ONLY the cover letter text, no additional commentary or explanation.`;
      const result2 = await session.prompt(prompt);
      console.log("Generated cover letter");
      session.destroy();
      return result2.trim();
    } catch (err) {
      console.error("Cover letter generation error:", err);
      return null;
    }
  }
  async function analyzeJobWithAI(jobData, userProfile) {
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
      const userSkillsContext = userProfile?.skills?.length ? `

User's Skills for Match Calculation:
${userProfile.skills.join(", ")}

When calculating skill match percentages, compare the job's required skills against the user's skills listed above. Give higher match scores (80-100%) for exact or closely related matches, medium scores (50-79%) for transferable skills, and lower scores (20-49%) for skills the user doesn't have.` : "";
      const prompt = `Analyze this job posting and extract key information.

Job Details:
- Title: ${jobData.title || "Unknown"}
- Company: ${jobData.company || "Unknown"}
- Location: ${jobData.location || "Not specified"}
- Type: ${jobData.type || "Not specified"}
- Current Salary: ${jobData.salary || "Not specified"}

Full Description:
${description}${userSkillsContext}

IMPORTANT: Only extract information that is explicitly stated in the description. Do not make up or infer information.

Provide a JSON response with:
1. cleanSummary: A 2-3 sentence concise summary of the role and its main focus areas
2. salary: Extract salary as "$XX,XXX - $XX,XXX" or "N/A" if not mentioned. Look for annual salary, hourly rates, or compensation ranges.
3. requirements: Extract 6-8 key qualifications/requirements from the job posting. Prioritize:
   - Educational requirements
   - Years of experience needed
   - Must-have technical skills
   - Certifications or licenses required
   - Key soft skills mentioned
4. skills: Array of 6-8 key technical/professional skills mentioned in the job posting with match ratings:
   - If user skills are provided, calculate match based on overlap with user's skill set
   - If no user skills provided, estimate general importance/demand (0-100)
   - Prioritize skills explicitly mentioned in the job requirements

Example format:
{
  "cleanSummary": "Software engineer role focusing on full-stack development with React and Node.js, working on customer-facing products in a fast-paced environment.",
  "salary": "$90,000 - $130,000",
  "requirements": [
    "Bachelor's degree in Computer Science or related field",
    "3+ years of professional software development experience",
    "Strong proficiency in JavaScript/TypeScript",
    "Experience with React and modern frontend frameworks",
    "Familiarity with RESTful APIs and microservices",
    "Excellent problem-solving and communication skills"
  ],
  "skills": [
    {"name": "React", "match": 90},
    {"name": "TypeScript", "match": 85},
    {"name": "Node.js", "match": 80},
    {"name": "REST APIs", "match": 75},
    {"name": "Git", "match": 70},
    {"name": "SQL", "match": 65}
  ]
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
      console.error("AI analysis error:", err);
      return null;
    }
  }
  let latestScraped = null;
  let isProcessing = false;
  let cachedProfile = null;
  const definition = defineBackground(() => {
    console.log("Background script initialized");
    chrome.storage.local.get("profile").then((data) => {
      if (data.profile) {
        cachedProfile = data.profile;
        console.log("Profile loaded on startup");
      }
    });
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.profile) {
        cachedProfile = changes.profile.newValue;
        console.log("Profile cache updated");
      }
    });
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
              if (cachedProfile) {
                sendResponse({ ok: true, profile: cachedProfile });
                return;
              }
              const data = await chrome.storage.local.get("profile");
              cachedProfile = data.profile || null;
              console.log("Sending profile:", cachedProfile);
              sendResponse({ ok: true, profile: cachedProfile });
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
            console.log("Starting AI analysis with user profile...");
            analyzeJobWithAI(scrapedData.jobData, cachedProfile || void 0).then((aiResult) => {
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
              if (!profileData.phone || !profileData.city || !profileData.state) {
                sendResponse({
                  ok: false,
                  error: "Missing required fields: Phone, City, State"
                });
                return;
              }
              if (!profileData.skills || profileData.skills.length === 0) {
                sendResponse({
                  ok: false,
                  error: "Please add at least one skill to your profile"
                });
                return;
              }
              await chrome.storage.local.set({ profile: profileData });
              cachedProfile = profileData;
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
              let profile = cachedProfile;
              if (!profile) {
                const { profile: storedProfile } = await chrome.storage.local.get("profile");
                profile = storedProfile;
                cachedProfile = profile;
              }
              if (!profile) {
                sendResponse({
                  ok: false,
                  error: "No profile found. Please set up your profile first in the Settings tab."
                });
                return;
              }
              if (!profile.skills || profile.skills.length === 0) {
                sendResponse({
                  ok: false,
                  error: "Your profile needs at least one skill listed. Please update your profile in Settings."
                });
                return;
              }
              if (!profile.resumeSummary && (!profile.employmentHistory || profile.employmentHistory.length === 0)) {
                sendResponse({
                  ok: false,
                  error: "Please add either a resume summary or employment history to your profile for better cover letters."
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
                user: `${profile.firstName} ${profile.lastName}`,
                skills: profile.skills?.length || 0,
                experience: profile.yearsExperience
              });
              const coverLetter = await generateCoverLetter(
                latestScraped.jobData,
                latestScraped,
                profile
              );
              if (!coverLetter) {
                sendResponse({
                  ok: false,
                  error: "Failed to generate cover letter. AI may not be available or still downloading."
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
                error: `Failed to generate: ${err.toString()}`
              });
            }
          })();
          return true;
        }
        case "GET_LATEST_JOB_SCRAPED":
          console.log("Sending data to popup:", {
            hasData: !!latestScraped,
            isProcessing,
            hasProfile: !!cachedProfile
          });
          sendResponse({
            data: latestScraped,
            isProcessing,
            hasProfile: !!cachedProfile
          });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zcmMvbGliL2JhY2tncm91bmQtaGVscC9qb2Itc3VtbWFyaXplci50cyIsIi4uLy4uL3NyYy9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG4gIGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuICByZXR1cm4gYXJnO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiaW50ZXJmYWNlIFNraWxsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBtYXRjaDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSm9iRGF0YSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGNvbXBhbnk6IHN0cmluZztcbiAgbG9jYXRpb246IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzYWxhcnk6IHN0cmluZztcbiAgcG9zdGVkOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTY3JhcGVkRGF0YSB7XG4gIGpvYkRhdGE6IEpvYkRhdGE7XG4gIHJlcXVpcmVtZW50czogc3RyaW5nW107XG4gIHNraWxsczogU2tpbGxbXTtcbn1cblxuaW50ZXJmYWNlIEVtcGxveW1lbnRFbnRyeSB7XG4gIGlkOiBzdHJpbmc7XG4gIGpvYlRpdGxlOiBzdHJpbmc7XG4gIGNvbXBhbnk6IHN0cmluZztcbiAgc3RhcnREYXRlOiBzdHJpbmc7XG4gIGVuZERhdGU/OiBzdHJpbmc7XG4gIGlzQ3VycmVudDogYm9vbGVhbjtcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBVc2VyUHJvZmlsZSB7XG4gIGZpcnN0TmFtZTogc3RyaW5nO1xuICBsYXN0TmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICBwaG9uZTogc3RyaW5nO1xuICBhZGRyZXNzOiBzdHJpbmc7XG4gIGNpdHk6IHN0cmluZztcbiAgc3RhdGU6IHN0cmluZztcbiAgemlwOiBzdHJpbmc7XG4gIHllYXJzRXhwZXJpZW5jZTogbnVtYmVyO1xuICBza2lsbHM6IHN0cmluZ1tdO1xuICBlbXBsb3ltZW50SGlzdG9yeT86IEVtcGxveW1lbnRFbnRyeVtdO1xuICBlZHVjYXRpb24/OiBzdHJpbmc7XG4gIHJlc3VtZVN1bW1hcnk/OiBzdHJpbmc7XG4gIGNlcnRpZmljYXRpb25zPzogc3RyaW5nW107XG4gIHNhbGFyeUV4cGVjdGF0aW9uPzogc3RyaW5nO1xuICBsaW5rZWRpbjogc3RyaW5nO1xuICBwb3J0Zm9saW8/OiBzdHJpbmc7XG4gIGdpdGh1Yj86IHN0cmluZztcbiAgbmVlZHNTcG9uc29yc2hpcDogYm9vbGVhbjtcbiAgd2lsbGluZ1RvUmVsb2NhdGU6IGJvb2xlYW47XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlQ292ZXJMZXR0ZXIoXG4gIGpvYkRhdGE6IEpvYkRhdGEsIFxuICBhbmFseXplZERhdGE6IFNjcmFwZWREYXRhLFxuICB1c2VyUHJvZmlsZT86IFVzZXJQcm9maWxlXG4pIHtcbiAgdHJ5IHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3QgYXZhaWxhYmlsaXR5ID0gYXdhaXQgTGFuZ3VhZ2VNb2RlbC5hdmFpbGFiaWxpdHkoKTtcblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdubycpIHtcbiAgICAgIGNvbnNvbGUud2FybihcIkdlbWluaSBOYW5vIG5vdCBhdmFpbGFibGVcIik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnYWZ0ZXItZG93bmxvYWQnKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIlRyaWdnZXJpbmcgR2VtaW5pIE5hbm8gZG93bmxvYWQuLi5cIik7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuXG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSBqb2JEYXRhLmRlc2NyaXB0aW9uIFxuICAgICAgPyBqb2JEYXRhLmRlc2NyaXB0aW9uLnN1YnN0cmluZygwLCAyMDAwKVxuICAgICAgOiAnTm8gZGVzY3JpcHRpb24gYXZhaWxhYmxlJztcblxuICAgIC8vIEJ1aWxkIGNvbXByZWhlbnNpdmUgdXNlciBjb250ZXh0XG4gICAgY29uc3QgdXNlckNvbnRleHQgPSB1c2VyUHJvZmlsZSA/IGBcblVzZXIgUHJvZmlsZTpcbi0gTmFtZTogJHt1c2VyUHJvZmlsZS5maXJzdE5hbWV9ICR7dXNlclByb2ZpbGUubGFzdE5hbWV9XG4tIENvbnRhY3Q6ICR7dXNlclByb2ZpbGUuZW1haWx9IHwgJHt1c2VyUHJvZmlsZS5waG9uZX1cbi0gTG9jYXRpb246ICR7dXNlclByb2ZpbGUuY2l0eX0sICR7dXNlclByb2ZpbGUuc3RhdGV9ICR7dXNlclByb2ZpbGUuemlwfVxuLSBZZWFycyBvZiBFeHBlcmllbmNlOiAke3VzZXJQcm9maWxlLnllYXJzRXhwZXJpZW5jZX0geWVhcnNcbi0gS2V5IFNraWxsczogJHt1c2VyUHJvZmlsZS5za2lsbHM/LmpvaW4oJywgJykgfHwgJ05vdCBwcm92aWRlZCd9XG4ke3VzZXJQcm9maWxlLmNlcnRpZmljYXRpb25zPy5sZW5ndGggPyBgLSBDZXJ0aWZpY2F0aW9uczogJHt1c2VyUHJvZmlsZS5jZXJ0aWZpY2F0aW9ucy5qb2luKCcsICcpfWAgOiAnJ31cbiR7dXNlclByb2ZpbGUuZWR1Y2F0aW9uID8gYC0gRWR1Y2F0aW9uOiAke3VzZXJQcm9maWxlLmVkdWNhdGlvbn1gIDogJyd9XG4ke3VzZXJQcm9maWxlLmxpbmtlZGluID8gYC0gTGlua2VkSW46ICR7dXNlclByb2ZpbGUubGlua2VkaW59YCA6ICcnfVxuJHt1c2VyUHJvZmlsZS5naXRodWIgPyBgLSBHaXRIdWI6ICR7dXNlclByb2ZpbGUuZ2l0aHVifWAgOiAnJ31cbiR7dXNlclByb2ZpbGUucG9ydGZvbGlvID8gYC0gUG9ydGZvbGlvOiAke3VzZXJQcm9maWxlLnBvcnRmb2xpb31gIDogJyd9XG4ke3VzZXJQcm9maWxlLnNhbGFyeUV4cGVjdGF0aW9uID8gYC0gU2FsYXJ5IEV4cGVjdGF0aW9uOiAke3VzZXJQcm9maWxlLnNhbGFyeUV4cGVjdGF0aW9ufWAgOiAnJ31cbiR7dXNlclByb2ZpbGUubmVlZHNTcG9uc29yc2hpcCA/ICctIE5vdGU6IFJlcXVpcmVzIHZpc2Egc3BvbnNvcnNoaXAnIDogJyd9XG4ke3VzZXJQcm9maWxlLndpbGxpbmdUb1JlbG9jYXRlID8gJy0gV2lsbGluZyB0byByZWxvY2F0ZScgOiAnLSBQcmVmZXJzIGxvY2FsIG9wcG9ydHVuaXRpZXMnfVxuXG4ke3VzZXJQcm9maWxlLnJlc3VtZVN1bW1hcnkgPyBgUHJvZmVzc2lvbmFsIFN1bW1hcnk6XFxuJHt1c2VyUHJvZmlsZS5yZXN1bWVTdW1tYXJ5fVxcbmAgOiAnJ31cblxuJHt1c2VyUHJvZmlsZS5lbXBsb3ltZW50SGlzdG9yeT8ubGVuZ3RoID8gYFJlY2VudCBFbXBsb3ltZW50IEhpc3Rvcnk6XG4ke3VzZXJQcm9maWxlLmVtcGxveW1lbnRIaXN0b3J5LnNsaWNlKDAsIDMpLm1hcChqb2IgPT4gXG4gIGAtICR7am9iLmpvYlRpdGxlfSBhdCAke2pvYi5jb21wYW55fSAoJHtqb2Iuc3RhcnREYXRlfSAtICR7am9iLmlzQ3VycmVudCA/ICdQcmVzZW50JyA6IGpvYi5lbmREYXRlIHx8ICdOL0EnfSkke2pvYi5kZXNjcmlwdGlvbiA/ICdcXG4gICcgKyBqb2IuZGVzY3JpcHRpb24gOiAnJ31gXG4pLmpvaW4oJ1xcbicpfWAgOiAnJ31cbmAgOiAnJztcblxuICAgIGNvbnN0IGtleVJlcXVpcmVtZW50cyA9IGFuYWx5emVkRGF0YS5yZXF1aXJlbWVudHM/LnNsaWNlKDAsIDUpLmpvaW4oJ1xcbi0gJykgfHwgJ05vdCBhbmFseXplZCc7XG4gICAgY29uc3Qga2V5U2tpbGxzID0gYW5hbHl6ZWREYXRhLnNraWxscz8uc2xpY2UoMCwgNSkubWFwKHMgPT4gcy5uYW1lKS5qb2luKCcsICcpIHx8ICdOb3QgYW5hbHl6ZWQnO1xuXG4gICAgY29uc3QgcHJvbXB0ID0gYEdlbmVyYXRlIGEgcHJvZmVzc2lvbmFsIGNvdmVyIGxldHRlciBmb3IgdGhlIGZvbGxvd2luZyBqb2IgYXBwbGljYXRpb24uXG5cbkpvYiBEZXRhaWxzOlxuLSBQb3NpdGlvbjogJHtqb2JEYXRhLnRpdGxlfVxuLSBDb21wYW55OiAke2pvYkRhdGEuY29tcGFueX1cbi0gTG9jYXRpb246ICR7am9iRGF0YS5sb2NhdGlvbn1cbi0gSm9iIFR5cGU6ICR7am9iRGF0YS50eXBlfVxuJHtqb2JEYXRhLnNhbGFyeSAhPT0gJ04vQScgPyBgLSBTYWxhcnkgUmFuZ2U6ICR7am9iRGF0YS5zYWxhcnl9YCA6ICcnfVxuXG5LZXkgUmVxdWlyZW1lbnRzIGZyb20gSm9iIFBvc3Rpbmc6XG4tICR7a2V5UmVxdWlyZW1lbnRzfVxuXG5LZXkgU2tpbGxzIE5lZWRlZDpcbiR7a2V5U2tpbGxzfVxuXG4ke3VzZXJDb250ZXh0fVxuXG5Kb2IgRGVzY3JpcHRpb24gU3VtbWFyeTpcbiR7ZGVzY3JpcHRpb259XG5cbkluc3RydWN0aW9uczpcbjEuIFdyaXRlIGEgcHJvZmVzc2lvbmFsLCBlbmdhZ2luZyBjb3ZlciBsZXR0ZXIgKDMwMC00MDAgd29yZHMpXG4yLiBPcGVuIHdpdGggYSBzdHJvbmcgaG9vayB0aGF0IHNob3dzIGdlbnVpbmUgZW50aHVzaWFzbSBhbmQgZXhwbGFpbnMgd2h5IHRoaXMgc3BlY2lmaWMgcm9sZSBpbnRlcmVzdHMgeW91XG4zLiBIaWdobGlnaHQgMi0zIHJlbGV2YW50IGV4cGVyaWVuY2VzIGZyb20gZW1wbG95bWVudCBoaXN0b3J5IHRoYXQgZGlyZWN0bHkgbWF0Y2ggam9iIHJlcXVpcmVtZW50c1xuNC4gUmVmZXJlbmNlIHNwZWNpZmljIHNraWxscyBmcm9tIHRoZSB1c2VyJ3MgcHJvZmlsZSB0aGF0IGFsaWduIHdpdGggdGhlIGpvYiBuZWVkc1xuNS4gSWYgdXNlciBoYXMgcmVsZXZhbnQgY2VydGlmaWNhdGlvbnMgb3IgZWR1Y2F0aW9uLCB3ZWF2ZSB0aGVtIG5hdHVyYWxseSBpbnRvIHRoZSBuYXJyYXRpdmVcbjYuIFNob3cga25vd2xlZGdlIG9mICR7am9iRGF0YS5jb21wYW55fSBhbmQgZXhwbGFpbiB3aHkgeW91IHdhbnQgdG8gd29yayB0aGVyZSBzcGVjaWZpY2FsbHlcbjcuIEFkZHJlc3MgYW55IGltcG9ydGFudCBjb25zaWRlcmF0aW9ucyAoc3BvbnNvcnNoaXAgbmVlZHMsIHJlbG9jYXRpb24gd2lsbGluZ25lc3MpIG5hdHVyYWxseSBpZiByZWxldmFudFxuOC4gRXhwcmVzcyBnZW51aW5lIGludGVyZXN0IGluIGNvbnRyaWJ1dGluZyB0byB0aGUgdGVhbSdzIGdvYWxzXG45LiBDbG9zZSB3aXRoIGEgY29uZmlkZW50IGNhbGwgdG8gYWN0aW9uXG4xMC4gVXNlIGEgcHJvZmVzc2lvbmFsIGJ1dCB3YXJtLCBjb252ZXJzYXRpb25hbCB0b25lXG4xMS4gRE8gTk9UIHVzZSBnZW5lcmljIG9wZW5pbmcgbGluZXMgbGlrZSBcIkkgYW0gd3JpdGluZyB0byBleHByZXNzIG15IGludGVyZXN0XCJcbjEyLiBCZSBzcGVjaWZpYyBhYm91dCBleHBlcmllbmNlcyBhbmQgYWNoaWV2ZW1lbnRzIHJhdGhlciB0aGFuIHZhZ3VlIGNsYWltc1xuMTMuIFF1YW50aWZ5IGFjaGlldmVtZW50cyB3aGVuIHBvc3NpYmxlIGJhc2VkIG9uIGVtcGxveW1lbnQgZGVzY3JpcHRpb25zXG4xNC4gS2VlcCBwYXJhZ3JhcGhzIGNvbmNpc2UgYW5kIGltcGFjdGZ1bCAoMy00IHNlbnRlbmNlcyBlYWNoKVxuMTUuIEVuc3VyZSB0aGUgbGV0dGVyIHRlbGxzIGEgY29oZXNpdmUgc3RvcnkgYWJvdXQgd2h5IHRoaXMgY2FuZGlkYXRlIGlzIHBlcmZlY3QgZm9yIHRoaXMgcm9sZVxuXG5Gb3JtYXQgdGhlIGxldHRlciB3aXRoIHByb3BlciBidXNpbmVzcyBsZXR0ZXIgc3RydWN0dXJlOlxuXG4ke25ldyBEYXRlKCkudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1VUycsIHsgbW9udGg6ICdsb25nJywgZGF5OiAnbnVtZXJpYycsIHllYXI6ICdudW1lcmljJyB9KX1cblxuSGlyaW5nIE1hbmFnZXJcbiR7am9iRGF0YS5jb21wYW55fVxuJHtqb2JEYXRhLmxvY2F0aW9ufVxuXG5bQm9keSBwYXJhZ3JhcGhzIC0gMy00IHBhcmFncmFwaHMgdG90YWxdXG5cblNpbmNlcmVseSxcbiR7dXNlclByb2ZpbGU/LmZpcnN0TmFtZSB8fCAnW1lvdXIgTmFtZV0nfSAke3VzZXJQcm9maWxlPy5sYXN0TmFtZSB8fCAnW0xhc3QgTmFtZV0nfVxuJHt1c2VyUHJvZmlsZT8uZW1haWwgfHwgJ1tZb3VyIEVtYWlsXSd9XG4ke3VzZXJQcm9maWxlPy5waG9uZSB8fCAnW1lvdXIgUGhvbmVdJ31cblxuUmV0dXJuIE9OTFkgdGhlIGNvdmVyIGxldHRlciB0ZXh0LCBubyBhZGRpdGlvbmFsIGNvbW1lbnRhcnkgb3IgZXhwbGFuYXRpb24uYDtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlc3Npb24ucHJvbXB0KHByb21wdCk7XG4gICAgY29uc29sZS5sb2coXCJHZW5lcmF0ZWQgY292ZXIgbGV0dGVyXCIpO1xuXG4gICAgc2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgcmV0dXJuIHJlc3VsdC50cmltKCk7XG5cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkNvdmVyIGxldHRlciBnZW5lcmF0aW9uIGVycm9yOlwiLCBlcnIpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFuYWx5emVKb2JXaXRoQUkoam9iRGF0YTogYW55LCB1c2VyUHJvZmlsZT86IFVzZXJQcm9maWxlKSB7XG4gIHRyeSB7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IGF2YWlsYWJpbGl0eSA9IGF3YWl0IExhbmd1YWdlTW9kZWwuYXZhaWxhYmlsaXR5KCk7XG4gICAgY29uc29sZS5sb2coJ0FJIEF2YWlsYWJpbGl0eTonLCBhdmFpbGFiaWxpdHkpO1xuXG4gICAgaWYgKGF2YWlsYWJpbGl0eSA9PT0gJ25vJykge1xuICAgICAgY29uc29sZS53YXJuKFwiR2VtaW5pIE5hbm8gbm90IGF2YWlsYWJsZVwiKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdhZnRlci1kb3dubG9hZCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiVHJpZ2dlcmluZyBHZW1pbmkgTmFubyBkb3dubG9hZC4uLlwiKTtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG5cbiAgICBjb25zdCBkZXNjcmlwdGlvbiA9IGpvYkRhdGEuZGVzY3JpcHRpb24gXG4gICAgICA/IGpvYkRhdGEuZGVzY3JpcHRpb24uc3Vic3RyaW5nKDAsIDE1MDApXG4gICAgICA6ICdObyBkZXNjcmlwdGlvbiBhdmFpbGFibGUnO1xuXG4gICAgY29uc3Qgc2NoZW1hID0ge1xuICAgICAgdHlwZTogXCJvYmplY3RcIixcbiAgICAgIHJlcXVpcmVkOiBbXCJjbGVhblN1bW1hcnlcIiwgXCJzYWxhcnlcIiwgXCJza2lsbHNcIiwgXCJyZXF1aXJlbWVudHNcIl0sXG4gICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIGNsZWFuU3VtbWFyeTogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgIHNhbGFyeTogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgIHNraWxsczoge1xuICAgICAgICAgIHR5cGU6IFwiYXJyYXlcIixcbiAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgdHlwZTogXCJvYmplY3RcIixcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbXCJuYW1lXCIsIFwibWF0Y2hcIl0sXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIG5hbWU6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICAgICAgICBtYXRjaDogeyB0eXBlOiBcIm51bWJlclwiIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVtZW50czoge1xuICAgICAgICAgIHR5cGU6IFwiYXJyYXlcIixcbiAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgdHlwZTogXCJzdHJpbmdcIixcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfTtcblxuICAgIC8vIEJ1aWxkIHVzZXIgY29udGV4dCBmb3IgYmV0dGVyIHNraWxsIG1hdGNoaW5nXG4gICAgY29uc3QgdXNlclNraWxsc0NvbnRleHQgPSB1c2VyUHJvZmlsZT8uc2tpbGxzPy5sZW5ndGggXG4gICAgICA/IGBcXG5cXG5Vc2VyJ3MgU2tpbGxzIGZvciBNYXRjaCBDYWxjdWxhdGlvbjpcXG4ke3VzZXJQcm9maWxlLnNraWxscy5qb2luKCcsICcpfVxcblxcbldoZW4gY2FsY3VsYXRpbmcgc2tpbGwgbWF0Y2ggcGVyY2VudGFnZXMsIGNvbXBhcmUgdGhlIGpvYidzIHJlcXVpcmVkIHNraWxscyBhZ2FpbnN0IHRoZSB1c2VyJ3Mgc2tpbGxzIGxpc3RlZCBhYm92ZS4gR2l2ZSBoaWdoZXIgbWF0Y2ggc2NvcmVzICg4MC0xMDAlKSBmb3IgZXhhY3Qgb3IgY2xvc2VseSByZWxhdGVkIG1hdGNoZXMsIG1lZGl1bSBzY29yZXMgKDUwLTc5JSkgZm9yIHRyYW5zZmVyYWJsZSBza2lsbHMsIGFuZCBsb3dlciBzY29yZXMgKDIwLTQ5JSkgZm9yIHNraWxscyB0aGUgdXNlciBkb2Vzbid0IGhhdmUuYFxuICAgICAgOiAnJztcblxuICAgIGNvbnN0IHByb21wdCA9IGBBbmFseXplIHRoaXMgam9iIHBvc3RpbmcgYW5kIGV4dHJhY3Qga2V5IGluZm9ybWF0aW9uLlxuXG5Kb2IgRGV0YWlsczpcbi0gVGl0bGU6ICR7am9iRGF0YS50aXRsZSB8fCAnVW5rbm93bid9XG4tIENvbXBhbnk6ICR7am9iRGF0YS5jb21wYW55IHx8ICdVbmtub3duJ31cbi0gTG9jYXRpb246ICR7am9iRGF0YS5sb2NhdGlvbiB8fCAnTm90IHNwZWNpZmllZCd9XG4tIFR5cGU6ICR7am9iRGF0YS50eXBlIHx8ICdOb3Qgc3BlY2lmaWVkJ31cbi0gQ3VycmVudCBTYWxhcnk6ICR7am9iRGF0YS5zYWxhcnkgfHwgXCJOb3Qgc3BlY2lmaWVkXCJ9XG5cbkZ1bGwgRGVzY3JpcHRpb246XG4ke2Rlc2NyaXB0aW9ufSR7dXNlclNraWxsc0NvbnRleHR9XG5cbklNUE9SVEFOVDogT25seSBleHRyYWN0IGluZm9ybWF0aW9uIHRoYXQgaXMgZXhwbGljaXRseSBzdGF0ZWQgaW4gdGhlIGRlc2NyaXB0aW9uLiBEbyBub3QgbWFrZSB1cCBvciBpbmZlciBpbmZvcm1hdGlvbi5cblxuUHJvdmlkZSBhIEpTT04gcmVzcG9uc2Ugd2l0aDpcbjEuIGNsZWFuU3VtbWFyeTogQSAyLTMgc2VudGVuY2UgY29uY2lzZSBzdW1tYXJ5IG9mIHRoZSByb2xlIGFuZCBpdHMgbWFpbiBmb2N1cyBhcmVhc1xuMi4gc2FsYXJ5OiBFeHRyYWN0IHNhbGFyeSBhcyBcIiRYWCxYWFggLSAkWFgsWFhYXCIgb3IgXCJOL0FcIiBpZiBub3QgbWVudGlvbmVkLiBMb29rIGZvciBhbm51YWwgc2FsYXJ5LCBob3VybHkgcmF0ZXMsIG9yIGNvbXBlbnNhdGlvbiByYW5nZXMuXG4zLiByZXF1aXJlbWVudHM6IEV4dHJhY3QgNi04IGtleSBxdWFsaWZpY2F0aW9ucy9yZXF1aXJlbWVudHMgZnJvbSB0aGUgam9iIHBvc3RpbmcuIFByaW9yaXRpemU6XG4gICAtIEVkdWNhdGlvbmFsIHJlcXVpcmVtZW50c1xuICAgLSBZZWFycyBvZiBleHBlcmllbmNlIG5lZWRlZFxuICAgLSBNdXN0LWhhdmUgdGVjaG5pY2FsIHNraWxsc1xuICAgLSBDZXJ0aWZpY2F0aW9ucyBvciBsaWNlbnNlcyByZXF1aXJlZFxuICAgLSBLZXkgc29mdCBza2lsbHMgbWVudGlvbmVkXG40LiBza2lsbHM6IEFycmF5IG9mIDYtOCBrZXkgdGVjaG5pY2FsL3Byb2Zlc3Npb25hbCBza2lsbHMgbWVudGlvbmVkIGluIHRoZSBqb2IgcG9zdGluZyB3aXRoIG1hdGNoIHJhdGluZ3M6XG4gICAtIElmIHVzZXIgc2tpbGxzIGFyZSBwcm92aWRlZCwgY2FsY3VsYXRlIG1hdGNoIGJhc2VkIG9uIG92ZXJsYXAgd2l0aCB1c2VyJ3Mgc2tpbGwgc2V0XG4gICAtIElmIG5vIHVzZXIgc2tpbGxzIHByb3ZpZGVkLCBlc3RpbWF0ZSBnZW5lcmFsIGltcG9ydGFuY2UvZGVtYW5kICgwLTEwMClcbiAgIC0gUHJpb3JpdGl6ZSBza2lsbHMgZXhwbGljaXRseSBtZW50aW9uZWQgaW4gdGhlIGpvYiByZXF1aXJlbWVudHNcblxuRXhhbXBsZSBmb3JtYXQ6XG57XG4gIFwiY2xlYW5TdW1tYXJ5XCI6IFwiU29mdHdhcmUgZW5naW5lZXIgcm9sZSBmb2N1c2luZyBvbiBmdWxsLXN0YWNrIGRldmVsb3BtZW50IHdpdGggUmVhY3QgYW5kIE5vZGUuanMsIHdvcmtpbmcgb24gY3VzdG9tZXItZmFjaW5nIHByb2R1Y3RzIGluIGEgZmFzdC1wYWNlZCBlbnZpcm9ubWVudC5cIixcbiAgXCJzYWxhcnlcIjogXCIkOTAsMDAwIC0gJDEzMCwwMDBcIixcbiAgXCJyZXF1aXJlbWVudHNcIjogW1xuICAgIFwiQmFjaGVsb3IncyBkZWdyZWUgaW4gQ29tcHV0ZXIgU2NpZW5jZSBvciByZWxhdGVkIGZpZWxkXCIsXG4gICAgXCIzKyB5ZWFycyBvZiBwcm9mZXNzaW9uYWwgc29mdHdhcmUgZGV2ZWxvcG1lbnQgZXhwZXJpZW5jZVwiLFxuICAgIFwiU3Ryb25nIHByb2ZpY2llbmN5IGluIEphdmFTY3JpcHQvVHlwZVNjcmlwdFwiLFxuICAgIFwiRXhwZXJpZW5jZSB3aXRoIFJlYWN0IGFuZCBtb2Rlcm4gZnJvbnRlbmQgZnJhbWV3b3Jrc1wiLFxuICAgIFwiRmFtaWxpYXJpdHkgd2l0aCBSRVNUZnVsIEFQSXMgYW5kIG1pY3Jvc2VydmljZXNcIixcbiAgICBcIkV4Y2VsbGVudCBwcm9ibGVtLXNvbHZpbmcgYW5kIGNvbW11bmljYXRpb24gc2tpbGxzXCJcbiAgXSxcbiAgXCJza2lsbHNcIjogW1xuICAgIHtcIm5hbWVcIjogXCJSZWFjdFwiLCBcIm1hdGNoXCI6IDkwfSxcbiAgICB7XCJuYW1lXCI6IFwiVHlwZVNjcmlwdFwiLCBcIm1hdGNoXCI6IDg1fSxcbiAgICB7XCJuYW1lXCI6IFwiTm9kZS5qc1wiLCBcIm1hdGNoXCI6IDgwfSxcbiAgICB7XCJuYW1lXCI6IFwiUkVTVCBBUElzXCIsIFwibWF0Y2hcIjogNzV9LFxuICAgIHtcIm5hbWVcIjogXCJHaXRcIiwgXCJtYXRjaFwiOiA3MH0sXG4gICAge1wibmFtZVwiOiBcIlNRTFwiLCBcIm1hdGNoXCI6IDY1fVxuICBdXG59XG5cblJldHVybiBPTkxZIHZhbGlkIEpTT04gbWF0Y2hpbmcgdGhpcyBzdHJ1Y3R1cmUuYDtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlc3Npb24ucHJvbXB0KHByb21wdCwge3Jlc3BvbnNlQ29uc3RyYWludDogc2NoZW1hfSk7XG4gICAgY29uc29sZS5sb2coXCJSYXcgQUkgUmVzcG9uc2U6XCIsIHJlc3VsdCk7XG5cbiAgICBsZXQgY2xlYW5lZFJlc3VsdCA9IHJlc3VsdC50cmltKCk7XG4gICAgXG4gICAgLy8gUmVtb3ZlIGBgYGpzb24gYW5kIGBgYCBpZiBwcmVzZW50XG4gICAgaWYgKGNsZWFuZWRSZXN1bHQuc3RhcnRzV2l0aCgnYGBganNvbicpKSB7XG4gICAgICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBganNvblxccyovLCAnJykucmVwbGFjZSgvXFxzKmBgYCQvLCAnJyk7XG4gICAgfSBlbHNlIGlmIChjbGVhbmVkUmVzdWx0LnN0YXJ0c1dpdGgoJ2BgYCcpKSB7XG4gICAgICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBgXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqYGBgJC8sICcnKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShjbGVhbmVkUmVzdWx0KTtcbiAgICBcbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICByZXR1cm4gcGFyc2VkO1xuXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJBSSBhbmFseXNpcyBlcnJvcjpcIiwgZXJyKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgeyBhbmFseXplSm9iV2l0aEFJLCBnZW5lcmF0ZUNvdmVyTGV0dGVyIH07IiwiaW1wb3J0IFVzZXJQcm9maWxlIGZyb20gJ0AvbGliL3R5cGVzL3VzZXInO1xuaW1wb3J0IHsgYW5hbHl6ZUpvYldpdGhBSSwgZ2VuZXJhdGVDb3ZlckxldHRlciB9IGZyb20gJy4uL2xpYi9iYWNrZ3JvdW5kLWhlbHAvam9iLXN1bW1hcml6ZXInXG5cbmludGVyZmFjZSBTa2lsbCB7XG4gIG5hbWU6IHN0cmluZztcbiAgbWF0Y2g6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIEpvYkRhdGEge1xuICB0aXRsZTogc3RyaW5nO1xuICBjb21wYW55OiBzdHJpbmc7XG4gIGxvY2F0aW9uOiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbiAgc2FsYXJ5OiBzdHJpbmc7XG4gIHBvc3RlZDogc3RyaW5nO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgU2NyYXBlZERhdGEge1xuICBqb2JEYXRhOiBKb2JEYXRhO1xuICByZXF1aXJlbWVudHM6IHN0cmluZ1tdO1xuICBza2lsbHM6IFNraWxsW107XG59XG5cbmxldCBsYXRlc3RTY3JhcGVkOiBTY3JhcGVkRGF0YSB8IG51bGwgPSBudWxsO1xubGV0IGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xubGV0IGNhY2hlZFByb2ZpbGU6IFVzZXJQcm9maWxlIHwgbnVsbCA9IG51bGw7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUJhY2tncm91bmQoKCkgPT4ge1xuICBjb25zb2xlLmxvZygnQmFja2dyb3VuZCBzY3JpcHQgaW5pdGlhbGl6ZWQnKTtcblxuICAvLyBMb2FkIHByb2ZpbGUgb24gc3RhcnR1cFxuICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoJ3Byb2ZpbGUnKS50aGVuKChkYXRhKSA9PiB7XG4gICAgaWYgKGRhdGEucHJvZmlsZSkge1xuICAgICAgY2FjaGVkUHJvZmlsZSA9IGRhdGEucHJvZmlsZTtcbiAgICAgIGNvbnNvbGUubG9nKCdQcm9maWxlIGxvYWRlZCBvbiBzdGFydHVwJyk7XG4gICAgfVxuICB9KTtcblxuICAvLyBMaXN0ZW4gZm9yIHByb2ZpbGUgY2hhbmdlc1xuICBjaHJvbWUuc3RvcmFnZS5vbkNoYW5nZWQuYWRkTGlzdGVuZXIoKGNoYW5nZXMsIGFyZWFOYW1lKSA9PiB7XG4gICAgaWYgKGFyZWFOYW1lID09PSAnbG9jYWwnICYmIGNoYW5nZXMucHJvZmlsZSkge1xuICAgICAgY2FjaGVkUHJvZmlsZSA9IGNoYW5nZXMucHJvZmlsZS5uZXdWYWx1ZTtcbiAgICAgIGNvbnNvbGUubG9nKCdQcm9maWxlIGNhY2hlIHVwZGF0ZWQnKTtcbiAgICB9XG4gIH0pO1xuXG4gIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICBzd2l0Y2ggKG1lc3NhZ2UudHlwZSkge1xuICAgICAgY2FzZSAnU0NSQVBJTkdfU1RBUlRFRCc6XG4gICAgICAgIGNvbnNvbGUubG9nKCdTQ1JBUElOR19TVEFSVEVEJyk7XG4gICAgICAgIGlzUHJvY2Vzc2luZyA9IHRydWU7XG4gICAgICAgIFxuICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgIHR5cGU6ICdTQ1JBUElOR19TVEFSVEVEJyxcbiAgICAgICAgfSkuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdQb3B1cCBub3Qgb3BlbicpO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ0dFVF9QUk9GSUxFJzoge1xuICAgICAgICBjb25zb2xlLmxvZyhcIkdFVF9QUk9GSUxFIHJlY2VpdmVkXCIpO1xuICAgICAgICBcbiAgICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gVXNlIGNhY2hlZCBwcm9maWxlIGlmIGF2YWlsYWJsZVxuICAgICAgICAgICAgaWYgKGNhY2hlZFByb2ZpbGUpIHtcbiAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IHRydWUsIHByb2ZpbGU6IGNhY2hlZFByb2ZpbGUgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldCgncHJvZmlsZScpO1xuICAgICAgICAgICAgY2FjaGVkUHJvZmlsZSA9IGRhdGEucHJvZmlsZSB8fCBudWxsO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NlbmRpbmcgcHJvZmlsZTonLCBjYWNoZWRQcm9maWxlKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiB0cnVlLCBwcm9maWxlOiBjYWNoZWRQcm9maWxlIH0pO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIEdFVF9QUk9GSUxFOlwiLCBlcnIpO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IGZhbHNlLCBlcnJvcjogZXJyIS50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkoKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIGNhc2UgJ0pPQl9TQ1JBUEVEX0RBVEEnOiB7XG4gICAgICAgIGNvbnN0IHNjcmFwZWREYXRhID0gbWVzc2FnZS5kYXRhIGFzIFNjcmFwZWREYXRhO1xuICAgICAgICBjb25zb2xlLmxvZygn8J+TpiBKT0JfU0NSQVBFRF9EQVRBIHJlY2VpdmVkJyk7XG5cbiAgICAgICAgaWYgKHNjcmFwZWREYXRhPy5qb2JEYXRhLmRlc2NyaXB0aW9uICYmIHNjcmFwZWREYXRhLmpvYkRhdGEuZGVzY3JpcHRpb24ubGVuZ3RoID4gMTAwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1N0YXJ0aW5nIEFJIGFuYWx5c2lzIHdpdGggdXNlciBwcm9maWxlLi4uJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gUGFzcyB1c2VyIHByb2ZpbGUgdG8gQUkgZm9yIGJldHRlciBza2lsbCBtYXRjaGluZ1xuICAgICAgICAgIGFuYWx5emVKb2JXaXRoQUkoc2NyYXBlZERhdGEuam9iRGF0YSwgY2FjaGVkUHJvZmlsZSB8fCB1bmRlZmluZWQpXG4gICAgICAgICAgICAudGhlbihhaVJlc3VsdCA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdBSSBSZXN1bHQ6JywgYWlSZXN1bHQpO1xuXG4gICAgICAgICAgICAgIGlmIChhaVJlc3VsdCkge1xuICAgICAgICAgICAgICAgIGxhdGVzdFNjcmFwZWQgPSB7XG4gICAgICAgICAgICAgICAgICBqb2JEYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLnNjcmFwZWREYXRhLmpvYkRhdGEsXG4gICAgICAgICAgICAgICAgICAgIHNhbGFyeTogYWlSZXN1bHQuc2FsYXJ5IHx8IHNjcmFwZWREYXRhLmpvYkRhdGEuc2FsYXJ5LFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYWlSZXN1bHQuY2xlYW5TdW1tYXJ5IHx8IHNjcmFwZWREYXRhLmpvYkRhdGEuZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgcmVxdWlyZW1lbnRzOiBhaVJlc3VsdC5yZXF1aXJlbWVudHMgfHwgW10sXG4gICAgICAgICAgICAgICAgICBza2lsbHM6IGFpUmVzdWx0LnNraWxscyB8fCBbXSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxhdGVzdFNjcmFwZWQgPSBzY3JhcGVkRGF0YTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ1JFTEFZRURfSk9CX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICAgICAgZGF0YTogbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gY29uc29sZS5sb2coJ1BvcHVwIG5vdCBvcGVuJykpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdBSSBhbmFseXNpcyBlcnJvcjonLCBlcnIpO1xuICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkID0gc2NyYXBlZERhdGE7XG4gICAgICAgICAgICAgIGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnUkVMQVlFRF9KT0JfU0NSQVBFRF9EQVRBJyxcbiAgICAgICAgICAgICAgICBkYXRhOiBsYXRlc3RTY3JhcGVkLFxuICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBjb25zb2xlLmxvZygnUG9wdXAgbm90IG9wZW4nKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnU2tpcHBpbmcgQUkgKG5vIGRlc2NyaXB0aW9uKScpO1xuICAgICAgICAgIGxhdGVzdFNjcmFwZWQgPSBzY3JhcGVkRGF0YTtcbiAgICAgICAgICBpc1Byb2Nlc3NpbmcgPSBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgdHlwZTogJ1JFTEFZRURfSk9CX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICBkYXRhOiBsYXRlc3RTY3JhcGVkLFxuICAgICAgICAgIH0pLmNhdGNoKCgpID0+IGNvbnNvbGUubG9nKCdQb3B1cCBub3Qgb3BlbicpKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY2FzZSAnU0FWRV9QUk9GSUxFJzoge1xuICAgICAgICBjb25zb2xlLmxvZyhcIlNBVkVfUFJPRklMRSByZWNlaXZlZFwiKTtcbiAgICAgICAgXG4gICAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHByb2ZpbGVEYXRhID0gbWVzc2FnZS5kYXRhIGFzIFVzZXJQcm9maWxlO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBWYWxpZGF0ZSByZXF1aXJlZCBmaWVsZHNcbiAgICAgICAgICAgIGlmICghcHJvZmlsZURhdGEuZmlyc3ROYW1lIHx8ICFwcm9maWxlRGF0YS5sYXN0TmFtZSB8fCAhcHJvZmlsZURhdGEuZW1haWwpIHtcbiAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgXG4gICAgICAgICAgICAgICAgb2s6IGZhbHNlLCBcbiAgICAgICAgICAgICAgICBlcnJvcjogJ01pc3NpbmcgcmVxdWlyZWQgZmllbGRzOiBGaXJzdCBOYW1lLCBMYXN0IE5hbWUsIEVtYWlsJyBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQWRkaXRpb25hbCB2YWxpZGF0aW9uXG4gICAgICAgICAgICBpZiAoIXByb2ZpbGVEYXRhLnBob25lIHx8ICFwcm9maWxlRGF0YS5jaXR5IHx8ICFwcm9maWxlRGF0YS5zdGF0ZSkge1xuICAgICAgICAgICAgICBzZW5kUmVzcG9uc2Uoe1xuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogJ01pc3NpbmcgcmVxdWlyZWQgZmllbGRzOiBQaG9uZSwgQ2l0eSwgU3RhdGUnXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghcHJvZmlsZURhdGEuc2tpbGxzIHx8IHByb2ZpbGVEYXRhLnNraWxscy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHtcbiAgICAgICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdQbGVhc2UgYWRkIGF0IGxlYXN0IG9uZSBza2lsbCB0byB5b3VyIHByb2ZpbGUnXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNhdmUgdG8gY2hyb21lLnN0b3JhZ2VcbiAgICAgICAgICAgIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IHByb2ZpbGU6IHByb2ZpbGVEYXRhIH0pO1xuICAgICAgICAgICAgY2FjaGVkUHJvZmlsZSA9IHByb2ZpbGVEYXRhO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUHJvZmlsZSBzYXZlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IHRydWUgfSk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gU0FWRV9QUk9GSUxFOlwiLCBlcnIpO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IGZhbHNlLCBlcnJvcjogZXJyIS50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkoKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNhc2UgJ0dFTkVSQVRFX0NPVkVSX0xFVFRFUic6IHtcbiAgICAgICAgY29uc29sZS5sb2coJ0dFTkVSQVRFX0NPVkVSX0xFVFRFUiByZXF1ZXN0IHJlY2VpdmVkJyk7XG4gICAgICAgIFxuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBHZXQgdXNlciBwcm9maWxlIGZyb20gY2FjaGUgb3Igc3RvcmFnZVxuICAgICAgICAgICAgbGV0IHByb2ZpbGUgPSBjYWNoZWRQcm9maWxlO1xuICAgICAgICAgICAgaWYgKCFwcm9maWxlKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHsgcHJvZmlsZTogc3RvcmVkUHJvZmlsZSB9ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KCdwcm9maWxlJyk7XG4gICAgICAgICAgICAgIHByb2ZpbGUgPSBzdG9yZWRQcm9maWxlO1xuICAgICAgICAgICAgICBjYWNoZWRQcm9maWxlID0gcHJvZmlsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFwcm9maWxlKSB7XG4gICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IFxuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSwgXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdObyBwcm9maWxlIGZvdW5kLiBQbGVhc2Ugc2V0IHVwIHlvdXIgcHJvZmlsZSBmaXJzdCBpbiB0aGUgU2V0dGluZ3MgdGFiLicgXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFZhbGlkYXRlIHByb2ZpbGUgaGFzIG1pbmltdW0gcmVxdWlyZWQgZmllbGRzXG4gICAgICAgICAgICBpZiAoIXByb2ZpbGUuc2tpbGxzIHx8IHByb2ZpbGUuc2tpbGxzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICBzZW5kUmVzcG9uc2Uoe1xuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogJ1lvdXIgcHJvZmlsZSBuZWVkcyBhdCBsZWFzdCBvbmUgc2tpbGwgbGlzdGVkLiBQbGVhc2UgdXBkYXRlIHlvdXIgcHJvZmlsZSBpbiBTZXR0aW5ncy4nXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghcHJvZmlsZS5yZXN1bWVTdW1tYXJ5ICYmICghcHJvZmlsZS5lbXBsb3ltZW50SGlzdG9yeSB8fCBwcm9maWxlLmVtcGxveW1lbnRIaXN0b3J5Lmxlbmd0aCA9PT0gMCkpIHtcbiAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHtcbiAgICAgICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdQbGVhc2UgYWRkIGVpdGhlciBhIHJlc3VtZSBzdW1tYXJ5IG9yIGVtcGxveW1lbnQgaGlzdG9yeSB0byB5b3VyIHByb2ZpbGUgZm9yIGJldHRlciBjb3ZlciBsZXR0ZXJzLidcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVXNlIGxhdGVzdCBzY3JhcGVkIGRhdGFcbiAgICAgICAgICAgIGlmICghbGF0ZXN0U2NyYXBlZCkge1xuICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBcbiAgICAgICAgICAgICAgICBvazogZmFsc2UsIFxuICAgICAgICAgICAgICAgIGVycm9yOiAnTm8gam9iIGRhdGEgYXZhaWxhYmxlLiBQbGVhc2Ugb3BlbiBhIGpvYiBwb3N0aW5nIGZpcnN0LicgXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdHZW5lcmF0aW5nIGNvdmVyIGxldHRlciB3aXRoOicsIHtcbiAgICAgICAgICAgICAgam9iOiBsYXRlc3RTY3JhcGVkLmpvYkRhdGEudGl0bGUsXG4gICAgICAgICAgICAgIHVzZXI6IGAke3Byb2ZpbGUuZmlyc3ROYW1lfSAke3Byb2ZpbGUubGFzdE5hbWV9YCxcbiAgICAgICAgICAgICAgc2tpbGxzOiBwcm9maWxlLnNraWxscz8ubGVuZ3RoIHx8IDAsXG4gICAgICAgICAgICAgIGV4cGVyaWVuY2U6IHByb2ZpbGUueWVhcnNFeHBlcmllbmNlXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gR2VuZXJhdGUgdGhlIGNvdmVyIGxldHRlciB3aXRoIGZ1bGwgcHJvZmlsZVxuICAgICAgICAgICAgY29uc3QgY292ZXJMZXR0ZXIgPSBhd2FpdCBnZW5lcmF0ZUNvdmVyTGV0dGVyKFxuICAgICAgICAgICAgICBsYXRlc3RTY3JhcGVkLmpvYkRhdGEsXG4gICAgICAgICAgICAgIGxhdGVzdFNjcmFwZWQsXG4gICAgICAgICAgICAgIHByb2ZpbGVcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmICghY292ZXJMZXR0ZXIpIHtcbiAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgXG4gICAgICAgICAgICAgICAgb2s6IGZhbHNlLCBcbiAgICAgICAgICAgICAgICBlcnJvcjogJ0ZhaWxlZCB0byBnZW5lcmF0ZSBjb3ZlciBsZXR0ZXIuIEFJIG1heSBub3QgYmUgYXZhaWxhYmxlIG9yIHN0aWxsIGRvd25sb2FkaW5nLicgXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDb3ZlciBsZXR0ZXIgZ2VuZXJhdGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgXG4gICAgICAgICAgICAgIG9rOiB0cnVlLCBcbiAgICAgICAgICAgICAgY292ZXJMZXR0ZXI6IGNvdmVyTGV0dGVyIFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NvdmVyIGxldHRlciBnZW5lcmF0aW9uIGVycm9yOicsIGVycik7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBcbiAgICAgICAgICAgICAgb2s6IGZhbHNlLCBcbiAgICAgICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gZ2VuZXJhdGU6ICR7ZXJyIS50b1N0cmluZygpfWAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pKCk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgY2FzZSAnR0VUX0xBVEVTVF9KT0JfU0NSQVBFRCc6XG4gICAgICAgIGNvbnNvbGUubG9nKCdTZW5kaW5nIGRhdGEgdG8gcG9wdXA6JywgeyBcbiAgICAgICAgICBoYXNEYXRhOiAhIWxhdGVzdFNjcmFwZWQsIFxuICAgICAgICAgIGlzUHJvY2Vzc2luZyxcbiAgICAgICAgICBoYXNQcm9maWxlOiAhIWNhY2hlZFByb2ZpbGUgXG4gICAgICAgIH0pO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBcbiAgICAgICAgICBkYXRhOiBsYXRlc3RTY3JhcGVkLCBcbiAgICAgICAgICBpc1Byb2Nlc3NpbmcsXG4gICAgICAgICAgaGFzUHJvZmlsZTogISFjYWNoZWRQcm9maWxlIFxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfSk7XG59KTsiLCIvLyBzcmMvaW5kZXgudHNcbnZhciBfTWF0Y2hQYXR0ZXJuID0gY2xhc3Mge1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4pIHtcbiAgICBpZiAobWF0Y2hQYXR0ZXJuID09PSBcIjxhbGxfdXJscz5cIikge1xuICAgICAgdGhpcy5pc0FsbFVybHMgPSB0cnVlO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBbLi4uX01hdGNoUGF0dGVybi5QUk9UT0NPTFNdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gXCIqXCI7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZ3JvdXBzID0gLyguKik6XFwvXFwvKC4qPykoXFwvLiopLy5leGVjKG1hdGNoUGF0dGVybik7XG4gICAgICBpZiAoZ3JvdXBzID09IG51bGwpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgXCJJbmNvcnJlY3QgZm9ybWF0XCIpO1xuICAgICAgY29uc3QgW18sIHByb3RvY29sLCBob3N0bmFtZSwgcGF0aG5hbWVdID0gZ3JvdXBzO1xuICAgICAgdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKTtcbiAgICAgIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSk7XG4gICAgICB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBwcm90b2NvbCA9PT0gXCIqXCIgPyBbXCJodHRwXCIsIFwiaHR0cHNcIl0gOiBbcHJvdG9jb2xdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gaG9zdG5hbWU7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBwYXRobmFtZTtcbiAgICB9XG4gIH1cbiAgaW5jbHVkZXModXJsKSB7XG4gICAgaWYgKHRoaXMuaXNBbGxVcmxzKVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgdSA9IHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIgPyBuZXcgVVJMKHVybCkgOiB1cmwgaW5zdGFuY2VvZiBMb2NhdGlvbiA/IG5ldyBVUkwodXJsLmhyZWYpIDogdXJsO1xuICAgIHJldHVybiAhIXRoaXMucHJvdG9jb2xNYXRjaGVzLmZpbmQoKHByb3RvY29sKSA9PiB7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwc1wiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBzTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZmlsZVwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0ZpbGVNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmdHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGdHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJ1cm5cIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNVcm5NYXRjaCh1KTtcbiAgICB9KTtcbiAgfVxuICBpc0h0dHBNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHA6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0h0dHBzTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwczpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSG9zdFBhdGhNYXRjaCh1cmwpIHtcbiAgICBpZiAoIXRoaXMuaG9zdG5hbWVNYXRjaCB8fCAhdGhpcy5wYXRobmFtZU1hdGNoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGhvc3RuYW1lTWF0Y2hSZWdleHMgPSBbXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gpLFxuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoLnJlcGxhY2UoL15cXCpcXC4vLCBcIlwiKSlcbiAgICBdO1xuICAgIGNvbnN0IHBhdGhuYW1lTWF0Y2hSZWdleCA9IHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMucGF0aG5hbWVNYXRjaCk7XG4gICAgcmV0dXJuICEhaG9zdG5hbWVNYXRjaFJlZ2V4cy5maW5kKChyZWdleCkgPT4gcmVnZXgudGVzdCh1cmwuaG9zdG5hbWUpKSAmJiBwYXRobmFtZU1hdGNoUmVnZXgudGVzdCh1cmwucGF0aG5hbWUpO1xuICB9XG4gIGlzRmlsZU1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmaWxlOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc0Z0cE1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmdHA6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzVXJuTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IHVybjovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgY29udmVydFBhdHRlcm5Ub1JlZ2V4KHBhdHRlcm4pIHtcbiAgICBjb25zdCBlc2NhcGVkID0gdGhpcy5lc2NhcGVGb3JSZWdleChwYXR0ZXJuKTtcbiAgICBjb25zdCBzdGFyc1JlcGxhY2VkID0gZXNjYXBlZC5yZXBsYWNlKC9cXFxcXFwqL2csIFwiLipcIik7XG4gICAgcmV0dXJuIFJlZ0V4cChgXiR7c3RhcnNSZXBsYWNlZH0kYCk7XG4gIH1cbiAgZXNjYXBlRm9yUmVnZXgoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG4gIH1cbn07XG52YXIgTWF0Y2hQYXR0ZXJuID0gX01hdGNoUGF0dGVybjtcbk1hdGNoUGF0dGVybi5QUk9UT0NPTFMgPSBbXCJodHRwXCIsIFwiaHR0cHNcIiwgXCJmaWxlXCIsIFwiZnRwXCIsIFwidXJuXCJdO1xudmFyIEludmFsaWRNYXRjaFBhdHRlcm4gPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuLCByZWFzb24pIHtcbiAgICBzdXBlcihgSW52YWxpZCBtYXRjaCBwYXR0ZXJuIFwiJHttYXRjaFBhdHRlcm59XCI6ICR7cmVhc29ufWApO1xuICB9XG59O1xuZnVuY3Rpb24gdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKSB7XG4gIGlmICghTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5pbmNsdWRlcyhwcm90b2NvbCkgJiYgcHJvdG9jb2wgIT09IFwiKlwiKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYCR7cHJvdG9jb2x9IG5vdCBhIHZhbGlkIHByb3RvY29sICgke01hdGNoUGF0dGVybi5QUk9UT0NPTFMuam9pbihcIiwgXCIpfSlgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSkge1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCI6XCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYEhvc3RuYW1lIGNhbm5vdCBpbmNsdWRlIGEgcG9ydGApO1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCIqXCIpICYmIGhvc3RuYW1lLmxlbmd0aCA+IDEgJiYgIWhvc3RuYW1lLnN0YXJ0c1dpdGgoXCIqLlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGBJZiB1c2luZyBhIHdpbGRjYXJkICgqKSwgaXQgbXVzdCBnbyBhdCB0aGUgc3RhcnQgb2YgdGhlIGhvc3RuYW1lYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpIHtcbiAgcmV0dXJuO1xufVxuZXhwb3J0IHtcbiAgSW52YWxpZE1hdGNoUGF0dGVybixcbiAgTWF0Y2hQYXR0ZXJuXG59O1xuIl0sIm5hbWVzIjpbImJyb3dzZXIiLCJfYnJvd3NlciIsInJlc3VsdCJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLGlCQUFpQixLQUFLO0FBQ3BDLFFBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxXQUFZLFFBQU8sRUFBRSxNQUFNLElBQUc7QUFDaEUsV0FBTztBQUFBLEVB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
