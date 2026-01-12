const INTEREST_STORAGE_KEY = 'social-listening-interest';
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

export { DEFAULT_INTEREST };
