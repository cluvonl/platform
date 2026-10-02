export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.APP_ENV === 'production') throw new Error('Cluvo V1 is niet vrijgegeven: production blijft geblokkeerd.');
    if (process.env.APP_MODE && process.env.APP_MODE !== 'prototype') throw new Error('Deze starter bevat de prototype-UI. Vervang eerst de demo-opslag en autorisatie voordat app-modus wordt vrijgegeven.');
  }
}
