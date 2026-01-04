import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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

export default function ChatScreen() {
  const router = useRouter();
  const { conversationId, userId, userName } = useLocalSearchParams();
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
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [conversationId]);

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
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  const renderMessage = ({ item }: { item: any }) => {
    const isMyMessage = item.senderId === user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        {isMyMessage ? (
          <LinearGradient
            colors={[COLORS.teal, COLORS.tealLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.messageBubble, styles.myMessageBubble]}
          >
            <Text style={styles.myMessageText}>{item.content}</Text>
            <Text style={styles.myMessageTime}>{formatTime(item.createdAt)}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.messageBubble, styles.theirMessageBubble]}>
            <Text style={styles.theirMessageText}>{item.content}</Text>
            <Text style={styles.theirMessageTime}>{formatTime(item.createdAt)}</Text>
          </View>
        )}
      </View>
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
        <Text style={styles.loadingText}>Loading chat...</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      {/* Gradient header area */}
      <LinearGradient
        colors={[COLORS.teal, COLORS.tealLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
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
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{userName}</Text>
            <Text style={styles.headerStatus}>Online</Text>
          </View>
          <View style={{ width: 44 }} />
        </Animated.View>

        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Chat background */}
          <LinearGradient
            colors={[COLORS.grayLight, COLORS.offWhite, COLORS.white]}
            style={styles.chatBackground}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconBg}>
                    <Ionicons name="chatbubble" size={40} color={COLORS.teal} />
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
              colors={[COLORS.white, COLORS.offWhite]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
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
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  headerStatus: {
    fontSize: 12,
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
    color: COLORS.navy,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
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
    backgroundColor: COLORS.white,
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
    color: COLORS.navy,
  },
  myMessageTime: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.75)',
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  theirMessageTime: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  inputWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: COLORS.offWhite,
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
    color: COLORS.navy,
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
});
