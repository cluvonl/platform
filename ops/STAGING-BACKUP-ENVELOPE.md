# Staging — versleutelingslibrary voor backups

`scripts/backup-envelope.mjs` is een losse Node-library voor AES-256-GCM op exacte, opaque bundlebytes. Zij gebruikt alleen ingebouwde Node-crypto en heeft geen CLI, bestandstoegang, omgevingslezing, logging, database-, netwerk- of provideractie. De library is een encryptieonderdeel; operationele capture, artifactretentie, herstel en migratievrijgave blijven open. Importeer haar uitsluitend in een server-/operationele driver, nooit in een browserbundle.

`encryptBundle(plaintextBuffer, keyBuffer, bindings)` en `decryptBundle(envelopeBuffer, keyBuffer, trustedBindings)` vereisen een sleutel van precies 32 bytes. Encryptie maakt intern telkens een willekeurige nonce van 12 bytes en gebruikt een tag van 16 bytes. `decodeEnvironmentKey(value)` decodeert alleen een canonieke Base64-sleutelwaarde die de caller in memory aanlevert; de library leest zelf geen ENV. Provisioning is niet ingebouwd. Een toekomstige stagingdriver moet de geheime sleutel apart van de versleutelde artifact houden, zonder argv, bestand, log, fixture, prompt of export.

Alle volgende velden worden als authenticated additional data gebonden, samen met formaat, algoritme, byteaantal en nonce:

| Binding | Vereiste |
| --- | --- |
| `schema_version`, `environment` | `1`, `staging` |
| `project_ref` | Exacte projectref: 20 kleine letters/cijfers |
| `source_sha` | Exacte Git-bronSHA: 40 kleine hextekens |
| `migration_manifest_sha256` | SHA256 van het vertrouwde geordende manifest met files, versies, bytehashes, prefix en pending migraties |
| `snapshot_manifest_sha256` | SHA256 van het private capture-/bron-/backend-/visibility-/catalogus-/filesizesmanifest |
| `content_sha256` | SHA256 van de volledige plaintextbundle; alleen in de envelope, geen recursieve selfhash in de bundle |

De caller moet de verwachte bindings onafhankelijk uit zijn vertrouwde runtimecontext leveren; overnemen uit een ontvangen artifact geeft geen betrouwbare bronbinding. Onbekende velden, verkeerde versies, accessors, symbols, coercions, niet-canonieke JSON/Base64, tagfouten en bindingverschillen falen gesloten met vaste foutcodes. Validatie en kopie gebruiken één snapshot van data-propertydescriptors.

Decryptie houdt alle voorlopige plaintext intern totdat de volledige GCM-tag, exacte lengte en vertrouwde contenthash zijn geverifieerd. Er bestaat geen streaming-output, callback of vroege restorehook. Tijdelijke sleutelkopieën en plaintextchunks worden gewist; dit bewijst geen volledige JavaScript-/native-/OS-geheugenwissing. De caller beheert zijn eigen sleutel-, input- en geretourneerde plaintextbuffers.

De limieten zijn 64 MiB plaintext en 90 MiB serialized envelope. Lege of te grote buffers worden geweigerd; deze library is een begrensde memory-implementatie. Zij valideert geen bundlefilelijst, databasecatalogus, rollen, ACL's, sequences, Storagebytes of providerrootkeys. Een succesvolle decryptie geeft geen restore- of DDL-toestemming. Een toekomstige operationele driver en artifactworkflow moeten capturebinding, afzonderlijke sleutelbewaring, begrensde retentie en onafhankelijke restore afzonderlijk bewijzen.

Gericht uitgevoerd: `node --test tests/backup-envelope.test.mjs` — 16 tests, inclusief echte 8 MiB en exacte 64 MiB roundtrips, verkeerde sleutel, tag/nonce/ciphertext/AAD-tampering, post-auth contenthash, onbekende bindings en grootte-/canonicaliteitsfouten. De helper gebruikt uitsluitend synthetische bytes en een tijdelijke random sleutel, zonder inherited credential-ENV. Het [veilige bewijs](../docs/release/evidence/local/20261007-backup-envelope/verification.md) bewaart ook de oorspronkelijke 13-testuitkomst en de latere concrete 8 MiB-correctie: een geldige grote Base64-string kon in versie 1 de regexp-stack overschrijden; de huidige lineaire scanner behoudt de limieten.

Scope: `LOCAL_CRYPTO_ONLY`. Backup, restore, hosted compatibiliteit, provider-keyherstel, stagingacceptatie en V1-/productiegoedkeuring zijn hiermee niet bewezen.
