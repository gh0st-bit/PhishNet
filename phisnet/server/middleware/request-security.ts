import type { RequestHandler } from 'express';

// Browser writes must come from a configured origin. Non-browser clients without
// Origin are permitted, but cannot use cross-site browser cookies.
export function requestSecurity(origins: Set<string>, production = false): RequestHandler {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    // Clickjacking protection: only this app may frame its own pages (content previews).
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Narrow CSP that cannot break scripts or styles; a full script-src policy needs its own review.
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    // The SAML consumer verifies signed, request-bound assertions and a browser-bound nonce.
    if(req.method==='POST'&&req.path==='/api/auth/saml/callback')return next();
    const origin = req.get('origin');
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if ((origin && !origins.has(origin)) || (write && req.get('sec-fetch-site') === 'cross-site')) {
      return res.status(403).json({ message: 'Origin not allowed' });
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.vary('Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.sendStatus(204);
      return;
    }
    next();
  };
}
