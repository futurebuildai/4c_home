import { Redirect } from 'expo-router';

import { useSession } from '@/features/session/SessionProvider';

/** Entry point: send each person to their role's tabs. */
export default function Index() {
  const { status, role } = useSession();
  if (status !== 'ready') return <Redirect href="/sign-in" />;
  return <Redirect href={role === 'nanny' ? '/nanny' : '/parent'} />;
}
