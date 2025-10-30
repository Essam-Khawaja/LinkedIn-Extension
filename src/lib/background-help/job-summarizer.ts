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

interface EmploymentEntry {
  id: string;
  jobTitle: string;
  company: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  yearsExperience: number;
  skills: string[];
  employmentHistory?: EmploymentEntry[];
  education?: string;
  resumeSummary?: string;
  certifications?: string[];
  salaryExpectation?: string;
  linkedin: string;
  portfolio?: string;
  github?: string;
  needsSponsorship: boolean;
  willingToRelocate: boolean;
}

async function generateCoverLetter(
  jobData: JobData, 
  analyzedData: ScrapedData,
  userProfile?: UserProfile
) {
  try {
    // @ts-ignore
    const availability = await LanguageModel.availability();

    if (availability === 'no') {
      console.warn("Gemini Nano not available");
      return null;
    }

    if (availability === 'after-download') {
      console.log("Triggering Gemini Nano download...");
      // @ts-ignore
      await LanguageModel.create();
      return null;
    }

    // @ts-ignore
    const session = await LanguageModel.create();

    const description = jobData.description 
      ? jobData.description.substring(0, 2000)
      : 'No description available';

    // Build comprehensive user context
    const userContext = userProfile ? `
User Profile:
- Name: ${userProfile.firstName} ${userProfile.lastName}
- Contact: ${userProfile.email} | ${userProfile.phone}
- Location: ${userProfile.city}, ${userProfile.state} ${userProfile.zip}
- Years of Experience: ${userProfile.yearsExperience} years
- Key Skills: ${userProfile.skills?.join(', ') || 'Not provided'}
${userProfile.certifications?.length ? `- Certifications: ${userProfile.certifications.join(', ')}` : ''}
${userProfile.education ? `- Education: ${userProfile.education}` : ''}
${userProfile.linkedin ? `- LinkedIn: ${userProfile.linkedin}` : ''}
${userProfile.github ? `- GitHub: ${userProfile.github}` : ''}
${userProfile.portfolio ? `- Portfolio: ${userProfile.portfolio}` : ''}
${userProfile.salaryExpectation ? `- Salary Expectation: ${userProfile.salaryExpectation}` : ''}
${userProfile.needsSponsorship ? '- Note: Requires visa sponsorship' : ''}
${userProfile.willingToRelocate ? '- Willing to relocate' : '- Prefers local opportunities'}

${userProfile.resumeSummary ? `Professional Summary:\n${userProfile.resumeSummary}\n` : ''}

${userProfile.employmentHistory?.length ? `Recent Employment History:
${userProfile.employmentHistory.slice(0, 3).map(job => 
  `- ${job.jobTitle} at ${job.company} (${job.startDate} - ${job.isCurrent ? 'Present' : job.endDate || 'N/A'})${job.description ? '\n  ' + job.description : ''}`
).join('\n')}` : ''}
` : '';

    const keyRequirements = analyzedData.requirements?.slice(0, 5).join('\n- ') || 'Not analyzed';
    const keySkills = analyzedData.skills?.slice(0, 5).map(s => s.name).join(', ') || 'Not analyzed';

    const prompt = `Generate a professional cover letter for the following job application.

Job Details:
- Position: ${jobData.title}
- Company: ${jobData.company}
- Location: ${jobData.location}
- Job Type: ${jobData.type}
${jobData.salary !== 'N/A' ? `- Salary Range: ${jobData.salary}` : ''}

Key Requirements from Job Posting:
- ${keyRequirements}

Key Skills Needed:
${keySkills}

${userContext}

Job Description Summary:
${description}

Instructions:
1. Write a professional, engaging cover letter (300-400 words)
2. Open with a strong hook that shows genuine enthusiasm and explains why this specific role interests you
3. Highlight 2-3 relevant experiences from employment history that directly match job requirements
4. Reference specific skills from the user's profile that align with the job needs
5. If user has relevant certifications or education, weave them naturally into the narrative
6. Show knowledge of ${jobData.company} and explain why you want to work there specifically
7. Address any important considerations (sponsorship needs, relocation willingness) naturally if relevant
8. Express genuine interest in contributing to the team's goals
9. Close with a confident call to action
10. Use a professional but warm, conversational tone
11. DO NOT use generic opening lines like "I am writing to express my interest"
12. Be specific about experiences and achievements rather than vague claims
13. Quantify achievements when possible based on employment descriptions
14. Keep paragraphs concise and impactful (3-4 sentences each)
15. Ensure the letter tells a cohesive story about why this candidate is perfect for this role

Format the letter with proper business letter structure:

${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

Hiring Manager
${jobData.company}
${jobData.location}

[Body paragraphs - 3-4 paragraphs total]

Sincerely,
${userProfile?.firstName || '[Your Name]'} ${userProfile?.lastName || '[Last Name]'}
${userProfile?.email || '[Your Email]'}
${userProfile?.phone || '[Your Phone]'}

Return ONLY the cover letter text, no additional commentary or explanation.`;

    const result = await session.prompt(prompt);
    console.log("Generated cover letter");

    session.destroy();
    return result.trim();

  } catch (err) {
    console.error("Cover letter generation error:", err);
    return null;
  }
}

