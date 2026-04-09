import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
  TextInput,
  Share,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { toast } from '../../src/utils/toast';

// Brand colors
const COLORS = {
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F5F6F8',
  success: '#00C853',
  error: '#FF4757',
};

// Background image
const backgroundImage = require('../../assets/images/bg-box-jumps.png');

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  initials: string;
}

export default function ShareSessionStatusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Mock session data (would come from params in real app)
  const sessionData = {
    trainerName: params.trainerName || 'Your Trainer',
    sessionType: params.sessionType || 'In-Person Training',
    location: params.location || '123 Fitness Center, NYC',
    time: params.time || '2:00 PM - 3:00 PM',
    date: params.date || 'Today',
  };

  useEffect(() => {
    // Load saved emergency contacts
    loadSavedContacts();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadSavedContacts = async () => {
    // In a real app, load from AsyncStorage
    setContacts([
      { id: '1', name: 'Mom', phone: '+1 555-123-4567', initials: 'M' },
      { id: '2', name: 'John Smith', phone: '+1 555-987-6543', initials: 'JS' },
    ]);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleAddContact = () => {
    if (!newContactName || !newContactPhone) {
      toast.error( 'Please fill in all fields');
      return;
    }

    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: newContactName,
      phone: newContactPhone,
      initials: getInitials(newContactName),
    };

    setContacts(prev => [...prev, newContact]);
    setNewContactName('');
    setNewContactPhone('');
    setShowAddContact(false);
  };

  const handleShareStatus = async () => {
    if (selectedContacts.length === 0) {
      toast.warning('Please select at least one contact to share with');
      return;
    }

    const selectedNames = contacts
      .filter(c => selectedContacts.includes(c.id))
      .map(c => c.name)
      .join(', ');

    const message = `🏋️ RapidReps Safety Alert

I'm starting a training session:
👤 Trainer: ${sessionData.trainerName}
📍 Location: ${sessionData.location}
🕐 Time: ${sessionData.time}
📅 Date: ${sessionData.date}

I'll let you know when I'm done. Track my session in the RapidReps app.

- Sent via RapidReps Safety Feature`;

    try {
      await Share.share({
        message,
        title: 'Training Session Status',
      });

      toast.success(`Status shared with ${selectedNames}`);
      setTimeout(() => router.back(), 2000);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const importFromContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === 'granted') {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      if (data.length > 0) {
        // Show contact picker (simplified - in real app use a modal)
        toast.warning('Contact import feature - would open contact picker');
      }
    }
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={['rgba(10, 14, 26, 0.93)', 'rgba(17, 24, 39, 0.90)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Session Status</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Session Info Card */}
            <View style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Ionicons name="fitness" size={24} color={COLORS.orange} />
                <Text style={styles.sessionTitle}>Upcoming Training</Text>
              </View>
              
              <View style={styles.sessionDetail}>
                <Ionicons name="person" size={18} color={COLORS.gray} />
                <Text style={styles.sessionText}>{sessionData.trainerName}</Text>
              </View>
              <View style={styles.sessionDetail}>
                <Ionicons name="location" size={18} color={COLORS.gray} />
                <Text style={styles.sessionText}>{sessionData.location}</Text>
              </View>
              <View style={styles.sessionDetail}>
                <Ionicons name="time" size={18} color={COLORS.gray} />
                <Text style={styles.sessionText}>{sessionData.date}, {sessionData.time}</Text>
              </View>
            </View>

            {/* Safety Info */}
            <View style={styles.safetyBanner}>
              <Ionicons name="shield-checkmark" size={24} color={COLORS.teal} />
              <View style={styles.safetyTextContainer}>
                <Text style={styles.safetyTitle}>Train Safely</Text>
                <Text style={styles.safetyText}>
                  Share your training status with trusted contacts for added security
                </Text>
              </View>
            </View>

            {/* Contact Selection */}
            <Text style={styles.sectionTitle}>Select contacts to notify</Text>
            
            <View style={styles.contactsContainer}>
              {/* Add Contact Button */}
              <TouchableOpacity 
                style={styles.addContactButton}
                onPress={() => setShowAddContact(true)}
              >
                <View style={styles.addContactIcon}>
                  <Ionicons name="add" size={28} color={COLORS.orange} />
                </View>
                <Text style={styles.addContactText}>Add{'\n'}Contact</Text>
              </TouchableOpacity>

              {/* Existing Contacts */}
              {contacts.map(contact => (
                <TouchableOpacity
                  key={contact.id}
                  style={[
                    styles.contactItem,
                    selectedContacts.includes(contact.id) && styles.contactItemSelected
                  ]}
                  onPress={() => toggleContact(contact.id)}
                >
                  <View style={[
                    styles.contactAvatar,
                    selectedContacts.includes(contact.id) && styles.contactAvatarSelected
                  ]}>
                    {selectedContacts.includes(contact.id) ? (
                      <Ionicons name="checkmark" size={24} color={COLORS.white} />
                    ) : (
                      <Text style={styles.contactInitials}>{contact.initials}</Text>
                    )}
                  </View>
                  <Text style={styles.contactName} numberOfLines={2}>{contact.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Add Contact Form */}
            {showAddContact && (
              <View style={styles.addContactForm}>
                <Text style={styles.formTitle}>Add Emergency Contact</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contact Name"
                  placeholderTextColor={COLORS.gray}
                  value={newContactName}
                  onChangeText={setNewContactName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number"
                  placeholderTextColor={COLORS.gray}
                  value={newContactPhone}
                  onChangeText={setNewContactPhone}
                  keyboardType="phone-pad"
                />
                <View style={styles.formButtons}>
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => setShowAddContact(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.saveButton}
                    onPress={handleAddContact}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* What Gets Shared */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>What gets shared?</Text>
              <View style={styles.infoItem}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.infoText}>Trainer name and profile</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.infoText}>Session location</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.infoText}>Start and end time</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.infoText}>Session completion notification</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Share Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[
              styles.shareButton,
              selectedContacts.length === 0 && styles.shareButtonDisabled
            ]}
            onPress={handleShareStatus}
            disabled={selectedContacts.length === 0}
          >
            <LinearGradient
              colors={selectedContacts.length > 0 ? [COLORS.teal, '#2a3a6e'] : [COLORS.gray, COLORS.gray]}
              style={styles.shareButtonGradient}
            >
              <Ionicons name="share-social" size={24} color={COLORS.white} />
              <Text style={styles.shareButtonText}>
                Share with {selectedContacts.length} Contact{selectedContacts.length !== 1 ? 's' : ''}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sessionCard: {
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sessionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  sessionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141929',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 2,
    borderColor: '#1a2a5e',
  },
  safetyTextContainer: {
    flex: 1,
  },
  safetyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  safetyText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 20,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 16,
  },
  contactsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  addContactButton: {
    alignItems: 'center',
    width: 80,
  },
  addContactIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.white,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 8,
  },
  addContactText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
  contactItem: {
    alignItems: 'center',
    width: 80,
  },
  contactItemSelected: {
    opacity: 1,
  },
  contactAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactAvatarSelected: {
    backgroundColor: COLORS.success,
  },
  contactInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
  addContactForm: {
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  bottomContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  shareButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  shareButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
});
