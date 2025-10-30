import UserProfile from '@/lib/types/user';
import { analyzeJobWithAI, generateCoverLetter } from '../lib/background-help/job-summarizer'

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
let isProcessing = false;
let cachedProfile: UserProfile | null = null;

export default defineBackground(() => {
  console.log('Background script initialized');

  // Load profile on startup
  chrome.storage.local.get('profile').then((data) => {
    if (data.profile) {
      cachedProfile = data.profile;
      console.log('Profile loaded on startup');
    }
  });

  // Listen for profile changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.profile) {
      cachedProfile = changes.profile.newValue;
      console.log('Profile cache updated');
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SCRAPING_STARTED':
        console.log('SCRAPING_STARTED');
        isProcessing = true;
        
        browser.runtime.sendMessage({
          type: 'SCRAPING_STARTED',
        }).catch(() => {
          console.log('Popup not open');
        });
        break;

      case 'GET_PROFILE': {
        console.log("GET_PROFILE received");
        
        (async () => {
          try {
            // Use cached profile if available
            if (cachedProfile) {
              sendResponse({ ok: true, profile: cachedProfile });
              return;
            }

            const data = await chrome.storage.local.get('profile');
            cachedProfile = data.profile || null;
            console.log('Sending profile:', cachedProfile);
            sendResponse({ ok: true, profile: cachedProfile });
          } catch (err) {
            console.error("Error in GET_PROFILE:", err);
            sendResponse({ ok: false, error: err!.toString() });
          }
        })();
        return true;
      }

      case 'JOB_SCRAPED_DATA': {
        const scrapedData = message.data as ScrapedData;
        console.log('📦 JOB_SCRAPED_DATA received');

        if (scrapedData?.jobData.description && scrapedData.jobData.description.length > 100) {
          console.log('Starting AI analysis with user profile...');
          
          // Pass user profile to AI for better skill matching
          analyzeJobWithAI(scrapedData.jobData, cachedProfile || undefined)
            .then(aiResult => {
              console.log('AI Result:', aiResult);

              if (aiResult) {
                latestScraped = {
                  jobData: {
                    ...scrapedData.jobData,
                    salary: aiResult.salary || scrapedData.jobData.salary,
                    description: aiResult.cleanSummary || scrapedData.jobData.description,
                  },
                  requirements: aiResult.requirements || [],
                  skills: aiResult.skills || [],
                };
              } else {
                latestScraped = scrapedData;
              }

              isProcessing = false;

              browser.runtime.sendMessage({
                type: 'RELAYED_JOB_SCRAPED_DATA',
                data: latestScraped,
              }).catch(() => console.log('Popup not open'));
            })
            .catch(err => {
              console.error('AI analysis error:', err);
              latestScraped = scrapedData;
              isProcessing = false;
              
              browser.runtime.sendMessage({
                type: 'RELAYED_JOB_SCRAPED_DATA',
                data: latestScraped,
              }).catch(() => console.log('Popup not open'));
            });
        } else {
          console.log('Skipping AI (no description)');
          latestScraped = scrapedData;
          isProcessing = false;
          
          browser.runtime.sendMessage({
            type: 'RELAYED_JOB_SCRAPED_DATA',
            data: latestScraped,
          }).catch(() => console.log('Popup not open'));
        }
        break;
      }

      case 'SAVE_PROFILE': {
        console.log("SAVE_PROFILE received");
        
        (async () => {
          try {
            const profileData = message.data as UserProfile;
            
            // Validate required fields
            if (!profileData.firstName || !profileData.lastName || !profileData.email) {
              sendResponse({ 
                ok: false, 
                error: 'Missing required fields: First Name, Last Name, Email' 
              });
              return;
            }

            // Additional validation
            if (!profileData.phone || !profileData.city || !profileData.state) {
              sendResponse({
                ok: false,
                error: 'Missing required fields: Phone, City, State'
              });
              return;
            }

            if (!profileData.skills || profileData.skills.length === 0) {
              sendResponse({
                ok: false,
                error: 'Please add at least one skill to your profile'
              });
              return;
            }

            // Save to chrome.storage
            await chrome.storage.local.set({ profile: profileData });
            cachedProfile = profileData;
            
            console.log('Profile saved successfully');
            
            sendResponse({ ok: true });
          } catch (err) {
            console.error("Error in SAVE_PROFILE:", err);
            sendResponse({ ok: false, error: err!.toString() });
          }
        })();
        return true;
      }
      
      case 'GENERATE_COVER_LETTER': {
        console.log('GENERATE_COVER_LETTER request received');
        
        (async () => {
          try {
            // Get user profile from cache or storage
            let profile = cachedProfile;
            if (!profile) {
              const { profile: storedProfile } = await chrome.storage.local.get('profile');
              profile = storedProfile;
              cachedProfile = profile;
            }
            
            if (!profile) {
              sendResponse({ 
                ok: false, 
                error: 'No profile found. Please set up your profile first in the Settings tab.' 
              });
              return;
            }

            // Validate profile has minimum required fields
            if (!profile.skills || profile.skills.length === 0) {
              sendResponse({
                ok: false,
                error: 'Your profile needs at least one skill listed. Please update your profile in Settings.'
              });
              return;
            }

            if (!profile.resumeSummary && (!profile.employmentHistory || profile.employmentHistory.length === 0)) {
              sendResponse({
                ok: false,
                error: 'Please add either a resume summary or employment history to your profile for better cover letters.'
              });
              return;
            }

            // Use latest scraped data
            if (!latestScraped) {
              sendResponse({ 
                ok: false, 
                error: 'No job data available. Please open a job posting first.' 
              });
              return;
            }

            console.log('Generating cover letter with:', {
              job: latestScraped.jobData.title,
              user: `${profile.firstName} ${profile.lastName}`,
              skills: profile.skills?.length || 0,
              experience: profile.yearsExperience
            });

            // Generate the cover letter with full profile
            const coverLetter = await generateCoverLetter(
              latestScraped.jobData,
              latestScraped,
              profile
            );

            if (!coverLetter) {
              sendResponse({ 
                ok: false, 
                error: 'Failed to generate cover letter. AI may not be available or still downloading.' 
              });
              return;
            }

            console.log('Cover letter generated successfully');
            sendResponse({ 
              ok: true, 
              coverLetter: coverLetter 
            });

          } catch (err) {
            console.error('Cover letter generation error:', err);
            sendResponse({ 
              ok: false, 
              error: `Failed to generate: ${err!.toString()}` 
            });
          }
        })();
        
        return true;
      }

      case 'GET_LATEST_JOB_SCRAPED':
        console.log('Sending data to popup:', { 
          hasData: !!latestScraped, 
          isProcessing,
          hasProfile: !!cachedProfile 
        });
        sendResponse({ 
          data: latestScraped, 
          isProcessing,
          hasProfile: !!cachedProfile 
        });
        return true;

      default:
        break;
    }
  });
});