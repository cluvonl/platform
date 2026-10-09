import 'server-only';
import config from '@/public/app/push-config.json';

export const mobilePushPublicKey=/^[A-Za-z0-9_-]{87}$/.test(config.publicKey)?config.publicKey:null;
