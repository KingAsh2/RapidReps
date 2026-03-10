import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

  const fetchApprovedTrainers = async () => {
    setLoadingApproved(true);
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/verifications/approved', { headers });
      setApprovedTrainers(res.data || []);
    } catch (err) {
      // If endpoint doesn't exist yet, use empty array
      setApprovedTrainers([]);
    } finally {
      setLoadingApproved(false);
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
      {/* Toggle between Pending and Approved */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <TouchableOpacity
          style={{
            flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
            backgroundColor: !showApproved ? C.teal : '#f0f0f0',
          }}
          onPress={() => setShowApproved(false)}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: !showApproved ? C.white : C.gray }}>
            Pending ({verifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
            backgroundColor: showApproved ? C.success : '#f0f0f0',
          }}
          onPress={() => { setShowApproved(true); fetchApprovedTrainers(); }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: showApproved ? C.white : C.gray }}>
            Approved Trainers
          </Text>
        </TouchableOpacity>
      </View>

      {showApproved ? (
        // Approved Trainers List
        <>
          <Text style={s.sectionTitle}>Approved Trainers</Text>
          {loadingApproved ? (
            <ActivityIndicator size="large" color={C.teal} style={{ marginVertical: 20 }} />
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
                  <Ionicons name="document-text-outline" size={16} color={C.teal} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.teal }}>View Documents</Text>
                </View>
              </TouchableOpacity>
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
                <Ionicons name="eye-outline" size={16} color={C.teal} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.teal }}>Tap to review & take action</Text>
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
                <ActivityIndicator size="large" color={C.teal} style={{ marginVertical: 40 }} />
              ) : verificationDetail ? (
                <>
                  <View style={s.modalSection}>
                    <Text style={s.modalSectionTitle}>Trainer Information</Text>
                    <Text style={s.modalField}>Name: {verificationDetail.user?.fullName}</Text>
                    <Text style={s.modalField}>Email: {verificationDetail.user?.email}</Text>
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

                  {verificationDetail.rejectionReason && (
                    <View style={[s.modalSection, { backgroundColor: '#FFF5F5', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: C.error }]}>
                      <Text style={[s.modalSectionTitle, { color: C.error }]}>Previous Rejection Reason</Text>
                      <Text style={[s.modalField, { color: '#555' }]}>{verificationDetail.rejectionReason}</Text>
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
                        <View key={step.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
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
                              <Text style={{ fontSize: 14, fontWeight: '700', color: C.navy }}>{step.label}</Text>
                              <Text style={{ fontSize: 13, color: stepApproved ? C.success : step.submitted ? C.warning : C.error, fontWeight: '600' }}>
                                {stepApproved ? 'Approved' : step.submitted ? 'Under Review' : 'Not submitted'}
                              </Text>
                            </View>
                          </View>
                          {step.submitted && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginLeft: 48 }}>
                              {step.url && (
                                <TouchableOpacity
                                  onPress={() => Linking.openURL(step.url)}
                                  style={{ backgroundColor: '#E8F0FE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                  data-testid={`view-doc-${step.id}`}
                                >
                                  <Ionicons name="eye" size={14} color={C.teal} />
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.teal }}>View</Text>
                                </TouchableOpacity>
                              )}
                              {!stepApproved && (
                                <>
                                  <TouchableOpacity
                                    onPress={async () => {
                                      try {
                                        const headers = await getAuthHeader();
                                        await api.post(`/admin/verifications/${verificationDetail.profile?.userId}/approve-step`, { stepId: step.id }, { headers });
                                        toast.success(`${step.label} has been approved`);
                                        const updated = await api.get(`/admin/verifications/${verificationDetail.profile?.userId}/detail`, { headers });
                                        setVerificationDetail(updated.data);
                                      } catch { toast.error('Failed to approve'); }
                                    }}
                                    style={{ backgroundColor: C.success, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
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
                    <View style={[s.modalSection, { backgroundColor: '#FFF5F5', borderRadius: 12, padding: 14 }]}>
                      <Text style={[s.modalSectionTitle, { color: C.error }]}>Rejection Reason</Text>
                      <Text style={{ fontSize: 13, color: C.gray, marginBottom: 8 }}>This reason will be sent to the trainer as a notification.</Text>
                      <TextInput
                        style={{
                          borderWidth: 1, borderColor: C.error, borderRadius: 10, padding: 14,
                          minHeight: 100, fontSize: 14, color: C.navy, textAlignVertical: 'top',
                          backgroundColor: '#fff',
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
    </View>
  );
};
