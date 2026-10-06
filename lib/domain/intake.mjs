// Display hours are converted once. Stored preferences remain integer minutes.
export function intakeMinutesFromHours(value) {
  const text = String(value).trim();
  if (!text) return null;
  let minutes;
  const clock = /^(\d{1,4}):([0-5]\d)$/.exec(text);
  if (clock) minutes = Number(clock[1]) * 60 + Number(clock[2]);
  else {
    const decimal = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(text);
    if (!decimal) throw new RangeError('INVALID_MONTHLY_HOURS');
    const denominator = 10 ** (decimal[2]?.length ?? 0);
    const numerator = Number(decimal[1]) * denominator + Number(decimal[2] ?? 0);
    if ((numerator * 60) % denominator !== 0) throw new RangeError('INVALID_MONTHLY_HOURS');
    minutes = numerator * 60 / denominator;
  }
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 100_000) throw new RangeError('INVALID_MONTHLY_HOURS');
  return minutes;
}

export function intakeHoursFromMinutes(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000) return '';
  const remainder = value % 60;
  return remainder ? `${Math.floor(value / 60)}:${String(remainder).padStart(2, '0')}` : String(value / 60);
}

export function intakeUnavailabilityDates(value) {
  const items = String(value).split(',').map((item) => item.trim()).filter(Boolean);
  if (items.length > 60) throw new RangeError('INVALID_UNAVAILABILITY');
  for (const item of items) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item)) throw new RangeError('INVALID_UNAVAILABILITY');
    const date = new Date(`${item}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== item || item < '1900-01-01' || item > '2199-12-31') throw new RangeError('INVALID_UNAVAILABILITY');
  }
  return [...new Set(items)].sort();
}

// Legacy free text remains visible and selected until its owner removes it.
export function intakeAnswerList(value, options = []) {
  const values = Array.isArray(value) ? value.filter((item) => typeof item === 'string') : typeof value === 'string' && value.trim() ? [value.trim()] : [];
  return [...new Set(values.map((item) => options.find((option) => option.toLocaleLowerCase('nl-NL') === item.toLocaleLowerCase('nl-NL')) ?? item))];
}
