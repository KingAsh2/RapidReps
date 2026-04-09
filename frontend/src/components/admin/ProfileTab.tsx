import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, s } from './AdminShared';

interface Props {
  adminUser: any;
  onEditProfile: () => void;
  onChangePassword: () => void;
}

export const ProfileTab = ({ adminUser, onEditProfile, onChangePassword }: Props) => (
  <View>
    <Text style={s.sectionTitle}>Admin Profile</Text>
    {adminUser ? (
      <View style={s.profileCard}>
        <View style={s.profileAvatar}>
          <Ionicons name="shield-checkmark" size={36} color={'#FF6A00'} />
        </View>
        <Text style={s.profileName}>{adminUser.fullName}</Text>
        <Text style={s.profileSub}>{adminUser.email}</Text>
        <Text style={s.profileSub}>{adminUser.phone}</Text>
        <View style={s.divider} />
        <View style={s.profileInfo}>
          <View style={s.profileInfoRow}>
            <Text style={s.profileInfoLabel}>Role</Text>
            <Text style={s.profileInfoValue}>Administrator</Text>
          </View>
          <View style={s.profileInfoRow}>
            <Text style={s.profileInfoLabel}>Account ID</Text>
            <Text style={s.profileInfoValue}>{adminUser.id?.slice(-8)}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.editProfileBtn} onPress={onEditProfile} data-testid="edit-profile-btn">
          <Ionicons name="create" size={18} color={C.white} />
          <Text style={s.editProfileBtnText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.editProfileBtn, { backgroundColor: '#0A0E1A', marginTop: 10 }]}
          onPress={onChangePassword}
          data-testid="change-password-btn"
        >
          <Ionicons name="lock-closed" size={18} color={C.white} />
          <Text style={s.editProfileBtnText}>Change Password</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <ActivityIndicator color={'#FF6A00'} />
    )}
  </View>
);
