var job = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  const definition = defineContentScript({
    matches: ["*://*.linkedin.com/jobs/*"],
    runAt: "document_idle",
    main: () => {
      console.log("🚀 LinkedIn job scraper running...");
      console.log("📍 Current URL:", window.location.href);
      console.log("📍 Page title:", document.title);
      let lastJobId = null;
      let isProcessing = false;
      async function scrapeJobData() {
        const titleEl = document.querySelector(".job-details-jobs-unified-top-card__job-title h1");
        const title = titleEl?.textContent?.trim() || "";
        const companyEl = document.querySelector(".job-details-jobs-unified-top-card__company-name a");
        const company = companyEl?.textContent?.trim() || "";
        const metadataSpans = document.querySelectorAll(
          ".job-details-jobs-unified-top-card__tertiary-description-container .tvm__text"
        );
        const location2 = metadataSpans[0]?.textContent?.trim() || "";
        const posted = metadataSpans[2]?.querySelector("span")?.textContent?.trim() || "";
        const applicants = metadataSpans[4]?.textContent?.trim() || "";
        const typeBadges = Array.from(
          document.querySelectorAll(".job-details-fit-level-preferences button strong")
        ).map((el) => el.textContent?.trim()).filter(Boolean);
        let description = "";
        const oldSelector = document.querySelector(".jobs-description__content");
        description = oldSelector?.textContent.trim() || "";
        const salaryPatterns = [
          /\$[\d,]+(?:\.\d{2})?\s*-\s*\$[\d,]+(?:\.\d{2})?\s*(?:CAD|USD|per hour)?/gi,
          /\$?[\d,]+k\s*-\s*\$?[\d,]+k/gi
        ];
        let salary = "";
        for (const pattern of salaryPatterns) {
          const match = description.match(pattern);
          if (match) {
            salary = match[0];
            break;
          }
        }
        const experiencePattern = /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi;
        const expMatch = description.match(experiencePattern);
        const experience = expMatch ? expMatch[0] : "";
        const jobId = `${company}-${title}`;
        return {
          jobId,
          title,
          company,
          location: location2,
          posted,
          applicants,
          types: typeBadges.join(", "),
          salary,
          experience,
          description
        };
      }
      async function checkAndSendData() {
        if (isProcessing) {
          console.log("⏸️ Already processing, skipping...");
          return;
        }
        const rawJobData = await scrapeJobData();
        const hasValidData = rawJobData.company && rawJobData.title && rawJobData.description && rawJobData.description.length > 100;
        const isNewJob = rawJobData.jobId !== lastJobId;
        if (!hasValidData) {
          console.log("⏳ Incomplete data, waiting for page to load...");
          return;
        }
        if (!isNewJob) {
          console.log("🔄 Same job, no update needed");
          return;
        }
        console.log("New job detected:", rawJobData.jobId);
        isProcessing = true;
        browser.runtime.sendMessage({
          type: "SCRAPING_STARTED"
        }).catch((err) => console.log("Popup may not be open"));
        await new Promise((resolve) => setTimeout(resolve, 100));
        const structuredData = {
          jobData: {
            title: rawJobData.title,
            company: rawJobData.company,
            location: rawJobData.location,
            type: rawJobData.types,
            salary: rawJobData.salary || "N/A",
            posted: rawJobData.posted,
            description: rawJobData.description
          },
          requirements: [],
          skills: []
        };
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (message.action === "start-cover-letter") {
            browser.runtime.sendMessage({
              type: "GENERATE_COVER",
              data: structuredData
            }).then(() => {
              console.log("Data sent to background successfully");
            }).catch((err) => {
              console.error("Failed to send data:", err);
            }).finally(() => {
              lastJobId = rawJobData.jobId;
              isProcessing = false;
            });
          }
        });
        browser.runtime.sendMessage({
          type: "JOB_SCRAPED_DATA",
          data: structuredData
        }).then(() => {
          console.log("Data sent to background successfully");
        }).catch((err) => {
          console.error("Failed to send data:", err);
        }).finally(() => {
          lastJobId = rawJobData.jobId;
          isProcessing = false;
        });
      }
      setTimeout(checkAndSendData, 1500);
      let debounceTimer;
      const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(checkAndSendData, 500);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  });
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
    return `${browser?.runtime?.id}:${"job"}:${eventName}`;
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
      const ctx = new ContentScriptContext("job", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"job"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9iLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi9zcmMvZW50cnlwb2ludHMvam9iLmNvbnRlbnQudHMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiaW50ZXJmYWNlIFNraWxsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBtYXRjaDogbnVtYmVyO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWycqOi8vKi5saW5rZWRpbi5jb20vam9icy8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIG1haW46ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZyhcIvCfmoAgTGlua2VkSW4gam9iIHNjcmFwZXIgcnVubmluZy4uLlwiKTtcbiAgICBjb25zb2xlLmxvZyhcIvCfk40gQ3VycmVudCBVUkw6XCIsIHdpbmRvdy5sb2NhdGlvbi5ocmVmKTtcbiAgICBjb25zb2xlLmxvZyhcIvCfk40gUGFnZSB0aXRsZTpcIiwgZG9jdW1lbnQudGl0bGUpO1xuXG4gICAgbGV0IGxhc3RKb2JJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuXG4gICAgYXN5bmMgZnVuY3Rpb24gc2NyYXBlSm9iRGF0YSgpIHtcbiAgICAgIC8vIEpvYiB0aXRsZVxuICAgICAgY29uc3QgdGl0bGVFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5qb2ItZGV0YWlscy1qb2JzLXVuaWZpZWQtdG9wLWNhcmRfX2pvYi10aXRsZSBoMScpO1xuICAgICAgY29uc3QgdGl0bGUgPSB0aXRsZUVsPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuXG4gICAgICAvLyBDb21wYW55XG4gICAgICBjb25zdCBjb21wYW55RWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuam9iLWRldGFpbHMtam9icy11bmlmaWVkLXRvcC1jYXJkX19jb21wYW55LW5hbWUgYScpO1xuICAgICAgY29uc3QgY29tcGFueSA9IGNvbXBhbnlFbD8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJztcblxuICAgICAgLy8gTWV0YWRhdGFcbiAgICAgIGNvbnN0IG1ldGFkYXRhU3BhbnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFxuICAgICAgICAnLmpvYi1kZXRhaWxzLWpvYnMtdW5pZmllZC10b3AtY2FyZF9fdGVydGlhcnktZGVzY3JpcHRpb24tY29udGFpbmVyIC50dm1fX3RleHQnXG4gICAgICApO1xuICAgICAgY29uc3QgbG9jYXRpb24gPSBtZXRhZGF0YVNwYW5zWzBdPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgY29uc3QgcG9zdGVkID0gbWV0YWRhdGFTcGFuc1syXT8ucXVlcnlTZWxlY3Rvcignc3BhbicpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgY29uc3QgYXBwbGljYW50cyA9IG1ldGFkYXRhU3BhbnNbNF0/LnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG5cbiAgICAgIC8vIEpvYiB0eXBlIGJhZGdlc1xuICAgICAgY29uc3QgdHlwZUJhZGdlcyA9IEFycmF5LmZyb20oXG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5qb2ItZGV0YWlscy1maXQtbGV2ZWwtcHJlZmVyZW5jZXMgYnV0dG9uIHN0cm9uZycpXG4gICAgICApXG4gICAgICAgIC5tYXAoZWwgPT4gZWwudGV4dENvbnRlbnQ/LnRyaW0oKSlcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcblxuICAgICAgLy8gRGVzY3JpcHRpb25cbiAgICAgIGxldCBkZXNjcmlwdGlvbiA9ICcnO1xuICAgICAgY29uc3Qgb2xkU2VsZWN0b3IgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuam9icy1kZXNjcmlwdGlvbl9fY29udGVudCcpO1xuICAgICAgICBkZXNjcmlwdGlvbiA9IG9sZFNlbGVjdG9yPy50ZXh0Q29udGVudC50cmltKCkgfHwgJyc7XG4gICAgICBcbiAgICAgIC8vIFNhbGFyeSBleHRyYWN0aW9uXG4gICAgICBjb25zdCBzYWxhcnlQYXR0ZXJucyA9IFtcbiAgICAgICAgL1xcJFtcXGQsXSsoPzpcXC5cXGR7Mn0pP1xccyotXFxzKlxcJFtcXGQsXSsoPzpcXC5cXGR7Mn0pP1xccyooPzpDQUR8VVNEfHBlciBob3VyKT8vZ2ksXG4gICAgICAgIC9cXCQ/W1xcZCxdK2tcXHMqLVxccypcXCQ/W1xcZCxdK2svZ2ksXG4gICAgICBdO1xuICAgICAgbGV0IHNhbGFyeSA9ICcnO1xuICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHNhbGFyeVBhdHRlcm5zKSB7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gZGVzY3JpcHRpb24ubWF0Y2gocGF0dGVybik7XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgIHNhbGFyeSA9IG1hdGNoWzBdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEV4cGVyaWVuY2UgbGV2ZWxcbiAgICAgIGNvbnN0IGV4cGVyaWVuY2VQYXR0ZXJuID0gLyhcXGQrKVxcKz9cXHMqeWVhcnM/XFxzKyg/Om9mXFxzKyk/ZXhwZXJpZW5jZS9naTtcbiAgICAgIGNvbnN0IGV4cE1hdGNoID0gZGVzY3JpcHRpb24ubWF0Y2goZXhwZXJpZW5jZVBhdHRlcm4pO1xuICAgICAgY29uc3QgZXhwZXJpZW5jZSA9IGV4cE1hdGNoID8gZXhwTWF0Y2hbMF0gOiAnJztcblxuICAgICAgLy8gVW5pcXVlIGpvYiBJRFxuICAgICAgY29uc3Qgam9iSWQgPSBgJHtjb21wYW55fS0ke3RpdGxlfWA7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBqb2JJZCxcbiAgICAgICAgdGl0bGUsXG4gICAgICAgIGNvbXBhbnksXG4gICAgICAgIGxvY2F0aW9uLFxuICAgICAgICBwb3N0ZWQsXG4gICAgICAgIGFwcGxpY2FudHMsXG4gICAgICAgIHR5cGVzOiB0eXBlQmFkZ2VzLmpvaW4oJywgJyksXG4gICAgICAgIHNhbGFyeSxcbiAgICAgICAgZXhwZXJpZW5jZSxcbiAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGFzeW5jIGZ1bmN0aW9uIGNoZWNrQW5kU2VuZERhdGEoKSB7XG4gICAgICBpZiAoaXNQcm9jZXNzaW5nKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCfij7jvuI8gQWxyZWFkeSBwcm9jZXNzaW5nLCBza2lwcGluZy4uLicpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHJhd0pvYkRhdGEgPSBhd2FpdCBzY3JhcGVKb2JEYXRhKCk7XG5cbiAgICAgIC8vIENoZWNrIGlmIHdlIGhhdmUgdmFsaWQgZGF0YSBhbmQgaWYgaXQncyBkaWZmZXJlbnQgZnJvbSBsYXN0IGpvYlxuICAgICAgY29uc3QgaGFzVmFsaWREYXRhID0gcmF3Sm9iRGF0YS5jb21wYW55ICYmIHJhd0pvYkRhdGEudGl0bGUgJiYgcmF3Sm9iRGF0YS5kZXNjcmlwdGlvbiAmJiByYXdKb2JEYXRhLmRlc2NyaXB0aW9uLmxlbmd0aCA+IDEwMDtcbiAgICAgIGNvbnN0IGlzTmV3Sm9iID0gcmF3Sm9iRGF0YS5qb2JJZCAhPT0gbGFzdEpvYklkO1xuXG4gICAgICAvLyBjb25zb2xlLmxvZygn8J+UjSBDaGVjayByZXN1bHRzOicsIHtcbiAgICAgIC8vICAgam9iSWQ6IHJhd0pvYkRhdGEuam9iSWQsXG4gICAgICAvLyAgIGxhc3RKb2JJZDogbGFzdEpvYklkLFxuICAgICAgLy8gICBoYXNWYWxpZERhdGEsXG4gICAgICAvLyAgIGlzTmV3Sm9iLFxuICAgICAgLy8gICBkZXNjTGVuZ3RoOiByYXdKb2JEYXRhLmRlc2NyaXB0aW9uPy5sZW5ndGggfHwgMFxuICAgICAgLy8gfSk7XG5cbiAgICAgIGlmICghaGFzVmFsaWREYXRhKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCfij7MgSW5jb21wbGV0ZSBkYXRhLCB3YWl0aW5nIGZvciBwYWdlIHRvIGxvYWQuLi4nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWlzTmV3Sm9iKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCfwn5SEIFNhbWUgam9iLCBubyB1cGRhdGUgbmVlZGVkJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gTmV3IGpvYiBkZXRlY3RlZCAtIHN0YXJ0IHByb2Nlc3NpbmdcbiAgICAgIGNvbnNvbGUubG9nKCdOZXcgam9iIGRldGVjdGVkOicsIHJhd0pvYkRhdGEuam9iSWQpO1xuICAgICAgaXNQcm9jZXNzaW5nID0gdHJ1ZTtcblxuICAgICAgLy8gU2VuZCBsb2FkaW5nIHN0YXRlIEZJUlNUXG4gICAgICAvLyBjb25zb2xlLmxvZygnU2VuZGluZyBTQ1JBUElOR19TVEFSVEVEJyk7XG4gICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICB0eXBlOiAnU0NSQVBJTkdfU1RBUlRFRCdcbiAgICAgIH0pLmNhdGNoKGVyciA9PiBjb25zb2xlLmxvZygnUG9wdXAgbWF5IG5vdCBiZSBvcGVuJykpO1xuXG4gICAgICAvLyBTbWFsbCBkZWxheSB0byBlbnN1cmUgbG9hZGluZyBzdGF0ZSBpcyBwcm9jZXNzZWRcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDApKTtcblxuICAgICAgLy8gQ3JlYXRlIHRoZSBkYXRhIHN0cnVjdHVyZSB0aGF0IGJhY2tncm91bmQvcG9wdXAgZXhwZWN0c1xuICAgICAgY29uc3Qgc3RydWN0dXJlZERhdGEgPSB7XG4gICAgICAgIGpvYkRhdGE6IHtcbiAgICAgICAgICB0aXRsZTogcmF3Sm9iRGF0YS50aXRsZSxcbiAgICAgICAgICBjb21wYW55OiByYXdKb2JEYXRhLmNvbXBhbnksXG4gICAgICAgICAgbG9jYXRpb246IHJhd0pvYkRhdGEubG9jYXRpb24sXG4gICAgICAgICAgdHlwZTogcmF3Sm9iRGF0YS50eXBlcyxcbiAgICAgICAgICBzYWxhcnk6IHJhd0pvYkRhdGEuc2FsYXJ5IHx8ICdOL0EnLFxuICAgICAgICAgIHBvc3RlZDogcmF3Sm9iRGF0YS5wb3N0ZWQsXG4gICAgICAgICAgZGVzY3JpcHRpb246IHJhd0pvYkRhdGEuZGVzY3JpcHRpb24sXG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVtZW50czogW10sXG4gICAgICAgIHNraWxsczogW10sXG4gICAgICB9O1xuXG4gICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgICAgaWYgKG1lc3NhZ2UuYWN0aW9uID09PSBcInN0YXJ0LWNvdmVyLWxldHRlclwiKSB7XG4gICAgICAgIC8vIFNlbmQgYWN0dWFsIGRhdGFcbiAgICAgICAgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICB0eXBlOiAnR0VORVJBVEVfQ09WRVInLFxuICAgICAgICAgIGRhdGE6IHN0cnVjdHVyZWREYXRhLFxuICAgICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnRGF0YSBzZW50IHRvIGJhY2tncm91bmQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gc2VuZCBkYXRhOicsIGVycik7XG4gICAgICAgIH0pLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgIGxhc3RKb2JJZCA9IHJhd0pvYkRhdGEuam9iSWQ7XG4gICAgICAgICAgaXNQcm9jZXNzaW5nID0gZmFsc2U7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgICAgIC8vIFNlbmQgYWN0dWFsIGRhdGFcbiAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgIHR5cGU6ICdKT0JfU0NSQVBFRF9EQVRBJyxcbiAgICAgICAgZGF0YTogc3RydWN0dXJlZERhdGEsXG4gICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ0RhdGEgc2VudCB0byBiYWNrZ3JvdW5kIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gc2VuZCBkYXRhOicsIGVycik7XG4gICAgICB9KS5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgLy8gQUxXQVlTIHVwZGF0ZSBsYXN0Sm9iSWQgYWZ0ZXIgcHJvY2Vzc2luZywgcmVnYXJkbGVzcyBvZiBzdWNjZXNzXG4gICAgICAgIGxhc3RKb2JJZCA9IHJhd0pvYkRhdGEuam9iSWQ7XG4gICAgICAgIGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gSW5pdGlhbCBzY3JhcGUgd2l0aCBkZWxheVxuICAgIHNldFRpbWVvdXQoY2hlY2tBbmRTZW5kRGF0YSwgMTUwMCk7XG5cbiAgICAvLyBPYnNlcnZlIGZvciBqb2IgY2hhbmdlcyB3aXRoIGRlYm91bmNlXG4gICAgbGV0IGRlYm91bmNlVGltZXI6IGFueTtcbiAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dChkZWJvdW5jZVRpbWVyKTtcbiAgICAgIGRlYm91bmNlVGltZXIgPSBzZXRUaW1lb3V0KGNoZWNrQW5kU2VuZERhdGEsIDUwMCk7XG4gICAgfSk7XG5cbiAgICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHtcbiAgICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICAgIHN1YnRyZWU6IHRydWUsXG4gICAgfSk7XG4gIH0sXG59KTsiLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuZXhwb3J0IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG4gICAgc3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG4gICAgdGhpcy5uZXdVcmwgPSBuZXdVcmw7XG4gICAgdGhpcy5vbGRVcmwgPSBvbGRVcmw7XG4gIH1cbiAgc3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuICByZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG4gIGxldCBpbnRlcnZhbDtcbiAgbGV0IG9sZFVybDtcbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhlIGxvY2F0aW9uIHdhdGNoZXIgaXMgYWN0aXZlbHkgbG9va2luZyBmb3IgVVJMIGNoYW5nZXMuIElmIGl0J3MgYWxyZWFkeSB3YXRjaGluZyxcbiAgICAgKiB0aGlzIGlzIGEgbm9vcC5cbiAgICAgKi9cbiAgICBydW4oKSB7XG4gICAgICBpZiAoaW50ZXJ2YWwgIT0gbnVsbCkgcmV0dXJuO1xuICAgICAgb2xkVXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgIGludGVydmFsID0gY3R4LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbGV0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICAgIGlmIChuZXdVcmwuaHJlZiAhPT0gb2xkVXJsLmhyZWYpIHtcbiAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIG9sZFVybCkpO1xuICAgICAgICAgIG9sZFVybCA9IG5ld1VybDtcbiAgICAgICAgfVxuICAgICAgfSwgMWUzKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHtcbiAgZ2V0VW5pcXVlRXZlbnROYW1lXG59IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcbiAgY29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcbiAgICB0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBpZiAodGhpcy5pc1RvcEZyYW1lKSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cyh7IGlnbm9yZUZpcnN0RXZlbnQ6IHRydWUgfSk7XG4gICAgICB0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG4gICAgfVxuICB9XG4gIHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXG4gICAgXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiXG4gICk7XG4gIGlzVG9wRnJhbWUgPSB3aW5kb3cuc2VsZiA9PT0gd2luZG93LnRvcDtcbiAgYWJvcnRDb250cm9sbGVyO1xuICBsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG4gIHJlY2VpdmVkTWVzc2FnZUlkcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGdldCBzaWduYWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgfVxuICBhYm9ydChyZWFzb24pIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcbiAgfVxuICBnZXQgaXNJbnZhbGlkKCkge1xuICAgIGlmIChicm93c2VyLnJ1bnRpbWUuaWQgPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcbiAgfVxuICBnZXQgaXNWYWxpZCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuICB9XG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG4gICAqIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG4gICAqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG4gICAqIH0pXG4gICAqIC8vIC4uLlxuICAgKiByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG4gICAqL1xuICBvbkludmFsaWRhdGVkKGNiKSB7XG4gICAgdGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgICByZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgfVxuICAvKipcbiAgICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb24gdGhhdCBzaG91bGRuJ3QgcnVuXG4gICAqIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAqICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcbiAgICpcbiAgICogICAvLyAuLi5cbiAgICogfVxuICAgKi9cbiAgYmxvY2soKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogVGltZW91dHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBzZXRUaW1lb3V0YCBmdW5jdGlvbi5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxBbmltYXRpb25GcmFtZWAgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxJZGxlQ2FsbGJhY2tgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJkZWZpbml0aW9uIiwiYnJvd3NlciIsIl9icm93c2VyIiwibG9jYXRpb24iLCJwcmludCIsImxvZ2dlciJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLG9CQUFvQkEsYUFBWTtBQUM5QyxXQUFPQTtBQUFBLEVBQ1Q7QUNETyxRQUFNQyxZQUFVLFdBQVcsU0FBUyxTQUFTLEtBQ2hELFdBQVcsVUFDWCxXQUFXO0FDRlIsUUFBTSxVQUFVQztBQ0l2QixRQUFBLGFBQUEsb0JBQUE7QUFBQSxJQUFtQyxTQUFBLENBQUEsMkJBQUE7QUFBQSxJ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LGFBQU87QUFBQSxJQUNUO0FBQUEsSUFDQSxpQkFBaUIsUUFBUSxNQUFNLFNBQVMsU0FBUztBQUMvQyxVQUFJLFNBQVMsc0JBQXNCO0FBQ2pDLFlBQUksS0FBSyxRQUFTLE1BQUssZ0JBQWdCLElBQUc7QUFBQSxNQUM1QztBQUNBLGFBQU87QUFBQSxRQUNMLEtBQUssV0FBVyxNQUFNLElBQUksbUJBQW1CLElBQUksSUFBSTtBQUFBLFFBQ3JEO0FBQUEsUUFDQTtBQUFBLFVBQ0UsR0FBRztBQUFBLFVBQ0gsUUFBUSxLQUFLO0FBQUEsUUFDckI7QUFBQSxNQUNBO0FBQUEsSUFDRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLQSxvQkFBb0I7QUFDbEIsV0FBSyxNQUFNLG9DQUFvQztBQUMvQ0MsZUFBTztBQUFBLFFBQ0wsbUJBQW1CLEtBQUssaUJBQWlCO0FBQUEsTUFDL0M7QUFBQSxJQUNFO0FBQUEsSUFDQSxpQkFBaUI7QUFDZixhQUFPO0FBQUEsUUFDTDtBQUFBLFVBQ0UsTUFBTSxxQkFBcUI7QUFBQSxVQUMzQixtQkFBbUIsS0FBSztBQUFBLFVBQ3hCLFdBQVcsS0FBSyxPQUFNLEVBQUcsU0FBUyxFQUFFLEVBQUUsTUFBTSxDQUFDO0FBQUEsUUFDckQ7QUFBQSxRQUNNO0FBQUEsTUFDTjtBQUFBLElBQ0U7QUFBQSxJQUNBLHlCQUF5QixPQUFPO0FBQzlCLFlBQU0sdUJBQXVCLE1BQU0sTUFBTSxTQUFTLHFCQUFxQjtBQUN2RSxZQUFNLHNCQUFzQixNQUFNLE1BQU0sc0JBQXNCLEtBQUs7QUFDbkUsWUFBTSxpQkFBaUIsQ0FBQyxLQUFLLG1CQUFtQixJQUFJLE1BQU0sTUFBTSxTQUFTO0FBQ3pFLGFBQU8sd0JBQXdCLHVCQUF1QjtBQUFBLElBQ3hEO0FBQUEsSUFDQSxzQkFBc0IsU0FBUztBQUM3QixVQUFJLFVBQVU7QUFDZCxZQUFNLEtBQUssQ0FBQyxVQUFVO0FBQ3BCLFlBQUksS0FBSyx5QkFBeUIsS0FBSyxHQUFHO0FBQ3hDLGVBQUssbUJBQW1CLElBQUksTUFBTSxLQUFLLFNBQVM7QUFDaEQsZ0JBQU0sV0FBVztBQUNqQixvQkFBVTtBQUNWLGNBQUksWUFBWSxTQUFTLGlCQUFrQjtBQUMzQyxlQUFLLGtCQUFpQjtBQUFBLFFBQ3hCO0FBQUEsTUFDRjtBQUNBLHVCQUFpQixXQUFXLEVBQUU7QUFDOUIsV0FBSyxjQUFjLE1BQU0sb0JBQW9CLFdBQVcsRUFBRSxDQUFDO0FBQUEsSUFDN0Q7QUFBQSxFQUNGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMSwyLDQsNSw2LDddfQ==
job;