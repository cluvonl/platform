const environment=process.env.APP_ENV||'local';
const mode=process.env.APP_MODE||'prototype';
if(environment==='production') throw new Error('Cluvo V1 is niet vrijgegeven: production blijft geblokkeerd.');
if(!['local','staging','test'].includes(environment)) throw new Error('Onbekende Cluvo-omgeving.');
if(mode!=='prototype') throw new Error('Deze starter bevat alleen de prototype-UI; echte app-modus is nog niet vrijgegeven.');
