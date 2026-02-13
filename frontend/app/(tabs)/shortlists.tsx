import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api';
import { colors, fontSize, spacing, layout } from '../../src/theme';

function formatRevenue(r: number) {
  if (r >= 1e9) return `$${(r / 1e9).toFixed(1)}B`;
  if (r >= 1e6) return `$${(r / 1e6).toFixed(0)}M`;
  return `$${r}`;
}

export default function ShortlistsScreen() {
  const [shortlists, setShortlists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [expos, setExpos] = useState<any[]>([]);
  const [selectedExpo, setSelectedExpo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [sl, ex] = await Promise.all([api.getShortlists(), api.getExpos()]);
      setShortlists(sl);
      setExpos(ex);
    } catch { }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleDelete = (id: string) => {
    Alert.alert('Delete Shortlist', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteShortlist(id); load(); } }
    ]);
  };

  const handleRemove = async (slId: string, exId: string) => {
    await api.removeFromShortlist(slId, exId);
    load();
  };

  const handleExport = async (slId: string) => {
    try {
      const res = await api.exportShortlist(slId);
      Alert.alert('Export Ready', `CSV data generated for "${res.filename}"\n\nRows: ${res.csv_data.split('\n').length - 1}`);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const moveItem = async (slId: string, ids: string[], fromIdx: number, dir: number) => {
    const toIdx = fromIdx + dir;
    if (toIdx < 0 || toIdx >= ids.length) return;
    const newIds = [...ids];
    [newIds[fromIdx], newIds[toIdx]] = [newIds[toIdx], newIds[fromIdx]];
    await api.reorderShortlist(slId, newIds);
    load();
  };

  const handleCreate = async () => {
    if (!newName || !selectedExpo) return;
    try {
      await api.createShortlist(selectedExpo, newName);
      setCreateModal(false);
      setNewName('');
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const renderSL = ({ item }: { item: any }) => {
    const expanded = expandedId === item.id;
    const exs = item.exhibitors || [];
    return (
      <View style={s.card} testID={`shortlist-${item.id}`}>
        <TouchableOpacity style={s.cardHeader} onPress={() => setExpandedId(expanded ? null : item.id)}>
          <View style={s.slIcon}><Feather name="bookmark" size={18} color={colors.primary} /></View>
          <View style={s.slInfo}>
            <Text style={s.slName}>{item.name}</Text>
            <Text style={s.slMeta}>{exs.length} exhibitor{exs.length !== 1 ? 's' : ''}</Text>
          </View>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.fgMuted} />
        </TouchableOpacity>

        {expanded && (
          <View style={s.expandedArea}>
            <View style={s.slActions}>
              <TouchableOpacity testID={`export-sl-${item.id}`} style={s.slActionBtn} onPress={() => handleExport(item.id)}>
                <Feather name="download" size={14} color={colors.primary} />
                <Text style={s.slActionText}>Export CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`delete-sl-${item.id}`} style={[s.slActionBtn, s.deleteBtn]} onPress={() => handleDelete(item.id)}>
                <Feather name="trash-2" size={14} color={colors.error} />
                <Text style={[s.slActionText, { color: colors.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
            {exs.map((ex: any, idx: number) => (
              <View key={ex.id} style={s.exItem}>
                <View style={s.reorderBtns}>
                  <TouchableOpacity onPress={() => moveItem(item.id, item.exhibitor_ids, idx, -1)} disabled={idx === 0}>
                    <Feather name="chevron-up" size={16} color={idx === 0 ? colors.bgTertiary : colors.fgMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => moveItem(item.id, item.exhibitor_ids, idx, 1)} disabled={idx === exs.length - 1}>
                    <Feather name="chevron-down" size={16} color={idx === exs.length - 1 ? colors.bgTertiary : colors.fgMuted} />
                  </TouchableOpacity>
                </View>
                <View style={s.exInfo}>
                  <Text style={s.exName}>{ex.company}</Text>
                  <Text style={s.exMeta}>{ex.hq} - {formatRevenue(ex.revenue)}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemove(item.id, ex.id)} style={s.removeBtn}>
                  <Feather name="x" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            {exs.length === 0 && <Text style={s.emptyText}>No exhibitors yet</Text>}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Shortlists</Text>
        <TouchableOpacity testID="create-shortlist-btn" style={s.addBtn} onPress={() => setCreateModal(true)}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={shortlists}
          keyExtractor={item => item.id}
          renderItem={renderSL}
          contentContainerStyle={s.list}
          ListEmptyComponent={<View style={s.empty}><Feather name="bookmark" size={48} color={colors.bgTertiary} /><Text style={s.emptyTitle}>No shortlists yet</Text><Text style={s.emptyDesc}>Browse exhibitors and add them to a shortlist</Text></View>}
        />
      )}

      <Modal visible={createModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>New Shortlist</Text>
            <TextInput testID="new-shortlist-name" style={s.modalInput} value={newName} onChangeText={setNewName} placeholder="Shortlist name" placeholderTextColor={colors.fgMuted} />
            <Text style={s.fieldLabel}>Select Expo</Text>
            {expos.map(ex => (
              <TouchableOpacity key={ex.id} style={[s.expoOption, selectedExpo === ex.id && s.expoOptionActive]} onPress={() => setSelectedExpo(ex.id)}>
                <Text style={[s.expoOptionText, selectedExpo === ex.id && { color: colors.primary }]}>{ex.name}</Text>
              </TouchableOpacity>
            ))}
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setCreateModal(false)}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity testID="confirm-create-sl" style={s.confirmBtn} onPress={handleCreate}><Text style={s.confirmText}>Create</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.fg },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: colors.bgSecondary, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
  slIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.badgeBg, justifyContent: 'center', alignItems: 'center' },
  slInfo: { flex: 1, marginLeft: spacing.md },
  slName: { color: colors.fg, fontSize: fontSize.base, fontWeight: '700' },
  slMeta: { color: colors.fgMuted, fontSize: fontSize.xs, marginTop: 2 },
  expandedArea: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  slActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  slActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: layout.buttonRadius, borderWidth: 1, borderColor: colors.border },
  deleteBtn: { borderColor: 'rgba(239,68,68,0.3)' },
  slActionText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '600' },
  exItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  reorderBtns: { alignItems: 'center', marginRight: spacing.sm },
  exInfo: { flex: 1 },
  exName: { color: colors.fg, fontSize: fontSize.sm, fontWeight: '600' },
  exMeta: { color: colors.fgMuted, fontSize: fontSize.xs },
  removeBtn: { padding: spacing.sm },
  emptyText: { color: colors.fgMuted, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.lg },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { color: colors.fg, fontSize: fontSize.lg, fontWeight: '600', marginTop: spacing.lg },
  emptyDesc: { color: colors.fgMuted, fontSize: fontSize.sm, marginTop: spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bgSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xxl },
  modalTitle: { color: colors.fg, fontSize: fontSize.xl, fontWeight: '700', marginBottom: spacing.lg },
  modalInput: { backgroundColor: colors.bg, borderRadius: layout.buttonRadius, paddingHorizontal: spacing.md, height: 48, color: colors.fg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  fieldLabel: { color: colors.fgMuted, fontSize: fontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  expoOption: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  expoOptionActive: { backgroundColor: colors.badgeBg, marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, borderRadius: layout.buttonRadius },
  expoOptionText: { color: colors.fg, fontSize: fontSize.base },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  cancelBtn: { flex: 1, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: layout.buttonRadius, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.fgMuted, fontSize: fontSize.base, fontWeight: '600' },
  confirmBtn: { flex: 1, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: layout.buttonRadius, backgroundColor: colors.primary },
  confirmText: { color: '#fff', fontSize: fontSize.base, fontWeight: '600' },
});
