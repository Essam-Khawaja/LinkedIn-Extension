var profile = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  const definition = defineContentScript({
    matches: ["*://*.linkedin.com/in/*"],
    runAt: "document_idle",
    main: () => {
      console.log("Hey! Im running!");
      function safeText(selector, parent = document) {
        const el = parent.querySelector(selector);
        return el?.textContent?.trim() || "";
      }
      async function scrapeJobData() {
        console.log("Scraping data...");
        try {
          const name = safeText("h1.text-heading-xlarge") || safeText("h1") || safeText("[data-generated-suggestion-target]");
          const headline = safeText("div.text-body-medium") || safeText(".pv-text-details__left-panel .text-body-medium");
          const connectionsElement = Array.from(document.querySelectorAll("span")).find((el) => el.textContent?.includes("connection"));
          const connections = connectionsElement?.textContent?.trim() || "";
          const url = window.location.href;
          let about = "";
          console.log("Looking for About section...");
          const allSections = document.querySelectorAll("section");
          console.log("Found sections:", allSections.length);
          allSections.forEach((section, idx) => {
            const heading = section.querySelector('h2, h3, div[class*="headline"]');
            const headingText = heading?.textContent?.trim() || "NO HEADING";
            const sectionId = section.id || "NO ID";
            const classes = section.className || "NO CLASSES";
            console.log(`Section ${idx}: ID="${sectionId}", Heading="${headingText}", Classes="${classes}"`);
          });
          const aboutSection = Array.from(allSections).find((section) => {
            if (section.classList.contains("scaffold-layout-toolbar")) {
              console.log("Skipping toolbar section");
              return false;
            }
            const hasAboutId = section.id?.toLowerCase().includes("about");
            const heading = section.querySelector('h2, h3, div[class*="headline"]');
            const headingText = heading?.textContent?.trim().toLowerCase() || "";
            const hasAboutHeading = headingText === "about";
            const isAbout = hasAboutId || hasAboutHeading;
            if (isAbout) {
              console.log("Found About section with ID:", section.id, "Heading:", headingText);
            }
            return isAbout;
          });
          if (aboutSection) {
            console.log("About section HTML:", aboutSection.innerHTML.substring(0, 500));
            const selectors = [
              ".inline-show-more-text",
              ".pv-shared-text-with-see-more",
              'div.full-width span[aria-hidden="true"]',
              ".pv-about__summary-text",
              "div > span"
            ];
            for (const sel of selectors) {
              const el = aboutSection.querySelector(sel);
              const text = el?.textContent?.trim() || "";
              if (text && text.length > 20) {
                about = text;
                console.log("About found with selector:", sel, "Length:", text.length);
                break;
              }
            }
            if (!about) {
              console.log("Trying all spans in about section...");
              const spans = aboutSection.querySelectorAll("span");
              const longText = Array.from(spans).map((s) => s.textContent?.trim() || "").filter((t) => t.length > 50).sort((a, b) => b.length - a.length)[0];
              about = longText || "";
            }
          } else {
            console.log("No about section found - check the section list above!");
          }
          const experience = [];
          const experienceSection = Array.from(document.querySelectorAll("section")).find((section) => {
            const heading = section.querySelector('h2, div[id*="experience"]');
            return heading?.textContent?.toLowerCase().includes("experience");
          });
          if (experienceSection) {
            const experienceItems = experienceSection.querySelectorAll("li.artdeco-list__item, ul > li");
            experienceItems.forEach((item) => {
              const title = safeText('[data-field="experience-position-title"], .mr1.t-bold span', item) || safeText('.display-flex.align-items-center span[aria-hidden="true"]', item);
              const company = safeText('[data-field="experience-company-name"], .t-14.t-normal span', item);
              const duration = safeText('[data-field="experience-date-range"], .t-14.t-normal.t-black--light span', item);
              if (title) {
                const experienceEntry = [title, company, duration].filter(Boolean).join(" | ");
                experience.push(experienceEntry);
              }
            });
          }
          const skills = [];
          const skillsSection = Array.from(document.querySelectorAll("section")).find((section) => {
            const heading = section.querySelector('h2, div[id*="skills"]');
            return heading?.textContent?.toLowerCase().includes("skill");
          });
          if (skillsSection) {
            const skillElements = skillsSection.querySelectorAll('li span[aria-hidden="true"]');
            skillElements.forEach((el) => {
              const skill = el.textContent?.trim();
              if (skill) {
                skills.push(skill);
              }
            });
          }
          const data = {
            name,
            headline,
            connections,
            url,
            about,
            experience,
            skills
          };
          console.log("Scraped data:", data);
          return data;
        } catch (error) {
          console.error("Error scraping profile:", error);
          return null;
        }
      }
      async function checkAndSendData() {
        console.log("Sending data...");
        const rawData = await scrapeJobData();
        browser.runtime.sendMessage({
          type: "PROFILE_SCRAPED_DATA",
          data: rawData
        }).then(() => {
          console.log("Data sent to background");
        }).catch((err) => {
          console.error("Failed to send data:", err);
        }).finally(() => {
        });
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
    return `${browser?.runtime?.id}:${"profile"}:${eventName}`;
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
      const ctx = new ContentScriptContext("profile", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"profile"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZmlsZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L2Jyb3dzZXIubWpzIiwiLi4vLi4vLi4vc3JjL2VudHJ5cG9pbnRzL3Byb2ZpbGUuY29udGVudC50cyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCJpbnRlcmZhY2UgUHJvZmlsZVNjcmFwZWREYXRhIHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgaGVhZGxpbmU6IHN0cmluZztcbiAgICBjb25uZWN0aW9uczogc3RyaW5nO1xuICAgIHVybDogc3RyaW5nO1xuICAgIGFib3V0OiBzdHJpbmc7XG4gICAgZXhwZXJpZW5jZTogc3RyaW5nW107XG4gICAgc2tpbGxzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gICAgbWF0Y2hlczogWycqOi8vKi5saW5rZWRpbi5jb20vaW4vKiddLFxuICAgIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gICAgbWFpbjogKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnSGV5ISBJbSBydW5uaW5nIScpXG5cbiAgICAgICAgbGV0IGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuXG4gICAgICAgIGZ1bmN0aW9uIHNhZmVUZXh0KHNlbGVjdG9yOiBzdHJpbmcsIHBhcmVudDogRG9jdW1lbnQgfCBFbGVtZW50ID0gZG9jdW1lbnQpOiBzdHJpbmcge1xuICAgICAgICAgICAgY29uc3QgZWwgPSBwYXJlbnQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gICAgICAgICAgICByZXR1cm4gZWw/LnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBIZWxwZXIgdG8gZ2V0IGFsbCBtYXRjaGluZyBlbGVtZW50cycgdGV4dFxuICAgICAgICBmdW5jdGlvbiBzYWZlVGV4dEFsbChzZWxlY3Rvcjogc3RyaW5nLCBwYXJlbnQ6IERvY3VtZW50IHwgRWxlbWVudCA9IGRvY3VtZW50KTogc3RyaW5nW10ge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudHMgPSBwYXJlbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XG4gICAgICAgICAgICByZXR1cm4gQXJyYXkuZnJvbShlbGVtZW50cylcbiAgICAgICAgICAgICAgICAubWFwKGVsID0+IGVsLnRleHRDb250ZW50Py50cmltKCkgfHwgJycpXG4gICAgICAgICAgICAgICAgLmZpbHRlcih0ZXh0ID0+IHRleHQubGVuZ3RoID4gMCk7XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBzY3JhcGVKb2JEYXRhKCk6IFByb21pc2U8UHJvZmlsZVNjcmFwZWREYXRhIHwgbnVsbD4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NjcmFwaW5nIGRhdGEuLi4nKTtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBOYW1lIC0gdXN1YWxseSBpbiBoMSBhdCB0aGUgdG9wIG9mIHRoZSBwcm9maWxlXG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IHNhZmVUZXh0KCdoMS50ZXh0LWhlYWRpbmcteGxhcmdlJykgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNhZmVUZXh0KCdoMScpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNhZmVUZXh0KCdbZGF0YS1nZW5lcmF0ZWQtc3VnZ2VzdGlvbi10YXJnZXRdJyk7XG5cbiAgICAgICAgICAgICAgICAvLyBIZWFkbGluZSAtIHR5cGljYWxseSByaWdodCBiZWxvdyBuYW1lXG4gICAgICAgICAgICAgICAgY29uc3QgaGVhZGxpbmUgPSBzYWZlVGV4dCgnZGl2LnRleHQtYm9keS1tZWRpdW0nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzYWZlVGV4dCgnLnB2LXRleHQtZGV0YWlsc19fbGVmdC1wYW5lbCAudGV4dC1ib2R5LW1lZGl1bScpO1xuXG4gICAgICAgICAgICAgICAgLy8gQ29ubmVjdGlvbnMgLSBsb29rIGZvciBjb25uZWN0aW9uIGNvdW50IHRleHRcbiAgICAgICAgICAgICAgICBjb25zdCBjb25uZWN0aW9uc0VsZW1lbnQgPSBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3NwYW4nKSlcbiAgICAgICAgICAgICAgICAgICAgLmZpbmQoZWwgPT4gZWwudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdjb25uZWN0aW9uJykpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbm5lY3Rpb25zID0gY29ubmVjdGlvbnNFbGVtZW50Py50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuXG4gICAgICAgICAgICAgICAgLy8gVVJMIC0gY3VycmVudCBwYWdlIFVSTFxuICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuXG4gICAgICAgICAgICAgICAgLy8gQWJvdXQgc2VjdGlvbiAtIEVuaGFuY2VkIGRlYnVnIHZlcnNpb25cbiAgICAgICAgICAgICAgICBsZXQgYWJvdXQgPSAnJztcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnTG9va2luZyBmb3IgQWJvdXQgc2VjdGlvbi4uLicpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGFsbFNlY3Rpb25zID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnc2VjdGlvbicpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdGb3VuZCBzZWN0aW9uczonLCBhbGxTZWN0aW9ucy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIExvZyBBTEwgc2VjdGlvbnMgdG8gc2VlIHdoYXQgd2UgaGF2ZVxuICAgICAgICAgICAgICAgIGFsbFNlY3Rpb25zLmZvckVhY2goKHNlY3Rpb24sIGlkeCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkaW5nID0gc2VjdGlvbi5xdWVyeVNlbGVjdG9yKCdoMiwgaDMsIGRpdltjbGFzcyo9XCJoZWFkbGluZVwiXScpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkaW5nVGV4dCA9IGhlYWRpbmc/LnRleHRDb250ZW50Py50cmltKCkgfHwgJ05PIEhFQURJTkcnO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZWN0aW9uSWQgPSBzZWN0aW9uLmlkIHx8ICdOTyBJRCc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsYXNzZXMgPSBzZWN0aW9uLmNsYXNzTmFtZSB8fCAnTk8gQ0xBU1NFUyc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBTZWN0aW9uICR7aWR4fTogSUQ9XCIke3NlY3Rpb25JZH1cIiwgSGVhZGluZz1cIiR7aGVhZGluZ1RleHR9XCIsIENsYXNzZXM9XCIke2NsYXNzZXN9XCJgKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBMb29rIGZvciBzZWN0aW9uIHdpdGggaWQgY29udGFpbmluZyBcImFib3V0XCIgb3IgaGVhZGluZyB3aXRoIFwiQWJvdXRcIlxuICAgICAgICAgICAgICAgIGNvbnN0IGFib3V0U2VjdGlvbiA9IEFycmF5LmZyb20oYWxsU2VjdGlvbnMpLmZpbmQoc2VjdGlvbiA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNraXAgdG9vbGJhciBzZWN0aW9uc1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VjdGlvbi5jbGFzc0xpc3QuY29udGFpbnMoJ3NjYWZmb2xkLWxheW91dC10b29sYmFyJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTa2lwcGluZyB0b29sYmFyIHNlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGlkIHdpdGggXCJhYm91dFwiXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhc0Fib3V0SWQgPSBzZWN0aW9uLmlkPy50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdhYm91dCcpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGgyL2gzL2RpdiB3aXRoIFwiQWJvdXRcIiB0ZXh0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRpbmcgPSBzZWN0aW9uLnF1ZXJ5U2VsZWN0b3IoJ2gyLCBoMywgZGl2W2NsYXNzKj1cImhlYWRsaW5lXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRpbmdUZXh0ID0gaGVhZGluZz8udGV4dENvbnRlbnQ/LnRyaW0oKS50b0xvd2VyQ2FzZSgpIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoYXNBYm91dEhlYWRpbmcgPSBoZWFkaW5nVGV4dCA9PT0gJ2Fib3V0JztcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzQWJvdXQgPSBoYXNBYm91dElkIHx8IGhhc0Fib3V0SGVhZGluZztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzQWJvdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdGb3VuZCBBYm91dCBzZWN0aW9uIHdpdGggSUQ6Jywgc2VjdGlvbi5pZCwgJ0hlYWRpbmc6JywgaGVhZGluZ1RleHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpc0Fib3V0O1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmIChhYm91dFNlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0Fib3V0IHNlY3Rpb24gSFRNTDonLCBhYm91dFNlY3Rpb24uaW5uZXJIVE1MLnN1YnN0cmluZygwLCA1MDApKTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIFRyeSBtdWx0aXBsZSBzZWxlY3RvcnNcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VsZWN0b3JzID0gW1xuICAgICAgICAgICAgICAgICAgICAgICAgJy5pbmxpbmUtc2hvdy1tb3JlLXRleHQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJy5wdi1zaGFyZWQtdGV4dC13aXRoLXNlZS1tb3JlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdkaXYuZnVsbC13aWR0aCBzcGFuW2FyaWEtaGlkZGVuPVwidHJ1ZVwiXScsXG4gICAgICAgICAgICAgICAgICAgICAgICAnLnB2LWFib3V0X19zdW1tYXJ5LXRleHQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2RpdiA+IHNwYW4nLFxuICAgICAgICAgICAgICAgICAgICBdO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBzZWwgb2Ygc2VsZWN0b3JzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlbCA9IGFib3V0U2VjdGlvbi5xdWVyeVNlbGVjdG9yKHNlbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXh0ID0gZWw/LnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGV4dCAmJiB0ZXh0Lmxlbmd0aCA+IDIwKSB7ICAvLyBNdXN0IGJlIHN1YnN0YW50aWFsIHRleHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhYm91dCA9IHRleHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0Fib3V0IGZvdW5kIHdpdGggc2VsZWN0b3I6Jywgc2VsLCAnTGVuZ3RoOicsIHRleHQubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhYm91dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1RyeWluZyBhbGwgc3BhbnMgaW4gYWJvdXQgc2VjdGlvbi4uLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3BhbnMgPSBhYm91dFNlY3Rpb24ucXVlcnlTZWxlY3RvckFsbCgnc3BhbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9uZ1RleHQgPSBBcnJheS5mcm9tKHNwYW5zKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAocyA9PiBzLnRleHRDb250ZW50Py50cmltKCkgfHwgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcih0ID0+IHQubGVuZ3RoID4gNTApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGIubGVuZ3RoIC0gYS5sZW5ndGgpWzBdOyAgLy8gR2V0IGxvbmdlc3QgdGV4dFxuICAgICAgICAgICAgICAgICAgICAgICAgYWJvdXQgPSBsb25nVGV4dCB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdObyBhYm91dCBzZWN0aW9uIGZvdW5kIC0gY2hlY2sgdGhlIHNlY3Rpb24gbGlzdCBhYm92ZSEnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBFeHBlcmllbmNlIHNlY3Rpb25cbiAgICAgICAgICAgICAgICBjb25zdCBleHBlcmllbmNlOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4cGVyaWVuY2VTZWN0aW9uID0gQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdzZWN0aW9uJykpXG4gICAgICAgICAgICAgICAgICAgIC5maW5kKHNlY3Rpb24gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGluZyA9IHNlY3Rpb24ucXVlcnlTZWxlY3RvcignaDIsIGRpdltpZCo9XCJleHBlcmllbmNlXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVhZGluZz8udGV4dENvbnRlbnQ/LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2V4cGVyaWVuY2UnKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZXhwZXJpZW5jZVNlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTG9vayBmb3IgbGlzdCBpdGVtcyBjb250YWluaW5nIGV4cGVyaWVuY2UgZW50cmllc1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBleHBlcmllbmNlSXRlbXMgPSBleHBlcmllbmNlU2VjdGlvbi5xdWVyeVNlbGVjdG9yQWxsKCdsaS5hcnRkZWNvLWxpc3RfX2l0ZW0sIHVsID4gbGknKTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGV4cGVyaWVuY2VJdGVtcy5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IHRvIGV4dHJhY3Qgam9iIHRpdGxlLCBjb21wYW55LCBhbmQgZHVyYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpdGxlID0gc2FmZVRleHQoJ1tkYXRhLWZpZWxkPVwiZXhwZXJpZW5jZS1wb3NpdGlvbi10aXRsZVwiXSwgLm1yMS50LWJvbGQgc3BhbicsIGl0ZW0pIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2FmZVRleHQoJy5kaXNwbGF5LWZsZXguYWxpZ24taXRlbXMtY2VudGVyIHNwYW5bYXJpYS1oaWRkZW49XCJ0cnVlXCJdJywgaXRlbSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBhbnkgPSBzYWZlVGV4dCgnW2RhdGEtZmllbGQ9XCJleHBlcmllbmNlLWNvbXBhbnktbmFtZVwiXSwgLnQtMTQudC1ub3JtYWwgc3BhbicsIGl0ZW0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkdXJhdGlvbiA9IHNhZmVUZXh0KCdbZGF0YS1maWVsZD1cImV4cGVyaWVuY2UtZGF0ZS1yYW5nZVwiXSwgLnQtMTQudC1ub3JtYWwudC1ibGFjay0tbGlnaHQgc3BhbicsIGl0ZW0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGl0bGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHBlcmllbmNlRW50cnkgPSBbdGl0bGUsIGNvbXBhbnksIGR1cmF0aW9uXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKEJvb2xlYW4pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5qb2luKCcgfCAnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHBlcmllbmNlLnB1c2goZXhwZXJpZW5jZUVudHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gU2tpbGxzIHNlY3Rpb25cbiAgICAgICAgICAgICAgICBjb25zdCBza2lsbHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICAgICAgY29uc3Qgc2tpbGxzU2VjdGlvbiA9IEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnc2VjdGlvbicpKVxuICAgICAgICAgICAgICAgICAgICAuZmluZChzZWN0aW9uID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRpbmcgPSBzZWN0aW9uLnF1ZXJ5U2VsZWN0b3IoJ2gyLCBkaXZbaWQqPVwic2tpbGxzXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVhZGluZz8udGV4dENvbnRlbnQ/LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3NraWxsJyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNraWxsc1NlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU2tpbGxzIGFyZSB1c3VhbGx5IGluIGxpc3QgaXRlbXMgb3Igc3BhbnNcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2tpbGxFbGVtZW50cyA9IHNraWxsc1NlY3Rpb24ucXVlcnlTZWxlY3RvckFsbCgnbGkgc3BhblthcmlhLWhpZGRlbj1cInRydWVcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgc2tpbGxFbGVtZW50cy5mb3JFYWNoKGVsID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNraWxsID0gZWwudGV4dENvbnRlbnQ/LnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChza2lsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNraWxscy5wdXNoKHNraWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YTogUHJvZmlsZVNjcmFwZWREYXRhID0ge1xuICAgICAgICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICAgICAgICBoZWFkbGluZSxcbiAgICAgICAgICAgICAgICAgICAgY29ubmVjdGlvbnMsXG4gICAgICAgICAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgICAgICAgICAgYWJvdXQsXG4gICAgICAgICAgICAgICAgICAgIGV4cGVyaWVuY2UsXG4gICAgICAgICAgICAgICAgICAgIHNraWxscyxcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1NjcmFwZWQgZGF0YTonLCBkYXRhKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YTtcblxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzY3JhcGluZyBwcm9maWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gY2hlY2tBbmRTZW5kRGF0YSgpe1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NlbmRpbmcgZGF0YS4uLicpXG4gICAgICAgICAgICBjb25zdCByYXdEYXRhID0gYXdhaXQgc2NyYXBlSm9iRGF0YSgpO1xuXG4gICAgICAgICAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdQUk9GSUxFX1NDUkFQRURfREFUQScsXG4gICAgICAgICAgICAgICAgZGF0YTogcmF3RGF0YSxcbiAgICAgICAgICAgICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRGF0YSBzZW50IHRvIGJhY2tncm91bmQnKTtcbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHNlbmQgZGF0YTonLCBlcnIpO1xuICAgICAgICAgICAgICAgIH0pLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlzUHJvY2Vzc2luZyA9IGZhbHNlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJbml0aWFsIHNjcmFwZSB3aXRoIGRlbGF5XG4gICAgICAgIHNldFRpbWVvdXQoY2hlY2tBbmRTZW5kRGF0YSwgMTUwMCk7XG5cbiAgICAgICAgLy8gT2JzZXJ2ZSBmb3Igam9iIGNoYW5nZXMgd2l0aCBkZWJvdW5jZVxuICAgICAgICBsZXQgZGVib3VuY2VUaW1lcjogYW55O1xuICAgICAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChkZWJvdW5jZVRpbWVyKTtcbiAgICAgICAgICAgIGRlYm91bmNlVGltZXIgPSBzZXRUaW1lb3V0KGNoZWNrQW5kU2VuZERhdGEsIDgwMCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICAgIHN1YnRyZWU6IHRydWUsXG4gICAgICAgIH0pO1xuICB9LCBcbn0pOyIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2AgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJwcmludCIsImxvZ2dlciJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLG9CQUFvQkEsYUFBWTtBQUM5QyxXQUFPQTtBQUFBLEVBQ1Q7QUNETyxRQUFNQyxZQUFVLFdBQVcsU0FBUyxTQUFTLEtBQ2hELFdBQVcsVUFDWCxXQUFXO0FDRlIsUUFBTSxVQUFVQztBQ1N2QixRQUFBLGFBQUEsb0JBQUE7QUFBQSxJQUFtQyxTQUFBLENBQUEseUJBQUE7QUFBQSxJQUNJLE9BQUE7QUFBQSxJQUM1QixNQUFBLE1BQUE7QUFFSCxjQUFBLElBQUEsa0JBQUE7QUFJQSxlQUFBLFNBQUEsVUFBQSxTQUFBLFVBQUE7QUFDSSxjQUFBLEtBQUEsT0FBQSxjQUFBLFFBQUE7QUFDQSxlQUFBLElBQUEsYUFBQSxLQUFBLEtBQUE7QUFBQSxNQUFrQztBQVd0QyxxQkFBQSxnQkFBQTtBQUNJLGdCQUFBLElBQUEsa0JBQUE7QUFFQSxZQUFBO0FBRUksZ0JBQUEsT0FBQSxTQUFBLHdCQUFBLEtBQUEsU0FBQSxJQUFBLEtBQUEsU0FBQSxvQ0FBQTtBQUtBLGdCQUFBLFdBQUEsU0FBQSxzQkFBQSxLQUFBLFNBQUEsZ0RBQUE7QUFJQSxnQkFBQSxxQkFBQSxNQUFBLEtBQUEsU0FBQSxpQkFBQSxNQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsT0FBQSxHQUFBLGFBQUEsU0FB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
profile;