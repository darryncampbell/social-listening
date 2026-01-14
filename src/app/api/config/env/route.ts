import { NextResponse } from 'next/server';

interface PredefinedFeed {
  id: string;
  title: string;
  url: string;
}

/**
 * Parse the SOCIAL_LISTENING_FEEDS environment variable.
 * Format: "Title1|URL1,Title2|URL2"
 * Returns an array of predefined feeds.
 */
function parsePredefinedFeeds(feedsEnv: string | undefined): PredefinedFeed[] {
  if (!feedsEnv) return [];
  
  const feeds: PredefinedFeed[] = [];
  const entries = feedsEnv.split(',');
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i].trim();
    if (!entry) continue;
    
    const pipeIndex = entry.indexOf('|');
    if (pipeIndex === -1) continue;
    
    const title = entry.substring(0, pipeIndex).trim();
    const url = entry.substring(pipeIndex + 1).trim();
    
    if (title && url) {
      feeds.push({
        id: `env-feed-${i}`,
        title,
        url,
      });
    }
  }
  
  return feeds;
}

/**
 * API route to expose environment variable overrides for config.
 * Environment variables take precedence over localStorage values.
 * 
 * Supported environment variables:
 * - SOCIAL_LISTENING_INTEREST: Overrides "Company or Person of Interest"
 * - SOCIAL_LISTENING_FEEDS: Predefined RSS feeds (format: "Title1|URL1,Title2|URL2")
 */
export async function GET() {
  const predefinedFeeds = parsePredefinedFeeds(process.env.SOCIAL_LISTENING_FEEDS);
  
  const envConfig = {
    interest: process.env.SOCIAL_LISTENING_INTEREST || null,
    predefinedFeeds: predefinedFeeds.length > 0 ? predefinedFeeds : null,
  };

  return NextResponse.json(envConfig);
}
