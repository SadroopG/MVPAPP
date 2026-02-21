import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api';

const C = { bg: '#0f172a', card: '#1e293b', card2: '#334155', border: 'rgba(255,255,255,0.08)', blue: '#3b82f6', blueDim: 'rgba(59,130,246,0.15)',
  fg: '#f8fafc', muted: '#94a3b8', dim: '#64748b', success: '#10b981', warn: '#f59e0b', err: '#ef4444', purple: '#a78bfa' };

const STAGES = [
  { key: 'prospecting', label: 'Prospecting', color: C.blue },
  { key: 'prospecting_complete', label: 'Complete', color: C.purple },
  { key: 'engaging', label: 'Engaging', color: C.warn },
  { key: 'closed_won', label: 'Won', color: C.success },
  { key: 'closed_lost', label: 'Lost', color: C.err },
];

function fmtRev(r: number) { return r >= 1000 ? `€${(r/1000).toFixed(0)}B` : `€${r}M`; }

export default function ShortlistsScreen() {
  const [tab, setTab] = useState('prospecting');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteModal, setNoteModal] = useState<any>(null);
  const [noteText, setNoteText] = useState('');
  const [networkModal, setNetworkModal] = useState<any>(null);
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');

  const load = async () => {
    setLoading(true);
    try { setItems(await api.getShortlists({ stage: tab })); } catch { }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, [tab]));

  const changeStage = async (companyId: string, newStage: string) => {
    await api.updateStage(companyId, newStage);
    load();
  };

  const saveNotes = async () => {
    if (!noteModal) return;
    await api.updateShortlist(noteModal.id, noteText);
    setNoteModal(null);
    load();
  };

  const handleNetworkAction = async () => {
    if (!networkModal || !contactName) return;
    const company = networkModal.company;
    await api.createNetwork({
      company_id: company.id, expo_id: networkModal.expo_id,
      contact_name: contactName, contact_role: contactRole
    });
    await api.updateStage(company.id, 'engaging');
    Alert.alert('Network Created', `${contactName} from ${company.name} added to Networks`);
    setNetworkModal(null);
    setContactName('');
    setContactRole('');
    load();
  };

  const handleExport = async () => {
    try {
      const res = await api.exportCSV('shortlists');
      Alert.alert('Export Ready', `CSV generated: ${res.filename}\n${res.csv_data.split('\\n').length - 1} rows`);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleDelete = (sid: string) => {
    Alert.alert('Remove', 'Remove from shortlist?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await api.deleteShortlist(sid); load(); } }
    ]);
  };

  const renderItem = ({ item }: { item: any }) => {
    const co = item.company || {};
    const ex = item.expo || {};
    return (
      <View style={s.row} testID={`sl-row-${item.id}`}>
        <View style={s.cellMain}>
          <Text style={s.coName}>{co.name}</Text>
          <View style={s.expoTag}><Text style={s.expoTagText}>{ex.name}</Text></View>
        </View>
        <View style={s.cellStage}>
          {STAGES.map(st => (
            <TouchableOpacity key={st.key} style={[s.stageBtn, co.shortlist_stage === st.key && { backgroundColor: st.color + '22', borderColor: st.color + '44' }]}
              onPress={() => changeStage(co.id, st.key)}>
              <View style={[s.stageDot, { backgroundColor: co.shortlist_stage === st.key ? st.color : C.dim }]} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.noteBtn} onPress={() => { setNoteModal(item); setNoteText(item.notes || ''); }}>
          <Feather name="file-text" size={14} color={item.notes ? C.blue : C.dim} />
        </TouchableOpacity>
        <TouchableOpacity style={s.netBtn} onPress={() => { setNetworkModal(item); setContactName(co.contacts?.[0]?.name || ''); setContactRole(co.contacts?.[0]?.role || ''); }}>
          <Feather name="users" size={14} color={C.blue} />
          <Text style={s.netBtnText}>Network</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.delBtn}>
          <Feather name="trash-2" size={14} color={C.err} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>My Shortlists</Text>
        <TouchableOpacity testID="export-sl-btn" style={s.exportBtn} onPress={handleExport}>
          <Feather name="download" size={14} color={C.blue} />
          <Text style={s.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Stage Tabs */}
      <View style={s.tabs}>
        {STAGES.map(st => (
          <TouchableOpacity key={st.key} testID={`sl-tab-${st.key}`} style={[s.tabItem, tab === st.key && s.tabOn]}
            onPress={() => setTab(st.key)}>
            <View style={[s.tabDot, { backgroundColor: st.color }]} />
            <Text style={[s.tabText, tab === st.key && s.tabTextOn]}>{st.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={C.blue} size="large" /> : (
        <FlatList data={items} keyExtractor={i => i.id} renderItem={renderItem}
          contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
          ListEmptyComponent={<View style={s.empty}><Feather name="inbox" size={48} color={C.card2} /><Text style={s.emptyTitle}>No {STAGES.find(s=>s.key===tab)?.label} items</Text><Text style={s.emptyDesc}>Shortlist companies from expo detail pages</Text></View>} />
      )}

      {/* Notes Modal */}
      <Modal visible={!!noteModal} transparent animationType="slide">
        <View style={s.modalBg}><View style={s.modalBox}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Notes</Text><TouchableOpacity onPress={() => setNoteModal(null)}><Feather name="x" size={22} color={C.fg} /></TouchableOpacity></View>
          <TextInput testID="notes-input" style={s.notesInput} value={noteText} onChangeText={setNoteText} placeholder="Add notes..." placeholderTextColor={C.dim} multiline textAlignVertical="top" />
          <TouchableOpacity testID="save-notes-btn" style={s.saveBtn} onPress={saveNotes}><Text style={s.saveBtnText}>Save</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* Network Modal */}
      <Modal visible={!!networkModal} transparent animationType="slide">
        <View style={s.modalBg}><View style={s.modalBox}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Create Network Entry</Text><TouchableOpacity onPress={() => setNetworkModal(null)}><Feather name="x" size={22} color={C.fg} /></TouchableOpacity></View>
          <Text style={s.fieldLabel}>Contact Name</Text>
          <TextInput testID="contact-name-input" style={s.modalInput} value={contactName} onChangeText={setContactName} placeholder="Contact name" placeholderTextColor={C.dim} />
          <Text style={s.fieldLabel}>Role</Text>
          <TextInput style={s.modalInput} value={contactRole} onChangeText={setContactRole} placeholder="Role/Title" placeholderTextColor={C.dim} />
          <TouchableOpacity testID="create-network-btn" style={s.saveBtn} onPress={handleNetworkAction}><Text style={s.saveBtnText}>Add to Networks</Text></TouchableOpacity>
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
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: C.card, borderRadius: 10, padding: 4, marginBottom: 12 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8 },
  tabOn: { backgroundColor: C.bg },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  tabText: { color: C.dim, fontSize: 12, fontWeight: '500' },
  tabTextOn: { color: C.fg },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8, gap: 8 },
  cellMain: { flex: 2 },
  coName: { color: C.fg, fontSize: 14, fontWeight: '600' },
  expoTag: { backgroundColor: C.card2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, alignSelf: 'flex-start', marginTop: 4 },
  expoTagText: { color: C.dim, fontSize: 10 },
  cellStage: { flexDirection: 'row', gap: 4 },
  stageBtn: { width: 22, height: 22, borderRadius: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  stageDot: { width: 8, height: 8, borderRadius: 4 },
  noteBtn: { padding: 6 },
  netBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, backgroundColor: C.blueDim },
  netBtnText: { color: C.blue, fontSize: 11, fontWeight: '600' },
  delBtn: { padding: 6 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { color: C.fg, fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptyDesc: { color: C.dim, fontSize: 13, marginTop: 4 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: C.fg, fontSize: 18, fontWeight: '700' },
  fieldLabel: { color: C.dim, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  modalInput: { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 12, height: 44, color: C.fg, borderWidth: 1, borderColor: C.border },
  notesInput: { backgroundColor: C.bg, borderRadius: 8, padding: 12, height: 120, color: C.fg, borderWidth: 1, borderColor: C.border, fontSize: 14 },
  saveBtn: { backgroundColor: C.blue, borderRadius: 8, height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
