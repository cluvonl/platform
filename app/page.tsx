import CluvoApp from '@/components/cluvo/app';
import {redirect} from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function Page() {
  if (process.env.APP_MODE === 'app') redirect('/login');
  return <CluvoApp/>;
}
