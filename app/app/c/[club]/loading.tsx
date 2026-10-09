import {Skeleton} from '@/components/ui/skeleton';
export default function MobileLoading() {
  return <div className="cluvo-mobile"><main className="app-content" aria-busy="true" aria-label="Je werkruimte wordt geladen"><Skeleton className="mobile-heading-skeleton" /><Skeleton className="mobile-card-skeleton" /><Skeleton className="mobile-card-skeleton" /><p role="status">Je actuele clubgegevens worden geladen…</p></main></div>;
}
