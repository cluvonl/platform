import {randomUUID} from 'node:crypto';
import {AttendanceForm} from '@/components/app/attendance-form';
import {requireWorkspace} from '@/lib/auth/workspace';

type AttendanceRow = {
  booking_id: string;
  booking_version: number;
  booking_state: string;
  shift_title: string;
  starts_at: string;
  ends_at: string;
  credit_minutes: number;
  executor_display_name: string;
  can_confirm: boolean;
};

export default async function AttendancePage({params}: {params: Promise<{club: string}>}) {
  const {club} = await params;
  const {client, workspace} = await requireWorkspace(club);
  const {data, error} = await client.schema('api').rpc('list_attendance_queue', {p_tenant_id: workspace.tenant_id});
  const bookings = (data ?? []) as AttendanceRow[];
  return (
    <div className="secure-page page-enter">
      <p className="secure-eyebrow">COMMISSIECONTROLE</p>
      <h1>Presentie bevestigen</h1>
      <p className="secure-lead">Alleen een actuele commissiebevoegdheid toont regels en kan de onveranderlijke urenledger aanvullen.</p>
      {error ? <p className="auth-error" role="alert">De presentielijst kan nu niet veilig worden geladen.</p> : null}
      {!error && bookings.length === 0 ? <section className="secure-empty"><h2>Geen presentieregels</h2><p>Er zijn geen boekingen binnen jouw actuele commissiescope.</p></section> : null}
      <div className="attendance-list">
        {bookings.map((booking) => (
          <article className="attendance-card" key={booking.booking_id}>
            <div><p className="secure-eyebrow">{booking.booking_state.toUpperCase()}</p><h2>{booking.shift_title}</h2><p>{booking.executor_display_name} · {booking.credit_minutes} minuten</p></div>
            {booking.can_confirm ? <AttendanceForm club={club} bookingId={booking.booking_id} bookingVersion={booking.booking_version} idempotencyKey={randomUUID()} creditMinutes={booking.credit_minutes} /> : <span className="shift-unavailable">Nog niet bevestigbaar of reeds verwerkt</span>}
          </article>
        ))}
      </div>
    </div>
  );
}
