import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { chatAPI } from '../../src/services/api';
import { toast } from '../../src/utils/toast';
import { formatApiError } from '../../src/utils/formatApiError';
import { UserAvatar } from '../../src/components/UserAvatar';
import FloatingOrangeBg from '../../src/components/FloatingOrangeBg';
import { RapidBg } from '../../src/components/RapidBg';

// Brand colors
const COLORS = {
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#5a6785',
  grayLight: '#E8ECF0',
};

// iter106 perf: pure memoized message bubble. Equality is reference-only on
// `item` — message documents are immutable after send, so this safely skips
// the render whenever the list re-renders for a different message's update.
const MessageRow = React.memo(
  function MessageRow({ item, isMine, formatTime }: { item: any; isMine: boolean; formatTime: (s: string) => string }) {
    return (
    <View style={[
      mrStyles.messageContainer,
      isMine ? mrStyles.myMessageContainer : mrStyles.theirMessageContainer,
    ]}>
      <LinearGradient
        colors={isMine ? ['#FF7F00', '#F7931E'] : ['#0A0E1A', '#141929']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[mrStyles.messageBubble, isMine ? mrStyles.myMessageBubble : mrStyles.theirMessageBubble]}
      >
        <Text style={mrStyles.myMessageText}>{item.content}</Text>
        <Text style={mrStyles.myMessageTime}>{formatTime(item.createdAt)}</Text>
      </LinearGradient>
    </View>
    );
  },
  (prev, next) => prev.item === next.item && prev.isMine === next.isMine,
);
const mrStyles = StyleSheet.create({
  messageContainer: { marginVertical: 4, paddingHorizontal: 16 },
  myMessageContainer: { alignItems: 'flex-end' },
  theirMessageContainer: { alignItems: 'flex-start' },
  // iter106aa: bubbles previously had no backgroundColor — text floated
  // straight on the body and was invisible on the old white gradient.
  // Now: my bubble = brand orange, their bubble = subtle white tint.
  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, maxWidth: '80%' },
  myMessageBubble: { borderBottomRightRadius: 4, backgroundColor: '#FF6A00' },
  theirMessageBubble: {
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  myMessageText: { color: '#FFFFFF', fontSize: 15, lineHeight: 20 },
  myMessageTime: { color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
});

export default function ChatScreen() {
  const router = useRouter();
  // iter106q: accept BOTH naming conventions for the receiver param.
  // Earlier code paths passed `otherUserId`/`otherUserName` (e.g. "Message
  // the Admin" CTA) while most call sites pass `userId`/`userName`. The
  // chat screen used to read only the latter, which silently broke the
  // admin-support flow (send button looked dead). Fall back to the alias
  // form so both paths work.
  const params = useLocalSearchParams();
  const conversationId = params.conversationId;
  const userId = (params.userId || params.otherUserId) as string | undefined;
  const userName = (params.userName || params.otherUserName) as string | undefined;
  const userPhoto = params.userPhoto as string | undefined;
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Animation
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadMessages();
    // iter105 perf: was 3000ms — quadrupled chat traffic and forced re-render
    // of the whole list every tick. 8s feels indistinguishable to users in
    // practice (we still scroll-to-bottom on send via the optimistic update
    // path below).
    const interval = setInterval(loadMessages, 8000);
    return () => clearInterval(interval);
  }, [conversationId]);

  // iter105 perf: render last-session memory line at the top of the chat
  // (resolves trainer/trainee context instantly when re-engaging an old
  // conversation).
  const [lastSession, setLastSession] = useState<any>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!userId) return;
        const sessionsApi = (await import('../../src/services/api')).traineeAPI;
        const all = await sessionsApi.getSessions().catch(() => []);
        const past = (all || []).filter((s: any) => (
          (s.status === 'completed') && (s.trainerId === String(userId) || s.traineeId === String(userId))
        ));
        past.sort((a: any, b: any) => new Date(b.sessionDateTimeStart).getTime() - new Date(a.sessionDateTimeStart).getTime());
        if (!cancelled && past.length > 0) setLastSession(past[0]);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!loading) {
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const loadMessages = async () => {
    if (!conversationId) return;
    try {
      const data = await chatAPI.getMessages(conversationId as string);
      setMessages(data);
      if (loading && data.length > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    if (!userId) {
      toast.error("Couldn't open this conversation", 'Please go back and try again');
      return;
    }
    setSending(true);
    try {
      await chatAPI.sendMessage(
        userId as string,
        newMessage.trim(),
        conversationId as string
      );
      setNewMessage('');
      await loadMessages();
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(formatApiError(error, "Couldn't send message"));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    // iter98b: backend stores datetime.utcnow() (naive) — ISO has no 'Z'.
    // Append 'Z' when missing so JS parses it as UTC, then renders in the
    // device's local timezone via toLocaleTimeString(undefined, ...).
    const iso = dateStr && /[Z]|[+-]\d\d:?\d\d$/.test(dateStr) ? dateStr : `${dateStr}Z`;
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  // iter98b: format a day-separator header (e.g., "Today", "Yesterday", "Wed, Jun 4")
  const formatDayHeader = (dateStr: string) => {
    const iso = dateStr && /[Z]|[+-]\d\d:?\d\d$/.test(dateStr) ? dateStr : `${dateStr}Z`;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 0 && diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Group messages by local day for separator rendering
  const messagesWithSeparators = React.useMemo(() => {
    const out: any[] = [];
    let lastKey = '';
    for (const m of messages) {
      const iso = m.createdAt && /[Z]|[+-]\d\d:?\d\d$/.test(m.createdAt) ? m.createdAt : `${m.createdAt}Z`;
      const d = new Date(iso);
      const key = isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (key && key !== lastKey) {
        out.push({ __sep: true, id: `sep-${key}`, label: formatDayHeader(m.createdAt) });
        lastKey = key;
      }
      out.push(m);
    }
    return out;
  }, [messages]);

  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  // iter106 perf: extracted to a memoized child so scrolling the message list
  // doesn't re-render every bubble on every state tick. Equality is purely
  // identity-based on `item` + `isMine` — message contents are immutable once
  // sent, so reference equality is correct here.
  const renderMessage = useCallback(({ item }: { item: any }) => {
    if (item?.__sep) {
      return (
        <View style={styles.dayHeaderRow} data-testid="day-separator">
          <View style={styles.dayHeaderLine} />
          <Text style={styles.dayHeaderText}>{item.label}</Text>
          <View style={styles.dayHeaderLine} />
        </View>
      );
    }
    return <MessageRow item={item} isMine={item.senderId === user?.id} formatTime={formatTime} />;
  }, [user?.id]);

  if (loading) {
    return (
      <LinearGradient
        colors={['#0A0E1A', '#141929', '#FF6A00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </LinearGradient>
    );
  }

  return (
    <RapidBg variant="messages-chat" style={styles.container}>
      {/* Gradient header area */}
      <LinearGradient
        colors={['rgba(10,14,26,0.95)', 'rgba(20,25,41,0.85)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FloatingOrangeBg />
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          {/* Profile Photo - tappable */}
          <TouchableOpacity
            onPress={() => {
              const roles = user?.roles || [];
              if (roles.includes('trainer')) {
                router.push({ pathname: '/trainer/trainee-profile', params: { traineeId: userId as string } });
              } else {
                router.push(`/trainee/trainer-detail?trainerId=${userId}`);
              }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            data-testid="chat-profile-link"
          >
            {/* iter97b: unified avatar with initials fallback (was generic person icon) */}
            <UserAvatar
              user={{ avatarUrl: userPhoto, fullName: userName as string }}
              size={40}
            />
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{userName}</Text>
              <Text style={styles.headerStatus}>Online</Text>
            </View>
          </TouchableOpacity>
          <View style={{ width: 44 }} />
        </Animated.View>

        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* iter106aa: chat background was `[grayLight, offWhite, white]`
              — near-white. All text inside (empty-state, message bubbles,
              input field) is `#FFFFFF`, so it disappeared. Switched to a
              dark gradient that matches the brutalist app theme + the
              messages list page (where this chat is opened from). */}
          <LinearGradient
            colors={['#0A0E14', '#141929', '#1A2035']}
            style={styles.chatBackground}
          >
            <FlatList
              ref={flatListRef}
              data={messagesWithSeparators}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              showsVerticalScrollIndicator={false}
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={11}
              removeClippedSubviews
              ListHeaderComponent={lastSession ? (
                <View style={styles.lastSessionStrip} data-testid="chat-last-session-strip">
                  <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.55)" />
                  <Text style={styles.lastSessionText} numberOfLines={1}>
                    Last trained {new Date(lastSession.sessionDateTimeStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {lastSession.locationNameOrAddress ? ` • ${lastSession.locationNameOrAddress}` : ''}
                    {lastSession.durationMinutes ? ` • ${lastSession.durationMinutes} min` : ''}
                  </Text>
                </View>
              ) : null}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconBg}>
                    <Ionicons name="chatbubble" size={40} color={'#FF6A00'} />
                  </View>
                  <Text style={styles.emptyText}>Start the conversation!</Text>
                  <Text style={styles.emptySubtext}>Send a message to {userName}</Text>
                </View>
              }
            />
          </LinearGradient>

          {/* Input Area */}
          <View style={styles.inputWrapper}>
            <LinearGradient
              colors={['#141929', '#1A2035']}
              style={styles.inputContainer}
            >
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor={COLORS.gray}
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={sending || !newMessage.trim()}
              >
                <LinearGradient
                  colors={newMessage.trim() ? [COLORS.orange, COLORS.orangeHot] : [COLORS.grayLight, COLORS.gray]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendButtonGradient}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Ionicons name="send" size={18} color={COLORS.white} />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </RapidBg>
  );
}

const styles = StyleSheet.create({
  // iter105 perf/UX: last-session memory strip
  lastSessionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lastSessionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.2,
  },
  container: {
    flex: 1,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
    alignItems: 'flex-start',
  },
  headerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerPhotoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  headerStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  chatContainer: {
    flex: 1,
  },
  chatBackground: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(31, 184, 180, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  myMessageBubble: {
    borderBottomRightRadius: 6,
  },
  theirMessageBubble: {
    borderBottomLeftRadius: 6,
  },
  myMessageText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
    color: COLORS.white,
  },
  theirMessageText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
    color: '#FFFFFF',
  },
  myMessageTime: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.75)',
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  theirMessageTime: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  inputWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#1A2035',
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    maxHeight: 100,
    paddingVertical: 10,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // iter98b: day-separator styles
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  dayHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(10, 14, 26, 0.08)',
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(10, 14, 26, 0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
