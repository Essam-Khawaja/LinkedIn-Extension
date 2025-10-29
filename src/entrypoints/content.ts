import type UserProfile from '@/lib/types/user';
import type { EmploymentEntry } from '@/lib/types/user';

export default defineContentScript({
  matches: [
    '*://*.greenhouse.io/*',
    '*://*.lever.co/*',
    '*://*.myworkdayjobs.com/*',
    '*://linkedin.com/jobs/*/apply/*',
    '*://*.linkedin.com/jobs/*/apply/*'
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
    
    // Do the auto-fill
    const result = await autoFillForm(profile);
    
    // Show success
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
    animation: slideIn 0.3s ease-out;
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
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

interface FieldInfo {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  type: string | null;
  label: string;
  required: boolean;
}

function getAllFields(): FieldInfo[] {
  const fields: FieldInfo[] = [];
  
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])'
  );
  const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea');
  const selects = document.querySelectorAll<HTMLSelectElement>('select');
  
  [...inputs, ...textareas, ...selects].forEach(element => {
    const label = getFieldLabel(element);
    const type = detectFieldType(element, label);
    const required = isFieldRequired(element, label);
    
    fields.push({
      element,
      type,
      label,
      required
    });
  });

  console.log('Detected fields:', fields.length);
  
  return fields;
}

function getFieldLabel(field: HTMLElement): string {
  if (field.id) {
    const label = document.querySelector(`label[for="${field.id}"]`);
    if (label?.textContent) return label.textContent.trim();
  }
  
  const parentLabel = field.closest('label');
  if (parentLabel?.textContent) return parentLabel.textContent.trim();
  
  let prev = field.previousElementSibling;
  while (prev) {
    if (prev.tagName === 'LABEL' && prev.textContent) {
      return prev.textContent.trim();
    }
    prev = prev.previousElementSibling;
  }
  
  const parent = field.closest('div, fieldset, li');
  if (parent) {
    const labelEl = parent.querySelector('label, legend');
    if (labelEl?.textContent) return labelEl.textContent.trim();
  }
  
  const ariaLabel = field.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  
  if ('placeholder' in field) {
    const inputElement = field as HTMLInputElement | HTMLTextAreaElement;
    if (inputElement.placeholder) {
      return inputElement.placeholder;
    }
  }
  
  return '';
}

