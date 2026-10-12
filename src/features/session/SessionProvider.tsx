import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Query, type Models } from 'react-native-appwrite';

import type { MemberRow } from '@/backend/rows';
import { DATABASE_ID } from '@/backend/schema';
import { TABLES, type MemberRole } from '@/domain/access/policy';
import { account, db } from '@/lib/appwrite';

type Status = 'loading' | 'signedOut' | 'noMembership' | 'ready';

interface SessionValue {
  status: Status;
  user: Models.User<Models.Preferences> | null;
  member: (MemberRow & Models.Row) | null;
  role: MemberRole | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

type User = Models.User<Models.Preferences>;
type Member = MemberRow & Models.Row;

async function loadSession(): Promise<{ user: User | null; member: Member | null }> {
  let user: User;
  try {
    user = await account.get();
  } catch {
    return { user: null, member: null };
  }
  const { rows } = await db.listRows<Member>(DATABASE_ID, TABLES.members, [
    Query.equal('user_id', user.$id),
    Query.limit(1),
  ]);
  return { user, member: rows[0] ?? null };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);

  const apply = useCallback((next: Awaited<ReturnType<typeof loadSession>>) => {
    setUser(next.user);
    setMember(next.member);
    setStatus(!next.user ? 'signedOut' : next.member ? 'ready' : 'noMembership');
  }, []);

  const refresh = useCallback(async () => apply(await loadSession()), [apply]);

  useEffect(() => {
    let active = true;
    void loadSession().then((next) => {
      if (active) apply(next);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      member,
      role: member?.role ?? null,
      refresh,
      signIn: async (email, password) => {
        await account.createEmailPasswordSession(email, password);
        await refresh();
      },
      signOut: async () => {
        await account.deleteSession('current');
        await refresh();
      },
    }),
    [status, user, member, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
