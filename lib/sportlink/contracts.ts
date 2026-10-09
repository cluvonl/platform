export type SportlinkTestCode = 'VERIFIED_READ_ACCESS' | 'PROVIDER_DENIED' | 'PROVIDER_UNAVAILABLE' | 'INVALID_SOURCE_RESPONSE' | 'CONTRACT_UNAVAILABLE';
export type SportlinkCapabilities = {matches: boolean; match_details: boolean; teams: boolean; member_import: false; duration_units_verified: false};
export type SportlinkConnection = {id: string; version: number; status: 'preparing' | 'active' | 'error' | 'disabled'; configured: boolean; lastSuccessAt: string | null;
  test: {code: SportlinkTestCode; checkedAt: string; capabilities: SportlinkCapabilities} | null};
export type SportlinkState = {connection: SportlinkConnection | null};
export type SportlinkActionState = {status: 'idle' | 'confirmed' | 'rejected' | 'unknown'; message?: string; testCode?: SportlinkTestCode};
