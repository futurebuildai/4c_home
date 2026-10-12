/** Public runtime config. EXPO_PUBLIC_* vars are inlined at build time. */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env.`);
  return value;
}

export const env = {
  appwriteEndpoint: required(
    'EXPO_PUBLIC_APPWRITE_ENDPOINT',
    process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  ),
  appwriteProjectId: required(
    'EXPO_PUBLIC_APPWRITE_PROJECT_ID',
    process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  ),
  householdId: required('EXPO_PUBLIC_HOUSEHOLD_ID', process.env.EXPO_PUBLIC_HOUSEHOLD_ID),
};
