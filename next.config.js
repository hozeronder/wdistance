/** @type {import('next').NextConfig} */
const nextConfig = {
  // Diğer ayarlar...
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig; 