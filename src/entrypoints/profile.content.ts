interface ProfileScrapedData {
    name: string;
    headline: string;
    connections: string;
    url: string;
    about: string;
    experience: string[];
    skills: string[];
}

export default defineContentScript({
    matches: ['*://*.linkedin.com/in/*'],
    runAt: 'document_idle',
    main: () => {
        console.log('Hey! Im running!')

        let isProcessing = false;

        function safeText(selector: string, parent: Document | Element = document): string {
            const el = parent.querySelector(selector);
            return el?.textContent?.trim() || '';
        }

        // Helper to get all matching elements' text
        function safeTextAll(selector: string, parent: Document | Element = document): string[] {
            const elements = parent.querySelectorAll(selector);
            return Array.from(elements)
                .map(el => el.textContent?.trim() || '')
                .filter(text => text.length > 0);
        }

        async function scrapeJobData(): Promise<ProfileScrapedData | null> {
            console.log('Scraping data...');

            try {
                // Name - usually in h1 at the top of the profile
                const name = safeText('h1.text-heading-xlarge') || 
                             safeText('h1') ||
                             safeText('[data-generated-suggestion-target]');

                // Headline - typically right below name
                const headline = safeText('div.text-body-medium') ||
                                safeText('.pv-text-details__left-panel .text-body-medium');

                // Connections - look for connection count text
                const connectionsElement = Array.from(document.querySelectorAll('span'))
                    .find(el => el.textContent?.includes('connection'));
                const connections = connectionsElement?.textContent?.trim() || '';

                // URL - current page URL
                const url = window.location.href;

                // About section - Enhanced debug version
                let about = '';
                console.log('Looking for About section...');
                
                const allSections = document.querySelectorAll('section');
                console.log('Found sections:', allSections.length);
                
                // Log ALL sections to see what we have
                allSections.forEach((section, idx) => {
                    const heading = section.querySelector('h2, h3, div[class*="headline"]');
                    const headingText = heading?.textContent?.trim() || 'NO HEADING';
                    const sectionId = section.id || 'NO ID';
                    const classes = section.className || 'NO CLASSES';
                    console.log(`Section ${idx}: ID="${sectionId}", Heading="${headingText}", Classes="${classes}"`);
                });
                
                // Look for section with id containing "about" or heading with "About"
                const aboutSection = Array.from(allSections).find(section => {
                    // Skip toolbar sections
                    if (section.classList.contains('scaffold-layout-toolbar')) {
                        console.log('Skipping toolbar section');
                        return false;
                    }
                    
                    // Check for id with "about"
                    const hasAboutId = section.id?.toLowerCase().includes('about');
                    
                    // Check for h2/h3/div with "About" text
                    const heading = section.querySelector('h2, h3, div[class*="headline"]');
                    const headingText = heading?.textContent?.trim().toLowerCase() || '';
                    const hasAboutHeading = headingText === 'about';
                    
                    const isAbout = hasAboutId || hasAboutHeading;
                    if (isAbout) {
                        console.log('Found About section with ID:', section.id, 'Heading:', headingText);
                    }
                    return isAbout;
                });
                
                if (aboutSection) {
                    console.log('About section HTML:', aboutSection.innerHTML.substring(0, 500));
                    
                    // Try multiple selectors
                    const selectors = [
                        '.inline-show-more-text',
                        '.pv-shared-text-with-see-more',
                        'div.full-width span[aria-hidden="true"]',
                        '.pv-about__summary-text',
                        'div > span',
                    ];
                    
                    for (const sel of selectors) {
                        const el = aboutSection.querySelector(sel);
                        const text = el?.textContent?.trim() || '';
                        if (text && text.length > 20) {  // Must be substantial text
                            about = text;
                            console.log('About found with selector:', sel, 'Length:', text.length);
                            break;
                        }
                    }
                    
                    if (!about) {
                        console.log('Trying all spans in about section...');
                        const spans = aboutSection.querySelectorAll('span');
                        const longText = Array.from(spans)
                            .map(s => s.textContent?.trim() || '')
                            .filter(t => t.length > 50)
                            .sort((a, b) => b.length - a.length)[0];  // Get longest text
                        about = longText || '';
                    }
                } else {
                    console.log('No about section found - check the section list above!');
                }

                // Experience section
                const experience: string[] = [];
                const experienceSection = Array.from(document.querySelectorAll('section'))
                    .find(section => {
                        const heading = section.querySelector('h2, div[id*="experience"]');
                        return heading?.textContent?.toLowerCase().includes('experience');
                    });

                if (experienceSection) {
                    // Look for list items containing experience entries
                    const experienceItems = experienceSection.querySelectorAll('li.artdeco-list__item, ul > li');
                    
                    experienceItems.forEach(item => {
                        // Try to extract job title, company, and duration
                        const title = safeText('[data-field="experience-position-title"], .mr1.t-bold span', item) ||
                                     safeText('.display-flex.align-items-center span[aria-hidden="true"]', item);
                        
                        const company = safeText('[data-field="experience-company-name"], .t-14.t-normal span', item);
                        
                        const duration = safeText('[data-field="experience-date-range"], .t-14.t-normal.t-black--light span', item);

                        if (title) {
                            const experienceEntry = [title, company, duration]
                                .filter(Boolean)
                                .join(' | ');
                            experience.push(experienceEntry);
                        }
                    });
                }

                // Skills section
                const skills: string[] = [];
                const skillsSection = Array.from(document.querySelectorAll('section'))
                    .find(section => {
                        const heading = section.querySelector('h2, div[id*="skills"]');
                        return heading?.textContent?.toLowerCase().includes('skill');
                    });

                if (skillsSection) {
                    // Skills are usually in list items or spans
                    const skillElements = skillsSection.querySelectorAll('li span[aria-hidden="true"]');
                    skillElements.forEach(el => {
                        const skill = el.textContent?.trim();
                        if (skill) {
                            skills.push(skill);
                        }
                    });
                }

                const data: ProfileScrapedData = {
                    name,
                    headline,
                    connections,
                    url,
                    about,
                    experience,
                    skills,
                };

                console.log('Scraped data:', data);
                return data;

            } catch (error) {
                console.error('Error scraping profile:', error);
                return null;
            }
        }


        async function checkAndSendData(){
            console.log('Sending data...')
            const rawData = await scrapeJobData();

            browser.runtime.sendMessage({
                type: 'PROFILE_SCRAPED_DATA',
                data: rawData,
                }).then(() => {
                console.log('Data sent to background');
                }).catch((err) => {
                console.error('Failed to send data:', err);
                }).finally(() => {
                isProcessing = false;
            });
        }

        // Initial scrape with delay
        setTimeout(checkAndSendData, 1500);

        // Observe for job changes with debounce
        let debounceTimer: any;
        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(checkAndSendData, 800);
        });

        observer.observe(document.body, {
        childList: true,
        subtree: true,
        });
  }, 
});