var content = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const definition = defineContentScript({
    matches: [
      "*://*.greenhouse.io/*",
      "*://*.lever.co/*",
      "*://*.myworkdayjobs.com/*",
      "*://linkedin.com/jobs/*/apply/*",
      "*://*.linkedin.com/jobs/*/apply/*",
      "*://*.workday.com/*",
      "*://*.icims.com/*",
      "*://*.taleo.net/*"
    ],
    async main() {
      console.log("Auto-fill script loaded");
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "start-auto-fill") {
          console.log("Received auto-fill request");
          chrome.runtime.sendMessage({ type: "GET_PROFILE" }, (response) => {
            if (chrome.runtime.lastError) {
              console.error("Background error:", chrome.runtime.lastError);
              return;
            }
            console.log("Got profile");
            handleAutoFillClick(response.profile);
          });
        }
      });
    }
  });
  async function handleAutoFillClick(profile) {
    try {
      if (!profile) {
        alert("Please set up your profile first in the extension!");
        return;
      }
      const result2 = await autoFillForm(profile);
      showSuccessMessage(result2.filled, result2.aiAnswered);
    } catch (error) {
      console.error("Auto-fill error:", error);
      alert("Something went wrong. Please try again.");
    }
  }
  function showSuccessMessage(filledCount, aiCount) {
    const notification = document.createElement("div");
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10001;
    padding: 16px 24px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 14px;
  `;
    notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 24px;">✅</span>
      <div>
        <div style="font-weight: 600; color: #10b981;">Auto-fill Complete!</div>
        <div style="color: #6b7280; font-size: 12px; margin-top: 4px;">
          Filled ${filledCount} fields${aiCount > 0 ? ` + ${aiCount} AI answers` : ""}
        </div>
      </div>
    </div>
  `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3e3);
  }
  function getAllFields() {
    const fields = [];
    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="file"])'
    );
    const textareas = document.querySelectorAll("textarea");
    const selects = document.querySelectorAll("select");
    [...inputs, ...textareas, ...selects].forEach((element) => {
      if ("value" in element && element.value && element.value.trim() !== "") {
        return;
      }
      const allTextSources = getFieldTextSources(element);
      const detection = detectFieldType(element, allTextSources);
      fields.push({
        element,
        type: detection.type,
        label: allTextSources.join(" | "),
        required: isFieldRequired(element, allTextSources),
        confidence: detection.confidence
      });
    });
    console.log(`Detected ${fields.length} fields`);
    console.log("Field types:", fields.map((f) => ({ type: f.type, label: f.label.substring(0, 50), confidence: f.confidence })));
    return fields;
  }
  function getFieldTextSources(field) {
    const sources = [];
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label?.textContent) {
        sources.push(label.textContent.trim());
      }
    }
    const parentLabel = field.closest("label");
    if (parentLabel?.textContent) {
      sources.push(parentLabel.textContent.trim());
    }
    let prev = field.previousElementSibling;
    let attempts = 0;
    while (prev && attempts < 3) {
      if (prev.tagName === "LABEL" && prev.textContent) {
        sources.push(prev.textContent.trim());
        break;
      }
      if (prev.textContent && prev.textContent.trim().length < 100) {
        sources.push(prev.textContent.trim());
      }
      prev = prev.previousElementSibling;
      attempts++;
    }
    const parent = field.closest("div, fieldset, li, td, th");
    if (parent) {
      const labelEl = parent.querySelector("label, legend");
      if (labelEl?.textContent) {
        sources.push(labelEl.textContent.trim());
      }
      const spans = parent.querySelectorAll("span, div");
      spans.forEach((span) => {
        const text = span.textContent?.trim();
        if (text && text.length < 100 && text.length > 2) {
          if (parent.contains(span) && parent.contains(field)) {
            sources.push(text);
          }
        }
      });
    }
    const ariaLabel = field.getAttribute("aria-label");
    if (ariaLabel) sources.push(ariaLabel);
    const ariaLabelledBy = field.getAttribute("aria-labelledby");
    if (ariaLabelledBy) {
      const labelEl = document.getElementById(ariaLabelledBy);
      if (labelEl?.textContent) sources.push(labelEl.textContent.trim());
    }
    const title = field.getAttribute("title");
    if (title) sources.push(title);
    if ("placeholder" in field) {
      const inputElement = field;
      if (inputElement.placeholder) {
        sources.push(inputElement.placeholder);
      }
    }
    if (field.name) sources.push(field.name);
    if (field.id) sources.push(field.id);
    if (field.className) {
      const classHints = field.className.split(/[\s_-]/).filter((c) => c.length > 2);
      sources.push(...classHints);
    }
    for (const attr of field.attributes) {
      if (attr.name.startsWith("data-") && attr.value && attr.value.length < 50) {
        sources.push(attr.value);
      }
    }
    const unique = [...new Set(sources)].map((s) => s.replace(/\*/g, "").trim()).filter((s) => s.length > 0);
    return unique;
  }
  function detectFieldType(field, textSources) {
    const combinedText = textSources.join(" ").toLowerCase();
    const fieldType = "type" in field ? field.type : "";
    const autocomplete = field.getAttribute("autocomplete")?.toLowerCase() || "";
    if (autocomplete) {
      const autocompleteMap = {
        "given-name": "firstName",
        "family-name": "lastName",
        "name": "fullName",
        "email": "email",
        "tel": "phone",
        "street-address": "address",
        "address-line1": "address",
        "address-level2": "city",
        "address-level1": "state",
        "postal-code": "zip",
        "organization": "currentCompany",
        "organization-title": "currentTitle"
      };
      if (autocompleteMap[autocomplete]) {
        return { type: autocompleteMap[autocomplete], confidence: 95 };
      }
    }
    if (fieldType === "email") {
      return { type: "email", confidence: 95 };
    }
    if (fieldType === "tel") {
      return { type: "phone", confidence: 95 };
    }
    const patterns = [
      // High confidence patterns
      { keywords: ["first name", "firstname", "fname", "given name", "forename"], type: "firstName", confidence: 90 },
      { keywords: ["last name", "lastname", "lname", "surname", "family name"], type: "lastName", confidence: 90 },
      { keywords: ["email", "e-mail", "emailaddress"], type: "email", confidence: 85 },
      { keywords: ["phone", "telephone", "mobile", "phonenumber"], type: "phone", confidence: 85 },
      // Medium confidence patterns
      { keywords: ["full name", "your name", "name"], type: "fullName", confidence: 70 },
      { keywords: ["street", "address line", "address1", "addressline"], type: "address", confidence: 80 },
      { keywords: ["city", "town", "locality"], type: "city", confidence: 85 },
      { keywords: ["state", "province", "region"], type: "state", confidence: 80 },
      { keywords: ["zip", "postal", "postcode", "zipcode"], type: "zip", confidence: 85 },
      // Professional
      { keywords: ["job title", "position", "role", "jobtitle"], type: "currentTitle", confidence: 75 },
      { keywords: ["company", "employer", "organization", "companyname"], type: "currentCompany", confidence: 75 },
      { keywords: ["years experience", "yearsexperience", "experience years"], type: "yearsExperience", confidence: 80 },
      // Education & Links
      { keywords: ["education", "degree", "university", "school"], type: "education", confidence: 75 },
      { keywords: ["linkedin", "linkedin profile", "linkedinurl"], type: "linkedin", confidence: 90 },
      { keywords: ["github", "github profile", "githuburl"], type: "github", confidence: 90 },
      { keywords: ["portfolio", "website", "personal site"], type: "portfolio", confidence: 75 },
      { keywords: ["salary", "compensation", "expected salary", "desiredsalary"], type: "salaryExpectation", confidence: 80 },
      // Checkboxes
      { keywords: ["sponsor", "visa", "authorization", "work auth"], type: "sponsorship", confidence: 85 },
      { keywords: ["relocate", "relocation", "willing to move"], type: "relocation", confidence: 85 }
    ];
    for (const pattern of patterns) {
      for (const keyword of pattern.keywords) {
        if (combinedText.includes(keyword.toLowerCase())) {
          const matchCount = textSources.filter(
            (s) => s.toLowerCase().includes(keyword.toLowerCase())
          ).length;
          const boostedConfidence = Math.min(100, pattern.confidence + matchCount * 5);
          return { type: pattern.type, confidence: boostedConfidence };
        }
      }
    }
    if (field.tagName === "TEXTAREA" || fieldType === "text") {
      const hasQuestionMark = textSources.some((s) => s.includes("?"));
      const hasQuestionWords = textSources.some(
        (s) => /\b(why|how|what|describe|tell|explain)\b/i.test(s)
      );
      const isLongLabel = textSources.some((s) => s.length > 30);
      if (hasQuestionMark || hasQuestionWords && isLongLabel) {
        return { type: "customQuestion", confidence: 70 };
      }
    }
    return { type: null, confidence: 0 };
  }
  function isFieldRequired(field, textSources) {
    if ("required" in field && field.required) return true;
    if (field.getAttribute("aria-required") === "true") return true;
    return textSources.some(
      (text) => text.includes("*") || text.toLowerCase().includes("required") || text.toLowerCase().includes("mandatory")
    );
  }
  async function autoFillForm(profile) {
    const fields = getAllFields();
    fields.sort((a, b) => b.confidence - a.confidence);
    let filledCount = 0;
    let aiAnsweredCount = 0;
    const customQuestions = [];
    for (const fieldInfo of fields) {
      if (!fieldInfo.type) continue;
      if (fieldInfo.type === "customQuestion") {
        customQuestions.push(fieldInfo);
        continue;
      }
      if (fieldInfo.confidence >= 60) {
        const success = fillField(fieldInfo, profile);
        if (success) {
          console.log(`Filled: ${fieldInfo.type} (confidence: ${fieldInfo.confidence})`);
          filledCount++;
        }
      }
    }
    console.log(`Filled ${filledCount} standard fields`);
    if (customQuestions.length > 0) {
      console.log(`Found ${customQuestions.length} custom questions`);
      const jobContext = extractJobContext();
      for (const fieldInfo of customQuestions) {
        if (fieldInfo.confidence >= 60) {
          const answer = await answerCustomQuestion(fieldInfo.label, profile, jobContext);
          if (answer) {
            fillTextField(fieldInfo.element, answer);
            aiAnsweredCount++;
          }
        }
      }
    }
    return {
      filled: filledCount,
      aiAnswered: aiAnsweredCount
    };
  }
  function fillField(fieldInfo, profile) {
    const { element, type } = fieldInfo;
    const value = getValueForFieldType(type, profile);
    if (value === null || value === void 0 || value === "") return false;
    if (element.tagName === "SELECT") {
      return fillSelect(element, value);
    } else if ("type" in element && element.type === "checkbox") {
      return fillCheckbox(element, value);
    } else if ("type" in element && element.type === "radio") {
      return fillRadio(element, value);
    } else {
      return fillTextField(element, value);
    }
  }
  function getValueForFieldType(type, profile) {
    if (!type) return null;
    const currentJob = (profile.employmentHistory || []).find((job) => job.isCurrent);
    const mostRecentJob = (profile.employmentHistory || [])[0];
    const jobToUse = currentJob || mostRecentJob;
    const valueMap = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: `${profile.firstName} ${profile.lastName}`,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zip: profile.zip,
      currentTitle: jobToUse?.jobTitle || "",
      currentCompany: jobToUse?.company || "",
      yearsExperience: profile.yearsExperience,
      education: profile.education,
      linkedin: profile.linkedin,
      github: profile.github,
      portfolio: profile.portfolio,
      salaryExpectation: profile.salaryExpectation,
      sponsorship: profile.needsSponsorship ? "yes" : "no",
      relocation: profile.willingToRelocate ? "yes" : "no"
    };
    return valueMap[type];
  }
  function fillTextField(field, value) {
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    field.dispatchEvent(new Event("blur", { bubbles: true }));
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return true;
  }
  function fillSelect(select, value) {
    const options = Array.from(select.options);
    let match = options.find((opt) => opt.value === value || opt.text === value);
    if (!match) {
      const valueLower = value.toString().toLowerCase();
      match = options.find(
        (opt) => opt.value.toLowerCase().includes(valueLower) || opt.text.toLowerCase().includes(valueLower)
      );
    }
    if (!match && !isNaN(value)) {
      match = options.find((opt) => opt.value === value.toString());
    }
    if (match) {
      select.value = match.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }
  function fillCheckbox(checkbox, value) {
    const shouldCheck = value === true || value === "yes" || value === "true";
    checkbox.checked = shouldCheck;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function fillRadio(radio, value) {
    const radios = document.querySelectorAll(`input[name="${radio.name}"]`);
    const valueLower = value.toString().toLowerCase();
    const match = Array.from(radios).find((r) => {
      const sources = getFieldTextSources(r);
      return sources.some((s) => s.toLowerCase().includes(valueLower));
    });
    if (match) {
      match.checked = true;
      match.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }
  function extractJobContext() {
    const title = document.querySelector("h1")?.textContent || document.querySelector('[class*="job-title"]')?.textContent || document.querySelector('[class*="JobTitle"]')?.textContent || "this position";
    const company = document.querySelector('[class*="company"]')?.textContent || document.querySelector('[class*="Company"]')?.textContent || "this company";
    return {
      title: title.trim(),
      company: company.trim()
    };
  }
  async function answerCustomQuestion(question, profile, jobContext) {
    const currentJob = (profile.employmentHistory || []).find((job) => job.isCurrent);
    const mostRecentJob = (profile.employmentHistory || [])[0];
    const jobToReference = currentJob || mostRecentJob;
    const currentRole = jobToReference?.jobTitle || "Not specified";
    const currentCompany = jobToReference?.company || "";
    const skillsStr = (profile.skills || []).join(", ") || "Not specified";
    let experienceSummary = "";
    if (profile.employmentHistory && profile.employmentHistory.length > 0) {
      experienceSummary = profile.employmentHistory.slice(0, 2).map(
        (job) => `${job.jobTitle} at ${job.company} (${job.startDate} - ${job.isCurrent ? "Present" : job.endDate})`
      ).join("; ");
    }
    const prompt = `You are helping someone fill out a job application. Answer this question professionally and concisely (max 100 words):

Question: "${question}"

Job Applying For: ${jobContext.title} at ${jobContext.company}

Candidate Profile:
- Name: ${profile.firstName} ${profile.lastName}
- Current/Recent Role: ${currentRole}${currentCompany ? ` at ${currentCompany}` : ""}
- Total Experience: ${profile.yearsExperience || 0} years
- Key Skills: ${skillsStr}
${experienceSummary ? `- Work History: ${experienceSummary}` : ""}
${profile.education ? `- Education: ${profile.education}` : ""}

Provide only the answer, no preamble or explanation. Be specific and relevant to both the question and the job.`;
    try {
      const availability = await ai.languageModel.availability();
      if (availability === "no") return null;
      if (availability === "after-download") {
        await ai.languageModel.create();
        return null;
      }
      const session = await ai.languageModel.create();
      const result2 = await session.prompt(prompt);
      session.destroy();
      return result2.trim();
    } catch (error) {
      console.error("AI answering failed:", error);
      return null;
    }
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  function print$1(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger$1 = {
    debug: (...args) => print$1(console.debug, ...args),
    log: (...args) => print$1(console.log, ...args),
    warn: (...args) => print$1(console.warn, ...args),
    error: (...args) => print$1(console.error, ...args)
  };
  class WxtLocationChangeEvent extends Event {
    constructor(newUrl, oldUrl) {
      super(WxtLocationChangeEvent.EVENT_NAME, {});
      this.newUrl = newUrl;
      this.oldUrl = oldUrl;
    }
    static EVENT_NAME = getUniqueEventName("wxt:locationchange");
  }
  function getUniqueEventName(eventName) {
    return `${browser?.runtime?.id}:${"content"}:${eventName}`;
  }
  function createLocationWatcher(ctx) {
    let interval;
    let oldUrl;
    return {
      /**
       * Ensure the location watcher is actively looking for URL changes. If it's already watching,
       * this is a noop.
       */
      run() {
        if (interval != null) return;
        oldUrl = new URL(location.href);
        interval = ctx.setInterval(() => {
          let newUrl = new URL(location.href);
          if (newUrl.href !== oldUrl.href) {
            window.dispatchEvent(new WxtLocationChangeEvent(newUrl, oldUrl));
            oldUrl = newUrl;
          }
        }, 1e3);
      }
    };
  }
  class ContentScriptContext {
    constructor(contentScriptName, options) {
      this.contentScriptName = contentScriptName;
      this.options = options;
      this.abortController = new AbortController();
      if (this.isTopFrame) {
        this.listenForNewerScripts({ ignoreFirstEvent: true });
        this.stopOldScripts();
      } else {
        this.listenForNewerScripts();
      }
    }
    static SCRIPT_STARTED_MESSAGE_TYPE = getUniqueEventName(
      "wxt:content-script-started"
    );
    isTopFrame = window.self === window.top;
    abortController;
    locationWatcher = createLocationWatcher(this);
    receivedMessageIds = /* @__PURE__ */ new Set();
    get signal() {
      return this.abortController.signal;
    }
    abort(reason) {
      return this.abortController.abort(reason);
    }
    get isInvalid() {
      if (browser.runtime.id == null) {
        this.notifyInvalidated();
      }
      return this.signal.aborted;
    }
    get isValid() {
      return !this.isInvalid;
    }
    /**
     * Add a listener that is called when the content script's context is invalidated.
     *
     * @returns A function to remove the listener.
     *
     * @example
     * browser.runtime.onMessage.addListener(cb);
     * const removeInvalidatedListener = ctx.onInvalidated(() => {
     *   browser.runtime.onMessage.removeListener(cb);
     * })
     * // ...
     * removeInvalidatedListener();
     */
    onInvalidated(cb) {
      this.signal.addEventListener("abort", cb);
      return () => this.signal.removeEventListener("abort", cb);
    }
    /**
     * Return a promise that never resolves. Useful if you have an async function that shouldn't run
     * after the context is expired.
     *
     * @example
     * const getValueFromStorage = async () => {
     *   if (ctx.isInvalid) return ctx.block();
     *
     *   // ...
     * }
     */
    block() {
      return new Promise(() => {
      });
    }
    /**
     * Wrapper around `window.setInterval` that automatically clears the interval when invalidated.
     *
     * Intervals can be cleared by calling the normal `clearInterval` function.
     */
    setInterval(handler, timeout) {
      const id = setInterval(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearInterval(id));
      return id;
    }
    /**
     * Wrapper around `window.setTimeout` that automatically clears the interval when invalidated.
     *
     * Timeouts can be cleared by calling the normal `setTimeout` function.
     */
    setTimeout(handler, timeout) {
      const id = setTimeout(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearTimeout(id));
      return id;
    }
    /**
     * Wrapper around `window.requestAnimationFrame` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelAnimationFrame` function.
     */
    requestAnimationFrame(callback) {
      const id = requestAnimationFrame((...args) => {
        if (this.isValid) callback(...args);
      });
      this.onInvalidated(() => cancelAnimationFrame(id));
      return id;
    }
    /**
     * Wrapper around `window.requestIdleCallback` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelIdleCallback` function.
     */
    requestIdleCallback(callback, options) {
      const id = requestIdleCallback((...args) => {
        if (!this.signal.aborted) callback(...args);
      }, options);
      this.onInvalidated(() => cancelIdleCallback(id));
      return id;
    }
    addEventListener(target, type, handler, options) {
      if (type === "wxt:locationchange") {
        if (this.isValid) this.locationWatcher.run();
      }
      target.addEventListener?.(
        type.startsWith("wxt:") ? getUniqueEventName(type) : type,
        handler,
        {
          ...options,
          signal: this.signal
        }
      );
    }
    /**
     * @internal
     * Abort the abort controller and execute all `onInvalidated` listeners.
     */
    notifyInvalidated() {
      this.abort("Content script context invalidated");
      logger$1.debug(
        `Content script "${this.contentScriptName}" context invalidated`
      );
    }
    stopOldScripts() {
      window.postMessage(
        {
          type: ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE,
          contentScriptName: this.contentScriptName,
          messageId: Math.random().toString(36).slice(2)
        },
        "*"
      );
    }
    verifyScriptStartedEvent(event) {
      const isScriptStartedEvent = event.data?.type === ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE;
      const isSameContentScript = event.data?.contentScriptName === this.contentScriptName;
      const isNotDuplicate = !this.receivedMessageIds.has(event.data?.messageId);
      return isScriptStartedEvent && isSameContentScript && isNotDuplicate;
    }
    listenForNewerScripts(options) {
      let isFirst = true;
      const cb = (event) => {
        if (this.verifyScriptStartedEvent(event)) {
          this.receivedMessageIds.add(event.data.messageId);
          const wasFirst = isFirst;
          isFirst = false;
          if (wasFirst && options?.ignoreFirstEvent) return;
          this.notifyInvalidated();
        }
      };
      addEventListener("message", cb);
      this.onInvalidated(() => removeEventListener("message", cb));
    }
  }
  function initPlugins() {
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
  const result = (async () => {
    try {
      initPlugins();
      const { main, ...options } = definition;
      const ctx = new ContentScriptContext("content", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"content"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9zcmMvZW50cnlwb2ludHMvY29udGVudC50cyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiaW1wb3J0IHR5cGUgVXNlclByb2ZpbGUgZnJvbSAnQC9saWIvdHlwZXMvdXNlcic7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbnRlbnRTY3JpcHQoe1xuICBtYXRjaGVzOiBbXG4gICAgJyo6Ly8qLmdyZWVuaG91c2UuaW8vKicsXG4gICAgJyo6Ly8qLmxldmVyLmNvLyonLFxuICAgICcqOi8vKi5teXdvcmtkYXlqb2JzLmNvbS8qJyxcbiAgICAnKjovL2xpbmtlZGluLmNvbS9qb2JzLyovYXBwbHkvKicsXG4gICAgJyo6Ly8qLmxpbmtlZGluLmNvbS9qb2JzLyovYXBwbHkvKicsXG4gICAgJyo6Ly8qLndvcmtkYXkuY29tLyonLFxuICAgICcqOi8vKi5pY2ltcy5jb20vKicsXG4gICAgJyo6Ly8qLnRhbGVvLm5ldC8qJ1xuICBdLFxuICBcbiAgYXN5bmMgbWFpbigpIHtcbiAgICBjb25zb2xlLmxvZygnQXV0by1maWxsIHNjcmlwdCBsb2FkZWQnKTtcbiAgICBcbiAgICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UsIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgICBpZiAobWVzc2FnZS5hY3Rpb24gPT09IFwic3RhcnQtYXV0by1maWxsXCIpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJSZWNlaXZlZCBhdXRvLWZpbGwgcmVxdWVzdFwiKTtcblxuICAgICAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7IHR5cGU6IFwiR0VUX1BST0ZJTEVcIiB9LCAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiQmFja2dyb3VuZCBlcnJvcjpcIiwgY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc29sZS5sb2coXCJHb3QgcHJvZmlsZVwiKTtcbiAgICAgICAgICBoYW5kbGVBdXRvRmlsbENsaWNrKHJlc3BvbnNlLnByb2ZpbGUpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSk7XG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUF1dG9GaWxsQ2xpY2socHJvZmlsZTogVXNlclByb2ZpbGUpIHtcbiAgdHJ5IHtcbiAgICBpZiAoIXByb2ZpbGUpIHtcbiAgICAgIGFsZXJ0KCdQbGVhc2Ugc2V0IHVwIHlvdXIgcHJvZmlsZSBmaXJzdCBpbiB0aGUgZXh0ZW5zaW9uIScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhdXRvRmlsbEZvcm0ocHJvZmlsZSk7XG4gICAgc2hvd1N1Y2Nlc3NNZXNzYWdlKHJlc3VsdC5maWxsZWQsIHJlc3VsdC5haUFuc3dlcmVkKTtcbiAgICBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdBdXRvLWZpbGwgZXJyb3I6JywgZXJyb3IpO1xuICAgIGFsZXJ0KCdTb21ldGhpbmcgd2VudCB3cm9uZy4gUGxlYXNlIHRyeSBhZ2Fpbi4nKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzaG93U3VjY2Vzc01lc3NhZ2UoZmlsbGVkQ291bnQ6IG51bWJlciwgYWlDb3VudDogbnVtYmVyKSB7XG4gIGNvbnN0IG5vdGlmaWNhdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBub3RpZmljYXRpb24uc3R5bGUuY3NzVGV4dCA9IGBcbiAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgdG9wOiAyMHB4O1xuICAgIHJpZ2h0OiAyMHB4O1xuICAgIHotaW5kZXg6IDEwMDAxO1xuICAgIHBhZGRpbmc6IDE2cHggMjRweDtcbiAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgYm94LXNoYWRvdzogMCA0cHggMTJweCByZ2JhKDAsMCwwLDAuMTUpO1xuICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgYDtcbiAgXG4gIG5vdGlmaWNhdGlvbi5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTJweDtcIj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiZm9udC1zaXplOiAyNHB4O1wiPuKchTwvc3Bhbj5cbiAgICAgIDxkaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXdlaWdodDogNjAwOyBjb2xvcjogIzEwYjk4MTtcIj5BdXRvLWZpbGwgQ29tcGxldGUhPC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjogIzZiNzI4MDsgZm9udC1zaXplOiAxMnB4OyBtYXJnaW4tdG9wOiA0cHg7XCI+XG4gICAgICAgICAgRmlsbGVkICR7ZmlsbGVkQ291bnR9IGZpZWxkcyR7YWlDb3VudCA+IDAgPyBgICsgJHthaUNvdW50fSBBSSBhbnN3ZXJzYCA6ICcnfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICBgO1xuICBcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub3RpZmljYXRpb24pO1xuICBzZXRUaW1lb3V0KCgpID0+IG5vdGlmaWNhdGlvbi5yZW1vdmUoKSwgMzAwMCk7XG59XG5cbmludGVyZmFjZSBGaWVsZEluZm8ge1xuICBlbGVtZW50OiBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCB8IEhUTUxTZWxlY3RFbGVtZW50O1xuICB0eXBlOiBzdHJpbmcgfCBudWxsO1xuICBsYWJlbDogc3RyaW5nO1xuICByZXF1aXJlZDogYm9vbGVhbjtcbiAgY29uZmlkZW5jZTogbnVtYmVyOyAvLyBIb3cgY29uZmlkZW50IHdlIGFyZSBhYm91dCB0aGUgZmllbGQgdHlwZSAoMC0xMDApXG59XG5cbmZ1bmN0aW9uIGdldEFsbEZpZWxkcygpOiBGaWVsZEluZm9bXSB7XG4gIGNvbnN0IGZpZWxkczogRmllbGRJbmZvW10gPSBbXTtcbiAgXG4gIGNvbnN0IGlucHV0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTElucHV0RWxlbWVudD4oXG4gICAgJ2lucHV0Om5vdChbdHlwZT1cImhpZGRlblwiXSk6bm90KFt0eXBlPVwic3VibWl0XCJdKTpub3QoW3R5cGU9XCJidXR0b25cIl0pOm5vdChbdHlwZT1cImltYWdlXCJdKTpub3QoW3R5cGU9XCJmaWxlXCJdKSdcbiAgKTtcbiAgY29uc3QgdGV4dGFyZWFzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MVGV4dEFyZWFFbGVtZW50PigndGV4dGFyZWEnKTtcbiAgY29uc3Qgc2VsZWN0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTFNlbGVjdEVsZW1lbnQ+KCdzZWxlY3QnKTtcbiAgXG4gIFsuLi5pbnB1dHMsIC4uLnRleHRhcmVhcywgLi4uc2VsZWN0c10uZm9yRWFjaChlbGVtZW50ID0+IHtcbiAgICAvLyBTa2lwIGlmIGFscmVhZHkgZmlsbGVkXG4gICAgaWYgKCd2YWx1ZScgaW4gZWxlbWVudCAmJiBlbGVtZW50LnZhbHVlICYmIGVsZW1lbnQudmFsdWUudHJpbSgpICE9PSAnJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBhbGxUZXh0U291cmNlcyA9IGdldEZpZWxkVGV4dFNvdXJjZXMoZWxlbWVudCk7XG4gICAgY29uc3QgZGV0ZWN0aW9uID0gZGV0ZWN0RmllbGRUeXBlKGVsZW1lbnQsIGFsbFRleHRTb3VyY2VzKTtcbiAgICBcbiAgICBmaWVsZHMucHVzaCh7XG4gICAgICBlbGVtZW50LFxuICAgICAgdHlwZTogZGV0ZWN0aW9uLnR5cGUsXG4gICAgICBsYWJlbDogYWxsVGV4dFNvdXJjZXMuam9pbignIHwgJyksXG4gICAgICByZXF1aXJlZDogaXNGaWVsZFJlcXVpcmVkKGVsZW1lbnQsIGFsbFRleHRTb3VyY2VzKSxcbiAgICAgIGNvbmZpZGVuY2U6IGRldGVjdGlvbi5jb25maWRlbmNlXG4gICAgfSk7XG4gIH0pO1xuXG4gIGNvbnNvbGUubG9nKGBEZXRlY3RlZCAke2ZpZWxkcy5sZW5ndGh9IGZpZWxkc2ApO1xuICBjb25zb2xlLmxvZygnRmllbGQgdHlwZXM6JywgZmllbGRzLm1hcChmID0+ICh7IHR5cGU6IGYudHlwZSwgbGFiZWw6IGYubGFiZWwuc3Vic3RyaW5nKDAsIDUwKSwgY29uZmlkZW5jZTogZi5jb25maWRlbmNlIH0pKSk7XG4gIFxuICByZXR1cm4gZmllbGRzO1xufVxuXG4vKipcbiAqIEdldHMgQUxMIHBvc3NpYmxlIHRleHQgc291cmNlcyBmb3IgYSBmaWVsZFxuICogUmV0dXJucyBhcnJheSBvZiB0ZXh0IGhpbnRzIGZyb20gdmFyaW91cyBzb3VyY2VzXG4gKi9cbmZ1bmN0aW9uIGdldEZpZWxkVGV4dFNvdXJjZXMoZmllbGQ6IEhUTUxFbGVtZW50KTogc3RyaW5nW10ge1xuICBjb25zdCBzb3VyY2VzOiBzdHJpbmdbXSA9IFtdO1xuICBcbiAgLy8gMS4gRXhwbGljaXQgbGFiZWwgd2l0aCBmb3IgYXR0cmlidXRlXG4gIGlmIChmaWVsZC5pZCkge1xuICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgbGFiZWxbZm9yPVwiJHtmaWVsZC5pZH1cIl1gKTtcbiAgICBpZiAobGFiZWw/LnRleHRDb250ZW50KSB7XG4gICAgICBzb3VyY2VzLnB1c2gobGFiZWwudGV4dENvbnRlbnQudHJpbSgpKTtcbiAgICB9XG4gIH1cbiAgXG4gIC8vIDIuIFBhcmVudCBsYWJlbFxuICBjb25zdCBwYXJlbnRMYWJlbCA9IGZpZWxkLmNsb3Nlc3QoJ2xhYmVsJyk7XG4gIGlmIChwYXJlbnRMYWJlbD8udGV4dENvbnRlbnQpIHtcbiAgICBzb3VyY2VzLnB1c2gocGFyZW50TGFiZWwudGV4dENvbnRlbnQudHJpbSgpKTtcbiAgfVxuICBcbiAgLy8gMy4gUHJldmlvdXMgc2libGluZyB0aGF0J3MgYSBsYWJlbCBvciBjb250YWlucyB0ZXh0XG4gIGxldCBwcmV2ID0gZmllbGQucHJldmlvdXNFbGVtZW50U2libGluZztcbiAgbGV0IGF0dGVtcHRzID0gMDtcbiAgd2hpbGUgKHByZXYgJiYgYXR0ZW1wdHMgPCAzKSB7XG4gICAgaWYgKHByZXYudGFnTmFtZSA9PT0gJ0xBQkVMJyAmJiBwcmV2LnRleHRDb250ZW50KSB7XG4gICAgICBzb3VyY2VzLnB1c2gocHJldi50ZXh0Q29udGVudC50cmltKCkpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8vIFNvbWV0aW1lcyB0aGUgbGFiZWwgaXMganVzdCBhIGRpdi9zcGFuIGJlZm9yZSB0aGUgaW5wdXRcbiAgICBpZiAocHJldi50ZXh0Q29udGVudCAmJiBwcmV2LnRleHRDb250ZW50LnRyaW0oKS5sZW5ndGggPCAxMDApIHtcbiAgICAgIHNvdXJjZXMucHVzaChwcmV2LnRleHRDb250ZW50LnRyaW0oKSk7XG4gICAgfVxuICAgIHByZXYgPSBwcmV2LnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XG4gICAgYXR0ZW1wdHMrKztcbiAgfVxuICBcbiAgLy8gNC4gTG9vayBpbiBwYXJlbnQgY29udGFpbmVyXG4gIGNvbnN0IHBhcmVudCA9IGZpZWxkLmNsb3Nlc3QoJ2RpdiwgZmllbGRzZXQsIGxpLCB0ZCwgdGgnKTtcbiAgaWYgKHBhcmVudCkge1xuICAgIC8vIEZpbmQgbGFiZWwgZWxlbWVudHNcbiAgICBjb25zdCBsYWJlbEVsID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJ2xhYmVsLCBsZWdlbmQnKTtcbiAgICBpZiAobGFiZWxFbD8udGV4dENvbnRlbnQpIHtcbiAgICAgIHNvdXJjZXMucHVzaChsYWJlbEVsLnRleHRDb250ZW50LnRyaW0oKSk7XG4gICAgfVxuICAgIFxuICAgIC8vIEZpbmQgc3BhbnMvZGl2cyB0aGF0IG1pZ2h0IGJlIGxhYmVsc1xuICAgIGNvbnN0IHNwYW5zID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3NwYW4sIGRpdicpO1xuICAgIHNwYW5zLmZvckVhY2goc3BhbiA9PiB7XG4gICAgICBjb25zdCB0ZXh0ID0gc3Bhbi50ZXh0Q29udGVudD8udHJpbSgpO1xuICAgICAgaWYgKHRleHQgJiYgdGV4dC5sZW5ndGggPCAxMDAgJiYgdGV4dC5sZW5ndGggPiAyKSB7XG4gICAgICAgIC8vIENoZWNrIGlmIHRoaXMgc3BhbiBpcyBjbG9zZSB0byBvdXIgZmllbGRcbiAgICAgICAgaWYgKHBhcmVudC5jb250YWlucyhzcGFuKSAmJiBwYXJlbnQuY29udGFpbnMoZmllbGQpKSB7XG4gICAgICAgICAgc291cmNlcy5wdXNoKHRleHQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgXG4gIC8vIDUuIEF0dHJpYnV0ZXNcbiAgY29uc3QgYXJpYUxhYmVsID0gZmllbGQuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyk7XG4gIGlmIChhcmlhTGFiZWwpIHNvdXJjZXMucHVzaChhcmlhTGFiZWwpO1xuICBcbiAgY29uc3QgYXJpYUxhYmVsbGVkQnkgPSBmaWVsZC5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWxsZWRieScpO1xuICBpZiAoYXJpYUxhYmVsbGVkQnkpIHtcbiAgICBjb25zdCBsYWJlbEVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXJpYUxhYmVsbGVkQnkpO1xuICAgIGlmIChsYWJlbEVsPy50ZXh0Q29udGVudCkgc291cmNlcy5wdXNoKGxhYmVsRWwudGV4dENvbnRlbnQudHJpbSgpKTtcbiAgfVxuICBcbiAgY29uc3QgdGl0bGUgPSBmaWVsZC5nZXRBdHRyaWJ1dGUoJ3RpdGxlJyk7XG4gIGlmICh0aXRsZSkgc291cmNlcy5wdXNoKHRpdGxlKTtcbiAgXG4gIC8vIDYuIFBsYWNlaG9sZGVyXG4gIGlmICgncGxhY2Vob2xkZXInIGluIGZpZWxkKSB7XG4gICAgY29uc3QgaW5wdXRFbGVtZW50ID0gZmllbGQgYXMgSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQ7XG4gICAgaWYgKGlucHV0RWxlbWVudC5wbGFjZWhvbGRlcikge1xuICAgICAgc291cmNlcy5wdXNoKGlucHV0RWxlbWVudC5wbGFjZWhvbGRlcik7XG4gICAgfVxuICB9XG4gIFxuICAvLyA3LiBOYW1lIGFuZCBJRCBhdHRyaWJ1dGVzIChvZnRlbiBoYXZlIGhpbnRzKVxuICAvLyBAdHMtaWdub3JlXG4gIGlmIChmaWVsZC5uYW1lKSBzb3VyY2VzLnB1c2goZmllbGQubmFtZSk7XG4gIGlmIChmaWVsZC5pZCkgc291cmNlcy5wdXNoKGZpZWxkLmlkKTtcbiAgXG4gIC8vIDguIENsYXNzIG5hbWVzIChzb21ldGltZXMgY29udGFpbiBoaW50cyBsaWtlIFwiZmlyc3QtbmFtZS1pbnB1dFwiKVxuICBpZiAoZmllbGQuY2xhc3NOYW1lKSB7XG4gICAgY29uc3QgY2xhc3NIaW50cyA9IGZpZWxkLmNsYXNzTmFtZS5zcGxpdCgvW1xcc18tXS8pLmZpbHRlcihjID0+IGMubGVuZ3RoID4gMik7XG4gICAgc291cmNlcy5wdXNoKC4uLmNsYXNzSGludHMpO1xuICB9XG4gIFxuICAvLyA5LiBEYXRhIGF0dHJpYnV0ZXNcbiAgZm9yIChjb25zdCBhdHRyIG9mIGZpZWxkLmF0dHJpYnV0ZXMpIHtcbiAgICBpZiAoYXR0ci5uYW1lLnN0YXJ0c1dpdGgoJ2RhdGEtJykgJiYgYXR0ci52YWx1ZSAmJiBhdHRyLnZhbHVlLmxlbmd0aCA8IDUwKSB7XG4gICAgICBzb3VyY2VzLnB1c2goYXR0ci52YWx1ZSk7XG4gICAgfVxuICB9XG4gIFxuICAvLyBSZW1vdmUgZHVwbGljYXRlcyBhbmQgY2xlYW5cbiAgY29uc3QgdW5pcXVlID0gWy4uLm5ldyBTZXQoc291cmNlcyldXG4gICAgLm1hcChzID0+IHMucmVwbGFjZSgvXFwqL2csICcnKS50cmltKCkpXG4gICAgLmZpbHRlcihzID0+IHMubGVuZ3RoID4gMCk7XG4gIFxuICByZXR1cm4gdW5pcXVlO1xufVxuXG4vKipcbiAqIERldGVjdHMgZmllbGQgdHlwZSB3aXRoIGNvbmZpZGVuY2Ugc2NvcmVcbiAqL1xuZnVuY3Rpb24gZGV0ZWN0RmllbGRUeXBlKFxuICBmaWVsZDogSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBIVE1MU2VsZWN0RWxlbWVudCxcbiAgdGV4dFNvdXJjZXM6IHN0cmluZ1tdXG4pOiB7IHR5cGU6IHN0cmluZyB8IG51bGw7IGNvbmZpZGVuY2U6IG51bWJlciB9IHtcbiAgLy8gQ29tYmluZSBhbGwgdGV4dCBzb3VyY2VzXG4gIGNvbnN0IGNvbWJpbmVkVGV4dCA9IHRleHRTb3VyY2VzLmpvaW4oJyAnKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBmaWVsZFR5cGUgPSAndHlwZScgaW4gZmllbGQgPyBmaWVsZC50eXBlIDogJyc7XG4gIGNvbnN0IGF1dG9jb21wbGV0ZSA9IGZpZWxkLmdldEF0dHJpYnV0ZSgnYXV0b2NvbXBsZXRlJyk/LnRvTG93ZXJDYXNlKCkgfHwgJyc7XG4gIFxuICAvLyBBdXRvY29tcGxldGUgYXR0cmlidXRlIGlzIHZlcnkgcmVsaWFibGVcbiAgaWYgKGF1dG9jb21wbGV0ZSkge1xuICAgIGNvbnN0IGF1dG9jb21wbGV0ZU1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICdnaXZlbi1uYW1lJzogJ2ZpcnN0TmFtZScsXG4gICAgICAnZmFtaWx5LW5hbWUnOiAnbGFzdE5hbWUnLFxuICAgICAgJ25hbWUnOiAnZnVsbE5hbWUnLFxuICAgICAgJ2VtYWlsJzogJ2VtYWlsJyxcbiAgICAgICd0ZWwnOiAncGhvbmUnLFxuICAgICAgJ3N0cmVldC1hZGRyZXNzJzogJ2FkZHJlc3MnLFxuICAgICAgJ2FkZHJlc3MtbGluZTEnOiAnYWRkcmVzcycsXG4gICAgICAnYWRkcmVzcy1sZXZlbDInOiAnY2l0eScsXG4gICAgICAnYWRkcmVzcy1sZXZlbDEnOiAnc3RhdGUnLFxuICAgICAgJ3Bvc3RhbC1jb2RlJzogJ3ppcCcsXG4gICAgICAnb3JnYW5pemF0aW9uJzogJ2N1cnJlbnRDb21wYW55JyxcbiAgICAgICdvcmdhbml6YXRpb24tdGl0bGUnOiAnY3VycmVudFRpdGxlJ1xuICAgIH07XG4gICAgXG4gICAgaWYgKGF1dG9jb21wbGV0ZU1hcFthdXRvY29tcGxldGVdKSB7XG4gICAgICByZXR1cm4geyB0eXBlOiBhdXRvY29tcGxldGVNYXBbYXV0b2NvbXBsZXRlXSwgY29uZmlkZW5jZTogOTUgfTtcbiAgICB9XG4gIH1cbiAgXG4gIC8vIEVtYWlsIGZpZWxkIHR5cGUgaXMgdmVyeSByZWxpYWJsZVxuICBpZiAoZmllbGRUeXBlID09PSAnZW1haWwnKSB7XG4gICAgcmV0dXJuIHsgdHlwZTogJ2VtYWlsJywgY29uZmlkZW5jZTogOTUgfTtcbiAgfVxuICBcbiAgLy8gVGVsIGZpZWxkIHR5cGUgaXMgcmVsaWFibGVcbiAgaWYgKGZpZWxkVHlwZSA9PT0gJ3RlbCcpIHtcbiAgICByZXR1cm4geyB0eXBlOiAncGhvbmUnLCBjb25maWRlbmNlOiA5NSB9O1xuICB9XG4gIFxuICAvLyBQYXR0ZXJuIG1hdGNoaW5nIHdpdGggY29uZmlkZW5jZSBzY29yZXNcbiAgY29uc3QgcGF0dGVybnM6IEFycmF5PHsga2V5d29yZHM6IHN0cmluZ1tdOyB0eXBlOiBzdHJpbmc7IGNvbmZpZGVuY2U6IG51bWJlciB9PiA9IFtcbiAgICAvLyBIaWdoIGNvbmZpZGVuY2UgcGF0dGVybnNcbiAgICB7IGtleXdvcmRzOiBbJ2ZpcnN0IG5hbWUnLCAnZmlyc3RuYW1lJywgJ2ZuYW1lJywgJ2dpdmVuIG5hbWUnLCAnZm9yZW5hbWUnXSwgdHlwZTogJ2ZpcnN0TmFtZScsIGNvbmZpZGVuY2U6IDkwIH0sXG4gICAgeyBrZXl3b3JkczogWydsYXN0IG5hbWUnLCAnbGFzdG5hbWUnLCAnbG5hbWUnLCAnc3VybmFtZScsICdmYW1pbHkgbmFtZSddLCB0eXBlOiAnbGFzdE5hbWUnLCBjb25maWRlbmNlOiA5MCB9LFxuICAgIHsga2V5d29yZHM6IFsnZW1haWwnLCAnZS1tYWlsJywgJ2VtYWlsYWRkcmVzcyddLCB0eXBlOiAnZW1haWwnLCBjb25maWRlbmNlOiA4NSB9LFxuICAgIHsga2V5d29yZHM6IFsncGhvbmUnLCAndGVsZXBob25lJywgJ21vYmlsZScsICdwaG9uZW51bWJlciddLCB0eXBlOiAncGhvbmUnLCBjb25maWRlbmNlOiA4NSB9LFxuICAgIFxuICAgIC8vIE1lZGl1bSBjb25maWRlbmNlIHBhdHRlcm5zXG4gICAgeyBrZXl3b3JkczogWydmdWxsIG5hbWUnLCAneW91ciBuYW1lJywgJ25hbWUnXSwgdHlwZTogJ2Z1bGxOYW1lJywgY29uZmlkZW5jZTogNzAgfSxcbiAgICB7IGtleXdvcmRzOiBbJ3N0cmVldCcsICdhZGRyZXNzIGxpbmUnLCAnYWRkcmVzczEnLCAnYWRkcmVzc2xpbmUnXSwgdHlwZTogJ2FkZHJlc3MnLCBjb25maWRlbmNlOiA4MCB9LFxuICAgIHsga2V5d29yZHM6IFsnY2l0eScsICd0b3duJywgJ2xvY2FsaXR5J10sIHR5cGU6ICdjaXR5JywgY29uZmlkZW5jZTogODUgfSxcbiAgICB7IGtleXdvcmRzOiBbJ3N0YXRlJywgJ3Byb3ZpbmNlJywgJ3JlZ2lvbiddLCB0eXBlOiAnc3RhdGUnLCBjb25maWRlbmNlOiA4MCB9LFxuICAgIHsga2V5d29yZHM6IFsnemlwJywgJ3Bvc3RhbCcsICdwb3N0Y29kZScsICd6aXBjb2RlJ10sIHR5cGU6ICd6aXAnLCBjb25maWRlbmNlOiA4NSB9LFxuICAgIFxuICAgIC8vIFByb2Zlc3Npb25hbFxuICAgIHsga2V5d29yZHM6IFsnam9iIHRpdGxlJywgJ3Bvc2l0aW9uJywgJ3JvbGUnLCAnam9idGl0bGUnXSwgdHlwZTogJ2N1cnJlbnRUaXRsZScsIGNvbmZpZGVuY2U6IDc1IH0sXG4gICAgeyBrZXl3b3JkczogWydjb21wYW55JywgJ2VtcGxveWVyJywgJ29yZ2FuaXphdGlvbicsICdjb21wYW55bmFtZSddLCB0eXBlOiAnY3VycmVudENvbXBhbnknLCBjb25maWRlbmNlOiA3NSB9LFxuICAgIHsga2V5d29yZHM6IFsneWVhcnMgZXhwZXJpZW5jZScsICd5ZWFyc2V4cGVyaWVuY2UnLCAnZXhwZXJpZW5jZSB5ZWFycyddLCB0eXBlOiAneWVhcnNFeHBlcmllbmNlJywgY29uZmlkZW5jZTogODAgfSxcbiAgICBcbiAgICAvLyBFZHVjYXRpb24gJiBMaW5rc1xuICAgIHsga2V5d29yZHM6IFsnZWR1Y2F0aW9uJywgJ2RlZ3JlZScsICd1bml2ZXJzaXR5JywgJ3NjaG9vbCddLCB0eXBlOiAnZWR1Y2F0aW9uJywgY29uZmlkZW5jZTogNzUgfSxcbiAgICB7IGtleXdvcmRzOiBbJ2xpbmtlZGluJywgJ2xpbmtlZGluIHByb2ZpbGUnLCAnbGlua2VkaW51cmwnXSwgdHlwZTogJ2xpbmtlZGluJywgY29uZmlkZW5jZTogOTAgfSxcbiAgICB7IGtleXdvcmRzOiBbJ2dpdGh1YicsICdnaXRodWIgcHJvZmlsZScsICdnaXRodWJ1cmwnXSwgdHlwZTogJ2dpdGh1YicsIGNvbmZpZGVuY2U6IDkwIH0sXG4gICAgeyBrZXl3b3JkczogWydwb3J0Zm9saW8nLCAnd2Vic2l0ZScsICdwZXJzb25hbCBzaXRlJ10sIHR5cGU6ICdwb3J0Zm9saW8nLCBjb25maWRlbmNlOiA3NSB9LFxuICAgIHsga2V5d29yZHM6IFsnc2FsYXJ5JywgJ2NvbXBlbnNhdGlvbicsICdleHBlY3RlZCBzYWxhcnknLCAnZGVzaXJlZHNhbGFyeSddLCB0eXBlOiAnc2FsYXJ5RXhwZWN0YXRpb24nLCBjb25maWRlbmNlOiA4MCB9LFxuICAgIFxuICAgIC8vIENoZWNrYm94ZXNcbiAgICB7IGtleXdvcmRzOiBbJ3Nwb25zb3InLCAndmlzYScsICdhdXRob3JpemF0aW9uJywgJ3dvcmsgYXV0aCddLCB0eXBlOiAnc3BvbnNvcnNoaXAnLCBjb25maWRlbmNlOiA4NSB9LFxuICAgIHsga2V5d29yZHM6IFsncmVsb2NhdGUnLCAncmVsb2NhdGlvbicsICd3aWxsaW5nIHRvIG1vdmUnXSwgdHlwZTogJ3JlbG9jYXRpb24nLCBjb25maWRlbmNlOiA4NSB9LFxuICBdO1xuICBcbiAgLy8gQ2hlY2sgcGF0dGVybnNcbiAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHBhdHRlcm5zKSB7XG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHBhdHRlcm4ua2V5d29yZHMpIHtcbiAgICAgIGlmIChjb21iaW5lZFRleHQuaW5jbHVkZXMoa2V5d29yZC50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgICAvLyBCb29zdCBjb25maWRlbmNlIGlmIG11bHRpcGxlIHNvdXJjZXMgbWVudGlvbiBpdFxuICAgICAgICBjb25zdCBtYXRjaENvdW50ID0gdGV4dFNvdXJjZXMuZmlsdGVyKHMgPT4gXG4gICAgICAgICAgcy50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGtleXdvcmQudG9Mb3dlckNhc2UoKSlcbiAgICAgICAgKS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGJvb3N0ZWRDb25maWRlbmNlID0gTWF0aC5taW4oMTAwLCBwYXR0ZXJuLmNvbmZpZGVuY2UgKyAobWF0Y2hDb3VudCAqIDUpKTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7IHR5cGU6IHBhdHRlcm4udHlwZSwgY29uZmlkZW5jZTogYm9vc3RlZENvbmZpZGVuY2UgfTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIC8vIENoZWNrIGZvciBjdXN0b20gcXVlc3Rpb25zICh0ZXh0YXJlYXMgd2l0aCBxdWVzdGlvbi1saWtlIHRleHQpXG4gIGlmIChmaWVsZC50YWdOYW1lID09PSAnVEVYVEFSRUEnIHx8IGZpZWxkVHlwZSA9PT0gJ3RleHQnKSB7XG4gICAgY29uc3QgaGFzUXVlc3Rpb25NYXJrID0gdGV4dFNvdXJjZXMuc29tZShzID0+IHMuaW5jbHVkZXMoJz8nKSk7XG4gICAgY29uc3QgaGFzUXVlc3Rpb25Xb3JkcyA9IHRleHRTb3VyY2VzLnNvbWUocyA9PiBcbiAgICAgIC9cXGIod2h5fGhvd3x3aGF0fGRlc2NyaWJlfHRlbGx8ZXhwbGFpbilcXGIvaS50ZXN0KHMpXG4gICAgKTtcbiAgICBjb25zdCBpc0xvbmdMYWJlbCA9IHRleHRTb3VyY2VzLnNvbWUocyA9PiBzLmxlbmd0aCA+IDMwKTtcbiAgICBcbiAgICBpZiAoaGFzUXVlc3Rpb25NYXJrIHx8IChoYXNRdWVzdGlvbldvcmRzICYmIGlzTG9uZ0xhYmVsKSkge1xuICAgICAgcmV0dXJuIHsgdHlwZTogJ2N1c3RvbVF1ZXN0aW9uJywgY29uZmlkZW5jZTogNzAgfTtcbiAgICB9XG4gIH1cbiAgXG4gIHJldHVybiB7IHR5cGU6IG51bGwsIGNvbmZpZGVuY2U6IDAgfTtcbn1cblxuZnVuY3Rpb24gbWF0Y2hlc0tleXdvcmRzKHRleHQ6IHN0cmluZywga2V5d29yZHM6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG4gIGNvbnN0IHRleHRMb3dlciA9IHRleHQudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXFxzXy1dL2csICcnKTtcbiAgcmV0dXJuIGtleXdvcmRzLnNvbWUoa2V5d29yZCA9PiBcbiAgICB0ZXh0TG93ZXIuaW5jbHVkZXMoa2V5d29yZC50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1tcXHNfLV0vZywgJycpKVxuICApO1xufVxuXG5mdW5jdGlvbiBpc0ZpZWxkUmVxdWlyZWQoZmllbGQ6IEhUTUxFbGVtZW50LCB0ZXh0U291cmNlczogc3RyaW5nW10pOiBib29sZWFuIHtcbiAgaWYgKCdyZXF1aXJlZCcgaW4gZmllbGQgJiYgZmllbGQucmVxdWlyZWQpIHJldHVybiB0cnVlO1xuICBpZiAoZmllbGQuZ2V0QXR0cmlidXRlKCdhcmlhLXJlcXVpcmVkJykgPT09ICd0cnVlJykgcmV0dXJuIHRydWU7XG4gIFxuICByZXR1cm4gdGV4dFNvdXJjZXMuc29tZSh0ZXh0ID0+IFxuICAgIHRleHQuaW5jbHVkZXMoJyonKSB8fCBcbiAgICB0ZXh0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3JlcXVpcmVkJykgfHxcbiAgICB0ZXh0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ21hbmRhdG9yeScpXG4gICk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGF1dG9GaWxsRm9ybShwcm9maWxlOiBVc2VyUHJvZmlsZSkge1xuICBjb25zdCBmaWVsZHMgPSBnZXRBbGxGaWVsZHMoKTtcbiAgXG4gIC8vIFNvcnQgYnkgY29uZmlkZW5jZSAoZmlsbCBoaWdoLWNvbmZpZGVuY2UgZmllbGRzIGZpcnN0KVxuICBmaWVsZHMuc29ydCgoYSwgYikgPT4gYi5jb25maWRlbmNlIC0gYS5jb25maWRlbmNlKTtcbiAgXG4gIGxldCBmaWxsZWRDb3VudCA9IDA7XG4gIGxldCBhaUFuc3dlcmVkQ291bnQgPSAwO1xuICBjb25zdCBjdXN0b21RdWVzdGlvbnM6IEZpZWxkSW5mb1tdID0gW107XG4gIFxuICAvLyBGaXJzdCBwYXNzOiBmaWxsIHN0YW5kYXJkIGZpZWxkc1xuICBmb3IgKGNvbnN0IGZpZWxkSW5mbyBvZiBmaWVsZHMpIHtcbiAgICBpZiAoIWZpZWxkSW5mby50eXBlKSBjb250aW51ZTtcbiAgICBcbiAgICBpZiAoZmllbGRJbmZvLnR5cGUgPT09ICdjdXN0b21RdWVzdGlvbicpIHtcbiAgICAgIGN1c3RvbVF1ZXN0aW9ucy5wdXNoKGZpZWxkSW5mbyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgXG4gICAgLy8gT25seSBmaWxsIGlmIGNvbmZpZGVuY2UgaXMgcmVhc29uYWJsZSAoPj0gNjApXG4gICAgaWYgKGZpZWxkSW5mby5jb25maWRlbmNlID49IDYwKSB7XG4gICAgICBjb25zdCBzdWNjZXNzID0gZmlsbEZpZWxkKGZpZWxkSW5mbywgcHJvZmlsZSk7XG4gICAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgICBjb25zb2xlLmxvZyhgRmlsbGVkOiAke2ZpZWxkSW5mby50eXBlfSAoY29uZmlkZW5jZTogJHtmaWVsZEluZm8uY29uZmlkZW5jZX0pYCk7XG4gICAgICAgIGZpbGxlZENvdW50Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICBjb25zb2xlLmxvZyhgRmlsbGVkICR7ZmlsbGVkQ291bnR9IHN0YW5kYXJkIGZpZWxkc2ApO1xuICBcbiAgLy8gU2Vjb25kIHBhc3M6IEFJIGZvciBjdXN0b20gcXVlc3Rpb25zXG4gIGlmIChjdXN0b21RdWVzdGlvbnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnNvbGUubG9nKGBGb3VuZCAke2N1c3RvbVF1ZXN0aW9ucy5sZW5ndGh9IGN1c3RvbSBxdWVzdGlvbnNgKTtcbiAgICBjb25zdCBqb2JDb250ZXh0ID0gZXh0cmFjdEpvYkNvbnRleHQoKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGZpZWxkSW5mbyBvZiBjdXN0b21RdWVzdGlvbnMpIHtcbiAgICAgIGlmIChmaWVsZEluZm8uY29uZmlkZW5jZSA+PSA2MCkge1xuICAgICAgICBjb25zdCBhbnN3ZXIgPSBhd2FpdCBhbnN3ZXJDdXN0b21RdWVzdGlvbihmaWVsZEluZm8ubGFiZWwsIHByb2ZpbGUsIGpvYkNvbnRleHQpO1xuICAgICAgICBpZiAoYW5zd2VyKSB7XG4gICAgICAgICAgZmlsbFRleHRGaWVsZChmaWVsZEluZm8uZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCwgYW5zd2VyKTtcbiAgICAgICAgICBhaUFuc3dlcmVkQ291bnQrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHtcbiAgICBmaWxsZWQ6IGZpbGxlZENvdW50LFxuICAgIGFpQW5zd2VyZWQ6IGFpQW5zd2VyZWRDb3VudFxuICB9O1xufVxuXG5mdW5jdGlvbiBmaWxsRmllbGQoZmllbGRJbmZvOiBGaWVsZEluZm8sIHByb2ZpbGU6IFVzZXJQcm9maWxlKTogYm9vbGVhbiB7XG4gIGNvbnN0IHsgZWxlbWVudCwgdHlwZSB9ID0gZmllbGRJbmZvO1xuICBcbiAgY29uc3QgdmFsdWUgPSBnZXRWYWx1ZUZvckZpZWxkVHlwZSh0eXBlLCBwcm9maWxlKTtcbiAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09ICcnKSByZXR1cm4gZmFsc2U7XG4gIFxuICBpZiAoZWxlbWVudC50YWdOYW1lID09PSAnU0VMRUNUJykge1xuICAgIHJldHVybiBmaWxsU2VsZWN0KGVsZW1lbnQgYXMgSFRNTFNlbGVjdEVsZW1lbnQsIHZhbHVlKTtcbiAgfSBlbHNlIGlmICgndHlwZScgaW4gZWxlbWVudCAmJiBlbGVtZW50LnR5cGUgPT09ICdjaGVja2JveCcpIHtcbiAgICByZXR1cm4gZmlsbENoZWNrYm94KGVsZW1lbnQgYXMgSFRNTElucHV0RWxlbWVudCwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKCd0eXBlJyBpbiBlbGVtZW50ICYmIGVsZW1lbnQudHlwZSA9PT0gJ3JhZGlvJykge1xuICAgIHJldHVybiBmaWxsUmFkaW8oZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZpbGxUZXh0RmllbGQoZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCwgdmFsdWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFZhbHVlRm9yRmllbGRUeXBlKHR5cGU6IHN0cmluZyB8IG51bGwsIHByb2ZpbGU6IFVzZXJQcm9maWxlKTogYW55IHtcbiAgaWYgKCF0eXBlKSByZXR1cm4gbnVsbDtcbiAgXG4gIGNvbnN0IGN1cnJlbnRKb2IgPSAocHJvZmlsZS5lbXBsb3ltZW50SGlzdG9yeSB8fCBbXSkuZmluZChqb2IgPT4gam9iLmlzQ3VycmVudCk7XG4gIGNvbnN0IG1vc3RSZWNlbnRKb2IgPSAocHJvZmlsZS5lbXBsb3ltZW50SGlzdG9yeSB8fCBbXSlbMF07XG4gIGNvbnN0IGpvYlRvVXNlID0gY3VycmVudEpvYiB8fCBtb3N0UmVjZW50Sm9iO1xuICBcbiAgY29uc3QgdmFsdWVNYXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gICAgZmlyc3ROYW1lOiBwcm9maWxlLmZpcnN0TmFtZSxcbiAgICBsYXN0TmFtZTogcHJvZmlsZS5sYXN0TmFtZSxcbiAgICBmdWxsTmFtZTogYCR7cHJvZmlsZS5maXJzdE5hbWV9ICR7cHJvZmlsZS5sYXN0TmFtZX1gLFxuICAgIGVtYWlsOiBwcm9maWxlLmVtYWlsLFxuICAgIHBob25lOiBwcm9maWxlLnBob25lLFxuICAgIGFkZHJlc3M6IHByb2ZpbGUuYWRkcmVzcyxcbiAgICBjaXR5OiBwcm9maWxlLmNpdHksXG4gICAgc3RhdGU6IHByb2ZpbGUuc3RhdGUsXG4gICAgemlwOiBwcm9maWxlLnppcCxcbiAgICBjdXJyZW50VGl0bGU6IGpvYlRvVXNlPy5qb2JUaXRsZSB8fCAnJyxcbiAgICBjdXJyZW50Q29tcGFueTogam9iVG9Vc2U/LmNvbXBhbnkgfHwgJycsXG4gICAgeWVhcnNFeHBlcmllbmNlOiBwcm9maWxlLnllYXJzRXhwZXJpZW5jZSxcbiAgICBlZHVjYXRpb246IHByb2ZpbGUuZWR1Y2F0aW9uLFxuICAgIGxpbmtlZGluOiBwcm9maWxlLmxpbmtlZGluLFxuICAgIGdpdGh1YjogcHJvZmlsZS5naXRodWIsXG4gICAgcG9ydGZvbGlvOiBwcm9maWxlLnBvcnRmb2xpbyxcbiAgICBzYWxhcnlFeHBlY3RhdGlvbjogcHJvZmlsZS5zYWxhcnlFeHBlY3RhdGlvbixcbiAgICBzcG9uc29yc2hpcDogcHJvZmlsZS5uZWVkc1Nwb25zb3JzaGlwID8gJ3llcycgOiAnbm8nLFxuICAgIHJlbG9jYXRpb246IHByb2ZpbGUud2lsbGluZ1RvUmVsb2NhdGUgPyAneWVzJyA6ICdubycsXG4gIH07XG4gIFxuICByZXR1cm4gdmFsdWVNYXBbdHlwZV07XG59XG5cbmZ1bmN0aW9uIGZpbGxUZXh0RmllbGQoZmllbGQ6IEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50LCB2YWx1ZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGZpZWxkLnZhbHVlID0gdmFsdWU7XG4gIGZpZWxkLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG4gIGZpZWxkLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuICBmaWVsZC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnYmx1cicsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG4gIFxuICAvLyBSZWFjdCBmaXhcbiAgY29uc3QgbmF0aXZlSW5wdXRWYWx1ZVNldHRlciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iod2luZG93LkhUTUxJbnB1dEVsZW1lbnQucHJvdG90eXBlLCAndmFsdWUnKT8uc2V0O1xuICBpZiAobmF0aXZlSW5wdXRWYWx1ZVNldHRlcikge1xuICAgIG5hdGl2ZUlucHV0VmFsdWVTZXR0ZXIuY2FsbChmaWVsZCwgdmFsdWUpO1xuICAgIGZpZWxkLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG4gIH1cbiAgXG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBmaWxsU2VsZWN0KHNlbGVjdDogSFRNTFNlbGVjdEVsZW1lbnQsIHZhbHVlOiBhbnkpOiBib29sZWFuIHtcbiAgY29uc3Qgb3B0aW9ucyA9IEFycmF5LmZyb20oc2VsZWN0Lm9wdGlvbnMpO1xuICBcbiAgbGV0IG1hdGNoID0gb3B0aW9ucy5maW5kKG9wdCA9PiBvcHQudmFsdWUgPT09IHZhbHVlIHx8IG9wdC50ZXh0ID09PSB2YWx1ZSk7XG4gIFxuICBpZiAoIW1hdGNoKSB7XG4gICAgY29uc3QgdmFsdWVMb3dlciA9IHZhbHVlLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKTtcbiAgICBtYXRjaCA9IG9wdGlvbnMuZmluZChvcHQgPT4gXG4gICAgICBvcHQudmFsdWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh2YWx1ZUxvd2VyKSB8fFxuICAgICAgb3B0LnRleHQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh2YWx1ZUxvd2VyKVxuICAgICk7XG4gIH1cbiAgXG4gIGlmICghbWF0Y2ggJiYgIWlzTmFOKHZhbHVlKSkge1xuICAgIG1hdGNoID0gb3B0aW9ucy5maW5kKG9wdCA9PiBvcHQudmFsdWUgPT09IHZhbHVlLnRvU3RyaW5nKCkpO1xuICB9XG4gIFxuICBpZiAobWF0Y2gpIHtcbiAgICBzZWxlY3QudmFsdWUgPSBtYXRjaC52YWx1ZTtcbiAgICBzZWxlY3QuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZmlsbENoZWNrYm94KGNoZWNrYm94OiBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIGNvbnN0IHNob3VsZENoZWNrID0gdmFsdWUgPT09IHRydWUgfHwgdmFsdWUgPT09ICd5ZXMnIHx8IHZhbHVlID09PSAndHJ1ZSc7XG4gIGNoZWNrYm94LmNoZWNrZWQgPSBzaG91bGRDaGVjaztcbiAgY2hlY2tib3guZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBmaWxsUmFkaW8ocmFkaW86IEhUTUxJbnB1dEVsZW1lbnQsIHZhbHVlOiBhbnkpOiBib29sZWFuIHtcbiAgY29uc3QgcmFkaW9zID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MSW5wdXRFbGVtZW50PihgaW5wdXRbbmFtZT1cIiR7cmFkaW8ubmFtZX1cIl1gKTtcbiAgY29uc3QgdmFsdWVMb3dlciA9IHZhbHVlLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKTtcbiAgXG4gIGNvbnN0IG1hdGNoID0gQXJyYXkuZnJvbShyYWRpb3MpLmZpbmQociA9PiB7XG4gICAgY29uc3Qgc291cmNlcyA9IGdldEZpZWxkVGV4dFNvdXJjZXMocik7XG4gICAgcmV0dXJuIHNvdXJjZXMuc29tZShzID0+IHMudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh2YWx1ZUxvd2VyKSk7XG4gIH0pO1xuICBcbiAgaWYgKG1hdGNoKSB7XG4gICAgbWF0Y2guY2hlY2tlZCA9IHRydWU7XG4gICAgbWF0Y2guZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEpvYkNvbnRleHQoKSB7XG4gIGNvbnN0IHRpdGxlID0gXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaDEnKT8udGV4dENvbnRlbnQgfHxcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbY2xhc3MqPVwiam9iLXRpdGxlXCJdJyk/LnRleHRDb250ZW50IHx8XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2NsYXNzKj1cIkpvYlRpdGxlXCJdJyk/LnRleHRDb250ZW50IHx8XG4gICAgJ3RoaXMgcG9zaXRpb24nO1xuICAgIFxuICBjb25zdCBjb21wYW55ID0gXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2NsYXNzKj1cImNvbXBhbnlcIl0nKT8udGV4dENvbnRlbnQgfHxcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbY2xhc3MqPVwiQ29tcGFueVwiXScpPy50ZXh0Q29udGVudCB8fFxuICAgICd0aGlzIGNvbXBhbnknO1xuXG4gIHJldHVybiB7XG4gICAgdGl0bGU6IHRpdGxlLnRyaW0oKSxcbiAgICBjb21wYW55OiBjb21wYW55LnRyaW0oKVxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBhbnN3ZXJDdXN0b21RdWVzdGlvbihcbiAgcXVlc3Rpb246IHN0cmluZyxcbiAgcHJvZmlsZTogVXNlclByb2ZpbGUsXG4gIGpvYkNvbnRleHQ6IHsgdGl0bGU6IHN0cmluZzsgY29tcGFueTogc3RyaW5nIH1cbik6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCBjdXJyZW50Sm9iID0gKHByb2ZpbGUuZW1wbG95bWVudEhpc3RvcnkgfHwgW10pLmZpbmQoam9iID0+IGpvYi5pc0N1cnJlbnQpO1xuICBjb25zdCBtb3N0UmVjZW50Sm9iID0gKHByb2ZpbGUuZW1wbG95bWVudEhpc3RvcnkgfHwgW10pWzBdO1xuICBjb25zdCBqb2JUb1JlZmVyZW5jZSA9IGN1cnJlbnRKb2IgfHwgbW9zdFJlY2VudEpvYjtcbiAgXG4gIGNvbnN0IGN1cnJlbnRSb2xlID0gam9iVG9SZWZlcmVuY2U/LmpvYlRpdGxlIHx8ICdOb3Qgc3BlY2lmaWVkJztcbiAgY29uc3QgY3VycmVudENvbXBhbnkgPSBqb2JUb1JlZmVyZW5jZT8uY29tcGFueSB8fCAnJztcbiAgY29uc3Qgc2tpbGxzU3RyID0gKHByb2ZpbGUuc2tpbGxzIHx8IFtdKS5qb2luKCcsICcpIHx8ICdOb3Qgc3BlY2lmaWVkJztcbiAgXG4gIGxldCBleHBlcmllbmNlU3VtbWFyeSA9ICcnO1xuICBpZiAocHJvZmlsZS5lbXBsb3ltZW50SGlzdG9yeSAmJiBwcm9maWxlLmVtcGxveW1lbnRIaXN0b3J5Lmxlbmd0aCA+IDApIHtcbiAgICBleHBlcmllbmNlU3VtbWFyeSA9IHByb2ZpbGUuZW1wbG95bWVudEhpc3Rvcnkuc2xpY2UoMCwgMikubWFwKGpvYiA9PiBcbiAgICAgIGAke2pvYi5qb2JUaXRsZX0gYXQgJHtqb2IuY29tcGFueX0gKCR7am9iLnN0YXJ0RGF0ZX0gLSAke2pvYi5pc0N1cnJlbnQgPyAnUHJlc2VudCcgOiBqb2IuZW5kRGF0ZX0pYFxuICAgICkuam9pbignOyAnKTtcbiAgfVxuICBcbiAgY29uc3QgcHJvbXB0ID0gYFlvdSBhcmUgaGVscGluZyBzb21lb25lIGZpbGwgb3V0IGEgam9iIGFwcGxpY2F0aW9uLiBBbnN3ZXIgdGhpcyBxdWVzdGlvbiBwcm9mZXNzaW9uYWxseSBhbmQgY29uY2lzZWx5IChtYXggMTAwIHdvcmRzKTpcblxuUXVlc3Rpb246IFwiJHtxdWVzdGlvbn1cIlxuXG5Kb2IgQXBwbHlpbmcgRm9yOiAke2pvYkNvbnRleHQudGl0bGV9IGF0ICR7am9iQ29udGV4dC5jb21wYW55fVxuXG5DYW5kaWRhdGUgUHJvZmlsZTpcbi0gTmFtZTogJHtwcm9maWxlLmZpcnN0TmFtZX0gJHtwcm9maWxlLmxhc3ROYW1lfVxuLSBDdXJyZW50L1JlY2VudCBSb2xlOiAke2N1cnJlbnRSb2xlfSR7Y3VycmVudENvbXBhbnkgPyBgIGF0ICR7Y3VycmVudENvbXBhbnl9YCA6ICcnfVxuLSBUb3RhbCBFeHBlcmllbmNlOiAke3Byb2ZpbGUueWVhcnNFeHBlcmllbmNlIHx8IDB9IHllYXJzXG4tIEtleSBTa2lsbHM6ICR7c2tpbGxzU3RyfVxuJHtleHBlcmllbmNlU3VtbWFyeSA/IGAtIFdvcmsgSGlzdG9yeTogJHtleHBlcmllbmNlU3VtbWFyeX1gIDogJyd9XG4ke3Byb2ZpbGUuZWR1Y2F0aW9uID8gYC0gRWR1Y2F0aW9uOiAke3Byb2ZpbGUuZWR1Y2F0aW9ufWAgOiAnJ31cblxuUHJvdmlkZSBvbmx5IHRoZSBhbnN3ZXIsIG5vIHByZWFtYmxlIG9yIGV4cGxhbmF0aW9uLiBCZSBzcGVjaWZpYyBhbmQgcmVsZXZhbnQgdG8gYm90aCB0aGUgcXVlc3Rpb24gYW5kIHRoZSBqb2IuYDtcblxuICB0cnkge1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBhdmFpbGFiaWxpdHkgPSBhd2FpdCBhaS5sYW5ndWFnZU1vZGVsLmF2YWlsYWJpbGl0eSgpO1xuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdubycpIHJldHVybiBudWxsO1xuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdhZnRlci1kb3dubG9hZCcpIHtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIGF3YWl0IGFpLmxhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGFpLmxhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc2Vzc2lvbi5wcm9tcHQocHJvbXB0KTtcbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICByZXR1cm4gcmVzdWx0LnRyaW0oKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdBSSBhbnN3ZXJpbmcgZmFpbGVkOicsIGVycm9yKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufSIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2AgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJyZXN1bHQiLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJwcmludCIsImxvZ2dlciJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLG9CQUFvQkEsYUFBWTtBQUM5QyxXQUFPQTtBQUFBLEVBQ1Q7QUNBQSxRQUFBLGFBQUEsb0JBQUE7QUFBQSxJQUFtQyxTQUFBO0FBQUEsTUFDeEI7QUFBQSxNQUNQO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0YsTUFBQSxPQUFBO0FBR0UsY0FBQSxJQUFBLHlCQUFBO0FBRUEsYUFBQSxRQUFBLFVBQUEsWUFBQSxDQUFBLFNBQUEsUUFBQSxpQkFBQTtBQUNFLFlBQUEsUUFBQSxXQUFBLG1CQUFBO0FBQ0Usa0JBQUEsSUFBQSw0QkFBQTtBQUVBLGlCQUFBLFFBQUEsWUFBQSxFQUFBLE1BQUEsY0FBQSxHQUFBLENBQUEsYUFBQTtBQUNFLGdCQUFBLE9BQUEsUUFBQSxXQUFBO0FBQ0Usc0JBQUEsTUFBQSxxQkFBQSxPQUFBLFFBQUEsU0FBQTtBQUNBO0FBQUEsWUFBQTtBQUVGLG9CQUFBLElBQUEsYUFBQTtBQUNBLGdDQUFBLFNBQUEsT0FBQTtBQUFBLFVBQW9DLENBQUE7QUFBQSxRQUNyQztBQUFBLE1BQ0gsQ0FBQTtBQUFBLElBQ0Q7QUFBQSxFQUVMLENBQUE7QUFFQSxpQkFBQSxvQkFBQSxTQUFBO0FBQ0UsUUFBQTtBQUNFLFVBQUEsQ0FBQSxTQUFBO0FBQ0UsY0FBQSxvREFBQTtBQUNBO0FBQUEsTUFBQTtBQUdGLFlBQUFDLFVBQUEsTUFBQSxhQUFBLE9BQUE7QUFDQSx5QkFBQUEsUUFBQSxRQUFBQSxRQUFBLFVBQUE7QUFBQSxJQUFtRCxTQUFBLE9BQUE7QUFHbkQsY0FBQSxNQUFBLG9CQUFBLEtBQUE7QUFDQSxZQUFBLHlDQUFBO0FBQUEsSUFBK0M7QUFBQSxFQUVuRDtBQUVBLFdBQUEsbUJBQUEsYUFBQSxTQUFBO0FBQ0UsVUFBQSxl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QUEsVUFBQSxDQUFBLFNBQUEsYUFBQSxVQUFBLGFBQUEsR0FBQSxNQUFBLFNBQUEsWUFBQSxHQUFBO0FBQUE7QUFBQSxNQUNZLEVBQUEsVUFBQSxDQUFBLGFBQUEsYUFBQSxNQUFBLEdBQUEsTUFBQSxZQUFBLFlBQUEsR0FBQTtBQUFBLE1BR1YsRUFBQSxVQUFBLENBQUEsVUFBQSxnQkFBQSxZQUFBLGFBQUEsR0FBQSxNQUFBLFdBQUEsWUFBQSxHQUFBO0FBQUEsTUFDa0IsRUFBQSxVQUFBLENBQUEsUUFBQSxRQUFBLFVBQUEsR0FBQSxNQUFBLFFBQUEsWUFBQSxHQUFBO0FBQUEsTUFDNUIsRUFBQSxVQUFBLENBQUEsU0FBQSxZQUFBLFFBQUEsR0FBQSxNQUFBLFNBQUEsWUFBQSxHQUFBO0FBQUEsTUFDSSxFQUFBLFVBQUEsQ0FBQSxPQUFBLFVBQUEsWUFBQSxTQUFBLEdBQUEsTUFBQSxPQUFBLFlBQUEsR0FBQTtBQUFBO0FBQUEsTUFDTyxFQUFBLFVBQUEsQ0FBQSxhQUFBLFlBQUEsUUFBQSxVQUFBLEdBQUEsTUFBQSxnQkFBQSxZQUFBLEdBQUE7QUFBQSxNQUdjLEVBQUEsVUFBQSxDQUFBLFdBQUEsWUFBQSxnQkFBQSxhQUFBLEdBQUEsTUFBQSxrQkFBQSxZQUFBLEdBQUE7QUFBQSxNQUNXLEVBQUEsVUFBQSxDQUFBLG9CQUFBLG1CQUFBLGtCQUFBLEdBQUEsTUFBQSxtQkFBQSxZQUFBLEdBQUE7QUFBQTtBQUFBLE1BQ00sRUFBQSxVQUFBLENBQUEsYUFBQSxVQUFBLGNBQUEsUUFBQSxHQUFBLE1BQUEsYUFBQSxZQUFBLEdBQUE7QUFBQSxNQUdsQixFQUFBLFVBQUEsQ0FBQSxZQUFBLG9CQUFBLGFBQUEsR0FBQSxNQUFBLFlBQUEsWUFBQSxHQUFBO0FBQUEsTUFDRCxFQUFBLFVBQUEsQ0FBQSxVQUFBLGtCQUFBLFdBQUEsR0FBQSxNQUFBLFVBQUEsWUFBQSxHQUFBO0FBQUEsTUFDUixFQUFBLFVBQUEsQ0FBQSxhQUFBLFdBQUEsZUFBQSxHQUFBLE1BQUEsYUFBQSxZQUFBLEdBQUE7QUFBQSxNQUNH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
content;