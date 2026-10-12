import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/features/session/SessionProvider';

export default function SignIn() {
  const { status, user, signIn, signOut } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'noMembership') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Not in a household yet</Text>
        <Text style={styles.muted}>
          {user?.email} is signed in but isn&apos;t a member of 4C. Ask a parent to add you.
        </Text>
        <Button title="Sign out" onPress={() => void signOut()} />
      </SafeAreaView>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>4C Home</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={busy ? 'Signing in…' : 'Sign in'} disabled={busy} onPress={submit} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  muted: { fontSize: 15, color: '#666', textAlign: 'center' },
  form: { gap: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  error: { color: '#c00' },
});
