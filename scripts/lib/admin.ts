/** Server-side Appwrite client for local admin scripts (uses an API key). */
import { Client } from 'node-appwrite';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

export function adminClient(): Client {
  return new Client()
    .setEndpoint(requireEnv('EXPO_PUBLIC_APPWRITE_ENDPOINT'))
    .setProject(requireEnv('EXPO_PUBLIC_APPWRITE_PROJECT_ID'))
    .setKey(requireEnv('APPWRITE_API_KEY'));
}

export function householdTeamId(): string {
  return requireEnv('EXPO_PUBLIC_HOUSEHOLD_ID');
}

export function isNotFound(err: unknown): boolean {
  return (err as { code?: number })?.code === 404;
}

export function isConflict(err: unknown): boolean {
  return (err as { code?: number })?.code === 409;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
