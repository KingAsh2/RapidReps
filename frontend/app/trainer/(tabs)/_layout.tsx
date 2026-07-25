import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useNotifications } from '../../../src/contexts/NotificationContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import { UserAvatar } from '../../../src/components/UserAvatar';
import {
  TAB_COLORS,
  TAB_BAR_STYLE,
  TAB_LABEL_STYLE,
  TAB_ICON_STYLE,
  TAB_BADGE_STYLE,
  tabSharedStyles,
  TabBarGlassBackground,
} from '../../../src/components/tabBarStyles';

// iter102m: trainer tabs share the exact same visual tokens as the trainee
// tabs (outline→solid icon swap, accent focus pill, label weight, badge style,
// shadow, height, padding). Only the role-specific tab "Funds" differs.
export default function TrainerTabsLayout() {
  const { unreadMessageCount, pendingSessionCount } = useNotifications();
  const { user } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TAB_COLORS.accent,
        tabBarInactiveTintColor: TAB_COLORS.gray,
        tabBarStyle: TAB_BAR_STYLE,
        tabBarLabelStyle: TAB_LABEL_STYLE,
        tabBarIconStyle: TAB_ICON_STYLE,
        // iter106ax: dark-blur glass background under all tabs.
        tabBarBackground: () => <TabBarGlassBackground />,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSharedStyles.activeIconContainer : null}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarAccessibilityLabel: 'My sessions tab',
          tabBarBadge: pendingSessionCount > 0 ? pendingSessionCount : undefined,
          tabBarBadgeStyle: TAB_BADGE_STYLE,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSharedStyles.activeIconContainer : null}>
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: 'Receipts',
          tabBarAccessibilityLabel: 'Payment receipts tab',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSharedStyles.activeIconContainer : null}>
              <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Chat',
          tabBarAccessibilityLabel: 'Chat tab',
          tabBarBadge: unreadMessageCount > 0 ? unreadMessageCount : undefined,
          tabBarBadgeStyle: TAB_BADGE_STYLE,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSharedStyles.activeIconContainer : null}>
              <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
            </View>
          ),
        }}
      />
      {/* Role-specific tab: Funds (wallet) — preserves trainer-only flow */}
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Funds',
          tabBarAccessibilityLabel: 'Funds tab',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSharedStyles.activeIconContainer : null}>
              <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'My profile tab',
          tabBarIcon: ({ focused }) => (
            <UserAvatar user={user} size={26} ring={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
