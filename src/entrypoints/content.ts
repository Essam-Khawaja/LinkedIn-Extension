import type UserProfile from '@/lib/types/user';

export default defineContentScript({
  matches: [
    '*://*.greenhouse.io/*',
    '*://*.lever.co/*',
    '*://*.myworkdayjobs.com/*',
    '*://linkedin.com/jobs/*/apply/*',
    '*://*.linkedin.com/jobs/*/apply/*',
    '*://*.workday.com/*',
    '*://*.icims.com/*',
    '*://*.taleo.net/*'
  ],
  
  async main() {
    console.log('Auto-fill script loaded');
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "start-auto-fill") {
        console.log("Received auto-fill request");

        chrome.runtime.sendMessage({ type: "GET_PROFILE" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Background error:", chrome.runtime.lastError);
            return;
          }
          console.log("Got profile");
          handleAutoFillClick(response.profile);
        });
      }
    });
  }
});

async function handleAutoFillClick(profile: UserProfile) {
  try {
    if (!profile) {
      alert('Please set up your profile first in the extension!');
      return;
    }
    
    const result = await autoFillForm(profile);
    showSuccessMessage(result.filled, result.aiAnswered);
    
  } catch (error) {
    console.error('Auto-fill error:', error);
    alert('Something went wrong. Please try again.');
  }
}

function showSuccessMessage(filledCount: number, aiCount: number) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10001;
    padding: 16px 24px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 14px;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 24px;">✅</span>
      <div>
        <div style="font-weight: 600; color: #10b981;">Auto-fill Complete!</div>
        <div style="color: #6b7280; font-size: 12px; margin-top: 4px;">
          Filled ${filledCount} fields${aiCount > 0 ? ` + ${aiCount} AI answers` : ''}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

interface FieldInfo {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  type: string | null;
  label: string;
  required: boolean;
  confidence: number; // How confident we are about the field type (0-100)
}

function getAllFields(): FieldInfo[] {
  const fields: FieldInfo[] = [];
  
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="file"])'
  );
  const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea');
  const selects = document.querySelectorAll<HTMLSelectElement>('select');
  
  [...inputs, ...textareas, ...selects].forEach(element => {
    // Skip if already filled
    if ('value' in element && element.value && element.value.trim() !== '') {
      return;
    }
    
    const allTextSources = getFieldTextSources(element);
    const detection = detectFieldType(element, allTextSources);
    
    fields.push({
      element,
      type: detection.type,
      label: allTextSources.join(' | '),
      required: isFieldRequired(element, allTextSources),
      confidence: detection.confidence
    });
  });

  console.log(`Detected ${fields.length} fields`);
  console.log('Field types:', fields.map(f => ({ type: f.type, label: f.label.substring(0, 50), confidence: f.confidence })));
  
  return fields;
}

/**
 * Gets ALL possible text sources for a field
 * Returns array of text hints from various sources
 */
function getFieldTextSources(field: HTMLElement): string[] {
  const sources: string[] = [];
  
  // 1. Explicit label with for attribute
  if (field.id) {
    const label = document.querySelector(`label[for="${field.id}"]`);
    if (label?.textContent) {
      sources.push(label.textContent.trim());
    }
  }
  
  // 2. Parent label
  const parentLabel = field.closest('label');
  if (parentLabel?.textContent) {
    sources.push(parentLabel.textContent.trim());
  }
  
  // 3. Previous sibling that's a label or contains text
  let prev = field.previousElementSibling;
  let attempts = 0;
  while (prev && attempts < 3) {
    if (prev.tagName === 'LABEL' && prev.textContent) {
      sources.push(prev.textContent.trim());
      break;
    }
    // Sometimes the label is just a div/span before the input
    if (prev.textContent && prev.textContent.trim().length < 100) {
      sources.push(prev.textContent.trim());
    }
    prev = prev.previousElementSibling;
    attempts++;
  }
  
  // 4. Look in parent container
  const parent = field.closest('div, fieldset, li, td, th');
  if (parent) {
    // Find label elements
    const labelEl = parent.querySelector('label, legend');
    if (labelEl?.textContent) {
      sources.push(labelEl.textContent.trim());
    }
    
    // Find spans/divs that might be labels
    const spans = parent.querySelectorAll('span, div');
    spans.forEach(span => {
      const text = span.textContent?.trim();
      if (text && text.length < 100 && text.length > 2) {
        // Check if this span is close to our field
        if (parent.contains(span) && parent.contains(field)) {
          sources.push(text);
        }
      }
    });
  }
  
  // 5. Attributes
  const ariaLabel = field.getAttribute('aria-label');
  if (ariaLabel) sources.push(ariaLabel);
  
  const ariaLabelledBy = field.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelEl = document.getElementById(ariaLabelledBy);
    if (labelEl?.textContent) sources.push(labelEl.textContent.trim());
  }
  
  const title = field.getAttribute('title');
  if (title) sources.push(title);
  
  // 6. Placeholder
  if ('placeholder' in field) {
    const inputElement = field as HTMLInputElement | HTMLTextAreaElement;
    if (inputElement.placeholder) {
      sources.push(inputElement.placeholder);
    }
  }
  
  // 7. Name and ID attributes (often have hints)
  // @ts-ignore
  if (field.name) sources.push(field.name);
  if (field.id) sources.push(field.id);
  
  // 8. Class names (sometimes contain hints like "first-name-input")
  if (field.className) {
    const classHints = field.className.split(/[\s_-]/).filter(c => c.length > 2);
    sources.push(...classHints);
  }
  
  // 9. Data attributes
  for (const attr of field.attributes) {
    if (attr.name.startsWith('data-') && attr.value && attr.value.length < 50) {
      sources.push(attr.value);
    }
  }
  
  // Remove duplicates and clean
  const unique = [...new Set(sources)]
    .map(s => s.replace(/\*/g, '').trim())
    .filter(s => s.length > 0);
  
  return unique;
}

