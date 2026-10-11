/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['power.larc.nasa.gov', 'earthdata.nasa.gov'],
  },
}

module.exports = nextConfig