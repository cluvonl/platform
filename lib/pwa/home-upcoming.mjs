/** Project only current, authorized future appointments onto Home cards.
 * Historical bookings remain in the snapshot for the separate history views.
 * @param {import('../../components/mobile/types').MobileSnapshot} snapshot
 */
export function selectHomeUpcoming(snapshot) {
  const readAt = Date.parse(snapshot.readAt);
  const assigned = snapshot.allocations.flatMap((allocation) => {
    const task = snapshot.tasks.find((item) => item.id === allocation.taskId);
    return allocation.canChoose && allocation.memberId && snapshot.householdMemberIds?.includes(allocation.memberId) && task && Date.parse(task.startsAt) > readAt ? [{allocation, task}] : [];
  }).sort((left, right) => Date.parse(left.task.startsAt) - Date.parse(right.task.startsAt) || left.allocation.id.localeCompare(right.allocation.id));
  const bookings = snapshot.bookings.flatMap((booking) => {
    if (!snapshot.household || booking.householdId !== snapshot.household.id || !['booked', 'transfer_pending', 'reconfirmation_required', 'performed_pending'].includes(booking.state) || !booking.startsAt || !(Date.parse(booking.startsAt) > readAt)) return [];
    const source = snapshot.tasks.find((task) => task.id === booking.taskId);
    return source ? [{booking, task: {...source, startsAt: booking.startsAt, endsAt: booking.endsAt ?? source.endsAt, location: booking.location ?? source.location, minutes: booking.minutes, instructions: booking.instructions ?? source.instructions}}] : [];
  }).sort((left, right) => Date.parse(left.task.startsAt) - Date.parse(right.task.startsAt) || left.booking.id.localeCompare(right.booking.id));
  const futureEvents = snapshot.agenda.filter((event) => Date.parse(event.startsAt) > readAt).sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt) || left.id.localeCompare(right.id));
  const matches = futureEvents.filter((event) => event.kind === 'match' && ['scheduled', 'postponed'].includes(event.state ?? ''));
  const activities = futureEvents.filter((event) => event.kind === 'event' && ['scheduled', 'moved'].includes(event.state ?? ''));
  return {assigned, bookings, events: [...matches.slice(0, 1), ...activities.slice(0, 1)]};
}
