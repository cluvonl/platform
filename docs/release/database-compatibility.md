# Database- en appcompatibiliteit

De database wordt met append-only expand/contract-migraties vooruit gebracht.
Een app terugrollen draait geen databasewijziging terug. De productiepoort blijft
geblokkeerd tot volledige V1-acceptatie; deze compatibiliteit is geen acceptatie.

| Migratie | Aangesloten app | Compatibiliteit |
|---|---|---|
| Tot en met `20261006210000` | `e0d35d7` | Bootstrap invitation-API; nog geen versioned commands. |
| `20261006223000` | `9d9c365` of later | Expand: geverifieerde versioned commands; bootstrap tijdelijk behouden. |
| `20261006230000` | `a4cf17b` of later voor intrekken | Extra versioned intrekactie en dossierprojectie; eerdere v2-app kan blijven werken. |
| `20261006233000` | Minimaal `9d9c365` | Contract: bootstrap-RPC's en directe private kernelcalls zijn ingetrokken. Aanmaken controleert bevoegdheid ook na de dossierlock. De publieke v2-signatures blijven werken. |
| `20261006234500` | `71a9144` blijft werken; nieuwe route gebruikt extra RPC's | Expand: minimale seizoensaanvragen en versioned persoonlijke intakeherbevestiging met append-only bevestigingshistorie. Bestaande intake-/uitnodigingssignatures en gegevens blijven behouden. |
| `20261007010000` | `8f6190f` blijft werken; geen gewijzigde RPC-signatures | Actuele native Auth-sessie verplicht voor alle 143 applicatietabellen en bestaande menselijke commands. Bestaande function-ACLs, owners en commandbodies blijven behouden; alleen drie native session-kolommen worden aan de beperkte eigenaar toegekend. Oudere tokens zonder actuele `session_id` worden geweigerd. |

Na de contractmigratie is de rollbackgrens voor aangesloten appmodus
`9d9c365261b28ef99ef1a8345c21ae9e818ed6a1`. Rol terug naar een geteste release
op of na die grens, met de reeds toegepaste database. Een oudere aangesloten
app gebruikt ingetrokken endpoints en is daarom geen geldige rollback.
De oude kernelfuncties blijven onder de beperkte command-eigenaar beschikbaar
voor de versie- en identiteit-gecontroleerde wrappers. Browserrollen en de
service-role krijgen geen recht op de oude endpoints of directe kernels.

Het feitelijk uitgevoerde [stagingreadback van `8f6190f`](evidence/staging/20261007-8f6190f/readback.json) bewijst de uitgerolde
image en bron-/migratiehashes in prototype-modus. Remote database-upgrade en
aangesloten appcompatibiliteit zijn pas bewezen na veilige beheer-/Supabase-
toegang en actuele stagingproeven; gebruik de lokale migratie- en browserproeven
als afzonderlijke bewijslagen. Gepubliceerde migraties worden niet achteraf
gewijzigd; verwijder geen geschiedenis en herstel geen oude grants om een
appdowngrade mogelijk te maken.
