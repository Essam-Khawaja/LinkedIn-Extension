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
    } catch (error) {
      console.error("Auto-fill error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
    }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9zcmMvZW50cnlwb2ludHMvY29udGVudC50cyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiaW1wb3J0IHR5cGUgIFVzZXJQcm9maWxlICBmcm9tICdAL2xpYi90eXBlcy91c2VyJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFtcbiAgXSxcbiAgXG4gIGFzeW5jIG1haW4oKSB7XG4gICAgY29uc29sZS5sb2coJ0F1dG8tZmlsbCBzY3JpcHQgbG9hZGVkJyk7XG5jaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UsIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gIGlmIChtZXNzYWdlLmFjdGlvbiA9PT0gXCJzdGFydC1hdXRvLWZpbGxcIikge1xuICAgIGNvbnNvbGUubG9nKFwiUmVjZWl2ZWQgYXV0by1maWxsIHJlcXVlc3RcIik7XG5cbiAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7IHR5cGU6IFwiR0VUX1BST0ZJTEVcIiB9LCAocmVzcG9uc2UpID0+IHtcbiAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCLinYwgQmFja2dyb3VuZCBlcnJvcjpcIiwgY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc29sZS5sb2coXCLinIUgR290IHByb2ZpbGU6XCIsIHJlc3BvbnNlKTtcbiAgaGFuZGxlQXV0b0ZpbGxDbGljayhyZXNwb25zZS5wcm9maWxlKVxufSk7XG4gICAgfVxuICB9KTtcbiAgfVxufSk7XG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUF1dG9GaWxsQ2xpY2socHJvZmlsZTogYW55KSB7XG4gIC8vIGNvbnN0IGJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2ItY29waWxvdC1hdXRvZmlsbC1idG4nKTtcbiAgLy8gaWYgKCFidXR0b24pIHJldHVybjtcbiAgXG4gIHRyeSB7XG4gICAgLy8gU2hvdyBsb2FkaW5nIHN0YXRlXG4gICAgLy8gYnV0dG9uLnRleHRDb250ZW50ID0gJ+KPsyBGaWxsaW5nLi4uJztcbiAgICAvLyBidXR0b24uc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgICBcbiAgICAvLyBHZXQgdXNlciBwcm9maWxlXG4gICAgLy8gbGV0IHByb2ZpbGU7XG4gICAgLy8gY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyBhY3Rpb246IFwiR0VUX1BST0ZJTEVcIiB9LCAocmVzcG9uc2UpID0+IHtcbiAgICAvLyAgICAgcHJvZmlsZSA9IHJlc3BvbnNlPy5wcm9maWxlO1xuICAgIC8vIH0pOyAgICBcbiAgICAvLyBpZiAoIXByb2ZpbGUpIHtcbiAgICAvLyAgIGFsZXJ0KCdQbGVhc2Ugc2V0IHVwIHlvdXIgcHJvZmlsZSBmaXJzdCBpbiB0aGUgZXh0ZW5zaW9uIHBvcHVwIScpO1xuICAgIC8vICAgcmV0dXJuO1xuICAgIC8vIH1cbiAgICBcbiAgICAvLyBEbyB0aGUgYXV0by1maWxsXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXV0b0ZpbGxGb3JtKHByb2ZpbGUpO1xuICAgIFxuICAgIC8vIFNob3cgc3VjY2Vzc1xuICAgIC8vIHNob3dTdWNjZXNzTWVzc2FnZShyZXN1bHQuZmlsbGVkLCByZXN1bHQuYWlBbnN3ZXJlZCk7XG4gICAgXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignQXV0by1maWxsIGVycm9yOicsIGVycm9yKTtcbiAgICBhbGVydCgnU29tZXRoaW5nIHdlbnQgd3JvbmcuIFBsZWFzZSB0cnkgYWdhaW4uJyk7XG4gIH0gZmluYWxseSB7XG4gICAgLy8gUmVzZXQgYnV0dG9uXG4gICAgLy8gaWYgKGJ1dHRvbikge1xuICAgIC8vICAgYnV0dG9uLnRleHRDb250ZW50ID0gJ/CfpJYgQXV0by1maWxsIEFwcGxpY2F0aW9uJztcbiAgICAvLyAgIGJ1dHRvbi5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ2F1dG8nO1xuICAgIC8vIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBzaG93U3VjY2Vzc01lc3NhZ2UoZmlsbGVkQ291bnQ6IG51bWJlciwgYWlDb3VudDogbnVtYmVyKSB7XG4gIGNvbnN0IG5vdGlmaWNhdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBub3RpZmljYXRpb24uc3R5bGUuY3NzVGV4dCA9IGBcbiAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgdG9wOiAyMHB4O1xuICAgIHJpZ2h0OiAyMHB4O1xuICAgIHotaW5kZXg6IDEwMDAxO1xuICAgIHBhZGRpbmc6IDE2cHggMjRweDtcbiAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgYm94LXNoYWRvdzogMCA0cHggMTJweCByZ2JhKDAsMCwwLDAuMTUpO1xuICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgYDtcbiAgXG4gIG5vdGlmaWNhdGlvbi5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTJweDtcIj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiZm9udC1zaXplOiAyNHB4O1wiPuKchTwvc3Bhbj5cbiAgICAgIDxkaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXdlaWdodDogNjAwOyBjb2xvcjogIzEwYjk4MTtcIj5BdXRvLWZpbGwgQ29tcGxldGUhPC9kaXY+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjogIzZiNzI4MDsgZm9udC1zaXplOiAxMnB4OyBtYXJnaW4tdG9wOiA0cHg7XCI+XG4gICAgICAgICAgRmlsbGVkICR7ZmlsbGVkQ291bnR9IGZpZWxkcyR7YWlDb3VudCA+IDAgPyBgICsgJHthaUNvdW50fSBBSSBhbnN3ZXJzYCA6ICcnfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICBgO1xuICBcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub3RpZmljYXRpb24pO1xuICBcbiAgc2V0VGltZW91dCgoKSA9PiBub3RpZmljYXRpb24ucmVtb3ZlKCksIDMwMDApO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRklFTEQgREVURUNUSU9OXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5pbnRlcmZhY2UgRmllbGRJbmZvIHtcbiAgZWxlbWVudDogSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBIVE1MU2VsZWN0RWxlbWVudDtcbiAgdHlwZTogc3RyaW5nIHwgbnVsbDtcbiAgbGFiZWw6IHN0cmluZztcbiAgcmVxdWlyZWQ6IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIGdldEFsbEZpZWxkcygpOiBGaWVsZEluZm9bXSB7XG4gIGNvbnN0IGZpZWxkczogRmllbGRJbmZvW10gPSBbXTtcbiAgXG4gIC8vIEdldCBhbGwgZmlsbGFibGUgZWxlbWVudHNcbiAgY29uc3QgaW5wdXRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MSW5wdXRFbGVtZW50PihcbiAgICAnaW5wdXQ6bm90KFt0eXBlPVwiaGlkZGVuXCJdKTpub3QoW3R5cGU9XCJzdWJtaXRcIl0pOm5vdChbdHlwZT1cImJ1dHRvblwiXSk6bm90KFt0eXBlPVwiaW1hZ2VcIl0pJ1xuICApO1xuICBjb25zdCB0ZXh0YXJlYXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxUZXh0QXJlYUVsZW1lbnQ+KCd0ZXh0YXJlYScpO1xuICBjb25zdCBzZWxlY3RzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MU2VsZWN0RWxlbWVudD4oJ3NlbGVjdCcpO1xuICBcbiAgWy4uLmlucHV0cywgLi4udGV4dGFyZWFzLCAuLi5zZWxlY3RzXS5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgIGNvbnN0IGxhYmVsID0gZ2V0RmllbGRMYWJlbChlbGVtZW50KTtcbiAgICBjb25zdCB0eXBlID0gZGV0ZWN0RmllbGRUeXBlKGVsZW1lbnQsIGxhYmVsKTtcbiAgICBjb25zdCByZXF1aXJlZCA9IGlzRmllbGRSZXF1aXJlZChlbGVtZW50LCBsYWJlbCk7XG4gICAgXG4gICAgZmllbGRzLnB1c2goe1xuICAgICAgZWxlbWVudCxcbiAgICAgIHR5cGUsXG4gICAgICBsYWJlbCxcbiAgICAgIHJlcXVpcmVkXG4gICAgfSk7XG4gIH0pO1xuXG4gIGNvbnNvbGUubG9nKGZpZWxkcyk7XG4gIFxuICByZXR1cm4gZmllbGRzO1xufVxuXG5mdW5jdGlvbiBnZXRGaWVsZExhYmVsKGZpZWxkOiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIC8vIE1ldGhvZCAxOiA8bGFiZWwgZm9yPVwiaWRcIj5cbiAgaWYgKGZpZWxkLmlkKSB7XG4gICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBsYWJlbFtmb3I9XCIke2ZpZWxkLmlkfVwiXWApO1xuICAgIGlmIChsYWJlbD8udGV4dENvbnRlbnQpIHJldHVybiBsYWJlbC50ZXh0Q29udGVudC50cmltKCk7XG4gIH1cbiAgXG4gIC8vIE1ldGhvZCAyOiBQYXJlbnQgPGxhYmVsPlxuICBjb25zdCBwYXJlbnRMYWJlbCA9IGZpZWxkLmNsb3Nlc3QoJ2xhYmVsJyk7XG4gIGlmIChwYXJlbnRMYWJlbD8udGV4dENvbnRlbnQpIHJldHVybiBwYXJlbnRMYWJlbC50ZXh0Q29udGVudC50cmltKCk7XG4gIFxuICAvLyBNZXRob2QgMzogUHJldmlvdXMgc2libGluZ1xuICBsZXQgcHJldiA9IGZpZWxkLnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XG4gIHdoaWxlIChwcmV2KSB7XG4gICAgaWYgKHByZXYudGFnTmFtZSA9PT0gJ0xBQkVMJyAmJiBwcmV2LnRleHRDb250ZW50KSB7XG4gICAgICByZXR1cm4gcHJldi50ZXh0Q29udGVudC50cmltKCk7XG4gICAgfVxuICAgIHByZXYgPSBwcmV2LnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XG4gIH1cbiAgXG4gIC8vIE1ldGhvZCA0OiBMb29rIGluIHBhcmVudCBjb250YWluZXJcbiAgY29uc3QgcGFyZW50ID0gZmllbGQuY2xvc2VzdCgnZGl2LCBmaWVsZHNldCwgbGknKTtcbiAgaWYgKHBhcmVudCkge1xuICAgIGNvbnN0IGxhYmVsRWwgPSBwYXJlbnQucXVlcnlTZWxlY3RvcignbGFiZWwsIGxlZ2VuZCcpO1xuICAgIGlmIChsYWJlbEVsPy50ZXh0Q29udGVudCkgcmV0dXJuIGxhYmVsRWwudGV4dENvbnRlbnQudHJpbSgpO1xuICB9XG4gIFxuICAvLyBNZXRob2QgNTogYXJpYS1sYWJlbFxuICBjb25zdCBhcmlhTGFiZWwgPSBmaWVsZC5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKTtcbiAgaWYgKGFyaWFMYWJlbCkgcmV0dXJuIGFyaWFMYWJlbDtcbiAgXG4gIC8vIE1ldGhvZCA2OiBwbGFjZWhvbGRlciBhcyBsYXN0IHJlc29ydFxuICBpZiAoJ3BsYWNlaG9sZGVyJyBpbiBmaWVsZCkge1xuICAgIGNvbnN0IGlucHV0RWxlbWVudCA9IGZpZWxkIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50O1xuICAgIGlmIChpbnB1dEVsZW1lbnQucGxhY2Vob2xkZXIpIHtcbiAgICAgIHJldHVybiBpbnB1dEVsZW1lbnQucGxhY2Vob2xkZXI7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4gJyc7XG59XG5cbmZ1bmN0aW9uIGRldGVjdEZpZWxkVHlwZShcbiAgZmllbGQ6IEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50IHwgSFRNTFNlbGVjdEVsZW1lbnQsXG4gIGxhYmVsOiBzdHJpbmdcbik6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBzZWFyY2hUZXh0ID0gbGFiZWwudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgZmllbGROYW1lID0gZmllbGQubmFtZS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBmaWVsZElkID0gZmllbGQuaWQudG9Mb3dlckNhc2UoKTtcbiAgXG4gIC8vIENvbWJpbmUgYWxsIHNlYXJjaCBzb3VyY2VzXG4gIGNvbnN0IHNlYXJjaEluID0gYCR7c2VhcmNoVGV4dH0gJHtmaWVsZE5hbWV9ICR7ZmllbGRJZH1gO1xuICBcbiAgLy8gQ2hlY2sgZm9yIGVhY2ggZmllbGQgdHlwZVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2ZpcnN0IG5hbWUnLCAnZmlyc3RuYW1lJywgJ2dpdmVuIG5hbWUnLCAnZm5hbWUnXSkpIHtcbiAgICByZXR1cm4gJ2ZpcnN0TmFtZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydsYXN0IG5hbWUnLCAnbGFzdG5hbWUnLCAnc3VybmFtZScsICdmYW1pbHkgbmFtZScsICdsbmFtZSddKSkge1xuICAgIHJldHVybiAnbGFzdE5hbWUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnZnVsbCBuYW1lJywgJ3lvdXIgbmFtZSddKSAmJiAhc2VhcmNoSW4uaW5jbHVkZXMoJ2ZpcnN0JykgJiYgIXNlYXJjaEluLmluY2x1ZGVzKCdsYXN0JykpIHtcbiAgICByZXR1cm4gJ2Z1bGxOYW1lJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2VtYWlsJywgJ2UtbWFpbCddKSkge1xuICAgIHJldHVybiAnZW1haWwnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsncGhvbmUnLCAndGVsZXBob25lJywgJ21vYmlsZScsICdjZWxsJ10pKSB7XG4gICAgcmV0dXJuICdwaG9uZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydsaW5rZWRpbicsICdsaW5rZWRpbiBwcm9maWxlJ10pKSB7XG4gICAgcmV0dXJuICdsaW5rZWRpbic7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWydwb3J0Zm9saW8nLCAnd2Vic2l0ZScsICdwZXJzb25hbCBzaXRlJywgJ2dpdGh1YiddKSkge1xuICAgIHJldHVybiAncG9ydGZvbGlvJztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ2N1cnJlbnQgY29tcGFueScsICdlbXBsb3llciddKSkge1xuICAgIHJldHVybiAnY3VycmVudENvbXBhbnknO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnY3VycmVudCB0aXRsZScsICdqb2IgdGl0bGUnLCAnY3VycmVudCByb2xlJywgJ3Bvc2l0aW9uJ10pKSB7XG4gICAgcmV0dXJuICdjdXJyZW50VGl0bGUnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsneWVhcnMgb2YgZXhwZXJpZW5jZScsICdleHBlcmllbmNlJywgJ3llYXJzIGV4cGVyaWVuY2UnXSkpIHtcbiAgICByZXR1cm4gJ2V4cGVyaWVuY2UnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnYWRkcmVzcycsICdzdHJlZXQnXSkpIHtcbiAgICByZXR1cm4gJ2FkZHJlc3MnO1xuICB9XG4gIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnY2l0eScsICd0b3duJ10pKSB7XG4gICAgcmV0dXJuICdjaXR5JztcbiAgfVxuICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3N0YXRlJywgJ3Byb3ZpbmNlJ10pKSB7XG4gICAgcmV0dXJuICdzdGF0ZSc7XG4gIH1cbiAgaWYgKG1hdGNoZXNLZXl3b3JkcyhzZWFyY2hJbiwgWyd6aXAnLCAncG9zdGFsIGNvZGUnLCAncG9zdGNvZGUnXSkpIHtcbiAgICByZXR1cm4gJ3ppcCc7XG4gIH1cbiAgXG4gIC8vIENoZWNrYm94ZXNcbiAgaWYgKCd0eXBlJyBpbiBmaWVsZCAmJiAoZmllbGQudHlwZSA9PT0gJ2NoZWNrYm94JyB8fCBmaWVsZC50eXBlID09PSAncmFkaW8nKSkge1xuICAgIGlmIChtYXRjaGVzS2V5d29yZHMoc2VhcmNoSW4sIFsnc3BvbnNvcicsICd2aXNhJywgJ2F1dGhvcml6ZWQgdG8gd29yaycsICd3b3JrIGF1dGhvcml6YXRpb24nXSkpIHtcbiAgICAgIHJldHVybiAnc3BvbnNvcnNoaXAnO1xuICAgIH1cbiAgICBpZiAobWF0Y2hlc0tleXdvcmRzKHNlYXJjaEluLCBbJ3JlbG9jYXRlJywgJ3JlbG9jYXRpb24nLCAnd2lsbGluZyB0byBtb3ZlJ10pKSB7XG4gICAgICByZXR1cm4gJ3JlbG9jYXRpb24nO1xuICAgIH1cbiAgICByZXR1cm4gJ2NoZWNrYm94LXVua25vd24nO1xuICB9XG4gIFxuICAvLyBDdXN0b20gcXVlc3Rpb25zICh0ZXh0YXJlYXMgd2l0aCBxdWVzdGlvbi1saWtlIGxhYmVscylcbiAgaWYgKGZpZWxkLnRhZ05hbWUgPT09ICdURVhUQVJFQScgfHwgKCd0eXBlJyBpbiBmaWVsZCAmJiBmaWVsZC50eXBlID09PSAndGV4dCcpKSB7XG4gICAgaWYgKGxhYmVsLmxlbmd0aCA+IDMwIHx8IGxhYmVsLmluY2x1ZGVzKCc/JykgfHwgbGFiZWwuaW5jbHVkZXMoJ3doeScpIHx8IGxhYmVsLmluY2x1ZGVzKCdkZXNjcmliZScpKSB7XG4gICAgICByZXR1cm4gJ2N1c3RvbVF1ZXN0aW9uJztcbiAgICB9XG4gIH1cbiAgXG4gIHJldHVybiBudWxsOyAvLyBVbmtub3duIGZpZWxkIHR5cGVcbn1cblxuZnVuY3Rpb24gbWF0Y2hlc0tleXdvcmRzKHRleHQ6IHN0cmluZywga2V5d29yZHM6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG4gIHJldHVybiBrZXl3b3Jkcy5zb21lKGtleXdvcmQgPT4gdGV4dC5pbmNsdWRlcyhrZXl3b3JkKSk7XG59XG5cbmZ1bmN0aW9uIGlzRmllbGRSZXF1aXJlZChmaWVsZDogSFRNTEVsZW1lbnQsIGxhYmVsOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgaWYgKCdyZXF1aXJlZCcgaW4gZmllbGQgJiYgZmllbGQucmVxdWlyZWQpIHJldHVybiB0cnVlO1xuICBpZiAoZmllbGQuZ2V0QXR0cmlidXRlKCdhcmlhLXJlcXVpcmVkJykgPT09ICd0cnVlJykgcmV0dXJuIHRydWU7XG4gIGlmIChsYWJlbC5pbmNsdWRlcygnKicpKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGxhYmVsLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3JlcXVpcmVkJykpIHJldHVybiB0cnVlO1xuICByZXR1cm4gZmFsc2U7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBGT1JNIEZJTExJTkdcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmFzeW5jIGZ1bmN0aW9uIGF1dG9GaWxsRm9ybShwcm9maWxlOiBVc2VyUHJvZmlsZSkge1xuICBjb25zdCBmaWVsZHMgPSBnZXRBbGxGaWVsZHMoKTtcbiAgXG4gIGxldCBmaWxsZWRDb3VudCA9IDA7XG4gIGxldCBhaUFuc3dlcmVkQ291bnQgPSAwO1xuICBjb25zdCBjdXN0b21RdWVzdGlvbnM6IEZpZWxkSW5mb1tdID0gW107XG4gIFxuICAvLyBGaXJzdCBwYXNzOiBmaWxsIGFsbCBzdGFuZGFyZCBmaWVsZHNcbiAgZm9yIChjb25zdCBmaWVsZEluZm8gb2YgZmllbGRzKSB7XG4gICAgaWYgKCFmaWVsZEluZm8udHlwZSkgY29udGludWU7XG4gICAgXG4gICAgLy8gQ29sbGVjdCBjdXN0b20gcXVlc3Rpb25zIGZvciBBSSBsYXRlclxuICAgIGlmIChmaWVsZEluZm8udHlwZSA9PT0gJ2N1c3RvbVF1ZXN0aW9uJykge1xuICAgICAgY3VzdG9tUXVlc3Rpb25zLnB1c2goZmllbGRJbmZvKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBcbiAgICAvLyBGaWxsIHN0YW5kYXJkIGZpZWxkc1xuICAgIGNvbnN0IHN1Y2Nlc3MgPSBmaWxsRmllbGQoZmllbGRJbmZvLCBwcm9maWxlKTtcbiAgICBpZiAoc3VjY2VzcykgZmlsbGVkQ291bnQrKztcbiAgfVxuICBcbiAgLy8gU2Vjb25kIHBhc3M6IHVzZSBBSSBmb3IgY3VzdG9tIHF1ZXN0aW9uc1xuICBpZiAoY3VzdG9tUXVlc3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBqb2JDb250ZXh0ID0gZXh0cmFjdEpvYkNvbnRleHQoKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGZpZWxkSW5mbyBvZiBjdXN0b21RdWVzdGlvbnMpIHtcbiAgICAgIGNvbnN0IGFuc3dlciA9IGF3YWl0IGFuc3dlckN1c3RvbVF1ZXN0aW9uKGZpZWxkSW5mby5sYWJlbCwgcHJvZmlsZSwgam9iQ29udGV4dCk7XG4gICAgICBpZiAoYW5zd2VyKSB7XG4gICAgICAgIGZpbGxUZXh0RmllbGQoZmllbGRJbmZvLmVsZW1lbnQgYXMgSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQsIGFuc3dlcik7XG4gICAgICAgIGFpQW5zd2VyZWRDb3VudCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHtcbiAgICBmaWxsZWQ6IGZpbGxlZENvdW50LFxuICAgIGFpQW5zd2VyZWQ6IGFpQW5zd2VyZWRDb3VudFxuICB9O1xufVxuXG5mdW5jdGlvbiBmaWxsRmllbGQoZmllbGRJbmZvOiBGaWVsZEluZm8sIHByb2ZpbGU6IFVzZXJQcm9maWxlKTogYm9vbGVhbiB7XG4gIGNvbnN0IHsgZWxlbWVudCwgdHlwZSB9ID0gZmllbGRJbmZvO1xuICBcbiAgLy8gR2V0IHRoZSB2YWx1ZSB0byBmaWxsXG4gIGNvbnN0IHZhbHVlID0gZ2V0VmFsdWVGb3JGaWVsZFR5cGUodHlwZSwgcHJvZmlsZSk7XG4gIGlmICghdmFsdWUpIHJldHVybiBmYWxzZTtcbiAgXG4gIC8vIEZpbGwgYmFzZWQgb24gZWxlbWVudCB0eXBlXG4gIGlmIChlbGVtZW50LnRhZ05hbWUgPT09ICdTRUxFQ1QnKSB7XG4gICAgcmV0dXJuIGZpbGxTZWxlY3QoZWxlbWVudCBhcyBIVE1MU2VsZWN0RWxlbWVudCwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKCd0eXBlJyBpbiBlbGVtZW50ICYmIGVsZW1lbnQudHlwZSA9PT0gJ2NoZWNrYm94Jykge1xuICAgIHJldHVybiBmaWxsQ2hlY2tib3goZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoJ3R5cGUnIGluIGVsZW1lbnQgJiYgZWxlbWVudC50eXBlID09PSAncmFkaW8nKSB7XG4gICAgcmV0dXJuIGZpbGxSYWRpbyhlbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQsIHZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmlsbFRleHRGaWVsZChlbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50LCB2YWx1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VmFsdWVGb3JGaWVsZFR5cGUodHlwZTogc3RyaW5nIHwgbnVsbCwgcHJvZmlsZTogVXNlclByb2ZpbGUpOiBhbnkge1xuICBpZiAoIXR5cGUpIHJldHVybiBudWxsO1xuICBcbiAgY29uc3QgdmFsdWVNYXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gICAgZmlyc3ROYW1lOiBwcm9maWxlLmZpcnN0TmFtZSxcbiAgICBsYXN0TmFtZTogcHJvZmlsZS5sYXN0TmFtZSxcbiAgICBmdWxsTmFtZTogYCR7cHJvZmlsZS5maXJzdE5hbWV9ICR7cHJvZmlsZS5sYXN0TmFtZX1gLFxuICAgIGVtYWlsOiBwcm9maWxlLmVtYWlsLFxuICAgIHBob25lOiBwcm9maWxlLnBob25lLFxuICAgIGxpbmtlZGluOiBwcm9maWxlLmxpbmtlZGluLFxuICAgIHBvcnRmb2xpbzogcHJvZmlsZS5wb3J0Zm9saW8sXG4gICAgYWRkcmVzczogcHJvZmlsZS5hZGRyZXNzLFxuICAgIGNpdHk6IHByb2ZpbGUuY2l0eSxcbiAgICBzdGF0ZTogcHJvZmlsZS5zdGF0ZSxcbiAgICB6aXA6IHByb2ZpbGUuemlwLFxuICAgIGN1cnJlbnRDb21wYW55OiBwcm9maWxlLmN1cnJlbnRDb21wYW55LFxuICAgIGN1cnJlbnRUaXRsZTogcHJvZmlsZS5jdXJyZW50VGl0bGUsXG4gICAgZXhwZXJpZW5jZTogcHJvZmlsZS55ZWFyc0V4cGVyaWVuY2UsXG4gICAgc3BvbnNvcnNoaXA6IHByb2ZpbGUubmVlZHNTcG9uc29yc2hpcCA/ICd5ZXMnIDogJ25vJyxcbiAgICByZWxvY2F0aW9uOiBwcm9maWxlLndpbGxpbmdUb1JlbG9jYXRlID8gJ3llcycgOiAnbm8nLFxuICB9O1xuICBcbiAgcmV0dXJuIHZhbHVlTWFwW3R5cGVdO1xufVxuXG5mdW5jdGlvbiBmaWxsVGV4dEZpZWxkKFxuICBmaWVsZDogSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQsXG4gIHZhbHVlOiBzdHJpbmdcbik6IGJvb2xlYW4ge1xuICBmaWVsZC52YWx1ZSA9IHZhbHVlO1xuICB0cmlnZ2VySW5wdXRFdmVudHMoZmllbGQpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbFNlbGVjdChzZWxlY3Q6IEhUTUxTZWxlY3RFbGVtZW50LCB2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIGNvbnN0IG9wdGlvbnMgPSBBcnJheS5mcm9tKHNlbGVjdC5vcHRpb25zKTtcbiAgXG4gIC8vIFRyeSBleGFjdCBtYXRjaFxuICBsZXQgbWF0Y2ggPSBvcHRpb25zLmZpbmQob3B0ID0+IFxuICAgIG9wdC52YWx1ZSA9PT0gdmFsdWUgfHwgb3B0LnRleHQgPT09IHZhbHVlXG4gICk7XG4gIFxuICAvLyBUcnkgZnV6enkgbWF0Y2hcbiAgaWYgKCFtYXRjaCkge1xuICAgIGNvbnN0IHZhbHVlTG93ZXIgPSB2YWx1ZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCk7XG4gICAgbWF0Y2ggPSBvcHRpb25zLmZpbmQob3B0ID0+IFxuICAgICAgb3B0LnZhbHVlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModmFsdWVMb3dlcikgfHxcbiAgICAgIG9wdC50ZXh0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModmFsdWVMb3dlcilcbiAgICApO1xuICB9XG4gIFxuICAvLyBUcnkgbnVtZXJpYyBtYXRjaCAoZm9yIHllYXJzIG9mIGV4cGVyaWVuY2UpXG4gIGlmICghbWF0Y2ggJiYgIWlzTmFOKHZhbHVlKSkge1xuICAgIG1hdGNoID0gb3B0aW9ucy5maW5kKG9wdCA9PiBvcHQudmFsdWUgPT09IHZhbHVlLnRvU3RyaW5nKCkpO1xuICB9XG4gIFxuICBpZiAobWF0Y2gpIHtcbiAgICBzZWxlY3QudmFsdWUgPSBtYXRjaC52YWx1ZTtcbiAgICB0cmlnZ2VySW5wdXRFdmVudHMoc2VsZWN0KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBmaWxsQ2hlY2tib3goY2hlY2tib3g6IEhUTUxJbnB1dEVsZW1lbnQsIHZhbHVlOiBhbnkpOiBib29sZWFuIHtcbiAgY29uc3Qgc2hvdWxkQ2hlY2sgPSB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gJ3llcycgfHwgdmFsdWUgPT09ICd0cnVlJztcbiAgY2hlY2tib3guY2hlY2tlZCA9IHNob3VsZENoZWNrO1xuICB0cmlnZ2VySW5wdXRFdmVudHMoY2hlY2tib3gpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbFJhZGlvKHJhZGlvOiBIVE1MSW5wdXRFbGVtZW50LCB2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIGNvbnN0IHJhZGlvcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTElucHV0RWxlbWVudD4oYGlucHV0W25hbWU9XCIke3JhZGlvLm5hbWV9XCJdYCk7XG4gIGNvbnN0IHZhbHVlTG93ZXIgPSB2YWx1ZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCk7XG4gIFxuICBjb25zdCBtYXRjaCA9IEFycmF5LmZyb20ocmFkaW9zKS5maW5kKHIgPT4ge1xuICAgIGNvbnN0IGxhYmVsID0gZ2V0RmllbGRMYWJlbChyKS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiBsYWJlbC5pbmNsdWRlcyh2YWx1ZUxvd2VyKSB8fCByLnZhbHVlLnRvTG93ZXJDYXNlKCkgPT09IHZhbHVlTG93ZXI7XG4gIH0pO1xuICBcbiAgaWYgKG1hdGNoKSB7XG4gICAgbWF0Y2guY2hlY2tlZCA9IHRydWU7XG4gICAgdHJpZ2dlcklucHV0RXZlbnRzKG1hdGNoKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiB0cmlnZ2VySW5wdXRFdmVudHMoZWxlbWVudDogSFRNTEVsZW1lbnQpIHtcbiAgLy8gVHJpZ2dlciBtdWx0aXBsZSBldmVudHMgdG8gZW5zdXJlIHRoZSBzaXRlIHJlY29nbml6ZXMgdGhlIGNoYW5nZVxuICBjb25zdCBldmVudHMgPSBbXG4gICAgbmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSxcbiAgICBuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSxcbiAgICBuZXcgRXZlbnQoJ2JsdXInLCB7IGJ1YmJsZXM6IHRydWUgfSksXG4gIF07XG4gIFxuICBldmVudHMuZm9yRWFjaChldmVudCA9PiBlbGVtZW50LmRpc3BhdGNoRXZlbnQoZXZlbnQpKTtcbiAgXG4gIC8vIFNwZWNpYWwgaGFuZGxpbmcgZm9yIFJlYWN0XG4gIGlmICgndmFsdWUnIGluIGVsZW1lbnQpIHtcbiAgICBjb25zdCBuYXRpdmVJbnB1dFZhbHVlU2V0dGVyID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihcbiAgICAgIHdpbmRvdy5IVE1MSW5wdXRFbGVtZW50LnByb3RvdHlwZSxcbiAgICAgICd2YWx1ZSdcbiAgICApPy5zZXQ7XG4gICAgXG4gICAgaWYgKG5hdGl2ZUlucHV0VmFsdWVTZXR0ZXIpIHtcbiAgICAgIG5hdGl2ZUlucHV0VmFsdWVTZXR0ZXIuY2FsbChlbGVtZW50LCAoZWxlbWVudCBhcyBhbnkpLnZhbHVlKTtcbiAgICAgIGVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEFJIElOVEVHUkFUSU9OXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBleHRyYWN0Sm9iQ29udGV4dCgpIHtcbiAgY29uc3QgdGl0bGUgPSBcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdoMScpPy50ZXh0Q29udGVudCB8fFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tjbGFzcyo9XCJqb2ItdGl0bGVcIl0nKT8udGV4dENvbnRlbnQgfHxcbiAgICAndGhpcyBwb3NpdGlvbic7XG4gICAgXG4gIGNvbnN0IGNvbXBhbnkgPSBcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbY2xhc3MqPVwiY29tcGFueVwiXScpPy50ZXh0Q29udGVudCB8fFxuICAgICd0aGlzIGNvbXBhbnknO1xuXG4gIHJldHVybiB7XG4gICAgdGl0bGU6IHRpdGxlLnRyaW0oKSxcbiAgICBjb21wYW55OiBjb21wYW55LnRyaW0oKVxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBhbnN3ZXJDdXN0b21RdWVzdGlvbihcbiAgcXVlc3Rpb246IHN0cmluZyxcbiAgcHJvZmlsZTogVXNlclByb2ZpbGUsXG4gIGpvYkNvbnRleHQ6IHsgdGl0bGU6IHN0cmluZzsgY29tcGFueTogc3RyaW5nIH1cbik6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCBwcm9tcHQgPSBgWW91IGFyZSBoZWxwaW5nIHNvbWVvbmUgZmlsbCBvdXQgYSBqb2IgYXBwbGljYXRpb24uIEFuc3dlciB0aGlzIHF1ZXN0aW9uIHByb2Zlc3Npb25hbGx5IGFuZCBjb25jaXNlbHkgKG1heCAxMDAgd29yZHMpOlxuXG5RdWVzdGlvbjogXCIke3F1ZXN0aW9ufVwiXG5cbkpvYjogJHtqb2JDb250ZXh0LnRpdGxlfSBhdCAke2pvYkNvbnRleHQuY29tcGFueX1cblxuQ2FuZGlkYXRlIEJhY2tncm91bmQ6XG4tIE5hbWU6ICR7cHJvZmlsZS5maXJzdE5hbWV9ICR7cHJvZmlsZS5sYXN0TmFtZX1cbi0gQ3VycmVudCBSb2xlOiAke3Byb2ZpbGUuY3VycmVudFRpdGxlIHx8ICdOb3Qgc3BlY2lmaWVkJ31cbi0gRXhwZXJpZW5jZTogJHtwcm9maWxlLnllYXJzRXhwZXJpZW5jZSB8fCAnTm90IHNwZWNpZmllZCd9IHllYXJzXG5cblByb3ZpZGUgb25seSB0aGUgYW5zd2VyLCBubyBwcmVhbWJsZSBvciBleHBsYW5hdGlvbjpgO1xuXG4gIHRyeSB7XG4gICAgLy8gQHRzLWlnbm9yZSAtIENocm9tZSBBSSBBUElcbiAgICAvLyBpZiAoIXdpbmRvdy5haT8ubGFuZ3VhZ2VNb2RlbCkge1xuICAgIC8vICAgY29uc29sZS53YXJuKCdDaHJvbWUgQUkgbm90IGF2YWlsYWJsZScpO1xuICAgIC8vICAgcmV0dXJuIG51bGw7XG4gICAgLy8gfVxuXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IGF2YWlsYWJpbGl0eSA9IGF3YWl0IExhbmd1YWdlTW9kZWwuYXZhaWxhYmlsaXR5KCk7XG5cbiAgICBpZiAoYXZhaWxhYmlsaXR5ID09PSAnbm8nKSB7XG4gICAgICBjb25zb2xlLndhcm4oXCLinYwgR2VtaW5pIE5hbm8gbm90IGF2YWlsYWJsZVwiKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChhdmFpbGFiaWxpdHkgPT09ICdhZnRlci1kb3dubG9hZCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwi4o+zIFRyaWdnZXJpbmcgR2VtaW5pIE5hbm8gZG93bmxvYWQuLi5cIik7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBMYW5ndWFnZU1vZGVsLmNyZWF0ZSgpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc2Vzc2lvbi5wcm9tcHQocHJvbXB0KTtcbiAgICBjb25zb2xlLmxvZyhcIvCfpJYgUmF3IEFJIFJlc3BvbnNlOlwiLCByZXN1bHQpO1xuXG4gICAgICBsZXQgY2xlYW5lZFJlc3VsdCA9IHJlc3VsdC50cmltKCk7XG4gICAgXG4gICAgLy8gLy8gUmVtb3ZlIGBgYGpzb24gYW5kIGBgYCBpZiBwcmVzZW50XG4gICAgLy8gaWYgKGNsZWFuZWRSZXN1bHQuc3RhcnRzV2l0aCgnYGBganNvbicpKSB7XG4gICAgLy8gICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBganNvblxccyovLCAnJykucmVwbGFjZSgvXFxzKmBgYCQvLCAnJyk7XG4gICAgLy8gfSBlbHNlIGlmIChjbGVhbmVkUmVzdWx0LnN0YXJ0c1dpdGgoJ2BgYCcpKSB7XG4gICAgLy8gICBjbGVhbmVkUmVzdWx0ID0gY2xlYW5lZFJlc3VsdC5yZXBsYWNlKC9eYGBgXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqYGBgJC8sICcnKTtcbiAgICAvLyB9XG4gICAgXG4gICAgLy8gY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShjbGVhbmVkUmVzdWx0KTtcbiAgICBcbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICByZXR1cm4gY2xlYW5lZFJlc3VsdDtcblxuICAgIFxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICAvLyBjb25zdCBzZXNzaW9uID0gYXdhaXQgd2luZG93LmFpLmxhbmd1YWdlTW9kZWwuY3JlYXRlKCk7XG4gICAgLy8gY29uc3QgYW5zd2VyID0gYXdhaXQgc2Vzc2lvbi5wcm9tcHQocHJvbXB0KTtcbiAgICAvLyByZXR1cm4gYW5zd2VyLnRyaW0oKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdBSSBhbnN3ZXJpbmcgZmFpbGVkOicsIGVycm9yKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG4gIGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICBtZXRob2QoYFt3eHRdICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbiAgfVxufVxuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IHtcbiAgZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcbiAgbG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuICB3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcbiAgZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEludGVydmFscyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNsZWFySW50ZXJ2YWxgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsQW5pbWF0aW9uRnJhbWVgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsSWRsZUNhbGxiYWNrYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSwgb3B0aW9ucyk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICBhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuICAgIGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcbiAgICB9XG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/LihcbiAgICAgIHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLFxuICAgICAgaGFuZGxlcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgc2lnbmFsOiB0aGlzLnNpZ25hbFxuICAgICAgfVxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cbiAgICovXG4gIG5vdGlmeUludmFsaWRhdGVkKCkge1xuICAgIHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuICAgIGxvZ2dlci5kZWJ1ZyhcbiAgICAgIGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYFxuICAgICk7XG4gIH1cbiAgc3RvcE9sZFNjcmlwdHMoKSB7XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKFxuICAgICAge1xuICAgICAgICB0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG4gICAgICAgIGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuICAgICAgICBtZXNzYWdlSWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpXG4gICAgICB9LFxuICAgICAgXCIqXCJcbiAgICApO1xuICB9XG4gIHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuICAgIGNvbnN0IGlzU2NyaXB0U3RhcnRlZEV2ZW50ID0gZXZlbnQuZGF0YT8udHlwZSA9PT0gQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFO1xuICAgIGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kYXRhPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcbiAgICBjb25zdCBpc05vdER1cGxpY2F0ZSA9ICF0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5oYXMoZXZlbnQuZGF0YT8ubWVzc2FnZUlkKTtcbiAgICByZXR1cm4gaXNTY3JpcHRTdGFydGVkRXZlbnQgJiYgaXNTYW1lQ29udGVudFNjcmlwdCAmJiBpc05vdER1cGxpY2F0ZTtcbiAgfVxuICBsaXN0ZW5Gb3JOZXdlclNjcmlwdHMob3B0aW9ucykge1xuICAgIGxldCBpc0ZpcnN0ID0gdHJ1ZTtcbiAgICBjb25zdCBjYiA9IChldmVudCkgPT4ge1xuICAgICAgaWYgKHRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkge1xuICAgICAgICB0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5hZGQoZXZlbnQuZGF0YS5tZXNzYWdlSWQpO1xuICAgICAgICBjb25zdCB3YXNGaXJzdCA9IGlzRmlyc3Q7XG4gICAgICAgIGlzRmlyc3QgPSBmYWxzZTtcbiAgICAgICAgaWYgKHdhc0ZpcnN0ICYmIG9wdGlvbnM/Lmlnbm9yZUZpcnN0RXZlbnQpIHJldHVybjtcbiAgICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiByZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYikpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiZGVmaW5pdGlvbiIsInJlc3VsdCIsImJyb3dzZXIiLCJfYnJvd3NlciIsInByaW50IiwibG9nZ2VyIl0s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QUdBLFVBQUEsV0FBQSxHQUFBLFVBQUEsSUFBQSxTQUFBLElBQUEsT0FBQTtBQUdBLFFBQUEsZ0JBQUEsVUFBQSxDQUFBLGNBQUEsYUFBQSxjQUFBLE9BQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxhQUFBLFlBQUEsV0FBQSxlQUFBLE9BQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxhQUFBLFdBQUEsQ0FBQSxLQUFBLENBQUEsU0FBQSxTQUFBLE9BQUEsS0FBQSxDQUFBLFNBQUEsU0FBQSxNQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFNBQUEsUUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFNBQUEsYUFBQSxVQUFBLE1BQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxZQUFBLGtCQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsYUFBQSxXQUFBLGlCQUFBLFFBQUEsQ0FBQSxHQUFBO0FBQ0UsYUFBQTtBQUFBLElBQU87QUFFVCxRQUFBLGdCQUFBLFVBQUEsQ0FBQSxtQkFBQSxVQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsaUJBQUEsYUFBQSxnQkFBQSxVQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBRVQsUUFBQSxnQkFBQSxVQUFBLENBQUEsdUJBQUEsY0FBQSxrQkFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFdBQUEsUUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFFBQUEsTUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLFNBQUEsVUFBQSxDQUFBLEdBQUE7QUFDRSxhQUFBO0FBQUEsSUFBTztBQUVULFFBQUEsZ0JBQUEsVUFBQSxDQUFBLE9BQUEsZUFBQSxVQUFBLENBQUEsR0FBQTtBQUNFLGFBQUE7QUFBQSxJQUFPO0FBSVQsUUFBQSxVQUFBLFVBQUEsTUFBQSxTQUFBLGNBQUEsTUFBQSxTQUFBLFVBQUE7QUFDRSxVQUFBLGdCQUFBLFVBQUEsQ0FBQSxXQUFBLFFBQUEsc0JBQUEsb0JBQUEsQ0FBQSxHQUFBO0FBQ0UsZUFBQTtBQUFBLE1BQU87QUFFVCxVQUFBLGdCQUFBLFVBQUEsQ0FBQSxZQUFBLGNBQUEsaUJBQUEsQ0FBQSxHQUFBO0FBQ0UsZUFBQTtBQUFBLE1BQU87QUFFVCxhQUFBO0FBQUEsSUFBTztBQUlULFFBQUEsTUFBQSxZQUFBLGNBQUEsVUFBQSxTQUFBLE1BQUEsU0FBQSxRQUFBO0FBQ0UsVUFBQSxNQUFBLFNBQUEsTUFBQSxNQUFBLFNBQUEsR0FBQSxLQUFBLE1BQUEsU0FBQSxLQUFBLEtBQUEsTUFBQSxTQUFBLFVBQUEsR0FBQTtBQUNFLGVBQUE7QUFBQSxNQUFPO0FBQUEsSUFDVDtBQUdGLFdBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxnQkFBQSxNQUFBLFVBQUE7QUFDRSxXQUFBLFNBQUEsS0FBQSxDQUFBLFlBQUEsS0FBQSxTQUFBLE9BQUEsQ0FBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLGdCQUFBLE9BQUEsT0FBQTtBQUNFLFFBQUEsY0FBQSxTQUFBLE1BQUEsU0FBQSxRQUFBO0FBQ0EsUUFBQSxNQUFBLGFBQUEsZUFBQSxNQUFBLE9BQUEsUUFBQTtBQUNBLFFBQUEsTUFBQSxTQUFBLEdBQUEsRUFBQSxRQUFBO0FBQ0EsUUFBQSxNQUFBLFlBQUEsRUFBQSxTQUFBLFVBQUEsRUFBQSxRQUFBO0FBQ0EsV0FBQTtBQUFBLEVBQ0Y7QUFNQSxpQkFBQSxhQUFBLFNBQUE7QUFDRSxVQUFBLFNBQUEsYUFBQTtBQUVBLFFBQUEsY0FBQTtBQUNBLFFBQUEsa0JBQUE7QUFDQSxVQUFBLGtCQUFBLENBQUE7QUFHQSxlQUFBLGFBQUEsUUFBQTtBQUNFLFVBQUEsQ0FBQSxVQUFBLEtBQUE7QUFHQSxVQUFBLFVBQUEsU0FBQSxrQkFBQTtBQUNFLHdCQUFBLEtBQUEsU0FBQTtBQUNBO0FBQUEsTUFBQTtBQUlGLFlBQUEsVUFBQSxVQUFBLFdBQUEsT0FBQTtBQUNBLFVBQUEsUUFBQTtBQUFBLElBQWE7QUFJZixRQUFBLGdCQUFBLFNBQUEsR0FBQTtBQUNFLFlBQUEsYUFBQSxrQkFBQTtBQUVBLGlCQUFBLGFBQUEsaUJBQUE7QUFDRSxjQUFBLFNBQUEsTUFBQSxxQkFBQSxVQUFBLE9BQUEsU0FBQSxVQUFBO0FBQ0EsWUFBQSxRQUFBO0FBQ0Usd0JBQUEsVUFBQSxTQUFBLE1BQUE7QUFDQTtBQUFBLFFBQUE7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUdGLFdBQUE7QUFBQSxNQUFPLFFBQUE7QUFBQSxNQUNHLFlBQUE7QUFBQSxJQUNJO0FBQUEsRUFFaEI7QUFFQSxXQUFBLFVBQUEsV0FBQSxTQUFBO0FBQ0UsVUFBQSxFQUFBLFNBQUEsS0FBQSxJQUFBO0FBR0EsVUFBQSxRQUFBLHFCQUFBLE1BQUEsT0FBQTtBQUNBLFFBQUEsQ0FBQSxNQUFBLFFBQUE7QUFHQSxRQUFBLFFBQUEsWUFBQSxVQUFBO0FBQ0UsYUFBQSxXQUFBLFNBQUEsS0FBQTtBQUFBLElBQXFELFdBQUEsVUFBQSxXQUFBLFFBQUEsU0FBQSxZQUFBO0FBRXJELGFBQUEsYUFBQSxTQUFBLEtBQUE7QUFBQSxJQUFzRCxXQUFBLFVBQUEsV0FBQSxRQUFBLFNBQUEsU0FBQTtBQUV0RCxhQUFBLFVBQUEsU0FBQSxLQUFBO0FBQUEsSUFBbUQsT0FBQTtBQUVuRCxhQUFBLGNBQUEsU0FBQSxLQUFBO0FBQUEsSUFBNkU7QUFBQSxFQUVqRjtBQUVBLFdBQUEscUJBQUEsTUFBQSxTQUFBO0FBQ0UsUUFBQSxDQUFBLEtBQUEsUUFBQTtBQUVBLFVBQUEsV0FBQTtBQUFBLE1BQXNDLFdBQUEsUUFBQTtBQUFBLE1BQ2pCLFVBQUEsUUFBQTtBQUFBLE1BQ0QsVUFBQSxHQUFBLFFBQUEsU0FBQSxJQUFBLFFBQUEsUUFBQTtBQUFBLE1BQ2dDLE9BQUEsUUFBQTtBQUFBLE1BQ25DLE9BQUEsUUFBQTtBQUFBLE1BQ0EsVUFBQSxRQUFBO0FBQUEsTUFDRyxXQUFBLFFBQUE7QUFBQSxNQUNDLFNBQUEsUUFBQTtBQUFBLE1BQ0YsTUFBQSxRQUFBO0FBQUEsTUFDSCxPQUFBLFFBQUE7QUFBQSxNQUNDLEtBQUEsUUFBQTtBQUFBLE1BQ0YsZ0JBQUEsUUFBQTtBQUFBLE1BQ1csY0FBQSxRQUFBO0FBQUEsTUFDRixZQUFBLFFBQUE7QUFBQSxNQUNGLGFBQUEsUUFBQSxtQkFBQSxRQUFBO0FBQUEsTUFDNEIsWUFBQSxRQUFBLG9CQUFBLFFBQUE7QUFBQSxJQUNBO0FBR2xELFdBQUEsU0FBQSxJQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsY0FBQSxPQUFBLE9BQUE7QUFJRSxVQUFBLFFBQUE7QUFDQSx1QkFBQSxLQUFBO0FBQ0EsV0FBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLFdBQUEsUUFBQSxPQUFBO0FBQ0UsVUFBQSxVQUFBLE1BQUEsS0FBQSxPQUFBLE9BQUE7QUFHQSxRQUFBLFFBQUEsUUFBQTtBQUFBLE1BQW9CLENBQUEsUUFBQSxJQUFBLFVBQUEsU0FBQSxJQUFBLFNBQUE7QUFBQSxJQUNrQjtBQUl0QyxRQUFBLENBQUEsT0FBQTtBQUNFLFlBQUEsYUFBQSxNQUFBLFNBQUEsRUFBQSxZQUFBO0FBQ0EsY0FBQSxRQUFBO0FBQUEsUUFBZ0IsQ0FBQSxRQUFBLElBQUEsTUFBQSxZQUFBLEVBQUEsU0FBQSxVQUFBLEtBQUEsSUFBQSxLQUFBLFlBQUEsRUFBQSxTQUFBLFVBQUE7QUFBQSxNQUU0QjtBQUFBLElBQzVDO0FBSUYsUUFBQSxDQUFBLFNBQUEsQ0FBQSxNQUFBLEtBQUEsR0FBQTtBQUNFLGNBQUEsUUFBQSxLQUFBLENBQUEsUUFBQSxJQUFBLFVBQUEsTUFBQSxVQUFBO0FBQUEsSUFBMEQ7QUFHNUQsUUFBQSxPQUFBO0FBQ0UsYUFBQSxRQUFBLE1BQUE7QUFDQSx5QkFBQSxNQUFBO0FBQ0EsYUFBQTtBQUFBLElBQU87QUFHVCxXQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsYUFBQSxVQUFBLE9BQUE7QUFDRSxVQUFBLGNBQUEsVUFBQSxRQUFBLFVBQUEsU0FBQSxVQUFBO0FBQ0EsYUFBQSxVQUFBO0FBQ0EsdUJBQUEsUUFBQTtBQUNBLFdBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxVQUFBLE9BQUEsT0FBQTtBQUNFLFVBQUEsU0FBQSxTQUFBLGlCQUFBLGVBQUEsTUFBQSxJQUFBLElBQUE7QUFDQSxVQUFBLGFBQUEsTUFBQSxTQUFBLEVBQUEsWUFBQTtBQUVBLFVBQUEsUUFBQSxNQUFBLEtBQUEsTUFBQSxFQUFBLEtBQUEsQ0FBQSxNQUFBO0FBQ0UsWUFBQSxRQUFBLGNBQUEsQ0FBQSxFQUFBLFlBQUE7QUFDQSxhQUFBLE1BQUEsU0FBQSxVQUFBLEtBQUEsRUFBQSxNQUFBLFlBQUEsTUFBQTtBQUFBLElBQStELENBQUE7QUFHakUsUUFBQSxPQUFBO0FBQ0UsWUFBQSxVQUFBO0FBQ0EseUJBQUEsS0FBQTtBQUNBLGFBQUE7QUFBQSxJQUFPO0FBR1QsV0FBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLG1CQUFBLFNBQUE7QUFFRSxVQUFBLFNBQUE7QUFBQSxNQUFlLElBQUEsTUFBQSxTQUFBLEVBQUEsU0FBQSxLQUFBLENBQUE7QUFBQSxNQUN1QixJQUFBLE1BQUEsVUFBQSxFQUFBLFNBQUEsS0FBQSxDQUFBO0FBQUEsTUFDQyxJQUFBLE1BQUEsUUFBQSxFQUFBLFNBQUEsS0FBQSxDQUFBO0FBQUEsSUFDRjtBQUdyQyxXQUFBLFFBQUEsQ0FBQSxVQUFBLFFBQUEsY0FBQSxLQUFBLENBQUE7QUFHQSxRQUFBLFdBQUEsU0FBQTtBQUNFLFlBQUEseUJBQUEsT0FBQTtBQUFBLFFBQXNDLE9BQUEsaUJBQUE7QUFBQSxRQUNaO0FBQUEsTUFDeEIsR0FBQTtBQUdGLFVBQUEsd0JBQUE7QUFDRSwrQkFBQSxLQUFBLFNBQUEsUUFBQSxLQUFBO0FBQ0EsZ0JBQUEsY0FBQSxJQUFBLE1BQUEsU0FBQSxFQUFBLFNBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxNQUEyRDtBQUFBLElBQzdEO0FBQUEsRUFFSjtBQU1BLFdBQUEsb0JBQUE7QUFDRSxVQUFBLFFBQUEsU0FBQSxjQUFBLElBQUEsR0FBQSxlQUFBLFNBQUEsY0FBQSxzQkFBQSxHQUFBLGVBQUE7QUFLQSxVQUFBLFVBQUEsU0FBQSxjQUFBLG9CQUFBLEdBQUEsZUFBQTtBQUlBLFdBQUE7QUFBQSxNQUFPLE9BQUEsTUFBQSxLQUFBO0FBQUEsTUFDYSxTQUFBLFFBQUEsS0FBQTtBQUFBLElBQ0k7QUFBQSxFQUUxQjtBQUVBLGlCQUFBLHFCQUFBLFVBQUEsU0FBQSxZQUFBO0FBS0UsVUFBQSxTQUFBO0FBQUE7QUFBQSxhQUFlLFFBQUE7QUFBQTtBQUFBLE9BRUksV0FBQSxLQUFBLE9BQUEsV0FBQSxPQUFBO0FBQUE7QUFBQTtBQUFBLFVBRTJCLFFBQUEsU0FBQSxJQUFBLFFBQUEsUUFBQTtBQUFBLGtCQUdELFFBQUEsZ0JBQUEsZUFBQTtBQUFBLGdCQUNVLFFBQUEsbUJBQUEsZUFBQTtBQUFBO0FBQUE7QUFLdkQsUUFBQTtBQVFFLFlBQUEsZUFBQSxNQUFBLGNBQUEsYUFBQTtBQUVBLFVBQUEsaUJBQUEsTUFBQTtBQUNFLGdCQUFBLEtBQUEsNkJBQUE7QUFDQSxlQUFBO0FBQUEsTUFBTztBQUdULFVBQUEsaUJBQUEsa0JBQUE7QUFDRSxnQkFBQSxJQUFBLHNDQUFBO0FBRUEsY0FBQSxjQUFBLE9BQUE7QUFDQSxlQUFBO0FBQUEsTUFBTztBQUlULFlBQUEsVUFBQSxNQUFBLGNBQUEsT0FBQTtBQUVBLFlBQUFBLFVBQUEsTUFBQSxRQUFBLE9BQUEsTUFBQTtBQUNBLGNBQUEsSUFBQSx1QkFBQUEsT0FBQTtBQUVFLFVBQUEsZ0JBQUFBLFFBQUEsS0FBQTtBQVdGLGNBQUEsUUFBQTtBQUNBLGFBQUE7QUFBQSxJQUFPLFNBQUEsT0FBQTtB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QUFvQixVQUFVLFNBQVM7QUFDckMsWUFBTSxLQUFLLG9CQUFvQixJQUFJLFNBQVM7QUFDMUMsWUFBSSxDQUFDLEtBQUssT0FBTyxRQUFTLFVBQVMsR0FBRyxJQUFJO0FBQUEsTUFDNUMsR0FBRyxPQUFPO0FBQ1YsV0FBSyxjQUFjLE1BQU0sbUJBQW1CLEVBQUUsQ0FBQztBQUMvQyxhQUFPO0FBQUEsSUFDVDtBQUFBLElBQ0EsaUJBQWlCLFFBQVEsTUFBTSxTQUFTLFNBQVM7QUFDL0MsVUFBSSxTQUFTLHNCQUFzQjtBQUNqQyxZQUFJLEtBQUssUUFBUyxNQUFLLGdCQUFnQixJQUFHO0FBQUEsTUFDNUM7QUFDQSxhQUFPO0FBQUEsUUFDTCxLQUFLLFdBQVcsTUFBTSxJQUFJLG1CQUFtQixJQUFJLElBQUk7QUFBQSxRQUNyRDtBQUFBLFFBQ0E7QUFBQSxVQUNFLEdBQUc7QUFBQSxVQUNILFFBQVEsS0FBSztBQUFBLFFBQ3JCO0FBQUEsTUFDQTtBQUFBLElBQ0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBS0Esb0JBQW9CO0FBQ2xCLFdBQUssTUFBTSxvQ0FBb0M7QUFDL0NDLGVBQU87QUFBQSxRQUNMLG1CQUFtQixLQUFLLGlCQUFpQjtBQUFBLE1BQy9DO0FBQUEsSUFDRTtBQUFBLElBQ0EsaUJBQWlCO0FBQ2YsYUFBTztBQUFBLFFBQ0w7QUFBQSxVQUNFLE1BQU0scUJBQXFCO0FBQUEsVUFDM0IsbUJBQW1CLEtBQUs7QUFBQSxVQUN4QixXQUFXLEtBQUssT0FBTSxFQUFHLFNBQVMsRUFBRSxFQUFFLE1BQU0sQ0FBQztBQUFBLFFBQ3JEO0FBQUEsUUFDTTtBQUFBLE1BQ047QUFBQSxJQUNFO0FBQUEsSUFDQSx5QkFBeUIsT0FBTztBQUM5QixZQUFNLHVCQUF1QixNQUFNLE1BQU0sU0FBUyxxQkFBcUI7QUFDdkUsWUFBTSxzQkFBc0IsTUFBTSxNQUFNLHNCQUFzQixLQUFLO0FBQ25FLFlBQU0saUJBQWlCLENBQUMsS0FBSyxtQkFBbUIsSUFBSSxNQUFNLE1BQU0sU0FBUztBQUN6RSxhQUFPLHdCQUF3Qix1QkFBdUI7QUFBQSxJQUN4RDtBQUFBLElBQ0Esc0JBQXNCLFNBQVM7QUFDN0IsVUFBSSxVQUFVO0FBQ2QsWUFBTSxLQUFLLENBQUMsVUFBVTtBQUNwQixZQUFJLEtBQUsseUJBQXlCLEtBQUssR0FBRztBQUN4QyxlQUFLLG1CQUFtQixJQUFJLE1BQU0sS0FBSyxTQUFTO0FBQ2hELGdCQUFNLFdBQVc7QUFDakIsb0JBQVU7QUFDVixjQUFJLFlBQVksU0FBUyxpQkFBa0I7QUFDM0MsZUFBSyxrQkFBaUI7QUFBQSxRQUN4QjtBQUFBLE1BQ0Y7QUFDQSx1QkFBaUIsV0FBVyxFQUFFO0FBQzlCLFdBQUssY0FBYyxNQUFNLG9CQUFvQixXQUFXLEVBQUUsQ0FBQztBQUFBLElBQzdEO0FBQUEsRUFDRjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDIsMyw0LDUsNiw3XX0=
content;