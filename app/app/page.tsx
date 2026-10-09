import {redirect} from 'next/navigation';

export default function MobileAppEntry() {
  redirect('/app/workspaces');
}
