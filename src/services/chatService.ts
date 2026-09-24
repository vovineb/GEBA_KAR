import type { RealtimeChannel } from '@supabase/supabase-js';

import { unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { ConversationSummary, Message } from '@/types/domain';

const PAGE = 40;

export async function listConversations(): Promise<ConversationSummary[]> {
  return unwrap(await supabase.rpc('list_conversations', { p_limit: 50, p_offset: 0 }));
}

export async function getConversationHeader(conversationId: string) {
  const conversations = await listConversations();
  return conversations.find((c) => c.conversation_id === conversationId) ?? null;
}

/** Newest first; pass `before` (created_at) to page backwards. */
export async function listMessages(conversationId: string, before?: string): Promise<Message[]> {
  let q = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(PAGE);
  if (before) q = q.lt('created_at', before);
  return unwrap(await q);
}

export async function sendMessage(conversationId: string, senderId: string, body: string): Promise<Message> {
  return unwrap(
    await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, body: body.trim() })
      .select('id, conversation_id, sender_id, body, created_at')
      .single(),
  );
}

export async function markConversationRead(conversationId: string) {
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
}

/** Realtime subscription to new messages in one conversation (RLS-filtered). */
export function subscribeToMessages(conversationId: string, onMessage: (m: Message) => void): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onMessage(payload.new as Message),
    )
    .subscribe();
}

export function unsubscribe(channel: RealtimeChannel) {
  void supabase.removeChannel(channel);
}

/** The creator <-> passenger conversation for a trip, if it exists. */
export async function findDirectConversation(tripId: string, passengerId: string): Promise<string | null> {
  const rows = unwrap(
    await supabase
      .from('conversations')
      .select('id')
      .eq('kind', 'direct')
      .eq('trip_id', tripId)
      .eq('passenger_id', passengerId)
      .limit(1),
  );
  return rows[0]?.id ?? null;
}
