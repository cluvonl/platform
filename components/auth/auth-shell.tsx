import Image from 'next/image';

export function AuthShell({eyebrow, title, intro, children}: {eyebrow: string; title: string; intro: string; children: React.ReactNode}) {
  return (
    <main className="auth-screen">
      <section className="auth-brand" aria-label="Cluvo">
        <Image src="/brand/cluvo-logo.png" alt="Cluvo" width={190} height={82} priority />
        <p>Jouw club. Samen.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card page-enter">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-intro">{intro}</p>
          {children}
          <p className="auth-privacy">Een intakecode is nooit een inlogmiddel. Cluvo gebruikt alleen jouw geverifieerde account en expliciete verenigingsrechten.</p>
        </div>
      </section>
    </main>
  );
}
