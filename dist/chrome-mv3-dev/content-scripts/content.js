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
      "*://*.linkedin.com/jobs/*/apply/*"
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
    animation: slideIn 0.3s ease-out;
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
    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease-out";
      setTimeout(() => notification.remove(), 300);
    }, 3e3);
  }
  function getAllFields() {
    const fields = [];
    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])'
    );
    const textareas = document.querySelectorAll("textarea");
    const selects = document.querySelectorAll("select");
    [...inputs, ...textareas, ...selects].forEach((element) => {
      const label = getFieldLabel(element);
      const type = detectFieldType(element, label);
      const required = isFieldRequired(element, label);
      fields.push({
        element,
        type,
        label,
        required
      });
    });
    console.log("Detected fields:", fields.length);
    return fields;
  }
  function getFieldLabel(field) {
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label?.textContent) return label.textContent.trim();
    }
    const parentLabel = field.closest("label");
    if (parentLabel?.textContent) return parentLabel.textContent.trim();
    let prev = field.previousElementSibling;
    while (prev) {
      if (prev.tagName === "LABEL" && prev.textContent) {
        return prev.textContent.trim();
      }
      prev = prev.previousElementSibling;
    }
    const parent = field.closest("div, fieldset, li");
    if (parent) {
      const labelEl = parent.querySelector("label, legend");
      if (labelEl?.textContent) return labelEl.textContent.trim();
    }
    const ariaLabel = field.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel;
    if ("placeholder" in field) {
      const inputElement = field;
      if (inputElement.placeholder) {
        return inputElement.placeholder;
      }
    }
    return "";
  }
  function detectFieldType(field, label) {
    const searchText = label.toLowerCase();
    const fieldName = field.name.toLowerCase();
    const fieldId = field.id.toLowerCase();
    const searchIn = `${searchText} ${fieldName} ${fieldId}`;
    if (matchesKeywords(searchIn, ["first name", "firstname", "given name", "fname"])) {
      return "firstName";
    }
    if (matchesKeywords(searchIn, ["last name", "lastname", "surname", "family name", "lname"])) {
      return "lastName";
    }
    if (matchesKeywords(searchIn, ["full name", "your name", "legal name"]) && !searchIn.includes("first") && !searchIn.includes("last")) {
      return "fullName";
    }
    if (matchesKeywords(searchIn, ["email", "e-mail", "email address"])) {
      return "email";
    }
    if (matchesKeywords(searchIn, ["phone", "telephone", "mobile", "cell", "contact number"])) {
      return "phone";
    }
    if (matchesKeywords(searchIn, ["street address", "address line", "address"]) && !searchIn.includes("email")) {
      return "address";
    }
    if (matchesKeywords(searchIn, ["city", "town"])) {
      return "city";
    }
    if (matchesKeywords(searchIn, ["state", "province", "region"])) {
      return "state";
    }
    if (matchesKeywords(searchIn, ["zip", "postal code", "postcode", "zip code"])) {
      return "zip";
    }
    if (matchesKeywords(searchIn, ["job title", "current title", "position", "role"]) && !searchIn.includes("desired")) {
      return "currentTitle";
    }
    if (matchesKeywords(searchIn, ["company", "employer", "organization", "current company"])) {
      return "currentCompany";
    }
    if (matchesKeywords(searchIn, ["years of experience", "years experience", "experience"])) {
      return "yearsExperience";
    }
    if (matchesKeywords(searchIn, ["education", "degree", "university", "school", "college"])) {
      return "education";
    }
    if (matchesKeywords(searchIn, ["linkedin", "linkedin profile", "linkedin url"])) {
      return "linkedin";
    }
    if (matchesKeywords(searchIn, ["github", "github profile", "github url"])) {
      return "github";
    }
    if (matchesKeywords(searchIn, ["portfolio", "website", "personal site", "personal website"])) {
      return "portfolio";
    }
    if (matchesKeywords(searchIn, ["salary", "compensation", "expected salary", "salary expectation", "desired salary"])) {
      return "salaryExpectation";
    }
    if ("type" in field && (field.type === "checkbox" || field.type === "radio")) {
      if (matchesKeywords(searchIn, ["sponsor", "visa", "authorized to work", "work authorization", "require sponsorship"])) {
        return "sponsorship";
      }
      if (matchesKeywords(searchIn, ["relocate", "relocation", "willing to move", "willing to relocate"])) {
        return "relocation";
      }
      return "checkbox-unknown";
    }
    if (field.tagName === "TEXTAREA" || "type" in field && field.type === "text") {
      if (label.length > 30 || label.includes("?") || label.includes("why") || label.includes("describe") || label.includes("tell us")) {
        return "customQuestion";
      }
    }
    return null;
  }
  function matchesKeywords(text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
  }
  function isFieldRequired(field, label) {
    if ("required" in field && field.required) return true;
    if (field.getAttribute("aria-required") === "true") return true;
    if (label.includes("*")) return true;
    if (label.toLowerCase().includes("required")) return true;
    return false;
  }
  async function autoFillForm(profile) {
    const fields = getAllFields();
    let filledCount = 0;
    let aiAnsweredCount = 0;
    const customQuestions = [];
    for (const fieldInfo of fields) {
      if (!fieldInfo.type) continue;
      if (fieldInfo.type === "customQuestion") {
        customQuestions.push(fieldInfo);
        continue;
      }
      const success = fillField(fieldInfo, profile);
      if (success) {
        console.log(`Filled: ${fieldInfo.type}`);
        filledCount++;
      }
    }
    console.log(`Filled ${filledCount} standard fields`);
    if (customQuestions.length > 0) {
      console.log(`Found ${customQuestions.length} custom questions`);
      const jobContext = extractJobContext();
      for (const fieldInfo of customQuestions) {
        const answer = await answerCustomQuestion(fieldInfo.label, profile, jobContext);
        if (answer) {
          fillTextField(fieldInfo.element, answer);
          aiAnsweredCount++;
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
      // Basic
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: `${profile.firstName} ${profile.lastName}`,
      email: profile.email,
      phone: profile.phone,
      // Location
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zip: profile.zip,
      // Professional (use employment history if available, fallback to old fields)
      currentTitle: jobToUse?.jobTitle || "",
      currentCompany: jobToUse?.company || "",
      yearsExperience: profile.yearsExperience,
      // Education
      education: profile.education,
      // Links
      linkedin: profile.linkedin,
      github: profile.github,
      portfolio: profile.portfolio,
      // Compensation
      salaryExpectation: profile.salaryExpectation,
      // Preferences
      sponsorship: profile.needsSponsorship ? "yes" : "no",
      relocation: profile.willingToRelocate ? "yes" : "no"
    };
    return valueMap[type];
  }
  function fillTextField(field, value) {
    field.value = value;
    triggerInputEvents(field);
    return true;
  }
  function fillSelect(select, value) {
    const options = Array.from(select.options);
    let match = options.find(
      (opt) => opt.value === value || opt.text === value
    );
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
      triggerInputEvents(select);
      return true;
    }
    return false;
  }
  function fillCheckbox(checkbox, value) {
    const shouldCheck = value === true || value === "yes" || value === "true";
    checkbox.checked = shouldCheck;
    triggerInputEvents(checkbox);
    return true;
  }
  function fillRadio(radio, value) {
    const radios = document.querySelectorAll(`input[name="${radio.name}"]`);
    const valueLower = value.toString().toLowerCase();
    const match = Array.from(radios).find((r) => {
      const label = getFieldLabel(r).toLowerCase();
      return label.includes(valueLower) || r.value.toLowerCase() === valueLower;
    });
    if (match) {
      match.checked = true;
      triggerInputEvents(match);
      return true;
    }
    return false;
  }
  function triggerInputEvents(element) {
    const events = [
      new Event("input", { bubbles: true }),
      new Event("change", { bubbles: true }),
      new Event("blur", { bubbles: true })
    ];
    events.forEach((event) => element.dispatchEvent(event));
    if ("value" in element) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, element.value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }
  function extractJobContext() {
    const title = document.querySelector("h1")?.textContent || document.querySelector('[class*="job-title"]')?.textContent || "this position";
    const company = document.querySelector('[class*="company"]')?.textContent || "this company";
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
      if (availability === "no") {
        console.warn("Gemini Nano not available");
        return null;
      }
      if (availability === "after-download") {
        console.log("Triggering Gemini Nano download");
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9zcmMvZW50cnlwb2ludHMvY29udGVudC50cyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiaW1wb3J0IHR5cGUgVXNlclByb2ZpbGUgZnJvbSAnQC9saWIvdHlwZXMvdXNlcic7XG5pbXBvcnQgdHlwZSB7IEVtcGxveW1lbnRFbnRyeSB9IGZyb20gJ0AvbGliL3R5cGVzL3VzZXInO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogW1xuICAgICcqOi8vKi5ncmVlbmhvdXNlLmlvLyonLFxuICAgICcqOi8vKi5sZXZlci5jby8qJyxcbiAgICAnKjovLyoubXl3b3JrZGF5am9icy5jb20vKicsXG4gICAgJyo6Ly9saW5rZWRpbi5jb20vam9icy8qL2FwcGx5LyonLFxuICAgICcqOi8vKi5saW5rZWRpbi5jb20vam9icy8qL2FwcGx5LyonXG4gIF0sXG4gIFxuICBhc3luYyBtYWluKCkge1xuICAgIGNvbnNvbGUubG9nKCdBdXRvLWZpbGwgc2NyaXB0IGxvYWRlZCcpO1xuICAgIFxuICAgIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICAgIGlmIChtZXNzYWdlLmFjdGlvbiA9PT0gXCJzdGFydC1hdXRvLWZpbGxcIikge1xuICAgICAgICBjb25zb2xlLmxvZyhcIlJlY2VpdmVkIGF1dG8tZmlsbCByZXF1ZXN0XCIpO1xuXG4gICAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsgdHlwZTogXCJHRVRfUFJPRklMRVwiIH0sIChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJCYWNrZ3JvdW5kIGVycm9yOlwiLCBjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zb2xlLmxvZyhcIkdvdCBwcm9maWxlXCIpO1xuICAgICAgICAgIGhhbmRsZUF1dG9GaWxsQ2xpY2socmVzcG9uc2UucHJvZmlsZSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59KTtcblxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlQXV0b0ZpbGxDbGljayhwcm9maWxlOiBVc2VyUHJvZmlsZSkge1xuICB0cnkge1xuICAgIGlmICghcHJvZmlsZSkge1xuICAgICAgYWxlcnQoJ1BsZWFzZSBzZXQgdXAgeW91ciBwcm9maWxlIGZpcnN0IGluIHRoZSBleHRlbnNpb24hJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIC8vIERvIHRoZSBhdXRvLWZpbGxcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhdXRvRmlsbEZvcm0ocHJvZmlsZSk7XG4gICAgXG4gICAgLy8gU2hvdyBzdWNjZXNzXG4gICAgc2hvd1N1Y2Nlc3NNZXNzYWdlKHJlc3VsdC5maWxsZWQsIHJlc3VsdC5haUFuc3dlcmVkKTtcbiAgICBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdBdXRvLWZpbGwgZXJyb3I6JywgZXJyb3IpO1xuICAgIGFsZXJ0KCdTb21ldGhpbmcgd2VudCB3cm9uZy4gUGxlYXNlIHRyeSBhZ2Fpbi4nKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzaG93U3VjY2Vzc01lc3NhZ2UoZmlsbGVkQ291bnQ6IG51bWJlciwgYWlDb3VudDogbnVtYmVyKSB7XG4gIGNvbnN0IG5vdGlmaWNhdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBub3RpZmljYXRpb24uc3R5bGUuY3NzVGV4dCA9IGBcbiAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgdG9wOiAyMHB4O1xuICAgIHJpZ2h0OiAyMHB4O1xuICAgIHotaW5kZXg6IDEwMDAxO1xuICAgIHBhZGRpbmc6IDE2cHggMjRweDtcbiAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgYm94LXNoYWRvdzogMCA0cHggMTJweCByZ2JhKDAsMCwwLDAuMTUpO1xuICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICBhbmltYXRpb246IHNsaWRlSW4gMC4zcyBlYXNlLW91dDtcbiAgYDtcbiAgXG4gIG5vdGlmaWNhdGlvbi5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTJweDtcIj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiZm9udC1zaXplOiAyNHB4O1wiPuKchTwvc3Bhbj5cbiAgICAgIDxkaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXdlaWdodDogNjAwOyBjb2xvcjogIzEwYjk4MTtcIj5BdXRvLWZpbGwgQ29tcGxldGUhPC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjogIzZiNzI4MDsgZm9udC1zaXplOiAxMnB4OyBtYXJnaW4tdG9wOiA0cHg7XCI+XG4gICAgICAgICAgRmlsbGVkICR7ZmlsbGVkQ291bnR9IGZpZWxkcyR7YWlDb3VudCA+IDAgPyBgICsgJHthaUNvdW50fSBBSSBhbnN3ZXJzYCA6ICcnfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICBgO1xuICBcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub3RpZmljYXRpb24pO1xuICBcbiAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgbm90aWZpY2F0aW9uLnN0eWxlLmFuaW1hdGlvbiA9ICdzbGlkZU91dCAwLjNzIGVhc2Utb3V0JztcbiAgICBzZXRUaW1lb3V0KCgpID0+IG5vdGlmaWNhdGlvbi5yZW1vdmUoKSwgMzAwKTtcbiAgfSwgMzAwMCk7XG59XG5cbmludGVyZmFjZSBGaWVsZEluZm8ge1xuICBlbGVtZW50OiBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCB8IEhUTUxTZWxlY3RFbGVtZW50O1xuICB0eXBlOiBzdHJpbmcgfCBudWxsO1xuICBsYWJlbDogc3RyaW5nO1xuICByZXF1aXJlZDogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gZ2V0QWxsRmllbGRzKCk6IEZpZWxkSW5mb1tdIHtcbiAgY29uc3QgZmllbGRzOiBGaWVsZEluZm9bXSA9IFtdO1xuICBcbiAgY29uc3QgaW5wdXRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MSW5wdXRFbGVtZW50PihcbiAgICAnaW5wdXQ6bm90KFt0eXBlPVwiaGlkZGVuXCJdKTpub3QoW3R5cGU9XCJzdWJtaXRcIl0pOm5vdChbdHlwZT1cImJ1dHRvblwiXSk6bm90KFt0eXBlPVwiaW1hZ2VcIl0pJ1xuICApO1xuICBjb25zdCB0ZXh0YXJlYXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxUZXh0QXJlYUVsZW1lbnQ+KCd0ZXh0YXJlYScpO1xuICBjb25zdCBzZWxlY3RzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MU2VsZWN0RWxlbWVudD4oJ3NlbGVjdCcpO1xuICBcbiAgWy4uLmlucHV0cywgLi4udGV4dGFyZWFzLCAuLi5zZWxlY3RzXS5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgIGNvbnN0IGxhYmVsID0gZ2V0RmllbGRMYWJlbChlbGVtZW50KTtcbiAgICBjb25zdCB0eXBlID0gZGV0ZWN0RmllbGRUeXBlKGVsZW1lbnQsIGxhYmVsKTtcbiAgICBjb25zdCByZXF1aXJlZCA9IGlzRmllbGRSZXF1aXJlZChlbGVtZW50LCBsYWJlbCk7XG4gICAgXG4gICAgZmllbGRzLnB1c2goe1xuICAgICAgZWxlbWVudCxcbiAgICAgIHR5cGUsXG4gICAgICBsYWJlbCxcbiAgICAgIHJlcXVpcmVkXG4gICAgfSk7XG4gIH0pO1xuXG4gIGNvbnNvbGUubG9nKCdEZXRlY3RlZCBmaWVsZHM6JywgZmllbGRzLmxlbmd0aCk7XG4gIFxuICByZXR1cm4gZmllbGRzO1xufVxuXG5mdW5jdGlvbiBnZXRGaWVsZExhYmVsKGZpZWxkOiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIGlmIChmaWVsZC5pZCkge1xuICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgbGFiZWxbZm9yPVwiJHtmaWVsZC5pZH1cIl1gKTtcbiAgICBpZiAobGFiZWw/LnRleHRDb250ZW50KSByZXR1cm4gbGFiZWwudGV4dENvbnRlbnQudHJpbSgpO1xuICB9XG4gIFxuICBjb25zdCBwYXJlbnRMYWJlbCA9IGZpZWxkLmNsb3Nlc3QoJ2xhYmVsJyk7XG4gIGlmIChwYXJlbnRMYWJlbD8udGV4dENvbnRlbnQpIHJldHVybiBwYXJlbnRMYWJlbC50ZXh0Q29udGVudC50cmltKCk7XG4gIFxuICBsZXQgcHJldiA9IGZpZWxkLnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XG4gIHdoaWxlIChwcmV2KSB7XG4gICAgaWYgKHByZXYudGFnTmFtZSA9PT0gJ0xBQkVMJyAmJiBwcmV2LnRleHRDb250ZW50KSB7XG4gICAgICByZXR1cm4gcHJldi50ZXh0Q29udGVudC50cmltKCk7XG4gICAgfVxuICAgIHByZXYgPSBwcmV2LnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XG4gIH1cbiAgXG4gIGNvbnN0IHBhcmVudCA9IGZpZWxkLmNsb3Nlc3QoJ2RpdiwgZmllbGRzZXQsIGxpJyk7XG4gIGlmIChwYXJlbnQpIHtcbiAgICBjb25zdCBsYWJlbEVsID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJ2xhYmVsLCBsZWdlbmQnKTtcbiAgICBpZiAobGFiZWxFbD8udGV4dENvbnRlbnQpIHJldHVybiBsYWJlbEVsLnRleHRDb250ZW50LnRyaW0oKTtcbiAgfVxuICBcbiAgY29uc3QgYXJpYUxhYmVsID0gZmllbGQuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyk7XG4gIGlmIChhcmlhTGFiZWwpIHJldHVybiBhcmlhTGFiZWw7XG4gIFxuICBpZiAoJ3BsYWNlaG9sZGVyJyBpbiBmaWVsZCkge1xuICAgIGNvbnN0IGlucHV0RWxlbWVudCA9IGZpZWxkIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50O1xuICAgIGlmIChpbnB1dEVsZW1lbnQucGxhY2Vob2xkZXIpIHtcbiAgICAgIHJldHVybiBpbnB1dEVsZW1lbnQucGxhY2Vob2xkZXI7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4gJyc7XG59XG5cbmZ1bmN0aW9uIGRldGVjdEZpZWxkVHlwZShcbiAgZmllbGQ6IEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50IHwgSFRNTFNlbGVjdEVsZW1lbnQsXG4gIGxhYmVsOiBzdHJpbmdcbik6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBzZWFyY2hUZXh0ID0gbGFiZWwudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgZmllbGROYW1lID0gZmllbGQubmFtZS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBmaWVsZElkID0gZmllbGQuaWQudG9Mb3dlckNhc2UoKTtcbiAgXG4gIGNvbnN0IHNlYXJjaEluID0gYCR7c2VhcmNoVGV4dH0gJHtmaWVsZE5hbWV9ICR7ZmllbGRJZH1gO1xuICBcbiAgLy8gQmFzaWMgSW5mb1xuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2ZpcnN0IG5hbWUnLCAnZmlyc3RuYW1lJywgJ2dpdmVuIG5hbWUnLCAnZm5hbWUnXSkpIHtcbiAgICByZXR1cm4gJ2ZpcnN0TmFtZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydsYXN0IG5hbWUnLCAnbGFzdG5hbWUnLCAnc3VybmFtZScsICdmYW1pbHkgbmFtZScsICdsbmFtZSddKSkge1xuICAgIHJldHVybiAnbGFzdE5hbWUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnZnVsbCBuYW1lJywgJ3lvdXIgbmFtZScsICdsZWdhbCBuYW1lJ10pICYmICFzZWFyY2hJbi5pbmNsdWRlcygnZmlyc3QnKSAmJiAhc2VhcmNoSW4uaW5jbHVkZXMoJ2xhc3QnKSkge1xuICAgIHJldHVybiAnZnVsbE5hbWUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnZW1haWwnLCAnZS1tYWlsJywgJ2VtYWlsIGFkZHJlc3MnXSkpIHtcbiAgICByZXR1cm4gJ2VtYWlsJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3Bob25lJywgJ3RlbGVwaG9uZScsICdtb2JpbGUnLCAnY2VsbCcsICdjb250YWN0IG51bWJlciddKSkge1xuICAgIHJldHVybiAncGhvbmUnO1xuICB9XG4gIFxuICAvLyBMb2NhdGlvblxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3N0cmVldCBhZGRyZXNzJywgJ2FkZHJlc3MgbGluZScsICdhZGRyZXNzJ10pICYmICFzZWFyY2hJbi5pbmNsdWRlcygnZW1haWwnKSkge1xuICAgIHJldHVybiAnYWRkcmVzcyc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydjaXR5JywgJ3Rvd24nXSkpIHtcbiAgICByZXR1cm4gJ2NpdHknO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnc3RhdGUnLCAncHJvdmluY2UnLCAncmVnaW9uJ10pKSB7XG4gICAgcmV0dXJuICdzdGF0ZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWyd6aXAnLCAncG9zdGFsIGNvZGUnLCAncG9zdGNvZGUnLCAnemlwIGNvZGUnXSkpIHtcbiAgICByZXR1cm4gJ3ppcCc7XG4gIH1cbiAgXG4gIC8vIFByb2Zlc3Npb25hbFxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2pvYiB0aXRsZScsICdjdXJyZW50IHRpdGxlJywgJ3Bvc2l0aW9uJywgJ3JvbGUnXSkgJiYgIXNlYXJjaEluLmluY2x1ZGVzKCdkZXNpcmVkJykpIHtcbiAgICByZXR1cm4gJ2N1cnJlbnRUaXRsZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydjb21wYW55JywgJ2VtcGxveWVyJywgJ29yZ2FuaXphdGlvbicsICdjdXJyZW50IGNvbXBhbnknXSkpIHtcbiAgICByZXR1cm4gJ2N1cnJlbnRDb21wYW55JztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3llYXJzIG9mIGV4cGVyaWVuY2UnLCAneWVhcnMgZXhwZXJpZW5jZScsICdleHBlcmllbmNlJ10pKSB7XG4gICAgcmV0dXJuICd5ZWFyc0V4cGVyaWVuY2UnO1xuICB9XG4gIFxuICAvLyBFZHVjYXRpb25cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydlZHVjYXRpb24nLCAnZGVncmVlJywgJ3VuaXZlcnNpdHknLCAnc2Nob29sJywgJ2NvbGxlZ2UnXSkpIHtcbiAgICByZXR1cm4gJ2VkdWNhdGlvbic7XG4gIH1cbiAgXG4gIC8vIExpbmtzXG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnbGlua2VkaW4nLCAnbGlua2VkaW4gcHJvZmlsZScsICdsaW5rZWRpbiB1cmwnXSkpIHtcbiAgICByZXR1cm4gJ2xpbmtlZGluJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2dpdGh1YicsICdnaXRodWIgcHJvZmlsZScsICdnaXRodWIgdXJsJ10pKSB7XG4gICAgcmV0dXJuICdnaXRodWInO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsncG9ydGZvbGlvJywgJ3dlYnNpdGUnLCAncGVyc29uYWwgc2l0ZScsICdwZXJzb25hbCB3ZWJzaXRlJ10pKSB7XG4gICAgcmV0dXJuICdwb3J0Zm9saW8nO1xuICB9XG4gIFxuICAvLyBDb21wZW5zYXRpb25cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydzYWxhcnknLCAnY29tcGVuc2F0aW9uJywgJ2V4cGVjdGVkIHNhbGFyeScsICdzYWxhcnkgZXhwZWN0YXRpb24nLCAnZGVzaXJlZCBzYWxhcnknXSkpIHtcbiAgICByZXR1cm4gJ3NhbGFyeUV4cGVjdGF0aW9uJztcbiAgfVxuICBcbiAgLy8gQ2hlY2tib3hlc1xuICBpZiAoJ3R5cGUnIGluIGZpZWxkICYmIChmaWVsZC50eXBlID09PSAnY2hlY2tib3gnIHx8IGZpZWxkLnR5cGUgPT09ICdyYWRpbycpKSB7XG4gICAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydzcG9uc29yJywgJ3Zpc2EnLCAnYXV0aG9yaXplZCB0byB3b3JrJywgJ3dvcmsgYXV0aG9yaXphdGlvbicsICdyZXF1aXJlIHNwb25zb3JzaGlwJ10pKSB7XG4gICAgICByZXR1cm4gJ3Nwb25zb3JzaGlwJztcbiAgICB9XG4gICAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydyZWxvY2F0ZScsICdyZWxvY2F0aW9uJywgJ3dpbGxpbmcgdG8gbW92ZScsICd3aWxsaW5nIHRvIHJlbG9jYXRlJ10pKSB7XG4gICAgICByZXR1cm4gJ3JlbG9jYXRpb24nO1xuICAgIH1cbiAgICByZXR1cm4gJ2NoZWNrYm94LXVua25vd24nO1xuICB9XG4gIFxuICAvLyBDdXN0b20gcXVlc3Rpb25zXG4gIGlmIChmaWVsZC50YWdOYW1lID09PSAnVEVYVEFSRUEnIHx8ICgndHlwZScgaW4gZmllbGQgJiYgZmllbGQudHlwZSA9PT0gJ3RleHQnKSkge1xuICAgIGlmIChsYWJlbC5sZW5ndGggPiAzMCB8fCBsYWJlbC5pbmNsdWRlcygnPycpIHx8IGxhYmVsLmluY2x1ZGVzKCd3aHknKSB8fCBsYWJlbC5pbmNsdWRlcygnZGVzY3JpYmUnKSB8fCBsYWJlbC5pbmNsdWRlcygndGVsbCB1cycpKSB7XG4gICAgICByZXR1cm4gJ2N1c3RvbVF1ZXN0aW9uJztcbiAgICB9XG4gIH1cbiAgXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBtYXRjaGVzS2V5d29yZHModGV4dDogc3RyaW5nLCBrZXl3b3Jkczogc3RyaW5nW10pOiBib29sZWFuIHtcbiAgcmV0dXJuIGtleXdvcmRzLnNvbWUoa2V5d29yZCA9PiB0ZXh0LmluY2x1ZGVzKGtleXdvcmQpKTtcbn1cblxuZnVuY3Rpb24gaXNGaWVsZFJlcXVpcmVkKGZpZWxkOiBIVE1MRWxlbWVudCwgbGFiZWw6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBpZiAoJ3JlcXVpcmVkJyBpbiBmaWVsZCAmJiBmaWVsZC5yZXF1aXJlZCkgcmV0dXJuIHRydWU7XG4gIGlmIChmaWVsZC5nZXRBdHRyaWJ1dGUoJ2FyaWEtcmVxdWlyZWQnKSA9PT0gJ3RydWUnKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGxhYmVsLmluY2x1ZGVzKCcqJykpIHJldHVybiB0cnVlO1xuICBpZiAobGFiZWwudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygncmVxdWlyZWQnKSkgcmV0dXJuIHRydWU7XG4gIHJldHVybiBmYWxzZTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYXV0b0ZpbGxGb3JtKHByb2ZpbGU6IFVzZXJQcm9maWxlKSB7XG4gIGNvbnN0IGZpZWxkcyA9IGdldEFsbEZpZWxkcygpO1xuICBcbiAgbGV0IGZpbGxlZENvdW50ID0gMDtcbiAgbGV0IGFpQW5zd2VyZWRDb3VudCA9IDA7XG4gIGNvbnN0IGN1c3RvbVF1ZXN0aW9uczogRmllbGRJbmZvW10gPSBbXTtcbiAgXG4gIC8vIEZpcnN0IHBhc3M6IGZpbGwgYWxsIHN0YW5kYXJkIGZpZWxkc1xuICBmb3IgKGNvbnN0IGZpZWxkSW5mbyBvZiBmaWVsZHMpIHtcbiAgICBpZiAoIWZpZWxkSW5mby50eXBlKSBjb250aW51ZTtcbiAgICBcbiAgICAvLyBDb2xsZWN0IGN1c3RvbSBxdWVzdGlvbnMgZm9yIEFJIGxhdGVyXG4gICAgaWYgKGZpZWxkSW5mby50eXBlID09PSAnY3VzdG9tUXVlc3Rpb24nKSB7XG4gICAgICBjdXN0b21RdWVzdGlvbnMucHVzaChmaWVsZEluZm8pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIFxuICAgIC8vIEZpbGwgc3RhbmRhcmQgZmllbGRzXG4gICAgY29uc3Qgc3VjY2VzcyA9IGZpbGxGaWVsZChmaWVsZEluZm8sIHByb2ZpbGUpO1xuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICBjb25zb2xlLmxvZyhgRmlsbGVkOiAke2ZpZWxkSW5mby50eXBlfWApO1xuICAgICAgZmlsbGVkQ291bnQrKztcbiAgICB9XG4gIH1cbiAgXG4gIGNvbnNvbGUubG9nKGBGaWxsZWQgJHtmaWxsZWRDb3VudH0gc3RhbmRhcmQgZmllbGRzYCk7XG4gIFxuICAvLyBTZWNvbmQgcGFzczogdXNlIEFJIGZvciBjdXN0b20gcXVlc3Rpb25zIChpZiBhdmFpbGFibGUpXG4gIGlmIChjdXN0b21RdWVzdGlvbnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnNvbGUubG9nKGBGb3VuZCAke2N1c3RvbVF1ZXN0aW9ucy5sZW5ndGh9IGN1c3RvbSBxdWVzdGlvbnNgKTtcbiAgICBjb25zdCBqb2JDb250ZXh0ID0gZXh0cmFjdEpvYkNvbnRleHQoKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGZpZWxkSW5mbyBvZiBjdXN0b21RdWVzdGlvbnMpIHtcbiAgICAgIGNvbnN0IGFuc3dlciA9IGF3YWl0IGFuc3dlckN1c3RvbVF1ZXN0aW9uKGZpZWxkSW5mby5sYWJlbCwgcHJvZmlsZSwgam9iQ29udGV4dCk7XG4gICAgICBpZiAoYW5zd2VyKSB7XG4gICAgICAgIGZpbGxUZXh0RmllbGQoZmllbGRJbmZvLmVsZW1lbnQgYXMgSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQsIGFuc3dlcik7XG4gICAgICAgIGFpQW5zd2VyZWRDb3VudCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHtcbiAgICBmaWxsZWQ6IGZpbGxlZENvdW50LFxuICAgIGFpQW5zd2VyZWQ6IGFpQW5zd2VyZWRDb3VudFxuICB9O1xufVxuXG5mdW5jdGlvbiBmaWxsRmllbGQoZmllbGRJbmZvOiBGaWVsZEluZm8sIHByb2ZpbGU6IFVzZXJQcm9maWxlKTogYm9vbGVhbiB7XG4gIGNvbnN0IHsgZWxlbWVudCwgdHlwZSB9ID0gZmllbGRJbmZvO1xuICBcbiAgY29uc3QgdmFsdWUgPSBnZXRWYWx1ZUZvckZpZWxkVHlwZSh0eXBlLCBwcm9maWxlKTtcbiAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09ICcnKSByZXR1cm4gZmFsc2U7XG4gIFxuICAvLyBGaWxsIGJhc2VkIG9uIGVsZW1lbnQgdHlwZVxuICBpZiAoZWxlbWVudC50YWdOYW1lID09PSAnU0VMRUNUJykge1xuICAgIHJldHVybiBmaWxsU2VsZWN0KGVsZW1lbnQgYXMgSFRNTFNlbGVjdEVsZW1lbnQsIHZhbHVlKTtcbiAgfSBlbHNlIGlmICgndHlwZScgaW4gZWxlbWVudCAmJiBlbGVtZW50LnR5cGUgPT09ICdjaGVja2JveCcpIHtcbiAgICByZXR1cm4gZmlsbENoZWNrYm94KGVsZW1lbnQgYXMgSFRNTElucHV0RWxlbWVudCwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKCd0eXBlJyBpbiBlbGVtZW50ICYmIGVsZW1lbnQudHlwZSA9PT0gJ3JhZGlvJykge1xuICAgIHJldHVybiBmaWxsUmFkaW8oZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZpbGxUZXh0RmllbGQoZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCwgdmFsdWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFZhbHVlRm9yRmllbGRUeXBlKHR5cGU6IHN0cmluZyB8IG51bGwsIHByb2ZpbGU6IFVzZXJQcm9maWxlKTogYW55IHtcbiAgaWYgKCF0eXBlKSByZXR1cm4gbnVsbDtcbiAgXG4gIC8vIEdldCBjdXJyZW50IGpvYiBpZiBlbXBsb3ltZW50IGhpc3RvcnkgZXhpc3RzXG4gIGNvbnN0IGN1cnJlbnRKb2IgPSAocHJvZmlsZS5lbXBsb3ltZW50SGlzdG9yeSB8fCBbXSkuZmluZChqb2IgPT4gam9iLmlzQ3VycmVudCk7XG4gIGNvbnN0IG1vc3RSZWNlbnRKb2IgPSAocHJvZmlsZS5lbXBsb3ltZW50SGlzdG9yeSB8fCBbXSlbMF07IC8vIEZpcnN0IGVudHJ5XG4gIGNvbnN0IGpvYlRvVXNlID0gY3VycmVudEpvYiB8fCBtb3N0UmVjZW50Sm9iO1xuICBcbiAgY29uc3QgdmFsdWVNYXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gICAgLy8gQmFzaWNcbiAgICBmaXJzdE5hbWU6IHByb2ZpbGUuZmlyc3ROYW1lLFxuICAgIGxhc3ROYW1lOiBwcm9maWxlLmxhc3ROYW1lLFxuICAgIGZ1bGxOYW1lOiBgJHtwcm9maWxlLmZpcnN0TmFtZX0gJHtwcm9maWxlLmxhc3ROYW1lfWAsXG4gICAgZW1haWw6IHByb2ZpbGUuZW1haWwsXG4gICAgcGhvbmU6IHByb2ZpbGUucGhvbmUsXG4gICAgXG4gICAgLy8gTG9jYXRpb25cbiAgICBhZGRyZXNzOiBwcm9maWxlLmFkZHJlc3MsXG4gICAgY2l0eTogcHJvZmlsZS5jaXR5LFxuICAgIHN0YXRlOiBwcm9maWxlLnN0YXRlLFxuICAgIHppcDogcHJvZmlsZS56aXAsXG4gICAgXG4gICAgLy8gUHJvZmVzc2lvbmFsICh1c2UgZW1wbG95bWVudCBoaXN0b3J5IGlmIGF2YWlsYWJsZSwgZmFsbGJhY2sgdG8gb2xkIGZpZWxkcylcbiAgICBjdXJyZW50VGl0bGU6IGpvYlRvVXNlPy5qb2JUaXRsZSB8fCAnJyxcbiAgICBjdXJyZW50Q29tcGFueTogam9iVG9Vc2U/LmNvbXBhbnkgfHwgJycsXG4gICAgeWVhcnNFeHBlcmllbmNlOiBwcm9maWxlLnllYXJzRXhwZXJpZW5jZSxcbiAgICBcbiAgICAvLyBFZHVjYXRpb25cbiAgICBlZHVjYXRpb246IHByb2ZpbGUuZWR1Y2F0aW9uLFxuICAgIFxuICAgIC8vIExpbmtzXG4gICAgbGlua2VkaW46IHByb2ZpbGUubGlua2VkaW4sXG4gICAgZ2l0aHViOiBwcm9maWxlLmdpdGh1YixcbiAgICBwb3J0Zm9saW86IHByb2ZpbGUucG9ydGZvbGlvLFxuICAgIFxuICAgIC8vIENvbXBlbnNhdGlvblxuICAgIHNhbGFyeUV4cGVjdGF0aW9uOiBwcm9maWxlLnNhbGFyeUV4cGVjdGF0aW9uLFxuICAgIFxuICAgIC8vIFByZWZlcmVuY2VzXG4gICAgc3BvbnNvcnNoaXA6IHByb2ZpbGUubmVlZHNTcG9uc29yc2hpcCA/ICd5ZXMnIDogJ25vJyxcbiAgICByZWxvY2F0aW9uOiBwcm9maWxlLndpbGxpbmdUb1JlbG9jYXRlID8gJ3llcycgOiAnbm8nLFxuICB9O1xuICBcbiAgcmV0dXJuIHZhbHVlTWFwW3R5cGVdO1xufVxuXG5mdW5jdGlvbiBmaWxsVGV4dEZpZWxkKFxuICBmaWVsZDogSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQsXG4gIHZhbHVlOiBzdHJpbmdcbik6IGJvb2xlYW4ge1xuICBmaWVsZC52YWx1ZSA9IHZhbHVlO1xuICB0cmlnZ2VySW5wdXRFdmVudHMoZmllbGQpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbFNlbGVjdChzZWxlY3Q6IEhUTUxTZWxlY3RFbGVtZW50LCB2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIGNvbnN0IG9wdGlvbnMgPSBBcnJheS5mcm9tKHNlbGVjdC5vcHRpb25zKTtcbiAgXG4gIC8vIFRyeSBleGFjdCBtYXRjaFxuICBsZXQgbWF0Y2ggPSBvcHRpb25zLmZpbmQob3B0ID0+IFxuICAgIG9wdC52YWx1ZSA9PT0gdmFsdWUgfHwgb3B0LnRleHQgPT09IHZhbHVlXG4gICk7XG4gIFxuICAvLyBUcnkgZnV6enkgbWF0Y2hcbiAgaWYgKCFtYXRjaCkge1xuICAgIGNvbnN0IHZhbHVlTG93ZXIgPSB2YWx1ZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCk7XG4gICAgbWF0Y2ggPSBvcHRpb25zLmZpbmQob3B0ID0+IFxuICAgICAgb3B0LnZhbHVlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModmFsdWVMb3dlcikgfHxcbiAgICAgIG9wdC50ZXh0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModmFsdWVMb3dlcilcbiAgICApO1xuICB9XG4gIFxuICAvLyBUcnkgbnVtZXJpYyBtYXRjaCAoZm9yIHllYXJzIG9mIGV4cGVyaWVuY2UpXG4gIGlmICghbWF0Y2ggJiYgIWlzTmFOKHZhbHVlKSkge1xuICAgIG1hdGNoID0gb3B0aW9ucy5maW5kKG9wdCA9PiBvcHQudmFsdWUgPT09IHZhbHVlLnRvU3RyaW5nKCkpO1xuICB9XG4gIFxuICBpZiAobWF0Y2gpIHtcbiAgICBzZWxlY3QudmFsdWUgPSBtYXRjaC52YWx1ZTtcbiAgICB0cmlnZ2VySW5wdXRFdmVudHMoc2VsZWN0KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBmaWxsQ2hlY2tib3goY2hlY2tib3g6IEhUTUxJbnB1dEVsZW1lbnQsIHZhbHVlOiBhbnkpOiBib29sZWFuIHtcbiAgY29uc3Qgc2hvdWxkQ2hlY2sgPSB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gJ3llcycgfHwgdmFsdWUgPT09ICd0cnVlJztcbiAgY2hlY2tib3guY2hlY2tlZCA9IHNob3VsZENoZWNrO1xuICB0cmlnZ2VySW5wdXRFdmVudHMoY2hlY2tib3gpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbFJhZGlvKHJhZGlvOiBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIGNvbnN0IHJhZGlvcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTElucHV0RWxlbWVudD4oYGlucHV0W25hbWU9XCIke3JhZGlvLm5hbWV9XCJdYCk7XG4gIGNvbnN0IHZhbHVlTG93ZXIgPSB2YWx1ZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCk7XG4gIFxuICBjb25zdCBtYXRjaCA9IEFycmF5LmZyb20ocmFkaW9zKS5maW5kKHIgPT4ge1xuICAgIGNvbnN0IGxhYmVsID0gZ2V0RmllbGRMYWJlbChyKS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiBsYWJlbC5pbmNsdWRlcyh2YWx1ZUxvd2VyKSB8fCByLnZhbHVlLnRvTG93ZXJDYXNlKCkgPT09IHZhbHVlTG93ZXI7XG4gIH0pO1xuICBcbiAgaWYgKG1hdGNoKSB7XG4gICAgbWF0Y2guY2hlY2tlZCA9IHRydWU7XG4gICAgdHJpZ2dlcklucHV0RXZlbnRzKG1hdGNoKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiB0cmlnZ2VySW5wdXRFdmVudHMoZWxlbWVudDogSFRNTEVsZW1lbnQpIHtcbiAgY29uc3QgZXZlbnRzID0gW1xuICAgIG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSksXG4gICAgbmV3IEV2ZW50KCdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSksXG4gICAgbmV3IEV2ZW50KCdibHVyJywgeyBidWJibGVzOiB0cnVlIH0pLFxuICBdO1xuICBcbiAgZXZlbnRzLmZvckVhY2goZXZlbnQgPT4gZWxlbWVudC5kaXNwYXRjaEV2ZW50KGV2ZW50KSk7XG4gIFxuICAvLyBTcGVjaWFsIGhhbmRsaW5nIGZvciBSZWFjdFxuICBpZiAoJ3ZhbHVlJyBpbiBlbGVtZW50KSB7XG4gICAgY29uc3QgbmF0aXZlSW5wdXRWYWx1ZVNldHRlciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXG4gICAgICB3aW5kb3cuSFRNTElucHV0RWxlbWVudC5wcm90b3R5cGUsXG4gICAgICAndmFsdWUnXG4gICAgKT8uc2V0O1xuICAgIFxuICAgIGlmIChuYXRpdmVJbnB1dFZhbHVlU2V0dGVyKSB7XG4gICAgICBuYXRpdmVJbnB1dFZhbHVlU2V0dGVyLmNhbGwoZWxlbWVudCwgKGVsZW1lbnQgYXMgYW55KS52YWx1ZSk7XG4gICAgICBlbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RKb2JDb250ZXh0KCkge1xuICBjb25zdCB0aXRsZSA9IFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2gxJyk/LnRleHRDb250ZW50IHx8XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2NsYXNzKj1cImpvYi10aXRsZVwiXScpPy50ZXh0Q29udGVudCB8fFxuICAgICd0aGlzIHBvc2l0aW9uJztcbiAgICBcbiAgY29uc3QgY29tcGFueSA9IFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tjbGFzcyo9XCJjb21wYW55XCJdJyk/LnRleHRDb250ZW50IHx8XG4gICAgJ3RoaXMgY29tcGFueSc7XG5cbiAgcmV0dXJuIHtcbiAgICB0aXRsZTogdGl0bGUudHJpbSgpLFxuICAgIGNvbXBhbnk6IGNvbXBhbnkudHJpbSgpXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFuc3dlckN1c3RvbVF1ZXN0aW9uKFxuICBxdWVzdGlvbjogc3RyaW5nLFxuICBwcm9maWxlOiBVc2VyUHJvZmlsZSxcbiAgam9iQ29udGV4dDogeyB0aXRsZTogc3RyaW5nOyBjb21wYW55OiBzdHJpbmcgfVxuKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIC8vIEdldCBjdXJyZW50IG9yIG1vc3QgcmVjZW50IGpvYlxuICBjb25zdCBjdXJyZW50Sm9iID0gKHByb2ZpbGUuZW1wbG95bWVudEhpc3RvcnkgfHwgW10pLmZpbmQoam9iID0+IGpvYi5pc0N1cnJlbnQpO1xuICBjb25zdCBtb3N0UmVjZW50Sm9iID0gKHByb2ZpbGUuZW1wbG95bWVudEhpc3RvcnkgfHwgW10pWzBdO1xuICBjb25zdCBqb2JUb1JlZmVyZW5jZSA9IGN1cnJlbnRKb2IgfHwgbW9zdFJlY2VudEpvYjtcbiAgXG4gIGNvbnN0IGN1cnJlbnRSb2xlID0gam9iVG9SZWZlcmVuY2U/LmpvYlRpdGxlIHx8ICdOb3Qgc3BlY2lmaWVkJztcbiAgY29uc3QgY3VycmVudENvbXBhbnkgPSBqb2JUb1JlZmVyZW5jZT8uY29tcGFueSB8fCAnJztcbiAgXG4gIC8vIEJ1aWxkIHNraWxscyBzdHJpbmdcbiAgY29uc3Qgc2tpbGxzU3RyID0gKHByb2ZpbGUuc2tpbGxzIHx8IFtdKS5qb2luKCcsICcpIHx8ICdOb3Qgc3BlY2lmaWVkJztcbiAgXG4gIC8vIEJ1aWxkIGV4cGVyaWVuY2Ugc3VtbWFyeSBmcm9tIGVtcGxveW1lbnQgaGlzdG9yeVxuICBsZXQgZXhwZXJpZW5jZVN1bW1hcnkgPSAnJztcbiAgaWYgKHByb2ZpbGUuZW1wbG95bWVudEhpc3RvcnkgJiYgcHJvZmlsZS5lbXBsb3ltZW50SGlzdG9yeS5sZW5ndGggPiAwKSB7XG4gICAgZXhwZXJpZW5jZVN1bW1hcnkgPSBwcm9maWxlLmVtcGxveW1lbnRIaXN0b3J5LnNsaWNlKDAsIDIpLm1hcChqb2IgPT4gXG4gICAgICBgJHtqb2Iuam9iVGl0bGV9IGF0ICR7am9iLmNvbXBhbnl9ICgke2pvYi5zdGFydERhdGV9IC0gJHtqb2IuaXNDdXJyZW50ID8gJ1ByZXNlbnQnIDogam9iLmVuZERhdGV9KWBcbiAgICApLmpvaW4oJzsgJyk7XG4gIH1cbiAgXG4gIGNvbnN0IHByb21wdCA9IGBZb3UgYXJlIGhlbHBpbmcgc29tZW9uZSBmaWxsIG91dCBhIGpvYiBhcHBsaWNhdGlvbi4gQW5zd2VyIHRoaXMgcXVlc3Rpb24gcHJvZmVzc2lvbmFsbHkgYW5kIGNvbmNpc2VseSAobWF4IDEwMCB3b3Jkcyk6XG5cblF1ZXN0aW9uOiBcIiR7cXVlc3Rpb259XCJcblxuSm9iIEFwcGx5aW5nIEZvcjogJHtqb2JDb250ZXh0LnRpdGxlfSBhdCAke2pvYkNvbnRleHQuY29tcGFueX1cblxuQ2FuZGlkYXRlIFByb2ZpbGU6XG4tIE5hbWU6ICR7cHJvZmlsZS5maXJzdE5hbWV9ICR7cHJvZmlsZS5sYXN0TmFtZX1cbi0gQ3VycmVudC9SZWNlbnQgUm9sZTogJHtjdXJyZW50Um9sZX0ke2N1cnJlbnRDb21wYW55ID8gYCBhdCAke2N1cnJlbnRDb21wYW55fWAgOiAnJ31cbi0gVG90YWwgRXhwZXJpZW5jZTogJHtwcm9maWxlLnllYXJzRXhwZXJpZW5jZSB8fCAwfSB5ZWFyc1xuLSBLZXkgU2tpbGxzOiAke3NraWxsc1N0cn1cbiR7ZXhwZXJpZW5jZVN1bW1hcnkgPyBgLSBXb3JrIEhpc3Rvcnk6ICR7ZXhwZXJpZW5jZVN1bW1hcnl9YCA6ICcnfVxuJHtwcm9maWxlLmVkdWNhdGlvbiA/IGAtIEVkdWNhdGlvbjogJHtwcm9maWxlLmVkdWNhdGlvbn1gIDogJyd9XG5cblByb3ZpZGUgb25seSB0aGUgYW5zd2VyLCBubyBwcmVhbWJsZSBvciBleHBsYW5hdGlvbi4gQmUgc3BlY2lmaWMgYW5kIHJlbGV2YW50IHRvIGJvdGggdGhlIHF1ZXN0aW9uIGFuZCB0aGUgam9iLmA7XG5cbiAgdHJ5IHtcbiAgICAvLyBAdHMtaWdub3JlIC0gQ2hyb21lIEFJIEFQSVxuICAgIGNvbnN0IGF2YWlsYWJpbGl0eSA9IGF3YWl0IGFpLmxhbmd1YWdlTW9kZWwuYXZhaWxhYmlsaXR5KCk7XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnbm8nKSB7XG4gICAgICBjb25zb2xlLndhcm4oXCJHZW1pbmkgTmFubyBub3QgYXZhaWxhYmxlXCIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGF2YWlsYWJpbGl0eSA9PT0gJ2FmdGVyLWRvd25sb2FkJykge1xuICAgICAgY29uc29sZS5sb2coXCJUcmlnZ2VyaW5nIEdlbWluaSBOYW5vIGRvd25sb2FkXCIpO1xuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgYXdhaXQgYWkubGFuZ3VhZ2VNb2RlbC5jcmVhdGUoKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgYWkubGFuZ3VhZ2VNb2RlbC5jcmVhdGUoKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzZXNzaW9uLnByb21wdChwcm9tcHQpO1xuICAgIFxuICAgIHNlc3Npb24uZGVzdHJveSgpO1xuICAgIHJldHVybiByZXN1bHQudHJpbSgpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0FJIGFuc3dlcmluZyBmYWlsZWQ6JywgZXJyb3IpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59IiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG4gIGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICBtZXRob2QoYFt3eHRdICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbiAgfVxufVxuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IHtcbiAgZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcbiAgbG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuICB3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcbiAgZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEludGVydmFscyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNsZWFySW50ZXJ2YWxgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsQW5pbWF0aW9uRnJhbWVgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsSWRsZUNhbGxiYWNrYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSwgb3B0aW9ucyk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICBhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuICAgIGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcbiAgICB9XG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/LihcbiAgICAgIHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLFxuICAgICAgaGFuZGxlcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgc2lnbmFsOiB0aGlzLnNpZ25hbFxuICAgICAgfVxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cbiAgICovXG4gIG5vdGlmeUludmFsaWRhdGVkKCkge1xuICAgIHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuICAgIGxvZ2dlci5kZWJ1ZyhcbiAgICAgIGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYFxuICAgICk7XG4gIH1cbiAgc3RvcE9sZFNjcmlwdHMoKSB7XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKFxuICAgICAge1xuICAgICAgICB0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG4gICAgICAgIGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuICAgICAgICBtZXNzYWdlSWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpXG4gICAgICB9LFxuICAgICAgXCIqXCJcbiAgICApO1xuICB9XG4gIHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuICAgIGNvbnN0IGlzU2NyaXB0U3RhcnRlZEV2ZW50ID0gZXZlbnQuZGF0YT8udHlwZSA9PT0gQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFO1xuICAgIGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kYXRhPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcbiAgICBjb25zdCBpc05vdER1cGxpY2F0ZSA9ICF0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5oYXMoZXZlbnQuZGF0YT8ubWVzc2FnZUlkKTtcbiAgICByZXR1cm4gaXNTY3JpcHRTdGFydGVkRXZlbnQgJiYgaXNTYW1lQ29udGVudFNjcmlwdCAmJiBpc05vdER1cGxpY2F0ZTtcbiAgfVxuICBsaXN0ZW5Gb3JOZXdlclNjcmlwdHMob3B0aW9ucykge1xuICAgIGxldCBpc0ZpcnN0ID0gdHJ1ZTtcbiAgICBjb25zdCBjYiA9IChldmVudCkgPT4ge1xuICAgICAgaWYgKHRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkge1xuICAgICAgICB0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5hZGQoZXZlbnQuZGF0YS5tZXNzYWdlSWQpO1xuICAgICAgICBjb25zdCB3YXNGaXJzdCA9IGlzRmlyc3Q7XG4gICAgICAgIGlzRmlyc3QgPSBmYWxzZTtcbiAgICAgICAgaWYgKHdhc0ZpcnN0ICYmIG9wdGlvbnM/Lmlnbm9yZUZpcnN0RXZlbnQpIHJldHVybjtcbiAgICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiByZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYikpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiZGVmaW5pdGlvbiIsInJlc3VsdCIsImJyb3dzZXIiLCJfYnJvd3NlciIsInByaW50IiwibG9nZ2VyIl0sIm1hcHBpbmdzIjoiOztBQUFPLFdBQVMsb0JBQW9CQSxhQUFZO0FBQzlDLFdBQU9BO0FBQUEsRUFDVDtBQ0NBLFFBQUEsYUFBQSxvQkFBQTtBQUFBLElBQW1DLFNBQUE7QUFBQSxNQUN4QjtBQUFBLE1BQ1A7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNBO0FBQUEsSUFDRixNQUFBLE9BQUE7QUFHRSxjQUFBLElBQUEseUJBQUE7QUFFQSxhQUFBLFFBQUEsVUFBQSxZQUFBLENBQUEsU0FBQSxRQUFBLGlCQUFBO0FBQ0UsWUFBQSxRQUFBLFdBQUEsbUJBQUE7QUFDRSxrQkFBQSxJQUFBLDRCQUFBO0FBRUEsaUJBQUEsUUFBQSxZQUFBLEVBQUEsTUFBQSxjQUFBLEdBQUEsQ0FBQSxhQUFBO0FBQ0UsZ0JBQUEsT0FBQSxRQUFBLFdBQUE7QUFDRSxzQkFBQSxNQUFBLHFCQUFBLE9BQUEsUUFBQSxTQUFBO0FBQ0E7QUFBQSxZQUFBO0FBRUYsb0JBQUEsSUFBQSxhQUFBO0FBQ0EsZ0NBQUEsU0FBQSxPQUFBO0FBQUEsVUFBb0MsQ0FBQTtBQUFBLFFBQ3JDO0FBQUEsTUFDSCxDQUFBO0FBQUEsSUFDRDtBQUFBLEVBRUwsQ0FBQTtBQUVBLGlCQUFBLG9CQUFBLFNBQUE7QUFDRSxRQUFBO0FBQ0UsVUFBQSxDQUFBLFNBQUE7QUFDRSxjQUFBLG9EQUFBO0FBQ0E7QUFBQSxNQUFBO0FBSUYsWUFBQUMsVUFBQSxNQUFBLGFBQUEsT0FBQTtBQUdBLHlCQUFBQSxRQUFBLFFBQUFBLFFBQUEsVUFBQTtBQUFBLElBQW1ELFNBQUEsT0FBQTtBQUduRCxjQUFBLE1BQUEsb0JBQUEsS0FBQTtBQUNBLFlBQUEseUNBQUE7QUFBQSxJQUErQztBQUFBLEVBRW5EO0FBRUEsV0FBQSxtQkFBQSxhQUFBLFNBQUE7QUFDRSxVQUFBLGVBQUEsU0FBQSxjQUFBLEtBQUE7QUFDQSxpQkFBQSxN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QUFBLGdCQUFBLFVBQUEsQ0FBQSxTQUFBLFVBQUEsZUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFNBQUEsYUFBQSxVQUFBLFFBQUEsZ0JBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFJVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxrQkFBQSxnQkFBQSxTQUFBLENBQUEsS0FBQSxDQUFBLFNBQUEsU0FBQSxPQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFFBQUEsTUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFNBQUEsWUFBQSxRQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsT0FBQSxlQUFBLFlBQUEsVUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUlULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLGFBQUEsaUJBQUEsWUFBQSxNQUFBLENBQUEsS0FBQSxDQUFBLFNBQUEsU0FBQSxTQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFdBQUEsWUFBQSxnQkFBQSxpQkFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLHVCQUFBLG9CQUFBLFlBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFJVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxhQUFBLFVBQUEsY0FBQSxVQUFBLFNBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFJVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxZQUFBLG9CQUFBLGNBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxVQUFBLGtCQUFBLFlBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxhQUFBLFdBQUEsaUJBQUEsa0JBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFJVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxVQUFBLGdCQUFBLG1CQUFBLHNCQUFBLGdCQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBSVQsUUFBQSxVQUFBLFVBQUEsTUFBQSxTQUFBLGNBQUEsTUFBQSxTQUFBLFVBQUE7QUFDRSxVQUFBLGdCQUFBLFVBQUEsQ0FBQSxXQUFBLFFBQUEsc0JBQUEsc0JBQUEscUJBQUEsQ0FBQSxHQUFBO0FBQ0UsZUFBQTtBQUFBLE1BQU87QUFFVCxVQUFBLGdCQUFBLFVBQUEsQ0FBQSxZQUFBLGNBQUEsbUJBQUEscUJBQUEsQ0FBQSxHQUFBO0FBQ0UsZUFBQTtBQUFBLE1BQU87QUFFVCxhQUFBO0FBQUEsSUFBTztBQUlULFFBQUEsTUFBQSxZQUFBLGNBQUEsVUFBQSxTQUFBLE1BQUEsU0FBQSxRQUFBO0FBQ0UsVUFBQSxNQUFBLFNBQUEsTUFBQSxNQUFBLFNBQUEsR0FBQSxLQUFBLE1BQUEsU0FBQSxLQUFBLEtBQUEsTUFBQSxTQUFBLFVBQUEsS0FBQSxNQUFBLFNBQUEsU0FBQSxHQUFBO0FBQ0UsZUFBQTtBQUFBLE1BQU87QUFBQSxJQUNUO0FBR0YsV0FBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLGdCQUFBLE1BQUEsVUFBQTtBQUNFLFdBQUEsU0FBQSxLQUFBLENBQUEsWUFBQSxLQUFBLFNBQUEsT0FBQSxDQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsZ0JBQUEsT0FBQSxPQUFBO0FBQ0UsUUFBQSxjQUFBLFNBQUEsTUFBQSxTQUFBLFFBQUE7QUFDQSxRQUFBLE1BQUEsYUFBQSxlQUFBLE1BQUEsT0FBQSxRQUFBO0FBQ0EsUUFBQSxNQUFBLFNBQUEsR0FBQSxFQUFBLFFBQUE7QUFDQSxRQUFBLE1BQUEsWUFBQSxFQUFBLFNBQUEsVUFBQSxFQUFBLFFB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QUNuRSxZQUFNLGlCQUFpQixDQUFDLEtBQUssbUJBQW1CLElBQUksTUFBTSxNQUFNLFNBQVM7QUFDekUsYUFBTyx3QkFBd0IsdUJBQXVCO0FBQUEsSUFDeEQ7QUFBQSxJQUNBLHNCQUFzQixTQUFTO0FBQzdCLFVBQUksVUFBVTtBQUNkLFlBQU0sS0FBSyxDQUFDLFVBQVU7QUFDcEIsWUFBSSxLQUFLLHlCQUF5QixLQUFLLEdBQUc7QUFDeEMsZUFBSyxtQkFBbUIsSUFBSSxNQUFNLEtBQUssU0FBUztBQUNoRCxnQkFBTSxXQUFXO0FBQ2pCLG9CQUFVO0FBQ1YsY0FBSSxZQUFZLFNBQVMsaUJBQWtCO0FBQzNDLGVBQUssa0JBQWlCO0FBQUEsUUFDeEI7QUFBQSxNQUNGO0FBQ0EsdUJBQWlCLFdBQVcsRUFBRTtBQUM5QixXQUFLLGNBQWMsTUFBTSxvQkFBb0IsV0FBVyxFQUFFLENBQUM7QUFBQSxJQUM3RDtBQUFBLEVBQ0Y7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwyLDMsNCw1LDYsN119
content;