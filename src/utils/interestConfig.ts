const INTEREST_STORAGE_KEY = 'social-listening-interest';
const RECOGNIZED_USERS_STORAGE_KEY = 'social-listening-recognized-users';
const DEFAULT_INTEREST = 'Darryn Campbell';

// Types for environment config
export interface PredefinedFeed {
  id: string;
  title: string;
  url: string;
}

interface EnvConfig {
  interest: string | null;
  predefinedFeeds: PredefinedFeed[] | null;
}

// Cache for environment variable overrides
let envConfigCache: EnvConfig | null = null;
let envConfigPromise: Promise<EnvConfig> | null = null;

/**
 * Fetches environment variable overrides from the server.
 * Results are cached to avoid repeated API calls.
 */
export async function fetchEnvConfig(): Promise<EnvConfig> {
  if (envConfigCache !== null) {
    return envConfigCache;
  }
  
  if (envConfigPromise !== null) {
    return envConfigPromise;
  }
  
  envConfigPromise = fetch('/api/config/env')
    .then(res => res.json())
    .then(data => {
      envConfigCache = data;
      return data;
    })
    .catch(() => {
      // On error, return empty config (no overrides)
      const emptyConfig: EnvConfig = { interest: null, predefinedFeeds: null };
      envConfigCache = emptyConfig;
      return emptyConfig;
    });
  
  return envConfigPromise;
}

/**
 * Gets the environment override for interest, if set.
 * Returns null if no override is set.
 */
export function getInterestEnvOverride(): string | null {
  return envConfigCache?.interest || null;
}

/**
 * Checks if interest is overridden by an environment variable.
 */
export function isInterestEnvOverridden(): boolean {
  return envConfigCache?.interest != null;
}

/**
 * Gets predefined feeds from environment variable.
 * Returns empty array if no predefined feeds are set.
 */
export function getPredefinedFeeds(): PredefinedFeed[] {
  return envConfigCache?.predefinedFeeds || [];
}

/**
 * Checks if there are any predefined feeds from environment variable.
 */
export function hasPredefinedFeeds(): boolean {
  return (envConfigCache?.predefinedFeeds?.length ?? 0) > 0;
}

export function getInterest(): string {
  if (typeof window === 'undefined') return DEFAULT_INTEREST;
  // If env override is set, use that
  if (envConfigCache?.interest) {
    return envConfigCache.interest;
  }
  return localStorage.getItem(INTEREST_STORAGE_KEY) || DEFAULT_INTEREST;
}

export function saveInterest(interest: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(INTEREST_STORAGE_KEY, interest.trim());
}

export function resetInterest(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(INTEREST_STORAGE_KEY);
}

// Recognized users functions
export function getRecognizedUsers(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECOGNIZED_USERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveRecognizedUsers(users: string[]): void {
  if (typeof window === 'undefined') return;
  // Filter out empty strings and trim whitespace
  const cleanedUsers = users
    .map(u => u.trim())
    .filter(u => u.length > 0);
  localStorage.setItem(RECOGNIZED_USERS_STORAGE_KEY, JSON.stringify(cleanedUsers));
}

export function addRecognizedUser(username: string): void {
  if (typeof window === 'undefined') return;
  const users = getRecognizedUsers();
  const trimmed = username.trim();
  if (trimmed && !users.includes(trimmed)) {
    users.push(trimmed);
    saveRecognizedUsers(users);
  }
}

export function removeRecognizedUser(username: string): void {
  if (typeof window === 'undefined') return;
  const users = getRecognizedUsers();
  const filtered = users.filter(u => u !== username);
  saveRecognizedUsers(filtered);
}

export function isRecognizedUser(username: string): boolean {
  const users = getRecognizedUsers();
  const trimmed = username.trim().toLowerCase();
  return users.some(u => u.toLowerCase() === trimmed);
}

export { DEFAULT_INTEREST };
