'use client';
import {useSyncExternalStore} from 'react';
const subscribe=()=>()=>{};
const clientSnapshot=()=>true;
const serverSnapshot=()=>false;
// Server forms stay disabled until their event handlers are hydrated.
export function useHydrated(){return useSyncExternalStore(subscribe,clientSnapshot,serverSnapshot);}
