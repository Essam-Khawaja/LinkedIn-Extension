// lib/utils/profileValidation.ts

import type UserProfile from '@/lib/types/user';

/**
 * Validates if a profile is complete enough to use the extension's main features
 * Returns true if all required fields are filled and valid
 */
export function isProfileComplete(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;

  // Check required basic info
  if (profile.firstName?.trim() == '') return false;
  if (profile.lastName?.trim() == '') return false;
  if (profile.email?.trim() == '') return false;
  if (profile.phone?.trim() == '') return false;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(profile.email)) return false;

  // Validate phone format
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
  if (!phoneRegex.test(profile.phone.replace(/\s/g, ''))) return false;

  // Check required location
  if (profile.address?.trim() == '') return false;
  if (profile.city?.trim() == '') return false;
  if (profile.state?.trim() == '') return false;
  if (profile.zip?.trim() == '') return false;

  // Check required professional info
  if (profile.linkedin?.trim() == '') return false;
  if (!(profile.linkedin.includes('linkedin.com'))) return false;

  // Check required skills (at least one)
  if (!profile.skills || profile.skills.length === 0) return false;

  // All required fields are valid
  return true;
}

/**
 * Returns a list of missing required fields for display
 */
export function getMissingFields(profile: UserProfile | null | undefined): string[] {
  if (!profile) return ['Profile not created'];

  const missing: string[] = [];

  if (!profile.firstName?.trim()) missing.push('First Name');
  if (!profile.lastName?.trim()) missing.push('Last Name');
  if (!profile.email?.trim()) missing.push('Email');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) missing.push('Valid Email');
  if (!profile.phone?.trim()) missing.push('Phone');
  if (!profile.address?.trim()) missing.push('Address');
  if (!profile.city?.trim()) missing.push('City');
  if (!profile.state?.trim()) missing.push('State');
  if (!profile.zip?.trim()) missing.push('ZIP Code');
  if (!profile.linkedin?.trim()) missing.push('LinkedIn URL');
  else if (!profile.linkedin.includes('linkedin.com')) missing.push('Valid LinkedIn URL');
  if (!profile.skills || profile.skills.length === 0) missing.push('At least one skill');

  return missing;
}