import { NextRequest, NextResponse } from 'next/server';

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

// Fetch the author of a Reddit post or comment using Reddit's JSON API
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
    // Check if this is a comment URL
    const commentId = extractCommentId(redditUrl);
    
    // Clean the URL and append .json
    let jsonUrl = redditUrl.trim();
    // Remove trailing slash if present
    if (jsonUrl.endsWith('/')) {
      jsonUrl = jsonUrl.slice(0, -1);
    }
    // Remove any query parameters
    jsonUrl = jsonUrl.split('?')[0];
    // Append .json
    jsonUrl = `${jsonUrl}.json`;

    const response = await fetch(jsonUrl, {
      headers: {
        // Reddit requires a User-Agent
        'User-Agent': 'SocialListeningApp/1.0',
      },
    });

    if (response.status === 429) {
      return NextResponse.json(
        { error: 'Rate limited by Reddit', retryAfter: response.headers.get('Retry-After') },
        { status: 429 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Reddit API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

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
