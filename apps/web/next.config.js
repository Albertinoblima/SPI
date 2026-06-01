/** @type {import('next').NextConfig} */
const contentSecurityPolicyReportOnly = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https:",
    "object-src 'none'",
].join('; ');

const nextConfig = {
    // Evitar que pdfkit/docx sejam empacotados pelo webpack (precisam de acesso ao fs em runtime)
    serverExternalPackages: ['pdfkit', 'docx'],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'icnclqtwtcbrmuxpujwb.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
        ],
    },
    // Fase 2: Security headers (CORS review, OWASP hardening)
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin',
                    },
                    {
                        key: 'Cross-Origin-Resource-Policy',
                        value: 'same-site',
                    },
                    {
                        key: 'Content-Security-Policy-Report-Only',
                        value: contentSecurityPolicyReportOnly,
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
