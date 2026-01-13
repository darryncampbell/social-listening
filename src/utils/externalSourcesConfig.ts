const STORAGE_KEY = 'social-listening-external-sources';

// Allowlist of supported hosts for scraping
// Each entry maps hostname patterns to a human-readable name
export const SUPPORTED_HOSTS: { pattern: RegExp; name: string }[] = [
  { pattern: /^(www\.)?skool\.com$/, name: 'Skool' },
];

export interface ExternalSource {
  id: string;
  name: string;
  url: string;
}

export function getExternalSources(): ExternalSource[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveExternalSources(sources: ExternalSource[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
}

/**
 * Check if a hostname is in the supported hosts allowlist
 */
export function isSupportedHost(hostname: string): { supported: boolean; hostName?: string } {
  for (const { pattern, name } of SUPPORTED_HOSTS) {
    if (pattern.test(hostname)) {
      return { supported: true, hostName: name };
    }
  }
  return { supported: false };
}

/**
 * Get a formatted list of supported hosts for display
 */
export function getSupportedHostsList(): string {
  return SUPPORTED_HOSTS.map(h => h.name).join(', ');
}

export function isValidExternalUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { valid: false, error: 'URL must use http or https' };
    }
    
    const hostCheck = isSupportedHost(url.hostname);
    if (!hostCheck.supported) {
      return { 
        valid: false, 
        error: `This host is not supported. Supported: ${getSupportedHostsList()}` 
      };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
