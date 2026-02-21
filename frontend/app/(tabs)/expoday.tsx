import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api';

const C = { bg: '#0f172a', card: '#1e293b', card2: '#334155', border: 'rgba(255,255,255,0.08)', blue: '#3b82f6', blueDim: 'rgba(59,130,246,0.15)',
  fg: '#f8fafc', muted: '#94a3b8', dim: '#64748b', success: '#10b981', warn: '#f59e0b', err: '#ef4444', purple: '#a78bfa' };

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  planned: { label: 'Planned', color: C.blue, icon: 'clock' },
  visited: { label: 'Visited', color: C.success, icon: 'check-circle' },
  followed_up: { label: 'Followed Up', color: C.purple, icon: 'mail' },
};

const MT_LABELS: Record<string,string> = { booth_visit: 'Booth Visit', scheduled: 'Scheduled', drop_by: 'Drop By' };

export default function ExpoDayScreen() {
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expos, setExpos] = useState<any[]>([]);
  const [selExpo, setSelExpo] = useState('');
  const [notesModal, setNotesModal] = useState<any>(null);
  const [notesText, setNotesText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string,string> = {};
      if (selExpo) params.expo_id = selExpo;
      const [d, e] = await Promise.all([api.getExpoDays(params), api.getExpos()]);
      setDays(d);
      setExpos(e);
    } catch { }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, [selExpo]));

  const handleCheckin = async (item: any) => {
    await api.updateExpoDay(item.id, { status: 'visited' });
    load();
  };

  const handleFollowUp = async (item: any) => {
    setNotesModal(item);
    setNotesText(item.notes || '');
  };

  const saveFollowUp = async () => {
    if (!notesModal) return;
    await api.updateExpoDay(notesModal.id, { status: 'followed_up', notes: notesText });
    setNotesModal(null);
    load();
  };

  const handleDelete = (eid: string) => {
    Alert.alert('Remove', 'Remove from Expo Day?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await api.deleteExpoDay(eid); load(); } }
    ]);
  };

  const handleExport = async () => {
    try {
      const res = await api.exportCSV('expo-days', selExpo);
      Alert.alert('Export Ready', `${res.filename} generated`);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const renderDay = ({ item, index }: { item: any; index: number }) => {
    const co = item.company || {};
    const st = STATUS_MAP[item.status] || STATUS_MAP.planned;
    const isVisited = item.status === 'visited' || item.status === 'followed_up';
    return (
      <View style={s.timelineRow} testID={`expoday-${item.id}`}>
        <View style={s.timeCol}>
          <Text style={s.timeText}>{item.time_slot}</Text>
          <View style={[s.dot, { backgroundColor: st.color }]} />
          {index < days.length - 1 && <View style={s.line} />}
        </View>
        <View style={[s.meetingCard, isVisited && { borderColor: st.color + '33' }]}>
          <View style={s.meetHead}>
            <View style={s.meetInfo}>
              <Text style={s.coName}>{co.name}</Text>
              <View style={s.meetMeta}>
                <Feather name="map-pin" size={11} color={C.dim} />
                <Text style={s.boothText}>{item.booth || co.booth || '—'}</Text>
                <View style={s.mtBadge}><Text style={s.mtText}>{MT_LABELS[item.meeting_type] || item.meeting_type}</Text></View>
              </View>
            </View>
            <View style={[s.statusBadge, { backgroundColor: st.color + '22' }]}>
              <Feather name={st.icon as any} size={12} color={st.color} />
              <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>
          {item.notes ? <View style={s.notesBox}><Feather name="file-text" size={12} color={C.dim} /><Text style={s.notesText} numberOfLines={2}>{item.notes}</Text></View> : null}
          <View style={s.meetActions}>
            {item.status === 'planned' && (
              <TouchableOpacity testID={`checkin-${item.id}`} style={s.checkinBtn} onPress={() => handleCheckin(item)}>
                <Feather name="check" size={14} color="#fff" /><Text style={s.checkinText}>Check In</Text>
              </TouchableOpacity>
            )}
            {item.status === 'visited' && (
              <TouchableOpacity style={s.followBtn} onPress={() => handleFollowUp(item)}>
                <Feather name="mail" size={14} color={C.purple} /><Text style={[s.followText]}>Follow-up Notes</Text>
              </TouchableOpacity>
            )}
            {item.status === 'followed_up' && (
              <View style={s.completeBadge}><Feather name="check-circle" size={14} color={C.success} /><Text style={s.completeText}>Completed</Text></View>
            )}
            <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(item.id)}>
              <Feather name="trash-2" size={14} color={C.err} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Expo Day</Text>
          <Text style={s.subtitle}>Your meeting agenda</Text>
        </View>
        {days.length > 0 && (
          <TouchableOpacity testID="export-day-btn" style={s.exportBtn} onPress={handleExport}>
            <Feather name="download" size={14} color={C.blue} /><Text style={s.exportText}>Export</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.expoBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
        <TouchableOpacity style={[s.fChip, !selExpo && s.fChipOn]} onPress={() => setSelExpo('')}>
          <Text style={[s.fText, !selExpo && s.fTextOn]}>All Expos</Text></TouchableOpacity>
        {expos.map(e => (
          <TouchableOpacity key={e.id} style={[s.fChip, selExpo === e.id && s.fChipOn]}
            onPress={() => setSelExpo(selExpo === e.id ? '' : e.id)}>
            <Text style={[s.fText, selExpo === e.id && s.fTextOn]}>{e.name?.split(' ').slice(0,2).join(' ')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats */}
      {days.length > 0 && (
        <View style={s.stats}>
          <View style={s.statItem}><Text style={s.statNum}>{days.length}</Text><Text style={s.statLabel}>Total</Text></View>
          <View style={s.statItem}><Text style={[s.statNum, { color: C.blue }]}>{days.filter(d => d.status === 'planned').length}</Text><Text style={s.statLabel}>Planned</Text></View>
          <View style={s.statItem}><Text style={[s.statNum, { color: C.success }]}>{days.filter(d => d.status === 'visited').length}</Text><Text style={s.statLabel}>Visited</Text></View>
          <View style={s.statItem}><Text style={[s.statNum, { color: C.purple }]}>{days.filter(d => d.status === 'followed_up').length}</Text><Text style={s.statLabel}>Followed Up</Text></View>
        </View>
      )}

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={C.blue} size="large" /> : (
        <FlatList data={days} keyExtractor={i => i.id} renderItem={renderDay}
          contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
          ListEmptyComponent={<View style={s.empty}><Feather name="calendar" size={48} color={C.card2} /><Text style={s.emptyTitle}>No meetings scheduled</Text><Text style={s.emptyDesc}>Schedule meetings from Networks tab</Text></View>} />
      )}

      {/* Follow-up Notes Modal */}
      <Modal visible={!!notesModal} transparent animationType="slide">
        <View style={s.modalBg}><View style={s.modalBox}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Follow-up Notes</Text><TouchableOpacity onPress={() => setNotesModal(null)}><Feather name="x" size={22} color={C.fg} /></TouchableOpacity></View>
          <TextInput testID="followup-notes-input" style={s.notesInput} value={notesText} onChangeText={setNotesText} placeholder="Add follow-up notes, action items..." placeholderTextColor={C.dim} multiline textAlignVertical="top" />
          <TouchableOpacity testID="save-followup-btn" style={s.saveBtn} onPress={saveFollowUp}><Text style={s.saveBtnText}>Save & Mark Followed Up</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: '700', color: C.fg, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 2 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  exportText: { color: C.blue, fontSize: 13, fontWeight: '600' },
  expoBar: { maxHeight: 40, marginBottom: 8 },
  fChip: { backgroundColor: C.card, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  fChipOn: { backgroundColor: C.blueDim, borderColor: C.blue + '44' },
  fText: { color: C.dim, fontSize: 12, fontWeight: '500' },
  fTextOn: { color: C.blue },
  stats: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { color: C.fg, fontSize: 20, fontWeight: '700' },
  statLabel: { color: C.dim, fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  timelineRow: { flexDirection: 'row', marginBottom: 0 },
  timeCol: { width: 70, alignItems: 'center', paddingTop: 14 },
  timeText: { color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 2, flex: 1, backgroundColor: C.card2, marginTop: 4 },
  meetingCard: { flex: 1, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 8, marginLeft: 8 },
  meetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  meetInfo: { flex: 1 },
  coName: { color: C.fg, fontSize: 15, fontWeight: '700' },
  meetMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  boothText: { color: C.dim, fontSize: 12 },
  mtBadge: { backgroundColor: C.card2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  mtText: { color: C.dim, fontSize: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  notesBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, backgroundColor: C.bg, borderRadius: 4, padding: 8 },
  notesText: { color: C.dim, fontSize: 12, flex: 1 },
  meetActions: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  checkinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  checkinText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.purple + '22', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  followText: { color: C.purple, fontSize: 13, fontWeight: '600' },
  completeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  completeText: { color: C.success, fontSize: 12, fontWeight: '500' },
  delBtn: { marginLeft: 'auto', padding: 4 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { color: C.fg, fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptyDesc: { color: C.dim, fontSize: 13, marginTop: 4 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: C.fg, fontSize: 18, fontWeight: '700' },
  notesInput: { backgroundColor: C.bg, borderRadius: 8, padding: 12, height: 150, color: C.fg, borderWidth: 1, borderColor: C.border, fontSize: 14 },
  saveBtn: { backgroundColor: C.blue, borderRadius: 8, height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
