# Backup-envelope — uitgevoerde lokale cryptoproef

Scope: `LOCAL_CRYPTO_ONLY`. De canonical module is exact de bewezen tweede cryptorevisie, SHA256 `9f57c5b69a6e60bd36775e8167f37363f292da4baaf3bb217c1c46b2f0a35abe`. Tests en grenshelper zijn gekopieerd met uitsluitend aangepaste relatieve imports. Geen credentials, bestaande private bundle, dump, sleutel, plaintext, ciphertext of nonce is in dit bewijs opgenomen.

Daadwerkelijk uitgevoerd onder Node **v24.18.0**:

```text
node --test tests/backup-envelope.test.mjs
./node_modules/.bin/eslint scripts/backup-envelope.mjs tests/backup-envelope.test.mjs tests/helpers/backup-envelope-upper-boundary.mjs --max-warnings 0
```

16 tests, 16 PASS, 0 fail/cancel/skip/TODO. ESLint op drie nieuwe MJS-bestanden: PASS, 0 waarschuwingen. Dit noemt de gemeten lokale Node-versie; de CI-pin en een toekomstige CI-uitkomst zijn afzonderlijk bewijs.

De uitgevoerde tests omvatten echte synthetische roundtrips van 8 MiB en precies 64 MiB, random nonces, verkeerde sleutel, bitwijzigingen in ciphertext/nonce/tag, authenticated metadata, onafhankelijke vertrouwde bindings, post-auth contenthash, canonical JSON/Base64, accessors/symbols/Proxy, truncatie en daadwerkelijke te grote buffers. De limieten zijn ongewijzigd: 64 MiB plaintext en 90 MiB envelope. De aparte 64 MiB-helper erft geen credential-ENV en print uitsluitend vaste veilige uitkomstmetadata.

De oorspronkelijke 13-testuitkomst is intact bewaard in `historical-safe-local-crypto-results-v1.json` (SHA256 `e45b0bf37559235cea7cb8940260ae544db09a8dc4d153279e6bc9cac521243b`). Die kleinere tests bewezen destijds geen geldige grote roundtrip. De latere echte rootprobe in `historical-root-synthetic-size-probe-v1.json` (SHA256 `79ab5382cb9b3722be0c63f81d1cec9b957326b9834512cd9ab1fd150a45c88f`) geeft 1 MiB PASS en een geldige 8 MiB-input die buiten `EnvelopeError` met `RangeError` faalde. De oorspronkelijke uitvoertijd is niet behouden; de recordtijd is expliciet alleen het moment van vastlegging. Dit historische resultaat is niet herschreven als PASS.

Revisie 2 vervangt de gegroepeerde Base64-regexp door een lineaire ASCII-scan met canonical decode/re-encodecheck. Bindingvalidatie en kopie gebruiken één data-descriptorsnapshot, en onverwachte native exceptions krijgen vaste libraryfoutcodes. De intact gekopieerde tmp-v2proof heet `safe-local-crypto-results-v2.json` (SHA256 `55af88be7df3f64b232e8b09ff31ca30526ce6830382e3a9d1e7b44bc07b4011`); `canonical-local-crypto-results.json` legt de nieuwe daadwerkelijk uitgevoerde canonical checks en artifacthashes vast.

De library heeft geen CLI, bestand-/ENVlezing, logging, subprocess, database- of netwerkactie. Er is geen sleutel geprovisioneerd, workflow gewijzigd, artifactretentie ingesteld, migratie uitgevoerd of dependency/lockfile gewijzigd. De gerichte tests gebruiken uitsluitend synthetische bytes en tijdelijke random keys. Operational capture, restore, volledige schema-/provider-keydecryptability, hosted compatibiliteit, stagingacceptatie en V1-/productiegoedkeuring blijven **niet bewezen**.

De [aanvullende algemene rootvalidatie](root-validation.json) heeft daarna daadwerkelijk alle 139 Node-tests en volledige ESLint doorstaan. De modulebytes blijven exact gelijk; deze check bewijst geen database- of stagingrestore.
