const checkPage = async (includeUrl: string) => {
      try {
        const tabs = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        const url = tabs[0]?.url || "";
        return url.includes(includeUrl);
      } catch (error) {
        console.error("Error querying tabs:", error);
        return false;
      }
};

export default checkPage;