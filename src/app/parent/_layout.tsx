import { Tabs } from 'expo-router';

import { tabScreenOptions } from '@/components/tabOptions';

export default function ParentTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="nanny" options={{ title: 'Nanny' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="files" options={{ title: 'Files' }} />
      <Tabs.Screen name="sync" options={{ title: 'Sync' }} />
    </Tabs>
  );
}
