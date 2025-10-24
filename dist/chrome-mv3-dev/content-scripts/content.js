var content = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  const definition = defineContentScript({
    matches: [
      "<all_urls>"
    ],
    async main() {
      console.log("Auto-fill script loaded");
      addAutoFillButton();
    }
  });
  function addAutoFillButton() {
    const button = document.createElement("button");
    button.id = "job-copilot-autofill-btn";
    button.textContent = "🤖 Auto-fill Application";
    button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    padding: 12px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
    button.onclick = handleAutoFillClick;
    document.body.appendChild(button);
  }
  async function handleAutoFillClick() {
    const button = document.getElementById("job-copilot-autofill-btn");
    if (!button) return;
    try {
      button.textContent = "⏳ Filling...";
      button.style.pointerEvents = "none";
      const { profile } = await browser.storage.local.get("profile");
      if (!profile) {
        alert("Please set up your profile first in the extension popup!");
        return;
      }
      const result2 = await autoFillForm(profile);
      showSuccessMessage(result2.filled, result2.aiAnswered);
    } catch (error) {
      console.error("Auto-fill error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      if (button) {
        button.textContent = "🤖 Auto-fill Application";
        button.style.pointerEvents = "auto";
      }
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
      if (!window.ai?.languageModel) {
        console.warn("Chrome AI not available");
        return null;
      }
      const session = await window.ai.languageModel.create();
      const answer = await session.prompt(prompt);
      return answer.trim();
    } catch (error) {
      console.error("AI answering failed:", error);
      return null;
    }
  }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L2Jyb3dzZXIubWpzIiwiLi4vLi4vLi4vc3JjL2VudHJ5cG9pbnRzL2NvbnRlbnQudHMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiaW1wb3J0IHR5cGUgIFVzZXJQcm9maWxlICBmcm9tICdAL2xpYi90eXBlcy91c2VyJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFtcbiAgICAnPGFsbF91cmxzPicsXG4gIF0sXG4gIFxuICBhc3luYyBtYWluKCkge1xuICAgIGNvbnNvbGUubG9nKCdBdXRvLWZpbGwgc2NyaXB0IGxvYWRlZCcpO1xuICAgIGFkZEF1dG9GaWxsQnV0dG9uKCk7XG4gIH1cbn0pO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gQlVUVE9OICYgVUlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGFkZEF1dG9GaWxsQnV0dG9uKCkge1xuICBjb25zdCBidXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgYnV0dG9uLmlkID0gJ2pvYi1jb3BpbG90LWF1dG9maWxsLWJ0bic7XG4gIGJ1dHRvbi50ZXh0Q29udGVudCA9ICfwn6SWIEF1dG8tZmlsbCBBcHBsaWNhdGlvbic7XG4gIGJ1dHRvbi5zdHlsZS5jc3NUZXh0ID0gYFxuICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICBib3R0b206IDIwcHg7XG4gICAgcmlnaHQ6IDIwcHg7XG4gICAgei1pbmRleDogMTAwMDA7XG4gICAgcGFkZGluZzogMTJweCAyNHB4O1xuICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsICM2NjdlZWEgMCUsICM3NjRiYTIgMTAwJSk7XG4gICAgY29sb3I6IHdoaXRlO1xuICAgIGJvcmRlcjogbm9uZTtcbiAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgZm9udC1zaXplOiAxNHB4O1xuICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgY3Vyc29yOiBwb2ludGVyO1xuICAgIGJveC1zaGFkb3c6IDAgNHB4IDEycHggcmdiYSgwLDAsMCwwLjE1KTtcbiAgYDtcbiAgXG4gIGJ1dHRvbi5vbmNsaWNrID0gaGFuZGxlQXV0b0ZpbGxDbGljaztcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChidXR0b24pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVBdXRvRmlsbENsaWNrKCkge1xuICBjb25zdCBidXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLWNvcGlsb3QtYXV0b2ZpbGwtYnRuJyk7XG4gIGlmICghYnV0dG9uKSByZXR1cm47XG4gIFxuICB0cnkge1xuICAgIC8vIFNob3cgbG9hZGluZyBzdGF0ZVxuICAgIGJ1dHRvbi50ZXh0Q29udGVudCA9ICfij7MgRmlsbGluZy4uLic7XG4gICAgYnV0dG9uLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG4gICAgXG4gICAgLy8gR2V0IHVzZXIgcHJvZmlsZVxuICAgIGNvbnN0IHsgcHJvZmlsZSB9ID0gYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLmdldCgncHJvZmlsZScpO1xuICAgIFxuICAgIGlmICghcHJvZmlsZSkge1xuICAgICAgYWxlcnQoJ1BsZWFzZSBzZXQgdXAgeW91ciBwcm9maWxlIGZpcnN0IGluIHRoZSBleHRlbnNpb24gcG9wdXAhJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIC8vIERvIHRoZSBhdXRvLWZpbGxcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhdXRvRmlsbEZvcm0ocHJvZmlsZSk7XG4gICAgXG4gICAgLy8gU2hvdyBzdWNjZXNzXG4gICAgc2hvd1N1Y2Nlc3NNZXNzYWdlKHJlc3VsdC5maWxsZWQsIHJlc3VsdC5haUFuc3dlcmVkKTtcbiAgICBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdBdXRvLWZpbGwgZXJyb3I6JywgZXJyb3IpO1xuICAgIGFsZXJ0KCdTb21ldGhpbmcgd2VudCB3cm9uZy4gUGxlYXNlIHRyeSBhZ2Fpbi4nKTtcbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBSZXNldCBidXR0b25cbiAgICBpZiAoYnV0dG9uKSB7XG4gICAgICBidXR0b24udGV4dENvbnRlbnQgPSAn8J+kliBBdXRvLWZpbGwgQXBwbGljYXRpb24nO1xuICAgICAgYnV0dG9uLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnYXV0byc7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHNob3dTdWNjZXNzTWVzc2FnZShmaWxsZWRDb3VudDogbnVtYmVyLCBhaUNvdW50OiBudW1iZXIpIHtcbiAgY29uc3Qgbm90aWZpY2F0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIG5vdGlmaWNhdGlvbi5zdHlsZS5jc3NUZXh0ID0gYFxuICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICB0b3A6IDIwcHg7XG4gICAgcmlnaHQ6IDIwcHg7XG4gICAgei1pbmRleDogMTAwMDE7XG4gICAgcGFkZGluZzogMTZweCAyNHB4O1xuICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICBib3gtc2hhZG93OiAwIDRweCAxMnB4IHJnYmEoMCwwLDAsMC4xNSk7XG4gICAgZm9udC1zaXplOiAxNHB4O1xuICBgO1xuICBcbiAgbm90aWZpY2F0aW9uLmlubmVySFRNTCA9IGBcbiAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiAxMnB4O1wiPlxuICAgICAgPHNwYW4gc3R5bGU9XCJmb250LXNpemU6IDI0cHg7XCI+4pyFPC9zcGFuPlxuICAgICAgPGRpdj5cbiAgICAgICAgPGRpdiBzdHlsZT1cImZvbnQtd2VpZ2h0OiA2MDA7IGNvbG9yOiAjMTBiOTgxO1wiPkF1dG8tZmlsbCBDb21wbGV0ZSE8L2Rpdj5cbiAgICAgICAgPGRpdiBzdHlsZT1cImNvbG9yOiAjNmI3MjgwOyBmb250LXNpemU6IDEycHg7IG1hcmdpbi10b3A6IDRweDtcIj5cbiAgICAgICAgICBGaWxsZWQgJHtmaWxsZWRDb3VudH0gZmllbGRzJHthaUNvdW50ID4gMCA/IGAgKyAke2FpQ291bnR9IEFJIGFuc3dlcnNgIDogJyd9XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIGA7XG4gIFxuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG5vdGlmaWNhdGlvbik7XG4gIFxuICBzZXRUaW1lb3V0KCgpID0+IG5vdGlmaWNhdGlvbi5yZW1vdmUoKSwgMzAwMCk7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBGSUVMRCBERVRFQ1RJT05cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmludGVyZmFjZSBGaWVsZEluZm8ge1xuICBlbGVtZW50OiBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCB8IEhUTUxTZWxlY3RFbGVtZW50O1xuICB0eXBlOiBzdHJpbmcgfCBudWxsO1xuICBsYWJlbDogc3RyaW5nO1xuICByZXF1aXJlZDogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gZ2V0QWxsRmllbGRzKCk6IEZpZWxkSW5mb1tdIHtcbiAgY29uc3QgZmllbGRzOiBGaWVsZEluZm9bXSA9IFtdO1xuICBcbiAgLy8gR2V0IGFsbCBmaWxsYWJsZSBlbGVtZW50c1xuICBjb25zdCBpbnB1dHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxJbnB1dEVsZW1lbnQ+KFxuICAgICdpbnB1dDpub3QoW3R5cGU9XCJoaWRkZW5cIl0pOm5vdChbdHlwZT1cInN1Ym1pdFwiXSk6bm90KFt0eXBlPVwiYnV0dG9uXCJdKTpub3QoW3R5cGU9XCJpbWFnZVwiXSknXG4gICk7XG4gIGNvbnN0IHRleHRhcmVhcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTFRleHRBcmVhRWxlbWVudD4oJ3RleHRhcmVhJyk7XG4gIGNvbnN0IHNlbGVjdHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxTZWxlY3RFbGVtZW50Pignc2VsZWN0Jyk7XG4gIFxuICBbLi4uaW5wdXRzLCAuLi50ZXh0YXJlYXMsIC4uLnNlbGVjdHNdLmZvckVhY2goZWxlbWVudCA9PiB7XG4gICAgY29uc3QgbGFiZWwgPSBnZXRGaWVsZExhYmVsKGVsZW1lbnQpO1xuICAgIGNvbnN0IHR5cGUgPSBkZXRlY3RGaWVsZFR5cGUoZWxlbWVudCwgbGFiZWwpO1xuICAgIGNvbnN0IHJlcXVpcmVkID0gaXNGaWVsZFJlcXVpcmVkKGVsZW1lbnQsIGxhYmVsKTtcbiAgICBcbiAgICBmaWVsZHMucHVzaCh7XG4gICAgICBlbGVtZW50LFxuICAgICAgdHlwZSxcbiAgICAgIGxhYmVsLFxuICAgICAgcmVxdWlyZWRcbiAgICB9KTtcbiAgfSk7XG4gIFxuICByZXR1cm4gZmllbGRzO1xufVxuXG5mdW5jdGlvbiBnZXRGaWVsZExhYmVsKGZpZWxkOiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIC8vIE1ldGhvZCAxOiA8bGFiZWwgZm9yPVwiaWRcIj5cbiAgaWYgKGZpZWxkLmlkKSB7XG4gICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBsYWJlbFtmb3I9XCIke2ZpZWxkLmlkfVwiXWApO1xuICAgIGlmIChsYWJlbD8udGV4dENvbnRlbnQpIHJldHVybiBsYWJlbC50ZXh0Q29udGVudC50cmltKCk7XG4gIH1cbiAgXG4gIC8vIE1ldGhvZCAyOiBQYXJlbnQgPGxhYmVsPlxuICBjb25zdCBwYXJlbnRMYWJlbCA9IGZpZWxkLmNsb3Nlc3QoJ2xhYmVsJyk7XG4gIGlmIChwYXJlbnRMYWJlbD8udGV4dENvbnRlbnQpIHJldHVybiBwYXJlbnRMYWJlbC50ZXh0Q29udGVudC50cmltKCk7XG4gIFxuICAvLyBNZXRob2QgMzogUHJldmlvdXMgc2libGluZ1xuICBsZXQgcHJldiA9IGZpZWxkLnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XG4gIHdoaWxlIChwcmV2KSB7XG4gICAgaWYgKHByZXYudGFnTmFtZSA9PT0gJ0xBQkVMJyAmJiBwcmV2LnRleHRDb250ZW50KSB7XG4gICAgICByZXR1cm4gcHJldi50ZXh0Q29udGVudC50cmltKCk7XG4gICAgfVxuICAgIHByZXYgPSBwcmV2LnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XG4gIH1cbiAgXG4gIC8vIE1ldGhvZCA0OiBMb29rIGluIHBhcmVudCBjb250YWluZXJcbiAgY29uc3QgcGFyZW50ID0gZmllbGQuY2xvc2VzdCgnZGl2LCBmaWVsZHNldCwgbGknKTtcbiAgaWYgKHBhcmVudCkge1xuICAgIGNvbnN0IGxhYmVsRWwgPSBwYXJlbnQucXVlcnlTZWxlY3RvcignbGFiZWwsIGxlZ2VuZCcpO1xuICAgIGlmIChsYWJlbEVsPy50ZXh0Q29udGVudCkgcmV0dXJuIGxhYmVsRWwudGV4dENvbnRlbnQudHJpbSgpO1xuICB9XG4gIFxuICAvLyBNZXRob2QgNTogYXJpYS1sYWJlbFxuICBjb25zdCBhcmlhTGFiZWwgPSBmaWVsZC5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKTtcbiAgaWYgKGFyaWFMYWJlbCkgcmV0dXJuIGFyaWFMYWJlbDtcbiAgXG4gIC8vIE1ldGhvZCA2OiBwbGFjZWhvbGRlciBhcyBsYXN0IHJlc29ydFxuICBpZiAoJ3BsYWNlaG9sZGVyJyBpbiBmaWVsZCkge1xuICAgIGNvbnN0IGlucHV0RWxlbWVudCA9IGZpZWxkIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50O1xuICAgIGlmIChpbnB1dEVsZW1lbnQucGxhY2Vob2xkZXIpIHtcbiAgICAgIHJldHVybiBpbnB1dEVsZW1lbnQucGxhY2Vob2xkZXI7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4gJyc7XG59XG5cbmZ1bmN0aW9uIGRldGVjdEZpZWxkVHlwZShcbiAgZmllbGQ6IEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50IHwgSFRNTFNlbGVjdEVsZW1lbnQsXG4gIGxhYmVsOiBzdHJpbmdcbik6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBzZWFyY2hUZXh0ID0gbGFiZWwudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgZmllbGROYW1lID0gZmllbGQubmFtZS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBmaWVsZElkID0gZmllbGQuaWQudG9Mb3dlckNhc2UoKTtcbiAgXG4gIC8vIENvbWJpbmUgYWxsIHNlYXJjaCBzb3VyY2VzXG4gIGNvbnN0IHNlYXJjaEluID0gYCR7c2VhcmNoVGV4dH0gJHtmaWVsZE5hbWV9ICR7ZmllbGRJZH1gO1xuICBcbiAgLy8gQ2hlY2sgZm9yIGVhY2ggZmllbGQgdHlwZVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2ZpcnN0IG5hbWUnLCAnZmlyc3RuYW1lJywgJ2dpdmVuIG5hbWUnLCAnZm5hbWUnXSkpIHtcbiAgICByZXR1cm4gJ2ZpcnN0TmFtZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydsYXN0IG5hbWUnLCAnbGFzdG5hbWUnLCAnc3VybmFtZScsICdmYW1pbHkgbmFtZScsICdsbmFtZSddKSkge1xuICAgIHJldHVybiAnbGFzdE5hbWUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnZnVsbCBuYW1lJywgJ3lvdXIgbmFtZSddKSAmJiAhc2VhcmNoSW4uaW5jbHVkZXMoJ2ZpcnN0JykgJiYgIXNlYXJjaEluLmluY2x1ZGVzKCdsYXN0JykpIHtcbiAgICByZXR1cm4gJ2Z1bGxOYW1lJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2VtYWlsJywgJ2UtbWFpbCddKSkge1xuICAgIHJldHVybiAnZW1haWwnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsncGhvbmUnLCAndGVsZXBob25lJywgJ21vYmlsZScsICdjZWxsJ10pKSB7XG4gICAgcmV0dXJuICdwaG9uZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydsaW5rZWRpbicsICdsaW5rZWRpbiBwcm9maWxlJ10pKSB7XG4gICAgcmV0dXJuICdsaW5rZWRpbic7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydwb3J0Zm9saW8nLCAnd2Vic2l0ZScsICdwZXJzb25hbCBzaXRlJywgJ2dpdGh1YiddKSkge1xuICAgIHJldHVybiAncG9ydGZvbGlvJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2N1cnJlbnQgY29tcGFueScsICdlbXBsb3llciddKSkge1xuICAgIHJldHVybiAnY3VycmVudENvbXBhbnknO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnY3VycmVudCB0aXRsZScsICdqb2IgdGl0bGUnLCAnY3VycmVudCByb2xlJywgJ3Bvc2l0aW9uJ10pKSB7XG4gICAgcmV0dXJuICdjdXJyZW50VGl0bGUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsneWVhcnMgb2YgZXhwZXJpZW5jZScsICdleHBlcmllbmNlJywgJ3llYXJzIGV4cGVyaWVuY2UnXSkpIHtcbiAgICByZXR1cm4gJ2V4cGVyaWVuY2UnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnYWRkcmVzcycsICdzdHJlZXQnXSkpIHtcbiAgICByZXR1cm4gJ2FkZHJlc3MnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnY2l0eScsICd0b3duJ10pKSB7XG4gICAgcmV0dXJuICdjaXR5JztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3N0YXRlJywgJ3Byb3ZpbmNlJ10pKSB7XG4gICAgcmV0dXJuICdzdGF0ZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWyd6aXAnLCAncG9zdGFsIGNvZGUnLCAncG9zdGNvZGUnXSkpIHtcbiAgICByZXR1cm4gJ3ppcCc7XG4gIH1cbiAgXG4gIC8vIENoZWNrYm94ZXNcbiAgaWYgKCd0eXBlJyBpbiBmaWVsZCAmJiAoZmllbGQudHlwZSA9PT0gJ2NoZWNrYm94JyB8fCBmaWVsZC50eXBlID09PSAncmFkaW8nKSkge1xuICAgIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnc3BvbnNvcicsICd2aXNhJywgJ2F1dGhvcml6ZWQgdG8gd29yaycsICd3b3JrIGF1dGhvcml6YXRpb24nXSkpIHtcbiAgICAgIHJldHVybiAnc3BvbnNvcnNoaXAnO1xuICAgIH1cbiAgICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3JlbG9jYXRlJywgJ3JlbG9jYXRpb24nLCAnd2lsbGluZyB0byBtb3ZlJ10pKSB7XG4gICAgICByZXR1cm4gJ3JlbG9jYXRpb24nO1xuICAgIH1cbiAgICByZXR1cm4gJ2NoZWNrYm94LXVua25vd24nO1xuICB9XG4gIFxuICAvLyBDdXN0b20gcXVlc3Rpb25zICh0ZXh0YXJlYXMgd2l0aCBxdWVzdGlvbi1saWtlIGxhYmVscylcbiAgaWYgKGZpZWxkLnRhZ05hbWUgPT09ICdURVhUQVJFQScgfHwgKCd0eXBlJyBpbiBmaWVsZCAmJiBmaWVsZC50eXBlID09PSAndGV4dCcpKSB7XG4gICAgaWYgKGxhYmVsLmxlbmd0aCA+IDMwIHx8IGxhYmVsLmluY2x1ZGVzKCc/JykgfHwgbGFiZWwuaW5jbHVkZXMoJ3doeScpIHx8IGxhYmVsLmluY2x1ZGVzKCdkZXNjcmliZScpKSB7XG4gICAgICByZXR1cm4gJ2N1c3RvbVF1ZXN0aW9uJztcbiAgICB9XG4gIH1cbiAgXG4gIHJldHVybiBudWxsOyAvLyBVbmtub3duIGZpZWxkIHR5cGVcbn1cblxuZnVuY3Rpb24gbWF0Y2hlc0tleXdvcmRzKHRleHQ6IHN0cmluZywga2V5d29yZHM6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG4gIHJldHVybiBrZXl3b3Jkcy5zb21lKGtleXdvcmQgPT4gdGV4dC5pbmNsdWRlcyhrZXl3b3JkKSk7XG59XG5cbmZ1bmN0aW9uIGlzRmllbGRSZXF1aXJlZChmaWVsZDogSFRNTEVsZW1lbnQsIGxhYmVsOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgaWYgKCdyZXF1aXJlZCcgaW4gZmllbGQgJiYgZmllbGQucmVxdWlyZWQpIHJldHVybiB0cnVlO1xuICBpZiAoZmllbGQuZ2V0QXR0cmlidXRlKCdhcmlhLXJlcXVpcmVkJykgPT09ICd0cnVlJykgcmV0dXJuIHRydWU7XG4gIGlmIChsYWJlbC5pbmNsdWRlcygnKicpKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGxhYmVsLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3JlcXVpcmVkJykpIHJldHVybiB0cnVlO1xuICByZXR1cm4gZmFsc2U7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBGT1JNIEZJTExJTkdcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmFzeW5jIGZ1bmN0aW9uIGF1dG9GaWxsRm9ybShwcm9maWxlOiBVc2VyUHJvZmlsZSkge1xuICBjb25zdCBmaWVsZHMgPSBnZXRBbGxGaWVsZHMoKTtcbiAgXG4gIGxldCBmaWxsZWRDb3VudCA9IDA7XG4gIGxldCBhaUFuc3dlcmVkQ291bnQgPSAwO1xuICBjb25zdCBjdXN0b21RdWVzdGlvbnM6IEZpZWxkSW5mb1tdID0gW107XG4gIFxuICAvLyBGaXJzdCBwYXNzOiBmaWxsIGFsbCBzdGFuZGFyZCBmaWVsZHNcbiAgZm9yIChjb25zdCBmaWVsZEluZm8gb2YgZmllbGRzKSB7XG4gICAgaWYgKCFmaWVsZEluZm8udHlwZSkgY29udGludWU7XG4gICAgXG4gICAgLy8gQ29sbGVjdCBjdXN0b20gcXVlc3Rpb25zIGZvciBBSSBsYXRlclxuICAgIGlmIChmaWVsZEluZm8udHlwZSA9PT0gJ2N1c3RvbVF1ZXN0aW9uJykge1xuICAgICAgY3VzdG9tUXVlc3Rpb25zLnB1c2goZmllbGRJbmZvKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBcbiAgICAvLyBGaWxsIHN0YW5kYXJkIGZpZWxkc1xuICAgIGNvbnN0IHN1Y2Nlc3MgPSBmaWxsRmllbGQoZmllbGRJbmZvLCBwcm9maWxlKTtcbiAgICBpZiAoc3VjY2VzcykgZmlsbGVkQ291bnQrKztcbiAgfVxuICBcbiAgLy8gU2Vjb25kIHBhc3M6IHVzZSBBSSBmb3IgY3VzdG9tIHF1ZXN0aW9uc1xuICBpZiAoY3VzdG9tUXVlc3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBqb2JDb250ZXh0ID0gZXh0cmFjdEpvYkNvbnRleHQoKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGZpZWxkSW5mbyBvZiBjdXN0b21RdWVzdGlvbnMpIHtcbiAgICAgIGNvbnN0IGFuc3dlciA9IGF3YWl0IGFuc3dlckN1c3RvbVF1ZXN0aW9uKGZpZWxkSW5mby5sYWJlbCwgcHJvZmlsZSwgam9iQ29udGV4dCk7XG4gICAgICBpZiAoYW5zd2VyKSB7XG4gICAgICAgIGZpbGxUZXh0RmllbGQoZmllbGRJbmZvLmVsZW1lbnQgYXMgSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQsIGFuc3dlcik7XG4gICAgICAgIGFpQW5zd2VyZWRDb3VudCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHtcbiAgICBmaWxsZWQ6IGZpbGxlZENvdW50LFxuICAgIGFpQW5zd2VyZWQ6IGFpQW5zd2VyZWRDb3VudFxuICB9O1xufVxuXG5mdW5jdGlvbiBmaWxsRmllbGQoZmllbGRJbmZvOiBGaWVsZEluZm8sIHByb2ZpbGU6IFVzZXJQcm9maWxlKTogYm9vbGVhbiB7XG4gIGNvbnN0IHsgZWxlbWVudCwgdHlwZSB9ID0gZmllbGRJbmZvO1xuICBcbiAgLy8gR2V0IHRoZSB2YWx1ZSB0byBmaWxsXG4gIGNvbnN0IHZhbHVlID0gZ2V0VmFsdWVGb3JGaWVsZFR5cGUodHlwZSwgcHJvZmlsZSk7XG4gIGlmICghdmFsdWUpIHJldHVybiBmYWxzZTtcbiAgXG4gIC8vIEZpbGwgYmFzZWQgb24gZWxlbWVudCB0eXBlXG4gIGlmIChlbGVtZW50LnRhZ05hbWUgPT09ICdTRUxFQ1QnKSB7XG4gICAgcmV0dXJuIGZpbGxTZWxlY3QoZWxlbWVudCBhcyBIVE1MU2VsZWN0RWxlbWVudCwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKCd0eXBlJyBpbiBlbGVtZW50ICYmIGVsZW1lbnQudHlwZSA9PT0gJ2NoZWNrYm94Jykge1xuICAgIHJldHVybiBmaWxsQ2hlY2tib3goZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoJ3R5cGUnIGluIGVsZW1lbnQgJiYgZWxlbWVudC50eXBlID09PSAncmFkaW8nKSB7XG4gICAgcmV0dXJuIGZpbGxSYWRpbyhlbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQsIHZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmlsbFRleHRGaWVsZChlbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50LCB2YWx1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VmFsdWVGb3JGaWVsZFR5cGUodHlwZTogc3RyaW5nIHwgbnVsbCwgcHJvZmlsZTogVXNlclByb2ZpbGUpOiBhbnkge1xuICBpZiAoIXR5cGUpIHJldHVybiBudWxsO1xuICBcbiAgY29uc3QgdmFsdWVNYXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gICAgZmlyc3ROYW1lOiBwcm9maWxlLmZpcnN0TmFtZSxcbiAgICBsYXN0TmFtZTogcHJvZmlsZS5sYXN0TmFtZSxcbiAgICBmdWxsTmFtZTogYCR7cHJvZmlsZS5maXJzdE5hbWV9ICR7cHJvZmlsZS5sYXN0TmFtZX1gLFxuICAgIGVtYWlsOiBwcm9maWxlLmVtYWlsLFxuICAgIHBob25lOiBwcm9maWxlLnBob25lLFxuICAgIGxpbmtlZGluOiBwcm9maWxlLmxpbmtlZGluLFxuICAgIHBvcnRmb2xpbzogcHJvZmlsZS5wb3J0Zm9saW8sXG4gICAgYWRkcmVzczogcHJvZmlsZS5hZGRyZXNzLFxuICAgIGNpdHk6IHByb2ZpbGUuY2l0eSxcbiAgICBzdGF0ZTogcHJvZmlsZS5zdGF0ZSxcbiAgICB6aXA6IHByb2ZpbGUuemlwLFxuICAgIGN1cnJlbnRDb21wYW55OiBwcm9maWxlLmN1cnJlbnRDb21wYW55LFxuICAgIGN1cnJlbnRUaXRsZTogcHJvZmlsZS5jdXJyZW50VGl0bGUsXG4gICAgZXhwZXJpZW5jZTogcHJvZmlsZS55ZWFyc0V4cGVyaWVuY2UsXG4gICAgc3BvbnNvcnNoaXA6IHByb2ZpbGUubmVlZHNTcG9uc29yc2hpcCA/ICd5ZXMnIDogJ25vJyxcbiAgICByZWxvY2F0aW9uOiBwcm9maWxlLndpbGxpbmdUb1JlbG9jYXRlID8gJ3llcycgOiAnbm8nLFxuICB9O1xuICBcbiAgcmV0dXJuIHZhbHVlTWFwW3R5cGVdO1xufVxuXG5mdW5jdGlvbiBmaWxsVGV4dEZpZWxkKFxuICBmaWVsZDogSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQsXG4gIHZhbHVlOiBzdHJpbmdcbik6IGJvb2xlYW4ge1xuICBmaWVsZC52YWx1ZSA9IHZhbHVlO1xuICB0cmlnZ2VySW5wdXRFdmVudHMoZmllbGQpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbFNlbGVjdChzZWxlY3Q6IEhUTUxTZWxlY3RFbGVtZW50LCB2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIGNvbnN0IG9wdGlvbnMgPSBBcnJheS5mcm9tKHNlbGVjdC5vcHRpb25zKTtcbiAgXG4gIC8vIFRyeSBleGFjdCBtYXRjaFxuICBsZXQgbWF0Y2ggPSBvcHRpb25zLmZpbmQob3B0ID0+IFxuICAgIG9wdC52YWx1ZSA9PT0gdmFsdWUgfHwgb3B0LnRleHQgPT09IHZhbHVlXG4gICk7XG4gIFxuICAvLyBUcnkgZnV6enkgbWF0Y2hcbiAgaWYgKCFtYXRjaCkge1xuICAgIGNvbnN0IHZhbHVlTG93ZXIgPSB2YWx1ZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCk7XG4gICAgbWF0Y2ggPSBvcHRpb25zLmZpbmQob3B0ID0+IFxuICAgICAgb3B0LnZhbHVlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModmFsdWVMb3dlcikgfHxcbiAgICAgIG9wdC50ZXh0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModmFsdWVMb3dlcilcbiAgICApO1xuICB9XG4gIFxuICAvLyBUcnkgbnVtZXJpYyBtYXRjaCAoZm9yIHllYXJzIG9mIGV4cGVyaWVuY2UpXG4gIGlmICghbWF0Y2ggJiYgIWlzTmFOKHZhbHVlKSkge1xuICAgIG1hdGNoID0gb3B0aW9ucy5maW5kKG9wdCA9PiBvcHQudmFsdWUgPT09IHZhbHVlLnRvU3RyaW5nKCkpO1xuICB9XG4gIFxuICBpZiAobWF0Y2gpIHtcbiAgICBzZWxlY3QudmFsdWUgPSBtYXRjaC52YWx1ZTtcbiAgICB0cmlnZ2VySW5wdXRFdmVudHMoc2VsZWN0KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBmaWxsQ2hlY2tib3goY2hlY2tib3g6IEhUTUxJbnB1dEVsZW1lbnQsIHZhbHVlOiBhbnkpOiBib29sZWFuIHtcbiAgY29uc3Qgc2hvdWxkQ2hlY2sgPSB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gJ3llcycgfHwgdmFsdWUgPT09ICd0cnVlJztcbiAgY2hlY2tib3guY2hlY2tlZCA9IHNob3VsZENoZWNrO1xuICB0cmlnZ2VySW5wdXRFdmVudHMoY2hlY2tib3gpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbFJhZGlvKHJhZGlvOiBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIGNvbnN0IHJhZGlvcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTElucHV0RWxlbWVudD4oYGlucHV0W25hbWU9XCIke3JhZGlvLm5hbWV9XCJdYCk7XG4gIGNvbnN0IHZhbHVlTG93ZXIgPSB2YWx1ZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCk7XG4gIFxuICBjb25zdCBtYXRjaCA9IEFycmF5LmZyb20ocmFkaW9zKS5maW5kKHIgPT4ge1xuICAgIGNvbnN0IGxhYmVsID0gZ2V0RmllbGRMYWJlbChyKS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiBsYWJlbC5pbmNsdWRlcyh2YWx1ZUxvd2VyKSB8fCByLnZhbHVlLnRvTG93ZXJDYXNlKCkgPT09IHZhbHVlTG93ZXI7XG4gIH0pO1xuICBcbiAgaWYgKG1hdGNoKSB7XG4gICAgbWF0Y2guY2hlY2tlZCA9IHRydWU7XG4gICAgdHJpZ2dlcklucHV0RXZlbnRzKG1hdGNoKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiB0cmlnZ2VySW5wdXRFdmVudHMoZWxlbWVudDogSFRNTEVsZW1lbnQpIHtcbiAgLy8gVHJpZ2dlciBtdWx0aXBsZSBldmVudHMgdG8gZW5zdXJlIHRoZSBzaXRlIHJlY29nbml6ZXMgdGhlIGNoYW5nZVxuICBjb25zdCBldmVudHMgPSBbXG4gICAgbmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSxcbiAgICBuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSxcbiAgICBuZXcgRXZlbnQoJ2JsdXInLCB7IGJ1YmJsZXM6IHRydWUgfSksXG4gIF07XG4gIFxuICBldmVudHMuZm9yRWFjaChldmVudCA9PiBlbGVtZW50LmRpc3BhdGNoRXZlbnQoZXZlbnQpKTtcbiAgXG4gIC8vIFNwZWNpYWwgaGFuZGxpbmcgZm9yIFJlYWN0XG4gIGlmICgndmFsdWUnIGluIGVsZW1lbnQpIHtcbiAgICBjb25zdCBuYXRpdmVJbnB1dFZhbHVlU2V0dGVyID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihcbiAgICAgIHdpbmRvdy5IVE1MSW5wdXRFbGVtZW50LnByb3RvdHlwZSxcbiAgICAgICd2YWx1ZSdcbiAgICApPy5zZXQ7XG4gICAgXG4gICAgaWYgKG5hdGl2ZUlucHV0VmFsdWVTZXR0ZXIpIHtcbiAgICAgIG5hdGl2ZUlucHV0VmFsdWVTZXR0ZXIuY2FsbChlbGVtZW50LCAoZWxlbWVudCBhcyBhbnkpLnZhbHVlKTtcbiAgICAgIGVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEFJIElOVEVHUkFUSU9OXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBleHRyYWN0Sm9iQ29udGV4dCgpIHtcbiAgY29uc3QgdGl0bGUgPSBcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdoMScpPy50ZXh0Q29udGVudCB8fFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tjbGFzcyo9XCJqb2ItdGl0bGVcIl0nKT8udGV4dENvbnRlbnQgfHxcbiAgICAndGhpcyBwb3NpdGlvbic7XG4gICAgXG4gIGNvbnN0IGNvbXBhbnkgPSBcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbY2xhc3MqPVwiY29tcGFueVwiXScpPy50ZXh0Q29udGVudCB8fFxuICAgICd0aGlzIGNvbXBhbnknO1xuXG4gIHJldHVybiB7XG4gICAgdGl0bGU6IHRpdGxlLnRyaW0oKSxcbiAgICBjb21wYW55OiBjb21wYW55LnRyaW0oKVxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBhbnN3ZXJDdXN0b21RdWVzdGlvbihcbiAgcXVlc3Rpb246IHN0cmluZyxcbiAgcHJvZmlsZTogVXNlclByb2ZpbGUsXG4gIGpvYkNvbnRleHQ6IHsgdGl0bGU6IHN0cmluZzsgY29tcGFueTogc3RyaW5nIH1cbik6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCBwcm9tcHQgPSBgWW91IGFyZSBoZWxwaW5nIHNvbWVvbmUgZmlsbCBvdXQgYSBqb2IgYXBwbGljYXRpb24uIEFuc3dlciB0aGlzIHF1ZXN0aW9uIHByb2Zlc3Npb25hbGx5IGFuZCBjb25jaXNlbHkgKG1heCAxMDAgd29yZHMpOlxuXG5RdWVzdGlvbjogXCIke3F1ZXN0aW9ufVwiXG5cbkpvYjogJHtqb2JDb250ZXh0LnRpdGxlfSBhdCAke2pvYkNvbnRleHQuY29tcGFueX1cblxuQ2FuZGlkYXRlIEJhY2tncm91bmQ6XG4tIE5hbWU6ICR7cHJvZmlsZS5maXJzdE5hbWV9ICR7cHJvZmlsZS5sYXN0TmFtZX1cbi0gQ3VycmVudCBSb2xlOiAke3Byb2ZpbGUuY3VycmVudFRpdGxlIHx8ICdOb3Qgc3BlY2lmaWVkJ31cbi0gRXhwZXJpZW5jZTogJHtwcm9maWxlLnllYXJzRXhwZXJpZW5jZSB8fCAnTm90IHNwZWNpZmllZCd9IHllYXJzXG5cblByb3ZpZGUgb25seSB0aGUgYW5zd2VyLCBubyBwcmVhbWJsZSBvciBleHBsYW5hdGlvbjpgO1xuXG4gIHRyeSB7XG4gICAgLy8gQHRzLWlnbm9yZSAtIENocm9tZSBBSSBBUElcbiAgICBpZiAoIXdpbmRvdy5haT8ubGFuZ3VhZ2VNb2RlbCkge1xuICAgICAgY29uc29sZS53YXJuKCdDaHJvbWUgQUkgbm90IGF2YWlsYWJsZScpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIFxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgd2luZG93LmFpLmxhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG4gICAgY29uc3QgYW5zd2VyID0gYXdhaXQgc2Vzc2lvbi5wcm9tcHQocHJvbXB0KTtcbiAgICByZXR1cm4gYW5zd2VyLnRyaW0oKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdBSSBhbnN3ZXJpbmcgZmFpbGVkOicsIGVycm9yKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIiwiZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG4gIGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICBtZXRob2QoYFt3eHRdICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbiAgfVxufVxuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IHtcbiAgZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcbiAgbG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuICB3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcbiAgZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEludGVydmFscyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNsZWFySW50ZXJ2YWxgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsQW5pbWF0aW9uRnJhbWVgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsSWRsZUNhbGxiYWNrYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSwgb3B0aW9ucyk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICBhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuICAgIGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcbiAgICB9XG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/LihcbiAgICAgIHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLFxuICAgICAgaGFuZGxlcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgc2lnbmFsOiB0aGlzLnNpZ25hbFxuICAgICAgfVxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cbiAgICovXG4gIG5vdGlmeUludmFsaWRhdGVkKCkge1xuICAgIHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuICAgIGxvZ2dlci5kZWJ1ZyhcbiAgICAgIGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYFxuICAgICk7XG4gIH1cbiAgc3RvcE9sZFNjcmlwdHMoKSB7XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKFxuICAgICAge1xuICAgICAgICB0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG4gICAgICAgIGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuICAgICAgICBtZXNzYWdlSWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpXG4gICAgICB9LFxuICAgICAgXCIqXCJcbiAgICApO1xuICB9XG4gIHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuICAgIGNvbnN0IGlzU2NyaXB0U3RhcnRlZEV2ZW50ID0gZXZlbnQuZGF0YT8udHlwZSA9PT0gQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFO1xuICAgIGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kYXRhPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcbiAgICBjb25zdCBpc05vdER1cGxpY2F0ZSA9ICF0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5oYXMoZXZlbnQuZGF0YT8ubWVzc2FnZUlkKTtcbiAgICByZXR1cm4gaXNTY3JpcHRTdGFydGVkRXZlbnQgJiYgaXNTYW1lQ29udGVudFNjcmlwdCAmJiBpc05vdER1cGxpY2F0ZTtcbiAgfVxuICBsaXN0ZW5Gb3JOZXdlclNjcmlwdHMob3B0aW9ucykge1xuICAgIGxldCBpc0ZpcnN0ID0gdHJ1ZTtcbiAgICBjb25zdCBjYiA9IChldmVudCkgPT4ge1xuICAgICAgaWYgKHRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkge1xuICAgICAgICB0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5hZGQoZXZlbnQuZGF0YS5tZXNzYWdlSWQpO1xuICAgICAgICBjb25zdCB3YXNGaXJzdCA9IGlzRmlyc3Q7XG4gICAgICAgIGlzRmlyc3QgPSBmYWxzZTtcbiAgICAgICAgaWYgKHdhc0ZpcnN0ICYmIG9wdGlvbnM/Lmlnbm9yZUZpcnN0RXZlbnQpIHJldHVybjtcbiAgICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiByZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYikpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiZGVmaW5pdGlvbiIsImJyb3dzZXIiLCJfYnJvd3NlciIsInJlc3VsdCIsInByaW50IiwibG9nZ2VyIl0sIm1hcHBpbmdzIjoiOztBQUFPLFdBQVMsb0JBQW9CQSxhQUFZ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QTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsU0FBQSxhQUFBLFVBQUEsTUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFlBQUEsa0JBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxhQUFBLFdBQUEsaUJBQUEsUUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLG1CQUFBLFVBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxpQkFBQSxhQUFBLGdCQUFBLFVBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSx1QkFBQSxjQUFBLGtCQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsV0FBQSxRQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsUUFBQSxNQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsU0FBQSxVQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsT0FBQSxlQUFBLFVBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFJVCxRQUFBLFVBQUEsVUFBQSxNQUFBLFNBQUEsY0FBQSxNQUFBLFNBQUEsVUFBQTtBQUNFLFVBQUEsZ0JBQUEsVUFBQSxDQUFBLFdBQUEsUUFBQSxzQkFBQSxvQkFBQSxDQUFBLEdBQUE7QUFDRSxlQUFBO0FBQUEsTUFBTztBQUVULFVBQUEsZ0JBQUEsVUFBQSxDQUFBLFlBQUEsY0FBQSxpQkFBQSxDQUFBLEdBQUE7QUFDRSxlQUFBO0FBQUEsTUFBTztBQUVULGFBQUE7QUFBQSxJQUFPO0FBSVQsUUFBQSxNQUFBLFlBQUEsY0FBQSxVQUFBLFNBQUEsTUFBQSxTQUFBLFFBQUE7QUFDRSxVQUFBLE1BQUEsU0FBQSxNQUFBLE1BQUEsU0FBQSxHQUFBLEtBQUEsTUFBQSxTQUFBLEtBQUEsS0FBQSxNQUFBLFNBQUEsVUFBQSxHQUFBO0FBQ0UsZUFBQTtBQUFBLE1BQU87QUFBQSxJQUNUO0FBR0YsV0FBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLGdCQUFBLE1BQUEsVUFBQTtBQUNFLFdBQUEsU0FBQSxLQUFBLENBQUEsWUFBQSxLQUFBLFNBQUEsT0FBQSxDQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsZ0JBQUEsT0FBQSxPQUFBO0FBQ0UsUUFBQSxjQUFBLFNBQUEsTUFBQSxTQUFBLFFBQUE7QUFDQSxRQUFBLE1BQUEsYUFBQSxlQUFBLE1BQUEsT0FBQSxRQUFBO0FBQ0EsUUFBQSxNQUFBLFNBQUEsR0FBQSxFQUFBLFFBQUE7QUFDQSxRQUFBLE1BQUEsWUFBQSxFQUFBLFNBQUEsVUFBQSxFQUFBLFFBQUE7QUFDQSxXQUFBO0FBQUEsRUFDRjtBQU1BLGlCQUFBLGFBQUEsU0FBQTtBQUNFLFVBQUEsU0FBQSxhQUFBO0FBRUEsUUFBQSxjQUFBO0FBQ0EsUUFBQSxrQkFBQTtBQUNBLFVBQUEsa0JBQUEsQ0FBQTtBQUdBLGVBQUEsYUFBQSxRQUFBO0FBQ0UsVUFBQSxDQUFBLFVBQUEsS0FBQTtBQUdBLFVBQUEsVUFBQSxTQUFBLGtCQUFBO0FBQ0Usd0JBQUEsS0FBQSxTQUFBO0FBQ0E7QUFBQSxNQUFBO0FBSUYsWUFBQSxVQUFBLFVBQUEsV0FBQSxPQUFBO0FBQ0EsVUFBQSxRQUFBO0FBQUEsSUFBYTtBQUlmLFFBQUEsZ0JBQUEsU0FBQSxHQUFBO0FBQ0UsWUFBQSxhQUFBLGtCQUFBO0FBRUEsaUJBQUEsYUFBQSxpQkFBQTtBQUNFLGNBQUEsU0FBQSxNQUFBLHFCQUFBLFVBQUEsT0FBQSxTQUFBLFVBQUE7QUFDQSxZQUFB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
content;