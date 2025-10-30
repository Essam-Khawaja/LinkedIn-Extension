import { Application, ApplicationStats } from '../types/application';

const STORAGE_KEY = 'applications';

export async function saveApplication(app: Application): Promise<void> {
  const applications = await getApplications();
  applications.push(app);
  await chrome.storage.local.set({ [STORAGE_KEY]: applications });
}

export async function getApplications(): Promise<Application[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

export async function updateApplicationStatus(
  id: string,
  status: Application['status']
): Promise<void> {
  const applications = await getApplications();
  const index = applications.findIndex((app) => app.id === id);
  if (index !== -1) {
    applications[index].status = status;
    await chrome.storage.local.set({ [STORAGE_KEY]: applications });
  }
}

export async function deleteApplication(id: string): Promise<void> {
  const applications = await getApplications();
  const filtered = applications.filter((app) => app.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

export async function getApplicationStats(): Promise<ApplicationStats> {
  const applications = await getApplications();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const thisWeek = applications.filter(
    (app) => new Date(app.appliedDate) >= weekAgo
  ).length;
  const thisMonth = applications.filter(
    (app) => new Date(app.appliedDate) >= monthAgo
  ).length;

  const byStatus = {
    pending: 0,
    viewed: 0,
    interviewing: 0,
    rejected: 0,
    accepted: 0,
  };

  applications.forEach((app) => {
    byStatus[app.status]++;
  });

  return {
    total: applications.length,
    thisWeek,
    thisMonth,
    byStatus,
  };
}

export function createApplication(
  jobTitle: string,
  company: string,
  location: string,
  salary?: string,
  jobUrl?: string
): Application {
  return {
    id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    jobTitle,
    company,
    location,
    salary,
    appliedDate: new Date().toISOString(),
    status: 'pending',
    jobUrl,
  };
}

// Check if an application already exists for this job
export async function applicationExists(
  jobTitle: string,
  company: string
): Promise<boolean> {
  const applications = await getApplications();
  return applications.some(
    (app) => 
      app.jobTitle.toLowerCase() === jobTitle.toLowerCase() && 
      app.company.toLowerCase() === company.toLowerCase()
  );
}