/**
 * iter98e — EditableName component
 * Tap a name to switch it into a TextInput; Enter or Save → PUT /auth/me
 *  • Free-form: any value 1-80 chars (validated client + server)
 *  • Calls authAPI.updateMe then refreshUser() so cached state updates
 *  • Accent-aware: caller passes accent color used for focus ring + button
 *  • Reports an inline error if save fails; no toasts dependency required
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  /** Current name to display when not editing. */
  value: string;
  /** Accent color used for focus ring + Save CTA. */
  accent?: string;
  /** Style override for the static-mode name text. */
  nameStyle?: any;
  /** Called after a successful rename with the new name. */
  onSaved?: (newName: string) => void;
  /** data-testid prefix. Defaults to 'editable-name' */
  testIdPrefix?: string;
}

export const EditableName: React.FC<Props> = ({
  value,
  accent = '#FF6A00',
  nameStyle,
  onSaved,
  testIdPrefix = 'editable-name',
}) => {
  const { refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset draft if parent value changes externally
  useEffect(() => { setDraft(value); }, [value]);

  const beginEdit = () => {
    setError(null);
    setDraft(value);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
    setDraft(value);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed) { setError('Name cannot be empty'); return; }
    if (trimmed.length > 80) { setError('Name must be 80 characters or less'); return; }
    if (trimmed === value) { setEditing(false); return; }

    setSaving(true);
    setError(null);
    try {
      await authAPI.updateMe({ displayName: trimmed });
      await refreshUser();
      setEditing(false);
      onSaved?.(trimmed);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <TouchableOpacity
        onPress={beginEdit}
        activeOpacity={0.7}
        style={styles.row}
        data-testid={`${testIdPrefix}-display`}
        accessibilityLabel="Edit display name"
        accessibilityRole="button"
      >
        <Text style={[styles.name, nameStyle]} numberOfLines={2}>{value}</Text>
        <View style={[styles.editBadge, { borderColor: accent }]}>
          <Ionicons name="pencil" size={11} color={accent} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.editingWrap} data-testid={`${testIdPrefix}-editing`}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        autoFocus
        maxLength={80}
        placeholder="Your display name"
        placeholderTextColor="rgba(255,255,255,0.35)"
        style={[styles.input, { borderColor: accent }]}
        onSubmitEditing={save}
        editable={!saving}
        returnKeyType="done"
        data-testid={`${testIdPrefix}-input`}
        accessibilityLabel="Display name input"
      />
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={cancel}
          disabled={saving}
          style={styles.cancelBtn}
          data-testid={`${testIdPrefix}-cancel`}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          style={[styles.saveBtn, { backgroundColor: accent, opacity: saving ? 0.6 : 1 }]}
          data-testid={`${testIdPrefix}-save`}
        >
          {saving
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  editBadge: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  editingWrap: { gap: 8 },
  input: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
  },
  actions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  cancelText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  saveBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  errorText: { color: '#FF6B6B', fontSize: 12, fontWeight: '600', marginTop: 2 },
});

export default EditableName;
