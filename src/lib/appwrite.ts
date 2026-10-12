import 'react-native-url-polyfill/auto';

import Constants from 'expo-constants';
import { Account, Client, Storage, TablesDB, Teams } from 'react-native-appwrite';

import { env } from './env';

// The platform must match an iOS platform registered on the Appwrite
// project (console → 4C → Overview → Platforms → Add platform → Apple).
const bundleId = Constants.expoConfig?.ios?.bundleIdentifier ?? 'ai.futurebuild.fourc';

export const client = new Client()
  .setEndpoint(env.appwriteEndpoint)
  .setProject(env.appwriteProjectId)
  .setPlatform(bundleId);

export const account = new Account(client);
export const db = new TablesDB(client);
export const storage = new Storage(client);
export const teams = new Teams(client);
