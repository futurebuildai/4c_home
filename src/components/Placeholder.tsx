import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette, radius } from '@/theme/tokens';

interface Props {
  /** Small line above the title, e.g. a date range. */
  kicker: string;
  title: string;
  /** One line on what this screen will do. */
  description: string;
}

/** Screen header per the design handoff + a placeholder body. */
export function Placeholder({ kicker, title, description }: Props) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.card}>
        <Text style={styles.description}>{description}</Text>
        <Text style={styles.badge}>Placeholder</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { paddingTop: 58, paddingHorizontal: 18, gap: 4 },
  kicker: { fontSize: 13, fontWeight: '700', color: palette.neutral[600] },
  // Caprasimo once fonts are loaded.
  title: { fontSize: 31, lineHeight: 33, color: palette.text },
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    gap: 8,
  },
  description: { fontSize: 15, color: palette.text },
  badge: { fontSize: 10.5, fontWeight: '800', color: palette.neutral[600], letterSpacing: 0.4 },
});
