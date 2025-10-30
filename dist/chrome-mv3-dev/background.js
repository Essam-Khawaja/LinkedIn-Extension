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

When calculating skill match percentages, be STRICT and REALISTIC:
- Compare each required job skill against the user's skills listed above
- Only give 90-100% for EXACT matches (same skill name)
- Give 70-89% for very closely related skills (e.g., React and React.js)
- Give 50-69% for somewhat related skills (e.g., JavaScript and TypeScript)
- Give 30-49% for transferable but not directly related skills
- Give 0-29% for skills the user clearly doesn't have
- Most skills should fall in the 30-70% range - be critical and realistic
- Don't inflate scores just to be positive` : "";
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
   - If user skills are provided, BE STRICT with match percentages:
     * 90-100%: User has this EXACT skill listed (exact match only)
     * 70-89%: User has a very closely related skill (e.g., "React" for "React.js")
     * 50-69%: User has a somewhat related skill (e.g., "JavaScript" for "TypeScript")
     * 30-49%: User has transferable skills but not this specific one
     * 0-29%: User does not have this skill or related skills
   - Most matches should be in the 30-70% range unless there's a clear skill overlap
   - Be realistic and critical - don't inflate scores
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zcmMvbGliL2JhY2tncm91bmQtaGVscC9qb2Itc3VtbWFyaXplci50cyIsIi4uLy4uL3NyYy9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG4gIGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuICByZXR1cm4gYXJnO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiaW50ZXJmYWNlIFNraWxsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBtYXRjaDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSm9iRGF0YSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGNvbXBhbnk6IHN0cmluZztcbiAgbG9jYXRpb246IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzYWxhcnk6IHN0cmluZztcbiAgcG9zdGVkOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTY3JhcGVkRGF0YSB7XG4gIGpvYkRhdGE6IEpvYkRhdGE7XG4gIHJlcXVpcmVtZW50czogc3RyaW5nW107XG4gIHNraWxsczogU2tpbGxbXTtcbn1cblxuaW50ZXJmYWNlIEVtcGxveW1lbnRFbnRyeSB7XG4gIGlkOiBzdHJpbmc7XG4gIGpvYlRpdGxlOiBzdHJpbmc7XG4gIGNvbXBhbnk6IHN0cmluZztcbiAgc3RhcnREYXRlOiBzdHJpbmc7XG4gIGVuZERhdGU/OiBzdHJpbmc7XG4gIGlzQ3VycmVudDogYm9vbGVhbjtcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBVc2VyUHJvZmlsZSB7XG4gIGZpcnN0TmFtZTogc3RyaW5nO1xuICBsYXN0TmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICBwaG9uZTogc3RyaW5nO1xuICBhZGRyZXNzOiBzdHJpbmc7XG4gIGNpdHk6IHN0cmluZztcbiAgc3RhdGU6IHN0cmluZztcbiAgemlwOiBzdHJpbmc7XG4gIHllYXJzRXhwZXJpZW5jZTogbnVtYmVyO1xuICBza2lsbHM6IHN0cmluZ1tdO1xuICBlbXBsb3ltZW50SGlzdG9yeT86IEVtcGxveW1lbnRFbnRyeVtdO1xuICBlZHVjYXRpb24/OiBzdHJpbmc7XG4gIHJlc3VtZVN1bW1hcnk/OiBzdHJpbmc7XG4gIGNlcnRpZmljYXRpb25zPzogc3RyaW5nW107XG4gIHNhbGFyeUV4cGVjdGF0aW9uPzogc3RyaW5nO1xuICBsaW5rZWRpbjogc3RyaW5nO1xuICBwb3J0Zm9saW8/OiBzdHJpbmc7XG4gIGdpdGh1Yj86IHN0cmluZztcbiAgbmVlZHNTcG9uc29yc2hpcDogYm9vbGVhbjtcbiAgd2lsbGluZ1RvUmVsb2NhdGU6IGJvb2xlYW47XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlQ292ZXJMZXR0ZXIoXG4gIGpvYkRhdGE6IEpvYkRhdGEsIFxuICBhbmFseXplZERhdGE6IFNjcmFwZWREYXRhLFxuICB1c2VyUHJvZmlsZT86IFVzZXJQcm9maWxlXG4pIHtcbiAgdHJ5IHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3QgYXZhaWxhYmlsaXR5ID0gYXdhaXQgTGFuZ3VhZ2VNb2RlbC5hdmFpbGFiaWxpdHkoKTtcblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdubycpIHtcbiAgICAgIGNvbnNvbGUud2FybihcIkdlbWluaSBOYW5vIG5vdCBhdmFpbGFibGVcIik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnYWZ0ZXItZG93bmxvYWQnKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIlRyaWdnZXJpbmcgR2VtaW5pIE5hbm8gZG93bmxvYWQuLi5cIik7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuXG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSBqb2JEYXRhLmRlc2NyaXB0aW9uIFxuICAgICAgPyBqb2JEYXRhLmRlc2NyaXB0aW9uLnN1YnN0cmluZygwLCAyMDAwKVxuICAgICAgOiAnTm8gZGVzY3JpcHRpb24gYXZhaWxhYmxlJztcblxuICAgIC8vIEJ1aWxkIGNvbXByZWhlbnNpdmUgdXNlciBjb250ZXh0XG4gICAgY29uc3QgdXNlckNvbnRleHQgPSB1c2VyUHJvZmlsZSA/IGBcblVzZXIgUHJvZmlsZTpcbi0gTmFtZTogJHt1c2VyUHJvZmlsZS5maXJzdE5hbWV9ICR7dXNlclByb2ZpbGUubGFzdE5hbWV9XG4tIENvbnRhY3Q6ICR7dXNlclByb2ZpbGUuZW1haWx9IHwgJHt1c2VyUHJvZmlsZS5waG9uZX1cbi0gTG9jYXRpb246ICR7dXNlclByb2ZpbGUuY2l0eX0sICR7dXNlclByb2ZpbGUuc3RhdGV9ICR7dXNlclByb2ZpbGUuemlwfVxuLSBZZWFycyBvZiBFeHBlcmllbmNlOiAke3VzZXJQcm9maWxlLnllYXJzRXhwZXJpZW5jZX0geWVhcnNcbi0gS2V5IFNraWxsczogJHt1c2VyUHJvZmlsZS5za2lsbHM/LmpvaW4oJywgJykgfHwgJ05vdCBwcm92aWRlZCd9XG4ke3VzZXJQcm9maWxlLmNlcnRpZmljYXRpb25zPy5sZW5ndGggPyBgLSBDZXJ0aWZpY2F0aW9uczogJHt1c2VyUHJvZmlsZS5jZXJ0aWZpY2F0aW9ucy5qb2luKCcsICcpfWAgOiAnJ31cbiR7dXNlclByb2ZpbGUuZWR1Y2F0aW9uID8gYC0gRWR1Y2F0aW9uOiAke3VzZXJQcm9maWxlLmVkdWNhdGlvbn1gIDogJyd9XG4ke3VzZXJQcm9maWxlLmxpbmtlZGluID8gYC0gTGlua2VkSW46ICR7dXNlclByb2ZpbGUubGlua2VkaW59YCA6ICcnfVxuJHt1c2VyUHJvZmlsZS5naXRodWIgPyBgLSBHaXRIdWI6ICR7dXNlclByb2ZpbGUuZ2l0aHVifWAgOiAnJ31cbiR7dXNlclByb2ZpbGUucG9ydGZvbGlvID8gYC0gUG9ydGZvbGlvOiAke3VzZXJQcm9maWxlLnBvcnRmb2xpb31gIDogJyd9XG4ke3VzZXJQcm9maWxlLnNhbGFyeUV4cGVjdGF0aW9uID8gYC0gU2FsYXJ5IEV4cGVjdGF0aW9uOiAke3VzZXJQcm9maWxlLnNhbGFyeUV4cGVjdGF0aW9ufWAgOiAnJ31cbiR7dXNlclByb2ZpbGUubmVlZHNTcG9uc29yc2hpcCA/ICctIE5vdGU6IFJlcXVpcmVzIHZpc2Egc3BvbnNvcnNoaXAnIDogJyd9XG4ke3VzZXJQcm9maWxlLndpbGxpbmdUb1JlbG9jYXRlID8gJy0gV2lsbGluZyB0byByZWxvY2F0ZScgOiAnLSBQcmVmZXJzIGxvY2FsIG9wcG9ydHVuaXRpZXMnfVxuXG4ke3VzZXJQcm9maWxlLnJlc3VtZVN1bW1hcnkgPyBgUHJvZmVzc2lvbmFsIFN1bW1hcnk6XFxuJHt1c2VyUHJvZmlsZS5yZXN1bWVTdW1tYXJ5fVxcbmAgOiAnJ31cblxuJHt1c2VyUHJvZmlsZS5lbXBsb3ltZW50SGlzdG9yeT8ubGVuZ3RoID8gYFJlY2VudCBFbXBsb3ltZW50IEhpc3Rvcnk6XG4ke3VzZXJQcm9maWxlLmVtcGxveW1lbnRIaXN0b3J5LnNsaWNlKDAsIDMpLm1hcChqb2IgPT4gXG4gIGAtICR7am9iLmpvYlRpdGxlfSBhdCAke2pvYi5jb21wYW55fSAoJHtqb2Iuc3RhcnREYXRlfSAtICR7am9iLmlzQ3VycmVudCA/ICdQcmVzZW50JyA6IGpvYi5lbmREYXRlIHx8ICdOL0EnfSkke2pvYi5kZXNjcmlwdGlvbiA/ICdcXG4gICcgKyBqb2IuZGVzY3JpcHRpb24gOiAnJ31gXG4pLmpvaW4oJ1xcbicpfWAgOiAnJ31cbmAgOiAnJztcblxuICAgIGNvbnN0IGtleVJlcXVpcmVtZW50cyA9IGFuYWx5emVkRGF0YS5yZXF1aXJlbWVudHM/LnNsaWNlKDAsIDUpLmpvaW4oJ1xcbi0gJykgfHwgJ05vdCBhbmFseXplZCc7XG4gICAgY29uc3Qga2V5U2tpbGxzID0gYW5hbHl6ZWREYXRhLnNraWxscz8uc2xpY2UoMCwgNSkubWFwKHMgPT4gcy5uYW1lKS5qb2luKCcsICcpIHx8ICdOb3QgYW5hbHl6ZWQnO1xuXG4gICAgY29uc3QgcHJvbXB0ID0gYEdlbmVyYXRlIGEgcHJvZmVzc2lvbmFsIGNvdmVyIGxldHRlciBmb3IgdGhlIGZvbGxvd2luZyBqb2IgYXBwbGljYXRpb24uXG5cbkpvYiBEZXRhaWxzOlxuLSBQb3NpdGlvbjogJHtqb2JEYXRhLnRpdGxlfVxuLSBDb21wYW55OiAke2pvYkRhdGEuY29tcGFueX1cbi0gTG9jYXRpb246ICR7am9iRGF0YS5sb2NhdGlvbn1cbi0gSm9iIFR5cGU6ICR7am9iRGF0YS50eXBlfVxuJHtqb2JEYXRhLnNhbGFyeSAhPT0gJ04vQScgPyBgLSBTYWxhcnkgUmFuZ2U6ICR7am9iRGF0YS5zYWxhcnl9YCA6ICcnfVxuXG5LZXkgUmVxdWlyZW1lbnRzIGZyb20gSm9iIFBvc3Rpbmc6XG4tICR7a2V5UmVxdWlyZW1lbnRzfVxuXG5LZXkgU2tpbGxzIE5lZWRlZDpcbiR7a2V5U2tpbGxzfVxuXG4ke3VzZXJDb250ZXh0fVxuXG5Kb2IgRGVzY3JpcHRpb24gU3VtbWFyeTpcbiR7ZGVzY3JpcHRpb259XG5cbkluc3RydWN0aW9uczpcbjEuIFdyaXRlIGEgcHJvZmVzc2lvbmFsLCBlbmdhZ2luZyBjb3ZlciBsZXR0ZXIgKDMwMC00MDAgd29yZHMpXG4yLiBPcGVuIHdpdGggYSBzdHJvbmcgaG9vayB0aGF0IHNob3dzIGdlbnVpbmUgZW50aHVzaWFzbSBhbmQgZXhwbGFpbnMgd2h5IHRoaXMgc3BlY2lmaWMgcm9sZSBpbnRlcmVzdHMgeW91XG4zLiBIaWdobGlnaHQgMi0zIHJlbGV2YW50IGV4cGVyaWVuY2VzIGZyb20gZW1wbG95bWVudCBoaXN0b3J5IHRoYXQgZGlyZWN0bHkgbWF0Y2ggam9iIHJlcXVpcmVtZW50c1xuNC4gUmVmZXJlbmNlIHNwZWNpZmljIHNraWxscyBmcm9tIHRoZSB1c2VyJ3MgcHJvZmlsZSB0aGF0IGFsaWduIHdpdGggdGhlIGpvYiBuZWVkc1xuNS4gSWYgdXNlciBoYXMgcmVsZXZhbnQgY2VydGlmaWNhdGlvbnMgb3IgZWR1Y2F0aW9uLCB3ZWF2ZSB0aGVtIG5hdHVyYWxseSBpbnRvIHRoZSBuYXJyYXRpdmVcbjYuIFNob3cga25vd2xlZGdlIG9mICR7am9iRGF0YS5jb21wYW55fSBhbmQgZXhwbGFpbiB3aHkgeW91IHdhbnQgdG8gd29yayB0aGVyZSBzcGVjaWZpY2FsbHlcbjcuIEFkZHJlc3MgYW55IGltcG9ydGFudCBjb25zaWRlcmF0aW9ucyAoc3BvbnNvcnNoaXAgbmVlZHMsIHJlbG9jYXRpb24gd2lsbGluZ25lc3MpIG5hdHVyYWxseSBpZiByZWxldmFudFxuOC4gRXhwcmVzcyBnZW51aW5lIGludGVyZXN0IGluIGNvbnRyaWJ1dGluZyB0byB0aGUgdGVhbSdzIGdvYWxzXG45LiBDbG9zZSB3aXRoIGEgY29uZmlkZW50IGNhbGwgdG8gYWN0aW9uXG4xMC4gVXNlIGEgcHJvZmVzc2lvbmFsIGJ1dCB3YXJtLCBjb252ZXJzYXRpb25hbCB0b25lXG4xMS4gRE8gTk9UIHVzZSBnZW5lcmljIG9wZW5pbmcgbGluZXMgbGlrZSBcIkkgYW0gd3JpdGluZyB0byBleHByZXNzIG15IGludGVyZXN0XCJcbjEyLiBCZSBzcGVjaWZpYyBhYm91dCBleHBlcmllbmNlcyBhbmQgYWNoaWV2ZW1lbnRzIHJhdGhlciB0aGFuIHZhZ3VlIGNsYWltc1xuMTMuIFF1YW50aWZ5IGFjaGlldmVtZW50cyB3aGVuIHBvc3NpYmxlIGJhc2VkIG9uIGVtcGxveW1lbnQgZGVzY3JpcHRpb25zXG4xNC4gS2VlcCBwYXJhZ3JhcGhzIGNvbmNpc2UgYW5kIGltcGFjdGZ1bCAoMy00IHNlbnRlbmNlcyBlYWNoKVxuMTUuIEVuc3VyZSB0aGUgbGV0dGVyIHRlbGxzIGEgY29oZXNpdmUgc3RvcnkgYWJvdXQgd2h5IHRoaXMgY2FuZGlkYXRlIGlzIHBlcmZlY3QgZm9yIHRoaXMgcm9sZVxuXG5Gb3JtYXQgdGhlIGxldHRlciB3aXRoIHByb3BlciBidXNpbmVzcyBsZXR0ZXIgc3RydWN0dXJlOlxuXG4ke25ldyBEYXRlKCkudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1VUycsIHsgbW9udGg6ICdsb25nJywgZGF5OiAnbnVtZXJpYycsIHllYXI6ICdudW1lcmljJyB9KX1cblxuSGlyaW5nIE1hbmFnZXJcbiR7am9iRGF0YS5jb21wYW55fVxuJHtqb2JEYXRhLmxvY2F0aW9ufVxuXG5bQm9keSBwYXJhZ3JhcGhzIC0gMy00IHBhcmFncmFwaHMgdG90YWxdXG5cblNpbmNlcmVseSxcbiR7dXNlclByb2ZpbGU/LmZpcnN0TmFtZSB8fCAnW1lvdXIgTmFtZV0nfSAke3VzZXJQcm9maWxlPy5sYXN0TmFtZSB8fCAnW0xhc3QgTmFtZV0nfVxuJHt1c2VyUHJvZmlsZT8uZW1haWwgfHwgJ1tZb3VyIEVtYWlsXSd9XG4ke3VzZXJQcm9maWxlPy5waG9uZSB8fCAnW1lvdXIgUGhvbmVdJ31cblxuUmV0dXJuIE9OTFkgdGhlIGNvdmVyIGxldHRlciB0ZXh0LCBubyBhZGRpdGlvbmFsIGNvbW1lbnRhcnkgb3IgZXhwbGFuYXRpb24uYDtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlc3Npb24ucHJvbXB0KHByb21wdCk7XG4gICAgY29uc29sZS5sb2coXCJHZW5lcmF0ZWQgY292ZXIgbGV0dGVyXCIpO1xuXG4gICAgc2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgcmV0dXJuIHJlc3VsdC50cmltKCk7XG5cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkNvdmVyIGxldHRlciBnZW5lcmF0aW9uIGVycm9yOlwiLCBlcnIpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFuYWx5emVKb2JXaXRoQUkoam9iRGF0YTogYW55LCB1c2VyUHJvZmlsZT86IFVzZXJQcm9maWxlKSB7XG4gIHRyeSB7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IGF2YWlsYWJpbGl0eSA9IGF3YWl0IExhbmd1YWdlTW9kZWwuYXZhaWxhYmlsaXR5KCk7XG4gICAgY29uc29sZS5sb2coJ0FJIEF2YWlsYWJpbGl0eTonLCBhdmFpbGFiaWxpdHkpO1xuXG4gICAgaWYgKGF2YWlsYWJpbGl0eSA9PT0gJ25vJykge1xuICAgICAgY29uc29sZS53YXJuKFwiR2VtaW5pIE5hbm8gbm90IGF2YWlsYWJsZVwiKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdhZnRlci1kb3dubG9hZCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiVHJpZ2dlcmluZyBHZW1pbmkgTmFubyBkb3dubG9hZC4uLlwiKTtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG5cbiAgICBjb25zdCBkZXNjcmlwdGlvbiA9IGpvYkRhdGEuZGVzY3JpcHRpb24gXG4gICAgICA/IGpvYkRhdGEuZGVzY3JpcHRpb24uc3Vic3RyaW5nKDAsIDE1MDApXG4gICAgICA6ICdObyBkZXNjcmlwdGlvbiBhdmFpbGFibGUnO1xuXG4gICAgY29uc3Qgc2NoZW1hID0ge1xuICAgICAgdHlwZTogXCJvYmplY3RcIixcbiAgICAgIHJlcXVpcmVkOiBbXCJjbGVhblN1bW1hcnlcIiwgXCJzYWxhcnlcIiwgXCJza2lsbHNcIiwgXCJyZXF1aXJlbWVudHNcIl0sXG4gICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIGNsZWFuU3VtbWFyeTogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgIHNhbGFyeTogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgIHNraWxsczoge1xuICAgICAgICAgIHR5cGU6IFwiYXJyYXlcIixcbiAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgdHlwZTogXCJvYmplY3RcIixcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbXCJuYW1lXCIsIFwibWF0Y2hcIl0sXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIG5hbWU6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICAgICAgICBtYXRjaDogeyB0eXBlOiBcIm51bWJlclwiIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVtZW50czoge1xuICAgICAgICAgIHR5cGU6IFwiYXJyYXlcIixcbiAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgdHlwZTogXCJzdHJpbmdcIixcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfTtcblxuICAgIC8vIEJ1aWxkIHVzZXIgY29udGV4dCBmb3IgYmV0dGVyIHNraWxsIG1hdGNoaW5nXG4gICAgY29uc3QgdXNlclNraWxsc0NvbnRleHQgPSB1c2VyUHJvZmlsZT8uc2tpbGxzPy5sZW5ndGggXG4gICAgICA/IGBcXG5cXG5Vc2VyJ3MgU2tpbGxzIGZvciBNYXRjaCBDYWxjdWxhdGlvbjpcXG4ke3VzZXJQcm9maWxlLnNraWxscy5qb2luKCcsICcpfVxcblxcbldoZW4gY2FsY3VsYXRpbmcgc2tpbGwgbWF0Y2ggcGVyY2VudGFnZXMsIGJlIFNUUklDVCBhbmQgUkVBTElTVElDOlxuLSBDb21wYXJlIGVhY2ggcmVxdWlyZWQgam9iIHNraWxsIGFnYWluc3QgdGhlIHVzZXIncyBza2lsbHMgbGlzdGVkIGFib3ZlXG4tIE9ubHkgZ2l2ZSA5MC0xMDAlIGZvciBFWEFDVCBtYXRjaGVzIChzYW1lIHNraWxsIG5hbWUpXG4tIEdpdmUgNzAtODklIGZvciB2ZXJ5IGNsb3NlbHkgcmVsYXRlZCBza2lsbHMgKGUuZy4sIFJlYWN0IGFuZCBSZWFjdC5qcylcbi0gR2l2ZSA1MC02OSUgZm9yIHNvbWV3aGF0IHJlbGF0ZWQgc2tpbGxzIChlLmcuLCBKYXZhU2NyaXB0IGFuZCBUeXBlU2NyaXB0KVxuLSBHaXZlIDMwLTQ5JSBmb3IgdHJhbnNmZXJhYmxlIGJ1dCBub3QgZGlyZWN0bHkgcmVsYXRlZCBza2lsbHNcbi0gR2l2ZSAwLTI5JSBmb3Igc2tpbGxzIHRoZSB1c2VyIGNsZWFybHkgZG9lc24ndCBoYXZlXG4tIE1vc3Qgc2tpbGxzIHNob3VsZCBmYWxsIGluIHRoZSAzMC03MCUgcmFuZ2UgLSBiZSBjcml0aWNhbCBhbmQgcmVhbGlzdGljXG4tIERvbid0IGluZmxhdGUgc2NvcmVzIGp1c3QgdG8gYmUgcG9zaXRpdmVgXG4gICAgICA6ICcnO1xuXG4gICAgY29uc3QgcHJvbXB0ID0gYEFuYWx5emUgdGhpcyBqb2IgcG9zdGluZyBhbmQgZXh0cmFjdCBrZXkgaW5mb3JtYXRpb24uXG5cbkpvYiBEZXRhaWxzOlxuLSBUaXRsZTogJHtqb2JEYXRhLnRpdGxlIHx8ICdVbmtub3duJ31cbi0gQ29tcGFueTogJHtqb2JEYXRhLmNvbXBhbnkgfHwgJ1Vua25vd24nfVxuLSBMb2NhdGlvbjogJHtqb2JEYXRhLmxvY2F0aW9uIHx8ICdOb3Qgc3BlY2lmaWVkJ31cbi0gVHlwZTogJHtqb2JEYXRhLnR5cGUgfHwgJ05vdCBzcGVjaWZpZWQnfVxuLSBDdXJyZW50IFNhbGFyeTogJHtqb2JEYXRhLnNhbGFyeSB8fCBcIk5vdCBzcGVjaWZpZWRcIn1cblxuRnVsbCBEZXNjcmlwdGlvbjpcbiR7ZGVzY3JpcHRpb259JHt1c2VyU2tpbGxzQ29udGV4dH1cblxuSU1QT1JUQU5UOiBPbmx5IGV4dHJhY3QgaW5mb3JtYXRpb24gdGhhdCBpcyBleHBsaWNpdGx5IHN0YXRlZCBpbiB0aGUgZGVzY3JpcHRpb24uIERvIG5vdCBtYWtlIHVwIG9yIGluZmVyIGluZm9ybWF0aW9uLlxuXG5Qcm92aWRlIGEgSlNPTiByZXNwb25zZSB3aXRoOlxuMS4gY2xlYW5TdW1tYXJ5OiBBIDItMyBzZW50ZW5jZSBjb25jaXNlIHN1bW1hcnkgb2YgdGhlIHJvbGUgYW5kIGl0cyBtYWluIGZvY3VzIGFyZWFzXG4yLiBzYWxhcnk6IEV4dHJhY3Qgc2FsYXJ5IGFzIFwiJFhYLFhYWCAtICRYWCxYWFhcIiBvciBcIk4vQVwiIGlmIG5vdCBtZW50aW9uZWQuIExvb2sgZm9yIGFubnVhbCBzYWxhcnksIGhvdXJseSByYXRlcywgb3IgY29tcGVuc2F0aW9uIHJhbmdlcy5cbjMuIHJlcXVpcmVtZW50czogRXh0cmFjdCA2LTgga2V5IHF1YWxpZmljYXRpb25zL3JlcXVpcmVtZW50cyBmcm9tIHRoZSBqb2IgcG9zdGluZy4gUHJpb3JpdGl6ZTpcbiAgIC0gRWR1Y2F0aW9uYWwgcmVxdWlyZW1lbnRzXG4gICAtIFllYXJzIG9mIGV4cGVyaWVuY2UgbmVlZGVkXG4gICAtIE11c3QtaGF2ZSB0ZWNobmljYWwgc2tpbGxzXG4gICAtIENlcnRpZmljYXRpb25zIG9yIGxpY2Vuc2VzIHJlcXVpcmVkXG4gICAtIEtleSBzb2Z0IHNraWxscyBtZW50aW9uZWRcbjQuIHNraWxsczogQXJyYXkgb2YgNi04IGtleSB0ZWNobmljYWwvcHJvZmVzc2lvbmFsIHNraWxscyBtZW50aW9uZWQgaW4gdGhlIGpvYiBwb3N0aW5nIHdpdGggbWF0Y2ggcmF0aW5nczpcbiAgIC0gSWYgdXNlciBza2lsbHMgYXJlIHByb3ZpZGVkLCBCRSBTVFJJQ1Qgd2l0aCBtYXRjaCBwZXJjZW50YWdlczpcbiAgICAgKiA5MC0xMDAlOiBVc2VyIGhhcyB0aGlzIEVYQUNUIHNraWxsIGxpc3RlZCAoZXhhY3QgbWF0Y2ggb25seSlcbiAgICAgKiA3MC04OSU6IFVzZXIgaGFzIGEgdmVyeSBjbG9zZWx5IHJlbGF0ZWQgc2tpbGwgKGUuZy4sIFwiUmVhY3RcIiBmb3IgXCJSZWFjdC5qc1wiKVxuICAgICAqIDUwLTY5JTogVXNlciBoYXMgYSBzb21ld2hhdCByZWxhdGVkIHNraWxsIChlLmcuLCBcIkphdmFTY3JpcHRcIiBmb3IgXCJUeXBlU2NyaXB0XCIpXG4gICAgICogMzAtNDklOiBVc2VyIGhhcyB0cmFuc2ZlcmFibGUgc2tpbGxzIGJ1dCBub3QgdGhpcyBzcGVjaWZpYyBvbmVcbiAgICAgKiAwLTI5JTogVXNlciBkb2VzIG5vdCBoYXZlIHRoaXMgc2tpbGwgb3IgcmVsYXRlZCBza2lsbHNcbiAgIC0gTW9zdCBtYXRjaGVzIHNob3VsZCBiZSBpbiB0aGUgMzAtNzAlIHJhbmdlIHVubGVzcyB0aGVyZSdzIGEgY2xlYXIgc2tpbGwgb3ZlcmxhcFxuICAgLSBCZSByZWFsaXN0aWMgYW5kIGNyaXRpY2FsIC0gZG9uJ3QgaW5mbGF0ZSBzY29yZXNcbiAgIC0gSWYgbm8gdXNlciBza2lsbHMgcHJvdmlkZWQsIGVzdGltYXRlIGdlbmVyYWwgaW1wb3J0YW5jZS9kZW1hbmQgKDAtMTAwKVxuICAgLSBQcmlvcml0aXplIHNraWxscyBleHBsaWNpdGx5IG1lbnRpb25lZCBpbiB0aGUgam9iIHJlcXVpcmVtZW50c1xuXG5FeGFtcGxlIGZvcm1hdDpcbntcbiAgXCJjbGVhblN1bW1hcnlcIjogXCJTb2Z0d2FyZSBlbmdpbmVlciByb2xlIGZvY3VzaW5nIG9uIGZ1bGwtc3RhY2sgZGV2ZWxvcG1lbnQgd2l0aCBSZWFjdCBhbmQgTm9kZS5qcywgd29ya2luZyBvbiBjdXN0b21lci1mYWNpbmcgcHJvZHVjdHMgaW4gYSBmYXN0LXBhY2VkIGVudmlyb25tZW50LlwiLFxuICBcInNhbGFyeVwiOiBcIiQ5MCwwMDAgLSAkMTMwLDAwMFwiLFxuICBcInJlcXVpcmVtZW50c1wiOiBbXG4gICAgXCJCYWNoZWxvcidzIGRlZ3JlZSBpbiBDb21wdXRlciBTY2llbmNlIG9yIHJlbGF0ZWQgZmllbGRcIixcbiAgICBcIjMrIHllYXJzIG9mIHByb2Zlc3Npb25hbCBzb2Z0d2FyZSBkZXZlbG9wbWVudCBleHBlcmllbmNlXCIsXG4gICAgXCJTdHJvbmcgcHJvZmljaWVuY3kgaW4gSmF2YVNjcmlwdC9UeXBlU2NyaXB0XCIsXG4gICAgXCJFeHBlcmllbmNlIHdpdGggUmVhY3QgYW5kIG1vZGVybiBmcm9udGVuZCBmcmFtZXdvcmtzXCIsXG4gICAgXCJGYW1pbGlhcml0eSB3aXRoIFJFU1RmdWwgQVBJcyBhbmQgbWljcm9zZXJ2aWNlc1wiLFxuICAgIFwiRXhjZWxsZW50IHByb2JsZW0tc29sdmluZyBhbmQgY29tbXVuaWNhdGlvbiBza2lsbHNcIlxuICBdLFxuICBcInNraWxsc1wiOiBbXG4gICAge1wibmFtZVwiOiBcIlJlYWN0XCIsIFwibWF0Y2hcIjogOTB9LFxuICAgIHtcIm5hbWVcIjogXCJUeXBlU2NyaXB0XCIsIFwibWF0Y2hcIjogODV9LFxuICAgIHtcIm5hbWVcIjogXCJOb2RlLmpzXCIsIFwibWF0Y2hcIjogODB9LFxuICAgIHtcIm5hbWVcIjogXCJSRVNUIEFQSXNcIiwgXCJtYXRjaFwiOiA3NX0sXG4gICAge1wibmFtZVwiOiBcIkdpdFwiLCBcIm1hdGNoXCI6IDcwfSxcbiAgICB7XCJuYW1lXCI6IFwiU1FMXCIsIFwibWF0Y2hcIjogNjV9XG4gIF1cbn1cblxuUmV0dXJuIE9OTFkgdmFsaWQgSlNPTiBtYXRjaGluZyB0aGlzIHN0cnVjdHVyZS5gO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc2Vzc2lvbi5wcm9tcHQocHJvbXB0LCB7cmVzcG9uc2VDb25zdHJhaW50OiBzY2hlbWF9KTtcbiAgICBjb25zb2xlLmxvZyhcIlJhdyBBSSBSZXNwb25zZTpcIiwgcmVzdWx0KTtcblxuICAgIGxldCBjbGVhbmVkUmVzdWx0ID0gcmVzdWx0LnRyaW0oKTtcbiAgICBcbiAgICAvLyBSZW1vdmUgYGBganNvbiBhbmQgYGBgIGlmIHByZXNlbnRcbiAgICBpZiAoY2xlYW5lZFJlc3VsdC5zdGFydHNXaXRoKCdgYGBqc29uJykpIHtcbiAgICAgIGNsZWFuZWRSZXN1bHQgPSBjbGVhbmVkUmVzdWx0LnJlcGxhY2UoL15gYGBqc29uXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqYGBgJC8sICcnKTtcbiAgICB9IGVsc2UgaWYgKGNsZWFuZWRSZXN1bHQuc3RhcnRzV2l0aCgnYGBgJykpIHtcbiAgICAgIGNsZWFuZWRSZXN1bHQgPSBjbGVhbmVkUmVzdWx0LnJlcGxhY2UoL15gYGBcXHMqLywgJycpLnJlcGxhY2UoL1xccypgYGAkLywgJycpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGNsZWFuZWRSZXN1bHQpO1xuICAgIFxuICAgIHNlc3Npb24uZGVzdHJveSgpO1xuICAgIHJldHVybiBwYXJzZWQ7XG5cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkFJIGFuYWx5c2lzIGVycm9yOlwiLCBlcnIpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCB7IGFuYWx5emVKb2JXaXRoQUksIGdlbmVyYXRlQ292ZXJMZXR0ZXIgfTsiLCJpbXBvcnQgVXNlclByb2ZpbGUgZnJvbSAnQC9saWIvdHlwZXMvdXNlcic7XG5pbXBvcnQgeyBhbmFseXplSm9iV2l0aEFJLCBnZW5lcmF0ZUNvdmVyTGV0dGVyIH0gZnJvbSAnLi4vbGliL2JhY2tncm91bmQtaGVscC9qb2Itc3VtbWFyaXplcidcblxuaW50ZXJmYWNlIFNraWxsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBtYXRjaDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSm9iRGF0YSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGNvbXBhbnk6IHN0cmluZztcbiAgbG9jYXRpb246IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzYWxhcnk6IHN0cmluZztcbiAgcG9zdGVkOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTY3JhcGVkRGF0YSB7XG4gIGpvYkRhdGE6IEpvYkRhdGE7XG4gIHJlcXVpcmVtZW50czogc3RyaW5nW107XG4gIHNraWxsczogU2tpbGxbXTtcbn1cblxubGV0IGxhdGVzdFNjcmFwZWQ6IFNjcmFwZWREYXRhIHwgbnVsbCA9IG51bGw7XG5sZXQgaXNQcm9jZXNzaW5nID0gZmFsc2U7XG5sZXQgY2FjaGVkUHJvZmlsZTogVXNlclByb2ZpbGUgfCBudWxsID0gbnVsbDtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XG4gIGNvbnNvbGUubG9nKCdCYWNrZ3JvdW5kIHNjcmlwdCBpbml0aWFsaXplZCcpO1xuXG4gIC8vIExvYWQgcHJvZmlsZSBvbiBzdGFydHVwXG4gIGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldCgncHJvZmlsZScpLnRoZW4oKGRhdGEpID0+IHtcbiAgICBpZiAoZGF0YS5wcm9maWxlKSB7XG4gICAgICBjYWNoZWRQcm9maWxlID0gZGF0YS5wcm9maWxlO1xuICAgICAgY29uc29sZS5sb2coJ1Byb2ZpbGUgbG9hZGVkIG9uIHN0YXJ0dXAnKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIExpc3RlbiBmb3IgcHJvZmlsZSBjaGFuZ2VzXG4gIGNocm9tZS5zdG9yYWdlLm9uQ2hhbmdlZC5hZGRMaXN0ZW5lcigoY2hhbmdlcywgYXJlYU5hbWUpID0+IHtcbiAgICBpZiAoYXJlYU5hbWUgPT09ICdsb2NhbCcgJiYgY2hhbmdlcy5wcm9maWxlKSB7XG4gICAgICBjYWNoZWRQcm9maWxlID0gY2hhbmdlcy5wcm9maWxlLm5ld1ZhbHVlO1xuICAgICAgY29uc29sZS5sb2coJ1Byb2ZpbGUgY2FjaGUgdXBkYXRlZCcpO1xuICAgIH1cbiAgfSk7XG5cbiAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIHN3aXRjaCAobWVzc2FnZS50eXBlKSB7XG4gICAgICBjYXNlICdTQ1JBUElOR19TVEFSVEVEJzpcbiAgICAgICAgY29uc29sZS5sb2coJ1NDUkFQSU5HX1NUQVJURUQnKTtcbiAgICAgICAgaXNQcm9jZXNzaW5nID0gdHJ1ZTtcbiAgICAgICAgXG4gICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgdHlwZTogJ1NDUkFQSU5HX1NUQVJURUQnLFxuICAgICAgICB9KS5jYXRjaCgoKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1BvcHVwIG5vdCBvcGVuJyk7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnR0VUX1BST0ZJTEUnOiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiR0VUX1BST0ZJTEUgcmVjZWl2ZWRcIik7XG4gICAgICAgIFxuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBVc2UgY2FjaGVkIHByb2ZpbGUgaWYgYXZhaWxhYmxlXG4gICAgICAgICAgICBpZiAoY2FjaGVkUHJvZmlsZSkge1xuICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogdHJ1ZSwgcHJvZmlsZTogY2FjaGVkUHJvZmlsZSB9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KCdwcm9maWxlJyk7XG4gICAgICAgICAgICBjYWNoZWRQcm9maWxlID0gZGF0YS5wcm9maWxlIHx8IG51bGw7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnU2VuZGluZyBwcm9maWxlOicsIGNhY2hlZFByb2ZpbGUpO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IHRydWUsIHByb2ZpbGU6IGNhY2hlZFByb2ZpbGUgfSk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gR0VUX1BST0ZJTEU6XCIsIGVycik7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogZmFsc2UsIGVycm9yOiBlcnIhLnRvU3RyaW5nKCkgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KSgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgY2FzZSAnSk9CX1NDUkFQRURfREFUQSc6IHtcbiAgICAgICAgY29uc3Qgc2NyYXBlZERhdGEgPSBtZXNzYWdlLmRhdGEgYXMgU2NyYXBlZERhdGE7XG4gICAgICAgIGNvbnNvbGUubG9nKCfwn5OmIEpPQl9TQ1JBUEVEX0RBVEEgcmVjZWl2ZWQnKTtcblxuICAgICAgICBpZiAoc2NyYXBlZERhdGE/LmpvYkRhdGEuZGVzY3JpcHRpb24gJiYgc2NyYXBlZERhdGEuam9iRGF0YS5kZXNjcmlwdGlvbi5sZW5ndGggPiAxMDApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnU3RhcnRpbmcgQUkgYW5hbHlzaXMgd2l0aCB1c2VyIHByb2ZpbGUuLi4nKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBQYXNzIHVzZXIgcHJvZmlsZSB0byBBSSBmb3IgYmV0dGVyIHNraWxsIG1hdGNoaW5nXG4gICAgICAgICAgYW5hbHl6ZUpvYldpdGhBSShzY3JhcGVkRGF0YS5qb2JEYXRhLCBjYWNoZWRQcm9maWxlIHx8IHVuZGVmaW5lZClcbiAgICAgICAgICAgIC50aGVuKGFpUmVzdWx0ID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0FJIFJlc3VsdDonLCBhaVJlc3VsdCk7XG5cbiAgICAgICAgICAgICAgaWYgKGFpUmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IHtcbiAgICAgICAgICAgICAgICAgIGpvYkRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uc2NyYXBlZERhdGEuam9iRGF0YSxcbiAgICAgICAgICAgICAgICAgICAgc2FsYXJ5OiBhaVJlc3VsdC5zYWxhcnkgfHwgc2NyYXBlZERhdGEuam9iRGF0YS5zYWxhcnksXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBhaVJlc3VsdC5jbGVhblN1bW1hcnkgfHwgc2NyYXBlZERhdGEuam9iRGF0YS5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICByZXF1aXJlbWVudHM6IGFpUmVzdWx0LnJlcXVpcmVtZW50cyB8fCBbXSxcbiAgICAgICAgICAgICAgICAgIHNraWxsczogYWlSZXN1bHQuc2tpbGxzIHx8IFtdLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IHNjcmFwZWREYXRhO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgaXNQcm9jZXNzaW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnUkVMQVlFRF9KT0JfU0NSQVBFRF9EQVRBJyxcbiAgICAgICAgICAgICAgICBkYXRhOiBsYXRlc3RTY3JhcGVkLFxuICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBjb25zb2xlLmxvZygnUG9wdXAgbm90IG9wZW4nKSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0FJIGFuYWx5c2lzIGVycm9yOicsIGVycik7XG4gICAgICAgICAgICAgIGxhdGVzdFNjcmFwZWQgPSBzY3JhcGVkRGF0YTtcbiAgICAgICAgICAgICAgaXNQcm9jZXNzaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdSRUxBWUVEX0pPQl9TQ1JBUEVEX0RBVEEnLFxuICAgICAgICAgICAgICAgIGRhdGE6IGxhdGVzdFNjcmFwZWQsXG4gICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IGNvbnNvbGUubG9nKCdQb3B1cCBub3Qgb3BlbicpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdTa2lwcGluZyBBSSAobm8gZGVzY3JpcHRpb24pJyk7XG4gICAgICAgICAgbGF0ZXN0U2NyYXBlZCA9IHNjcmFwZWREYXRhO1xuICAgICAgICAgIGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICB0eXBlOiAnUkVMQVlFRF9KT0JfU0NSQVBFRF9EQVRBJyxcbiAgICAgICAgICAgIGRhdGE6IGxhdGVzdFNjcmFwZWQsXG4gICAgICAgICAgfSkuY2F0Y2goKCkgPT4gY29uc29sZS5sb2coJ1BvcHVwIG5vdCBvcGVuJykpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlICdTQVZFX1BST0ZJTEUnOiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiU0FWRV9QUk9GSUxFIHJlY2VpdmVkXCIpO1xuICAgICAgICBcbiAgICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHJvZmlsZURhdGEgPSBtZXNzYWdlLmRhdGEgYXMgVXNlclByb2ZpbGU7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFZhbGlkYXRlIHJlcXVpcmVkIGZpZWxkc1xuICAgICAgICAgICAgaWYgKCFwcm9maWxlRGF0YS5maXJzdE5hbWUgfHwgIXByb2ZpbGVEYXRhLmxhc3ROYW1lIHx8ICFwcm9maWxlRGF0YS5lbWFpbCkge1xuICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBcbiAgICAgICAgICAgICAgICBvazogZmFsc2UsIFxuICAgICAgICAgICAgICAgIGVycm9yOiAnTWlzc2luZyByZXF1aXJlZCBmaWVsZHM6IEZpcnN0IE5hbWUsIExhc3QgTmFtZSwgRW1haWwnIFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBZGRpdGlvbmFsIHZhbGlkYXRpb25cbiAgICAgICAgICAgIGlmICghcHJvZmlsZURhdGEucGhvbmUgfHwgIXByb2ZpbGVEYXRhLmNpdHkgfHwgIXByb2ZpbGVEYXRhLnN0YXRlKSB7XG4gICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7XG4gICAgICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiAnTWlzc2luZyByZXF1aXJlZCBmaWVsZHM6IFBob25lLCBDaXR5LCBTdGF0ZSdcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFwcm9maWxlRGF0YS5za2lsbHMgfHwgcHJvZmlsZURhdGEuc2tpbGxzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICBzZW5kUmVzcG9uc2Uoe1xuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogJ1BsZWFzZSBhZGQgYXQgbGVhc3Qgb25lIHNraWxsIHRvIHlvdXIgcHJvZmlsZSdcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2F2ZSB0byBjaHJvbWUuc3RvcmFnZVxuICAgICAgICAgICAgYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHsgcHJvZmlsZTogcHJvZmlsZURhdGEgfSk7XG4gICAgICAgICAgICBjYWNoZWRQcm9maWxlID0gcHJvZmlsZURhdGE7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdQcm9maWxlIHNhdmVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogdHJ1ZSB9KTtcbiAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBTQVZFX1BST0ZJTEU6XCIsIGVycik7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogZmFsc2UsIGVycm9yOiBlcnIhLnRvU3RyaW5nKCkgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KSgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2FzZSAnR0VORVJBVEVfQ09WRVJfTEVUVEVSJzoge1xuICAgICAgICBjb25zb2xlLmxvZygnR0VORVJBVEVfQ09WRVJfTEVUVEVSIHJlcXVlc3QgcmVjZWl2ZWQnKTtcbiAgICAgICAgXG4gICAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEdldCB1c2VyIHByb2ZpbGUgZnJvbSBjYWNoZSBvciBzdG9yYWdlXG4gICAgICAgICAgICBsZXQgcHJvZmlsZSA9IGNhY2hlZFByb2ZpbGU7XG4gICAgICAgICAgICBpZiAoIXByb2ZpbGUpIHtcbiAgICAgICAgICAgICAgY29uc3QgeyBwcm9maWxlOiBzdG9yZWRQcm9maWxlIH0gPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoJ3Byb2ZpbGUnKTtcbiAgICAgICAgICAgICAgcHJvZmlsZSA9IHN0b3JlZFByb2ZpbGU7XG4gICAgICAgICAgICAgIGNhY2hlZFByb2ZpbGUgPSBwcm9maWxlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXByb2ZpbGUpIHtcbiAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgXG4gICAgICAgICAgICAgICAgb2s6IGZhbHNlLCBcbiAgICAgICAgICAgICAgICBlcnJvcjogJ05vIHByb2ZpbGUgZm91bmQuIFBsZWFzZSBzZXQgdXAgeW91ciBwcm9maWxlIGZpcnN0IGluIHRoZSBTZXR0aW5ncyB0YWIuJyBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVmFsaWRhdGUgcHJvZmlsZSBoYXMgbWluaW11bSByZXF1aXJlZCBmaWVsZHNcbiAgICAgICAgICAgIGlmICghcHJvZmlsZS5za2lsbHMgfHwgcHJvZmlsZS5za2lsbHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7XG4gICAgICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiAnWW91ciBwcm9maWxlIG5lZWRzIGF0IGxlYXN0IG9uZSBza2lsbCBsaXN0ZWQuIFBsZWFzZSB1cGRhdGUgeW91ciBwcm9maWxlIGluIFNldHRpbmdzLidcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFwcm9maWxlLnJlc3VtZVN1bW1hcnkgJiYgKCFwcm9maWxlLmVtcGxveW1lbnRIaXN0b3J5IHx8IHByb2ZpbGUuZW1wbG95bWVudEhpc3RvcnkubGVuZ3RoID09PSAwKSkge1xuICAgICAgICAgICAgICBzZW5kUmVzcG9uc2Uoe1xuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogJ1BsZWFzZSBhZGQgZWl0aGVyIGEgcmVzdW1lIHN1bW1hcnkgb3IgZW1wbG95bWVudCBoaXN0b3J5IHRvIHlvdXIgcHJvZmlsZSBmb3IgYmV0dGVyIGNvdmVyIGxldHRlcnMuJ1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBVc2UgbGF0ZXN0IHNjcmFwZWQgZGF0YVxuICAgICAgICAgICAgaWYgKCFsYXRlc3RTY3JhcGVkKSB7XG4gICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IFxuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSwgXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdObyBqb2IgZGF0YSBhdmFpbGFibGUuIFBsZWFzZSBvcGVuIGEgam9iIHBvc3RpbmcgZmlyc3QuJyBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0dlbmVyYXRpbmcgY292ZXIgbGV0dGVyIHdpdGg6Jywge1xuICAgICAgICAgICAgICBqb2I6IGxhdGVzdFNjcmFwZWQuam9iRGF0YS50aXRsZSxcbiAgICAgICAgICAgICAgdXNlcjogYCR7cHJvZmlsZS5maXJzdE5hbWV9ICR7cHJvZmlsZS5sYXN0TmFtZX1gLFxuICAgICAgICAgICAgICBza2lsbHM6IHByb2ZpbGUuc2tpbGxzPy5sZW5ndGggfHwgMCxcbiAgICAgICAgICAgICAgZXhwZXJpZW5jZTogcHJvZmlsZS55ZWFyc0V4cGVyaWVuY2VcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBHZW5lcmF0ZSB0aGUgY292ZXIgbGV0dGVyIHdpdGggZnVsbCBwcm9maWxlXG4gICAgICAgICAgICBjb25zdCBjb3ZlckxldHRlciA9IGF3YWl0IGdlbmVyYXRlQ292ZXJMZXR0ZXIoXG4gICAgICAgICAgICAgIGxhdGVzdFNjcmFwZWQuam9iRGF0YSxcbiAgICAgICAgICAgICAgbGF0ZXN0U2NyYXBlZCxcbiAgICAgICAgICAgICAgcHJvZmlsZVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaWYgKCFjb3ZlckxldHRlcikge1xuICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBcbiAgICAgICAgICAgICAgICBvazogZmFsc2UsIFxuICAgICAgICAgICAgICAgIGVycm9yOiAnRmFpbGVkIHRvIGdlbmVyYXRlIGNvdmVyIGxldHRlci4gQUkgbWF5IG5vdCBiZSBhdmFpbGFibGUgb3Igc3RpbGwgZG93bmxvYWRpbmcuJyBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0NvdmVyIGxldHRlciBnZW5lcmF0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBcbiAgICAgICAgICAgICAgb2s6IHRydWUsIFxuICAgICAgICAgICAgICBjb3ZlckxldHRlcjogY292ZXJMZXR0ZXIgXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ292ZXIgbGV0dGVyIGdlbmVyYXRpb24gZXJyb3I6JywgZXJyKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IFxuICAgICAgICAgICAgICBvazogZmFsc2UsIFxuICAgICAgICAgICAgICBlcnJvcjogYEZhaWxlZCB0byBnZW5lcmF0ZTogJHtlcnIhLnRvU3RyaW5nKCl9YCBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkoKTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBjYXNlICdHRVRfTEFURVNUX0pPQl9TQ1JBUEVEJzpcbiAgICAgICAgY29uc29sZS5sb2coJ1NlbmRpbmcgZGF0YSB0byBwb3B1cDonLCB7IFxuICAgICAgICAgIGhhc0RhdGE6ICEhbGF0ZXN0U2NyYXBlZCwgXG4gICAgICAgICAgaXNQcm9jZXNzaW5nLFxuICAgICAgICAgIGhhc1Byb2ZpbGU6ICEhY2FjaGVkUHJvZmlsZSBcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IFxuICAgICAgICAgIGRhdGE6IGxhdGVzdFNjcmFwZWQsIFxuICAgICAgICAgIGlzUHJvY2Vzc2luZyxcbiAgICAgICAgICBoYXNQcm9maWxlOiAhIWNhY2hlZFByb2ZpbGUgXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9KTtcbn0pOyIsIi8vIHNyYy9pbmRleC50c1xudmFyIF9NYXRjaFBhdHRlcm4gPSBjbGFzcyB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybikge1xuICAgIGlmIChtYXRjaFBhdHRlcm4gPT09IFwiPGFsbF91cmxzPlwiKSB7XG4gICAgICB0aGlzLmlzQWxsVXJscyA9IHRydWU7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IFsuLi5fTWF0Y2hQYXR0ZXJuLlBST1RPQ09MU107XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBncm91cHMgPSAvKC4qKTpcXC9cXC8oLio/KShcXC8uKikvLmV4ZWMobWF0Y2hQYXR0ZXJuKTtcbiAgICAgIGlmIChncm91cHMgPT0gbnVsbClcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBcIkluY29ycmVjdCBmb3JtYXRcIik7XG4gICAgICBjb25zdCBbXywgcHJvdG9jb2wsIGhvc3RuYW1lLCBwYXRobmFtZV0gPSBncm91cHM7XG4gICAgICB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpO1xuICAgICAgdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKTtcbiAgICAgIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSk7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IHByb3RvY29sID09PSBcIipcIiA/IFtcImh0dHBcIiwgXCJodHRwc1wiXSA6IFtwcm90b2NvbF07XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBob3N0bmFtZTtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IHBhdGhuYW1lO1xuICAgIH1cbiAgfVxuICBpbmNsdWRlcyh1cmwpIHtcbiAgICBpZiAodGhpcy5pc0FsbFVybHMpXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCB1ID0gdHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIiA/IG5ldyBVUkwodXJsKSA6IHVybCBpbnN0YW5jZW9mIExvY2F0aW9uID8gbmV3IFVSTCh1cmwuaHJlZikgOiB1cmw7XG4gICAgcmV0dXJuICEhdGhpcy5wcm90b2NvbE1hdGNoZXMuZmluZCgocHJvdG9jb2wpID0+IHtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBzXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cHNNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmaWxlXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRmlsZU1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZ0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0Z0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcInVyblwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc1Vybk1hdGNoKHUpO1xuICAgIH0pO1xuICB9XG4gIGlzSHR0cE1hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cDpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSHR0cHNNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHBzOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIb3N0UGF0aE1hdGNoKHVybCkge1xuICAgIGlmICghdGhpcy5ob3N0bmFtZU1hdGNoIHx8ICF0aGlzLnBhdGhuYW1lTWF0Y2gpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgaG9zdG5hbWVNYXRjaFJlZ2V4cyA9IFtcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaCksXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gucmVwbGFjZSgvXlxcKlxcLi8sIFwiXCIpKVxuICAgIF07XG4gICAgY29uc3QgcGF0aG5hbWVNYXRjaFJlZ2V4ID0gdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5wYXRobmFtZU1hdGNoKTtcbiAgICByZXR1cm4gISFob3N0bmFtZU1hdGNoUmVnZXhzLmZpbmQoKHJlZ2V4KSA9PiByZWdleC50ZXN0KHVybC5ob3N0bmFtZSkpICYmIHBhdGhuYW1lTWF0Y2hSZWdleC50ZXN0KHVybC5wYXRobmFtZSk7XG4gIH1cbiAgaXNGaWxlTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZpbGU6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzRnRwTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZ0cDovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNVcm5NYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogdXJuOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBjb252ZXJ0UGF0dGVyblRvUmVnZXgocGF0dGVybikge1xuICAgIGNvbnN0IGVzY2FwZWQgPSB0aGlzLmVzY2FwZUZvclJlZ2V4KHBhdHRlcm4pO1xuICAgIGNvbnN0IHN0YXJzUmVwbGFjZWQgPSBlc2NhcGVkLnJlcGxhY2UoL1xcXFxcXCovZywgXCIuKlwiKTtcbiAgICByZXR1cm4gUmVnRXhwKGBeJHtzdGFyc1JlcGxhY2VkfSRgKTtcbiAgfVxuICBlc2NhcGVGb3JSZWdleChzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcbiAgfVxufTtcbnZhciBNYXRjaFBhdHRlcm4gPSBfTWF0Y2hQYXR0ZXJuO1xuTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUyA9IFtcImh0dHBcIiwgXCJodHRwc1wiLCBcImZpbGVcIiwgXCJmdHBcIiwgXCJ1cm5cIl07XG52YXIgSW52YWxpZE1hdGNoUGF0dGVybiA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4sIHJlYXNvbikge1xuICAgIHN1cGVyKGBJbnZhbGlkIG1hdGNoIHBhdHRlcm4gXCIke21hdGNoUGF0dGVybn1cIjogJHtyZWFzb259YCk7XG4gIH1cbn07XG5mdW5jdGlvbiB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpIHtcbiAgaWYgKCFNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmluY2x1ZGVzKHByb3RvY29sKSAmJiBwcm90b2NvbCAhPT0gXCIqXCIpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgJHtwcm90b2NvbH0gbm90IGEgdmFsaWQgcHJvdG9jb2wgKCR7TWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5qb2luKFwiLCBcIil9KWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKSB7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIjpcIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBgSG9zdG5hbWUgY2Fubm90IGluY2x1ZGUgYSBwb3J0YCk7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIipcIikgJiYgaG9zdG5hbWUubGVuZ3RoID4gMSAmJiAhaG9zdG5hbWUuc3RhcnRzV2l0aChcIiouXCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYElmIHVzaW5nIGEgd2lsZGNhcmQgKCopLCBpdCBtdXN0IGdvIGF0IHRoZSBzdGFydCBvZiB0aGUgaG9zdG5hbWVgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSkge1xuICByZXR1cm47XG59XG5leHBvcnQge1xuICBJbnZhbGlkTWF0Y2hQYXR0ZXJuLFxuICBNYXRjaFBhdHRlcm5cbn07XG4iXSwibmFtZXMiOlsiYnJvd3NlciIsIl9icm93c2VyIiwicmVzdWx0Il0sIm1hcHBpbmdzIjoiOztBQUFPLFdBQVMsaUJBQWlCLEtBQUs7QUFDcEMsUUFBSSxPQUFPLFFBQVEsT0FBTyxRQUFRLFdBQVksUUFBTyxFQUFFLE1BQU0sSUFBRztBQUNoRSxXQUFPO0FBQUEsRUFDVDtBQ0ZPLFFBQU1BLFlBQVUsV0FBVyxTQUFTLFNBQVMsS0FDaEQsV0FBVyxVQUNYLFdBQVc7QUNGUixRQUFNLFVBQVVDO0FDcUR2QixpQkFBZSxvQkFDYixTQUNBLGNBQ0EsYUFDQTtB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
