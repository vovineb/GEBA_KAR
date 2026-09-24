import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { reportReasonOptions } from '@/features/trips/labels';
import { useAction } from '@/hooks/useAction';
import { submitReport } from '@/services/safetyService';
import { useUserId } from '@/store/authStore';
import type { ReportReason } from '@/types/domain';
import { colors, radius, space } from '@/theme';

export default function ReportScreen() {
  const { userId, tripId } = useLocalSearchParams<{ userId?: string; tripId?: string }>();
  const me = useUserId()!;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  const send = useAction(async () => {
    if (!reason) return;
    await submitReport({
      reporterId: me,
      reportedUserId: userId || null,
      tripId: tripId || null,
      reason,
      details: details.trim() || null,
    });
    Alert.alert('Report sent', 'Thank you. Reports are reviewed by the CASS team.');
    router.back();
  }, { errorTitle: 'Report not sent' });

  return (
    <Screen edges={['bottom']} footer={<Button title="Send report" disabled={!reason} loading={send.busy} onPress={send.run} />}>
      <Text tone="muted">
        Tell us what happened. The person is not told who reported them. If anyone is in danger, call 999 or 112 first —
        CASS does not provide emergency response.
      </Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {reportReasonOptions.map((o) => {
          const selected = reason === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setReason(o.value)}
              style={[styles.option, selected && styles.selected]}
            >
              <Text variant="bodyStrong" tone={selected ? 'brand' : 'default'}>
                {selected ? '● ' : '○ '}
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextField label="Details (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: { gap: space.sm },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  selected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
});
