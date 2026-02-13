import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/api';
import { colors, fontSize, spacing, layout } from '../../src/theme';

const STATUS_COLORS: Record<string, string> = {
  scheduled: colors.warning,
  checked_in: colors.success,
  completed: colors.primary,
  cancelled: colors.error,
};

export default function ExpoDayScreen() {
  const [expos, setExpos] = useState<any[]>([]);
  const [selectedExpo, setSelectedExpo] = useState('');
  const [expoDay, setExpoDay] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [meetingDetail, setMeetingDetail] = useState<any>(null);
  const [notesText, setNotesText] = useState('');
  const [showExpoModal, setShowExpoModal] = useState(false);

  useFocusEffect(useCallback(() => {
    api.getExpos().then(setExpos).catch(() => {});
  }, []));

  const loadExpoDay = async (expoId: string) => {
    setLoading(true);
    try {
      const days = await api.getExpoDays(expoId);
      if (days.length > 0) {
        setExpoDay(days[0]);
      } else {
        const newDay = await api.createExpoDay(expoId);
        setExpoDay(newDay);
      }
    } catch { }
    setLoading(false);
  };

  const selectExpo = (id: string) => {
    setSelectedExpo(id);
    setShowExpoModal(false);
    loadExpoDay(id);
  };

  const handleCheckin = async (meetingId: string) => {
    if (!expoDay) return;
    await api.checkinMeeting(expoDay.id, meetingId);
    loadExpoDay(selectedExpo);
  };

  const handleSaveNotes = async () => {
    if (!expoDay || !meetingDetail) return;
    await api.updateMeeting(expoDay.id, meetingDetail.id, { notes: notesText });
    setMeetingDetail(null);
    loadExpoDay(selectedExpo);
  };

  const handleUploadCard = async (meetingId: string) => {
    if (!expoDay) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.5 });
    if (!result.canceled && result.assets[0].base64) {
      try {
        await api.uploadVisitingCard(expoDay.id, meetingId, result.assets[0].base64);
        Alert.alert('Success', 'Visiting card uploaded');
        loadExpoDay(selectedExpo);
      } catch (e: any) { Alert.alert('Error', e.message); }
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!expoDay) return;
    Alert.alert('Delete Meeting', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await api.deleteMeeting(expoDay.id, meetingId);
        loadExpoDay(selectedExpo);
      }}
    ]);
  };

  const handleExport = async () => {
    if (!expoDay) return;
    try {
      const res = await api.exportExpoDay(expoDay.id);
      Alert.alert('Export Ready', `CSV generated for ${res.filename}\nMeetings: ${res.csv_data.split('\n').length - 1}`);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const meetings = expoDay?.meetings || [];
  const sorted = [...meetings].sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));

  const renderMeeting = ({ item, index }: { item: any; index: number }) => {
    const ex = item.exhibitor || {};
    const statusColor = STATUS_COLORS[item.status] || colors.fgMuted;
    const isCheckedIn = item.checked_in;

    return (
      <View style={s.timelineRow} testID={`meeting-${item.id}`}>
        {/* Timeline connector */}
        <View style={s.timelineLeft}>
          {index > 0 && <View style={s.lineTop} />}
          <View style={[s.dot, { backgroundColor: statusColor }]} />
          {index < sorted.length - 1 && <View style={s.lineBottom} />}
        </View>

        {/* Meeting card */}
        <View style={[s.meetingCard, isCheckedIn && s.meetingCheckedIn]}>
          <View style={s.meetingHeader}>
            <View style={s.timeBox}>
              <Feather name="clock" size={12} color={colors.fgMuted} />
              <Text style={s.timeText}>{item.time || 'TBD'}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[s.statusText, { color: statusColor }]}>{item.status}</Text>
            </View>
          </View>

          <Text style={s.meetingCompany}>{ex.company || 'Unknown'}</Text>
          <View style={s.meetingMeta}>
            <View style={s.metaItem}>
              <Feather name="map-pin" size={12} color={colors.fgMuted} />
              <Text style={s.metaText}>Booth {ex.booth || '—'}</Text>
            </View>
          </View>
          {item.agenda ? <Text style={s.agendaText}>{item.agenda}</Text> : null}
          {item.notes ? <View style={s.notesPreview}><Feather name="file-text" size={12} color={colors.fgMuted} /><Text style={s.notesPreviewText} numberOfLines={2}>{item.notes}</Text></View> : null}
          {item.voice_transcript ? <View style={s.notesPreview}><Feather name="mic" size={12} color={colors.success} /><Text style={s.notesPreviewText} numberOfLines={2}>Transcript: {item.voice_transcript}</Text></View> : null}
          {item.action_items ? <View style={s.notesPreview}><Feather name="check-square" size={12} color={colors.primary} /><Text style={s.notesPreviewText} numberOfLines={2}>Actions: {item.action_items}</Text></View> : null}

          {/* Action buttons */}
          <View style={s.meetingActions}>
            {!isCheckedIn ? (
              <TouchableOpacity testID={`checkin-${item.id}`} style={s.checkinBtn} onPress={() => handleCheckin(item.id)}>
                <Feather name="check-circle" size={14} color="#fff" />
                <Text style={s.checkinText}>Check In</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity testID={`upload-card-${item.id}`} style={s.miniBtn} onPress={() => handleUploadCard(item.id)}>
                  <Feather name="camera" size={14} color={colors.primary} />
                  <Text style={s.miniBtnText}>Card</Text>
                </TouchableOpacity>
                <TouchableOpacity testID={`notes-${item.id}`} style={s.miniBtn} onPress={() => { setMeetingDetail(item); setNotesText(item.notes || ''); }}>
                  <Feather name="edit-3" size={14} color={colors.primary} />
                  <Text style={s.miniBtnText}>Notes</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={s.miniBtn} onPress={() => handleDeleteMeeting(item.id)}>
              <Feather name="trash-2" size={14} color={colors.error} />
            </TouchableOpacity>
          </View>

          {item.visiting_card_base64 && (
            <View style={s.attachIndicator}>
              <Feather name="image" size={12} color={colors.success} />
              <Text style={s.attachText}>Card attached</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const expoName = expos.find(e => e.id === selectedExpo)?.name || 'Select Expo';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Expo Day</Text>
          <Text style={s.subtitle}>Your meeting timeline</Text>
        </View>
        {expoDay && meetings.length > 0 && (
          <TouchableOpacity testID="export-day-btn" style={s.exportBtn} onPress={handleExport}>
            <Feather name="download" size={16} color={colors.primary} />
            <Text style={s.exportText}>Export</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity testID="expo-day-selector" style={s.selector} onPress={() => setShowExpoModal(true)}>
        <Feather name="calendar" size={18} color={colors.primary} />
        <Text style={s.selectorText}>{expoName}</Text>
        <Feather name="chevron-down" size={18} color={colors.fgMuted} />
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : !selectedExpo ? (
        <View style={s.empty}>
          <Feather name="calendar" size={64} color={colors.bgTertiary} />
          <Text style={s.emptyTitle}>Select an expo</Text>
          <Text style={s.emptyDesc}>Choose an expo to view your meeting timeline</Text>
        </View>
      ) : sorted.length === 0 ? (
        <View style={s.empty}>
          <Feather name="clock" size={64} color={colors.bgTertiary} />
          <Text style={s.emptyTitle}>No meetings yet</Text>
          <Text style={s.emptyDesc}>Add meetings from exhibitor profiles</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => item.id}
          renderItem={renderMeeting}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Notes Modal */}
      <Modal visible={!!meetingDetail} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Meeting Notes</Text>
              <TouchableOpacity onPress={() => setMeetingDetail(null)}><Feather name="x" size={24} color={colors.fg} /></TouchableOpacity>
            </View>
            <TextInput testID="meeting-notes-input" style={s.notesInput} value={notesText} onChangeText={setNotesText} placeholder="Type your notes..." placeholderTextColor={colors.fgMuted} multiline textAlignVertical="top" />
            <TouchableOpacity testID="save-notes-btn" style={s.saveBtn} onPress={handleSaveNotes}>
              <Text style={s.saveBtnText}>Save Notes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Expo Selection Modal */}
      <Modal visible={showExpoModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Expo</Text>
              <TouchableOpacity onPress={() => setShowExpoModal(false)}><Feather name="x" size={24} color={colors.fg} /></TouchableOpacity>
            </View>
            {expos.map(expo => (
              <TouchableOpacity key={expo.id} style={[s.expoItem, selectedExpo === expo.id && s.expoItemActive]} onPress={() => selectExpo(expo.id)}>
                <Text style={s.expoItemName}>{expo.name}</Text>
                <Text style={s.expoItemMeta}>{expo.date} - {expo.location}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.fg },
  subtitle: { fontSize: fontSize.sm, color: colors.fgMuted, marginTop: 2 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: layout.buttonRadius, borderWidth: 1, borderColor: colors.border },
  exportText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  selector: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSecondary, marginHorizontal: spacing.lg, borderRadius: layout.cardRadius, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  selectorText: { flex: 1, color: colors.fg, fontSize: fontSize.base, fontWeight: '600', marginLeft: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  timelineRow: { flexDirection: 'row', marginBottom: 0 },
  timelineLeft: { width: 28, alignItems: 'center' },
  lineTop: { width: 2, flex: 1, backgroundColor: colors.bgTertiary },
  lineBottom: { width: 2, flex: 1, backgroundColor: colors.bgTertiary },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.bg },
  meetingCard: { flex: 1, backgroundColor: colors.bgSecondary, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginLeft: spacing.sm, marginBottom: spacing.md },
  meetingCheckedIn: { borderColor: colors.success + '44' },
  meetingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { color: colors.fgMuted, fontSize: fontSize.xs, fontWeight: '600' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  meetingCompany: { color: colors.fg, fontSize: fontSize.base, fontWeight: '700', marginBottom: 4 },
  meetingMeta: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.fgMuted, fontSize: fontSize.xs },
  agendaText: { color: colors.fgMuted, fontSize: fontSize.sm, marginBottom: spacing.sm, fontStyle: 'italic' },
  notesPreview: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: spacing.sm, backgroundColor: colors.bg, borderRadius: 4, padding: spacing.sm },
  notesPreviewText: { color: colors.fgMuted, fontSize: fontSize.xs, flex: 1 },
  meetingActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  checkinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: layout.buttonRadius },
  checkinText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '700' },
  miniBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: layout.buttonRadius, borderWidth: 1, borderColor: colors.border },
  miniBtnText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '600' },
  attachIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  attachText: { color: colors.success, fontSize: 10, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyTitle: { color: colors.fg, fontSize: fontSize.lg, fontWeight: '600', marginTop: spacing.lg },
  emptyDesc: { color: colors.fgMuted, fontSize: fontSize.sm, marginTop: spacing.sm, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bgSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  modalTitle: { color: colors.fg, fontSize: fontSize.xl, fontWeight: '700' },
  notesInput: { backgroundColor: colors.bg, borderRadius: layout.buttonRadius, padding: spacing.md, height: 150, color: colors.fg, fontSize: fontSize.base, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  saveBtn: { backgroundColor: colors.primary, borderRadius: layout.buttonRadius, height: 48, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: fontSize.base, fontWeight: '600' },
  expoItem: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  expoItemActive: { backgroundColor: colors.badgeBg, marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, borderRadius: layout.buttonRadius },
  expoItemName: { color: colors.fg, fontSize: fontSize.base, fontWeight: '600' },
  expoItemMeta: { color: colors.fgMuted, fontSize: fontSize.xs, marginTop: 2 },
});