function detectFieldType(
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  label: string
): string | null {
  const searchText = label.toLowerCase();
  const fieldName = field.name.toLowerCase();
  const fieldId = field.id.toLowerCase();
  
  const searchIn = `${searchText} ${fieldName} ${fieldId}`;
  
  // Basic Info
  if (matchesKeywords(searchIn, ['first name', 'firstname', 'given name', 'fname'])) {
    return 'firstName';
  }
  if (matchesKeywords(searchIn, ['last name', 'lastname', 'surname', 'family name', 'lname'])) {
    return 'lastName';
  }
  if (matchesKeywords(searchIn, ['full name', 'your name', 'legal name']) && !searchIn.includes('first') && !searchIn.includes('last')) {
    return 'fullName';
  }
  if (matchesKeywords(searchIn, ['email', 'e-mail', 'email address'])) {
    return 'email';
  }
  if (matchesKeywords(searchIn, ['phone', 'telephone', 'mobile', 'cell', 'contact number'])) {
    return 'phone';
  }
  
  // Location
  if (matchesKeywords(searchIn, ['street address', 'address line', 'address']) && !searchIn.includes('email')) {
    return 'address';
  }
  if (matchesKeywords(searchIn, ['city', 'town'])) {
    return 'city';
  }
  if (matchesKeywords(searchIn, ['state', 'province', 'region'])) {
    return 'state';
  }
  if (matchesKeywords(searchIn, ['zip', 'postal code', 'postcode', 'zip code'])) {
    return 'zip';
  }
  
  // Professional
  if (matchesKeywords(searchIn, ['job title', 'current title', 'position', 'role']) && !searchIn.includes('desired')) {
    return 'currentTitle';
  }
  if (matchesKeywords(searchIn, ['company', 'employer', 'organization', 'current company'])) {
    return 'currentCompany';
  }
  if (matchesKeywords(searchIn, ['years of experience', 'years experience', 'experience'])) {
    return 'yearsExperience';
  }
  
  // Education
  if (matchesKeywords(searchIn, ['education', 'degree', 'university', 'school', 'college'])) {
    return 'education';
  }
  
  // Links
  if (matchesKeywords(searchIn, ['linkedin', 'linkedin profile', 'linkedin url'])) {
    return 'linkedin';
  }
  if (matchesKeywords(searchIn, ['github', 'github profile', 'github url'])) {
    return 'github';
  }
  if (matchesKeywords(searchIn, ['portfolio', 'website', 'personal site', 'personal website'])) {
    return 'portfolio';
  }
  
  // Compensation
  if (matchesKeywords(searchIn, ['salary', 'compensation', 'expected salary', 'salary expectation', 'desired salary'])) {
    return 'salaryExpectation';
  }
  
  // Checkboxes
  if ('type' in field && (field.type === 'checkbox' || field.type === 'radio')) {
    if (matchesKeywords(searchIn, ['sponsor', 'visa', 'authorized to work', 'work authorization', 'require sponsorship'])) {
      return 'sponsorship';
    }
    if (matchesKeywords(searchIn, ['relocate', 'relocation', 'willing to move', 'willing to relocate'])) {
      return 'relocation';
    }
    return 'checkbox-unknown';
  }
  
  // Custom questions
  if (field.tagName === 'TEXTAREA' || ('type' in field && field.type === 'text')) {
    if (label.length > 30 || label.includes('?') || label.includes('why') || label.includes('describe') || label.includes('tell us')) {
      return 'customQuestion';
    }
  }
  
  return null;
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword));
}

function isFieldRequired(field: HTMLElement, label: string): boolean {
  if ('required' in field && field.required) return true;
  if (field.getAttribute('aria-required') === 'true') return true;
  if (label.includes('*')) return true;
  if (label.toLowerCase().includes('required')) return true;
  return false;
}