async function analyzeJobWithAI(jobData: any, userProfile?: UserProfile) {
  try {
    // @ts-ignore
    const availability = await LanguageModel.availability();
    console.log('AI Availability:', availability);

    if (availability === 'no') {
      console.warn("Gemini Nano not available");
      return null;
    }

    if (availability === 'after-download') {
      console.log("Triggering Gemini Nano download...");
      // @ts-ignore
      await LanguageModel.create();
      return null;
    }

    // @ts-ignore
    const session = await LanguageModel.create();

    const description = jobData.description 
      ? jobData.description.substring(0, 1500)
      : 'No description available';

    const schema = {
      type: "object",
      required: ["cleanSummary", "salary", "skills", "requirements"],
      additionalProperties: false,
      properties: {
        cleanSummary: { type: "string" },
        salary: { type: "string" },
        skills: {
          type: "array",
          items: {
            type: "object",
            required: ["name", "match"],
            properties: {
              name: { type: "string" },
              match: { type: "number" },
            },
          },
        },
        requirements: {
          type: "array",
          items: {
            type: "string",
          }
        }
      },
    };

    // Build user context for better skill matching
    const userSkillsContext = userProfile?.skills?.length 
      ? `\n\nUser's Skills for Match Calculation:\n${userProfile.skills.join(', ')}\n\nWhen calculating skill match percentages, be STRICT and REALISTIC:
- Compare each required job skill against the user's skills listed above
- Only give 90-100% for EXACT matches (same skill name)
- Give 70-89% for very closely related skills (e.g., React and React.js)
- Give 50-69% for somewhat related skills (e.g., JavaScript and TypeScript)
- Give 30-49% for transferable but not directly related skills
- Give 0-29% for skills the user clearly doesn't have
- Most skills should fall in the 30-70% range - be critical and realistic
- Don't inflate scores just to be positive`
      : '';

    const prompt = `Analyze this job posting and extract key information.

Job Details:
- Title: ${jobData.title || 'Unknown'}
- Company: ${jobData.company || 'Unknown'}
- Location: ${jobData.location || 'Not specified'}
- Type: ${jobData.type || 'Not specified'}
- Current Salary: ${jobData.salary || "Not specified"}

Full Description:
${description}${userSkillsContext}

IMPORTANT: Only extract information that is explicitly stated in the description. Do not make up or infer information.

Provide a JSON response with:
1. cleanSummary: A 2-3 sentence concise summary of the role and its main focus areas
2. salary: Extract salary as "$XX,XXX - $XX,XXX" or "N/A" if not mentioned. Look for annual salary, hourly rates, or compensation ranges.
3. requirements: Extract 6-8 key qualifications/requirements from the job posting. Prioritize:
   - Educational requirements
   - Years of experience needed
   - Must-have technical skills
   - Certifications or licenses required
   - Key soft skills mentioned
4. skills: Array of 6-8 key technical/professional skills mentioned in the job posting with match ratings:
   - If user skills are provided, BE STRICT with match percentages:
     * 90-100%: User has this EXACT skill listed (exact match only)
     * 70-89%: User has a very closely related skill (e.g., "React" for "React.js")
     * 50-69%: User has a somewhat related skill (e.g., "JavaScript" for "TypeScript")
     * 30-49%: User has transferable skills but not this specific one
     * 0-29%: User does not have this skill or related skills
   - Most matches should be in the 30-70% range unless there's a clear skill overlap
   - Be realistic and critical - don't inflate scores
   - If no user skills provided, estimate general importance/demand (0-100)
   - Prioritize skills explicitly mentioned in the job requirements

Example format:
{
  "cleanSummary": "Software engineer role focusing on full-stack development with React and Node.js, working on customer-facing products in a fast-paced environment.",
  "salary": "$90,000 - $130,000",
  "requirements": [
    "Bachelor's degree in Computer Science or related field",
    "3+ years of professional software development experience",
    "Strong proficiency in JavaScript/TypeScript",
    "Experience with React and modern frontend frameworks",
    "Familiarity with RESTful APIs and microservices",
    "Excellent problem-solving and communication skills"
  ],
  "skills": [
    {"name": "React", "match": 90},
    {"name": "TypeScript", "match": 85},
    {"name": "Node.js", "match": 80},
    {"name": "REST APIs", "match": 75},
    {"name": "Git", "match": 70},
    {"name": "SQL", "match": 65}
  ]
}

Return ONLY valid JSON matching this structure.`;

    const result = await session.prompt(prompt, {responseConstraint: schema});
    console.log("Raw AI Response:", result);

    let cleanedResult = result.trim();
    
    // Remove ```json and ``` if present
    if (cleanedResult.startsWith('```json')) {
      cleanedResult = cleanedResult.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedResult.startsWith('```')) {
      cleanedResult = cleanedResult.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const parsed = JSON.parse(cleanedResult);
    
    session.destroy();
    return parsed;

  } catch (err) {
    console.error("AI analysis error:", err);
    return null;
  }
}

export { analyzeJobWithAI, generateCoverLetter };