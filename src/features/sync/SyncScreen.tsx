import { Placeholder } from '@/components/Placeholder';
import { useSession } from '@/features/session/SessionProvider';

/** Shared by both roles: device calendar connections and notification settings. */
export default function SyncScreen() {
  const { role } = useSession();
  return (
    <Placeholder
      kicker="Calendars & notifications"
      title="Calendars & sync"
      description={
        role === 'parent'
          ? 'Choose which iPhone calendars feed the 4C calendar, and turn on notifications.'
          : 'Colton & Kristin only see the availability you publish — never your calendar events.'
      }
    />
  );
}