/**
 * Detects field type with confidence score
 */
function detectFieldType(
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  textSources: string[]
): { type: string | null; confidence: number } {
  // Combine all text sources
  const combinedText = textSources.join(' ').toLowerCase();
  const fieldType = 'type' in field ? field.type : '';
  const autocomplete = field.getAttribute('autocomplete')?.toLowerCase() || '';
  
  // Autocomplete attribute is very reliable
  if (autocomplete) {
    const autocompleteMap: Record<string, string> = {
      'given-name': 'firstName',
      'family-name': 'lastName',
      'name': 'fullName',
      'email': 'email',
      'tel': 'phone',
      'street-address': 'address',
      'address-line1': 'address',
      'address-level2': 'city',
      'address-level1': 'state',
      'postal-code': 'zip',
      'organization': 'currentCompany',
      'organization-title': 'currentTitle'
    };
    
    if (autocompleteMap[autocomplete]) {
      return { type: autocompleteMap[autocomplete], confidence: 95 };
    }
  }
  
  // Email field type is very reliable
  if (fieldType === 'email') {
    return { type: 'email', confidence: 95 };
  }
  
  // Tel field type is reliable
  if (fieldType === 'tel') {
    return { type: 'phone', confidence: 95 };
  }
  
  // Pattern matching with confidence scores
  const patterns: Array<{ keywords: string[]; type: string; confidence: number }> = [
    // High confidence patterns
    { keywords: ['first name', 'firstname', 'fname', 'given name', 'forename'], type: 'firstName', confidence: 90 },
    { keywords: ['last name', 'lastname', 'lname', 'surname', 'family name'], type: 'lastName', confidence: 90 },
    { keywords: ['email', 'e-mail', 'emailaddress'], type: 'email', confidence: 85 },
    { keywords: ['phone', 'telephone', 'mobile', 'phonenumber'], type: 'phone', confidence: 85 },
    
    // Medium confidence patterns
    { keywords: ['full name', 'your name', 'name'], type: 'fullName', confidence: 70 },
    { keywords: ['street', 'address line', 'address1', 'addressline'], type: 'address', confidence: 80 },
    { keywords: ['city', 'town', 'locality'], type: 'city', confidence: 85 },
    { keywords: ['state', 'province', 'region'], type: 'state', confidence: 80 },
    { keywords: ['zip', 'postal', 'postcode', 'zipcode'], type: 'zip', confidence: 85 },
    
    // Professional
    { keywords: ['job title', 'position', 'role', 'jobtitle'], type: 'currentTitle', confidence: 75 },
    { keywords: ['company', 'employer', 'organization', 'companyname'], type: 'currentCompany', confidence: 75 },
    { keywords: ['years experience', 'yearsexperience', 'experience years'], type: 'yearsExperience', confidence: 80 },
    
    // Education & Links
    { keywords: ['education', 'degree', 'university', 'school'], type: 'education', confidence: 75 },
    { keywords: ['linkedin', 'linkedin profile', 'linkedinurl'], type: 'linkedin', confidence: 90 },
    { keywords: ['github', 'github profile', 'githuburl'], type: 'github', confidence: 90 },
    { keywords: ['portfolio', 'website', 'personal site'], type: 'portfolio', confidence: 75 },
    { keywords: ['salary', 'compensation', 'expected salary', 'desiredsalary'], type: 'salaryExpectation', confidence: 80 },
    
    // Checkboxes
    { keywords: ['sponsor', 'visa', 'authorization', 'work auth'], type: 'sponsorship', confidence: 85 },
    { keywords: ['relocate', 'relocation', 'willing to move'], type: 'relocation', confidence: 85 },
  ];
  
  // Check patterns
  for (const pattern of patterns) {
    for (const keyword of pattern.keywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        // Boost confidence if multiple sources mention it
        const matchCount = textSources.filter(s => 
          s.toLowerCase().includes(keyword.toLowerCase())
        ).length;
        const boostedConfidence = Math.min(100, pattern.confidence + (matchCount * 5));
        
        return { type: pattern.type, confidence: boostedConfidence };
      }
    }
  }
  
  // Check for custom questions (textareas with question-like text)
  if (field.tagName === 'TEXTAREA' || fieldType === 'text') {
    const hasQuestionMark = textSources.some(s => s.includes('?'));
    const hasQuestionWords = textSources.some(s => 
      /\b(why|how|what|describe|tell|explain)\b/i.test(s)
    );
    const isLongLabel = textSources.some(s => s.length > 30);
    
    if (hasQuestionMark || (hasQuestionWords && isLongLabel)) {
      return { type: 'customQuestion', confidence: 70 };
    }
  }
  
  return { type: null, confidence: 0 };
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const textLower = text.toLowerCase().replace(/[\s_-]/g, '');
  return keywords.some(keyword => 
    textLower.includes(keyword.toLowerCase().replace(/[\s_-]/g, ''))
  );
}

