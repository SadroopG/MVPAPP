import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, ScrollView, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/api';
import { colors, fontSize, spacing, layout } from '../../src/theme';

function formatRevenue(r: number) {
  if (r >= 1e9) return `$${(r / 1e9).toFixed(1)}B`;
  if (r >= 1e6) return `$${(r / 1e6).toFixed(0)}M`;
  if (r >= 1e3) return `$${(r / 1e3).toFixed(0)}K`;
  return `$${r}`;
}

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [expos, setExpos] = useState<any[]>([]);
  const [selectedExpo, setSelectedExpo] = useState<string>('');
  const [exhibitors, setExhibitors] = useState<any[]>([]);
  const [filterOptions, setFilterOptions] = useState<any>({ hqs: [], industries: [], solutions: [] });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeHQ, setActiveHQ] = useState('');
  const [activeIndustry, setActiveIndustry] = useState('');
  const [minRevenue, setMinRevenue] = useState(false);
  const [showExpoModal, setShowExpoModal] = useState(false);
  const [shortlistModal, setShortlistModal] = useState<string | null>(null);
  const [shortlists, setShortlists] = useState<any[]>([]);
  const [newSLName, setNewSLName] = useState('');

  useEffect(() => {
    api.getExpos().then(setExpos).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedExpo) {
      loadExhibitors();
      api.getFilterOptions(selectedExpo).then(setFilterOptions).catch(() => {});
    }
  }, [selectedExpo]);

  const loadExhibitors = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedExpo) params.expo_id = selectedExpo;
      if (search) params.search = search;
      if (activeHQ) params.hq = activeHQ;
      if (activeIndustry) params.industry = activeIndustry;
      if (minRevenue) params.min_revenue = '50000000';
      const data = await api.getExhibitors(params);
      setExhibitors(data);
    } catch { }
    setLoading(false);
  }, [selectedExpo, search, activeHQ, activeIndustry, minRevenue]);

  useEffect(() => { if (selectedExpo) loadExhibitors(); }, [loadExhibitors]);

  const openShortlistModal = async (exhibitorId: string) => {
    setShortlistModal(exhibitorId);
    try { const sl = await api.getShortlists(); setShortlists(sl); } catch { }
  };

  const addToSL = async (slId: string) => {
    if (!shortlistModal) return;
    try {
      await api.addToShortlist(slId, shortlistModal);
      Alert.alert('Added', 'Exhibitor added to shortlist');
      setShortlistModal(null);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const createAndAdd = async () => {
    if (!newSLName || !shortlistModal || !selectedExpo) return;
    try {
      const sl = await api.createShortlist(selectedExpo, newSLName);
      await api.addToShortlist(sl.id, shortlistModal);
      Alert.alert('Created', `Added to "${newSLName}"`);
      setShortlistModal(null);
      setNewSLName('');
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const selectedExpoName = expos.find(e => e.id === selectedExpo)?.name || 'Select Expo';

  const renderExhibitor = ({ item }: { item: any }) => (
    <View style={s.card} testID={`exhibitor-card-${item.id}`}>
      <View style={s.cardHeader}>
        <View style={s.logoCircle}>
          <Text style={s.logoText}>{(item.company || '?')[0]}</Text>
        </View>
        <View style={s.cardInfo}>
          <Text style={s.cardTitle} numberOfLines={1}>{item.company}</Text>
          <View style={s.cardMeta}>
            <Feather name="map-pin" size={12} color={colors.fgMuted} />
            <Text style={s.metaText}>{item.hq}</Text>
          </View>
        </View>
      </View>
      <View style={s.cardStats}>
        <View style={s.stat}>
          <Text style={s.statLabel}>Revenue</Text>
          <Text style={s.statValue}>{formatRevenue(item.revenue)}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>Team</Text>
          <Text style={s.statValue}>{item.team_size?.toLocaleString()}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>Booth</Text>
          <Text style={s.statValue}>{item.booth}</Text>
        </View>
      </View>
      {item.solutions?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsRow}>
          {item.solutions.map((sol: string, i: number) => (
            <View key={i} style={s.chip}><Text style={s.chipText}>{sol}</Text></View>
          ))}
        </ScrollView>
      )}
      <View style={s.cardActions}>
        <TouchableOpacity testID={`shortlist-btn-${item.id}`} style={s.actionBtn} onPress={() => openShortlistModal(item.id)}>
          <Feather name="bookmark" size={16} color={colors.primary} />
          <Text style={s.actionText}>Shortlist</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`profile-btn-${item.id}`} style={[s.actionBtn, s.actionPrimary]} onPress={() => router.push(`/exhibitor/${item.id}`)}>
          <Feather name="arrow-right" size={16} color="#fff" />
          <Text style={[s.actionText, { color: '#fff' }]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <View>
          <Text style={s.greeting}>Welcome back,</Text>
          <Text style={s.userName}>{user?.name || 'User'}</Text>
        </View>
        <TouchableOpacity testID="logout-btn" onPress={logout} style={s.logoutBtn}>
          <Feather name="log-out" size={20} color={colors.fgMuted} />
        </TouchableOpacity>
      </View>

      {/* Expo Selector */}
      <TouchableOpacity testID="expo-selector-btn" style={s.selector} onPress={() => setShowExpoModal(true)}>
        <Feather name="compass" size={18} color={colors.primary} />
        <Text style={s.selectorText} numberOfLines={1}>{selectedExpoName}</Text>
        <Feather name="chevron-down" size={18} color={colors.fgMuted} />
      </TouchableOpacity>

      {selectedExpo ? (
        <>
          {/* Search */}
          <View style={s.searchWrap}>
            <Feather name="search" size={18} color={colors.fgMuted} />
            <TextInput testID="search-input" style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search companies..." placeholderTextColor={colors.fgMuted} />
            {search ? <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={18} color={colors.fgMuted} /></TouchableOpacity> : null}
          </View>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={s.filterContent}>
            <TouchableOpacity testID="filter-revenue" style={[s.filterChip, minRevenue && s.filterActive]} onPress={() => setMinRevenue(!minRevenue)}>
              <Text style={[s.filterText, minRevenue && s.filterTextActive]}>Revenue &gt;$50M</Text>
            </TouchableOpacity>
            {filterOptions.industries?.slice(0, 6).map((ind: string) => (
              <TouchableOpacity key={ind} style={[s.filterChip, activeIndustry === ind && s.filterActive]} onPress={() => setActiveIndustry(activeIndustry === ind ? '' : ind)}>
                <Text style={[s.filterText, activeIndustry === ind && s.filterTextActive]}>{ind}</Text>
              </TouchableOpacity>
            ))}
            {filterOptions.hqs?.slice(0, 4).map((hq: string) => (
              <TouchableOpacity key={hq} style={[s.filterChip, activeHQ === hq && s.filterActive]} onPress={() => setActiveHQ(activeHQ === hq ? '' : hq)}>
                <Text style={[s.filterText, activeHQ === hq && s.filterTextActive]}>{hq}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.resultBar}>
            <Text style={s.resultText}>{exhibitors.length} exhibitor{exhibitors.length !== 1 ? 's' : ''}</Text>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
          ) : (
            <FlatList
              data={exhibitors}
              keyExtractor={item => item.id}
              renderItem={renderExhibitor}
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<View style={s.empty}><Feather name="inbox" size={48} color={colors.bgTertiary} /><Text style={s.emptyText}>No exhibitors found</Text></View>}
            />
          )}
        </>
      ) : (
        <View style={s.empty}>
          <Feather name="compass" size={64} color={colors.bgTertiary} />
          <Text style={s.emptyText}>Select an expo to browse exhibitors</Text>
        </View>
      )}

      {/* Expo Modal */}
      <Modal visible={showExpoModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Expo</Text>
              <TouchableOpacity onPress={() => setShowExpoModal(false)}><Feather name="x" size={24} color={colors.fg} /></TouchableOpacity>
            </View>
            {expos.map(expo => (
              <TouchableOpacity key={expo.id} testID={`expo-option-${expo.id}`} style={[s.expoItem, selectedExpo === expo.id && s.expoItemActive]}
                onPress={() => { setSelectedExpo(expo.id); setShowExpoModal(false); }}>
                <View>
                  <Text style={s.expoName}>{expo.name}</Text>
                  <Text style={s.expoMeta}>{expo.date} - {expo.location}</Text>
                </View>
                {selectedExpo === expo.id && <Feather name="check" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Shortlist Modal */}
      <Modal visible={!!shortlistModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add to Shortlist</Text>
              <TouchableOpacity onPress={() => setShortlistModal(null)}><Feather name="x" size={24} color={colors.fg} /></TouchableOpacity>
            </View>
            {shortlists.map(sl => (
              <TouchableOpacity key={sl.id} style={s.expoItem} onPress={() => addToSL(sl.id)}>
                <Text style={s.expoName}>{sl.name}</Text>
                <Text style={s.expoMeta}>{sl.exhibitor_ids?.length || 0} items</Text>
              </TouchableOpacity>
            ))}
            <View style={s.newSLRow}>
              <TextInput style={s.newSLInput} value={newSLName} onChangeText={setNewSLName} placeholder="New shortlist name..." placeholderTextColor={colors.fgMuted} />
              <TouchableOpacity style={s.newSLBtn} onPress={createAndAdd}>
                <Feather name="plus" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  greeting: { fontSize: fontSize.sm, color: colors.fgMuted },
  userName: { fontSize: fontSize.xl, fontWeight: '700', color: colors.fg },
  logoutBtn: { padding: spacing.sm },
  selector: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSecondary, marginHorizontal: spacing.lg, borderRadius: layout.cardRadius, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  selectorText: { flex: 1, color: colors.fg, fontSize: fontSize.base, fontWeight: '600', marginLeft: spacing.sm },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSecondary, marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: layout.buttonRadius, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, height: 40, color: colors.fg, fontSize: fontSize.sm, marginLeft: spacing.sm },
  filterRow: { maxHeight: 44, marginTop: spacing.md },
  filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  filterChip: { backgroundColor: colors.bgSecondary, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  filterActive: { backgroundColor: colors.badgeBg, borderColor: colors.primary },
  filterText: { color: colors.fgMuted, fontSize: fontSize.xs, fontWeight: '500' },
  filterTextActive: { color: colors.primary },
  resultBar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  resultText: { color: colors.fgMuted, fontSize: fontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: colors.bgSecondary, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  logoCircle: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.badgeBg, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '700' },
  cardInfo: { flex: 1, marginLeft: spacing.md },
  cardTitle: { color: colors.fg, fontSize: fontSize.base, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  metaText: { color: colors.fgMuted, fontSize: fontSize.xs, marginLeft: 4 },
  cardStats: { flexDirection: 'row', marginBottom: spacing.md },
  stat: { flex: 1 },
  statLabel: { color: colors.fgMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { color: colors.fg, fontSize: fontSize.sm, fontWeight: '700', marginTop: 2 },
  chipsRow: { marginBottom: spacing.md, maxHeight: 28 },
  chip: { backgroundColor: colors.bgTertiary, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, marginRight: spacing.xs },
  chipText: { color: colors.fgMuted, fontSize: 10, fontWeight: '500' },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: layout.buttonRadius, borderWidth: 1, borderColor: colors.border, gap: 6 },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: colors.fgMuted, fontSize: fontSize.base, marginTop: spacing.lg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bgSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xxl, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  modalTitle: { color: colors.fg, fontSize: fontSize.xl, fontWeight: '700' },
  expoItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  expoItemActive: { backgroundColor: colors.badgeBg, marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, borderRadius: layout.buttonRadius },
  expoName: { color: colors.fg, fontSize: fontSize.base, fontWeight: '600' },
  expoMeta: { color: colors.fgMuted, fontSize: fontSize.xs, marginTop: 2 },
  newSLRow: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm },
  newSLInput: { flex: 1, backgroundColor: colors.bg, borderRadius: layout.buttonRadius, paddingHorizontal: spacing.md, height: 44, color: colors.fg, borderWidth: 1, borderColor: colors.border },
  newSLBtn: { width: 44, height: 44, borderRadius: layout.buttonRadius, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
});
