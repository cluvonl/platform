'use server';

import {redirect,unstable_rethrow} from 'next/navigation';
import {requireWorkspace} from '@/lib/auth/workspace';
import {composeOnlineInitial,composePhoneInitial,composeWaitlistInitial,composeTransferInitial,
  loadFrozenReview,loadManagement,recoverSavedCommit,listMyOffers,loadOfferOutcome,
  type ProjectionDependencies} from './booking-projections';

const deps:ProjectionDependencies={requireWorkspace,rethrow:unstable_rethrow,redirectToLogin:()=>redirect('/login')};
// Fixed server entrypoints for initial selection, frozen review and observed outcomes.
// The caller never selects an SQL operation or submits tenant/actor authority.
export async function loadOnlineInitial(input:unknown) {return composeOnlineInitial(input,deps);}
export async function loadPhoneInitial(input:unknown) {return composePhoneInitial(input,deps);}
export async function loadWaitlistInitial(input:unknown) {return composeWaitlistInitial(input,deps);}
export async function loadTransferInitial(input:unknown) {return composeTransferInitial(input,deps);}
export async function loadOwnedFrozenReview(input:unknown) {return loadFrozenReview(input,deps);}
export async function loadCoordinatorManagement(input:unknown) {return loadManagement(input,deps);}
export async function recoverOnlineCommit(input:unknown) {return recoverSavedCommit('online',input,deps);}
export async function recoverPhoneCommit(input:unknown) {return recoverSavedCommit('phone',input,deps);}
export async function recoverWaitlistCommit(input:unknown) {return recoverSavedCommit('waitlist',input,deps);}
export async function recoverTransferCommit(input:unknown) {return recoverSavedCommit('transfer',input,deps);}
export async function listOwnOffersForPosition(input:unknown) {return listMyOffers(input,deps);}
export async function loadOwnedOfferOutcome(input:unknown) {return loadOfferOutcome(input,deps);}
