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
            console.log("✅ Got profile:", response);
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
    } finally {
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
        console.warn("❌ Gemini Nano not available");
        return null;
      }
      if (availability === "after-download") {
        console.log("⏳ Triggering Gemini Nano download...");
        await LanguageModel.create();
        return null;
      }
      const session = await LanguageModel.create();
      const result2 = await session.prompt(prompt);
      console.log("🤖 Raw AI Response:", result2);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9zcmMvZW50cnlwb2ludHMvY29udGVudC50cyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiaW1wb3J0IHR5cGUgIFVzZXJQcm9maWxlICBmcm9tICdAL2xpYi90eXBlcy91c2VyJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFtcbiAgXSxcbiAgXG4gIGFzeW5jIG1haW4oKSB7XG4gICAgY29uc29sZS5sb2coJ0F1dG8tZmlsbCBzY3JpcHQgbG9hZGVkJyk7XG4gICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgICAgaWYgKG1lc3NhZ2UuYWN0aW9uID09PSBcInN0YXJ0LWF1dG8tZmlsbFwiKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiUmVjZWl2ZWQgYXV0by1maWxsIHJlcXVlc3RcIik7XG5cbiAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyB0eXBlOiBcIkdFVF9QUk9GSUxFXCIgfSwgKHJlc3BvbnNlKSA9PiB7XG4gICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJCYWNrZ3JvdW5kIGVycm9yOlwiLCBjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zb2xlLmxvZyhcIuKchSBHb3QgcHJvZmlsZTpcIiwgcmVzcG9uc2UpO1xuICAgICAgaGFuZGxlQXV0b0ZpbGxDbGljayhyZXNwb25zZS5wcm9maWxlKVxuICAgIH0pO1xuICAgIH1cbiAgfSk7XG4gIH1cbn0pO1xuXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVBdXRvRmlsbENsaWNrKHByb2ZpbGU6IGFueSkge1xuICAvLyBjb25zdCBidXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLWNvcGlsb3QtYXV0b2ZpbGwtYnRuJyk7XG4gIC8vIGlmICghYnV0dG9uKSByZXR1cm47XG4gIFxuICB0cnkge1xuICAgIC8vIFNob3cgbG9hZGluZyBzdGF0ZVxuICAgIC8vIGJ1dHRvbi50ZXh0Q29udGVudCA9ICfij7MgRmlsbGluZy4uLic7XG4gICAgLy8gYnV0dG9uLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG4gICAgXG4gICAgLy8gR2V0IHVzZXIgcHJvZmlsZVxuICAgIC8vIGxldCBwcm9maWxlO1xuICAgIC8vIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsgYWN0aW9uOiBcIkdFVF9QUk9GSUxFXCIgfSwgKHJlc3BvbnNlKSA9PiB7XG4gICAgLy8gICAgIHByb2ZpbGUgPSByZXNwb25zZT8ucHJvZmlsZTtcbiAgICAvLyB9KTsgICAgXG4gICAgLy8gaWYgKCFwcm9maWxlKSB7XG4gICAgLy8gICBhbGVydCgnUGxlYXNlIHNldCB1cCB5b3VyIHByb2ZpbGUgZmlyc3QgaW4gdGhlIGV4dGVuc2lvbiBwb3B1cCEnKTtcbiAgICAvLyAgIHJldHVybjtcbiAgICAvLyB9XG4gICAgXG4gICAgLy8gRG8gdGhlIGF1dG8tZmlsbFxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGF1dG9GaWxsRm9ybShwcm9maWxlKTtcbiAgICBcbiAgICAvLyBTaG93IHN1Y2Nlc3NcbiAgICBzaG93U3VjY2Vzc01lc3NhZ2UocmVzdWx0LmZpbGxlZCwgcmVzdWx0LmFpQW5zd2VyZWQpO1xuICAgIFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0F1dG8tZmlsbCBlcnJvcjonLCBlcnJvcik7XG4gICAgYWxlcnQoJ1NvbWV0aGluZyB3ZW50IHdyb25nLiBQbGVhc2UgdHJ5IGFnYWluLicpO1xuICB9IGZpbmFsbHkge1xuICAgIC8vIFJlc2V0IGJ1dHRvblxuICAgIC8vIGlmIChidXR0b24pIHtcbiAgICAvLyAgIGJ1dHRvbi50ZXh0Q29udGVudCA9ICfwn6SWIEF1dG8tZmlsbCBBcHBsaWNhdGlvbic7XG4gICAgLy8gICBidXR0b24uc3R5bGUucG9pbnRlckV2ZW50cyA9ICdhdXRvJztcbiAgICAvLyB9XG4gIH1cbn1cblxuZnVuY3Rpb24gc2hvd1N1Y2Nlc3NNZXNzYWdlKGZpbGxlZENvdW50OiBudW1iZXIsIGFpQ291bnQ6IG51bWJlcikge1xuICBjb25zdCBub3RpZmljYXRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgbm90aWZpY2F0aW9uLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgcG9zaXRpb246IGZpeGVkO1xuICAgIHRvcDogMjBweDtcbiAgICByaWdodDogMjBweDtcbiAgICB6LWluZGV4OiAxMDAwMTtcbiAgICBwYWRkaW5nOiAxNnB4IDI0cHg7XG4gICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgIGJveC1zaGFkb3c6IDAgNHB4IDEycHggcmdiYSgwLDAsMCwwLjE1KTtcbiAgICBmb250LXNpemU6IDE0cHg7XG4gIGA7XG4gIFxuICBub3RpZmljYXRpb24uaW5uZXJIVE1MID0gYFxuICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDEycHg7XCI+XG4gICAgICA8c3BhbiBzdHlsZT1cImZvbnQtc2l6ZTogMjRweDtcIj7inIU8L3NwYW4+XG4gICAgICA8ZGl2PlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udC13ZWlnaHQ6IDYwMDsgY29sb3I6ICMxMGI5ODE7XCI+QXV0by1maWxsIENvbXBsZXRlITwvZGl2PlxuICAgICAgICA8ZGl2IHN0eWxlPVwiY29sb3I6ICM2YjcyODA7IGZvbnQtc2l6ZTogMTJweDsgbWFyZ2luLXRvcDogNHB4O1wiPlxuICAgICAgICAgIEZpbGxlZCAke2ZpbGxlZENvdW50fSBmaWVsZHMke2FpQ291bnQgPiAwID8gYCArICR7YWlDb3VudH0gQUkgYW5zd2Vyc2AgOiAnJ31cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgYDtcbiAgXG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm90aWZpY2F0aW9uKTtcbiAgXG4gIHNldFRpbWVvdXQoKCkgPT4gbm90aWZpY2F0aW9uLnJlbW92ZSgpLCAzMDAwKTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEZJRUxEIERFVEVDVElPTlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuaW50ZXJmYWNlIEZpZWxkSW5mbyB7XG4gIGVsZW1lbnQ6IEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50IHwgSFRNTFNlbGVjdEVsZW1lbnQ7XG4gIHR5cGU6IHN0cmluZyB8IG51bGw7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHJlcXVpcmVkOiBib29sZWFuO1xufVxuXG5mdW5jdGlvbiBnZXRBbGxGaWVsZHMoKTogRmllbGRJbmZvW10ge1xuICBjb25zdCBmaWVsZHM6IEZpZWxkSW5mb1tdID0gW107XG4gIFxuICAvLyBHZXQgYWxsIGZpbGxhYmxlIGVsZW1lbnRzXG4gIGNvbnN0IGlucHV0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTElucHV0RWxlbWVudD4oXG4gICAgJ2lucHV0Om5vdChbdHlwZT1cImhpZGRlblwiXSk6bm90KFt0eXBlPVwic3VibWl0XCJdKTpub3QoW3R5cGU9XCJidXR0b25cIl0pOm5vdChbdHlwZT1cImltYWdlXCJdKSdcbiAgKTtcbiAgY29uc3QgdGV4dGFyZWFzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MVGV4dEFyZWFFbGVtZW50PigndGV4dGFyZWEnKTtcbiAgY29uc3Qgc2VsZWN0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTFNlbGVjdEVsZW1lbnQ+KCdzZWxlY3QnKTtcbiAgXG4gIFsuLi5pbnB1dHMsIC4uLnRleHRhcmVhcywgLi4uc2VsZWN0c10uZm9yRWFjaChlbGVtZW50ID0+IHtcbiAgICBjb25zdCBsYWJlbCA9IGdldEZpZWxkTGFiZWwoZWxlbWVudCk7XG4gICAgY29uc3QgdHlwZSA9IGRldGVjdEZpZWxkVHlwZShlbGVtZW50LCBsYWJlbCk7XG4gICAgY29uc3QgcmVxdWlyZWQgPSBpc0ZpZWxkUmVxdWlyZWQoZWxlbWVudCwgbGFiZWwpO1xuICAgIFxuICAgIGZpZWxkcy5wdXNoKHtcbiAgICAgIGVsZW1lbnQsXG4gICAgICB0eXBlLFxuICAgICAgbGFiZWwsXG4gICAgICByZXF1aXJlZFxuICAgIH0pO1xuICB9KTtcblxuICBjb25zb2xlLmxvZyhmaWVsZHMpO1xuICBcbiAgcmV0dXJuIGZpZWxkcztcbn1cblxuZnVuY3Rpb24gZ2V0RmllbGRMYWJlbChmaWVsZDogSFRNTEVsZW1lbnQpOiBzdHJpbmcge1xuICAvLyBNZXRob2QgMTogPGxhYmVsIGZvcj1cImlkXCI+XG4gIGlmIChmaWVsZC5pZCkge1xuICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgbGFiZWxbZm9yPVwiJHtmaWVsZC5pZH1cIl1gKTtcbiAgICBpZiAobGFiZWw/LnRleHRDb250ZW50KSByZXR1cm4gbGFiZWwudGV4dENvbnRlbnQudHJpbSgpO1xuICB9XG4gIFxuICAvLyBNZXRob2QgMjogUGFyZW50IDxsYWJlbD5cbiAgY29uc3QgcGFyZW50TGFiZWwgPSBmaWVsZC5jbG9zZXN0KCdsYWJlbCcpO1xuICBpZiAocGFyZW50TGFiZWw/LnRleHRDb250ZW50KSByZXR1cm4gcGFyZW50TGFiZWwudGV4dENvbnRlbnQudHJpbSgpO1xuICBcbiAgLy8gTWV0aG9kIDM6IFByZXZpb3VzIHNpYmxpbmdcbiAgbGV0IHByZXYgPSBmaWVsZC5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xuICB3aGlsZSAocHJldikge1xuICAgIGlmIChwcmV2LnRhZ05hbWUgPT09ICdMQUJFTCcgJiYgcHJldi50ZXh0Q29udGVudCkge1xuICAgICAgcmV0dXJuIHByZXYudGV4dENvbnRlbnQudHJpbSgpO1xuICAgIH1cbiAgICBwcmV2ID0gcHJldi5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xuICB9XG4gIFxuICAvLyBNZXRob2QgNDogTG9vayBpbiBwYXJlbnQgY29udGFpbmVyXG4gIGNvbnN0IHBhcmVudCA9IGZpZWxkLmNsb3Nlc3QoJ2RpdiwgZmllbGRzZXQsIGxpJyk7XG4gIGlmIChwYXJlbnQpIHtcbiAgICBjb25zdCBsYWJlbEVsID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJ2xhYmVsLCBsZWdlbmQnKTtcbiAgICBpZiAobGFiZWxFbD8udGV4dENvbnRlbnQpIHJldHVybiBsYWJlbEVsLnRleHRDb250ZW50LnRyaW0oKTtcbiAgfVxuICBcbiAgLy8gTWV0aG9kIDU6IGFyaWEtbGFiZWxcbiAgY29uc3QgYXJpYUxhYmVsID0gZmllbGQuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyk7XG4gIGlmIChhcmlhTGFiZWwpIHJldHVybiBhcmlhTGFiZWw7XG4gIFxuICAvLyBNZXRob2QgNjogcGxhY2Vob2xkZXIgYXMgbGFzdCByZXNvcnRcbiAgaWYgKCdwbGFjZWhvbGRlcicgaW4gZmllbGQpIHtcbiAgICBjb25zdCBpbnB1dEVsZW1lbnQgPSBmaWVsZCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudDtcbiAgICBpZiAoaW5wdXRFbGVtZW50LnBsYWNlaG9sZGVyKSB7XG4gICAgICByZXR1cm4gaW5wdXRFbGVtZW50LnBsYWNlaG9sZGVyO1xuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuICcnO1xufVxuXG5mdW5jdGlvbiBkZXRlY3RGaWVsZFR5cGUoXG4gIGZpZWxkOiBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCB8IEhUTUxTZWxlY3RFbGVtZW50LFxuICBsYWJlbDogc3RyaW5nXG4pOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3Qgc2VhcmNoVGV4dCA9IGxhYmVsLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGZpZWxkTmFtZSA9IGZpZWxkLm5hbWUudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgZmllbGRJZCA9IGZpZWxkLmlkLnRvTG93ZXJDYXNlKCk7XG4gIFxuICAvLyBDb21iaW5lIGFsbCBzZWFyY2ggc291cmNlc1xuICBjb25zdCBzZWFyY2hJbiA9IGAke3NlYXJjaFRleHR9ICR7ZmllbGROYW1lfSAke2ZpZWxkSWR9YDtcbiAgXG4gIC8vIENoZWNrIGZvciBlYWNoIGZpZWxkIHR5cGVcbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydmaXJzdCBuYW1lJywgJ2ZpcnN0bmFtZScsICdnaXZlbiBuYW1lJywgJ2ZuYW1lJ10pKSB7XG4gICAgcmV0dXJuICdmaXJzdE5hbWUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnbGFzdCBuYW1lJywgJ2xhc3RuYW1lJywgJ3N1cm5hbWUnLCAnZmFtaWx5IG5hbWUnLCAnbG5hbWUnXSkpIHtcbiAgICByZXR1cm4gJ2xhc3ROYW1lJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2Z1bGwgbmFtZScsICd5b3VyIG5hbWUnXSkgJiYgIXNlYXJjaEluLmluY2x1ZGVzKCdmaXJzdCcpICYmICFzZWFyY2hJbi5pbmNsdWRlcygnbGFzdCcpKSB7XG4gICAgcmV0dXJuICdmdWxsTmFtZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydlbWFpbCcsICdlLW1haWwnXSkpIHtcbiAgICByZXR1cm4gJ2VtYWlsJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3Bob25lJywgJ3RlbGVwaG9uZScsICdtb2JpbGUnLCAnY2VsbCddKSkge1xuICAgIHJldHVybiAncGhvbmUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnbGlua2VkaW4nLCAnbGlua2VkaW4gcHJvZmlsZSddKSkge1xuICAgIHJldHVybiAnbGlua2VkaW4nO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsncG9ydGZvbGlvJywgJ3dlYnNpdGUnLCAncGVyc29uYWwgc2l0ZScsICdnaXRodWInXSkpIHtcbiAgICByZXR1cm4gJ3BvcnRmb2xpbyc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydjdXJyZW50IGNvbXBhbnknLCAnZW1wbG95ZXInXSkpIHtcbiAgICByZXR1cm4gJ2N1cnJlbnRDb21wYW55JztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2N1cnJlbnQgdGl0bGUnLCAnam9iIHRpdGxlJywgJ2N1cnJlbnQgcm9sZScsICdwb3NpdGlvbiddKSkge1xuICAgIHJldHVybiAnY3VycmVudFRpdGxlJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3llYXJzIG9mIGV4cGVyaWVuY2UnLCAnZXhwZXJpZW5jZScsICd5ZWFycyBleHBlcmllbmNlJ10pKSB7XG4gICAgcmV0dXJuICdleHBlcmllbmNlJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2FkZHJlc3MnLCAnc3RyZWV0J10pKSB7XG4gICAgcmV0dXJuICdhZGRyZXNzJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2NpdHknLCAndG93biddKSkge1xuICAgIHJldHVybiAnY2l0eSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydzdGF0ZScsICdwcm92aW5jZSddKSkge1xuICAgIHJldHVybiAnc3RhdGUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnemlwJywgJ3Bvc3RhbCBjb2RlJywgJ3Bvc3Rjb2RlJ10pKSB7XG4gICAgcmV0dXJuICd6aXAnO1xuICB9XG4gIFxuICAvLyBDaGVja2JveGVzXG4gIGlmICgndHlwZScgaW4gZmllbGQgJiYgKGZpZWxkLnR5cGUgPT09ICdjaGVja2JveCcgfHwgZmllbGQudHlwZSA9PT0gJ3JhZGlvJykpIHtcbiAgICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3Nwb25zb3InLCAndmlzYScsICdhdXRob3JpemVkIHRvIHdvcmsnLCAnd29yayBhdXRob3JpemF0aW9uJ10pKSB7XG4gICAgICByZXR1cm4gJ3Nwb25zb3JzaGlwJztcbiAgICB9XG4gICAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydyZWxvY2F0ZScsICdyZWxvY2F0aW9uJywgJ3dpbGxpbmcgdG8gbW92ZSddKSkge1xuICAgICAgcmV0dXJuICdyZWxvY2F0aW9uJztcbiAgICB9XG4gICAgcmV0dXJuICdjaGVja2JveC11bmtub3duJztcbiAgfVxuICBcbiAgLy8gQ3VzdG9tIHF1ZXN0aW9ucyAodGV4dGFyZWFzIHdpdGggcXVlc3Rpb24tbGlrZSBsYWJlbHMpXG4gIGlmIChmaWVsZC50YWdOYW1lID09PSAnVEVYVEFSRUEnIHx8ICgndHlwZScgaW4gZmllbGQgJiYgZmllbGQudHlwZSA9PT0gJ3RleHQnKSkge1xuICAgIGlmIChsYWJlbC5sZW5ndGggPiAzMCB8fCBsYWJlbC5pbmNsdWRlcygnPycpIHx8IGxhYmVsLmluY2x1ZGVzKCd3aHknKSB8fCBsYWJlbC5pbmNsdWRlcygnZGVzY3JpYmUnKSkge1xuICAgICAgcmV0dXJuICdjdXN0b21RdWVzdGlvbic7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4gbnVsbDsgLy8gVW5rbm93biBmaWVsZCB0eXBlXG59XG5cbmZ1bmN0aW9uIG1hdGNoZXNLZXl3b3Jkcyh0ZXh0OiBzdHJpbmcsIGtleXdvcmRzOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuICByZXR1cm4ga2V5d29yZHMuc29tZShrZXl3b3JkID0+IHRleHQuaW5jbHVkZXMoa2V5d29yZCkpO1xufVxuXG5mdW5jdGlvbiBpc0ZpZWxkUmVxdWlyZWQoZmllbGQ6IEhUTUxFbGVtZW50LCBsYWJlbDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGlmICgncmVxdWlyZWQnIGluIGZpZWxkICYmIGZpZWxkLnJlcXVpcmVkKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGZpZWxkLmdldEF0dHJpYnV0ZSgnYXJpYS1yZXF1aXJlZCcpID09PSAndHJ1ZScpIHJldHVybiB0cnVlO1xuICBpZiAobGFiZWwuaW5jbHVkZXMoJyonKSkgcmV0dXJuIHRydWU7XG4gIGlmIChsYWJlbC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdyZXF1aXJlZCcpKSByZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRk9STSBGSUxMSU5HXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5hc3luYyBmdW5jdGlvbiBhdXRvRmlsbEZvcm0ocHJvZmlsZTogVXNlclByb2ZpbGUpIHtcbiAgY29uc3QgZmllbGRzID0gZ2V0QWxsRmllbGRzKCk7XG4gIFxuICBsZXQgZmlsbGVkQ291bnQgPSAwO1xuICBsZXQgYWlBbnN3ZXJlZENvdW50ID0gMDtcbiAgY29uc3QgY3VzdG9tUXVlc3Rpb25zOiBGaWVsZEluZm9bXSA9IFtdO1xuICBcbiAgLy8gRmlyc3QgcGFzczogZmlsbCBhbGwgc3RhbmRhcmQgZmllbGRzXG4gIGZvciAoY29uc3QgZmllbGRJbmZvIG9mIGZpZWxkcykge1xuICAgIGlmICghZmllbGRJbmZvLnR5cGUpIGNvbnRpbnVlO1xuICAgIFxuICAgIC8vIENvbGxlY3QgY3VzdG9tIHF1ZXN0aW9ucyBmb3IgQUkgbGF0ZXJcbiAgICBpZiAoZmllbGRJbmZvLnR5cGUgPT09ICdjdXN0b21RdWVzdGlvbicpIHtcbiAgICAgIGN1c3RvbVF1ZXN0aW9ucy5wdXNoKGZpZWxkSW5mbyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgXG4gICAgLy8gRmlsbCBzdGFuZGFyZCBmaWVsZHNcbiAgICBjb25zdCBzdWNjZXNzID0gZmlsbEZpZWxkKGZpZWxkSW5mbywgcHJvZmlsZSk7XG4gICAgaWYgKHN1Y2Nlc3MpIGZpbGxlZENvdW50Kys7XG4gIH1cbiAgXG4gIC8vIFNlY29uZCBwYXNzOiB1c2UgQUkgZm9yIGN1c3RvbSBxdWVzdGlvbnNcbiAgaWYgKGN1c3RvbVF1ZXN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3Qgam9iQ29udGV4dCA9IGV4dHJhY3RKb2JDb250ZXh0KCk7XG4gICAgXG4gICAgZm9yIChjb25zdCBmaWVsZEluZm8gb2YgY3VzdG9tUXVlc3Rpb25zKSB7XG4gICAgICBjb25zdCBhbnN3ZXIgPSBhd2FpdCBhbnN3ZXJDdXN0b21RdWVzdGlvbihmaWVsZEluZm8ubGFiZWwsIHByb2ZpbGUsIGpvYkNvbnRleHQpO1xuICAgICAgaWYgKGFuc3dlcikge1xuICAgICAgICBmaWxsVGV4dEZpZWxkKGZpZWxkSW5mby5lbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50LCBhbnN3ZXIpO1xuICAgICAgICBhaUFuc3dlcmVkQ291bnQrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIHJldHVybiB7XG4gICAgZmlsbGVkOiBmaWxsZWRDb3VudCxcbiAgICBhaUFuc3dlcmVkOiBhaUFuc3dlcmVkQ291bnRcbiAgfTtcbn1cblxuZnVuY3Rpb24gZmlsbEZpZWxkKGZpZWxkSW5mbzogRmllbGRJbmZvLCBwcm9maWxlOiBVc2VyUHJvZmlsZSk6IGJvb2xlYW4ge1xuICBjb25zdCB7IGVsZW1lbnQsIHR5cGUgfSA9IGZpZWxkSW5mbztcbiAgXG4gIC8vIEdldCB0aGUgdmFsdWUgdG8gZmlsbFxuICBjb25zdCB2YWx1ZSA9IGdldFZhbHVlRm9yRmllbGRUeXBlKHR5cGUsIHByb2ZpbGUpO1xuICBpZiAoIXZhbHVlKSByZXR1cm4gZmFsc2U7XG4gIFxuICAvLyBGaWxsIGJhc2VkIG9uIGVsZW1lbnQgdHlwZVxuICBpZiAoZWxlbWVudC50YWdOYW1lID09PSAnU0VMRUNUJykge1xuICAgIHJldHVybiBmaWxsU2VsZWN0KGVsZW1lbnQgYXMgSFRNTFNlbGVjdEVsZW1lbnQsIHZhbHVlKTtcbiAgfSBlbHNlIGlmICgndHlwZScgaW4gZWxlbWVudCAmJiBlbGVtZW50LnR5cGUgPT09ICdjaGVja2JveCcpIHtcbiAgICByZXR1cm4gZmlsbENoZWNrYm94KGVsZW1lbnQgYXMgSFRNTElucHV0RWxlbWVudCwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKCd0eXBlJyBpbiBlbGVtZW50ICYmIGVsZW1lbnQudHlwZSA9PT0gJ3JhZGlvJykge1xuICAgIHJldHVybiBmaWxsUmFkaW8oZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZpbGxUZXh0RmllbGQoZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCwgdmFsdWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFZhbHVlRm9yRmllbGRUeXBlKHR5cGU6IHN0cmluZyB8IG51bGwsIHByb2ZpbGU6IFVzZXJQcm9maWxlKTogYW55IHtcbiAgaWYgKCF0eXBlKSByZXR1cm4gbnVsbDtcbiAgXG4gIGNvbnN0IHZhbHVlTWFwOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge1xuICAgIGZpcnN0TmFtZTogcHJvZmlsZS5maXJzdE5hbWUsXG4gICAgbGFzdE5hbWU6IHByb2ZpbGUubGFzdE5hbWUsXG4gICAgZnVsbE5hbWU6IGAke3Byb2ZpbGUuZmlyc3ROYW1lfSAke3Byb2ZpbGUubGFzdE5hbWV9YCxcbiAgICBlbWFpbDogcHJvZmlsZS5lbWFpbCxcbiAgICBwaG9uZTogcHJvZmlsZS5waG9uZSxcbiAgICBsaW5rZWRpbjogcHJvZmlsZS5saW5rZWRpbixcbiAgICBwb3J0Zm9saW86IHByb2ZpbGUucG9ydGZvbGlvLFxuICAgIGFkZHJlc3M6IHByb2ZpbGUuYWRkcmVzcyxcbiAgICBjaXR5OiBwcm9maWxlLmNpdHksXG4gICAgc3RhdGU6IHByb2ZpbGUuc3RhdGUsXG4gICAgemlwOiBwcm9maWxlLnppcCxcbiAgICBjdXJyZW50Q29tcGFueTogcHJvZmlsZS5jdXJyZW50Q29tcGFueSxcbiAgICBjdXJyZW50VGl0bGU6IHByb2ZpbGUuY3VycmVudFRpdGxlLFxuICAgIGV4cGVyaWVuY2U6IHByb2ZpbGUueWVhcnNFeHBlcmllbmNlLFxuICAgIHNwb25zb3JzaGlwOiBwcm9maWxlLm5lZWRzU3BvbnNvcnNoaXAgPyAneWVzJyA6ICdubycsXG4gICAgcmVsb2NhdGlvbjogcHJvZmlsZS53aWxsaW5nVG9SZWxvY2F0ZSA/ICd5ZXMnIDogJ25vJyxcbiAgfTtcbiAgXG4gIHJldHVybiB2YWx1ZU1hcFt0eXBlXTtcbn1cblxuZnVuY3Rpb24gZmlsbFRleHRGaWVsZChcbiAgZmllbGQ6IEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50LFxuICB2YWx1ZTogc3RyaW5nXG4pOiBib29sZWFuIHtcbiAgZmllbGQudmFsdWUgPSB2YWx1ZTtcbiAgdHJpZ2dlcklucHV0RXZlbnRzKGZpZWxkKTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGZpbGxTZWxlY3Qoc2VsZWN0OiBIVE1MU2VsZWN0RWxlbWVudCwgdmFsdWU6IGFueSk6IGJvb2xlYW4ge1xuICBjb25zdCBvcHRpb25zID0gQXJyYXkuZnJvbShzZWxlY3Qub3B0aW9ucyk7XG4gIFxuICAvLyBUcnkgZXhhY3QgbWF0Y2hcbiAgbGV0IG1hdGNoID0gb3B0aW9ucy5maW5kKG9wdCA9PiBcbiAgICBvcHQudmFsdWUgPT09IHZhbHVlIHx8IG9wdC50ZXh0ID09PSB2YWx1ZVxuICApO1xuICBcbiAgLy8gVHJ5IGZ1enp5IG1hdGNoXG4gIGlmICghbWF0Y2gpIHtcbiAgICBjb25zdCB2YWx1ZUxvd2VyID0gdmFsdWUudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpO1xuICAgIG1hdGNoID0gb3B0aW9ucy5maW5kKG9wdCA9PiBcbiAgICAgIG9wdC52YWx1ZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHZhbHVlTG93ZXIpIHx8XG4gICAgICBvcHQudGV4dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHZhbHVlTG93ZXIpXG4gICAgKTtcbiAgfVxuICBcbiAgLy8gVHJ5IG51bWVyaWMgbWF0Y2ggKGZvciB5ZWFycyBvZiBleHBlcmllbmNlKVxuICBpZiAoIW1hdGNoICYmICFpc05hTih2YWx1ZSkpIHtcbiAgICBtYXRjaCA9IG9wdGlvbnMuZmluZChvcHQgPT4gb3B0LnZhbHVlID09PSB2YWx1ZS50b1N0cmluZygpKTtcbiAgfVxuICBcbiAgaWYgKG1hdGNoKSB7XG4gICAgc2VsZWN0LnZhbHVlID0gbWF0Y2gudmFsdWU7XG4gICAgdHJpZ2dlcklucHV0RXZlbnRzKHNlbGVjdCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZmlsbENoZWNrYm94KGNoZWNrYm94OiBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIGNvbnN0IHNob3VsZENoZWNrID0gdmFsdWUgPT09IHRydWUgfHwgdmFsdWUgPT09ICd5ZXMnIHx8IHZhbHVlID09PSAndHJ1ZSc7XG4gIGNoZWNrYm94LmNoZWNrZWQgPSBzaG91bGRDaGVjaztcbiAgdHJpZ2dlcklucHV0RXZlbnRzKGNoZWNrYm94KTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGZpbGxSYWRpbyhyYWRpbzogSFRNTElucHV0RWxlbWVudCwgdmFsdWU6IGFueSk6IGJvb2xlYW4ge1xuICBjb25zdCByYWRpb3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxJbnB1dEVsZW1lbnQ+KGBpbnB1dFtuYW1lPVwiJHtyYWRpby5uYW1lfVwiXWApO1xuICBjb25zdCB2YWx1ZUxvd2VyID0gdmFsdWUudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpO1xuICBcbiAgY29uc3QgbWF0Y2ggPSBBcnJheS5mcm9tKHJhZGlvcykuZmluZChyID0+IHtcbiAgICBjb25zdCBsYWJlbCA9IGdldEZpZWxkTGFiZWwocikudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gbGFiZWwuaW5jbHVkZXModmFsdWVMb3dlcikgfHwgci52YWx1ZS50b0xvd2VyQ2FzZSgpID09PSB2YWx1ZUxvd2VyO1xuICB9KTtcbiAgXG4gIGlmIChtYXRjaCkge1xuICAgIG1hdGNoLmNoZWNrZWQgPSB0cnVlO1xuICAgIHRyaWdnZXJJbnB1dEV2ZW50cyhtYXRjaCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gdHJpZ2dlcklucHV0RXZlbnRzKGVsZW1lbnQ6IEhUTUxFbGVtZW50KSB7XG4gIC8vIFRyaWdnZXIgbXVsdGlwbGUgZXZlbnRzIHRvIGVuc3VyZSB0aGUgc2l0ZSByZWNvZ25pemVzIHRoZSBjaGFuZ2VcbiAgY29uc3QgZXZlbnRzID0gW1xuICAgIG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSksXG4gICAgbmV3IEV2ZW50KCdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSksXG4gICAgbmV3IEV2ZW50KCdibHVyJywgeyBidWJibGVzOiB0cnVlIH0pLFxuICBdO1xuICBcbiAgZXZlbnRzLmZvckVhY2goZXZlbnQgPT4gZWxlbWVudC5kaXNwYXRjaEV2ZW50KGV2ZW50KSk7XG4gIFxuICAvLyBTcGVjaWFsIGhhbmRsaW5nIGZvciBSZWFjdFxuICBpZiAoJ3ZhbHVlJyBpbiBlbGVtZW50KSB7XG4gICAgY29uc3QgbmF0aXZlSW5wdXRWYWx1ZVNldHRlciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXG4gICAgICB3aW5kb3cuSFRNTElucHV0RWxlbWVudC5wcm90b3R5cGUsXG4gICAgICAndmFsdWUnXG4gICAgKT8uc2V0O1xuICAgIFxuICAgIGlmIChuYXRpdmVJbnB1dFZhbHVlU2V0dGVyKSB7XG4gICAgICBuYXRpdmVJbnB1dFZhbHVlU2V0dGVyLmNhbGwoZWxlbWVudCwgKGVsZW1lbnQgYXMgYW55KS52YWx1ZSk7XG4gICAgICBlbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG4gICAgfVxuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBBSSBJTlRFR1JBVElPTlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gZXh0cmFjdEpvYkNvbnRleHQoKSB7XG4gIGNvbnN0IHRpdGxlID0gXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaDEnKT8udGV4dENvbnRlbnQgfHxcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbY2xhc3MqPVwiam9iLXRpdGxlXCJdJyk/LnRleHRDb250ZW50IHx8XG4gICAgJ3RoaXMgcG9zaXRpb24nO1xuICAgIFxuICBjb25zdCBjb21wYW55ID0gXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2NsYXNzKj1cImNvbXBhbnlcIl0nKT8udGV4dENvbnRlbnQgfHxcbiAgICAndGhpcyBjb21wYW55JztcblxuICByZXR1cm4ge1xuICAgIHRpdGxlOiB0aXRsZS50cmltKCksXG4gICAgY29tcGFueTogY29tcGFueS50cmltKClcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYW5zd2VyQ3VzdG9tUXVlc3Rpb24oXG4gIHF1ZXN0aW9uOiBzdHJpbmcsXG4gIHByb2ZpbGU6IFVzZXJQcm9maWxlLFxuICBqb2JDb250ZXh0OiB7IHRpdGxlOiBzdHJpbmc7IGNvbXBhbnk6IHN0cmluZyB9XG4pOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgY29uc3QgcHJvbXB0ID0gYFlvdSBhcmUgaGVscGluZyBzb21lb25lIGZpbGwgb3V0IGEgam9iIGFwcGxpY2F0aW9uLiBBbnN3ZXIgdGhpcyBxdWVzdGlvbiBwcm9mZXNzaW9uYWxseSBhbmQgY29uY2lzZWx5IChtYXggMTAwIHdvcmRzKTpcblxuUXVlc3Rpb246IFwiJHtxdWVzdGlvbn1cIlxuXG5Kb2I6ICR7am9iQ29udGV4dC50aXRsZX0gYXQgJHtqb2JDb250ZXh0LmNvbXBhbnl9XG5cbkNhbmRpZGF0ZSBCYWNrZ3JvdW5kOlxuLSBOYW1lOiAke3Byb2ZpbGUuZmlyc3ROYW1lfSAke3Byb2ZpbGUubGFzdE5hbWV9XG4tIEN1cnJlbnQgUm9sZTogJHtwcm9maWxlLmN1cnJlbnRUaXRsZSB8fCAnTm90IHNwZWNpZmllZCd9XG4tIEV4cGVyaWVuY2U6ICR7cHJvZmlsZS55ZWFyc0V4cGVyaWVuY2UgfHwgJ05vdCBzcGVjaWZpZWQnfSB5ZWFyc1xuXG5Qcm92aWRlIG9ubHkgdGhlIGFuc3dlciwgbm8gcHJlYW1ibGUgb3IgZXhwbGFuYXRpb246YDtcblxuICB0cnkge1xuICAgIC8vIEB0cy1pZ25vcmUgLSBDaHJvbWUgQUkgQVBJXG4gICAgLy8gaWYgKCF3aW5kb3cuYWk/Lmxhbmd1YWdlTW9kZWwpIHtcbiAgICAvLyAgIGNvbnNvbGUud2FybignQ2hyb21lIEFJIG5vdCBhdmFpbGFibGUnKTtcbiAgICAvLyAgIHJldHVybiBudWxsO1xuICAgIC8vIH1cblxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBhdmFpbGFiaWxpdHkgPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmF2YWlsYWJpbGl0eSgpO1xuXG4gICAgaWYgKGF2YWlsYWJpbGl0eSA9PT0gJ25vJykge1xuICAgICAgY29uc29sZS53YXJuKFwi4p2MIEdlbWluaSBOYW5vIG5vdCBhdmFpbGFibGVcIik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnYWZ0ZXItZG93bmxvYWQnKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIuKPsyBUcmlnZ2VyaW5nIEdlbWluaSBOYW5vIGRvd25sb2FkLi4uXCIpO1xuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgYXdhaXQgTGFuZ3VhZ2VNb2RlbC5jcmVhdGUoKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgTGFuZ3VhZ2VNb2RlbC5jcmVhdGUoKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlc3Npb24ucHJvbXB0KHByb21wdCk7XG4gICAgY29uc29sZS5sb2coXCLwn6SWIFJhdyBBSSBSZXNwb25zZTpcIiwgcmVzdWx0KTtcblxuICAgICAgbGV0IGNsZWFuZWRSZXN1bHQgPSByZXN1bHQudHJpbSgpO1xuICAgIFxuICAgIC8vIC8vIFJlbW92ZSBgYGBqc29uIGFuZCBgYGAgaWYgcHJlc2VudFxuICAgIC8vIGlmIChjbGVhbmVkUmVzdWx0LnN0YXJ0c1dpdGgoJ2BgYGpzb24nKSkge1xuICAgIC8vICAgY2xlYW5lZFJlc3VsdCA9IGNsZWFuZWRSZXN1bHQucmVwbGFjZSgvXmBgYGpzb25cXHMqLywgJycpLnJlcGxhY2UoL1xccypgYGAkLywgJycpO1xuICAgIC8vIH0gZWxzZSBpZiAoY2xlYW5lZFJlc3VsdC5zdGFydHNXaXRoKCdgYGAnKSkge1xuICAgIC8vICAgY2xlYW5lZFJlc3VsdCA9IGNsZWFuZWRSZXN1bHQucmVwbGFjZSgvXmBgYFxccyovLCAnJykucmVwbGFjZSgvXFxzKmBgYCQvLCAnJyk7XG4gICAgLy8gfVxuICAgIFxuICAgIC8vIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UoY2xlYW5lZFJlc3VsdCk7XG4gICAgXG4gICAgc2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgcmV0dXJuIGNsZWFuZWRSZXN1bHQ7XG5cbiAgICBcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgLy8gY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHdpbmRvdy5haS5sYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuICAgIC8vIGNvbnN0IGFuc3dlciA9IGF3YWl0IHNlc3Npb24ucHJvbXB0KHByb21wdCk7XG4gICAgLy8gcmV0dXJuIGFuc3dlci50cmltKCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignQUkgYW5zd2VyaW5nIGZhaWxlZDonLCBlcnJvcik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2AgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJyZXN1bHQiLCJi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QUEsbUJBQUE7QUFDQSxRQUFBLFFBQUE7QUFDRSxZQUFBLFVBQUEsT0FBQSxjQUFBLGVBQUE7QUFDQSxVQUFBLFNBQUEsWUFBQSxRQUFBLFFBQUEsWUFBQSxLQUFBO0FBQUEsSUFBMEQ7QUFJNUQsVUFBQSxZQUFBLE1BQUEsYUFBQSxZQUFBO0FBQ0EsUUFBQSxVQUFBLFFBQUE7QUFHQSxRQUFBLGlCQUFBLE9BQUE7QUFDRSxZQUFBLGVBQUE7QUFDQSxVQUFBLGFBQUEsYUFBQTtBQUNFLGVBQUEsYUFBQTtBQUFBLE1BQW9CO0FBQUEsSUFDdEI7QUFHRixXQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsZ0JBQUEsT0FBQSxPQUFBO0FBSUUsVUFBQSxhQUFBLE1BQUEsWUFBQTtBQUNBLFVBQUEsWUFBQSxNQUFBLEtBQUEsWUFBQTtBQUNBLFVBQUEsVUFBQSxNQUFBLEdBQUEsWUFBQTtBQUdBLFVBQUEsV0FBQSxHQUFBLFVBQUEsSUFBQSxTQUFBLElBQUEsT0FBQTtBQUdBLFFBQUEsZ0JBQUEsVUFBQSxDQUFBLGNBQUEsYUFBQSxjQUFBLE9BQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxhQUFBLFlBQUEsV0FBQSxlQUFBLE9BQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxhQUFBLFdBQUEsQ0FBQSxLQUFBLENBQUEsU0FBQSxTQUFBLE9BQUEsS0FBQSxDQUFBLFNBQUEsU0FBQSxNQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFNBQUEsUUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFNBQUEsYUFBQSxVQUFBLE1BQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxZQUFBLGtCQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsYUFBQSxXQUFBLGlCQUFBLFFBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxtQkFBQSxVQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsaUJBQUEsYUFBQSxnQkFBQSxVQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsdUJBQUEsY0FBQSxrQkFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFdBQUEsUUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFFBQUEsTUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFNBQUEsVUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLE9BQUEsZUFBQSxVQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBSVQsUUFBQSxVQUFBLFVBQUEsTUFBQSxTQUFBLGNBQUEsTUFBQSxTQUFBLFVBQUE7QUFDRSxVQUFBLGdCQUFBLFVBQUEsQ0FBQSxXQUFBLFFBQUEsc0JBQUEsb0JBQUEsQ0FBQSxHQUFBO0FBQ0UsZUFBQTtBQUFBLE1BQU87QUFFVCxVQUFBLGdCQUFBLFVBQUEsQ0FBQSxZQUFBLGNBQUEsaUJBQUEsQ0FBQSxHQUFBO0FBQ0UsZUFBQTtBQUFBLE1BQU87QUFFVCxhQUFBO0FBQUEsSUFBTztBQUlULFFBQUEsTUFBQSxZQUFBLGNBQUEsVUFBQSxTQUFBLE1BQUEsU0FBQSxRQUFBO0FBQ0UsVUFBQSxNQUFBLFNBQUEsTUFBQSxNQUFBLFNBQUEsR0FBQSxLQUFBLE1BQUEsU0FBQSxLQUFB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
content;