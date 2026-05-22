/** @type {import('next').NextConfig} */
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
};

module.exports = nextConfig;
