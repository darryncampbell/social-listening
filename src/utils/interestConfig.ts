const INTEREST_STORAGE_KEY = 'social-listening-interest';
const RECOGNIZED_USERS_STORAGE_KEY = 'social-listening-recognized-users';
const DEFAULT_INTEREST = 'Darryn Campbell';

export function getInterest(): string {
  if (typeof window === 'undefined') return DEFAULT_INTEREST;
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
