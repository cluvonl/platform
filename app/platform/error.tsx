'use client';
import {Button,Empty} from '@/components/cluvo/ui';
export default function PlatformError({reset}:{reset:()=>void}){return <Empty title="Dit overzicht kan nu niet worden geladen" text="Je gegevens zijn niet als een leeg overzicht weergegeven. Probeer de actuele stand opnieuw te laden." action={<Button onClick={reset}>Opnieuw laden</Button>}/>;}
