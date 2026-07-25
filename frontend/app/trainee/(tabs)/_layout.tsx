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

// iter102m: trainee tabs now consume the shared style tokens so visual behavior
// (icon outline→solid on focus, accent focus pill, label weight, badge style,
// shadow, height, padding) is identical to the trainer side. Only the *content*
// of each tab differs by role.
export default function TabLayout() {
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
      {/* Role-specific tab: Saved (heart) — preserves trainee-only flow */}
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarAccessibilityLabel: 'Saved trainers tab',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSharedStyles.activeIconContainer : null}>
              <Ionicons name={focused ? 'heart' : 'heart-outline'} size={24} color={color} />
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
