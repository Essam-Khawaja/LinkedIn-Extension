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

interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  currentRole?: string;
  yearsExperience?: string;
  skills?: string[];
  achievements?: string[];
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
      console.warn("❌ Gemini Nano not available");
      return null;
    }

    if (availability === 'after-download') {
      console.log("⏳ Triggering Gemini Nano download...");
      // @ts-ignore
      await LanguageModel.create();
      return null;
    }

    // @ts-ignore
    const session = await LanguageModel.create();

    const description = jobData.description 
      ? jobData.description.substring(0, 2000)
      : 'No description available';

    // Build user context if profile provided
    const userContext = userProfile ? `
User Profile:
- Name: ${userProfile.name || 'Not provided'}
- Current Role: ${userProfile.currentRole || 'Not provided'}
- Years of Experience: ${userProfile.yearsExperience || 'Not provided'}
- Key Skills: ${userProfile.skills?.join(', ') || 'Not provided'}
- Notable Achievements: ${userProfile.achievements?.join('; ') || 'Not provided'}
` : '';

    const keyRequirements = analyzedData.requirements?.slice(0, 5).join('\n- ') || 'Not analyzed';
    const keySkills = analyzedData.skills?.slice(0, 5).map(s => s.name).join(', ') || 'Not analyzed';

    const prompt = `Generate a professional cover letter for the following job application.

Job Details:
- Position: ${jobData.title}
- Company: ${jobData.company}
- Location: ${jobData.location}

Key Requirements from Job Posting:
- ${keyRequirements}

Key Skills Needed:
${keySkills}

${userContext}

Job Description Summary:
${description}

Instructions:
1. Write a professional, engaging cover letter (250-350 words)
2. Open with a strong hook that shows enthusiasm for the role
3. Highlight 2-3 relevant experiences or skills that match the job requirements
4. Show knowledge of the company (keep it brief and professional)
5. Express genuine interest in contributing to the team
6. Close with a call to action
7. Use a professional but warm tone
8. DO NOT use overly generic phrases like "I am writing to express my interest"
9. Be specific about skills and experiences rather than vague claims
10. Keep paragraphs concise and impactful

Format the letter with:
[Date]

[Hiring Manager/Hiring Team]
${jobData.company}

[Body paragraphs]

Sincerely,
${userProfile?.name || '[Your Name]'}

Return ONLY the cover letter text, no additional commentary.`;

    const result = await session.prompt(prompt);
    console.log("📝 Generated cover letter");

    session.destroy();
    return result.trim();

  } catch (err) {
    console.error("❌ Cover letter generation error:", err);
    return null;
  }
}

async function analyzeJobWithAI(jobData: any) {
  try {
    // @ts-ignore
    const availability = await LanguageModel.availability();
    console.log('✨ AI Availability:', availability);

    if (availability === 'no') {
      console.warn("❌ Gemini Nano not available");
      return null;
    }

    if (availability === 'after-download') {
      console.log("⏳ Triggering Gemini Nano download...");
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
        requirements: {type: "array",
          items: {
            type: "string",
          }
        }
      },
    };

    const prompt = `Analyze this job posting and extract key information.

Job Details:
- Title: ${jobData.title || 'Unknown'}
- Company: ${jobData.company || 'Unknown'}
- Location: ${jobData.location || 'Not specified'}
- Type: ${jobData.type || 'Not specified'}
- Current Salary: ${jobData.salary || "Not specified"}

Full Description:
${description}

IMPORTANT: Only extract information that is explicitly stated in the description. Do not make up or infer information.

Provide a JSON response with:
1. cleanSummary: A 2-3 sentence concise summary of the role
2. salary: Extract salary as "$XX,XXX - $XX,XXX" or "N/A" if not mentioned
3. requirements: Extract 5-7 key qualifications/requirements (prioritize basic qualifications)
4. skills: Array of 5-7 key technical skills with importance rating (0-100)

Example format:
{
  "cleanSummary": "Software engineer role focusing on...",
  "salary": "$80,000 - $120,000",
  "requirements": ["Bachelor's degree in CS", "3+ years experience"],
  "skills": [{"name": "JavaScript", "match": 90}, {"name": "React", "match": 85}]
}

Return ONLY valid JSON matching this structure.`;

    const result = await session.prompt(prompt, {responseConstraint: schema});
    console.log("🤖 Raw AI Response:", result);

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
    return null;
  }
}

export { analyzeJobWithAI, generateCoverLetter };
