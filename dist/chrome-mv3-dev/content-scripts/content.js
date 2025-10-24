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
              console.error("❌ Background error:", chrome.runtime.lastError);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9zcmMvZW50cnlwb2ludHMvY29udGVudC50cyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiaW1wb3J0IHR5cGUgIFVzZXJQcm9maWxlICBmcm9tICdAL2xpYi90eXBlcy91c2VyJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFtcbiAgXSxcbiAgXG4gIGFzeW5jIG1haW4oKSB7XG4gICAgY29uc29sZS5sb2coJ0F1dG8tZmlsbCBzY3JpcHQgbG9hZGVkJyk7XG5jaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UsIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gIGlmIChtZXNzYWdlLmFjdGlvbiA9PT0gXCJzdGFydC1hdXRvLWZpbGxcIikge1xuICAgIGNvbnNvbGUubG9nKFwiUmVjZWl2ZWQgYXV0by1maWxsIHJlcXVlc3RcIik7XG5cbiAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7IHR5cGU6IFwiR0VUX1BST0ZJTEVcIiB9LCAocmVzcG9uc2UpID0+IHtcbiAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCLinYwgQmFja2dyb3VuZCBlcnJvcjpcIiwgY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc29sZS5sb2coXCLinIUgR290IHByb2ZpbGU6XCIsIHJlc3BvbnNlKTtcbiAgaGFuZGxlQXV0b0ZpbGxDbGljayhyZXNwb25zZS5wcm9maWxlKVxufSk7XG4gICAgfVxuICB9KTtcbiAgfVxufSk7XG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUF1dG9GaWxsQ2xpY2socHJvZmlsZTogYW55KSB7XG4gIC8vIGNvbnN0IGJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2ItY29waWxvdC1hdXRvZmlsbC1idG4nKTtcbiAgLy8gaWYgKCFidXR0b24pIHJldHVybjtcbiAgXG4gIHRyeSB7XG4gICAgLy8gU2hvdyBsb2FkaW5nIHN0YXRlXG4gICAgLy8gYnV0dG9uLnRleHRDb250ZW50ID0gJ+KPsyBGaWxsaW5nLi4uJztcbiAgICAvLyBidXR0b24uc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgICBcbiAgICAvLyBHZXQgdXNlciBwcm9maWxlXG4gICAgLy8gbGV0IHByb2ZpbGU7XG4gICAgLy8gY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyBhY3Rpb246IFwiR0VUX1BST0ZJTEVcIiB9LCAocmVzcG9uc2UpID0+IHtcbiAgICAvLyAgICAgcHJvZmlsZSA9IHJlc3BvbnNlPy5wcm9maWxlO1xuICAgIC8vIH0pOyAgICBcbiAgICAvLyBpZiAoIXByb2ZpbGUpIHtcbiAgICAvLyAgIGFsZXJ0KCdQbGVhc2Ugc2V0IHVwIHlvdXIgcHJvZmlsZSBmaXJzdCBpbiB0aGUgZXh0ZW5zaW9uIHBvcHVwIScpO1xuICAgIC8vICAgcmV0dXJuO1xuICAgIC8vIH1cbiAgICBcbiAgICAvLyBEbyB0aGUgYXV0by1maWxsXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXV0b0ZpbGxGb3JtKHByb2ZpbGUpO1xuICAgIFxuICAgIC8vIFNob3cgc3VjY2Vzc1xuICAgIHNob3dTdWNjZXNzTWVzc2FnZShyZXN1bHQuZmlsbGVkLCByZXN1bHQuYWlBbnN3ZXJlZCk7XG4gICAgXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignQXV0by1maWxsIGVycm9yOicsIGVycm9yKTtcbiAgICBhbGVydCgnU29tZXRoaW5nIHdlbnQgd3JvbmcuIFBsZWFzZSB0cnkgYWdhaW4uJyk7XG4gIH0gZmluYWxseSB7XG4gICAgLy8gUmVzZXQgYnV0dG9uXG4gICAgLy8gaWYgKGJ1dHRvbikge1xuICAgIC8vICAgYnV0dG9uLnRleHRDb250ZW50ID0gJ/CfpJYgQXV0by1maWxsIEFwcGxpY2F0aW9uJztcbiAgICAvLyAgIGJ1dHRvbi5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ2F1dG8nO1xuICAgIC8vIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBzaG93U3VjY2Vzc01lc3NhZ2UoZmlsbGVkQ291bnQ6IG51bWJlciwgYWlDb3VudDogbnVtYmVyKSB7XG4gIGNvbnN0IG5vdGlmaWNhdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBub3RpZmljYXRpb24uc3R5bGUuY3NzVGV4dCA9IGBcbiAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgdG9wOiAyMHB4O1xuICAgIHJpZ2h0OiAyMHB4O1xuICAgIHotaW5kZXg6IDEwMDAxO1xuICAgIHBhZGRpbmc6IDE2cHggMjRweDtcbiAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgYm94LXNoYWRvdzogMCA0cHggMTJweCByZ2JhKDAsMCwwLDAuMTUpO1xuICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgYDtcbiAgXG4gIG5vdGlmaWNhdGlvbi5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTJweDtcIj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiZm9udC1zaXplOiAyNHB4O1wiPuKchTwvc3Bhbj5cbiAgICAgIDxkaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXdlaWdodDogNjAwOyBjb2xvcjogIzEwYjk4MTtcIj5BdXRvLWZpbGwgQ29tcGxldGUhPC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjogIzZiNzI4MDsgZm9udC1zaXplOiAxMnB4OyBtYXJnaW4tdG9wOiA0cHg7XCI+XG4gICAgICAgICAgRmlsbGVkICR7ZmlsbGVkQ291bnR9IGZpZWxkcyR7YWlDb3VudCA+IDAgPyBgICsgJHthaUNvdW50fSBBSSBhbnN3ZXJzYCA6ICcnfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICBgO1xuICBcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub3RpZmljYXRpb24pO1xuICBcbiAgc2V0VGltZW91dCgoKSA9PiBub3RpZmljYXRpb24ucmVtb3ZlKCksIDMwMDApO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRklFTEQgREVURUNUSU9OXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5pbnRlcmZhY2UgRmllbGRJbmZvIHtcbiAgZWxlbWVudDogSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBIVE1MU2VsZWN0RWxlbWVudDtcbiAgdHlwZTogc3RyaW5nIHwgbnVsbDtcbiAgbGFiZWw6IHN0cmluZztcbiAgcmVxdWlyZWQ6IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIGdldEFsbEZpZWxkcygpOiBGaWVsZEluZm9bXSB7XG4gIGNvbnN0IGZpZWxkczogRmllbGRJbmZvW10gPSBbXTtcbiAgXG4gIC8vIEdldCBhbGwgZmlsbGFibGUgZWxlbWVudHNcbiAgY29uc3QgaW5wdXRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MSW5wdXRFbGVtZW50PihcbiAgICAnaW5wdXQ6bm90KFt0eXBlPVwiaGlkZGVuXCJdKTpub3QoW3R5cGU9XCJzdWJtaXRcIl0pOm5vdChbdHlwZT1cImJ1dHRvblwiXSk6bm90KFt0eXBlPVwiaW1hZ2VcIl0pJ1xuICApO1xuICBjb25zdCB0ZXh0YXJlYXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxUZXh0QXJlYUVsZW1lbnQ+KCd0ZXh0YXJlYScpO1xuICBjb25zdCBzZWxlY3RzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MU2VsZWN0RWxlbWVudD4oJ3NlbGVjdCcpO1xuICBcbiAgWy4uLmlucHV0cywgLi4udGV4dGFyZWFzLCAuLi5zZWxlY3RzXS5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgIGNvbnN0IGxhYmVsID0gZ2V0RmllbGRMYWJlbChlbGVtZW50KTtcbiAgICBjb25zdCB0eXBlID0gZGV0ZWN0RmllbGRUeXBlKGVsZW1lbnQsIGxhYmVsKTtcbiAgICBjb25zdCByZXF1aXJlZCA9IGlzRmllbGRSZXF1aXJlZChlbGVtZW50LCBsYWJlbCk7XG4gICAgXG4gICAgZmllbGRzLnB1c2goe1xuICAgICAgZWxlbWVudCxcbiAgICAgIHR5cGUsXG4gICAgICBsYWJlbCxcbiAgICAgIHJlcXVpcmVkXG4gICAgfSk7XG4gIH0pO1xuICBcbiAgcmV0dXJuIGZpZWxkcztcbn1cblxuZnVuY3Rpb24gZ2V0RmllbGRMYWJlbChmaWVsZDogSFRNTEVsZW1lbnQpOiBzdHJpbmcge1xuICAvLyBNZXRob2QgMTogPGxhYmVsIGZvcj1cImlkXCI+XG4gIGlmIChmaWVsZC5pZCkge1xuICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgbGFiZWxbZm9yPVwiJHtmaWVsZC5pZH1cIl1gKTtcbiAgICBpZiAobGFiZWw/LnRleHRDb250ZW50KSByZXR1cm4gbGFiZWwudGV4dENvbnRlbnQudHJpbSgpO1xuICB9XG4gIFxuICAvLyBNZXRob2QgMjogUGFyZW50IDxsYWJlbD5cbiAgY29uc3QgcGFyZW50TGFiZWwgPSBmaWVsZC5jbG9zZXN0KCdsYWJlbCcpO1xuICBpZiAocGFyZW50TGFiZWw/LnRleHRDb250ZW50KSByZXR1cm4gcGFyZW50TGFiZWwudGV4dENvbnRlbnQudHJpbSgpO1xuICBcbiAgLy8gTWV0aG9kIDM6IFByZXZpb3VzIHNpYmxpbmdcbiAgbGV0IHByZXYgPSBmaWVsZC5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xuICB3aGlsZSAocHJldikge1xuICAgIGlmIChwcmV2LnRhZ05hbWUgPT09ICdMQUJFTCcgJiYgcHJldi50ZXh0Q29udGVudCkge1xuICAgICAgcmV0dXJuIHByZXYudGV4dENvbnRlbnQudHJpbSgpO1xuICAgIH1cbiAgICBwcmV2ID0gcHJldi5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xuICB9XG4gIFxuICAvLyBNZXRob2QgNDogTG9vayBpbiBwYXJlbnQgY29udGFpbmVyXG4gIGNvbnN0IHBhcmVudCA9IGZpZWxkLmNsb3Nlc3QoJ2RpdiwgZmllbGRzZXQsIGxpJyk7XG4gIGlmIChwYXJlbnQpIHtcbiAgICBjb25zdCBsYWJlbEVsID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJ2xhYmVsLCBsZWdlbmQnKTtcbiAgICBpZiAobGFiZWxFbD8udGV4dENvbnRlbnQpIHJldHVybiBsYWJlbEVsLnRleHRDb250ZW50LnRyaW0oKTtcbiAgfVxuICBcbiAgLy8gTWV0aG9kIDU6IGFyaWEtbGFiZWxcbiAgY29uc3QgYXJpYUxhYmVsID0gZmllbGQuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyk7XG4gIGlmIChhcmlhTGFiZWwpIHJldHVybiBhcmlhTGFiZWw7XG4gIFxuICAvLyBNZXRob2QgNjogcGxhY2Vob2xkZXIgYXMgbGFzdCByZXNvcnRcbiAgaWYgKCdwbGFjZWhvbGRlcicgaW4gZmllbGQpIHtcbiAgICBjb25zdCBpbnB1dEVsZW1lbnQgPSBmaWVsZCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudDtcbiAgICBpZiAoaW5wdXRFbGVtZW50LnBsYWNlaG9sZGVyKSB7XG4gICAgICByZXR1cm4gaW5wdXRFbGVtZW50LnBsYWNlaG9sZGVyO1xuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuICcnO1xufVxuXG5mdW5jdGlvbiBkZXRlY3RGaWVsZFR5cGUoXG4gIGZpZWxkOiBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCB8IEhUTUxTZWxlY3RFbGVtZW50LFxuICBsYWJlbDogc3RyaW5nXG4pOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3Qgc2VhcmNoVGV4dCA9IGxhYmVsLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGZpZWxkTmFtZSA9IGZpZWxkLm5hbWUudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgZmllbGRJZCA9IGZpZWxkLmlkLnRvTG93ZXJDYXNlKCk7XG4gIFxuICAvLyBDb21iaW5lIGFsbCBzZWFyY2ggc291cmNlc1xuICBjb25zdCBzZWFyY2hJbiA9IGAke3NlYXJjaFRleHR9ICR7ZmllbGROYW1lfSAke2ZpZWxkSWR9YDtcbiAgXG4gIC8vIENoZWNrIGZvciBlYWNoIGZpZWxkIHR5cGVcbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydmaXJzdCBuYW1lJywgJ2ZpcnN0bmFtZScsICdnaXZlbiBuYW1lJywgJ2ZuYW1lJ10pKSB7XG4gICAgcmV0dXJuICdmaXJzdE5hbWUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnbGFzdCBuYW1lJywgJ2xhc3RuYW1lJywgJ3N1cm5hbWUnLCAnZmFtaWx5IG5hbWUnLCAnbG5hbWUnXSkpIHtcbiAgICByZXR1cm4gJ2xhc3ROYW1lJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2Z1bGwgbmFtZScsICd5b3VyIG5hbWUnXSkgJiYgIXNlYXJjaEluLmluY2x1ZGVzKCdmaXJzdCcpICYmICFzZWFyY2hJbi5pbmNsdWRlcygnbGFzdCcpKSB7XG4gICAgcmV0dXJuICdmdWxsTmFtZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydlbWFpbCcsICdlLW1haWwnXSkpIHtcbiAgICByZXR1cm4gJ2VtYWlsJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3Bob25lJywgJ3RlbGVwaG9uZScsICdtb2JpbGUnLCAnY2VsbCddKSkge1xuICAgIHJldHVybiAncGhvbmUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnbGlua2VkaW4nLCAnbGlua2VkaW4gcHJvZmlsZSddKSkge1xuICAgIHJldHVybiAnbGlua2VkaW4nO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsncG9ydGZvbGlvJywgJ3dlYnNpdGUnLCAncGVyc29uYWwgc2l0ZScsICdnaXRodWInXSkpIHtcbiAgICByZXR1cm4gJ3BvcnRmb2xpbyc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydjdXJyZW50IGNvbXBhbnknLCAnZW1wbG95ZXInXSkpIHtcbiAgICByZXR1cm4gJ2N1cnJlbnRDb21wYW55JztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2N1cnJlbnQgdGl0bGUnLCAnam9iIHRpdGxlJywgJ2N1cnJlbnQgcm9sZScsICdwb3NpdGlvbiddKSkge1xuICAgIHJldHVybiAnY3VycmVudFRpdGxlJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3llYXJzIG9mIGV4cGVyaWVuY2UnLCAnZXhwZXJpZW5jZScsICd5ZWFycyBleHBlcmllbmNlJ10pKSB7XG4gICAgcmV0dXJuICdleHBlcmllbmNlJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2FkZHJlc3MnLCAnc3RyZWV0J10pKSB7XG4gICAgcmV0dXJuICdhZGRyZXNzJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2NpdHknLCAndG93biddKSkge1xuICAgIHJldHVybiAnY2l0eSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydzdGF0ZScsICdwcm92aW5jZSddKSkge1xuICAgIHJldHVybiAnc3RhdGUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnemlwJywgJ3Bvc3RhbCBjb2RlJywgJ3Bvc3Rjb2RlJ10pKSB7XG4gICAgcmV0dXJuICd6aXAnO1xuICB9XG4gIFxuICAvLyBDaGVja2JveGVzXG4gIGlmICgndHlwZScgaW4gZmllbGQgJiYgKGZpZWxkLnR5cGUgPT09ICdjaGVja2JveCcgfHwgZmllbGQudHlwZSA9PT0gJ3JhZGlvJykpIHtcbiAgICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3Nwb25zb3InLCAndmlzYScsICdhdXRob3JpemVkIHRvIHdvcmsnLCAnd29yayBhdXRob3JpemF0aW9uJ10pKSB7XG4gICAgICByZXR1cm4gJ3Nwb25zb3JzaGlwJztcbiAgICB9XG4gICAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydyZWxvY2F0ZScsICdyZWxvY2F0aW9uJywgJ3dpbGxpbmcgdG8gbW92ZSddKSkge1xuICAgICAgcmV0dXJuICdyZWxvY2F0aW9uJztcbiAgICB9XG4gICAgcmV0dXJuICdjaGVja2JveC11bmtub3duJztcbiAgfVxuICBcbiAgLy8gQ3VzdG9tIHF1ZXN0aW9ucyAodGV4dGFyZWFzIHdpdGggcXVlc3Rpb24tbGlrZSBsYWJlbHMpXG4gIGlmIChmaWVsZC50YWdOYW1lID09PSAnVEVYVEFSRUEnIHx8ICgndHlwZScgaW4gZmllbGQgJiYgZmllbGQudHlwZSA9PT0gJ3RleHQnKSkge1xuICAgIGlmIChsYWJlbC5sZW5ndGggPiAzMCB8fCBsYWJlbC5pbmNsdWRlcygnPycpIHx8IGxhYmVsLmluY2x1ZGVzKCd3aHknKSB8fCBsYWJlbC5pbmNsdWRlcygnZGVzY3JpYmUnKSkge1xuICAgICAgcmV0dXJuICdjdXN0b21RdWVzdGlvbic7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4gbnVsbDsgLy8gVW5rbm93biBmaWVsZCB0eXBlXG59XG5cbmZ1bmN0aW9uIG1hdGNoZXNLZXl3b3Jkcyh0ZXh0OiBzdHJpbmcsIGtleXdvcmRzOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuICByZXR1cm4ga2V5d29yZHMuc29tZShrZXl3b3JkID0+IHRleHQuaW5jbHVkZXMoa2V5d29yZCkpO1xufVxuXG5mdW5jdGlvbiBpc0ZpZWxkUmVxdWlyZWQoZmllbGQ6IEhUTUxFbGVtZW50LCBsYWJlbDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGlmICgncmVxdWlyZWQnIGluIGZpZWxkICYmIGZpZWxkLnJlcXVpcmVkKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGZpZWxkLmdldEF0dHJpYnV0ZSgnYXJpYS1yZXF1aXJlZCcpID09PSAndHJ1ZScpIHJldHVybiB0cnVlO1xuICBpZiAobGFiZWwuaW5jbHVkZXMoJyonKSkgcmV0dXJuIHRydWU7XG4gIGlmIChsYWJlbC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdyZXF1aXJlZCcpKSByZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRk9STSBGSUxMSU5HXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5hc3luYyBmdW5jdGlvbiBhdXRvRmlsbEZvcm0ocHJvZmlsZTogVXNlclByb2ZpbGUpIHtcbiAgY29uc3QgZmllbGRzID0gZ2V0QWxsRmllbGRzKCk7XG4gIFxuICBsZXQgZmlsbGVkQ291bnQgPSAwO1xuICBsZXQgYWlBbnN3ZXJlZENvdW50ID0gMDtcbiAgY29uc3QgY3VzdG9tUXVlc3Rpb25zOiBGaWVsZEluZm9bXSA9IFtdO1xuICBcbiAgLy8gRmlyc3QgcGFzczogZmlsbCBhbGwgc3RhbmRhcmQgZmllbGRzXG4gIGZvciAoY29uc3QgZmllbGRJbmZvIG9mIGZpZWxkcykge1xuICAgIGlmICghZmllbGRJbmZvLnR5cGUpIGNvbnRpbnVlO1xuICAgIFxuICAgIC8vIENvbGxlY3QgY3VzdG9tIHF1ZXN0aW9ucyBmb3IgQUkgbGF0ZXJcbiAgICBpZiAoZmllbGRJbmZvLnR5cGUgPT09ICdjdXN0b21RdWVzdGlvbicpIHtcbiAgICAgIGN1c3RvbVF1ZXN0aW9ucy5wdXNoKGZpZWxkSW5mbyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgXG4gICAgLy8gRmlsbCBzdGFuZGFyZCBmaWVsZHNcbiAgICBjb25zdCBzdWNjZXNzID0gZmlsbEZpZWxkKGZpZWxkSW5mbywgcHJvZmlsZSk7XG4gICAgaWYgKHN1Y2Nlc3MpIGZpbGxlZENvdW50Kys7XG4gIH1cbiAgXG4gIC8vIFNlY29uZCBwYXNzOiB1c2UgQUkgZm9yIGN1c3RvbSBxdWVzdGlvbnNcbiAgaWYgKGN1c3RvbVF1ZXN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3Qgam9iQ29udGV4dCA9IGV4dHJhY3RKb2JDb250ZXh0KCk7XG4gICAgXG4gICAgZm9yIChjb25zdCBmaWVsZEluZm8gb2YgY3VzdG9tUXVlc3Rpb25zKSB7XG4gICAgICBjb25zdCBhbnN3ZXIgPSBhd2FpdCBhbnN3ZXJDdXN0b21RdWVzdGlvbihmaWVsZEluZm8ubGFiZWwsIHByb2ZpbGUsIGpvYkNvbnRleHQpO1xuICAgICAgaWYgKGFuc3dlcikge1xuICAgICAgICBmaWxsVGV4dEZpZWxkKGZpZWxkSW5mby5lbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50LCBhbnN3ZXIpO1xuICAgICAgICBhaUFuc3dlcmVkQ291bnQrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIHJldHVybiB7XG4gICAgZmlsbGVkOiBmaWxsZWRDb3VudCxcbiAgICBhaUFuc3dlcmVkOiBhaUFuc3dlcmVkQ291bnRcbiAgfTtcbn1cblxuZnVuY3Rpb24gZmlsbEZpZWxkKGZpZWxkSW5mbzogRmllbGRJbmZvLCBwcm9maWxlOiBVc2VyUHJvZmlsZSk6IGJvb2xlYW4ge1xuICBjb25zdCB7IGVsZW1lbnQsIHR5cGUgfSA9IGZpZWxkSW5mbztcbiAgXG4gIC8vIEdldCB0aGUgdmFsdWUgdG8gZmlsbFxuICBjb25zdCB2YWx1ZSA9IGdldFZhbHVlRm9yRmllbGRUeXBlKHR5cGUsIHByb2ZpbGUpO1xuICBpZiAoIXZhbHVlKSByZXR1cm4gZmFsc2U7XG4gIFxuICAvLyBGaWxsIGJhc2VkIG9uIGVsZW1lbnQgdHlwZVxuICBpZiAoZWxlbWVudC50YWdOYW1lID09PSAnU0VMRUNUJykge1xuICAgIHJldHVybiBmaWxsU2VsZWN0KGVsZW1lbnQgYXMgSFRNTFNlbGVjdEVsZW1lbnQsIHZhbHVlKTtcbiAgfSBlbHNlIGlmICgndHlwZScgaW4gZWxlbWVudCAmJiBlbGVtZW50LnR5cGUgPT09ICdjaGVja2JveCcpIHtcbiAgICByZXR1cm4gZmlsbENoZWNrYm94KGVsZW1lbnQgYXMgSFRNTElucHV0RWxlbWVudCwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKCd0eXBlJyBpbiBlbGVtZW50ICYmIGVsZW1lbnQudHlwZSA9PT0gJ3JhZGlvJykge1xuICAgIHJldHVybiBmaWxsUmFkaW8oZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZpbGxUZXh0RmllbGQoZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCwgdmFsdWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFZhbHVlRm9yRmllbGRUeXBlKHR5cGU6IHN0cmluZyB8IG51bGwsIHByb2ZpbGU6IFVzZXJQcm9maWxlKTogYW55IHtcbiAgaWYgKCF0eXBlKSByZXR1cm4gbnVsbDtcbiAgXG4gIGNvbnN0IHZhbHVlTWFwOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge1xuICAgIGZpcnN0TmFtZTogcHJvZmlsZS5maXJzdE5hbWUsXG4gICAgbGFzdE5hbWU6IHByb2ZpbGUubGFzdE5hbWUsXG4gICAgZnVsbE5hbWU6IGAke3Byb2ZpbGUuZmlyc3ROYW1lfSAke3Byb2ZpbGUubGFzdE5hbWV9YCxcbiAgICBlbWFpbDogcHJvZmlsZS5lbWFpbCxcbiAgICBwaG9uZTogcHJvZmlsZS5waG9uZSxcbiAgICBsaW5rZWRpbjogcHJvZmlsZS5saW5rZWRpbixcbiAgICBwb3J0Zm9saW86IHByb2ZpbGUucG9ydGZvbGlvLFxuICAgIGFkZHJlc3M6IHByb2ZpbGUuYWRkcmVzcyxcbiAgICBjaXR5OiBwcm9maWxlLmNpdHksXG4gICAgc3RhdGU6IHByb2ZpbGUuc3RhdGUsXG4gICAgemlwOiBwcm9maWxlLnppcCxcbiAgICBjdXJyZW50Q29tcGFueTogcHJvZmlsZS5jdXJyZW50Q29tcGFueSxcbiAgICBjdXJyZW50VGl0bGU6IHByb2ZpbGUuY3VycmVudFRpdGxlLFxuICAgIGV4cGVyaWVuY2U6IHByb2ZpbGUueWVhcnNFeHBlcmllbmNlLFxuICAgIHNwb25zb3JzaGlwOiBwcm9maWxlLm5lZWRzU3BvbnNvcnNoaXAgPyAneWVzJyA6ICdubycsXG4gICAgcmVsb2NhdGlvbjogcHJvZmlsZS53aWxsaW5nVG9SZWxvY2F0ZSA/ICd5ZXMnIDogJ25vJyxcbiAgfTtcbiAgXG4gIHJldHVybiB2YWx1ZU1hcFt0eXBlXTtcbn1cblxuZnVuY3Rpb24gZmlsbFRleHRGaWVsZChcbiAgZmllbGQ6IEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50LFxuICB2YWx1ZTogc3RyaW5nXG4pOiBib29sZWFuIHtcbiAgZmllbGQudmFsdWUgPSB2YWx1ZTtcbiAgdHJpZ2dlcklucHV0RXZlbnRzKGZpZWxkKTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGZpbGxTZWxlY3Qoc2VsZWN0OiBIVE1MU2VsZWN0RWxlbWVudCwgdmFsdWU6IGFueSk6IGJvb2xlYW4ge1xuICBjb25zdCBvcHRpb25zID0gQXJyYXkuZnJvbShzZWxlY3Qub3B0aW9ucyk7XG4gIFxuICAvLyBUcnkgZXhhY3QgbWF0Y2hcbiAgbGV0IG1hdGNoID0gb3B0aW9ucy5maW5kKG9wdCA9PiBcbiAgICBvcHQudmFsdWUgPT09IHZhbHVlIHx8IG9wdC50ZXh0ID09PSB2YWx1ZVxuICApO1xuICBcbiAgLy8gVHJ5IGZ1enp5IG1hdGNoXG4gIGlmICghbWF0Y2gpIHtcbiAgICBjb25zdCB2YWx1ZUxvd2VyID0gdmFsdWUudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpO1xuICAgIG1hdGNoID0gb3B0aW9ucy5maW5kKG9wdCA9PiBcbiAgICAgIG9wdC52YWx1ZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHZhbHVlTG93ZXIpIHx8XG4gICAgICBvcHQudGV4dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHZhbHVlTG93ZXIpXG4gICAgKTtcbiAgfVxuICBcbiAgLy8gVHJ5IG51bWVyaWMgbWF0Y2ggKGZvciB5ZWFycyBvZiBleHBlcmllbmNlKVxuICBpZiAoIW1hdGNoICYmICFpc05hTih2YWx1ZSkpIHtcbiAgICBtYXRjaCA9IG9wdGlvbnMuZmluZChvcHQgPT4gb3B0LnZhbHVlID09PSB2YWx1ZS50b1N0cmluZygpKTtcbiAgfVxuICBcbiAgaWYgKG1hdGNoKSB7XG4gICAgc2VsZWN0LnZhbHVlID0gbWF0Y2gudmFsdWU7XG4gICAgdHJpZ2dlcklucHV0RXZlbnRzKHNlbGVjdCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZmlsbENoZWNrYm94KGNoZWNrYm94OiBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIGNvbnN0IHNob3VsZENoZWNrID0gdmFsdWUgPT09IHRydWUgfHwgdmFsdWUgPT09ICd5ZXMnIHx8IHZhbHVlID09PSAndHJ1ZSc7XG4gIGNoZWNrYm94LmNoZWNrZWQgPSBzaG91bGRDaGVjaztcbiAgdHJpZ2dlcklucHV0RXZlbnRzKGNoZWNrYm94KTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGZpbGxSYWRpbyhyYWRpbzogSFRNTElucHV0RWxlbWVudCwgdmFsdWU6IGFueSk6IGJvb2xlYW4ge1xuICBjb25zdCByYWRpb3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxJbnB1dEVsZW1lbnQ+KGBpbnB1dFtuYW1lPVwiJHtyYWRpby5uYW1lfVwiXWApO1xuICBjb25zdCB2YWx1ZUxvd2VyID0gdmFsdWUudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpO1xuICBcbiAgY29uc3QgbWF0Y2ggPSBBcnJheS5mcm9tKHJhZGlvcykuZmluZChyID0+IHtcbiAgICBjb25zdCBsYWJlbCA9IGdldEZpZWxkTGFiZWwocikudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gbGFiZWwuaW5jbHVkZXModmFsdWVMb3dlcikgfHwgci52YWx1ZS50b0xvd2VyQ2FzZSgpID09PSB2YWx1ZUxvd2VyO1xuICB9KTtcbiAgXG4gIGlmIChtYXRjaCkge1xuICAgIG1hdGNoLmNoZWNrZWQgPSB0cnVlO1xuICAgIHRyaWdnZXJJbnB1dEV2ZW50cyhtYXRjaCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gdHJpZ2dlcklucHV0RXZlbnRzKGVsZW1lbnQ6IEhUTUxFbGVtZW50KSB7XG4gIC8vIFRyaWdnZXIgbXVsdGlwbGUgZXZlbnRzIHRvIGVuc3VyZSB0aGUgc2l0ZSByZWNvZ25pemVzIHRoZSBjaGFuZ2VcbiAgY29uc3QgZXZlbnRzID0gW1xuICAgIG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSksXG4gICAgbmV3IEV2ZW50KCdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSksXG4gICAgbmV3IEV2ZW50KCdibHVyJywgeyBidWJibGVzOiB0cnVlIH0pLFxuICBdO1xuICBcbiAgZXZlbnRzLmZvckVhY2goZXZlbnQgPT4gZWxlbWVudC5kaXNwYXRjaEV2ZW50KGV2ZW50KSk7XG4gIFxuICAvLyBTcGVjaWFsIGhhbmRsaW5nIGZvciBSZWFjdFxuICBpZiAoJ3ZhbHVlJyBpbiBlbGVtZW50KSB7XG4gICAgY29uc3QgbmF0aXZlSW5wdXRWYWx1ZVNldHRlciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXG4gICAgICB3aW5kb3cuSFRNTElucHV0RWxlbWVudC5wcm90b3R5cGUsXG4gICAgICAndmFsdWUnXG4gICAgKT8uc2V0O1xuICAgIFxuICAgIGlmIChuYXRpdmVJbnB1dFZhbHVlU2V0dGVyKSB7XG4gICAgICBuYXRpdmVJbnB1dFZhbHVlU2V0dGVyLmNhbGwoZWxlbWVudCwgKGVsZW1lbnQgYXMgYW55KS52YWx1ZSk7XG4gICAgICBlbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG4gICAgfVxuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBBSSBJTlRFR1JBVElPTlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gZXh0cmFjdEpvYkNvbnRleHQoKSB7XG4gIGNvbnN0IHRpdGxlID0gXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaDEnKT8udGV4dENvbnRlbnQgfHxcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbY2xhc3MqPVwiam9iLXRpdGxlXCJdJyk/LnRleHRDb250ZW50IHx8XG4gICAgJ3RoaXMgcG9zaXRpb24nO1xuICAgIFxuICBjb25zdCBjb21wYW55ID0gXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2NsYXNzKj1cImNvbXBhbnlcIl0nKT8udGV4dENvbnRlbnQgfHxcbiAgICAndGhpcyBjb21wYW55JztcblxuICByZXR1cm4ge1xuICAgIHRpdGxlOiB0aXRsZS50cmltKCksXG4gICAgY29tcGFueTogY29tcGFueS50cmltKClcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYW5zd2VyQ3VzdG9tUXVlc3Rpb24oXG4gIHF1ZXN0aW9uOiBzdHJpbmcsXG4gIHByb2ZpbGU6IFVzZXJQcm9maWxlLFxuICBqb2JDb250ZXh0OiB7IHRpdGxlOiBzdHJpbmc7IGNvbXBhbnk6IHN0cmluZyB9XG4pOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgY29uc3QgcHJvbXB0ID0gYFlvdSBhcmUgaGVscGluZyBzb21lb25lIGZpbGwgb3V0IGEgam9iIGFwcGxpY2F0aW9uLiBBbnN3ZXIgdGhpcyBxdWVzdGlvbiBwcm9mZXNzaW9uYWxseSBhbmQgY29uY2lzZWx5IChtYXggMTAwIHdvcmRzKTpcblxuUXVlc3Rpb246IFwiJHtxdWVzdGlvbn1cIlxuXG5Kb2I6ICR7am9iQ29udGV4dC50aXRsZX0gYXQgJHtqb2JDb250ZXh0LmNvbXBhbnl9XG5cbkNhbmRpZGF0ZSBCYWNrZ3JvdW5kOlxuLSBOYW1lOiAke3Byb2ZpbGUuZmlyc3ROYW1lfSAke3Byb2ZpbGUubGFzdE5hbWV9XG4tIEN1cnJlbnQgUm9sZTogJHtwcm9maWxlLmN1cnJlbnRUaXRsZSB8fCAnTm90IHNwZWNpZmllZCd9XG4tIEV4cGVyaWVuY2U6ICR7cHJvZmlsZS55ZWFyc0V4cGVyaWVuY2UgfHwgJ05vdCBzcGVjaWZpZWQnfSB5ZWFyc1xuXG5Qcm92aWRlIG9ubHkgdGhlIGFuc3dlciwgbm8gcHJlYW1ibGUgb3IgZXhwbGFuYXRpb246YDtcblxuICB0cnkge1xuICAgIC8vIEB0cy1pZ25vcmUgLSBDaHJvbWUgQUkgQVBJXG4gICAgLy8gaWYgKCF3aW5kb3cuYWk/Lmxhbmd1YWdlTW9kZWwpIHtcbiAgICAvLyAgIGNvbnNvbGUud2FybignQ2hyb21lIEFJIG5vdCBhdmFpbGFibGUnKTtcbiAgICAvLyAgIHJldHVybiBudWxsO1xuICAgIC8vIH1cblxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBhdmFpbGFiaWxpdHkgPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmF2YWlsYWJpbGl0eSgpO1xuXG4gICAgaWYgKGF2YWlsYWJpbGl0eSA9PT0gJ25vJykge1xuICAgICAgY29uc29sZS53YXJuKFwi4p2MIEdlbWluaSBOYW5vIG5vdCBhdmFpbGFibGVcIik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnYWZ0ZXItZG93bmxvYWQnKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIuKPsyBUcmlnZ2VyaW5nIEdlbWluaSBOYW5vIGRvd25sb2FkLi4uXCIpO1xuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgYXdhaXQgTGFuZ3VhZ2VNb2RlbC5jcmVhdGUoKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgTGFuZ3VhZ2VNb2RlbC5jcmVhdGUoKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlc3Npb24ucHJvbXB0KHByb21wdCk7XG4gICAgY29uc29sZS5sb2coXCLwn6SWIFJhdyBBSSBSZXNwb25zZTpcIiwgcmVzdWx0KTtcblxuICAgICAgbGV0IGNsZWFuZWRSZXN1bHQgPSByZXN1bHQudHJpbSgpO1xuICAgIFxuICAgIC8vIC8vIFJlbW92ZSBgYGBqc29uIGFuZCBgYGAgaWYgcHJlc2VudFxuICAgIC8vIGlmIChjbGVhbmVkUmVzdWx0LnN0YXJ0c1dpdGgoJ2BgYGpzb24nKSkge1xuICAgIC8vICAgY2xlYW5lZFJlc3VsdCA9IGNsZWFuZWRSZXN1bHQucmVwbGFjZSgvXmBgYGpzb25cXHMqLywgJycpLnJlcGxhY2UoL1xccypgYGAkLywgJycpO1xuICAgIC8vIH0gZWxzZSBpZiAoY2xlYW5lZFJlc3VsdC5zdGFydHNXaXRoKCdgYGAnKSkge1xuICAgIC8vICAgY2xlYW5lZFJlc3VsdCA9IGNsZWFuZWRSZXN1bHQucmVwbGFjZSgvXmBgYFxccyovLCAnJykucmVwbGFjZSgvXFxzKmBgYCQvLCAnJyk7XG4gICAgLy8gfVxuICAgIFxuICAgIC8vIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UoY2xlYW5lZFJlc3VsdCk7XG4gICAgXG4gICAgc2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgcmV0dXJuIGNsZWFuZWRSZXN1bHQ7XG5cbiAgICBcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgLy8gY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHdpbmRvdy5haS5sYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuICAgIC8vIGNvbnN0IGFuc3dlciA9IGF3YWl0IHNlc3Npb24ucHJvbXB0KHByb21wdCk7XG4gICAgLy8gcmV0dXJuIGFuc3dlci50cmltKCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignQUkgYW5zd2VyaW5nIGZhaWxlZDonLCBlcnJvcik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2AgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJyZXN1bHQiLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJwcmludCIsImxvZ2dlciJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLG9CQUFvQkEsYUFBWTtBQUM5QyxXQUFPQTtBQUFBLEVBQ1Q7QUNBQSxRQUFBLGFBQUEsb0JBQUE7QUFBQSxJQUFtQyxTQUFBLENBQUE7QUFBQSxJQUVqQyxNQUFBLE9BQUE7QUFHRSxjQUFBLElBQUEseUJBQUE7QUFDSixhQUFBLFFBQUEsVUFBQSxZQUFBLENBQUEsU0FBQSxRQUFBLGlCQUFBO0FBQ0UsWUFBQSxRQUFBLFdBQUEsbUJBQUE7QUFDRSxrQkFBQSxJQUFBLDRCQUFBO0FBRUEsaUJBQUEsUUFBQSxZQUFBLEVBQUEsTUFBQSxjQUFBLEdBQUEsQ0FBQSxhQUFBO0FBQ0YsZ0JBQUEsT0FBQSxRQUFBLFdBQUE7QUFDRSxzQkFBQSxNQUFBLHVCQUFBLE9BQUEsUUFBQSxTQUFBO0FBQ0E7QUFBQSxZQUFBO0FBRUYsb0JBQUEsSUFBQSxrQkFBQSxRQUFBO0FBQ0EsZ0NBQUEsU0FBQSxPQUFBO0FBQUEsVUFBb0MsQ0FBQTtBQUFBLFFBQ3JDO0FBQUEsTUFDRyxDQUFBO0FBQUEsSUFDRDtBQUFBLEVBRUgsQ0FBQTtBQUVBLGlCQUFBLG9CQUFBLFNBQUE7QUFJRSxRQUFBO0FBZ0JFLFlBQUFDLFVBQUEsTUFBQSxhQUFBLE9BQUE7QUFHQSx5QkFBQUEsUUFBQSxRQUFBQSxRQUFBLFVBQUE7QUFBQSxJQUFtRCxTQUFBLE9BQUE7QUFHbkQsY0FBQSxNQUFBLG9CQUFBLEtBQUE7QUFDQSxZQUFBLHlDQUFBO0FBQUEsSUFBK0MsVUFBQTtBQUFBLElBQy9DO0FBQUEsRUFPSjtBQUVBLFdBQUEsbUJBQUEsYUFBQSxTQUFBO0FBQ0UsVUFBQSxlQUFBLFNBQUEsY0FBQSxLQUFBO0FBQ0EsaUJBQUEsTUFBQSxVQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFZQSxpQkFBQSxZQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUF5QixXQUFBLFVBQUEsVUFBQSxJQUFBLE1BQUEsT0FBQSxnQkFBQSxFQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFZekIsYUFBQSxLQUFBLFlBQUEsWUFBQTtBQUVBLGVBQUEsTUFBQSxhQUFBLE9BQUEsR0FBQSxHQUFBO0FBQUEsRUFDRjtBQWFBLFdBQUEsZUFBQTtBQUNFLFVBQUEsU0FBQSxDQUFBO0FBR0EsVUFBQSxTQUFBLFNBQUE7QUFBQSxNQUF3QjtBQUFBLElBQ3RCO0FBRUYsVUFBQSxZQUFBLFNBQUEsaUJBQUEsVUFBQTtBQUNBLFVBQUEsVUFBQSxTQUFBLGlCQUFBLFFBQUE7QUFFQSxLQUFBLEdBQUEsUUFBQSxHQUFBLFdBQUEsR0FBQSxPQUFBLEVBQUEsUUFBQSxDQUFBLFlBQUE7QUFDRSxZQUFBLFFBQUEsY0FBQSxPQUFBO0FBQ0EsWUFBQSxPQUFBLGdCQUFBLFNBQUEsS0FBQTtBQUNBLFlBQUEsV0FBQSxnQkFBQSxTQUFBLEtBQUE7QUFFQSxhQUFBLEtBQUE7QUFBQSxRQUFZO0FBQUEsUUFDVjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDQSxDQUFBO0FBQUEsSUFDRCxDQUFBO0FBR0gsV0FBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLGNBQUEsT0FBQTtBQUVFLFFBQUEsTUFBQSxJQUFBO0FBQ0UsWUFBQSxRQUFBLFNBQUEsY0FBQSxjQUFBLE1BQUEsRUFBQSxJQUFBO0FBQ0EsVUFBQSxPQUFBLFlBQUEsUUFBQSxNQUFBLFlBQUEsS0FBQTtBQUFBLElBQXNEO0FBSXhELFVBQUEsY0FBQSxNQUFBLFFBQUEsT0FBQTtBQUNBLFFBQUEsYUFBQSxZQUFBLFFBQUEsWUFBQSxZQUFBLEtBQUE7QUFHQSxRQUFBLE9BQUEsTUFBQTtBQUNBLFdBQUEsTUFBQTtBQUNFLFVBQUEsS0FBQSxZQUFBLFdBQUEsS0FBQSxhQUFBO0FBQ0UsZUFBQSxLQUFBLFlBQUEsS0FBQTtBQUFBLE1BQTZCO0FBRS9CLGFBQUEsS0FBQTtBQUFBLElBQVk7QUFJZCxVQUFBLFNBQUEsTUFBQSxRQUFBLG1CQUFBO0FBQ0EsUUFBQSxRQUFBO0FBQ0UsWUFBQSxVQUFBLE9BQUEsY0FBQSxlQUFBO0FBQ0EsVUFBQSxTQUFBLFlBQUEsUUFBQSxRQUFBLFlB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
content;