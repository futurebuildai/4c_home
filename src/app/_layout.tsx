import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SessionProvider, useSession } from '@/features/session/SessionProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
      <StatusBar style="auto" />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { status, role } = useSession();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status !== 'ready'}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'parent'}>
        <Stack.Screen name="parent" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'nanny'}>
        <Stack.Screen name="nanny" />
      </Stack.Protected>
      <Stack.Screen name="index" />
    </Stack>
  );
}
