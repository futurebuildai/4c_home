import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { palette } from '@/theme/tokens';

// Interim styling. The handoff calls for a custom floating pill tab bar with
// Lucide icons; that replaces this when the screens are built.
type ScreenOptions = Exclude<
  ComponentProps<typeof Tabs>['screenOptions'],
  (...args: never[]) => unknown
>;

export const tabScreenOptions: ScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: palette.accent[700],
  tabBarInactiveTintColor: palette.neutral[700],
  tabBarStyle: { backgroundColor: palette.surface },
  tabBarIconStyle: { display: 'none' },
  tabBarLabelStyle: { fontSize: 12, fontWeight: '800' },
};
