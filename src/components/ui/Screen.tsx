import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { colors, space } from '@/theme';

/** Standard screen container: safe area, keyboard handling, offline banner. */
export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  refreshing,
  onRefresh,
  footer,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  padded?: boolean;
}) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.padded, styles.grow]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.grow, padded && styles.padded]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <OfflineBanner />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {content}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  // Bounded to the available height so long content scrolls and the footer stays on screen.
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  padded: { padding: space.lg, gap: space.lg },
  footer: {
    padding: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
