/**
 * Security Headers Middleware for OLMS Backend
 * Hardens HTTP response headers against OWASP Top 10 vulnerabilities:
 * - Clickjacking (X-Frame-Options)
 * - MIME-type Confusion (X-Content-Type-Options)
 * - Cross-Site Scripting & Injection (Content-Security-Policy)
 * - Information Leakage (X-Powered-By removal, Strict Referrer-Policy)
 * - Man-in-the-Middle (HSTS)
 */

function securityHeaders(req, res, next) {
    // Prevent browser from MIME-sniffing the response away from declared content-type
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent framing / clickjacking attacks
    res.setHeader('X-Frame-Options', 'DENY');

    // Disable outdated buggy XSS Auditor, modern protection handled by CSP
    res.setHeader('X-XSS-Protection', '0');

    // Content Security Policy for API server: restrict embedding and script execution
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none';");

    // Enforce HTTPS transmission
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Referrer Policy: only send origin on same protocol or cross-origin
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy: disable sensitive device APIs
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

    // Cross-Origin Isolations
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // Ensure X-Powered-By is removed
    res.removeHeader('X-Powered-By');

    next();
}

module.exports = securityHeaders;
