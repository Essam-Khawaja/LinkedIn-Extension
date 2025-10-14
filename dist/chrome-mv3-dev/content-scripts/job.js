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
        isProcessing = true;
        console.log("Scraping data...");
        const rawData = await scrapeJobData();
        if (!rawData) {
          isProcessing = false;
          return;
        } else {
          browser.runtime.sendMessage({
            type: "SCRAPING_STARTED"
          }).catch((err) => console.log("Popup may not be open"));
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
            type: "JOB_SCRAPED_DATA",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9iLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi9zcmMvZW50cnlwb2ludHMvam9iLmNvbnRlbnQudHMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiaW50ZXJmYWNlIFNraWxsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBtYXRjaDogbnVtYmVyO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWycqOi8vKi5saW5rZWRpbi5jb20vam9icy8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIG1haW46ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZyhcIvCfmoAgTGlua2VkSW4gam9iIHNjcmFwZXIgcnVubmluZy4uLlwiKTtcbiAgICBjb25zb2xlLmxvZyhcIvCfk40gQ3VycmVudCBVUkw6XCIsIHdpbmRvdy5sb2NhdGlvbi5ocmVmKTtcbiAgICBjb25zb2xlLmxvZyhcIvCfk40gUGFnZSB0aXRsZTpcIiwgZG9jdW1lbnQudGl0bGUpO1xuXG4gICAgbGV0IGxhc3RKb2JJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuXG4gICAgYXN5bmMgZnVuY3Rpb24gc2NyYXBlSm9iRGF0YSgpIHtcbiAgICAgIC8vIEpvYiB0aXRsZVxuICAgICAgY29uc3QgdGl0bGVFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5qb2ItZGV0YWlscy1qb2JzLXVuaWZpZWQtdG9wLWNhcmRfX2pvYi10aXRsZSBoMScpO1xuICAgICAgY29uc3QgdGl0bGUgPSB0aXRsZUVsPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuXG4gICAgICAvLyBDb21wYW55XG4gICAgICBjb25zdCBjb21wYW55RWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuam9iLWRldGFpbHMtam9icy11bmlmaWVkLXRvcC1jYXJkX19jb21wYW55LW5hbWUgYScpO1xuICAgICAgY29uc3QgY29tcGFueSA9IGNvbXBhbnlFbD8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJztcblxuICAgICAgLy8gTWV0YWRhdGFcbiAgICAgIGNvbnN0IG1ldGFkYXRhU3BhbnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFxuICAgICAgICAnLmpvYi1kZXRhaWxzLWpvYnMtdW5pZmllZC10b3AtY2FyZF9fdGVydGlhcnktZGVzY3JpcHRpb24tY29udGFpbmVyIC50dm1fX3RleHQnXG4gICAgICApO1xuICAgICAgY29uc3QgbG9jYXRpb24gPSBtZXRhZGF0YVNwYW5zWzBdPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgY29uc3QgcG9zdGVkID0gbWV0YWRhdGFTcGFuc1syXT8ucXVlcnlTZWxlY3Rvcignc3BhbicpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgY29uc3QgYXBwbGljYW50cyA9IG1ldGFkYXRhU3BhbnNbNF0/LnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG5cbiAgICAgIC8vIEpvYiB0eXBlIGJhZGdlc1xuICAgICAgY29uc3QgdHlwZUJhZGdlcyA9IEFycmF5LmZyb20oXG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5qb2ItZGV0YWlscy1maXQtbGV2ZWwtcHJlZmVyZW5jZXMgYnV0dG9uIHN0cm9uZycpXG4gICAgICApXG4gICAgICAgIC5tYXAoZWwgPT4gZWwudGV4dENvbnRlbnQ/LnRyaW0oKSlcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcblxuICAgICAgLy8gRGVzY3JpcHRpb25cbiAgICAgIGxldCBkZXNjcmlwdGlvbiA9ICcnO1xuICAgICAgY29uc3Qgb2xkU2VsZWN0b3IgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuam9icy1kZXNjcmlwdGlvbl9fY29udGVudCcpO1xuICAgICAgICBkZXNjcmlwdGlvbiA9IG9sZFNlbGVjdG9yPy50ZXh0Q29udGVudC50cmltKCkgfHwgJyc7XG4gICAgICBcbiAgICAgIC8vIFNhbGFyeSBleHRyYWN0aW9uXG4gICAgICBjb25zdCBzYWxhcnlQYXR0ZXJucyA9IFtcbiAgICAgICAgL1xcJFtcXGQsXSsoPzpcXC5cXGR7Mn0pP1xccyotXFxzKlxcJFtcXGQsXSsoPzpcXC5cXGR7Mn0pP1xccyooPzpDQUR8VVNEfHBlciBob3VyKT8vZ2ksXG4gICAgICAgIC9cXCQ/W1xcZCxdK2tcXHMqLVxccypcXCQ/W1xcZCxdK2svZ2ksXG4gICAgICBdO1xuICAgICAgbGV0IHNhbGFyeSA9ICcnO1xuICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHNhbGFyeVBhdHRlcm5zKSB7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gZGVzY3JpcHRpb24ubWF0Y2gocGF0dGVybik7XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgIHNhbGFyeSA9IG1hdGNoWzBdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEV4cGVyaWVuY2UgbGV2ZWxcbiAgICAgIGNvbnN0IGV4cGVyaWVuY2VQYXR0ZXJuID0gLyhcXGQrKVxcKz9cXHMqeWVhcnM/XFxzKyg/Om9mXFxzKyk/ZXhwZXJpZW5jZS9naTtcbiAgICAgIGNvbnN0IGV4cE1hdGNoID0gZGVzY3JpcHRpb24ubWF0Y2goZXhwZXJpZW5jZVBhdHRlcm4pO1xuICAgICAgY29uc3QgZXhwZXJpZW5jZSA9IGV4cE1hdGNoID8gZXhwTWF0Y2hbMF0gOiAnJztcblxuICAgICAgLy8gVW5pcXVlIGpvYiBJRFxuICAgICAgY29uc3Qgam9iSWQgPSBgJHtjb21wYW55fS0ke3RpdGxlfWA7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBqb2JJZCxcbiAgICAgICAgdGl0bGUsXG4gICAgICAgIGNvbXBhbnksXG4gICAgICAgIGxvY2F0aW9uLFxuICAgICAgICBwb3N0ZWQsXG4gICAgICAgIGFwcGxpY2FudHMsXG4gICAgICAgIHR5cGVzOiB0eXBlQmFkZ2VzLmpvaW4oJywgJyksXG4gICAgICAgIHNhbGFyeSxcbiAgICAgICAgZXhwZXJpZW5jZSxcbiAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGFzeW5jIGZ1bmN0aW9uIGNoZWNrQW5kU2VuZERhdGEoKSB7XG4gICAgICBpZiAoaXNQcm9jZXNzaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaXNQcm9jZXNzaW5nID0gdHJ1ZTtcblxuICAgIGNvbnNvbGUubG9nKCdTY3JhcGluZyBkYXRhLi4uJyk7XG4gICAgY29uc3QgcmF3RGF0YSA9IGF3YWl0IHNjcmFwZUpvYkRhdGEoKTtcblxuICAgIGlmICghcmF3RGF0YSkge1xuICAgICAgICBpc1Byb2Nlc3NpbmcgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICB0eXBlOiAnU0NSQVBJTkdfU1RBUlRFRCdcbiAgICB9KS5jYXRjaChlcnIgPT4gY29uc29sZS5sb2coJ1BvcHVwIG1heSBub3QgYmUgb3BlbicpKTtcbiAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHJhd0pvYkRhdGEgPSBhd2FpdCBzY3JhcGVKb2JEYXRhKCk7XG5cbiAgICAgIGlmIChyYXdKb2JEYXRhLmNvbXBhbnkgJiYgcmF3Sm9iRGF0YS50aXRsZSAmJiByYXdKb2JEYXRhLmpvYklkICE9PSBsYXN0Sm9iSWQpIHtcbiAgICAgICAgaXNQcm9jZXNzaW5nID0gdHJ1ZTtcbiAgICAgICAgbGFzdEpvYklkID0gcmF3Sm9iRGF0YS5qb2JJZDtcblxuICAgICAgICAvLyBjb25zb2xlLmxvZygnU2NyYXBlZCBqb2IgZGF0YTonLCB7XG4gICAgICAgIC8vICAgdGl0bGU6IHJhd0pvYkRhdGEudGl0bGUsXG4gICAgICAgIC8vICAgY29tcGFueTogcmF3Sm9iRGF0YS5jb21wYW55LFxuICAgICAgICAvLyAgIGhhc0Rlc2NyaXB0aW9uOiAhIXJhd0pvYkRhdGEuZGVzY3JpcHRpb24sXG4gICAgICAgIC8vICAgZGVzY0xlbmd0aDogcmF3Sm9iRGF0YS5kZXNjcmlwdGlvbj8ubGVuZ3RoIHx8IDAsXG4gICAgICAgIC8vIH0pO1xuXG4gICAgICAgIC8vIENyZWF0ZSB0aGUgZGF0YSBzdHJ1Y3R1cmUgdGhhdCBiYWNrZ3JvdW5kL3BvcHVwIGV4cGVjdHNcbiAgICAgICAgY29uc3Qgc3RydWN0dXJlZERhdGEgPSB7XG4gICAgICAgICAgam9iRGF0YToge1xuICAgICAgICAgICAgdGl0bGU6IHJhd0pvYkRhdGEudGl0bGUsXG4gICAgICAgICAgICBjb21wYW55OiByYXdKb2JEYXRhLmNvbXBhbnksXG4gICAgICAgICAgICBsb2NhdGlvbjogcmF3Sm9iRGF0YS5sb2NhdGlvbixcbiAgICAgICAgICAgIHR5cGU6IHJhd0pvYkRhdGEudHlwZXMsXG4gICAgICAgICAgICBzYWxhcnk6IHJhd0pvYkRhdGEuc2FsYXJ5IHx8ICdOL0EnLFxuICAgICAgICAgICAgcG9zdGVkOiByYXdKb2JEYXRhLnBvc3RlZCxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiByYXdKb2JEYXRhLmRlc2NyaXB0aW9uLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcmVxdWlyZW1lbnRzOiBbXSxcbiAgICAgICAgICBza2lsbHM6IFtdLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdTZW5kaW5nIGRhdGEgdG8gYmFja2dyb3VuZDonLCBzdHJ1Y3R1cmVkRGF0YSk7XG5cbiAgICAgICAgLy8gU2VuZCB0byBiYWNrZ3JvdW5kXG4gICAgICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgdHlwZTogJ0pPQl9TQ1JBUEVEX0RBVEEnLFxuICAgICAgICAgIGRhdGE6IHN0cnVjdHVyZWREYXRhLFxuICAgICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnRGF0YSBzZW50IHRvIGJhY2tncm91bmQnKTtcbiAgICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzZW5kIGRhdGE6JywgZXJyKTtcbiAgICAgICAgfSkuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgaXNQcm9jZXNzaW5nID0gZmFsc2U7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEluaXRpYWwgc2NyYXBlIHdpdGggZGVsYXlcbiAgICBzZXRUaW1lb3V0KGNoZWNrQW5kU2VuZERhdGEsIDE1MDApO1xuXG4gICAgLy8gT2JzZXJ2ZSBmb3Igam9iIGNoYW5nZXMgd2l0aCBkZWJvdW5jZVxuICAgIGxldCBkZWJvdW5jZVRpbWVyOiBhbnk7XG4gICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQoZGVib3VuY2VUaW1lcik7XG4gICAgICBkZWJvdW5jZVRpbWVyID0gc2V0VGltZW91dChjaGVja0FuZFNlbmREYXRhLCA4MDApO1xuICAgIH0pO1xuXG4gICAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7XG4gICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICBzdWJ0cmVlOiB0cnVlLFxuICAgIH0pO1xuICB9LFxufSk7IiwiZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG4gIGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICBtZXRob2QoYFt3eHRdICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbiAgfVxufVxuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IHtcbiAgZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcbiAgbG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuICB3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcbiAgZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEludGVydmFscyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNsZWFySW50ZXJ2YWxgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsQW5pbWF0aW9uRnJhbWVgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsSWRsZUNhbGxiYWNrYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSwgb3B0aW9ucyk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICBhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuICAgIGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcbiAgICB9XG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/LihcbiAgICAgIHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLFxuICAgICAgaGFuZGxlcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgc2lnbmFsOiB0aGlzLnNpZ25hbFxuICAgICAgfVxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cbiAgICovXG4gIG5vdGlmeUludmFsaWRhdGVkKCkge1xuICAgIHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuICAgIGxvZ2dlci5kZWJ1ZyhcbiAgICAgIGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYFxuICAgICk7XG4gIH1cbiAgc3RvcE9sZFNjcmlwdHMoKSB7XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKFxuICAgICAge1xuICAgICAgICB0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG4gICAgICAgIGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuICAgICAgICBtZXNzYWdlSWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpXG4gICAgICB9LFxuICAgICAgXCIqXCJcbiAgICApO1xuICB9XG4gIHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuICAgIGNvbnN0IGlzU2NyaXB0U3RhcnRlZEV2ZW50ID0gZXZlbnQuZGF0YT8udHlwZSA9PT0gQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFO1xuICAgIGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kYXRhPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcbiAgICBjb25zdCBpc05vdER1cGxpY2F0ZSA9ICF0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5oYXMoZXZlbnQuZGF0YT8ubWVzc2FnZUlkKTtcbiAgICByZXR1cm4gaXNTY3JpcHRTdGFydGVkRXZlbnQgJiYgaXNTYW1lQ29udGVudFNjcmlwdCAmJiBpc05vdER1cGxpY2F0ZTtcbiAgfVxuICBsaXN0ZW5Gb3JOZXdlclNjcmlwdHMob3B0aW9ucykge1xuICAgIGxldCBpc0ZpcnN0ID0gdHJ1ZTtcbiAgICBjb25zdCBjYiA9IChldmVudCkgPT4ge1xuICAgICAgaWYgKHRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkge1xuICAgICAgICB0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5hZGQoZXZlbnQuZGF0YS5tZXNzYWdlSWQpO1xuICAgICAgICBjb25zdCB3YXNGaXJzdCA9IGlzRmlyc3Q7XG4gICAgICAgIGlzRmlyc3QgPSBmYWxzZTtcbiAgICAgICAgaWYgKHdhc0ZpcnN0ICYmIG9wdGlvbnM/Lmlnbm9yZUZpcnN0RXZlbnQpIHJldHVybjtcbiAgICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiByZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYikpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiZGVmaW5pdGlvbiIsImJyb3dzZXIiLCJfYnJvd3NlciIsImxvY2F0aW9uIiwicHJpbnQiLCJsb2dnZXIiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxvQkFBb0JBLGFBQVk7QUFDOUMsV0FBT0E7QUFBQSxFQUNUO0FDRE8sUUFBTUMsWUFBVSxXQUFXLFNBQVMsU0FBUyxLQUNoRCxXQUFXLFVBQ1gsV0FBVztBQ0ZSLFFBQU0sVUFBVUM7QUNJdkIsUUFBQSxhQUFBLG9CQUFBO0FBQUEsSUFBbUMsU0FBQSxDQUFBLDJCQUFBO0FBQUEsSUFDSSxPQUFBO0FBQUEsSUFDOUIsTUFBQSxNQUFBO0FBRUwsY0FBQSxJQUFBLG9DQUFBO0FBQ0EsY0FBQSxJQUFBLG1CQUFBLE9BQUEsU0FBQSxJQUFBO0FBQ0EsY0FBQSxJQUFBLGtCQUFBLFNBQUEsS0FBQTtBQUVBLFVBQUEsWUFBQTtBQUNBLFVBQUEsZUFBQTtBQUVBLHFCQUFBLGdCQUFBO0FBRUUsY0FBQSxVQUFBLFNBQUEsY0FBQSxr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
job;