async function autoFillForm(profile: UserProfile) {
  const fields = getAllFields();
  
  let filledCount = 0;
  let aiAnsweredCount = 0;
  const customQuestions: FieldInfo[] = [];
  
  // First pass: fill all standard fields
  for (const fieldInfo of fields) {
    if (!fieldInfo.type) continue;
    
    // Collect custom questions for AI later
    if (fieldInfo.type === 'customQuestion') {
      customQuestions.push(fieldInfo);
      continue;
    }
    
    // Fill standard fields
    const success = fillField(fieldInfo, profile);
    if (success) {
      console.log(`Filled: ${fieldInfo.type}`);
      filledCount++;
    }
  }
  
  console.log(`Filled ${filledCount} standard fields`);
  
  // Second pass: use AI for custom questions (if available)
  if (customQuestions.length > 0) {
    console.log(`Found ${customQuestions.length} custom questions`);
    const jobContext = extractJobContext();
    
    for (const fieldInfo of customQuestions) {
      const answer = await answerCustomQuestion(fieldInfo.label, profile, jobContext);
      if (answer) {
        fillTextField(fieldInfo.element as HTMLInputElement | HTMLTextAreaElement, answer);
        aiAnsweredCount++;
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
  
  // Fill based on element type
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
  
  // Get current job if employment history exists
  const currentJob = (profile.employmentHistory || []).find(job => job.isCurrent);
  const mostRecentJob = (profile.employmentHistory || [])[0]; // First entry
  const jobToUse = currentJob || mostRecentJob;
  
  const valueMap: Record<string, any> = {
    // Basic
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: `${profile.firstName} ${profile.lastName}`,
    email: profile.email,
    phone: profile.phone,
    
    // Location
    address: profile.address,
    city: profile.city,
    state: profile.state,
    zip: profile.zip,
    
    // Professional (use employment history if available, fallback to old fields)
    currentTitle: jobToUse?.jobTitle || '',
    currentCompany: jobToUse?.company || '',
    yearsExperience: profile.yearsExperience,
    
    // Education
    education: profile.education,
    
    // Links
    linkedin: profile.linkedin,
    github: profile.github,
    portfolio: profile.portfolio,
    
    // Compensation
    salaryExpectation: profile.salaryExpectation,
    
    // Preferences
    sponsorship: profile.needsSponsorship ? 'yes' : 'no',
    relocation: profile.willingToRelocate ? 'yes' : 'no',
  };
  
  return valueMap[type];
}

function fillTextField(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: string
): boolean {
  field.value = value;
  triggerInputEvents(field);
  return true;
}

function fillSelect(select: HTMLSelectElement, value: any): boolean {
  const options = Array.from(select.options);
  
  // Try exact match
  let match = options.find(opt => 
    opt.value === value || opt.text === value
  );
  
  // Try fuzzy match
  if (!match) {
    const valueLower = value.toString().toLowerCase();
    match = options.find(opt => 
      opt.value.toLowerCase().includes(valueLower) ||
      opt.text.toLowerCase().includes(valueLower)
    );
  }
  
  // Try numeric match (for years of experience)
  if (!match && !isNaN(value)) {
    match = options.find(opt => opt.value === value.toString());
  }
  
  if (match) {
    select.value = match.value;
    triggerInputEvents(select);
    return true;
  }
  
  return false;
}

function fillCheckbox(checkbox: HTMLInputElement, value: any): boolean {
  const shouldCheck = value === true || value === 'yes' || value === 'true';
  checkbox.checked = shouldCheck;
  triggerInputEvents(checkbox);
  return true;
}

function fillRadio(radio: HTMLInputElement, value: any): boolean {
  const radios = document.querySelectorAll<HTMLInputElement>(`input[name="${radio.name}"]`);
  const valueLower = value.toString().toLowerCase();
  
  const match = Array.from(radios).find(r => {
    const label = getFieldLabel(r).toLowerCase();
    return label.includes(valueLower) || r.value.toLowerCase() === valueLower;
  });
  
  if (match) {
    match.checked = true;
    triggerInputEvents(match);
    return true;
  }
  
  return false;
}

function triggerInputEvents(element: HTMLElement) {
  const events = [
    new Event('input', { bubbles: true }),
    new Event('change', { bubbles: true }),
    new Event('blur', { bubbles: true }),
  ];
  
  events.forEach(event => element.dispatchEvent(event));
  
  // Special handling for React
  if ('value' in element) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, (element as any).value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

function extractJobContext() {
  const title = 
    document.querySelector('h1')?.textContent ||
    document.querySelector('[class*="job-title"]')?.textContent ||
    'this position';
    
  const company = 
    document.querySelector('[class*="company"]')?.textContent ||
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
  // Get current or most recent job
  const currentJob = (profile.employmentHistory || []).find(job => job.isCurrent);
  const mostRecentJob = (profile.employmentHistory || [])[0];
  const jobToReference = currentJob || mostRecentJob;
  
  const currentRole = jobToReference?.jobTitle || 'Not specified';
  const currentCompany = jobToReference?.company || '';
  
  // Build skills string
  const skillsStr = (profile.skills || []).join(', ') || 'Not specified';
  
  // Build experience summary from employment history
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
    // @ts-ignore - Chrome AI API
    const availability = await ai.languageModel.availability();

    if (availability === 'no') {
      console.warn("Gemini Nano not available");
      return null;
    }

    if (availability === 'after-download') {
      console.log("Triggering Gemini Nano download");
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