function isFieldRequired(field: HTMLElement, textSources: string[]): boolean {
  if ('required' in field && field.required) return true;
  if (field.getAttribute('aria-required') === 'true') return true;
  
  return textSources.some(text => 
    text.includes('*') || 
    text.toLowerCase().includes('required') ||
    text.toLowerCase().includes('mandatory')
  );
}

async function autoFillForm(profile: UserProfile) {
  const fields = getAllFields();
  
  // Sort by confidence (fill high-confidence fields first)
  fields.sort((a, b) => b.confidence - a.confidence);
  
  let filledCount = 0;
  let aiAnsweredCount = 0;
  const customQuestions: FieldInfo[] = [];
  
  // First pass: fill standard fields
  for (const fieldInfo of fields) {
    if (!fieldInfo.type) continue;
    
    if (fieldInfo.type === 'customQuestion') {
      customQuestions.push(fieldInfo);
      continue;
    }
    
    // Only fill if confidence is reasonable (>= 60)
    if (fieldInfo.confidence >= 60) {
      const success = fillField(fieldInfo, profile);
      if (success) {
        console.log(`Filled: ${fieldInfo.type} (confidence: ${fieldInfo.confidence})`);
        filledCount++;
      }
    }
  }
  
  console.log(`Filled ${filledCount} standard fields`);
  
  // Second pass: AI for custom questions
  if (customQuestions.length > 0) {
    console.log(`Found ${customQuestions.length} custom questions`);
    const jobContext = extractJobContext();
    
    for (const fieldInfo of customQuestions) {
      if (fieldInfo.confidence >= 60) {
        const answer = await answerCustomQuestion(fieldInfo.label, profile, jobContext);
        if (answer) {
          fillTextField(fieldInfo.element as HTMLInputElement | HTMLTextAreaElement, answer);
          aiAnsweredCount++;
        }
      }
    }
  }
  
  return {
    filled: filledCount,
    aiAnswered: aiAnsweredCount
  };
}

function fillField(fieldInfo: FieldInfo, profile: UserProfile): boolean {
  const { element, type } = fieldInfo;
  
  const value = getValueForFieldType(type, profile);
  if (value === null || value === undefined || value === '') return false;
  
  if (element.tagName === 'SELECT') {
    return fillSelect(element as HTMLSelectElement, value);
  } else if ('type' in element && element.type === 'checkbox') {
    return fillCheckbox(element as HTMLInputElement, value);
  } else if ('type' in element && element.type === 'radio') {
    return fillRadio(element as HTMLInputElement, value);
  } else {
    return fillTextField(element as HTMLInputElement | HTMLTextAreaElement, value);
  }
}

