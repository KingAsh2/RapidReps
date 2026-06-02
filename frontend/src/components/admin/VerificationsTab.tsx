import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { C, s, api, getAuthHeader } from './AdminShared';
import { toast } from '../../utils/toast';

interface Props {
  verifications: any[];
  fetchVerifications: () => void;
}

export const VerificationsTab = ({ verifications, fetchVerifications }: Props) => {
  const [verificationDetail, setVerificationDetail] = useState<any>(null);
  const [verificationDetailVisible, setVerificationDetailVisible] = useState(false);
  const [verificationDetailLoading, setVerificationDetailLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTrainerId, setRejectTrainerId] = useState('');
  const [approvedTrainers, setApprovedTrainers] = useState<any[]>([]);
  const [showApproved, setShowApproved] = useState(false);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [unverifiedTrainers, setUnverifiedTrainers] = useState<any[]>([]);
  const [showUnverified, setShowUnverified] = useState(false);
  const [loadingUnverified, setLoadingUnverified] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<Video>(null);
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (videoTimerRef.current) {
        clearTimeout(videoTimerRef.current);
        videoTimerRef.current = null;
      }
    };
  }, []);

  const handlePlayVideo = (url: string) => {
    const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
    setVideoUrl(fullUrl);
    setShowVideoModal(true);
    // Auto-stop after 15 seconds
    videoTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      if (videoRef.current) {
        videoRef.current.stopAsync().catch(() => {});
      }
      toast.info('Video preview limited to 15 seconds');
    }, 15000);
  };

  const handleCloseVideo = () => {
    if (videoTimerRef.current) {
      clearTimeout(videoTimerRef.current);
    }
    if (videoRef.current) {
      videoRef.current.stopAsync();
    }
    setShowVideoModal(false);
    setVideoUrl(null);
  };

  const fetchApprovedTrainers = async () => {
    setLoadingApproved(true);
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/verifications/approved', { headers });
      setApprovedTrainers(res.data || []);
    } catch (err) {
      setApprovedTrainers([]);
    } finally {
      setLoadingApproved(false);
    }
  };

  const fetchUnverifiedTrainers = async () => {
    setLoadingUnverified(true);
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/verifications/unverified', { headers });
      setUnverifiedTrainers(res.data || []);
    } catch (err) {
      setUnverifiedTrainers([]);
    } finally {
      setLoadingUnverified(false);
    }
  };

  const handleOpenVerification = async (item: any) => {
    setVerificationDetailLoading(true);
    setVerificationDetailVisible(true);
    try {
      const headers = await getAuthHeader();
      const res = await api.get(`/admin/verifications/${item.profile?.userId}/detail`, { headers });
      setVerificationDetail(res.data);
    } catch {
      toast.error('Failed to load verification details');
      setVerificationDetailVisible(false);
    } finally {
      setVerificationDetailLoading(false);
    }
  };

  const handleApproveVerification = async (trainerId: string) => {
    try {
      const headers = await getAuthHeader();
      await api.post(`/admin/verifications/${trainerId}/approve`, {}, { headers });
      toast.success('Trainer approved! They will receive a notification.');
      setVerificationDetailVisible(false);
      setVerificationDetail(null);
      fetchVerifications();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed');
    }
  };

  const handleSubmitRejection = async () => {
    if (!rejectReason.trim()) {
      toast.warning('Please provide a reason for rejection');
      return;
    }
    try {
      const headers = await getAuthHeader();
      await api.post(`/admin/verifications/${rejectTrainerId}/reject`, { reason: rejectReason.trim() }, { headers });
      toast.success('Verification rejected. Trainer will be notified with your reason.');
      setShowRejectInput(false);
      setVerificationDetailVisible(false);
      setVerificationDetail(null);
      setRejectReason('');
      fetchVerifications();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed');
    }
  };

  return (
    <View>
      {/* Toggle between Pending, Approved, and Unverified */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <TouchableOpacity
          style={{
            flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
            backgroundColor: !showApproved && !showUnverified ? '#FF6A00' : '#f0f0f0',
          }}
          onPress={() => { setShowApproved(false); setShowUnverified(false); }}
          data-testid="tab-pending"
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: !showApproved && !showUnverified ? C.white : C.gray }}>
            Pending ({verifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
            backgroundColor: showApproved ? C.success : '#f0f0f0',
          }}
          onPress={() => { setShowApproved(true); setShowUnverified(false); fetchApprovedTrainers(); }}
          data-testid="tab-approved"
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: showApproved ? C.white : C.gray }}>
            Approved
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
            backgroundColor: showUnverified ? C.warning : '#f0f0f0',
          }}
          onPress={() => { setShowApproved(false); setShowUnverified(true); fetchUnverifiedTrainers(); }}
          data-testid="tab-unverified"
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: showUnverified ? C.white : C.gray }}>
            Unverified
          </Text>
        </TouchableOpacity>
      </View>

      {showApproved ? (
        // Approved Trainers List
        <>
          <Text style={s.sectionTitle}>Approved Trainers</Text>
          {loadingApproved ? (
            <ActivityIndicator size="large" color={'#FF6A00'} style={{ marginVertical: 20 }} />
          ) : approvedTrainers.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="people-circle" size={48} color={C.gray} />
              <Text style={s.emptyTitle}>No Approved Trainers</Text>
              <Text style={s.emptySub}>Trainers will appear here once approved.</Text>
            </View>
          ) : (
            approvedTrainers.map((trainer: any, idx: number) => (
              <TouchableOpacity
                key={idx}
                style={s.verifyCard}
                onPress={() => handleOpenVerification({ profile: { userId: trainer.userId }, user: trainer })}
              >
                <View style={s.verifyHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.verifyName}>{trainer.fullName || 'Trainer'}</Text>
                    <Text style={s.verifySub}>{trainer.email || ''}</Text>
                  </View>
                  <View style={[s.pendingBadge, { backgroundColor: '#E8FDE8' }]}>
                    <Text style={[s.pendingBadgeText, { color: C.success }]}>VERIFIED</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Ionicons name="document-text-outline" size={16} color={'#FF6A00'} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#FF6A00' }}>View Documents</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </>
      ) : showUnverified ? (
        // Unverified Trainers List
        <>
          <Text style={s.sectionTitle}>Unverified Trainers</Text>
          {loadingUnverified ? (
            <ActivityIndicator size="large" color={'#FF6A00'} style={{ marginVertical: 20 }} />
          ) : unverifiedTrainers.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="shield-outline" size={48} color={C.gray} />
              <Text style={s.emptyTitle}>No Unverified Trainers</Text>
              <Text style={s.emptySub}>All trainers have started or completed verification.</Text>
            </View>
          ) : (
            unverifiedTrainers.map((trainer: any, idx: number) => (
              <View key={idx} style={[s.verifyCard, { borderLeftWidth: 3, borderLeftColor: C.warning }]}>
                <View style={s.verifyHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.verifyName}>{trainer.fullName || 'Trainer'}</Text>
                    <Text style={s.verifySub}>{trainer.email || ''}</Text>
                  </View>
                  <View style={[s.pendingBadge, { backgroundColor: '#FFF5EB' }]}>
                    <Text style={[s.pendingBadgeText, { color: C.warning }]}>UNVERIFIED</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: C.gray, marginTop: 6 }}>
                  Joined: {trainer.createdAt ? new Date(trainer.createdAt).toLocaleDateString() : 'Unknown'}
                </Text>
              </View>
            ))
          )}
        </>
      ) : (
        // Pending Verifications List
        <>
          <Text style={s.sectionTitle}>Pending Verifications ({verifications.length})</Text>
      {verifications.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="checkmark-done-circle" size={48} color={C.success} />
          <Text style={s.emptyTitle}>All Clear!</Text>
          <Text style={s.emptySub}>No pending verifications.</Text>
        </View>
      ) : (
        verifications.map((item: any, idx: number) => {
          const isRejected = item.profile?.verificationStatus === 'rejected';
          return (
            <TouchableOpacity
              key={idx}
              style={s.verifyCard}
              data-testid={`verification-${idx}`}
              onPress={() => handleOpenVerification(item)}
              activeOpacity={0.7}
            >
              <View style={s.verifyHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.verifyName}>{item.user?.fullName || 'Unknown'}</Text>
                  <Text style={s.verifySub}>{item.user?.email || ''}</Text>
                </View>
                <View style={[s.pendingBadge, isRejected && { backgroundColor: '#FDE8E8' }]}>
                  <Text style={[s.pendingBadgeText, isRejected && { color: C.error }]}>
                    {isRejected ? 'REJECTED' : 'PENDING'}
                  </Text>
                </View>
              </View>
              <View style={s.verifyChecks}>
                {['governmentIdUploaded', 'backgroundCheckPassed', 'fitnessCertUploaded', 'cprAedCertUploaded', 'introVideoUploaded'].map((field) => (
                  <View key={field} style={s.checkRow}>
                    <Ionicons
                      name={item.profile?.[field] ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16} color={item.profile?.[field] ? C.success : C.gray}
                    />
                    <Text style={s.checkLabel}>{field.replace(/([A-Z])/g, ' $1').replace(/^./, (ch: string) => ch.toUpperCase())}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <Ionicons name="eye-outline" size={16} color={'#FF6A00'} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#FF6A00' }}>Tap to review & take action</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
        </>
      )}

      {/* Verification Detail Modal */}
      <Modal visible={verificationDetailVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.modalTop}>
                <Text style={s.modalTitle}>Verification Review</Text>
                <TouchableOpacity onPress={() => { setVerificationDetailVisible(false); setShowRejectInput(false); setVerificationDetail(null); }} data-testid="close-verify-modal">
                  <Ionicons name="close-circle" size={28} color={C.gray} />
                </TouchableOpacity>
              </View>

              {verificationDetailLoading ? (
                <ActivityIndicator size="large" color={'#FF6A00'} style={{ marginVertical: 40 }} />
              ) : verificationDetail ? (
                <>
                  <View style={s.modalSection}>
                    <Text style={s.modalSectionTitle}>Trainer Information</Text>
                    <Text style={s.modalField}>Name: {verificationDetail.user?.fullName}</Text>
                    <Text style={s.modalField}>Email: {verificationDetail.user?.email}</Text>
                    <Text style={s.modalField}>Phone: {verificationDetail.user?.phone || 'Not provided'}</Text>
                    {verificationDetail.submittedAt && (
                      <Text style={s.modalField}>Submitted: {new Date(verificationDetail.submittedAt).toLocaleDateString()}</Text>
                    )}
                    <View style={[s.pendingBadge, { alignSelf: 'flex-start', marginTop: 8,
                      backgroundColor: verificationDetail.verificationStatus === 'rejected' ? '#FDE8E8'
                        : verificationDetail.verificationStatus === 'verified' ? '#E8FDE8' : '#FFF5EB' }]}>
                      <Text style={[s.pendingBadgeText, {
                        color: verificationDetail.verificationStatus === 'rejected' ? C.error
                          : verificationDetail.verificationStatus === 'verified' ? C.success : C.warning }]}>
                        {verificationDetail.verificationStatus?.toUpperCase() || 'PENDING'}
                      </Text>
                    </View>
                  </View>

                  {/* Profile Details Section */}
                  {verificationDetail.profile && (
                    <View style={[s.modalSection, { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }]}>
                      <Text style={s.modalSectionTitle}>Profile Details</Text>
                      {verificationDetail.profile.bio && (
                        <View style={{ marginBottom: 10 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: C.gray, marginBottom: 4 }}>Bio</Text>
                          <Text style={{ fontSize: 14, color: '#FFFFFF', lineHeight: 20 }}>{verificationDetail.profile.bio}</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        {verificationDetail.profile.experienceYears > 0 && (
                          <View style={{ minWidth: '45%' }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: C.gray }}>Experience</Text>
                            <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }}>{verificationDetail.profile.experienceYears} years</Text>
                          </View>
                        )}
                        {verificationDetail.profile.trainingStyles?.length > 0 && (
                          <View style={{ minWidth: '45%' }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: C.gray }}>Training Styles</Text>
                            <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }}>{verificationDetail.profile.trainingStyles.join(', ')}</Text>
                          </View>
                        )}
                        {verificationDetail.profile.certifications?.length > 0 && (
                          <View style={{ width: '100%', marginTop: 4 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: C.gray }}>Listed Certifications</Text>
                            <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }}>{verificationDetail.profile.certifications.join(', ')}</Text>
                          </View>
                        )}
                        {verificationDetail.profile.locationAddress && (
                          <View style={{ width: '100%', marginTop: 4 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: C.gray }}>Location</Text>
                            <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }}>{verificationDetail.profile.locationAddress}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Background Check Info - from PII submission */}
                  {verificationDetail.backgroundInfo && (
                    <View style={[s.modalSection, { backgroundColor: 'rgba(247,147,30,0.08)', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: '#F7931E' }]}>
                      <Text style={[s.modalSectionTitle, { color: '#FF9F1C' }]}>Background Check Info</Text>
                      <View style={{ gap: 8 }}>
                        {verificationDetail.backgroundInfo.fullName && (
                          <View>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: C.gray }}>Full Legal Name</Text>
                            <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }}>{verificationDetail.backgroundInfo.fullName}</Text>
                          </View>
                        )}
                        {verificationDetail.backgroundInfo.dob && (
                          <View>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: C.gray }}>Date of Birth</Text>
                            <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }}>{verificationDetail.backgroundInfo.dob}</Text>
                          </View>
                        )}
                        {verificationDetail.backgroundInfo.address && (
                          <View>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: C.gray }}>Address</Text>
                            <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }}>{verificationDetail.backgroundInfo.address}</Text>
                          </View>
                        )}
                        {verificationDetail.backgroundInfo.submittedAt && (
                          <View>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: C.gray }}>Submitted</Text>
                            <Text style={{ fontSize: 14, color: '#FFFFFF' }}>{new Date(verificationDetail.backgroundInfo.submittedAt).toLocaleDateString()}</Text>
                          </View>
                        )}
                      </View>
                      {/* Background Check Status Controls */}
                      <View style={{ marginTop: 12 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: C.gray, marginBottom: 8 }}>SET BACKGROUND CHECK STATUS</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {(['passed', 'pending', 'failed'] as const).map((status) => {
                            const bgCheckStatus = verificationDetail.backgroundInfo?.status || 'pending_admin_review';
                            const isActive = (status === 'passed' && bgCheckStatus === 'passed') ||
                                             (status === 'pending' && (bgCheckStatus === 'pending_admin_review' || bgCheckStatus === 'pending')) ||
                                             (status === 'failed' && bgCheckStatus === 'failed');
                            const statusColors = { passed: C.success, pending: C.warning, failed: C.error };
                            const statusLabels = { passed: 'Passed', pending: 'Pending', failed: 'Failed' };
                            return (
                              <TouchableOpacity
                                key={status}
                                onPress={async () => {
                                  try {
                                    const headers = await getAuthHeader();
                                    await api.post(`/admin/verifications/${verificationDetail.profile?.userId}/background-check-status`, { status }, { headers });
                                    toast.success(`Background check marked as ${statusLabels[status]}`);
                                    const updated = await api.get(`/admin/verifications/${verificationDetail.profile?.userId}/detail`, { headers });
                                    setVerificationDetail(updated.data);
                                    fetchVerifications();
                                  } catch { toast.error('Failed to update status'); }
                                }}
                                style={{
                                  flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                                  backgroundColor: isActive ? statusColors[status] : 'rgba(255,255,255,0.06)',
                                  borderWidth: 1, borderColor: isActive ? statusColors[status] : 'rgba(255,255,255,0.1)',
                                }}
                                data-testid={`bg-check-${status}-btn`}
                              >
                                <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? C.white : statusColors[status] }}>
                                  {statusLabels[status]}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  )}

                  {verificationDetail.rejectionReason && (
                    <View style={[s.modalSection, { backgroundColor: 'rgba(255,71,87,0.08)', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: C.error }]}>
                      <Text style={[s.modalSectionTitle, { color: C.error }]}>Previous Rejection Reason</Text>
                      <Text style={[s.modalField, { color: 'rgba(255,255,255,0.85)' }]}>{verificationDetail.rejectionReason}</Text>
                      {verificationDetail.rejectedAt && (
                        <Text style={[s.modalField, { fontSize: 13, color: C.gray }]}>Rejected on {new Date(verificationDetail.rejectedAt).toLocaleDateString()}</Text>
                      )}
                    </View>
                  )}

                  <View style={s.modalSection}>
                    <Text style={s.modalSectionTitle}>Verification Documents</Text>
                    {verificationDetail.steps?.map((step: any) => {
                      const stepApproved = verificationDetail.profile?.[`${step.id}Approved`];
                      return (
                        <View key={step.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{
                              width: 36, height: 36, borderRadius: 18,
                              backgroundColor: stepApproved ? '#E8FDE8' : step.submitted ? '#FFF5EB' : '#FDE8E8',
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Ionicons
                                name={stepApproved ? 'checkmark-circle' : step.submitted ? 'time' : 'close-circle'}
                                size={20}
                                color={stepApproved ? C.success : step.submitted ? C.warning : C.error}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>{step.label}</Text>
                              <Text style={{ fontSize: 13, color: stepApproved ? C.success : step.submitted ? C.warning : C.error, fontWeight: '600' }}>
                                {stepApproved ? 'Approved' : step.submitted ? 'Under Review' : 'Not submitted'}
                              </Text>
                              {stepApproved && !step.url && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: 'rgba(255,71,87,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' }}>
                                  <Ionicons name="warning" size={12} color={C.error} />
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.error }}>Invalid state — approved but no file. Ask trainer to re-upload.</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          {step.submitted && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginLeft: 48, flexWrap: 'wrap' }}>
                              {step.url ? (
                                step.url.startsWith('file://') || step.url.startsWith('content://') || step.url.startsWith('ph://') ? (
                                  // Local-device URI never made it to server storage — common cause of "video won't play"
                                  <View style={{ backgroundColor: '#FFF5EB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Ionicons name="alert-circle-outline" size={14} color={C.warning} />
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.warning }}>Local file — ask trainer to re-upload</Text>
                                  </View>
                                ) : step.id === 'video' ? (
                                  <TouchableOpacity
                                    onPress={() => handlePlayVideo(step.url)}
                                    style={{ backgroundColor: '#FFF0E8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    data-testid={`play-video-${step.id}`}
                                  >
                                    <Ionicons name="play-circle" size={14} color="#FF6A00" />
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#FF6A00' }}>Play (15s preview)</Text>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity
                                    onPress={() => {
                                      const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
                                      const fullUrl = step.url.startsWith('http') ? step.url : `${API_URL}${step.url}`;
                                      Linking.openURL(fullUrl);
                                    }}
                                    style={{ backgroundColor: '#E8F0FE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    data-testid={`view-doc-${step.id}`}
                                  >
                                    <Ionicons name="eye" size={14} color={'#FF6A00'} />
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#FF6A00' }}>View</Text>
                                  </TouchableOpacity>
                                )
                              ) : (
                                <View style={{ backgroundColor: '#F0F0F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Ionicons name="cloud-offline-outline" size={14} color={C.gray} />
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.gray }}>No file</Text>
                                </View>
                              )}
                              {!stepApproved && (
                                <>
                                  <TouchableOpacity
                                    onPress={async () => {
                                      if (!step.url) {
                                        toast.error('Cannot approve — trainer has not uploaded this document yet.');
                                        return;
                                      }
                                      try {
                                        const headers = await getAuthHeader();
                                        await api.post(`/admin/verifications/${verificationDetail.profile?.userId}/approve-step`, { stepId: step.id }, { headers });
                                        toast.success(`${step.label} has been approved`);
                                        const updated = await api.get(`/admin/verifications/${verificationDetail.profile?.userId}/detail`, { headers });
                                        setVerificationDetail(updated.data);
                                      } catch { toast.error('Failed to approve'); }
                                    }}
                                    disabled={!step.url}
                                    style={{ backgroundColor: step.url ? C.success : '#9ca3af', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4, opacity: step.url ? 1 : 0.6 }}
                                    data-testid={`approve-step-${step.id}`}
                                  >
                                    <Ionicons name="checkmark" size={14} color={C.white} />
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.white }}>Approve</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={async () => {
                                      try {
                                        const headers = await getAuthHeader();
                                        await api.post(`/admin/verifications/${verificationDetail.profile?.userId}/reject-step`, { stepId: step.id, reason: 'Document needs revision' }, { headers });
                                        toast.warning(`${step.label} has been rejected`);
                                        const updated = await api.get(`/admin/verifications/${verificationDetail.profile?.userId}/detail`, { headers });
                                        setVerificationDetail(updated.data);
                                      } catch { toast.error('Failed to reject'); }
                                    }}
                                    style={{ backgroundColor: '#FDE8E8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    data-testid={`reject-step-${step.id}`}
                                  >
                                    <Ionicons name="close" size={14} color={C.error} />
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.error }}>Reject</Text>
                                  </TouchableOpacity>
                                </>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {showRejectInput ? (
                    <View style={[s.modalSection, { backgroundColor: 'rgba(255,71,87,0.08)', borderRadius: 12, padding: 14 }]}>
                      <Text style={[s.modalSectionTitle, { color: C.error }]}>Rejection Reason</Text>
                      <Text style={{ fontSize: 13, color: C.gray, marginBottom: 8 }}>This reason will be sent to the trainer as a notification.</Text>
                      <TextInput
                        style={{
                          borderWidth: 1, borderColor: C.error, borderRadius: 10, padding: 14,
                          minHeight: 100, fontSize: 14, color: '#FFFFFF', textAlignVertical: 'top',
                          backgroundColor: '#141929',
                        }}
                        value={rejectReason}
                        onChangeText={setRejectReason}
                        placeholder="Explain what needs to be fixed or resubmitted..."
                        placeholderTextColor={C.gray}
                        multiline
                        data-testid="reject-reason-input"
                      />
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                        <TouchableOpacity
                          style={[s.actionBtn, { flex: 1, backgroundColor: C.gray }]}
                          onPress={() => setShowRejectInput(false)}
                        >
                          <Text style={s.actionBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.actionBtn, { flex: 1, backgroundColor: C.error }]}
                          onPress={handleSubmitRejection}
                          data-testid="submit-rejection-btn"
                        >
                          <Ionicons name="close-circle" size={18} color={C.white} />
                          <Text style={s.actionBtnText}>Submit Rejection</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={s.verifyActions}>
                      <TouchableOpacity
                        style={[s.actionBtn, { flex: 1, backgroundColor: C.success }]}
                        onPress={() => handleApproveVerification(verificationDetail.profile?.userId)}
                        data-testid="approve-verification-btn"
                      >
                        <Ionicons name="checkmark-circle" size={20} color={C.white} />
                        <Text style={s.actionBtnText}>Approve Trainer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.actionBtn, { flex: 1, backgroundColor: C.error }]}
                        onPress={() => { setRejectTrainerId(verificationDetail.profile?.userId); setRejectReason(''); setShowRejectInput(true); }}
                        data-testid="reject-verification-btn"
                      >
                        <Ionicons name="close-circle" size={20} color={C.white} />
                        <Text style={s.actionBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Video Preview Modal */}
      <Modal visible={showVideoModal} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={{ backgroundColor: '#000', borderRadius: 16, padding: 4, width: '90%', maxWidth: 400 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Intro Video (15s preview)</Text>
              <TouchableOpacity onPress={handleCloseVideo} data-testid="close-video-modal" accessibilityLabel="Close video preview" accessibilityRole="button">
                <Ionicons name="close-circle" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            {videoUrl && (
              <View style={{ width: '100%', height: 300, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1a1a1a' }}>
                <Video
                  ref={videoRef}
                  source={{ uri: videoUrl }}
                  style={{ width: '100%', height: '100%' }}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay
                  isLooping={false}
                  onError={(error) => {
                    console.error('Video playback error:', error);
                    toast.error('Video playback failed. The file may be corrupted or use an unsupported format.');
                  }}
                  onLoad={() => {
                    console.log('Video loaded successfully');
                  }}
                  onPlaybackStatusUpdate={(status) => {
                    if (status.isLoaded && status.positionMillis >= 15000) {
                      videoRef.current?.stopAsync();
                      toast.info('Video preview limited to 15 seconds');
                    }
                  }}
                />
              </View>
            )}
            <Text style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: 8 }}>
              Preview auto-stops after 15 seconds
            </Text>
            <Text style={{ color: '#666', fontSize: 10, textAlign: 'center', paddingBottom: 8 }}>
              If video doesn't display, the file may need re-encoding (MP4/H.264 recommended)
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};
