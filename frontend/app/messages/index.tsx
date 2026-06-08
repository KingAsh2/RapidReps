import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ImageBackground,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { chatAPI } from '../../src/services/api';
import FloatingOrangeBg from '../../src/components/FloatingOrangeBg';

// Brand colors
const COLORS = {
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#5a6785',
  grayLight: '#E8ECF0',
};

// Background image
const backgroundImage = require('../../assets/images/bg-gym-blue.png');

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        Animated.spring(listAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }, 200);
    }
  }, [loading]);

  const loadConversations = async () => {
    try {
      const data = await chatAPI.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const getOtherParticipant = (conv: any) => {
    return conv.participantDetails?.find((p: any) => p.id !== user?.id);
  };

  const formatTime = (dateStr: string) => {
    // iter96b: local calendar-day diff + locale-aware rendering
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86400000);

    if (days === 0) {
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    } else {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  };

  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0],
  });

  const listTranslateY = listAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  const renderConversation = ({ item, index }: { item: any; index: number }) => {
    const otherUser = getOtherParticipant(item);
    if (!otherUser) return null;

    const isMyMessage = item.lastMessage?.senderId === user?.id;
    const preview = item.lastMessage?.content || 'No messages yet';

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => router.push(`/messages/chat?conversationId=${item.id}&userId=${otherUser.id}&userName=${otherUser.fullName}`)}
        activeOpacity={0.8}
      >
        <View style={styles.conversationCard}>
          <TouchableOpacity 
            style={{ position: 'relative' }}
            onPress={() => {
              // Navigate to profile based on role
              const route = user?.roles?.includes('trainer') 
                ? `/trainer/trainee-profile?traineeId=${otherUser.id}`
                : `/trainee/trainer-detail?trainerId=${otherUser.id}`;
              router.push(route);
            }}
            data-testid={`message-avatar-${otherUser.id}`}
          >
            {otherUser.avatarUrl ? (
              <Image source={{ uri: otherUser.avatarUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={['#0A0E1A', '#141929']}
                style={styles.avatarPlaceholder}
              >
                <Ionicons name="person" size={24} color={COLORS.white} />
              </LinearGradient>
            )}
            {/* Active indicator */}
            <View style={{ position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#00D68F', borderWidth: 2, borderColor: '#141929' }} />
          </TouchableOpacity>
          
          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                <Text style={styles.userName} numberOfLines={1}>{otherUser.fullName}</Text>
                {/* iter97d: badge admin support conversations */}
                {otherUser.isAdmin && (
                  <View style={styles.supportBadge} data-testid={`support-badge-${otherUser.id}`}>
                    <Ionicons name="shield-checkmark" size={10} color="#fff" />
                    <Text style={styles.supportBadgeText}>SUPPORT</Text>
                  </View>
                )}
              </View>
              {item.lastMessage && (
                <Text style={styles.time}>
                  {formatTime(item.lastMessage.createdAt)}
                </Text>
              )}
            </View>
            
            <View style={styles.messagePreview}>
              <Text
                style={[
                  styles.previewText,
                  item.unreadCount > 0 && !isMyMessage && styles.unreadText,
                ]}
                numberOfLines={1}
              >
                {isMyMessage ? 'You: ' : ''}{preview}
              </Text>
              {item.unreadCount > 0 && !isMyMessage && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
        <LinearGradient
          colors={['rgba(10, 14, 26, 0.92)', 'rgba(17, 24, 39, 0.88)']}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </LinearGradient>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      {/* Orange overlay */}
      <LinearGradient
        colors={['rgba(10, 14, 26, 0.92)', 'rgba(17, 24, 39, 0.88)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FloatingOrangeBg />
        {/* Header with back button */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} data-testid="messages-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>MESSAGES</Text>
          <View style={{ width: 40 }} />
        </Animated.View>

        {/* Conversation Count */}
        <Text style={styles.countText}>
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </Text>

        <Animated.View
          style={[
            styles.listContainer,
            {
              opacity: listAnim,
              transform: [{ translateY: listTranslateY }],
            },
          ]}
        >
          {conversations.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyContent}>
                <View style={styles.emptyIconBg}>
                  <Ionicons name="chatbubbles" size={48} color={COLORS.orange} />
                </View>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtext}>
                  Start a conversation with a trainer from their profile
                </Text>
              </View>
            </View>
          ) : (
            <FlatList
              data={conversations}
              renderItem={renderConversation}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.white} />
              }
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={12}
              maxToRenderPerBatch={8}
              windowSize={9}
              removeClippedSubviews
            />
          )}
        </Animated.View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  countText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 100,
  },
  conversationItem: {
    marginBottom: 12,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 14,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // iter97d: admin support conversation badge
  supportBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FF7A00',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8,
  },
  supportBadgeText: {
    fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.8,
  },
  time: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewText: {
    flex: 1,
    fontSize: 14,
    // iter102t: bumped from rgba 0.5 (~4:1, sub-AA) → rgba 0.78 (~7:1, passes AA).
    color: 'rgba(255,255,255,0.78)',
    marginRight: 8,
  },
  unreadText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unreadBadge: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    // iter102t: subtle outline so the badge stands off the hero background on light frames.
    borderWidth: 1,
    borderColor: 'rgba(10,14,26,0.85)',
  },
  unreadCount: {
    fontSize: 13,
    fontWeight: '900',
    // iter102t: white-on-orange fails WCAG AA (~2.5:1). Dark navy on orange is ~7:1.
    color: '#0A0E1A',
  },
  emptyCard: {
    marginTop: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#141929',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  emptyContent: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 127, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
