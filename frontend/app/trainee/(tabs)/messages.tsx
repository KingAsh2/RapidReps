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
import { useAuth } from '../../../src/contexts/AuthContext';
import { chatAPI } from '../../../src/services/api';
import { DS } from '../../../src/theme/designSystem';
import FloatingOrangeBg from '../../../src/components/FloatingOrangeBg';
import { swrCache } from '../../../src/hooks/useStaleWhileRefresh';

// Brand colors — iter95d: sourced from unified DS tokens
const COLORS = {
  orange: DS.colors.orange,
  orangeLight: DS.colors.orangeGlow,
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  navy: '#1a2a5e',
  white: DS.colors.textPrimary,
  offWhite: '#FAFBFC',
  gray: DS.colors.textSecondary,
  grayLight: DS.colors.borderStrong,
};

// Background image
const backgroundImage = require('../../../assets/images/bg-gym-blue.png');

export default function MessagesTab() {
  const router = useRouter();
  const { user } = useAuth();
  // iter106b: hydrate trainee conversations from cache for instant tab return.
  const _cachedConv = swrCache.get<any[]>('trainee:conversations');
  const [conversations, setConversations] = useState<any[]>(_cachedConv || []);
  const [loading, setLoading] = useState(!_cachedConv);
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 10000);
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
      swrCache.set('trainee:conversations', data);
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
    // iter96b: use LOCAL calendar-day diff (not elapsed-time / 86400000)
    // and trust the device's locale + timezone for rendering.
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDiff = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86400000);

    if (dayDiff === 0) {
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } else if (dayDiff === 1) {
      return 'Yesterday';
    } else if (dayDiff > 1 && dayDiff < 7) {
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

  const renderConversation = ({ item }: { item: any }) => {
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
            onPress={() => router.push(`/trainee/trainer-detail?trainerId=${otherUser.id}`)}
            data-testid={`msg-avatar-${otherUser.id}`}
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
          </TouchableOpacity>
          
          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <Text style={styles.userName}>{otherUser.fullName}</Text>
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
          <Text style={styles.headerTitle}>MESSAGES 💬</Text>
          <Text style={styles.countText}>
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </Text>
        </Animated.View>

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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
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
    color: 'rgba(255,255,255,0.5)',
    marginRight: 8,
  },
  unreadText: {
    fontWeight: '600',
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
  },
  unreadCount: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
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