function getValueForFieldType(type: string | null, profile: UserProfile): any {
  if (!type) return null;
  
  const currentJob = (profile.employmentHistory || []).find(job => job.isCurrent);
  const mostRecentJob = (profile.employmentHistory || [])[0];
  const jobToUse = currentJob || mostRecentJob;
  
  const valueMap: Record<string, any> = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: `${profile.firstName} ${profile.lastName}`,
    email: profile.email,
    phone: profile.phone,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    zip: profile.zip,
    currentTitle: jobToUse?.jobTitle || '',
    currentCompany: jobToUse?.company || '',
    yearsExperience: profile.yearsExperience,
    education: profile.education,
    linkedin: profile.linkedin,
    github: profile.github,
    portfolio: profile.portfolio,
    salaryExpectation: profile.salaryExpectation,
    sponsorship: profile.needsSponsorship ? 'yes' : 'no',
    relocation: profile.willingToRelocate ? 'yes' : 'no',
  };
  
  return valueMap[type];
}

function fillTextField(field: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  field.dispatchEvent(new Event('blur', { bubbles: true }));
  
  // React fix
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  return true;
}

function fillSelect(select: HTMLSelectElement, value: any): boolean {
  const options = Array.from(select.options);
  
  let match = options.find(opt => opt.value === value || opt.text === value);
  
  if (!match) {
    const valueLower = value.toString().toLowerCase();
    match = options.find(opt => 
      opt.value.toLowerCase().includes(valueLower) ||
      opt.text.toLowerCase().includes(valueLower)
    );
  }
  
  if (!match && !isNaN(value)) {
    match = options.find(opt => opt.value === value.toString());
  }
  
  if (match) {
    select.value = match.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  
  return false;
}

function fillCheckbox(checkbox: HTMLInputElement, value: any): boolean {
  const shouldCheck = value === true || value === 'yes' || value === 'true';
  checkbox.checked = shouldCheck;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function fillRadio(radio: HTMLInputElement, value: any): boolean {
  const radios = document.querySelectorAll<HTMLInputElement>(`input[name="${radio.name}"]`);
  const valueLower = value.toString().toLowerCase();
  
  const match = Array.from(radios).find(r => {
    const sources = getFieldTextSources(r);
    return sources.some(s => s.toLowerCase().includes(valueLower));
  });
  
  if (match) {
    match.checked = true;
    match.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  
  return false;
}

function extractJobContext() {
  const title = 
    document.querySelector('h1')?.textContent ||
    document.querySelector('[class*="job-title"]')?.textContent ||
    document.querySelector('[class*="JobTitle"]')?.textContent ||
    'this position';
    
  const company = 
    document.querySelector('[class*="company"]')?.textContent ||
    document.querySelector('[class*="Company"]')?.textContent ||
    'this company';

  return {
    title: title.trim(),
    company: company.trim()
  };
}

async function answerCustomQuestion(
  question: string,
  profile: UserProfile,
  jobContext: { title: string; company: string }
): Promise<string | null> {
  const currentJob = (profile.employmentHistory || []).find(job => job.isCurrent);
  const mostRecentJob = (profile.employmentHistory || [])[0];
  const jobToReference = currentJob || mostRecentJob;
  
  const currentRole = jobToReference?.jobTitle || 'Not specified';
  const currentCompany = jobToReference?.company || '';
  const skillsStr = (profile.skills || []).join(', ') || 'Not specified';
  
  let experienceSummary = '';
  if (profile.employmentHistory && profile.employmentHistory.length > 0) {
    experienceSummary = profile.employmentHistory.slice(0, 2).map(job => 
      `${job.jobTitle} at ${job.company} (${job.startDate} - ${job.isCurrent ? 'Present' : job.endDate})`
    ).join('; ');
  }
  
  const prompt = `You are helping someone fill out a job application. Answer this question professionally and concisely (max 100 words):

Question: "${question}"

Job Applying For: ${jobContext.title} at ${jobContext.company}

Candidate Profile:
- Name: ${profile.firstName} ${profile.lastName}
- Current/Recent Role: ${currentRole}${currentCompany ? ` at ${currentCompany}` : ''}
- Total Experience: ${profile.yearsExperience || 0} years
- Key Skills: ${skillsStr}
${experienceSummary ? `- Work History: ${experienceSummary}` : ''}
${profile.education ? `- Education: ${profile.education}` : ''}

Provide only the answer, no preamble or explanation. Be specific and relevant to both the question and the job.`;

  try {
    // @ts-ignore
    const availability = await ai.languageModel.availability();
    if (availability === 'no') return null;
    if (availability === 'after-download') {
      // @ts-ignore
      await ai.languageModel.create();
      return null;
    }

    // @ts-ignore
    const session = await ai.languageModel.create();
    const result = await session.prompt(prompt);
    session.destroy();
    return result.trim();
  } catch (error) {
    console.error('AI answering failed:', error);
    return null;
  }
}