/** Sends push notifications through the Expo push service. */
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendExpoPush(messages: PushMessage[]): Promise<unknown> {
  if (messages.length === 0) return null;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  // Only needed if "enhanced push security" is turned on for the Expo project.
  if (process.env.EXPO_ACCESS_TOKEN)
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(messages.map((m) => ({ sound: 'default', ...m }))),
  });
  if (!response.ok)
    throw new Error(`Expo push failed: ${response.status} ${await response.text()}`);
  return response.json();
}
