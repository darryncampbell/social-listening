const STORAGE_KEY = 'social-listening-ai-responses';

interface AiResponses {
  [entryId: string]: string;
}

/**
 * Get all AI responses from localStorage
 */
export function getAiResponses(): AiResponses {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

/**
 * Get AI response for a specific entry
 */
export function getAiResponse(entryId: string): string | undefined {
  const responses = getAiResponses();
  return responses[entryId];
}

/**
 * Save AI response for a specific entry
 */
export function saveAiResponse(entryId: string, response: string): void {
  const responses = getAiResponses();
  responses[entryId] = response;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(responses));
}

/**
 * Delete AI response for a specific entry
 */
export function deleteAiResponse(entryId: string): void {
  const responses = getAiResponses();
  delete responses[entryId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(responses));
}
