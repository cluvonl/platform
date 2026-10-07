'use server';

import {revalidatePath} from 'next/cache';
import {redirect,unstable_rethrow} from 'next/navigation';
import {requireWorkspace} from '@/lib/auth/workspace';
import {executeCommand,executeRead,type CommandState,type ReadState,type Dependencies} from './booking-server-core';

// Fixed Next entrypoints for the V2 contracts. Only the
// publishable SSR client from requireWorkspace is reachable here. No admin key,
// role override, browser-authority state or actor/session input exists.
const deps:Dependencies={
  requireWorkspace,
  rethrow:unstable_rethrow,
  redirectToLogin:()=>redirect('/login'),
  revalidatePath,
};
export async function prepareOnlineAction(_previous:CommandState<'prepareOnline'>|null,form:FormData):Promise<CommandState<'prepareOnline'>> {return executeCommand('prepareOnline',form,deps);}
export async function preparePhoneAction(_previous:CommandState<'preparePhone'>|null,form:FormData):Promise<CommandState<'preparePhone'>> {return executeCommand('preparePhone',form,deps);}
export async function prepareWaitlistAction(_previous:CommandState<'prepareWaitlist'>|null,form:FormData):Promise<CommandState<'prepareWaitlist'>> {return executeCommand('prepareWaitlist',form,deps);}
export async function prepareTransferAction(_previous:CommandState<'prepareTransfer'>|null,form:FormData):Promise<CommandState<'prepareTransfer'>> {return executeCommand('prepareTransfer',form,deps);}
export async function commitOnlineAction(_previous:CommandState<'commitOnline'>|null,form:FormData):Promise<CommandState<'commitOnline'>> {return executeCommand('commitOnline',form,deps);}
export async function commitPhoneAction(_previous:CommandState<'commitPhone'>|null,form:FormData):Promise<CommandState<'commitPhone'>> {return executeCommand('commitPhone',form,deps);}
export async function commitWaitlistAction(_previous:CommandState<'commitWaitlist'>|null,form:FormData):Promise<CommandState<'commitWaitlist'>> {return executeCommand('commitWaitlist',form,deps);}
export async function commitTransferAction(_previous:CommandState<'commitTransfer'>|null,form:FormData):Promise<CommandState<'commitTransfer'>> {return executeCommand('commitTransfer',form,deps);}
export async function publishInstructionsAction(_previous:CommandState<'publish'>|null,form:FormData):Promise<CommandState<'publish'>> {return executeCommand('publish',form,deps);}
export async function loadBookingContext(form:FormData):Promise<ReadState<'context'>> {return executeRead('context',form,deps);}
export async function loadBookingExecutors(form:FormData):Promise<ReadState<'executors'>> {return executeRead('executors',form,deps);}
export async function loadBookingAcknowledgement(form:FormData):Promise<ReadState<'acknowledgement'>> {return executeRead('acknowledgement',form,deps);}
