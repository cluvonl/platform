const reasons: Record<string, string> = {
  ELIGIBLE: 'Voldoet nu aan de voorwaarden',
  CAPACITY_FULL: 'Voldoet aan de uitvoerdersvoorwaarden; de plaats is bezet',
  EXECUTOR_MANDATE_REQUIRED: 'Er ontbreekt een actuele uitvoerdersmachtiging',
  BOOKING_CLOSED: 'Inschrijven voor deze taak is gesloten',
  OBLIGATION_SEASON_MISMATCH: 'Deze taak past niet bij de actuele seizoensafspraak',
  BOOKING_PERMISSION_REQUIRED: 'Er ontbreekt toestemming om voor dit huishouden te boeken',
  EXECUTOR_MANDATE_EXPIRED: 'De uitvoerdersmachtiging geldt niet gedurende de hele taak',
  MINIMUM_AGE_NOT_MET: 'De geverifieerde leeftijd voldoet niet aan de minimumleeftijd',
  QUALIFIED_BUDDY_REQUIRED: 'Een bevoegd begeleidend maatje is vereist',
  QUALIFICATION_REQUIRED_OR_EXPIRED: 'Het vereiste geldige certificaat ontbreekt',
  EXECUTOR_UNAVAILABLE: 'Deze uitvoerder is als niet beschikbaar geregistreerd',
  EXECUTOR_OVERLAP: 'Deze uitvoerder heeft al een overlappende taak',
  BOOKING_WINDOW_CLOSED: 'Deze taak is nu niet open voor inschrijving',
};

export const suitabilityLabel = (reason: string) => reasons[reason] ?? 'De actuele voorwaarden moeten nog worden gecontroleerd';
