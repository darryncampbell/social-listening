/**
 * Sanitization utilities for preventing prompt injection attacks
 */

/**
 * Strip HTML tags and decode HTML entities from text
 * Used to clean up content before using in prompts
 */
export function stripHtml(text: string): string {
  if (!text) return '';
  
  // Remove HTML tags
  let cleaned = text.replace(/<[^>]*>/g, '');
  
  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Patterns that could be used for prompt injection
 */
const INJECTION_PATTERNS = [
  // Direct instruction attempts
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi,
  /disregard\s+(all\s+)?(previous|prior|above)/gi,
  /forget\s+(everything|all|what)/gi,
  
  // Role manipulation
  /you\s+are\s+(now|actually|really)/gi,
  /act\s+as\s+(if|a|an)/gi,
  /pretend\s+(to\s+be|you('re)?)/gi,
  /your\s+(new\s+)?role\s+is/gi,
  
  // System prompt extraction
  /what\s+(is|are)\s+your\s+(system\s+)?(prompt|instructions?|rules?)/gi,
  /show\s+(me\s+)?your\s+(system\s+)?(prompt|instructions?)/gi,
  /reveal\s+your\s+(system\s+)?(prompt|instructions?)/gi,
  /output\s+(your\s+)?(system\s+)?(prompt|instructions?)/gi,
  
  // Delimiter escape attempts
  /```\s*(system|assistant|user)/gi,
  /<\|?(system|endoftext|im_start|im_end)\|?>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  
  // Instruction injection
  /^(system|assistant|user):/gim,
  /###\s*(instruction|system|prompt)/gi,
];

/**
 * Check if text contains potential prompt injection attempts
 */
export function containsInjectionAttempt(text: string): boolean {
  if (!text) return false;
  
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      return true;
    }
  }
  
  return false;
}

/**
 * Sanitize text to prevent prompt injection
 * - Removes or neutralizes known injection patterns
 * - Escapes special delimiters
 */
export function sanitizeForPrompt(text: string): string {
  if (!text) return '';
  
  let sanitized = text;
  
  // Replace potential role markers with escaped versions
  sanitized = sanitized.replace(/^(system|assistant|user):/gim, '[$1]:');
  
  // Escape common LLM delimiters
  sanitized = sanitized.replace(/<\|/g, '<｜'); // Use fullwidth vertical line
  sanitized = sanitized.replace(/\|>/g, '｜>');
  sanitized = sanitized.replace(/```(system|assistant|user)/gi, '``` $1');
  
  // Remove INST tags
  sanitized = sanitized.replace(/\[INST\]/gi, '[instruction]');
  sanitized = sanitized.replace(/\[\/INST\]/gi, '[/instruction]');
  
  // Truncate extremely long content that could be used for context stuffing
  const MAX_LENGTH = 5000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH) + '... [truncated]';
  }
  
  return sanitized;
}

/**
 * Wrap user content in clear delimiters to help the model distinguish
 * between instructions and user-provided content
 */
export function wrapUserContent(label: string, content: string): string {
  const sanitized = sanitizeForPrompt(content);
  return `[BEGIN ${label.toUpperCase()}]\n${sanitized}\n[END ${label.toUpperCase()}]`;
}

/**
 * Sanitize a URL to remove potentially malicious content
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  
  // Only allow http and https
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}
