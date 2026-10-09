'use client';

import Link from 'next/link';
import {usePathname, useSearchParams} from 'next/navigation';
import {hasUnsavedMobileDraft} from './draft-state';

export function MobileLink({href, ...props}: React.ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const current = useSearchParams();
  let target = href;
  const clubBase = pathname.match(/^\/app\/c\/[^/]+\//)?.[0];
  if (typeof href === 'string' && clubBase && href.startsWith(clubBase)) {
    const [path, raw = ''] = href.split('?');
    const next = new URLSearchParams(raw);
    for (const key of ['household', 'season']) if (!next.has(key) && current.has(key)) next.set(key, current.get(key)!);
    target = `${path}${next.size ? `?${next}` : ''}`;
  }
  return <Link href={target} {...props} onClick={(event) => {
    props.onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === '_blank') return;
    if (hasUnsavedMobileDraft() && !window.confirm('Je profiel is nog niet opgeslagen. Wil je deze pagina verlaten?')) event.preventDefault();
  }} />;
}
