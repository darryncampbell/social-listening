export interface OpenGraphData {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  ogSiteName?: string;
}

export interface RssEntry {
  id: string; // Extracted from link
  feedId: string;
  feedTitle: string;
  rawXml: string;
  link: string;
  title: string;
  publishedDate: string;
  description: string;
  og?: OpenGraphData;
  ogLoading?: boolean;
}

export interface ParsedFeed {
  feedId: string;
  feedTitle: string;
  entries: RssEntry[];
  error?: string;
}

/**
 * Extract text content from a tag, handling CDATA
 */
function extractTagContent(xml: string, tagName: string): string {
  // Match tag with optional attributes, handling both regular content and CDATA
  const patterns = [
    // CDATA content
    new RegExp(`<${tagName}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tagName}>`, 'i'),
    // Regular content (non-greedy)
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * Clean up redirect URLs (e.g., Google redirect URLs)
 * Extracts the actual target URL from wrappers like:
 * https://www.google.com/url?...url=https://actual-url.com&...
 */
function cleanRedirectUrl(url: string): string {
  try {
    // Check if this is a Google redirect URL
    if (url.includes('google.com/url?') || url.includes('google.com/url?')) {
      const urlObj = new URL(url);
      const targetUrl = urlObj.searchParams.get('url');
      if (targetUrl) {
        return targetUrl;
      }
    }
    
    // Add other redirect cleaners here if needed
    // (e.g., bit.ly, t.co, etc. could be expanded here)
    
    return url;
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Extract link from an entry XML
 */
function extractLink(entryXml: string): string {
  let link = '';
  
  // Try Atom format: <link href="..." /> or <link href="..."></link>
  // Look for rel="alternate" first, then any link with href
  const atomAltMatch = entryXml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (atomAltMatch) {
    link = atomAltMatch[1];
  }
  
  if (!link) {
    const atomLinkMatch = entryXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    if (atomLinkMatch) {
      link = atomLinkMatch[1];
    }
  }

  // Try RSS format: <link>...</link>
  if (!link) {
    const rssLink = extractTagContent(entryXml, 'link');
    if (rssLink) {
      link = rssLink;
    }
  }

  // Try guid as fallback
  if (!link) {
    const guid = extractTagContent(entryXml, 'guid');
    if (guid && guid.startsWith('http')) {
      link = guid;
    }
  }

  // Fallback: generate a hash from the content
  if (!link) {
    return `entry-${hashString(entryXml)}`;
  }

  // Decode HTML entities in the URL and clean redirect URLs
  link = decodeHtmlEntities(link);
  link = cleanRedirectUrl(link);
  
  return link;
}

/**
 * Extract title from an entry XML
 */
function extractTitle(entryXml: string): string {
  const title = extractTagContent(entryXml, 'title');
  if (title) {
    return stripHtmlTags(title);
  }
  return '';
}

/**
 * Extract published date from an entry XML
 */
function extractPublishedDate(entryXml: string): string {
  // Try various date tags
  const dateTags = ['published', 'updated', 'pubDate', 'dc:date', 'date'];
  
  for (const tag of dateTags) {
    const dateStr = extractTagContent(entryXml, tag);
    if (dateStr) {
      return formatDate(dateStr);
    }
  }

  return '';
}

/**
 * Extract description or content from an entry XML
 */
function extractDescription(entryXml: string): string {
  // Try various content tags in order of preference
  const contentTags = ['content:encoded', 'content', 'description', 'summary'];
  
  for (const tag of contentTags) {
    const content = extractTagContent(entryXml, tag);
    if (content) {
      return stripHtmlTags(content);
    }
  }

  return '';
}

/**
 * Format a date string to locale format
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Strip HTML tags and clean text
 */
function stripHtmlTags(html: string): string {
  let text = html;
  
  // First, remove HTML-encoded tags: &lt;...&gt; patterns
  text = text.replace(/&lt;[^&]*&gt;/gi, '');
  
  // Remove script and style elements entirely
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Replace block-level elements with newlines
  text = text.replace(/<\/(p|div|br|h[1-6]|li)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities (but not &lt; and &gt; since we want those removed)
  text = decodeHtmlEntities(text);
  
  // Normalize whitespace (preserve single newlines)
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n');
  text = text.replace(/^\s+|\s+$/gm, '');
  text = text.trim();
  
  return text;
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract Open Graph meta tags from HTML
 */
function extractOgData(html: string): OpenGraphData {
  const og: OpenGraphData = {};
  
  // Match meta tags with og: properties
  const metaMatches = html.matchAll(/<meta[^>]*property=["']og:([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*\/?>/gi);
  for (const match of metaMatches) {
    const property = match[1].toLowerCase();
    const content = decodeHtmlEntities(match[2]);
    
    switch (property) {
      case 'title':
        og.ogTitle = content;
        break;
      case 'description':
        og.ogDescription = content;
        break;
      case 'image':
        og.ogImage = content;
        break;
      case 'url':
        og.ogUrl = content;
        break;
      case 'type':
        og.ogType = content;
        break;
      case 'site_name':
        og.ogSiteName = content;
        break;
    }
  }
  
  // Also try content before property (some sites do it this way)
  const metaMatchesAlt = html.matchAll(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:([^"']+)["'][^>]*\/?>/gi);
  for (const match of metaMatchesAlt) {
    const content = decodeHtmlEntities(match[1]);
    const property = match[2].toLowerCase();
    
    switch (property) {
      case 'title':
        if (!og.ogTitle) og.ogTitle = content;
        break;
      case 'description':
        if (!og.ogDescription) og.ogDescription = content;
        break;
      case 'image':
        if (!og.ogImage) og.ogImage = content;
        break;
      case 'url':
        if (!og.ogUrl) og.ogUrl = content;
        break;
      case 'type':
        if (!og.ogType) og.ogType = content;
        break;
      case 'site_name':
        if (!og.ogSiteName) og.ogSiteName = content;
        break;
    }
  }
  
  return og;
}

/**
 * Check if a URL is from Reddit
 */
function isRedditUrl(url: string): boolean {
  return url.includes('reddit.com');
}

/**
 * Fetch Open Graph data for a URL
 * For Reddit URLs, skip fetching and return static Reddit branding
 */
export async function fetchOgData(url: string): Promise<OpenGraphData | undefined> {
  try {
    if (!url || !url.startsWith('http')) {
      return undefined;
    }
    
    // Skip OG fetching for Reddit URLs - they rate limit and block requests
    // Return static Reddit branding instead
    if (isRedditUrl(url)) {
      return {
        ogImage: '/reddit-logo.svg',
        ogSiteName: 'Reddit',
      };
    }
    
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      return undefined;
    }
    
    const html = await response.text();
    const og = extractOgData(html);
    
    // Only return if we got at least some OG data
    if (og.ogTitle || og.ogDescription || og.ogImage) {
      return og;
    }
    
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetch and parse an RSS feed (without OG data - that loads async)
 * Handles both Atom (<entry>) and RSS (<item>) formats
 */
export async function fetchAndParseFeed(
  feedId: string,
  feedTitle: string,
  feedUrl: string
): Promise<ParsedFeed> {
  try {
    // Use a CORS proxy for client-side fetching
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(feedUrl)}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const entries = parseEntries(xmlText, feedId, feedTitle);

    return {
      feedId,
      feedTitle,
      entries,
    };
  } catch (error) {
    return {
      feedId,
      feedTitle,
      entries: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse XML text and extract entries
 * Supports both <entry> (Atom) and <item> (RSS) formats
 */
function parseEntries(xmlText: string, feedId: string, feedTitle: string): RssEntry[] {
  const entries: RssEntry[] = [];

  // Try to find <entry> tags (Atom format)
  const entryMatches = xmlText.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi);
  if (entryMatches && entryMatches.length > 0) {
    for (const match of entryMatches) {
      const link = extractLink(match);
      const title = extractTitle(match);
      const publishedDate = extractPublishedDate(match);
      const description = extractDescription(match);
      
      entries.push({
        id: link,
        feedId,
        feedTitle,
        rawXml: match,
        link,
        title,
        publishedDate,
        description,
        ogLoading: true,
      });
    }
    return entries;
  }

  // Try to find <item> tags (RSS format)
  const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi);
  if (itemMatches && itemMatches.length > 0) {
    for (const match of itemMatches) {
      const link = extractLink(match);
      const title = extractTitle(match);
      const publishedDate = extractPublishedDate(match);
      const description = extractDescription(match);
      
      entries.push({
        id: link,
        feedId,
        feedTitle,
        rawXml: match,
        link,
        title,
        publishedDate,
        description,
        ogLoading: true,
      });
    }
    return entries;
  }

  return entries;
}

/**
 * Fetch all feeds and return combined entries (deduplicated by URL)
 */
export async function syncAllFeeds(
  feeds: Array<{ id: string; title: string; url: string }>
): Promise<{ entries: RssEntry[]; errors: Array<{ feedTitle: string; error: string }> }> {
  const allEntries: RssEntry[] = [];
  const seenUrls = new Set<string>();
  const errors: Array<{ feedTitle: string; error: string }> = [];

  const results = await Promise.all(
    feeds.map((feed) => fetchAndParseFeed(feed.id, feed.title, feed.url))
  );

  for (const result of results) {
    if (result.error) {
      errors.push({ feedTitle: result.feedTitle, error: result.error });
    } else {
      // Deduplicate entries by URL
      for (const entry of result.entries) {
        if (!seenUrls.has(entry.link)) {
          seenUrls.add(entry.link);
          allEntries.push(entry);
        }
      }
    }
  }

  return { entries: allEntries, errors };
}
