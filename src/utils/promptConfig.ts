// Article Response Prompt
export const ARTICLE_PROMPT_STORAGE_KEY = 'social-listening-default-prompt';

export const DEFAULT_ARTICLE_PROMPT = `You are drafting a response to the following comment '\${description}' which the author titled '\${title}'.  For context, the full article can be found at \${url}.  You are a senior engineer at LiveKit.

GOAL: Create a thoughtful, technically credible reply that positions the author as a voice AI expert and thought leader.

GUIDELINES:
- Lead with genuine insight or a unique perspective on the topic, not a compliment about the article
- Share practical wisdom from real-world experience building voice AI systems
- Be specific and technical where appropriate (latency, architecture patterns, edge cases)
- It's OK to briefly mention LiveKit if directly relevant, but never be salesy
- Prioritize discussing universal voice AI challenges: latency, turn-taking, interruption handling, ambient noise, speaker diarization, etc.
- If you disagree with something in the article, respectfully offer an alternative viewpoint

FORMAT:
- Keep it concise (1-2 short paragraphs)
- Write in a conversational, approachable tone - not corporate or stiff
- This will be edited by a human, so prioritize information density over polish

DO NOT:
- Start with "Great article!" or similar generic praise
- Be promotional or include calls-to-action
- Use buzzwords without substance`;

// Comment Response Prompt
export const COMMENT_PROMPT_STORAGE_KEY = 'social-listening-comment-prompt';

export const DEFAULT_COMMENT_PROMPT = `You are drafting a response to a comment on the article at \${url} on behalf of a senior engineer at LiveKit.  Specifically, the comment text is \${description}  but consult the article for full context.

GOAL: Create a helpful, conversational reply to the commenter that demonstrates expertise and builds community.

GUIDELINES:
- Directly address the commenter's point or question
- Be helpful and informative without being condescending
- Share relevant technical insights from real-world experience
- It's OK to mention LiveKit if directly relevant to their question, but never be salesy
- If they're asking for help, provide actionable guidance

FORMAT:
- Keep it brief (1 short paragraph)
- Write in a friendly, conversational tone
- This will be edited by a human, so prioritize information density over polish

DO NOT:
- Be dismissive of the commenter's perspective
- Be promotional or include calls-to-action
- Use buzzwords without substance`;

// Legacy alias for backward compatibility
export const PROMPT_STORAGE_KEY = ARTICLE_PROMPT_STORAGE_KEY;
export const DEFAULT_PROMPT = DEFAULT_ARTICLE_PROMPT;

/**
 * Get the article response prompt - returns user's custom prompt from localStorage if set,
 * otherwise returns the default prompt.
 */
export function getPrompt(): string {
  if (typeof window === 'undefined') return DEFAULT_ARTICLE_PROMPT;
  return localStorage.getItem(ARTICLE_PROMPT_STORAGE_KEY) || DEFAULT_ARTICLE_PROMPT;
}

/**
 * Save a custom article prompt to localStorage
 */
export function savePrompt(prompt: string): void {
  localStorage.setItem(ARTICLE_PROMPT_STORAGE_KEY, prompt);
}

/**
 * Reset to default article prompt by removing from localStorage
 */
export function resetPrompt(): void {
  localStorage.removeItem(ARTICLE_PROMPT_STORAGE_KEY);
}

/**
 * Get the comment response prompt - returns user's custom prompt from localStorage if set,
 * otherwise returns the default prompt.
 */
export function getCommentPrompt(): string {
  if (typeof window === 'undefined') return DEFAULT_COMMENT_PROMPT;
  return localStorage.getItem(COMMENT_PROMPT_STORAGE_KEY) || DEFAULT_COMMENT_PROMPT;
}

/**
 * Save a custom comment prompt to localStorage
 */
export function saveCommentPrompt(prompt: string): void {
  localStorage.setItem(COMMENT_PROMPT_STORAGE_KEY, prompt);
}

/**
 * Reset to default comment prompt by removing from localStorage
 */
export function resetCommentPrompt(): void {
  localStorage.removeItem(COMMENT_PROMPT_STORAGE_KEY);
}
