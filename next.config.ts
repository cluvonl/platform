import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  ...(process.env.NODE_ENV === 'development' ? { allowedDevOrigins: ['127.0.0.1'] } : {}),
  poweredByHeader: false,
  // Keep /app/ inside its manifest/worker scope rather than normalizing to /app.
  skipTrailingSlashRedirect: true,
  async headers() { return [{source:'/:path*',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Robots-Tag',value:'noindex, nofollow'},
  ]},
  {source:'/app/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]},
  {source:'/app/sw.js',headers:[
    {key:'Content-Type',value:'application/javascript; charset=utf-8'},
    {key:'Cache-Control',value:'no-cache, no-store, must-revalidate'},
    {key:'Service-Worker-Allowed',value:'/app/'},
  ]},
  {source:'/app/manifest.webmanifest',headers:[
    {key:'Content-Type',value:'application/manifest+json; charset=utf-8'},
    {key:'Cache-Control',value:'public, max-age=0, must-revalidate'},
  ]},
  {source:'/app/icons/:path*',headers:[{key:'Cache-Control',value:'public, max-age=0, must-revalidate'}]},
  {source:'/app/offline.html',headers:[{key:'Cache-Control',value:'public, max-age=0, must-revalidate'}]},
  {source:'/sw.js',headers:[{key:'Content-Type',value:'application/javascript; charset=utf-8'},{key:'Cache-Control',value:'no-cache, no-store, must-revalidate'}]},
  ]; },
};
export default config;
