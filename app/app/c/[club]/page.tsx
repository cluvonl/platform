import {redirect} from 'next/navigation';
export default async function MobileClubIndex({params}: {params: Promise<{club: string}>}) {
  const {club} = await params;
  redirect(`/app/c/${encodeURIComponent(club)}/home`);
}
