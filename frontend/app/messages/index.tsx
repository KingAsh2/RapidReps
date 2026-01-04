import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
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

// Brand colors
const COLORS = {
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#8892b0',
  grayLight: '#E8ECF0',
};

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
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
        <LinearGradient
          colors={[COLORS.white, COLORS.offWhite]}
          style={styles.conversationGradient}
        >
          {otherUser.avatarUrl ? (
            <Image source={{ uri: otherUser.avatarUrl }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={[COLORS.teal, COLORS.tealLight]}
              style={styles.avatarPlaceholder}
            >
              <Ionicons name="person" size={24} color={COLORS.white} />
            </LinearGradient>
          )}
          
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
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={20} color={COLORS.grayLight} />
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={[COLORS.teal, COLORS.tealLight, COLORS.orange]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      {/* Full gradient background */}
      <LinearGradient
        colors={[COLORS.teal, COLORS.tealLight, COLORS.orange]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
          <Text style={styles.headerTitle}>MESSAGES 💬</Text>
          <View style={{ width: 44 }} />
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
              <LinearGradient
                colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.9)']}
                style={styles.emptyGradient}
              >
                <View style={styles.emptyIconBg}>
                  <Ionicons name="chatbubbles" size={48} color={COLORS.teal} />
                </View>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtext}>
                  Start a conversation with a trainer or trainee from their profile
                </Text>
              </LinearGradient>
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
    </View>
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
    paddingVertical: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  conversationItem: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  conversationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationContent: {
    flex: 1,
    marginLeft: 14,
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
    color: COLORS.navy,
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
    flex: 1,
  },
  unreadText: {
    color: COLORS.navy,
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
  },
  emptyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 40,
  },
  emptyGradient: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(31, 184, 180, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
  },
});
