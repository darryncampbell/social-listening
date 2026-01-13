import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/utils/rateLimit';

const COOKIE_NAME = 'openai-api-key';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

/**
 * Helper to check rate limit and return error response if exceeded
 */
function checkApiKeyRateLimit(request: NextRequest): NextResponse | null {
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`apikey:${clientIp}`, RATE_LIMITS.apiKeyConfig);
  
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: { 'Retry-After': String(rateLimit.resetIn) }
      }
    );
  }
  return null;
}

/**
 * GET - Check if an API key is configured (doesn't reveal the key)
 * No rate limiting for this read-only endpoint
 */
export async function GET() {
  const cookieStore = await cookies();
  const apiKey = cookieStore.get(COOKIE_NAME)?.value;
  
  return NextResponse.json({
    configured: !!apiKey,
    // Return masked preview for UI feedback (first 4 + last 4 chars)
    preview: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : null,
  });
}

/**
 * POST - Set the API key in an HTTP-only cookie
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitError = checkApiKeyRateLimit(request);
  if (rateLimitError) return rateLimitError;

  try {
    const { apiKey } = await request.json();
    
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    const trimmedKey = apiKey.trim();
    
    if (!trimmedKey) {
      return NextResponse.json(
        { error: 'API key cannot be empty' },
        { status: 400 }
      );
    }

    // Create response and set the cookie
    const response = NextResponse.json({
      success: true,
      message: 'API key saved securely',
      preview: `${trimmedKey.slice(0, 4)}...${trimmedKey.slice(-4)}`,
    });

    // Set HTTP-only, secure cookie
    response.cookies.set(COOKIE_NAME, trimmedKey, {
      httpOnly: true,           // Not accessible via JavaScript
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',       // CSRF protection
      maxAge: COOKIE_MAX_AGE,   // 1 year expiry
      path: '/',                // Available to all routes
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

/**
 * DELETE - Remove the API key cookie
 */
export async function DELETE(request: NextRequest) {
  // Rate limiting
  const rateLimitError = checkApiKeyRateLimit(request);
  if (rateLimitError) return rateLimitError;

  const response = NextResponse.json({
    success: true,
    message: 'API key removed',
  });

  // Clear the cookie by setting it with immediate expiry
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0, // Expire immediately
    path: '/',
  });

  return response;
}
