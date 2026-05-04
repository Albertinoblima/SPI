/** @type {import('next').NextConfig} */
const nextConfig = {
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
