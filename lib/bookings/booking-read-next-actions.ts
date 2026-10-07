'use server';

import {redirect,unstable_rethrow} from 'next/navigation';
import {requireWorkspace} from '@/lib/auth/workspace';
import {executeReadForm,type ReadState,type Dependencies} from './booking-read-core';

// Fixed Next entrypoints. The only client reachable here is the actual
// publishable SSR client from the canonical current-Native workspace gate.
const deps:Dependencies={requireWorkspace,rethrow:unstable_rethrow,redirectToLogin:()=>redirect('/login')};
export async function loadShiftBookingTargets(form:FormData):Promise<ReadState<'targets'>> {return executeReadForm('targets',form,deps);}
export async function loadShiftBookingManagement(form:FormData):Promise<ReadState<'management'>> {return executeReadForm('management',form,deps);}
export async function loadBookingOfferReview(form:FormData):Promise<ReadState<'offerReview'>> {return executeReadForm('offerReview',form,deps);}
export async function loadOnlineBookingOutcome(form:FormData):Promise<ReadState<'onlineOutcome'>> {return executeReadForm('onlineOutcome',form,deps);}
export async function loadPhoneBookingOutcome(form:FormData):Promise<ReadState<'phoneOutcome'>> {return executeReadForm('phoneOutcome',form,deps);}
export async function loadWaitlistBookingOutcome(form:FormData):Promise<ReadState<'waitlistOutcome'>> {return executeReadForm('waitlistOutcome',form,deps);}
export async function loadTransferBookingOutcome(form:FormData):Promise<ReadState<'transferOutcome'>> {return executeReadForm('transferOutcome',form,deps);}
export async function listMyShiftBookingOffers(form:FormData):Promise<ReadState<'myOffers'>> {return executeReadForm('myOffers',form,deps);}
export async function loadBookingOfferOutcome(form:FormData):Promise<ReadState<'offerOutcome'>> {return executeReadForm('offerOutcome',form,deps);}
export async function loadAssistedShiftBookingSource(form:FormData):Promise<ReadState<'phoneSource'>> {return executeReadForm('phoneSource',form,deps);}
export async function loadWaitlistBookingSource(form:FormData):Promise<ReadState<'waitlistSource'>> {return executeReadForm('waitlistSource',form,deps);}
export async function loadTransferBookingSource(form:FormData):Promise<ReadState<'transferSource'>> {return executeReadForm('transferSource',form,deps);}
