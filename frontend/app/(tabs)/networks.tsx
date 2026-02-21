import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api';

const C = { bg: '#0f172a', card: '#1e293b', card2: '#334155', border: 'rgba(255,255,255,0.08)', blue: '#3b82f6', blueDim: 'rgba(59,130,246,0.15)',
  fg: '#f8fafc', muted: '#94a3b8', dim: '#64748b', success: '#10b981', warn: '#f59e0b', err: '#ef4444', purple: '#a78bfa' };

const STATUS_OPTS = [
  { key: 'request_sent', label: 'Request Sent', color: C.blue, icon: 'send' as const },
  { key: 'meeting_scheduled', label: 'Scheduled', color: C.warn, icon: 'calendar' as const },
  { key: 'expo_day', label: 'Expo Day', color: C.purple, icon: 'map-pin' as const },
  { key: 'completed', label: 'Completed', color: C.success, icon: 'check-circle' as const },
];

const MEETING_TYPES = ['booth_visit', 'scheduled', 'drop_by'];
const MT_LABELS: Record<string,string> = { booth_visit: 'Booth Visit', scheduled: 'Scheduled Meeting', drop_by: 'Drop By Booth' };

export default function NetworksScreen() {
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expos, setExpos] = useState<any[]>([]);
  const [selExpo, setSelExpo] = useState('');
  const [selStatus, setSelStatus] = useState('');
  const [editModal, setEditModal] = useState<any>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editMT, setEditMT] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [scheduleModal, setScheduleModal] = useState<any>(null);
  const [schedTime, setSchedTime] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string,string> = {};
      if (selExpo) params.expo_id = selExpo;
      if (selStatus) params.status = selStatus;
      const [nets, exs] = await Promise.all([api.getNetworks(params), api.getExpos()]);
      setNetworks(nets);
      setExpos(exs);
    } catch { }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, [selExpo, selStatus]));

  const handleSave = async () => {
    if (!editModal) return;
    const updates: Record<string,string> = {};
    if (editStatus) updates.status = editStatus;
    if (editMT) updates.meeting_type = editMT;
    if (editNotes) updates.notes = editNotes;
    await api.updateNetwork(editModal.id, updates);
    setEditModal(null);
    load();
  };

  const handleSchedule = async () => {
    if (!scheduleModal || !schedTime) return;
    const co = scheduleModal.company || {};
    await api.createExpoDay({
      expo_id: scheduleModal.expo_id, company_id: scheduleModal.company_id,
      time_slot: schedTime, meeting_type: scheduleModal.meeting_type || 'booth_visit',
      booth: co.booth || ''
    });
    await api.updateNetwork(scheduleModal.id, { status: 'expo_day', scheduled_time: schedTime });
    Alert.alert('Scheduled', `Added to Expo Day at ${schedTime}`);
    setScheduleModal(null);
    setSchedTime('');
    load();
  };

  const handleDelete = (nid: string) => {
    Alert.alert('Remove', 'Remove network entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await api.deleteNetwork(nid); load(); } }
    ]);
  };

  const handleExport = async () => {
    try {
      const res = await api.exportCSV('networks', selExpo);
      Alert.alert('Export Ready', `${res.filename} generated`);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  // Group by expo
  const grouped: Record<string, any[]> = {};
  networks.forEach(n => {
    const key = n.expo?.name || 'Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(n);
  });

  const renderNetwork = (item: any) => {
    const co = item.company || {};
    const st = STATUS_OPTS.find(s => s.key === item.status) || STATUS_OPTS[0];
    return (
      <View key={item.id} style={s.netCard} testID={`net-${item.id}`}>
        <View style={s.netHeader}>
          <View style={s.netInfo}>
            <Text style={s.coName}>{co.name}</Text>
            <Text style={s.contact}>{item.contact_name}{item.contact_role ? ` · ${item.contact_role}` : ''}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: st.color + '22' }]}>
            <Feather name={st.icon} size={12} color={st.color} />
            <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <View style={s.netMeta}>
          <View style={s.mtBadge}><Text style={s.mtText}>{MT_LABELS[item.meeting_type] || item.meeting_type}</Text></View>
          {item.scheduled_time ? <Text style={s.timeText}>{item.scheduled_time}</Text> : null}
        </View>
        {item.notes ? <Text style={s.notesText} numberOfLines={2}>{item.notes}</Text> : null}
        <View style={s.netActions}>
          <TouchableOpacity style={s.actionBtn} onPress={() => {
            setEditModal(item); setEditStatus(item.status); setEditMT(item.meeting_type); setEditNotes(item.notes || '');
          }}><Feather name="edit-2" size={13} color={C.blue} /><Text style={s.actionText}>Edit</Text></TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => { setScheduleModal(item); setSchedTime(item.scheduled_time || ''); }}>
            <Feather name="calendar" size={13} color={C.warn} /><Text style={[s.actionText, { color: C.warn }]}>Schedule</Text></TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => handleDelete(item.id)}>
            <Feather name="trash-2" size={13} color={C.err} /></TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Networks</Text>
        <TouchableOpacity testID="export-net-btn" style={s.exportBtn} onPress={handleExport}>
          <Feather name="download" size={14} color={C.blue} /><Text style={s.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
        <TouchableOpacity style={[s.fChip, !selExpo && s.fChipOn]} onPress={() => setSelExpo('')}>
          <Text style={[s.fText, !selExpo && s.fTextOn]}>All Expos</Text></TouchableOpacity>
        {expos.map(e => (
          <TouchableOpacity key={e.id} style={[s.fChip, selExpo === e.id && s.fChipOn]} onPress={() => setSelExpo(selExpo === e.id ? '' : e.id)}>
            <Text style={[s.fText, selExpo === e.id && s.fTextOn]}>{e.name?.split(' ')[0]}</Text></TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
        <TouchableOpacity style={[s.fChip, !selStatus && s.fChipOn]} onPress={() => setSelStatus('')}>
          <Text style={[s.fText, !selStatus && s.fTextOn]}>All Status</Text></TouchableOpacity>
        {STATUS_OPTS.map(st => (
          <TouchableOpacity key={st.key} style={[s.fChip, selStatus === st.key && s.fChipOn]} onPress={() => setSelStatus(selStatus === st.key ? '' : st.key)}>
            <View style={[s.fDot, { backgroundColor: st.color }]} /><Text style={[s.fText, selStatus === st.key && s.fTextOn]}>{st.label}</Text></TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={C.blue} size="large" /> : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {Object.keys(grouped).length === 0 && (
            <View style={s.empty}><Feather name="users" size={48} color={C.card2} /><Text style={s.emptyTitle}>No network entries</Text><Text style={s.emptyDesc}>Add contacts from your shortlists</Text></View>
          )}
          {Object.entries(grouped).map(([expoName, items]) => (
            <View key={expoName}>
              <View style={s.groupHeader}><Text style={s.groupTitle}>{expoName}</Text><Text style={s.groupCount}>{items.length}</Text></View>
              {items.map(renderNetwork)}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Edit Modal */}
      <Modal visible={!!editModal} transparent animationType="slide">
        <View style={s.modalBg}><View style={s.modalBox}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Edit Network</Text><TouchableOpacity onPress={() => setEditModal(null)}><Feather name="x" size={22} color={C.fg} /></TouchableOpacity></View>
          <Text style={s.fieldLabel}>Status</Text>
          <View style={s.statusRow}>{STATUS_OPTS.map(st => (
            <TouchableOpacity key={st.key} style={[s.statusOpt, editStatus === st.key && { backgroundColor: st.color + '22', borderColor: st.color + '44' }]} onPress={() => setEditStatus(st.key)}>
              <Text style={[s.statusOptText, editStatus === st.key && { color: st.color }]}>{st.label}</Text></TouchableOpacity>
          ))}</View>
          <Text style={s.fieldLabel}>Meeting Type</Text>
          <View style={s.statusRow}>{MEETING_TYPES.map(mt => (
            <TouchableOpacity key={mt} style={[s.statusOpt, editMT === mt && s.statusOptOn]} onPress={() => setEditMT(mt)}>
              <Text style={[s.statusOptText, editMT === mt && s.statusOptTextOn]}>{MT_LABELS[mt]}</Text></TouchableOpacity>
          ))}</View>
          <Text style={s.fieldLabel}>Notes</Text>
          <TextInput style={s.notesInput} value={editNotes} onChangeText={setEditNotes} placeholder="Notes..." placeholderTextColor={C.dim} multiline />
          <TouchableOpacity style={s.saveBtn} onPress={handleSave}><Text style={s.saveBtnText}>Save Changes</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* Schedule Modal */}
      <Modal visible={!!scheduleModal} transparent animationType="slide">
        <View style={s.modalBg}><View style={s.modalBox}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Schedule for Expo Day</Text><TouchableOpacity onPress={() => setScheduleModal(null)}><Feather name="x" size={22} color={C.fg} /></TouchableOpacity></View>
          <Text style={s.fieldLabel}>Time Slot</Text>
          <TextInput testID="sched-time-input" style={s.modalInput} value={schedTime} onChangeText={setSchedTime} placeholder="e.g., 10:00 AM" placeholderTextColor={C.dim} />
          <TouchableOpacity testID="confirm-schedule-btn" style={s.saveBtn} onPress={handleSchedule}><Text style={s.saveBtnText}>Add to Expo Day</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: '700', color: C.fg, letterSpacing: -0.5 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  exportText: { color: C.blue, fontSize: 13, fontWeight: '600' },
  filterBar: { maxHeight: 40, marginBottom: 6 },
  fChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.card, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  fChipOn: { backgroundColor: C.blueDim, borderColor: C.blue + '44' },
  fDot: { width: 6, height: 6, borderRadius: 3 },
  fText: { color: C.dim, fontSize: 12, fontWeight: '500' },
  fTextOn: { color: C.blue },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 8 },
  groupTitle: { color: C.fg, fontSize: 15, fontWeight: '700' },
  groupCount: { color: C.dim, fontSize: 12, backgroundColor: C.card2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  netCard: { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 8 },
  netHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  netInfo: { flex: 1 },
  coName: { color: C.fg, fontSize: 14, fontWeight: '600' },
  contact: { color: C.muted, fontSize: 12, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  netMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  mtBadge: { backgroundColor: C.card2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  mtText: { color: C.dim, fontSize: 11 },
  timeText: { color: C.warn, fontSize: 12, fontWeight: '500' },
  notesText: { color: C.dim, fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  netActions: { flexDirection: 'row', gap: 8, marginTop: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  actionText: { color: C.blue, fontSize: 12, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { color: C.fg, fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptyDesc: { color: C.dim, fontSize: 13, marginTop: 4 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: C.fg, fontSize: 18, fontWeight: '700' },
  fieldLabel: { color: C.dim, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 12 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusOpt: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  statusOptOn: { backgroundColor: C.blueDim, borderColor: C.blue + '44' },
  statusOptText: { color: C.dim, fontSize: 12, fontWeight: '500' },
  statusOptTextOn: { color: C.blue },
  modalInput: { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 12, height: 44, color: C.fg, borderWidth: 1, borderColor: C.border },
  notesInput: { backgroundColor: C.bg, borderRadius: 8, padding: 12, height: 100, color: C.fg, borderWidth: 1, borderColor: C.border, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: C.blue, borderRadius: 8, height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
