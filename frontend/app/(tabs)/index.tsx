import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, ScrollView, Modal, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/api';

const C = { bg: '#0f172a', card: '#1e293b', card2: '#334155', border: 'rgba(255,255,255,0.08)', blue: '#3b82f6', blueDim: 'rgba(59,130,246,0.15)',
  fg: '#f8fafc', muted: '#94a3b8', dim: '#64748b', success: '#10b981', warn: '#f59e0b', err: '#ef4444' };

const REGION_COLORS: Record<string,string> = { 'Europe': '#818cf8', 'North America': '#34d399', 'Middle East': '#fbbf24' };

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [expos, setExpos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<any>({ regions: [], industries: [] });
  const [selRegion, setSelRegion] = useState('');
  const [selIndustries, setSelIndustries] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ex, f] = await Promise.all([api.getExpos(), api.getExpoFilters()]);
      setExpos(ex);
      setFilters(f);
    } catch { }
    setLoading(false);
  };

  useEffect(() => {
    const params: Record<string,string> = {};
    if (selRegion) params.region = selRegion;
    if (selIndustries.length === 1) params.industry = selIndustries[0];
    api.getExpos(params).then(setExpos).catch(() => {});
  }, [selRegion, selIndustries]);

  const numCols = width > 900 ? 3 : width > 600 ? 2 : 1;
  const cardWidth = (width - 48 - (numCols - 1) * 12) / numCols;

  const filtered = selIndustries.length > 1
    ? expos.filter(e => selIndustries.some(i => e.industry?.toLowerCase().includes(i.toLowerCase())))
    : expos;

  const toggleIndustry = (ind: string) => {
    setSelIndustries(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]);
  };

  const renderExpo = ({ item }: { item: any }) => {
    const regionColor = REGION_COLORS[item.region] || C.blue;
    return (
      <TouchableOpacity testID={`expo-card-${item.id}`} style={[s.expoCard, { width: numCols === 1 ? '100%' : cardWidth }]}
        onPress={() => router.push(`/expo/${item.id}`)}>
        <View style={[s.cardAccent, { backgroundColor: regionColor }]} />
        <View style={s.cardBody}>
          <View style={s.cardTop}>
            <View style={[s.regionBadge, { backgroundColor: regionColor + '22' }]}>
              <Text style={[s.regionText, { color: regionColor }]}>{item.region}</Text>
            </View>
            <Text style={s.dateText}>{item.date}</Text>
          </View>
          <Text style={s.expoName}>{item.name}</Text>
          <View style={s.cardMeta}>
            <View style={s.metaItem}>
              <Feather name="briefcase" size={13} color={C.dim} />
              <Text style={s.metaText}>{item.industry}</Text>
            </View>
          </View>
          <View style={s.cardFooter}>
            <View style={s.companiesCount}>
              <Feather name="briefcase" size={13} color={C.blue} />
              <Text style={s.companiesText}>{item.company_count || 0} companies</Text>
            </View>
            <Feather name="arrow-right" size={16} color={C.dim} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Hello {user?.name?.split(' ')[0] || 'there'},</Text>
          <Text style={s.heroText}>Which expo would you like to plan for?</Text>
        </View>
        <TouchableOpacity testID="logout-btn" onPress={logout} style={s.avatarBtn}>
          <Text style={s.avatarText}>{(user?.name || 'U')[0]}</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
          <TouchableOpacity style={[s.filterChip, !selRegion && !selIndustries.length && s.filterActive]}
            onPress={() => { setSelRegion(''); setSelIndustries([]); }}>
            <Text style={[s.filterChipText, !selRegion && !selIndustries.length && s.filterActiveText]}>All</Text>
          </TouchableOpacity>
          {filters.regions?.map((r: string) => (
            <TouchableOpacity key={r} style={[s.filterChip, selRegion === r && s.filterActive]}
              onPress={() => setSelRegion(selRegion === r ? '' : r)}>
              <View style={[s.filterDot, { backgroundColor: REGION_COLORS[r] || C.blue }]} />
              <Text style={[s.filterChipText, selRegion === r && s.filterActiveText]}>{r}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.filterChip} onPress={() => setShowFilter(true)}>
            <Feather name="sliders" size={13} color={C.dim} />
            <Text style={s.filterChipText}>Industry</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Active filters */}
      {selIndustries.length > 0 && (
        <View style={s.activeFilters}>
          {selIndustries.map(i => (
            <TouchableOpacity key={i} style={s.activeChip} onPress={() => toggleIndustry(i)}>
              <Text style={s.activeChipText}>{i}</Text>
              <Feather name="x" size={12} color={C.blue} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results */}
      <View style={s.resultBar}>
        <Text style={s.resultText}>{filtered.length} expo{filtered.length !== 1 ? 's' : ''} available</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={C.blue} size="large" />
      ) : (
        <FlatList data={filtered} keyExtractor={i => i.id} renderItem={renderExpo}
          numColumns={numCols} key={`cols-${numCols}`}
          contentContainerStyle={s.list} columnWrapperStyle={numCols > 1 ? s.row : undefined}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<View style={s.empty}><Feather name="inbox" size={48} color={C.card2} /><Text style={s.emptyText}>No expos found</Text></View>} />
      )}

      {/* Industry Filter Modal */}
      <Modal visible={showFilter} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <View style={s.modalHead}><Text style={s.modalTitle}>Filter by Industry</Text>
              <TouchableOpacity onPress={() => setShowFilter(false)}><Feather name="x" size={24} color={C.fg} /></TouchableOpacity></View>
            {filters.industries?.map((ind: string) => (
              <TouchableOpacity key={ind} style={s.checkRow} onPress={() => toggleIndustry(ind)}>
                <View style={[s.checkbox, selIndustries.includes(ind) && s.checkboxOn]}>
                  {selIndustries.includes(ind) && <Feather name="check" size={14} color="#fff" />}
                </View>
                <Text style={s.checkLabel}>{ind}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.applyBtn} onPress={() => setShowFilter(false)}>
              <Text style={s.applyText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  greeting: { fontSize: 14, color: C.muted, fontWeight: '400' },
  heroText: { fontSize: 22, color: C.fg, fontWeight: '700', marginTop: 4, letterSpacing: -0.5 },
  avatarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  avatarText: { color: C.blue, fontSize: 16, fontWeight: '700' },
  filterBar: { paddingBottom: 8 },
  filterScroll: { paddingHorizontal: 20, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  filterActive: { backgroundColor: C.blueDim, borderColor: C.blue + '44' },
  filterChipText: { color: C.muted, fontSize: 13, fontWeight: '500' },
  filterActiveText: { color: C.blue },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  activeFilters: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 6, paddingBottom: 8 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.blueDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  activeChipText: { color: C.blue, fontSize: 12, fontWeight: '500' },
  resultBar: { paddingHorizontal: 20, paddingBottom: 12 },
  resultText: { color: C.dim, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  row: { gap: 12 },
  expoCard: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 12 },
  cardAccent: { height: 3 },
  cardBody: { padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  regionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  regionText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateText: { color: C.dim, fontSize: 12 },
  expoName: { color: C.fg, fontSize: 17, fontWeight: '700', marginBottom: 8, letterSpacing: -0.3 },
  cardMeta: { marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: C.dim, fontSize: 13 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  companiesCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  companiesText: { color: C.blue, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: C.dim, fontSize: 15, marginTop: 16 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '70%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: C.fg, fontSize: 18, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: C.dim, justifyContent: 'center', alignItems: 'center' },
  checkboxOn: { backgroundColor: C.blue, borderColor: C.blue },
  checkLabel: { color: C.fg, fontSize: 15 },
  applyBtn: { backgroundColor: C.blue, borderRadius: 8, height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  applyText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
