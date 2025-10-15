import { analyzeJobWithAI } from '../lib/background-help/job-summarizer'

interface Skill {
  name: string;
  match: number;
}

interface JobData {
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  posted: string;
  description: string;
}

interface ScrapedData {
  jobData: JobData;
  requirements: string[];
  skills: Skill[];
}

let latestScraped: ScrapedData | null = null;
let isProcessing = false; // Track if AI analysis is in progress

export default defineBackground(() => {
  console.log('🎯 Background script initialized');

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SCRAPING_STARTED':
        // Mark as processing
        console.log('🔄 SCRAPING_STARTED - setting isProcessing = true');
        isProcessing = true;
        
        // Try to notify popup if it's open
        browser.runtime.sendMessage({
          type: 'SCRAPING_STARTED',
        }).catch(() => {
          console.log('Popup not open, state stored in background');
        });
        break;

      case 'JOB_SCRAPED_DATA':
        // Store the scraped data
        const scrapedData = message.data as ScrapedData;
        console.log('📦 JOB_SCRAPED_DATA received');

        if (scrapedData?.jobData.description && scrapedData.jobData.description.length > 100) {
          console.log('🔄 Starting AI analysis in background...');
          
          analyzeJobWithAI(scrapedData.jobData)
            .then(aiResult => {
              console.log('✅ AI Result:', aiResult);

              if (aiResult) {
                // Enrich the data with AI results
                latestScraped = {
                  jobData: {
                    ...scrapedData.jobData,
                    salary: aiResult.salary || scrapedData.jobData.salary,
                    description: aiResult.cleanSummary || scrapedData.jobData.description,
                  },
                  requirements: aiResult.requirements || scrapedData.requirements || [],
                  skills: aiResult.skills || [],
                };
              } else {
                // AI failed, use original data
                latestScraped = scrapedData;
              }

              // Mark as done processing
              isProcessing = false;

              // Relay enriched data to popup
              browser.runtime.sendMessage({
                type: 'RELAYED_JOB_SCRAPED_DATA',
                data: latestScraped,
              }).catch(() => {
                console.log('Popup not open, data stored in background');
              });
            })
            .catch(err => {
              console.error('❌ AI analysis error:', err);
              // Use original data on error
              latestScraped = scrapedData;
              isProcessing = false;
              
              browser.runtime.sendMessage({
                type: 'RELAYED_JOB_SCRAPED_DATA',
                data: latestScraped,
              }).catch(() => {
                console.log('Popup not open, data stored in background');
              });
            });
        } else {
          // No description or too short, skip AI
          console.log('⏭️ Skipping AI analysis (no description)');
          latestScraped = scrapedData;
          isProcessing = false;
          
          browser.runtime.sendMessage({
            type: 'RELAYED_JOB_SCRAPED_DATA',
            data: latestScraped,
          }).catch(() => {
            console.log('Popup not open, data stored in background');
          });
        }
        break;

      case 'PROFILE_SCRAPED_DATA':
        console.log('Background receiving content script call');
        break;

      case 'GET_LATEST_JOB_SCRAPED':
        // Popup requesting stored data and processing state
        console.log('📤 Sending data to popup:', { hasData: !!latestScraped, isProcessing });
        sendResponse({ data: latestScraped, isProcessing });
        return true; // Keep channel open for async

      default:
        break;
    }
  });
});