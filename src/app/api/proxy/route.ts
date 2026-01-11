import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/utils/rateLimit';

/**
 * Validate that a URL is safe to fetch (SSRF protection)
 * Returns an error message if unsafe, or null if safe
 */
function validateUrl(urlString: string): string | null {
  let parsedUrl: URL;
  
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return 'Invalid URL format';
  }

  // Only allow http and https protocols
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return 'Only HTTP and HTTPS protocols are allowed';
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Block localhost and loopback addresses
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost')
  ) {
    return 'Access to localhost is not allowed';
  }

  // Block cloud metadata endpoints
  const metadataHosts = [
    '169.254.169.254',     // AWS/GCP/Azure metadata
    'metadata.google.internal',
    'metadata.goog',
    '100.100.100.200',     // Alibaba Cloud metadata
    '169.254.170.2',       // AWS ECS task metadata
  ];
  
  if (metadataHosts.includes(hostname)) {
    return 'Access to cloud metadata endpoints is not allowed';
  }

  // Block private IP ranges using regex patterns
  // IPv4 private ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x (link-local)
  const privateIpPatterns = [
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,           // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,  // 172.16.0.0/12
    /^192\.168\.\d{1,3}\.\d{1,3}$/,              // 192.168.0.0/16
    /^169\.254\.\d{1,3}\.\d{1,3}$/,              // 169.254.0.0/16 (link-local)
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,          // 127.0.0.0/8 (loopback)
    /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,            // 0.0.0.0/8
  ];

  for (const pattern of privateIpPatterns) {
    if (pattern.test(hostname)) {
      return 'Access to private IP addresses is not allowed';
    }
  }

  // Block IPv6 private/reserved ranges (simplified check)
  if (hostname.startsWith('[')) {
    const ipv6 = hostname.slice(1, -1).toLowerCase();
    if (
      ipv6.startsWith('fc') ||   // Unique local
      ipv6.startsWith('fd') ||   // Unique local
      ipv6.startsWith('fe80') || // Link-local
      ipv6 === '::1'             // Loopback
    ) {
      return 'Access to private IPv6 addresses is not allowed';
    }
  }

  // Block internal hostnames (common patterns)
  const internalHostPatterns = [
    /\.internal$/,
    /\.local$/,
    /\.corp$/,
    /\.lan$/,
    /\.home$/,
    /\.intranet$/,
  ];

  for (const pattern of internalHostPatterns) {
    if (pattern.test(hostname)) {
      return 'Access to internal hostnames is not allowed';
    }
  }

  return null; // URL is safe
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`proxy:${clientIp}`, RATE_LIMITS.proxy);
  
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

  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  // Validate URL for SSRF protection
  const validationError = validateUrl(url);
  if (validationError) {
    return NextResponse.json(
      { error: validationError },
      { status: 403 }
    );
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Social-Listening-Bot/1.0',
        'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
      },
      // Add timeout to prevent hanging on slow/malicious servers
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
        { status: response.status }
      );
    }

    const text = await response.text();
    
    return new NextResponse(text, {
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    // Don't expose detailed error messages that could aid attackers
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch resource' },
      { status: 500 }
    );
  }
}
