import { NextResponse } from 'next/server';

interface PredefinedFeed {
  id: string;
  title: string;
  url: string;
}

interface PredefinedExternalSource {
  id: string;
  name: string;
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
 * Parse the SOCIAL_LISTENING_EXTERNAL_SOURCES environment variable.
 * Format: "Name1|URL1,Name2|URL2"
 * Returns an array of predefined external sources.
 */
function parsePredefinedExternalSources(sourcesEnv: string | undefined): PredefinedExternalSource[] {
  if (!sourcesEnv) return [];
  
  const sources: PredefinedExternalSource[] = [];
  const entries = sourcesEnv.split(',');
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i].trim();
    if (!entry) continue;
    
    const pipeIndex = entry.indexOf('|');
    if (pipeIndex === -1) continue;
    
    const name = entry.substring(0, pipeIndex).trim();
    const url = entry.substring(pipeIndex + 1).trim();
    
    if (name && url) {
      sources.push({
        id: `env-external-${i}`,
        name,
        url,
      });
    }
  }
  
  return sources;
}

/**
 * API route to expose environment variable overrides for config.
 * Environment variables take precedence over localStorage values.
 * 
 * Supported environment variables:
 * - SOCIAL_LISTENING_INTEREST: Overrides "Company or Person of Interest"
 * - SOCIAL_LISTENING_FEEDS: Predefined RSS feeds (format: "Title1|URL1,Title2|URL2")
 * - SOCIAL_LISTENING_EXTERNAL_SOURCES: Predefined external sources (format: "Name1|URL1,Name2|URL2")
 */
export async function GET() {
  const predefinedFeeds = parsePredefinedFeeds(process.env.SOCIAL_LISTENING_FEEDS);
  const predefinedExternalSources = parsePredefinedExternalSources(process.env.SOCIAL_LISTENING_EXTERNAL_SOURCES);
  
  const envConfig = {
    interest: process.env.SOCIAL_LISTENING_INTEREST || null,
    predefinedFeeds: predefinedFeeds.length > 0 ? predefinedFeeds : null,
    predefinedExternalSources: predefinedExternalSources.length > 0 ? predefinedExternalSources : null,
  };

  return NextResponse.json(envConfig);
}
