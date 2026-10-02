function minutes(value,name) {
  if (!Number.isSafeInteger(value)||value<0) throw new TypeError(`${name} moet een niet-negatief geheel aantal minuten zijn`);
  return value;
}
export function obligationSummary({targetMinutes,winterTargetMinutes,confirmedMinutes,beforeWinterMinutes,pendingMinutes=0,plannedMinutes=0,exempt=false,buyoutApproved=false}) {
  for (const [k,v] of Object.entries({targetMinutes,winterTargetMinutes,confirmedMinutes,beforeWinterMinutes,pendingMinutes,plannedMinutes})) minutes(v,k);
  if (winterTargetMinutes>targetMinutes||beforeWinterMinutes>confirmedMinutes) throw new RangeError('Tegenstrijdige urensaldi');
  const fulfilled=exempt||buyoutApproved;
  const remaining=fulfilled?0:Math.max(0,targetMinutes-confirmedMinutes);
  return {confirmedMinutes,plannedMinutes,pendingMinutes,remainingMinutes:remaining,winterShortfallMinutes:fulfilled?0:Math.min(remaining,Math.max(0,winterTargetMinutes-beforeWinterMinutes)),needsReview:pendingMinutes>0,fulfilledByException:fulfilled};
}
export function contributionCents(shortfallMinutes,annualContributionCents=15000,standardTargetMinutes=720) {
  minutes(shortfallMinutes,'shortfallMinutes');minutes(annualContributionCents,'annualContributionCents');
  if (!Number.isSafeInteger(standardTargetMinutes)||standardTargetMinutes<=0) throw new RangeError('standaarddoel moet positief zijn');
  return Math.round(shortfallMinutes*annualContributionCents/standardTargetMinutes);
}
