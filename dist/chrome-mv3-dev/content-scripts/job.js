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
          return;
        }
        const rawJobData = await scrapeJobData();
        if (rawJobData.company && rawJobData.title && rawJobData.jobId !== lastJobId) {
          isProcessing = true;
          lastJobId = rawJobData.jobId;
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
          browser.runtime.sendMessage({
            type: "SCRAPED_DATA",
            data: structuredData
          }).then(() => {
            console.log("Data sent to background");
          }).catch((err) => {
            console.error("Failed to send data:", err);
          }).finally(() => {
            isProcessing = false;
          });
        }
      }
      setTimeout(checkAndSendData, 1500);
      let debounceTimer;
      const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(checkAndSendData, 800);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9iLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi9zcmMvZW50cnlwb2ludHMvam9iLmNvbnRlbnQudHMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiaW50ZXJmYWNlIFNraWxsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBtYXRjaDogbnVtYmVyO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWycqOi8vKi5saW5rZWRpbi5jb20vam9icy8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIG1haW46ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZyhcIvCfmoAgTGlua2VkSW4gam9iIHNjcmFwZXIgcnVubmluZy4uLlwiKTtcbiAgICBjb25zb2xlLmxvZyhcIvCfk40gQ3VycmVudCBVUkw6XCIsIHdpbmRvdy5sb2NhdGlvbi5ocmVmKTtcbiAgICBjb25zb2xlLmxvZyhcIvCfk40gUGFnZSB0aXRsZTpcIiwgZG9jdW1lbnQudGl0bGUpO1xuXG4gICAgbGV0IGxhc3RKb2JJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuXG4gICAgYXN5bmMgZnVuY3Rpb24gc2NyYXBlSm9iRGF0YSgpIHtcbiAgICAgIC8vIEpvYiB0aXRsZVxuICAgICAgY29uc3QgdGl0bGVFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5qb2ItZGV0YWlscy1qb2JzLXVuaWZpZWQtdG9wLWNhcmRfX2pvYi10aXRsZSBoMScpO1xuICAgICAgY29uc3QgdGl0bGUgPSB0aXRsZUVsPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuXG4gICAgICAvLyBDb21wYW55XG4gICAgICBjb25zdCBjb21wYW55RWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuam9iLWRldGFpbHMtam9icy11bmlmaWVkLXRvcC1jYXJkX19jb21wYW55LW5hbWUgYScpO1xuICAgICAgY29uc3QgY29tcGFueSA9IGNvbXBhbnlFbD8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJztcblxuICAgICAgLy8gTWV0YWRhdGFcbiAgICAgIGNvbnN0IG1ldGFkYXRhU3BhbnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFxuICAgICAgICAnLmpvYi1kZXRhaWxzLWpvYnMtdW5pZmllZC10b3AtY2FyZF9fdGVydGlhcnktZGVzY3JpcHRpb24tY29udGFpbmVyIC50dm1fX3RleHQnXG4gICAgICApO1xuICAgICAgY29uc3QgbG9jYXRpb24gPSBtZXRhZGF0YVNwYW5zWzBdPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgY29uc3QgcG9zdGVkID0gbWV0YWRhdGFTcGFuc1syXT8ucXVlcnlTZWxlY3Rvcignc3BhbicpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgY29uc3QgYXBwbGljYW50cyA9IG1ldGFkYXRhU3BhbnNbNF0/LnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG5cbiAgICAgIC8vIEpvYiB0eXBlIGJhZGdlc1xuICAgICAgY29uc3QgdHlwZUJhZGdlcyA9IEFycmF5LmZyb20oXG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5qb2ItZGV0YWlscy1maXQtbGV2ZWwtcHJlZmVyZW5jZXMgYnV0dG9uIHN0cm9uZycpXG4gICAgICApXG4gICAgICAgIC5tYXAoZWwgPT4gZWwudGV4dENvbnRlbnQ/LnRyaW0oKSlcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcblxuICAgICAgLy8gRGVzY3JpcHRpb25cbiAgICAgIGxldCBkZXNjcmlwdGlvbiA9ICcnO1xuICAgICAgY29uc3Qgb2xkU2VsZWN0b3IgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuam9icy1kZXNjcmlwdGlvbl9fY29udGVudCcpO1xuICAgICAgICBkZXNjcmlwdGlvbiA9IG9sZFNlbGVjdG9yPy50ZXh0Q29udGVudC50cmltKCkgfHwgJyc7XG4gICAgICBcbiAgICAgIC8vIFNhbGFyeSBleHRyYWN0aW9uXG4gICAgICBjb25zdCBzYWxhcnlQYXR0ZXJucyA9IFtcbiAgICAgICAgL1xcJFtcXGQsXSsoPzpcXC5cXGR7Mn0pP1xccyotXFxzKlxcJFtcXGQsXSsoPzpcXC5cXGR7Mn0pP1xccyooPzpDQUR8VVNEfHBlciBob3VyKT8vZ2ksXG4gICAgICAgIC9cXCQ/W1xcZCxdK2tcXHMqLVxccypcXCQ/W1xcZCxdK2svZ2ksXG4gICAgICBdO1xuICAgICAgbGV0IHNhbGFyeSA9ICcnO1xuICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHNhbGFyeVBhdHRlcm5zKSB7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gZGVzY3JpcHRpb24ubWF0Y2gocGF0dGVybik7XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgIHNhbGFyeSA9IG1hdGNoWzBdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEV4cGVyaWVuY2UgbGV2ZWxcbiAgICAgIGNvbnN0IGV4cGVyaWVuY2VQYXR0ZXJuID0gLyhcXGQrKVxcKz9cXHMqeWVhcnM/XFxzKyg/Om9mXFxzKyk/ZXhwZXJpZW5jZS9naTtcbiAgICAgIGNvbnN0IGV4cE1hdGNoID0gZGVzY3JpcHRpb24ubWF0Y2goZXhwZXJpZW5jZVBhdHRlcm4pO1xuICAgICAgY29uc3QgZXhwZXJpZW5jZSA9IGV4cE1hdGNoID8gZXhwTWF0Y2hbMF0gOiAnJztcblxuICAgICAgLy8gVW5pcXVlIGpvYiBJRFxuICAgICAgY29uc3Qgam9iSWQgPSBgJHtjb21wYW55fS0ke3RpdGxlfWA7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBqb2JJZCxcbiAgICAgICAgdGl0bGUsXG4gICAgICAgIGNvbXBhbnksXG4gICAgICAgIGxvY2F0aW9uLFxuICAgICAgICBwb3N0ZWQsXG4gICAgICAgIGFwcGxpY2FudHMsXG4gICAgICAgIHR5cGVzOiB0eXBlQmFkZ2VzLmpvaW4oJywgJyksXG4gICAgICAgIHNhbGFyeSxcbiAgICAgICAgZXhwZXJpZW5jZSxcbiAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGFzeW5jIGZ1bmN0aW9uIGNoZWNrQW5kU2VuZERhdGEoKSB7XG4gICAgICBpZiAoaXNQcm9jZXNzaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgcmF3Sm9iRGF0YSA9IGF3YWl0IHNjcmFwZUpvYkRhdGEoKTtcblxuICAgICAgaWYgKHJhd0pvYkRhdGEuY29tcGFueSAmJiByYXdKb2JEYXRhLnRpdGxlICYmIHJhd0pvYkRhdGEuam9iSWQgIT09IGxhc3RKb2JJZCkge1xuICAgICAgICBpc1Byb2Nlc3NpbmcgPSB0cnVlO1xuICAgICAgICBsYXN0Sm9iSWQgPSByYXdKb2JEYXRhLmpvYklkO1xuXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdTY3JhcGVkIGpvYiBkYXRhOicsIHtcbiAgICAgICAgLy8gICB0aXRsZTogcmF3Sm9iRGF0YS50aXRsZSxcbiAgICAgICAgLy8gICBjb21wYW55OiByYXdKb2JEYXRhLmNvbXBhbnksXG4gICAgICAgIC8vICAgaGFzRGVzY3JpcHRpb246ICEhcmF3Sm9iRGF0YS5kZXNjcmlwdGlvbixcbiAgICAgICAgLy8gICBkZXNjTGVuZ3RoOiByYXdKb2JEYXRhLmRlc2NyaXB0aW9uPy5sZW5ndGggfHwgMCxcbiAgICAgICAgLy8gfSk7XG5cbiAgICAgICAgLy8gQ3JlYXRlIHRoZSBkYXRhIHN0cnVjdHVyZSB0aGF0IGJhY2tncm91bmQvcG9wdXAgZXhwZWN0c1xuICAgICAgICBjb25zdCBzdHJ1Y3R1cmVkRGF0YSA9IHtcbiAgICAgICAgICBqb2JEYXRhOiB7XG4gICAgICAgICAgICB0aXRsZTogcmF3Sm9iRGF0YS50aXRsZSxcbiAgICAgICAgICAgIGNvbXBhbnk6IHJhd0pvYkRhdGEuY29tcGFueSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByYXdKb2JEYXRhLmxvY2F0aW9uLFxuICAgICAgICAgICAgdHlwZTogcmF3Sm9iRGF0YS50eXBlcyxcbiAgICAgICAgICAgIHNhbGFyeTogcmF3Sm9iRGF0YS5zYWxhcnkgfHwgJ04vQScsXG4gICAgICAgICAgICBwb3N0ZWQ6IHJhd0pvYkRhdGEucG9zdGVkLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IHJhd0pvYkRhdGEuZGVzY3JpcHRpb24sXG4gICAgICAgICAgfSxcbiAgICAgICAgICByZXF1aXJlbWVudHM6IFtdLFxuICAgICAgICAgIHNraWxsczogW10sXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gY29uc29sZS5sb2coJ1NlbmRpbmcgZGF0YSB0byBiYWNrZ3JvdW5kOicsIHN0cnVjdHVyZWREYXRhKTtcblxuICAgICAgICAvLyBTZW5kIHRvIGJhY2tncm91bmRcbiAgICAgICAgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICB0eXBlOiAnU0NSQVBFRF9EQVRBJyxcbiAgICAgICAgICBkYXRhOiBzdHJ1Y3R1cmVkRGF0YSxcbiAgICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ0RhdGEgc2VudCB0byBiYWNrZ3JvdW5kJyk7XG4gICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gc2VuZCBkYXRhOicsIGVycik7XG4gICAgICAgIH0pLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgIGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJbml0aWFsIHNjcmFwZSB3aXRoIGRlbGF5XG4gICAgc2V0VGltZW91dChjaGVja0FuZFNlbmREYXRhLCAxNTAwKTtcblxuICAgIC8vIE9ic2VydmUgZm9yIGpvYiBjaGFuZ2VzIHdpdGggZGVib3VuY2VcbiAgICBsZXQgZGVib3VuY2VUaW1lcjogYW55O1xuICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgY2xlYXJUaW1lb3V0KGRlYm91bmNlVGltZXIpO1xuICAgICAgZGVib3VuY2VUaW1lciA9IHNldFRpbWVvdXQoY2hlY2tBbmRTZW5kRGF0YSwgODAwKTtcbiAgICB9KTtcblxuICAgIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICB9KTtcbiAgfSxcbn0pOyIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2AgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJsb2NhdGlvbiIsInByaW50IiwibG9nZ2VyIl0sIm1hcHBpbmdzIjoiOztBQUFPLFdBQVMsb0JBQW9CQSxhQUFZO0FBQzlDLFdBQU9BO0FBQUEsRUFDVDtBQ0RPLFFBQU1DLFlBQVUsV0FBVyxTQUFTLFNBQVMsS0FDaEQsV0FBVyxVQUNYLFdBQVc7QUNGUixRQUFNLFVBQVVDO0FDSXZCLFFBQUEsYUFBQSxvQkFBQTtBQUFBLElBQW1DLFNBQUEsQ0FBQSwyQkFBQTtBQUFBLElBQ0ksT0FBQTtBQUFBLElBQzlCLE1BQUEsTUFBQTtBQUVMLGNBQUEsSUFBQSxvQ0FBQTtBQUNBLGNBQUEsSUFBQSxtQkFBQSxPQUFBLFNBQUEsSUFBQTtBQUNBLGNBQUEsSUFBQSxrQkFBQSxTQUFBLEtBQUE7QUFFQSxVQUFBLFlBQUE7QUFDQSxVQUFBLGVBQUE7QUFFQSxxQkFBQSxnQkFBQTtBQUVFLGNBQUEsVUFBQSxTQUFBLGNBQUEsa0RBQUE7QUFDQSxjQUFBLFFBQUEsU0FBQSxhQUFBLEtBQUEsS0FBQTtBQUdBLGNBQUEsWUFBQSxTQUFBLGNBQUEsb0RBQUE7QUFDQSxjQUFBLFVBQUEsV0FBQSxhQUFBLEtBQUEsS0FBQTtBQUdBLGNBQUEsZ0JBQUEsU0FBQTtBQUFBLFVBQStCO0FBQUEsUUFDN0I7QUFFRixjQUFBQyxZQUFBLGNBQUEsQ0FBQSxHQUFBLGFBQUEsS0FBQSxLQUFBO0FBQ0EsY0FBQSxTQUFBLGNBQUEsQ0FBQSxHQUFBLGNBQUEsTUFBQSxHQUFBLGFBQUEsS0FBQSxLQUFBO0FBQ0EsY0FBQSxhQUFBLGNBQUEsQ0FBQSxHQUFBLGFBQUEsS0FBQSxLQUFBO0FBR0EsY0FBQSxhQUFBLE1BQUE7QUFBQSxVQUF5QixTQUFBLGlCQUFBLGtEQUFB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
job;