import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/utils/rateLimit';

// Vercel function configuration - 10 seconds max for free tier
export const maxDuration = 10;

// Check if we're in a serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Get browser instance - uses different strategies for local vs serverless
async function getBrowser() {
  if (isServerless) {
    // Serverless: use puppeteer-core with @sparticuz/chromium
    const puppeteerCore = await import('puppeteer-core');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromium = await import('@sparticuz/chromium') as any;
    
    // Optimize for faster cold starts
    chromium.default.setHeadlessMode = true;
    chromium.default.setGraphicsMode = false;
    
    return await puppeteerCore.default.launch({
      args: [
        ...chromium.default.args,
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--single-process',
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless,
    });
  } else {
    // Local development: use full puppeteer which bundles Chromium
    const puppeteer = await import('puppeteer');
    return await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
}

export interface SkoolPost {
  id: string;
  author: string;
  authorAvatar?: string;
  title: string;
  description: string;
  category: string;
  date: string;
  link: string;
  likes: number;
  comments: number;
  lastCommentTime?: string;
  isPinned: boolean;
  sourceUrl: string;
  sourceName: string;
}

function isValidSkoolUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'www.skool.com' || url.hostname === 'skool.com')
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`scrape:${clientIp}`, RATE_LIMITS.proxy);
  
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.resetIn),
          'X-RateLimit-Remaining': '0',
        }
      }
    );
  }

  let body: { url: string; sourceName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, sourceName } = body;

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  if (!isValidSkoolUrl(url)) {
    return NextResponse.json(
      { error: 'Only skool.com URLs are supported' },
      { status: 403 }
    );
  }

  let browser;
  try {
    console.log('[Scrape] Starting scrape for URL:', url);
    console.log('[Scrape] Environment:', isServerless ? 'serverless' : 'local');
    
    console.log('[Scrape] Launching browser...');
    browser = await getBrowser();
    console.log('[Scrape] Browser launched successfully');

    const page = await browser.newPage();
    console.log('[Scrape] New page created');
    
    // Set a reasonable user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to the page (use 'domcontentloaded' for faster loading within timeout)
    console.log('[Scrape] Navigating to page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
    console.log('[Scrape] Page loaded (domcontentloaded)');

    // Wait briefly for content to load - Skool uses styled-components with PostItem pattern
    console.log('[Scrape] Waiting for content selectors...');
    const selectorFound = await page.waitForSelector('[class*="PostItemWrapper"], [class*="PostItemCard"]', { timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    console.log('[Scrape] Selector found:', selectorFound);

    // Scroll to load more posts (max 1 second or 50 posts - keeping time for browser ops)
    const startTime = Date.now();
    const maxScrollTime = 1000;
    const maxPosts = 50;
    
    let previousPostCount = 0;
    let currentPostCount = 0;
    
    console.log('[Scrape] Starting scroll loop...');
    while (Date.now() - startTime < maxScrollTime) {
      // Get current post count - Skool uses PostItemWrapper (not PostItemCardWrapper) for each post
      currentPostCount = await page.evaluate(() => {
        // Match PostItemWrapper but exclude PostItemCardWrapper
        const allWrappers = document.querySelectorAll('[class*="PostItemWrapper"]');
        const posts = Array.from(allWrappers).filter(el => !el.className.includes('CardWrapper'));
        return posts.length;
      });
      console.log('[Scrape] Current post count:', currentPostCount);

      if (currentPostCount >= maxPosts) {
        console.log('[Scrape] Reached max posts:', currentPostCount);
        break;
      }

      // Scroll down
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });

      // Wait a bit for content to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // If no new posts loaded after scroll, break
      if (currentPostCount === previousPostCount) {
        // Wait a bit more and try once
        await new Promise(resolve => setTimeout(resolve, 1000));
        const newCount = await page.evaluate(() => {
          const allWrappers = document.querySelectorAll('[class*="PostItemWrapper"]');
          const posts = Array.from(allWrappers).filter(el => !el.className.includes('CardWrapper'));
          return posts.length;
        });
        if (newCount === currentPostCount) {
          console.log('[Scrape] No new posts found, stopping scroll');
          break;
        }
      }
      
      previousPostCount = currentPostCount;
    }
    console.log('[Scrape] Scroll complete. Post elements found:', currentPostCount);

    // Debug: Get the page HTML structure to understand Skool's DOM
    const debugInfo = await page.evaluate(() => {
      const body = document.body;
      const allElements = body.querySelectorAll('*');
      const classNames = new Set<string>();
      
      allElements.forEach(el => {
        el.classList.forEach(cls => {
          if (cls.toLowerCase().includes('post') || 
              cls.toLowerCase().includes('card') || 
              cls.toLowerCase().includes('feed') ||
              cls.toLowerCase().includes('article')) {
            classNames.add(cls);
          }
        });
      });
      
      return {
        bodyTextLength: body.textContent?.length || 0,
        elementCount: allElements.length,
        relevantClasses: Array.from(classNames).slice(0, 20),
        title: document.title,
        hasArticles: document.querySelectorAll('article').length,
      };
    });
    console.log('[Scrape] Page debug info:', JSON.stringify(debugInfo, null, 2));

    // Extract posts
    console.log('[Scrape] Extracting posts...');
    const posts = await page.evaluate((sourceUrl: string, srcName: string) => {
      // Parse Skool date formats into ISO date strings
      // Formats: "Nov '25", "8h", "25d", "30m", "45s"
      function parseSkoolDate(dateStr: string): string {
        const now = new Date();
        const trimmed = dateStr.trim();
        
        // Match relative time: Xh, Xd, Xm, Xs
        const relativeMatch = trimmed.match(/^(\d+)(s|m|h|d)$/i);
        if (relativeMatch) {
          const value = parseInt(relativeMatch[1]);
          const unit = relativeMatch[2].toLowerCase();
          const date = new Date(now);
          
          switch (unit) {
            case 's':
              date.setSeconds(date.getSeconds() - value);
              break;
            case 'm':
              date.setMinutes(date.getMinutes() - value);
              break;
            case 'h':
              date.setHours(date.getHours() - value);
              break;
            case 'd':
              date.setDate(date.getDate() - value);
              break;
          }
          return date.toISOString();
        }
        
        // Match month/year format: "Nov '25", "Jan '24", etc.
        const monthYearMatch = trimmed.match(/^([A-Za-z]{3})\s*'(\d{2})$/);
        if (monthYearMatch) {
          const monthNames: Record<string, number> = {
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
          };
          const month = monthNames[monthYearMatch[1].toLowerCase()];
          const year = 2000 + parseInt(monthYearMatch[2]);
          
          if (month !== undefined) {
            // First of the month at noon
            const date = new Date(year, month, 1, 12, 0, 0);
            return date.toISOString();
          }
        }
        
        // Fallback: return current time if we can't parse
        return now.toISOString();
      }
      
      // Skool uses styled-components with PostItemWrapper (not PostItemCardWrapper) for each post
      const allWrappers = document.querySelectorAll('[class*="PostItemWrapper"]');
      const postElements = Array.from(allWrappers).filter(el => !el.className.includes('CardWrapper'));
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = [];

      postElements.forEach((post, index) => {
        try {
          // Extract author from UserNameText element
          const authorEl = post.querySelector('[class*="UserNameText"]');
          const author = authorEl?.textContent?.trim().replace(/\s+/g, ' ') || 'Unknown';

          // Extract avatar - first img in the post (usually the author's avatar)
          const avatarEl = post.querySelector('[class*="AvatarWrapper"] img') as HTMLImageElement | null;
          const authorAvatar = avatarEl?.src;

          // Extract title from Title element
          const titleEl = post.querySelector('[class*="Title-sc-vh0utx"]');
          const title = titleEl?.textContent?.trim() || '';

          // Extract description from ContentPreviewWrapper
          const descEl = post.querySelector('[class*="ContentPreviewWrapper"]');
          const description = descEl?.textContent?.trim() || '';

          // Extract category from GroupFeedLinkLabel
          const categoryEl = post.querySelector('[class*="GroupFeedLinkLabel"]');
          const category = categoryEl?.textContent?.trim() || '';

          // Extract date from PostTimeContent (clean up the bullet point)
          const dateEl = post.querySelector('[class*="PostTimeContent"]');
          let dateRaw = dateEl?.textContent?.trim() || '';
          dateRaw = dateRaw.replace(/[•·]\s*$/, '').trim(); // Remove trailing bullet
          const date = parseSkoolDate(dateRaw);

          // Extract link - the <a> wrapping TitleWrapper contains the post URL
          // Post URLs have format: /community-slug/post-title-slug (two segments, no @ or ?)
          let link = '';
          const allLinks = post.querySelectorAll('a[href]') as NodeListOf<HTMLAnchorElement>;
          for (const a of allLinks) {
            const href = a.getAttribute('href') || '';
            // Match: /community-slug/post-slug (exactly two segments, no @ symbol, no query params)
            if (href.match(/^\/[a-z0-9-]+\/[a-z0-9-]+$/i) && !href.includes('/@') && !href.includes('?')) {
              link = a.href;
              break;
            }
          }
          if (!link) link = sourceUrl;

          // Extract likes from LikesCount
          const likesEl = post.querySelector('[class*="LikesCount"]');
          const likes = parseInt(likesEl?.textContent?.trim() || '0') || 0;

          // Extract comments from CommentsCount
          const commentsEl = post.querySelector('[class*="CommentsCount"]');
          const comments = parseInt(commentsEl?.textContent?.trim() || '0') || 0;

          // Extract last activity from RecentActivityLabel (e.g., "New comment 25d ago")
          const activityEl = post.querySelector('[class*="RecentActivityLabel"]');
          const activityText = activityEl?.textContent?.trim() || '';
          // Extract the time portion (e.g., "25d" from "New comment 25d ago")
          const timeMatch = activityText.match(/(\d+[smhd])/i);
          const lastCommentTime = timeMatch ? parseSkoolDate(timeMatch[1]) : undefined;

          // Check if pinned - look for PinnedOverlay element
          const pinnedEl = post.querySelector('[class*="PinnedOverlay"]');
          const isPinned = !!pinnedEl;

          // Only add if we have meaningful content
          if (title || description.length > 20) {
            // Use link as stable ID (or fallback to title hash if no link)
            const stableId = link || `skool-${title}-${author}`;
            results.push({
              id: stableId,
              author,
              authorAvatar,
              title: title || description.substring(0, 100),
              description: description.substring(0, 500),
              category,
              date,
              link,
              likes,
              comments,
              lastCommentTime,
              isPinned,
              sourceUrl,
              sourceName: srcName
            });
          }
        } catch (e) {
          // Skip this post if extraction fails
          console.error('Post extraction error:', e);
        }
      });

      return results;
    }, url, sourceName || 'Skool');

    console.log('[Scrape] Posts extracted:', posts.length);
    console.log('[Scrape] All post titles:', posts.map((p, i) => `${i}: ${p.title?.substring(0, 60)}`).join('\n'));
    if (posts.length > 0) {
      console.log('[Scrape] First post sample:', JSON.stringify(posts[0], null, 2));
    }

    await browser.close();
    console.log('[Scrape] Browser closed');

    const response = {
      success: true,
      posts,
      postCount: posts.length,
      scrolledFor: Date.now() - startTime,
      debug: debugInfo
    };
    console.log('[Scrape] Returning response with', posts.length, 'posts');
    
    return NextResponse.json(response);

  } catch (error) {
    if (browser) {
      await browser.close();
    }

    console.error('Scrape error:', error);
    
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Page load timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to scrape page' },
      { status: 500 }
    );
  }
}
