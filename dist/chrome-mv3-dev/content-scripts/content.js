var content = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const definition = defineContentScript({
    matches: [],
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
            console.log("Got profile:", response);
            handleAutoFillClick(response.profile);
          });
        }
      });
    }
  });
  async function handleAutoFillClick(profile) {
    try {
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
    console.log(fields);
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
    if (matchesKeywords(searchIn, ["full name", "your name"]) && !searchIn.includes("first") && !searchIn.includes("last")) {
      return "fullName";
    }
    if (matchesKeywords(searchIn, ["email", "e-mail"])) {
      return "email";
    }
    if (matchesKeywords(searchIn, ["phone", "telephone", "mobile", "cell"])) {
      return "phone";
    }
    if (matchesKeywords(searchIn, ["linkedin", "linkedin profile"])) {
      return "linkedin";
    }
    if (matchesKeywords(searchIn, ["portfolio", "website", "personal site", "github"])) {
      return "portfolio";
    }
    if (matchesKeywords(searchIn, ["current company", "employer"])) {
      return "currentCompany";
    }
    if (matchesKeywords(searchIn, ["current title", "job title", "current role", "position"])) {
      return "currentTitle";
    }
    if (matchesKeywords(searchIn, ["years of experience", "experience", "years experience"])) {
      return "experience";
    }
    if (matchesKeywords(searchIn, ["address", "street"])) {
      return "address";
    }
    if (matchesKeywords(searchIn, ["city", "town"])) {
      return "city";
    }
    if (matchesKeywords(searchIn, ["state", "province"])) {
      return "state";
    }
    if (matchesKeywords(searchIn, ["zip", "postal code", "postcode"])) {
      return "zip";
    }
    if ("type" in field && (field.type === "checkbox" || field.type === "radio")) {
      if (matchesKeywords(searchIn, ["sponsor", "visa", "authorized to work", "work authorization"])) {
        return "sponsorship";
      }
      if (matchesKeywords(searchIn, ["relocate", "relocation", "willing to move"])) {
        return "relocation";
      }
      return "checkbox-unknown";
    }
    if (field.tagName === "TEXTAREA" || "type" in field && field.type === "text") {
      if (label.length > 30 || label.includes("?") || label.includes("why") || label.includes("describe")) {
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
      if (success) filledCount++;
    }
    if (customQuestions.length > 0) {
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
    if (!value) return false;
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
    const valueMap = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: `${profile.firstName} ${profile.lastName}`,
      email: profile.email,
      phone: profile.phone,
      linkedin: profile.linkedin,
      portfolio: profile.portfolio,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zip: profile.zip,
      currentCompany: profile.currentCompany,
      currentTitle: profile.currentTitle,
      experience: profile.yearsExperience,
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
    const prompt = `You are helping someone fill out a job application. Answer this question professionally and concisely (max 100 words):

Question: "${question}"

Job: ${jobContext.title} at ${jobContext.company}

Candidate Background:
- Name: ${profile.firstName} ${profile.lastName}
- Current Role: ${profile.currentTitle || "Not specified"}
- Experience: ${profile.yearsExperience || "Not specified"} years

Provide only the answer, no preamble or explanation:`;
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
      const result2 = await session.prompt(prompt);
      console.log("Raw AI Response:", result2);
      let cleanedResult = result2.trim();
      session.destroy();
      return cleanedResult;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9zcmMvZW50cnlwb2ludHMvY29udGVudC50cyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiaW1wb3J0IHR5cGUgIFVzZXJQcm9maWxlICBmcm9tICdAL2xpYi90eXBlcy91c2VyJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFtcbiAgXSxcbiAgXG4gIGFzeW5jIG1haW4oKSB7XG4gICAgY29uc29sZS5sb2coJ0F1dG8tZmlsbCBzY3JpcHQgbG9hZGVkJyk7XG4gICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgICAgaWYgKG1lc3NhZ2UuYWN0aW9uID09PSBcInN0YXJ0LWF1dG8tZmlsbFwiKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiUmVjZWl2ZWQgYXV0by1maWxsIHJlcXVlc3RcIik7XG5cbiAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyB0eXBlOiBcIkdFVF9QUk9GSUxFXCIgfSwgKHJlc3BvbnNlKSA9PiB7XG4gICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJCYWNrZ3JvdW5kIGVycm9yOlwiLCBjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zb2xlLmxvZyhcIkdvdCBwcm9maWxlOlwiLCByZXNwb25zZSk7XG4gICAgICBoYW5kbGVBdXRvRmlsbENsaWNrKHJlc3BvbnNlLnByb2ZpbGUpXG4gICAgfSk7XG4gICAgfVxuICB9KTtcbiAgfVxufSk7XG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUF1dG9GaWxsQ2xpY2socHJvZmlsZTogYW55KSB7XG4gIHRyeSB7ICAgIFxuICAgIC8vIERvIHRoZSBhdXRvLWZpbGxcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhdXRvRmlsbEZvcm0ocHJvZmlsZSk7XG4gICAgXG4gICAgLy8gU2hvdyBzdWNjZXNzXG4gICAgc2hvd1N1Y2Nlc3NNZXNzYWdlKHJlc3VsdC5maWxsZWQsIHJlc3VsdC5haUFuc3dlcmVkKTtcbiAgICBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdBdXRvLWZpbGwgZXJyb3I6JywgZXJyb3IpO1xuICAgIGFsZXJ0KCdTb21ldGhpbmcgd2VudCB3cm9uZy4gUGxlYXNlIHRyeSBhZ2Fpbi4nKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzaG93U3VjY2Vzc01lc3NhZ2UoZmlsbGVkQ291bnQ6IG51bWJlciwgYWlDb3VudDogbnVtYmVyKSB7XG4gIGNvbnN0IG5vdGlmaWNhdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBub3RpZmljYXRpb24uc3R5bGUuY3NzVGV4dCA9IGBcbiAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgdG9wOiAyMHB4O1xuICAgIHJpZ2h0OiAyMHB4O1xuICAgIHotaW5kZXg6IDEwMDAxO1xuICAgIHBhZGRpbmc6IDE2cHggMjRweDtcbiAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgYm94LXNoYWRvdzogMCA0cHggMTJweCByZ2JhKDAsMCwwLDAuMTUpO1xuICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgYDtcbiAgXG4gIG5vdGlmaWNhdGlvbi5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTJweDtcIj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiZm9udC1zaXplOiAyNHB4O1wiPuKchTwvc3Bhbj5cbiAgICAgIDxkaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXdlaWdodDogNjAwOyBjb2xvcjogIzEwYjk4MTtcIj5BdXRvLWZpbGwgQ29tcGxldGUhPC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjogIzZiNzI4MDsgZm9udC1zaXplOiAxMnB4OyBtYXJnaW4tdG9wOiA0cHg7XCI+XG4gICAgICAgICAgRmlsbGVkICR7ZmlsbGVkQ291bnR9IGZpZWxkcyR7YWlDb3VudCA+IDAgPyBgICsgJHthaUNvdW50fSBBSSBhbnN3ZXJzYCA6ICcnfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICBgO1xuICBcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub3RpZmljYXRpb24pO1xuICBcbiAgc2V0VGltZW91dCgoKSA9PiBub3RpZmljYXRpb24ucmVtb3ZlKCksIDMwMDApO1xufVxuXG5pbnRlcmZhY2UgRmllbGRJbmZvIHtcbiAgZWxlbWVudDogSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBIVE1MU2VsZWN0RWxlbWVudDtcbiAgdHlwZTogc3RyaW5nIHwgbnVsbDtcbiAgbGFiZWw6IHN0cmluZztcbiAgcmVxdWlyZWQ6IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIGdldEFsbEZpZWxkcygpOiBGaWVsZEluZm9bXSB7XG4gIGNvbnN0IGZpZWxkczogRmllbGRJbmZvW10gPSBbXTtcbiAgXG4gIC8vIEdldCBhbGwgZmlsbGFibGUgZWxlbWVudHNcbiAgY29uc3QgaW5wdXRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MSW5wdXRFbGVtZW50PihcbiAgICAnaW5wdXQ6bm90KFt0eXBlPVwiaGlkZGVuXCJdKTpub3QoW3R5cGU9XCJzdWJtaXRcIl0pOm5vdChbdHlwZT1cImJ1dHRvblwiXSk6bm90KFt0eXBlPVwiaW1hZ2VcIl0pJ1xuICApO1xuICBjb25zdCB0ZXh0YXJlYXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxUZXh0QXJlYUVsZW1lbnQ+KCd0ZXh0YXJlYScpO1xuICBjb25zdCBzZWxlY3RzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MU2VsZWN0RWxlbWVudD4oJ3NlbGVjdCcpO1xuICBcbiAgWy4uLmlucHV0cywgLi4udGV4dGFyZWFzLCAuLi5zZWxlY3RzXS5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgIGNvbnN0IGxhYmVsID0gZ2V0RmllbGRMYWJlbChlbGVtZW50KTtcbiAgICBjb25zdCB0eXBlID0gZGV0ZWN0RmllbGRUeXBlKGVsZW1lbnQsIGxhYmVsKTtcbiAgICBjb25zdCByZXF1aXJlZCA9IGlzRmllbGRSZXF1aXJlZChlbGVtZW50LCBsYWJlbCk7XG4gICAgXG4gICAgZmllbGRzLnB1c2goe1xuICAgICAgZWxlbWVudCxcbiAgICAgIHR5cGUsXG4gICAgICBsYWJlbCxcbiAgICAgIHJlcXVpcmVkXG4gICAgfSk7XG4gIH0pO1xuXG4gIGNvbnNvbGUubG9nKGZpZWxkcyk7XG4gIFxuICByZXR1cm4gZmllbGRzO1xufVxuXG5mdW5jdGlvbiBnZXRGaWVsZExhYmVsKGZpZWxkOiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIC8vIE1ldGhvZCAxOiA8bGFiZWwgZm9yPVwiaWRcIj5cbiAgaWYgKGZpZWxkLmlkKSB7XG4gICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBsYWJlbFtmb3I9XCIke2ZpZWxkLmlkfVwiXWApO1xuICAgIGlmIChsYWJlbD8udGV4dENvbnRlbnQpIHJldHVybiBsYWJlbC50ZXh0Q29udGVudC50cmltKCk7XG4gIH1cbiAgXG4gIC8vIE1ldGhvZCAyOiBQYXJlbnQgPGxhYmVsPlxuICBjb25zdCBwYXJlbnRMYWJlbCA9IGZpZWxkLmNsb3Nlc3QoJ2xhYmVsJyk7XG4gIGlmIChwYXJlbnRMYWJlbD8udGV4dENvbnRlbnQpIHJldHVybiBwYXJlbnRMYWJlbC50ZXh0Q29udGVudC50cmltKCk7XG4gIFxuICAvLyBNZXRob2QgMzogUHJldmlvdXMgc2libGluZ1xuICBsZXQgcHJldiA9IGZpZWxkLnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XG4gIHdoaWxlIChwcmV2KSB7XG4gICAgaWYgKHByZXYudGFnTmFtZSA9PT0gJ0xBQkVMJyAmJiBwcmV2LnRleHRDb250ZW50KSB7XG4gICAgICByZXR1cm4gcHJldi50ZXh0Q29udGVudC50cmltKCk7XG4gICAgfVxuICAgIHByZXYgPSBwcmV2LnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XG4gIH1cbiAgXG4gIC8vIE1ldGhvZCA0OiBMb29rIGluIHBhcmVudCBjb250YWluZXJcbiAgY29uc3QgcGFyZW50ID0gZmllbGQuY2xvc2VzdCgnZGl2LCBmaWVsZHNldCwgbGknKTtcbiAgaWYgKHBhcmVudCkge1xuICAgIGNvbnN0IGxhYmVsRWwgPSBwYXJlbnQucXVlcnlTZWxlY3RvcignbGFiZWwsIGxlZ2VuZCcpO1xuICAgIGlmIChsYWJlbEVsPy50ZXh0Q29udGVudCkgcmV0dXJuIGxhYmVsRWwudGV4dENvbnRlbnQudHJpbSgpO1xuICB9XG4gIFxuICAvLyBNZXRob2QgNTogYXJpYS1sYWJlbFxuICBjb25zdCBhcmlhTGFiZWwgPSBmaWVsZC5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKTtcbiAgaWYgKGFyaWFMYWJlbCkgcmV0dXJuIGFyaWFMYWJlbDtcbiAgXG4gIC8vIE1ldGhvZCA2OiBwbGFjZWhvbGRlciBhcyBsYXN0IHJlc29ydFxuICBpZiAoJ3BsYWNlaG9sZGVyJyBpbiBmaWVsZCkge1xuICAgIGNvbnN0IGlucHV0RWxlbWVudCA9IGZpZWxkIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50O1xuICAgIGlmIChpbnB1dEVsZW1lbnQucGxhY2Vob2xkZXIpIHtcbiAgICAgIHJldHVybiBpbnB1dEVsZW1lbnQucGxhY2Vob2xkZXI7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4gJyc7XG59XG5cbmZ1bmN0aW9uIGRldGVjdEZpZWxkVHlwZShcbiAgZmllbGQ6IEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50IHwgSFRNTFNlbGVjdEVsZW1lbnQsXG4gIGxhYmVsOiBzdHJpbmdcbik6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBzZWFyY2hUZXh0ID0gbGFiZWwudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgZmllbGROYW1lID0gZmllbGQubmFtZS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBmaWVsZElkID0gZmllbGQuaWQudG9Mb3dlckNhc2UoKTtcbiAgXG4gIC8vIENvbWJpbmUgYWxsIHNlYXJjaCBzb3VyY2VzXG4gIGNvbnN0IHNlYXJjaEluID0gYCR7c2VhcmNoVGV4dH0gJHtmaWVsZE5hbWV9ICR7ZmllbGRJZH1gO1xuICBcbiAgLy8gQ2hlY2sgZm9yIGVhY2ggZmllbGQgdHlwZVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2ZpcnN0IG5hbWUnLCAnZmlyc3RuYW1lJywgJ2dpdmVuIG5hbWUnLCAnZm5hbWUnXSkpIHtcbiAgICByZXR1cm4gJ2ZpcnN0TmFtZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydsYXN0IG5hbWUnLCAnbGFzdG5hbWUnLCAnc3VybmFtZScsICdmYW1pbHkgbmFtZScsICdsbmFtZSddKSkge1xuICAgIHJldHVybiAnbGFzdE5hbWUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnZnVsbCBuYW1lJywgJ3lvdXIgbmFtZSddKSAmJiAhc2VhcmNoSW4uaW5jbHVkZXMoJ2ZpcnN0JykgJiYgIXNlYXJjaEluLmluY2x1ZGVzKCdsYXN0JykpIHtcbiAgICByZXR1cm4gJ2Z1bGxOYW1lJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2VtYWlsJywgJ2UtbWFpbCddKSkge1xuICAgIHJldHVybiAnZW1haWwnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsncGhvbmUnLCAndGVsZXBob25lJywgJ21vYmlsZScsICdjZWxsJ10pKSB7XG4gICAgcmV0dXJuICdwaG9uZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydsaW5rZWRpbicsICdsaW5rZWRpbiBwcm9maWxlJ10pKSB7XG4gICAgcmV0dXJuICdsaW5rZWRpbic7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydwb3J0Zm9saW8nLCAnd2Vic2l0ZScsICdwZXJzb25hbCBzaXRlJywgJ2dpdGh1YiddKSkge1xuICAgIHJldHVybiAncG9ydGZvbGlvJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2N1cnJlbnQgY29tcGFueScsICdlbXBsb3llciddKSkge1xuICAgIHJldHVybiAnY3VycmVudENvbXBhbnknO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnY3VycmVudCB0aXRsZScsICdqb2IgdGl0bGUnLCAnY3VycmVudCByb2xlJywgJ3Bvc2l0aW9uJ10pKSB7XG4gICAgcmV0dXJuICdjdXJyZW50VGl0bGUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsneWVhcnMgb2YgZXhwZXJpZW5jZScsICdleHBlcmllbmNlJywgJ3llYXJzIGV4cGVyaWVuY2UnXSkpIHtcbiAgICByZXR1cm4gJ2V4cGVyaWVuY2UnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnYWRkcmVzcycsICdzdHJlZXQnXSkpIHtcbiAgICByZXR1cm4gJ2FkZHJlc3MnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnY2l0eScsICd0b3duJ10pKSB7XG4gICAgcmV0dXJuICdjaXR5JztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3N0YXRlJywgJ3Byb3ZpbmNlJ10pKSB7XG4gICAgcmV0dXJuICdzdGF0ZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWyd6aXAnLCAncG9zdGFsIGNvZGUnLCAncG9zdGNvZGUnXSkpIHtcbiAgICByZXR1cm4gJ3ppcCc7XG4gIH1cbiAgXG4gIC8vIENoZWNrYm94ZXNcbiAgaWYgKCd0eXBlJyBpbiBmaWVsZCAmJiAoZmllbGQudHlwZSA9PT0gJ2NoZWNrYm94JyB8fCBmaWVsZC50eXBlID09PSAncmFkaW8nKSkge1xuICAgIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnc3BvbnNvcicsICd2aXNhJywgJ2F1dGhvcml6ZWQgdG8gd29yaycsICd3b3JrIGF1dGhvcml6YXRpb24nXSkpIHtcbiAgICAgIHJldHVybiAnc3BvbnNvcnNoaXAnO1xuICAgIH1cbiAgICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3JlbG9jYXRlJywgJ3JlbG9jYXRpb24nLCAnd2lsbGluZyB0byBtb3ZlJ10pKSB7XG4gICAgICByZXR1cm4gJ3JlbG9jYXRpb24nO1xuICAgIH1cbiAgICByZXR1cm4gJ2NoZWNrYm94LXVua25vd24nO1xuICB9XG4gIFxuICAvLyBDdXN0b20gcXVlc3Rpb25zICh0ZXh0YXJlYXMgd2l0aCBxdWVzdGlvbi1saWtlIGxhYmVscylcbiAgaWYgKGZpZWxkLnRhZ05hbWUgPT09ICdURVhUQVJFQScgfHwgKCd0eXBlJyBpbiBmaWVsZCAmJiBmaWVsZC50eXBlID09PSAndGV4dCcpKSB7XG4gICAgaWYgKGxhYmVsLmxlbmd0aCA+IDMwIHx8IGxhYmVsLmluY2x1ZGVzKCc/JykgfHwgbGFiZWwuaW5jbHVkZXMoJ3doeScpIHx8IGxhYmVsLmluY2x1ZGVzKCdkZXNjcmliZScpKSB7XG4gICAgICByZXR1cm4gJ2N1c3RvbVF1ZXN0aW9uJztcbiAgICB9XG4gIH1cbiAgXG4gIHJldHVybiBudWxsOyAvLyBVbmtub3duIGZpZWxkIHR5cGVcbn1cblxuZnVuY3Rpb24gbWF0Y2hlc0tleXdvcmRzKHRleHQ6IHN0cmluZywga2V5d29yZHM6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG4gIHJldHVybiBrZXl3b3Jkcy5zb21lKGtleXdvcmQgPT4gdGV4dC5pbmNsdWRlcyhrZXl3b3JkKSk7XG59XG5cbmZ1bmN0aW9uIGlzRmllbGRSZXF1aXJlZChmaWVsZDogSFRNTEVsZW1lbnQsIGxhYmVsOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgaWYgKCdyZXF1aXJlZCcgaW4gZmllbGQgJiYgZmllbGQucmVxdWlyZWQpIHJldHVybiB0cnVlO1xuICBpZiAoZmllbGQuZ2V0QXR0cmlidXRlKCdhcmlhLXJlcXVpcmVkJykgPT09ICd0cnVlJykgcmV0dXJuIHRydWU7XG4gIGlmIChsYWJlbC5pbmNsdWRlcygnKicpKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGxhYmVsLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3JlcXVpcmVkJykpIHJldHVybiB0cnVlO1xuICByZXR1cm4gZmFsc2U7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGF1dG9GaWxsRm9ybShwcm9maWxlOiBVc2VyUHJvZmlsZSkge1xuICBjb25zdCBmaWVsZHMgPSBnZXRBbGxGaWVsZHMoKTtcbiAgXG4gIGxldCBmaWxsZWRDb3VudCA9IDA7XG4gIGxldCBhaUFuc3dlcmVkQ291bnQgPSAwO1xuICBjb25zdCBjdXN0b21RdWVzdGlvbnM6IEZpZWxkSW5mb1tdID0gW107XG4gIFxuICAvLyBGaXJzdCBwYXNzOiBmaWxsIGFsbCBzdGFuZGFyZCBmaWVsZHNcbiAgZm9yIChjb25zdCBmaWVsZEluZm8gb2YgZmllbGRzKSB7XG4gICAgaWYgKCFmaWVsZEluZm8udHlwZSkgY29udGludWU7XG4gICAgXG4gICAgLy8gQ29sbGVjdCBjdXN0b20gcXVlc3Rpb25zIGZvciBBSSBsYXRlclxuICAgIGlmIChmaWVsZEluZm8udHlwZSA9PT0gJ2N1c3RvbVF1ZXN0aW9uJykge1xuICAgICAgY3VzdG9tUXVlc3Rpb25zLnB1c2goZmllbGRJbmZvKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBcbiAgICAvLyBGaWxsIHN0YW5kYXJkIGZpZWxkc1xuICAgIGNvbnN0IHN1Y2Nlc3MgPSBmaWxsRmllbGQoZmllbGRJbmZvLCBwcm9maWxlKTtcbiAgICBpZiAoc3VjY2VzcykgZmlsbGVkQ291bnQrKztcbiAgfVxuICBcbiAgLy8gU2Vjb25kIHBhc3M6IHVzZSBBSSBmb3IgY3VzdG9tIHF1ZXN0aW9uc1xuICBpZiAoY3VzdG9tUXVlc3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBqb2JDb250ZXh0ID0gZXh0cmFjdEpvYkNvbnRleHQoKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGZpZWxkSW5mbyBvZiBjdXN0b21RdWVzdGlvbnMpIHtcbiAgICAgIGNvbnN0IGFuc3dlciA9IGF3YWl0IGFuc3dlckN1c3RvbVF1ZXN0aW9uKGZpZWxkSW5mby5sYWJlbCwgcHJvZmlsZSwgam9iQ29udGV4dCk7XG4gICAgICBpZiAoYW5zd2VyKSB7XG4gICAgICAgIGZpbGxUZXh0RmllbGQoZmllbGRJbmZvLmVsZW1lbnQgYXMgSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQsIGFuc3dlcik7XG4gICAgICAgIGFpQW5zd2VyZWRDb3VudCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHtcbiAgICBmaWxsZWQ6IGZpbGxlZENvdW50LFxuICAgIGFpQW5zd2VyZWQ6IGFpQW5zd2VyZWRDb3VudFxuICB9O1xufVxuXG5mdW5jdGlvbiBmaWxsRmllbGQoZmllbGRJbmZvOiBGaWVsZEluZm8sIHByb2ZpbGU6IFVzZXJQcm9maWxlKTogYm9vbGVhbiB7XG4gIGNvbnN0IHsgZWxlbWVudCwgdHlwZSB9ID0gZmllbGRJbmZvO1xuICBcbiAgLy8gR2V0IHRoZSB2YWx1ZSB0byBmaWxsXG4gIGNvbnN0IHZhbHVlID0gZ2V0VmFsdWVGb3JGaWVsZFR5cGUodHlwZSwgcHJvZmlsZSk7XG4gIGlmICghdmFsdWUpIHJldHVybiBmYWxzZTtcbiAgXG4gIC8vIEZpbGwgYmFzZWQgb24gZWxlbWVudCB0eXBlXG4gIGlmIChlbGVtZW50LnRhZ05hbWUgPT09ICdTRUxFQ1QnKSB7XG4gICAgcmV0dXJuIGZpbGxTZWxlY3QoZWxlbWVudCBhcyBIVE1MU2VsZWN0RWxlbWVudCwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKCd0eXBlJyBpbiBlbGVtZW50ICYmIGVsZW1lbnQudHlwZSA9PT0gJ2NoZWNrYm94Jykge1xuICAgIHJldHVybiBmaWxsQ2hlY2tib3goZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoJ3R5cGUnIGluIGVsZW1lbnQgJiYgZWxlbWVudC50eXBlID09PSAncmFkaW8nKSB7XG4gICAgcmV0dXJuIGZpbGxSYWRpbyhlbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQsIHZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmlsbFRleHRGaWVsZChlbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50LCB2YWx1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VmFsdWVGb3JGaWVsZFR5cGUodHlwZTogc3RyaW5nIHwgbnVsbCwgcHJvZmlsZTogVXNlclByb2ZpbGUpOiBhbnkge1xuICBpZiAoIXR5cGUpIHJldHVybiBudWxsO1xuICBcbiAgY29uc3QgdmFsdWVNYXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gICAgZmlyc3ROYW1lOiBwcm9maWxlLmZpcnN0TmFtZSxcbiAgICBsYXN0TmFtZTogcHJvZmlsZS5sYXN0TmFtZSxcbiAgICBmdWxsTmFtZTogYCR7cHJvZmlsZS5maXJzdE5hbWV9ICR7cHJvZmlsZS5sYXN0TmFtZX1gLFxuICAgIGVtYWlsOiBwcm9maWxlLmVtYWlsLFxuICAgIHBob25lOiBwcm9maWxlLnBob25lLFxuICAgIGxpbmtlZGluOiBwcm9maWxlLmxpbmtlZGluLFxuICAgIHBvcnRmb2xpbzogcHJvZmlsZS5wb3J0Zm9saW8sXG4gICAgYWRkcmVzczogcHJvZmlsZS5hZGRyZXNzLFxuICAgIGNpdHk6IHByb2ZpbGUuY2l0eSxcbiAgICBzdGF0ZTogcHJvZmlsZS5zdGF0ZSxcbiAgICB6aXA6IHByb2ZpbGUuemlwLFxuICAgIGN1cnJlbnRDb21wYW55OiBwcm9maWxlLmN1cnJlbnRDb21wYW55LFxuICAgIGN1cnJlbnRUaXRsZTogcHJvZmlsZS5jdXJyZW50VGl0bGUsXG4gICAgZXhwZXJpZW5jZTogcHJvZmlsZS55ZWFyc0V4cGVyaWVuY2UsXG4gICAgc3BvbnNvcnNoaXA6IHByb2ZpbGUubmVlZHNTcG9uc29yc2hpcCA/ICd5ZXMnIDogJ25vJyxcbiAgICByZWxvY2F0aW9uOiBwcm9maWxlLndpbGxpbmdUb1JlbG9jYXRlID8gJ3llcycgOiAnbm8nLFxuICB9O1xuICBcbiAgcmV0dXJuIHZhbHVlTWFwW3R5cGVdO1xufVxuXG5mdW5jdGlvbiBmaWxsVGV4dEZpZWxkKFxuICBmaWVsZDogSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQsXG4gIHZhbHVlOiBzdHJpbmdcbik6IGJvb2xlYW4ge1xuICBmaWVsZC52YWx1ZSA9IHZhbHVlO1xuICB0cmlnZ2VySW5wdXRFdmVudHMoZmllbGQpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbFNlbGVjdChzZWxlY3Q6IEhUTUxTZWxlY3RFbGVtZW50LCB2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIGNvbnN0IG9wdGlvbnMgPSBBcnJheS5mcm9tKHNlbGVjdC5vcHRpb25zKTtcbiAgXG4gIC8vIFRyeSBleGFjdCBtYXRjaFxuICBsZXQgbWF0Y2ggPSBvcHRpb25zLmZpbmQob3B0ID0+IFxuICAgIG9wdC52YWx1ZSA9PT0gdmFsdWUgfHwgb3B0LnRleHQgPT09IHZhbHVlXG4gICk7XG4gIFxuICAvLyBUcnkgZnV6enkgbWF0Y2hcbiAgaWYgKCFtYXRjaCkge1xuICAgIGNvbnN0IHZhbHVlTG93ZXIgPSB2YWx1ZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCk7XG4gICAgbWF0Y2ggPSBvcHRpb25zLmZpbmQob3B0ID0+IFxuICAgICAgb3B0LnZhbHVlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModmFsdWVMb3dlcikgfHxcbiAgICAgIG9wdC50ZXh0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModmFsdWVMb3dlcilcbiAgICApO1xuICB9XG4gIFxuICAvLyBUcnkgbnVtZXJpYyBtYXRjaCAoZm9yIHllYXJzIG9mIGV4cGVyaWVuY2UpXG4gIGlmICghbWF0Y2ggJiYgIWlzTmFOKHZhbHVlKSkge1xuICAgIG1hdGNoID0gb3B0aW9ucy5maW5kKG9wdCA9PiBvcHQudmFsdWUgPT09IHZhbHVlLnRvU3RyaW5nKCkpO1xuICB9XG4gIFxuICBpZiAobWF0Y2gpIHtcbiAgICBzZWxlY3QudmFsdWUgPSBtYXRjaC52YWx1ZTtcbiAgICB0cmlnZ2VySW5wdXRFdmVudHMoc2VsZWN0KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBmaWxsQ2hlY2tib3goY2hlY2tib3g6IEhUTUxJbnB1dEVsZW1lbnQsIHZhbHVlOiBhbnkpOiBib29sZWFuIHtcbiAgY29uc3Qgc2hvdWxkQ2hlY2sgPSB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gJ3llcycgfHwgdmFsdWUgPT09ICd0cnVlJztcbiAgY2hlY2tib3guY2hlY2tlZCA9IHNob3VsZENoZWNrO1xuICB0cmlnZ2VySW5wdXRFdmVudHMoY2hlY2tib3gpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbFJhZGlvKHJhZGlvOiBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIGNvbnN0IHJhZGlvcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTElucHV0RWxlbWVudD4oYGlucHV0W25hbWU9XCIke3JhZGlvLm5hbWV9XCJdYCk7XG4gIGNvbnN0IHZhbHVlTG93ZXIgPSB2YWx1ZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCk7XG4gIFxuICBjb25zdCBtYXRjaCA9IEFycmF5LmZyb20ocmFkaW9zKS5maW5kKHIgPT4ge1xuICAgIGNvbnN0IGxhYmVsID0gZ2V0RmllbGRMYWJlbChyKS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiBsYWJlbC5pbmNsdWRlcyh2YWx1ZUxvd2VyKSB8fCByLnZhbHVlLnRvTG93ZXJDYXNlKCkgPT09IHZhbHVlTG93ZXI7XG4gIH0pO1xuICBcbiAgaWYgKG1hdGNoKSB7XG4gICAgbWF0Y2guY2hlY2tlZCA9IHRydWU7XG4gICAgdHJpZ2dlcklucHV0RXZlbnRzKG1hdGNoKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiB0cmlnZ2VySW5wdXRFdmVudHMoZWxlbWVudDogSFRNTEVsZW1lbnQpIHtcbiAgLy8gVHJpZ2dlciBtdWx0aXBsZSBldmVudHMgdG8gZW5zdXJlIHRoZSBzaXRlIHJlY29nbml6ZXMgdGhlIGNoYW5nZVxuICBjb25zdCBldmVudHMgPSBbXG4gICAgbmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSxcbiAgICBuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSxcbiAgICBuZXcgRXZlbnQoJ2JsdXInLCB7IGJ1YmJsZXM6IHRydWUgfSksXG4gIF07XG4gIFxuICBldmVudHMuZm9yRWFjaChldmVudCA9PiBlbGVtZW50LmRpc3BhdGNoRXZlbnQoZXZlbnQpKTtcbiAgXG4gIC8vIFNwZWNpYWwgaGFuZGxpbmcgZm9yIFJlYWN0XG4gIGlmICgndmFsdWUnIGluIGVsZW1lbnQpIHtcbiAgICBjb25zdCBuYXRpdmVJbnB1dFZhbHVlU2V0dGVyID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihcbiAgICAgIHdpbmRvdy5IVE1MSW5wdXRFbGVtZW50LnByb3RvdHlwZSxcbiAgICAgICd2YWx1ZSdcbiAgICApPy5zZXQ7XG4gICAgXG4gICAgaWYgKG5hdGl2ZUlucHV0VmFsdWVTZXR0ZXIpIHtcbiAgICAgIG5hdGl2ZUlucHV0VmFsdWVTZXR0ZXIuY2FsbChlbGVtZW50LCAoZWxlbWVudCBhcyBhbnkpLnZhbHVlKTtcbiAgICAgIGVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZXh0cmFjdEpvYkNvbnRleHQoKSB7XG4gIGNvbnN0IHRpdGxlID0gXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaDEnKT8udGV4dENvbnRlbnQgfHxcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbY2xhc3MqPVwiam9iLXRpdGxlXCJdJyk/LnRleHRDb250ZW50IHx8XG4gICAgJ3RoaXMgcG9zaXRpb24nO1xuICAgIFxuICBjb25zdCBjb21wYW55ID0gXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2NsYXNzKj1cImNvbXBhbnlcIl0nKT8udGV4dENvbnRlbnQgfHxcbiAgICAndGhpcyBjb21wYW55JztcblxuICByZXR1cm4ge1xuICAgIHRpdGxlOiB0aXRsZS50cmltKCksXG4gICAgY29tcGFueTogY29tcGFueS50cmltKClcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYW5zd2VyQ3VzdG9tUXVlc3Rpb24oXG4gIHF1ZXN0aW9uOiBzdHJpbmcsXG4gIHByb2ZpbGU6IFVzZXJQcm9maWxlLFxuICBqb2JDb250ZXh0OiB7IHRpdGxlOiBzdHJpbmc7IGNvbXBhbnk6IHN0cmluZyB9XG4pOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgY29uc3QgcHJvbXB0ID0gYFlvdSBhcmUgaGVscGluZyBzb21lb25lIGZpbGwgb3V0IGEgam9iIGFwcGxpY2F0aW9uLiBBbnN3ZXIgdGhpcyBxdWVzdGlvbiBwcm9mZXNzaW9uYWxseSBhbmQgY29uY2lzZWx5IChtYXggMTAwIHdvcmRzKTpcblxuUXVlc3Rpb246IFwiJHtxdWVzdGlvbn1cIlxuXG5Kb2I6ICR7am9iQ29udGV4dC50aXRsZX0gYXQgJHtqb2JDb250ZXh0LmNvbXBhbnl9XG5cbkNhbmRpZGF0ZSBCYWNrZ3JvdW5kOlxuLSBOYW1lOiAke3Byb2ZpbGUuZmlyc3ROYW1lfSAke3Byb2ZpbGUubGFzdE5hbWV9XG4tIEN1cnJlbnQgUm9sZTogJHtwcm9maWxlLmN1cnJlbnRUaXRsZSB8fCAnTm90IHNwZWNpZmllZCd9XG4tIEV4cGVyaWVuY2U6ICR7cHJvZmlsZS55ZWFyc0V4cGVyaWVuY2UgfHwgJ05vdCBzcGVjaWZpZWQnfSB5ZWFyc1xuXG5Qcm92aWRlIG9ubHkgdGhlIGFuc3dlciwgbm8gcHJlYW1ibGUgb3IgZXhwbGFuYXRpb246YDtcblxuICB0cnkge1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBhdmFpbGFiaWxpdHkgPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmF2YWlsYWJpbGl0eSgpO1xuXG4gICAgaWYgKGF2YWlsYWJpbGl0eSA9PT0gJ25vJykge1xuICAgICAgY29uc29sZS53YXJuKFwiR2VtaW5pIE5hbm8gbm90IGF2YWlsYWJsZVwiKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdhZnRlci1kb3dubG9hZCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiVHJpZ2dlcmluZyBHZW1pbmkgTmFubyBkb3dubG9hZC4uLlwiKTtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IExhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzZXNzaW9uLnByb21wdChwcm9tcHQpO1xuICAgIGNvbnNvbGUubG9nKFwiUmF3IEFJIFJlc3BvbnNlOlwiLCByZXN1bHQpO1xuXG4gICAgICBsZXQgY2xlYW5lZFJlc3VsdCA9IHJlc3VsdC50cmltKCk7XG4gICAgXG4gICAgc2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgcmV0dXJuIGNsZWFuZWRSZXN1bHQ7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignQUkgYW5zd2VyaW5nIGZhaWxlZDonLCBlcnJvcik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2AgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJyZXN1bHQiLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJwcmludCIsImxvZ2dl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UUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLG1CQUFBLFVBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxpQkFBQSxhQUFBLGdCQUFBLFVBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSx1QkFBQSxjQUFBLGtCQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsV0FBQSxRQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsUUFBQSxNQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsU0FBQSxVQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsT0FBQSxlQUFBLFVBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFJVCxRQUFBLFVBQUEsVUFBQSxNQUFBLFNBQUEsY0FBQSxNQUFBLFNBQUEsVUFBQTtBQUNFLFVBQUEsZ0JBQUEsVUFBQSxDQUFBLFdBQUEsUUFBQSxzQkFBQSxvQkFBQSxDQUFBLEdBQUE7QUFDRSxlQUFBO0FBQUEsTUFBTztBQUVULFVBQUEsZ0JBQUEsVUFBQSxDQUFBLFlBQUEsY0FBQSxpQkFBQSxDQUFBLEdBQUE7QUFDRSxlQUFBO0FBQUEsTUFBTztBQUVULGFBQUE7QUFBQSxJQUFPO0FBSVQsUUFBQSxNQUFBLFlBQUEsY0FBQSxVQUFBLFNBQUEsTUFBQSxTQUFBLFFBQUE7QUFDRSxVQUFBLE1BQUEsU0FBQSxNQUFBLE1BQUEsU0FBQSxHQUFBLEtBQUEsTUFBQSxTQUFBLEtBQUEsS0FBQSxNQUFBLFNBQUEsVUFBQSxHQUFBO0FBQ0UsZUFBQTtBQUFBLE1BQU87QUFB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
content;