import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';

const C = { bg: '#0f172a', card: '#1e293b', card2: '#334155', border: 'rgba(255,255,255,0.08)', blue: '#3b82f6', blueDim: 'rgba(59,130,246,0.15)',
  fg: '#f8fafc', muted: '#94a3b8', dim: '#64748b', success: '#10b981', warn: '#f59e0b' };

function fmtRev(r: number) { return r >= 1000 ? `€${(r/1000).toFixed(0)}B` : `€${r}M`; }

export default function ExpoDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [expo, setExpo] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selIndustry, setSelIndustry] = useState('');
  const [filterOpts, setFilterOpts] = useState<any>({ industries: [], hqs: [] });

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getExpo(id), api.getCompanies({ expo_id: id }), api.getCompanyFilters(id)])
      .then(([e, c, f]) => { setExpo(e); setCompanies(c); setFilterOpts(f); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const loadCompanies = () => {
    const p: Record<string,string> = { expo_id: id! };
    if (search) p.search = search;
    if (selIndustry) p.industry = selIndustry;
    api.getCompanies(p).then(setCompanies).catch(() => {});
  };

  useEffect(() => { if (id) loadCompanies(); }, [search, selIndustry]);

  const handleShortlist = async (company: any) => {
    try {
      await api.addToShortlist(company.id, id!);
      await api.updateStage(company.id, 'prospecting');
      Alert.alert('Added', `${company.name} added to shortlist`);
      loadCompanies();
    } catch (e: any) { Alert.alert('Info', e.message?.includes('already') ? 'Already shortlisted' : e.message); }
  };

  const renderCompany = ({ item }: { item: any }) => {
    const staged = item.shortlist_stage && item.shortlist_stage !== 'none';
    return (
      <View style={s.row} testID={`company-row-${item.id}`}>
        <View style={s.cellMain}>
          <Text style={s.companyName}>{item.name}</Text>
          {item.contacts?.length > 0 && <Text style={s.contactHint}>{item.contacts.length} contact{item.contacts.length > 1 ? 's' : ''}</Text>}
        </View>
        <Text style={[s.cell, s.cellSm]}>{item.hq}</Text>
        <Text style={[s.cell, s.cellSm]}>{fmtRev(item.revenue)}</Text>
        <Text style={[s.cell, s.cellXs]}>{item.booth}</Text>
        <View style={[s.cell, s.cellSm]}>
          <View style={s.indBadge}><Text style={s.indText}>{item.industry}</Text></View>
        </View>
        <View style={s.cellAction}>
          {staged ? (
            <View style={s.stagedBadge}><Feather name="check" size={12} color={C.success} /><Text style={s.stagedText}>{item.shortlist_stage}</Text></View>
          ) : (
            <TouchableOpacity testID={`shortlist-btn-${item.id}`} style={s.shortlistBtn} onPress={() => handleShortlist(item)}>
              <Feather name="plus" size={14} color={C.blue} />
              <Text style={s.shortlistText}>Shortlist</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 60 }} color={C.blue} size="large" /></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={C.fg} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.expoName}>{expo?.name}</Text>
          <Text style={s.expoMeta}>{expo?.region} · {expo?.industry} · {expo?.date}</Text>
        </View>
        <View style={s.countBadge}><Text style={s.countText}>{companies.length}</Text></View>
      </View>

      {/* Search + Filters */}
      <View style={s.toolbar}>
        <View style={s.searchWrap}>
          <Feather name="search" size={16} color={C.dim} />
          <TextInput testID="search-input" style={s.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search companies..." placeholderTextColor={C.dim} />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={16} color={C.dim} /></TouchableOpacity> : null}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.indFilter} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
        <TouchableOpacity style={[s.fChip, !selIndustry && s.fChipOn]} onPress={() => setSelIndustry('')}>
          <Text style={[s.fChipText, !selIndustry && s.fChipTextOn]}>All</Text>
        </TouchableOpacity>
        {filterOpts.industries?.map((ind: string) => (
          <TouchableOpacity key={ind} style={[s.fChip, selIndustry === ind && s.fChipOn]} onPress={() => setSelIndustry(selIndustry === ind ? '' : ind)}>
            <Text style={[s.fChipText, selIndustry === ind && s.fChipTextOn]}>{ind}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Table Header */}
      <View style={s.tableHead}>
        <Text style={[s.th, s.thMain]}>Company</Text>
        <Text style={[s.th, s.thSm]}>HQ</Text>
        <Text style={[s.th, s.thSm]}>Revenue</Text>
        <Text style={[s.th, s.thXs]}>Booth</Text>
        <Text style={[s.th, s.thSm]}>Industry</Text>
        <Text style={[s.th, s.thAction]}>Action</Text>
      </View>

      <FlatList data={companies} keyExtractor={i => i.id} renderItem={renderCompany}
        contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}
        ListEmptyComponent={<View style={s.empty}><Feather name="inbox" size={40} color={C.card2} /><Text style={s.emptyText}>No companies found</Text></View>} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 12 },
  expoName: { color: C.fg, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  expoMeta: { color: C.muted, fontSize: 12, marginTop: 2 },
  countBadge: { backgroundColor: C.blueDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  countText: { color: C.blue, fontSize: 13, fontWeight: '700' },
  toolbar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, height: 40, color: C.fg, fontSize: 14, marginLeft: 8 },
  indFilter: { maxHeight: 36, marginBottom: 8 },
  fChip: { backgroundColor: C.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  fChipOn: { backgroundColor: C.blueDim, borderColor: C.blue + '44' },
  fChipText: { color: C.dim, fontSize: 12, fontWeight: '500' },
  fChipTextOn: { color: C.blue },
  tableHead: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  th: { color: C.dim, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  thMain: { flex: 2 },
  thSm: { flex: 1.2 },
  thXs: { flex: 0.8 },
  thAction: { flex: 1.2, textAlign: 'right' },
  listContent: { paddingBottom: 100 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  cellMain: { flex: 2 },
  companyName: { color: C.fg, fontSize: 14, fontWeight: '600' },
  contactHint: { color: C.dim, fontSize: 11, marginTop: 2 },
  cell: { fontSize: 13, color: C.muted },
  cellSm: { flex: 1.2 },
  cellXs: { flex: 0.8, fontSize: 12, color: C.dim },
  indBadge: { backgroundColor: C.card2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, alignSelf: 'flex-start' },
  indText: { color: C.muted, fontSize: 11 },
  cellAction: { flex: 1.2, alignItems: 'flex-end' },
  shortlistBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.blueDim, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  shortlistText: { color: C.blue, fontSize: 12, fontWeight: '600' },
  stagedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stagedText: { color: C.success, fontSize: 11, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: C.dim, fontSize: 14, marginTop: 12 },
});
