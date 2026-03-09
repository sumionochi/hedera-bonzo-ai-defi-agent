/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
      config.ignoreWarnings = [
        {
          module: /@hashgraph\/hedera-wallet-connect/,
        },
      ];
  
      return config;
    },
  };
  
  export default nextConfig;