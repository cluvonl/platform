'use client';
export default function MobileError({reset}: {error: Error & {digest?: string}; reset: () => void}) {
  return <div className="cluvo-mobile"><main className="app-content"><h1>Je werkruimte kon niet worden geladen</h1><p>Controleer je verbinding en probeer opnieuw. Controleer een openstaande bevestiging in je werkruimte voordat je die opnieuw indient.</p><button className="app-btn outline" onClick={reset}>Opnieuw proberen</button></main></div>;
}
