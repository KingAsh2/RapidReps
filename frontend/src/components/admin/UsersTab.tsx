import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, s, PAGE_SIZE, PaginationBar, FilterPills, SearchBar } from './AdminShared';

interface Props {
  users: any[];
  usersTotal: number;
  usersPage: number;
  userSearch: string;
  onSearchChange: (s: string) => void;
  userRoleFilter: string;
  onRoleFilterChange: (s: string) => void;
  fetchUsers: (page?: number, search?: string, role?: string) => void;
  onViewUser: (userId: string) => void;
  onMessageUser: (userId: string, userName: string) => void;
  onRemoveUser: (userId: string, userName: string) => void;
}

export const UsersTab = ({
  users, usersTotal, usersPage, userSearch, onSearchChange,
  userRoleFilter, onRoleFilterChange, fetchUsers,
  onViewUser, onMessageUser, onRemoveUser,
}: Props) => {
  const roleOptions = [
    { key: '', label: 'All' },
    { key: 'trainer', label: 'Trainers' },
    { key: 'trainee', label: 'Trainees' },
  ];

  return (
    <View>
      <Text style={s.sectionTitle}>All Users ({usersTotal})</Text>
      <SearchBar
        value={userSearch}
        onChangeText={onSearchChange}
        onSubmit={() => fetchUsers(0, userSearch, userRoleFilter)}
        placeholder="Search by name, email, city, or state..."
      />
      <FilterPills
        options={roleOptions}
        selected={userRoleFilter}
        onSelect={(role) => { onRoleFilterChange(role); fetchUsers(0, userSearch, role); }}
        testIdPrefix="user-filter"
      />
      {users.map((user) => (
        <View key={user.id} style={s.listCard}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
            onPress={() => onViewUser(user.id)}
            data-testid={`admin-user-${user.id}`}
          >
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={s.userAvatar} />
            ) : (
              <View style={[s.listCardIcon, { backgroundColor: user.isAdmin ? C.error : user.roles?.includes('trainer') ? C.orange : C.teal }]}>
                <Ionicons
                  name={user.isAdmin ? 'shield' : user.roles?.includes('trainer') ? 'fitness' : 'person'}
                  size={18} color={C.white}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.listCardTitle}>{user.fullName}</Text>
              <Text style={s.listCardSub}>{user.email}</Text>
              {(user.city || user.state) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name="location-outline" size={12} color={C.teal} />
                  <Text style={[s.listCardSub, { color: C.teal, fontWeight: '600' }]}>{[user.city, user.state].filter(Boolean).join(', ')}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={s.iconBtn} onPress={() => onMessageUser(user.id, user.fullName)} data-testid={`msg-user-${user.id}`}>
              <Ionicons name="chatbubble" size={16} color={C.teal} />
            </TouchableOpacity>
            {!user.isAdmin && (
              <TouchableOpacity style={[s.iconBtn, { borderColor: C.error }]} onPress={() => onRemoveUser(user.id, user.fullName)} data-testid={`remove-user-${user.id}`}>
                <Ionicons name="trash" size={16} color={C.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
      <PaginationBar current={usersPage} total={usersTotal} pageSize={PAGE_SIZE} onPageChange={(p) => fetchUsers(p)} />
    </View>
  );
};
