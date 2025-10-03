export default defineContentScript({
  matches: ['*://*.linkedin.com/jobs/*'],
  runAt: 'document_idle',
main: () => {
    console.log("🚀 LinkedIn extended scraping script running...");

    let lastJobData: any = null;

    const observer = new MutationObserver(() => {
      const titleEl = document.querySelector('.top-card-layout__title');
      const companyEl = document.querySelector('.top-card-layout__company-url a, .job-details-jobs-unified-top-card__company-name');
      const locationEl = document.querySelector('.top-card-layout__first-subline, .topcard__flavor--bullet');
      const typeEl = document.querySelector('.job-criteria__text'); // often first one is job type
      const salaryEl = Array.from(document.querySelectorAll('.job-criteria__text')).find(el => el.textContent?.includes('$'));
      const postedEl = document.querySelector('.posted-time-ago__text');

      if (!titleEl || !companyEl) return;

      const jobData = {
        title: titleEl.textContent?.trim() || "",
        company: companyEl.textContent?.trim() || "",
        location: locationEl?.textContent?.trim() || "",
        type: typeEl?.textContent?.trim() || "",
        salary: salaryEl?.textContent?.trim() || "",
        posted: postedEl?.textContent?.trim() || "",
      };

      // Only send if job data changed
      const hasChanged = JSON.stringify(jobData) !== JSON.stringify(lastJobData);
      if (hasChanged) {
        lastJobData = jobData;

        // Optionally, extract skills from requirements if they exist
        const requirementsEls = document.querySelectorAll('.description__job-criteria-text, .show-more-less-html__markup li');
        const requirements = Array.from(requirementsEls).map(el => el.textContent?.trim() || "");

        // Example simple skill matching (could be improved with NLP later)
        const skills = ['React', 'TypeScript', 'Next.js', 'GraphQL', 'Testing'].map(skill => {
          const match = requirements.filter(r => r.toLowerCase().includes(skill.toLowerCase())).length;
          return { name: skill, match: Math.min(match * 20, 100) }; // crude match percentage
        });

        const scrapedData = { jobData, requirements, skills: skills };
        
        console.log("Scraped Job Data:", scrapedData);
        browser.runtime.sendMessage({
          type: 'SCRAPED_DATA',
          data: { jobData, requirements, skills },
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  },
});
