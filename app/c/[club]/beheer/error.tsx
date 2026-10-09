'use client';
import {Button,Empty} from '@/components/cluvo/ui';
export default function AdminError({reset}:{reset:()=>void}){return <Empty title="Dit beheeronderdeel kan nu niet worden geladen" text="Probeer de actuele gegevens opnieuw te laden. Een ontbrekende meting is niet als nul weergegeven." action={<Button onClick={reset}>Opnieuw laden</Button>}/>;}
