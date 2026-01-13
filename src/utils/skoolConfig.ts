const SKOOL_STORAGE_KEY = 'social-listening-skool-urls';

export interface SkoolSource {
  id: string;
  name: string;
  url: string;
}

export function getSkoolSources(): SkoolSource[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(SKOOL_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveSkoolSources(sources: SkoolSource[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SKOOL_STORAGE_KEY, JSON.stringify(sources));
}

export function isValidSkoolUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { valid: false, error: 'URL must use http or https' };
    }
    if (url.hostname !== 'www.skool.com' && url.hostname !== 'skool.com') {
      return { valid: false, error: 'Only skool.com URLs are supported' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
