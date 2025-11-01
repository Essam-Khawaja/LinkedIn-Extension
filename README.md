# SwiftApply

**AI-Powered Job Application Assistant for Students**

SwiftApply is a Chrome Extension that transforms the job application process for students by leveraging Chrome's built-in AI (Gemini Nano) to provide intelligent job analysis, personalized cover letter generation, and smart profile matching—all running locally on your device with complete privacy.

[![Demo Video](https://img.shields.io/badge/Demo-Watch%20on%20YouTube-red)](https://youtu.be/Z29gxl4zI4I)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Problem Statement

Computer science students applying for internships face a daunting reality: **applying to 100+ positions is now the norm**. This process involves reading through lengthy job descriptions, writing unique cover letters for each application, manually filling out repetitive forms, and tracking applications across multiple platforms.

**The result?** Burnout, missed opportunities, and 80+ hours wasted on repetitive tasks.

Traditional solutions require expensive paid services, compromise privacy by sending data to external servers, or simply don't exist for this specific workflow.

---

## Solution

SwiftApply harnesses **Chrome's built-in Prompt API powered by Gemini Nano** to bring AI assistance directly to LinkedIn job pages, running entirely on-device. This means zero cost, complete privacy, instant responses, and offline capability after initial setup.

### What SwiftApply Does

**AI Job Analysis** - Automatically extracts and summarizes key job requirements using Gemini Nano in 2-5 seconds

**Intelligent Profile Matching** - Calculates fit based on your actual experience, education, skills, and location preferences

**AI Cover Letter Generation** - Creates personalized, professional cover letters tailored to each job and your profile in 10-30 seconds

**Smart Auto-Fill** - Instantly fills application forms with your stored profile data

**Application Tracking** - Organize and track all applications with status management (Pending, Viewed, Interviewing, Rejected, Accepted)

---

## Chrome Built-in AI API Integration

### Prompt API Implementation

SwiftApply extensively uses the **Prompt API** in three critical workflows:

#### 1. Job Analysis with Structured Output

```typescript
const schema = {
  type: "object",
  properties: {
    cleanSummary: { type: "string" },
    salary: { type: "string" },
    skills: { type: "array" },
    requirements: { type: "array" }
  }
};

const result = await session.prompt(prompt, {responseConstraint: schema});
```

The extension analyzes job postings to extract concise summaries, salary ranges, 6-8 key requirements, and technical skills. This allows students to quickly understand if a job is worth applying to without reading 1000+ word descriptions.

#### 2. Personalized Cover Letter Generation

```typescript
const coverLetter = await generateCoverLetter(
  jobData,
  analyzedData,
  userProfile
);
```

Using the Prompt API, SwiftApply generates professional cover letters by analyzing job requirements, matching against the user's employment history and skills, and creating authentic prose formatted as a proper business letter. Writing cover letters is the number one time sink in applications—our AI generates quality, personalized letters in seconds.

#### 3. Profile-Aware Context

```typescript
const userSkillsContext = profile.skills.join(', ');
// AI compares job skills against user's actual skill set
```

The extension passes user skills and experience to the AI for context-aware analysis, helping users understand their fit before investing time in an application.

**Technical Innovation:** We use structured output constraints to ensure reliable, parseable JSON responses from Gemini Nano, making the AI integration robust and production-ready for real-world use.

---

## Key Features

### AI-Powered Job Summarizer
- Automatic extraction of job details when viewing LinkedIn postings
- Real-time AI analysis using Gemini Nano
- Structured summaries with key requirements, skills, salary, and role overview
- Profile match score based on actual qualifications

### Intelligent Cover Letter Generator
- Fully personalized using employment history, skills, and achievements
- Company-specific mentions and tailored messaging
- Professional formatting ready to copy/paste or download
- Edit in-place capability before saving

### Private Profile Management
- Complete profile setup including contact info, experience, education, skills, certifications
- Employment history tracking with multiple positions
- Stored locally using `chrome.storage.local` - never synced to cloud
- One-time setup used across all applications

### Smart Auto-Fill
- One-click form filling for job applications
- Intelligently maps profile data to form fields
- Saves 5-10 minutes per application

### Application Tracker
- Save jobs directly from the summarizer view
- Track status with dropdown selection
- Statistics dashboard showing applications this week and by status
- Direct links back to original job postings
- Delete applications with confirmation

---

## Impact and Scalability

### Time Savings Analysis

**Before SwiftApply:**
- Read job description: 5 minutes
- Write custom cover letter: 30-45 minutes
- Fill out application form: 10 minutes
- Track in spreadsheet: 2 minutes
- **Total: ~50 minutes per application × 100 applications = 83+ hours**

**With SwiftApply:**
- View AI summary: 30 seconds
- Generate cover letter: 30 seconds
- Auto-fill application: 1 minute
- Auto-save to tracker: 1 click
- **Total: ~3 minutes per application × 100 applications = 5 hours**

**Time saved: 78 hours** (nearly two full work weeks)

### Scalability and Reach

**Multi-Region Support:**
- Works on any LinkedIn region (.com, .ca, .uk, etc.)
- Supports remote, hybrid, and location-based job matching
- Handles multiple languages in job postings

**Multiple Audiences:**
- Primary: CS students applying for internships (100,000+ annually in North America)
- Secondary: New graduates, bootcamp students, career changers
- Potential: Any job seeker who wants AI-powered assistance

**Technical Scalability:**
- Can extend to Indeed, Glassdoor, and company career sites
- Handles hundreds of saved applications without performance degradation
- Efficient content script injection only on job pages
- Minimal memory footprint with profile caching

### Why This Wasn't Possible Before

AI-powered job application assistance was previously impractical because:

**Cloud AI costs** - Analyzing 100+ jobs and generating cover letters would be expensive  
**Privacy concerns** - Uploading resumes and personal data to external servers  
**Latency issues** - Network calls make the experience slow and frustrating  
**Offline impossible** - Required constant internet connection  
**Rate limits** - APIs would throttle heavy users applying en masse

**Chrome Built-in AI solves all of these problems:**
- Zero cost, unlimited usage
- Complete on-device privacy
- Instant responses with no network latency
- Works offline after model download
- No throttling or quotas

---

## Technology Stack

**Core Technologies:**
- TypeScript - Type-safe development
- React 18 - Component-based UI
- WXT Framework - Modern Chrome Extension development
- shadcn/ui - High-quality, accessible components
- Tailwind CSS - Utility-first styling

**Chrome APIs:**
- Prompt API (Gemini Nano) - On-device AI inference
- chrome.storage.local - Persistent data storage
- chrome.runtime.messaging - Background, content, and popup communication
- chrome.scripting - Dynamic content script injection
- chrome.tabs - Tab management and URL detection

**Architecture:**
- Background Service Worker - Handles AI processing and storage
- Content Script - Scrapes job data from LinkedIn
- React Popup - User interface and controls
- Message-based communication - Decoupled, reliable data flow

---

## Installation

### Prerequisites

**Chrome Canary or Dev Channel** (required for Gemini Nano)
- Download: [Chrome Canary](https://www.google.com/chrome/canary/)

**Enable Gemini Nano in Chrome:**
1. Navigate to `chrome://flags/#optimization-guide-on-device-model`
2. Set to "Enabled BypassPerfRequirement"
3. Navigate to `chrome://flags/#prompt-api-for-gemini-nano`
4. Set to "Enabled"
5. Relaunch Chrome
6. Open DevTools Console and type: `await ai.languageModel.availability()`
7. If response is "after-download", wait for model download (happens automatically)

### Install Extension

**Build from Source:**

```bash
# Clone the repository
git clone https://github.com/Essam-Khawaja/swiftapply.git
cd swiftapply

# Install dependencies
npm install

# Build the extension
npm run build

# The built extension will be in .output/chrome-mv3
```

**Load in Chrome:**
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` folder
5. Extension icon should appear in toolbar

**Development Mode:**
```bash
npm run dev
```

---

## Usage Guide

### First Time Setup

1. Install extension and click the SwiftApply icon in your toolbar
2. Complete the Profile tab with your information:
   - Basic info (name, email, phone, location)
   - Experience (years, current role, skills)
   - Employment history (add previous positions)
   - Education and certifications
   - Work preferences (remote, relocation, sponsorship)

### Finding and Analyzing Jobs

1. Visit any job posting on LinkedIn
2. Open the SwiftApply extension
3. Extension automatically scrapes and analyzes the job in ~3 seconds
4. Review profile match score, completeness checks, and key requirements
5. See personalized "Why You're a Good Fit" insights

### Generating Cover Letters

1. From Job Summarizer, click "Generate Cover Letter" at the top
2. Wait 10-30 seconds for AI generation
3. Review and edit the cover letter
4. Copy to clipboard or download as text file
5. Use in your LinkedIn application

### Tracking Applications

1. Click "Save to Applications" in Job Summarizer
2. Return to Home tab to see all tracked applications
3. Update status using the dropdown (Pending, Viewed, Interviewing, Rejected, Accepted)
4. Delete applications by hovering and clicking the trash icon
5. View statistics showing applications this week and status breakdown

---

## Demo Video

**Watch our 3-minute demonstration:** [SwiftApply Demo on YouTube](https://youtu.be/Z29gxl4zI4I)

The video demonstrates:
- Extension installation and profile setup
- Navigating to LinkedIn and viewing a job
- AI job analysis with Gemini Nano in real-time
- Profile match calculation
- Complete cover letter generation workflow
- Saving and tracking applications
- Managing application statuses

---

## Architecture

### System Components

**Content Script (linkedin-scraper.ts):**
- Monitors LinkedIn job pages
- Extracts job data (title, company, location, description, salary)
- Debounces updates to avoid excessive processing
- Sends data to background for AI analysis

**Background Worker (background.ts):**
- Manages AI sessions with Gemini Nano
- Processes job analysis requests with structured output
- Generates cover letters with profile context
- Handles storage operations (CRUD for profile and applications)
- Caches profile data for performance

**Popup UI (React Components):**
- JobSummarizer - Displays analyzed job data
- HomeTab - Application tracker and navigation
- ProfileTab - User profile management
- Real-time polling for updates
- Form management with validation

**AI Integration (job-summarizer.ts):**
- `analyzeJobWithAI()` - Extracts structured job data
- `generateCoverLetter()` - Creates personalized letters
- Handles model availability checks
- Implements retry logic and error handling

**Profile Matching (profileMatch.ts):**
- Calculates match score based on real criteria
- Checks experience, education, location, skills
- Generates personalized strengths list
- 100% deterministic (no AI guessing)

---

## Technical Highlights

**Structured Output with Schema Constraints:**
```typescript
const schema = {
  type: "object",
  required: ["cleanSummary", "salary", "skills", "requirements"],
  properties: { /* ... */ }
};
const result = await session.prompt(prompt, {responseConstraint: schema});
```

**Profile-Aware Prompting:**
```typescript
const userContext = `User Skills: ${profile.skills.join(', ')}
Employment History: ${profile.employmentHistory.map(job => job.jobTitle).join(', ')}
When generating the cover letter, emphasize relevant experience...`;
```

**Efficient Session Management:**
```typescript
const session = await LanguageModel.create();
// Use session for processing
session.destroy(); // Clean up resources
```

---

## Future Enhancements

### Near Term
- Summarizer API for quick job description summaries
- Rewriter API to improve cover letter tone and style
- Multi-platform support (Indeed, Glassdoor)
- Export applications to CSV/Excel
- Email reminders for follow-ups

### Long Term
- Writer API for generating application snippets
- Translator API for jobs in other languages
- Interview prep with AI-generated practice questions
- Salary negotiation analysis
- Mobile companion app

---

## Development Experience with Chrome Built-in AI

### What Worked Well

The Prompt API is incredibly powerful and versatile. Structured output constraints make responses reliable and parseable. On-device inference is genuinely fast—2-5 seconds for job analysis and 10-30 seconds for cover letter generation. The lack of API keys, quotas, or costs is liberating for developers and users. Privacy-first design by default is a huge selling point.

### Challenges Encountered

Model availability detection could be clearer. The download trigger behavior is sometimes inconsistent. Error messages could be more descriptive for debugging. There's no progress indicator for long-running prompts, which would improve user experience. Session management documentation could be more comprehensive.

### Feature Requests

Streaming responses would enable real-time feedback. Token counting would help with prompt optimization. Model version and capability detection would improve reliability. A batch processing API for multiple prompts would increase efficiency. Support for few-shot learning or fine-tuning would enable more specialized use cases.

**Overall Assessment:** Chrome Built-in AI is a game-changer for web applications. We're excited to continue building with it and exploring new possibilities.

---

## Contributing

We welcome contributions! This project is open source.

**How to Contribute:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

**Development Setup:**
```bash
npm install          # Install dependencies
npm run dev          # Run in development mode
npm run build        # Build for production
npm run type-check   # Run TypeScript checks
```

**Areas We Need Help:**
- Bug fixes and issue resolution
- New features from our roadmap
- Documentation improvements
- UI/UX enhancements
- Testing coverage
- Localization to other languages

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Contact and Support

**Developer:** [Syed Essam Uddin Khawaja](https://github.com/Essam-Khawaja)  
**Email:** syedessam345@gmail.com
**LinkedIn:** [My LinkedIn](https://linkedin.com/in/syed-essam)

---

## Acknowledgments

Thank you to the Google Chrome Team for creating the built-in AI APIs, the Gemini Nano team for the powerful AI model, and the WXT Framework and shadcn/ui communities for excellent developer tools. Special thanks to all the students who shared their job search struggles and inspired this project.

---

**Built with Chrome Built-in AI | [Star on GitHub](https://github.com/Essam-Khawaja/swiftapply) | [Watch Demo](https://youtu.be/Z29gxl4zI4I)**
