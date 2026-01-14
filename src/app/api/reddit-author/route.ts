import { NextRequest, NextResponse } from 'next/server';

// Cache the access token in memory (serverless functions can reuse this)
let cachedToken: { token: string; expiresAt: number } | null = null;

// Get an OAuth access token from Reddit
async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Reddit OAuth credentials not configured');
    return null;
  }

  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SocialListeningApp/1.0',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      console.error('Failed to get Reddit access token:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.access_token) {
      // Cache the token (expires_in is in seconds, subtract 60s for safety margin)
      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      };
      return data.access_token;
    }

    return null;
  } catch (error) {
    console.error('Error getting Reddit access token:', error);
    return null;
  }
}

// Check if the URL is a comment URL and extract the comment ID
function extractCommentId(url: string): string | null {
  // Comment URLs look like: /r/subreddit/comments/postId/c/commentId
  // or /r/subreddit/comments/postId/title/commentId
  const match = url.match(/\/comments\/[a-zA-Z0-9]+\/(?:c\/)?([a-zA-Z0-9]+)\/?$/);
  return match ? match[1] : null;
}

// Recursively search for a comment by ID in Reddit's comment tree
function findCommentById(comments: any[], commentId: string): any | null {
  for (const child of comments) {
    const data = child?.data;
    if (!data) continue;
    
    // Check if this is the comment we're looking for
    if (data.id === commentId) {
      return data;
    }
    
    // Recursively check replies
    if (data.replies?.data?.children) {
      const found = findCommentById(data.replies.data.children, commentId);
      if (found) return found;
    }
  }
  return null;
}

// Fetch the author of a Reddit post or comment using Reddit's OAuth API
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redditUrl = searchParams.get('url');

  if (!redditUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate it's a Reddit URL
  if (!redditUrl.includes('reddit.com/r/')) {
    return NextResponse.json({ error: 'Not a valid Reddit URL' }, { status: 400 });
  }

  try {
    // Get OAuth access token
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Reddit OAuth not configured or failed to authenticate' },
        { status: 503 }
      );
    }

    // Check if this is a comment URL
    const commentId = extractCommentId(redditUrl);
    
    // Convert www.reddit.com URL to oauth.reddit.com API endpoint
    // Extract the path from the URL
    const urlObj = new URL(redditUrl);
    let apiPath = urlObj.pathname;
    
    // Remove trailing slash if present
    if (apiPath.endsWith('/')) {
      apiPath = apiPath.slice(0, -1);
    }
    
    // Build the OAuth API URL
    const apiUrl = `https://oauth.reddit.com${apiPath}.json`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'SocialListeningApp/1.0',
      },
    });

    if (response.status === 429) {
      return NextResponse.json(
        { error: 'Rate limited by Reddit', retryAfter: response.headers.get('Retry-After') },
        { status: 429 }
      );
    }

    if (response.status === 401) {
      // Token expired, clear cache and retry once
      cachedToken = null;
      const newToken = await getAccessToken();
      if (newToken) {
        const retryResponse = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'User-Agent': 'SocialListeningApp/1.0',
          },
        });
        if (retryResponse.ok) {
          const data = await retryResponse.json();
          const author = extractAuthor(data, commentId);
          if (author) {
            return NextResponse.json({ author, url: redditUrl });
          }
        }
      }
      return NextResponse.json(
        { error: 'Reddit authentication failed' },
        { status: 401 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Reddit API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const author = extractAuthor(data, commentId);

    if (author) {
      return NextResponse.json({ author, url: redditUrl });
    } else {
      return NextResponse.json(
        { error: 'Could not extract author from Reddit response' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error fetching Reddit author:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Reddit data' },
      { status: 500 }
    );
  }
}

// Extract author from Reddit API response
function extractAuthor(data: any, commentId: string | null): string | null {
  let author: string | null = null;

  if (Array.isArray(data) && data.length > 0) {
    if (commentId) {
      // This is a comment URL - find the specific comment
      // Comments are in the second element of the array
      const commentsData = data[1]?.data?.children;
      if (commentsData) {
        const comment = findCommentById(commentsData, commentId);
        if (comment?.author) {
          author = comment.author;
        }
      }
    } else {
      // This is a post URL - get the post author
      const postData = data[0]?.data?.children?.[0]?.data;
      if (postData?.author) {
        author = postData.author;
      }
    }
  } else if (data?.data?.children?.[0]?.data?.author) {
    // Single listing format
    author = data.data.children[0].data.author;
  }

  return author;
}
