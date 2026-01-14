const INTEREST_STORAGE_KEY = 'social-listening-interest';
const RECOGNIZED_USERS_STORAGE_KEY = 'social-listening-recognized-users';
const DEFAULT_INTEREST = 'Darryn Campbell';

// Types for environment config
export interface PredefinedFeed {
  id: string;
  title: string;
  url: string;
}

export interface PredefinedExternalSource {
  id: string;
  name: string;
  url: string;
}

interface EnvConfig {
  interest: string | null;
  predefinedFeeds: PredefinedFeed[] | null;
  predefinedExternalSources: PredefinedExternalSource[] | null;
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
      const emptyConfig: EnvConfig = { interest: null, predefinedFeeds: null, predefinedExternalSources: null };
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

/**
 * Gets predefined external sources from environment variable.
 * Returns empty array if no predefined external sources are set.
 */
export function getPredefinedExternalSources(): PredefinedExternalSource[] {
  return envConfigCache?.predefinedExternalSources || [];
}

/**
 * Checks if there are any predefined external sources from environment variable.
 */
export function hasPredefinedExternalSources(): boolean {
  return (envConfigCache?.predefinedExternalSources?.length ?? 0) > 0;
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

// Recognized users types and functions
export interface RecognizedUser {
  username: string;
  realName: string;
}

/**
 * Get recognized users from localStorage.
 * Handles backward compatibility: converts old string[] format to new RecognizedUser[] format.
 */
export function getRecognizedUsers(): RecognizedUser[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECOGNIZED_USERS_STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    
    // Handle backward compatibility: convert string[] to RecognizedUser[]
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (typeof parsed[0] === 'string') {
        // Old format: string[]
        const migrated: RecognizedUser[] = parsed.map((username: string) => ({
          username: username,
          realName: '',
        }));
        // Save in new format
        saveRecognizedUsers(migrated);
        return migrated;
      }
      // New format: RecognizedUser[]
      return parsed;
    }
    
    return [];
  } catch {
    return [];
  }
}

export function saveRecognizedUsers(users: RecognizedUser[]): void {
  if (typeof window === 'undefined') return;
  // Filter out users with empty usernames and trim whitespace
  const cleanedUsers = users
    .map(u => ({
      username: u.username.trim(),
      realName: u.realName.trim(),
    }))
    .filter(u => u.username.length > 0);
  localStorage.setItem(RECOGNIZED_USERS_STORAGE_KEY, JSON.stringify(cleanedUsers));
}

export function addRecognizedUser(username: string, realName: string = ''): void {
  if (typeof window === 'undefined') return;
  const users = getRecognizedUsers();
  const trimmedUsername = username.trim();
  const normalizedUsername = trimmedUsername.toLowerCase().replace(/^u\//, '');
  
  // Check if user already exists (case-insensitive, ignoring u/ prefix)
  const exists = users.some(u => 
    u.username.toLowerCase().replace(/^u\//, '') === normalizedUsername
  );
  
  if (trimmedUsername && !exists) {
    users.push({
      username: trimmedUsername,
      realName: realName.trim(),
    });
    saveRecognizedUsers(users);
  }
}

export function removeRecognizedUser(username: string): void {
  if (typeof window === 'undefined') return;
  const users = getRecognizedUsers();
  const filtered = users.filter(u => u.username !== username);
  saveRecognizedUsers(filtered);
}

/**
 * Find a recognized user by username (case-insensitive, tolerant of u/ prefix).
 * Returns the RecognizedUser object if found, or null otherwise.
 */
export function findRecognizedUser(username: string): RecognizedUser | null {
  if (!username) return null;
  const users = getRecognizedUsers();
  const normalizedUsername = username.trim().toLowerCase().replace(/^u\//, '');
  
  return users.find(u => 
    u.username.toLowerCase().replace(/^u\//, '') === normalizedUsername
  ) || null;
}

/**
 * Check if a username is recognized (case-insensitive, tolerant of u/ prefix).
 */
export function isRecognizedUser(username: string): boolean {
  return findRecognizedUser(username) !== null;
}

export { DEFAULT_INTEREST };
