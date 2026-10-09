import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Cluvo — Samen maken we de club',description:'Je vereniging, verbonden.',icons:{icon:'/favicon.svg',apple:'/icon-192.png'},manifest:'/manifest.webmanifest'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="nl"><body>{children}</body></html>}
