import { UserX } from 'lucide-react-native';
import { FlatList, StyleSheet } from 'react-native';

import { Avatar, Button, Divider, EmptyState, ErrorState, ListRow, LoadingState } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useAsync } from '@/hooks/useAsync';
import { listBlockedUsers, unblockUser } from '@/services/safetyService';
import { useUserId } from '@/store/authStore';
import { colors, space } from '@/theme';

export default function BlockedUsersScreen() {
  const me = useUserId()!;
  const list = useAsync(listBlockedUsers, []);
  const unblock = useAction(async (id: string) => {
    await unblockUser(me, id);
    await list.reload();
  });

  if (list.loading) return <LoadingState />;
  if (list.error) return <ErrorState message={list.error.message} onRetry={list.reload} />;
  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.list}
      data={list.data ?? []}
      keyExtractor={(u) => u.user_id}
      ItemSeparatorComponent={Divider}
      renderItem={({ item }) => (
        <ListRow
          title={item.full_name || 'CASS member'}
          left={<Avatar path={item.avatar_path} name={item.full_name} size={36} />}
          right={<Button title="Unblock" variant="secondary" compact onPress={() => void unblock.run(item.user_id)} />}
        />
      )}
      ListEmptyComponent={<EmptyState icon={<UserX size={36} color={colors.textSubtle} />} title="You have not blocked anyone" />}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: space.lg, flexGrow: 1 },
});
