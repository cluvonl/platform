import {MobileRoutePage, type MobileRouteProps} from '@/components/mobile/route';

export default function Page(props: MobileRouteProps) {
  return <MobileRoutePage {...props} screen='household' />;
}
