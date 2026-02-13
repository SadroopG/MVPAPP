import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, TextInput, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { colors, fontSize, spacing, layout } from '../../src/theme';

function formatRevenue(r: number) {
  if (r >= 1e9) return `$${(r / 1e9).toFixed(1)}B`;
  if (r >= 1e6) return `$${(r / 1e6).toFixed(0)}M`;
  return `$${r}`;
}

export default function ExhibitorProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [exhibitor, setExhibitor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSLModal, setShowSLModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [shortlists, setShortlists] = useState<any[]>([]);
  const [expos, setExpos] = useState<any[]>([]);
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [selectedExpoForMeeting, setSelectedExpoForMeeting] = useState('');
  const [activeTab, setActiveTab] = useState<'about' | 'people'>('about');

  useEffect(() => {
    if (id) {
      api.getExhibitor(id).then(setExhibitor).catch(() => {}).finally(() => setLoading(false));
    }
  }, [id]);

  const openSLModal = async () => {
    try { setShortlists(await api.getShortlists()); } catch { }
    setShowSLModal(true);
  };

  const addToSL = async (slId: string) => {
    try {
      await api.addToShortlist(slId, id!);
      Alert.alert('Added', 'Added to shortlist');
      setShowSLModal(false);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const openMeetingModal = async () => {
    try { setExpos(await api.getExpos()); } catch { }
    setShowMeetingModal(true);
  };

  const addMeeting = async () => {
    if (!meetingTime || !selectedExpoForMeeting) {
      Alert.alert('Error', 'Please fill time and select expo');
      return;
    }
    try {
      let expoDay;
      const days = await api.getExpoDays(selectedExpoForMeeting);
      if (days.length > 0) expoDay = days[0];
      else expoDay = await api.createExpoDay(selectedExpoForMeeting);
      await api.addMeeting(expoDay.id, { exhibitor_id: id, time: meetingTime, agenda: meetingAgenda });
      Alert.alert('Meeting Added', 'Meeting added to your Expo Day timeline');
      setShowMeetingModal(false);
      setMeetingTime('');
      setMeetingAgenda('');
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" /></SafeAreaView>;
  if (!exhibitor) return <SafeAreaView style={s.safe}><Text style={s.errorText}>Exhibitor not found</Text></SafeAreaView>;

  const people = exhibitor.people || [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.headerBar}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={24} color={colors.fg} />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{exhibitor.company}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero Section */}
        <View style={s.hero}>
          <View style={s.logoLarge}>
            <Text style={s.logoLargeText}>{exhibitor.company[0]}</Text>
          </View>
          <Text style={s.companyName}>{exhibitor.company}</Text>
          <View style={s.heroMeta}>
            <Feather name="map-pin" size={14} color={colors.fgMuted} />
            <Text style={s.heroMetaText}>{exhibitor.hq}</Text>
          </View>
          <View style={s.heroMeta}>
            <Feather name="grid" size={14} color={colors.fgMuted} />
            <Text style={s.heroMetaText}>{exhibitor.industry}</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{formatRevenue(exhibitor.revenue)}</Text>
            <Text style={s.statLabel}>Revenue</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statValue}>{exhibitor.team_size?.toLocaleString()}</Text>
            <Text style={s.statLabel}>Team Size</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statValue}>{exhibitor.booth}</Text>
            <Text style={s.statLabel}>Booth</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity testID="add-shortlist-btn" style={s.actionBtn} onPress={openSLModal}>
            <Feather name="bookmark" size={18} color={colors.primary} />
            <Text style={s.actionBtnText}>Shortlist</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="add-meeting-btn" style={[s.actionBtn, s.actionPrimary]} onPress={openMeetingModal}>
            <Feather name="calendar" size={18} color="#fff" />
            <Text style={[s.actionBtnText, { color: '#fff' }]}>Add to Expo Day</Text>
          </TouchableOpacity>
        </View>

        {/* Links */}
        <View style={s.linksRow}>
          {exhibitor.linkedin && (
            <TouchableOpacity testID="linkedin-link" style={s.linkBtn} onPress={() => Linking.openURL(exhibitor.linkedin)}>
              <Feather name="linkedin" size={16} color={colors.primary} />
              <Text style={s.linkText}>LinkedIn</Text>
            </TouchableOpacity>
          )}
          {exhibitor.website && (
            <TouchableOpacity testID="website-link" style={s.linkBtn} onPress={() => Linking.openURL(exhibitor.website)}>
              <Feather name="globe" size={16} color={colors.primary} />
              <Text style={s.linkText}>Website</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={s.tabBar}>
          <TouchableOpacity style={[s.tab, activeTab === 'about' && s.tabActive]} onPress={() => setActiveTab('about')}>
            <Text style={[s.tabText, activeTab === 'about' && s.tabTextActive]}>About</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, activeTab === 'people' && s.tabActive]} onPress={() => setActiveTab('people')}>
            <Text style={[s.tabText, activeTab === 'people' && s.tabTextActive]}>People ({people.length})</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'about' ? (
          <View style={s.section}>
            {exhibitor.solutions?.length > 0 && (
              <>
                <Text style={s.sectionTitle}>Solutions</Text>
                <View style={s.chipsWrap}>
                  {exhibitor.solutions.map((sol: string, i: number) => (
                    <View key={i} style={s.chip}><Text style={s.chipText}>{sol}</Text></View>
                  ))}
                </View>
              </>
            )}
            <Text style={s.sectionTitle}>Industry</Text>
            <Text style={s.sectionText}>{exhibitor.industry}</Text>
            <Text style={s.sectionTitle}>Headquarters</Text>
            <Text style={s.sectionText}>{exhibitor.hq}</Text>
          </View>
        ) : (
          <View style={s.section}>
            {people.map((p: any, i: number) => (
              <View key={i} style={s.personCard}>
                <View style={s.personAvatar}>
                  <Text style={s.personAvatarText}>{(p.name || '?')[0]}</Text>
                </View>
                <View style={s.personInfo}>
                  <Text style={s.personName}>{p.name}</Text>
                  <Text style={s.personTitle}>{p.title}</Text>
                </View>
                {p.linkedin && (
                  <TouchableOpacity style={s.personLink} onPress={() => Linking.openURL(p.linkedin)}>
                    <Feather name="linkedin" size={18} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {people.length === 0 && <Text style={s.emptyText}>No people listed</Text>}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Shortlist Modal */}
      <Modal visible={showSLModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add to Shortlist</Text>
              <TouchableOpacity onPress={() => setShowSLModal(false)}><Feather name="x" size={24} color={colors.fg} /></TouchableOpacity>
            </View>
            {shortlists.map(sl => (
              <TouchableOpacity key={sl.id} style={s.slItem} onPress={() => addToSL(sl.id)}>
                <Text style={s.slItemName}>{sl.name}</Text>
                <Text style={s.slItemMeta}>{sl.exhibitor_ids?.length || 0} items</Text>
              </TouchableOpacity>
            ))}
            {shortlists.length === 0 && <Text style={s.emptyText}>No shortlists yet. Create one from the Shortlists tab.</Text>}
          </View>
        </View>
      </Modal>

      {/* Meeting Modal */}
      <Modal visible={showMeetingModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Schedule Meeting</Text>
              <TouchableOpacity onPress={() => setShowMeetingModal(false)}><Feather name="x" size={24} color={colors.fg} /></TouchableOpacity>
            </View>
            <Text style={s.fieldLabel}>Select Expo</Text>
            {expos.map(ex => (
              <TouchableOpacity key={ex.id} style={[s.expoOpt, selectedExpoForMeeting === ex.id && s.expoOptActive]} onPress={() => setSelectedExpoForMeeting(ex.id)}>
                <Text style={[s.expoOptText, selectedExpoForMeeting === ex.id && { color: colors.primary }]}>{ex.name}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[s.fieldLabel, { marginTop: spacing.lg }]}>Meeting Time</Text>
            <TextInput testID="meeting-time-input" style={s.modalInput} value={meetingTime} onChangeText={setMeetingTime} placeholder="e.g., 09:30 AM" placeholderTextColor={colors.fgMuted} />
            <Text style={[s.fieldLabel, { marginTop: spacing.md }]}>Agenda</Text>
            <TextInput testID="meeting-agenda-input" style={[s.modalInput, { height: 80 }]} value={meetingAgenda} onChangeText={setMeetingAgenda} placeholder="Discussion topics..." placeholderTextColor={colors.fgMuted} multiline />
            <TouchableOpacity testID="confirm-meeting-btn" style={s.confirmBtn} onPress={addMeeting}>
              <Text style={s.confirmBtnText}>Add Meeting</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.fg, fontSize: fontSize.base, fontWeight: '600' },
  hero: { alignItems: 'center', paddingVertical: spacing.xxl },
  logoLarge: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.badgeBg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  logoLargeText: { color: colors.primary, fontSize: fontSize.xxxl, fontWeight: '700' },
  companyName: { color: colors.fg, fontSize: fontSize.xxl, fontWeight: '700', marginBottom: spacing.sm },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  heroMetaText: { color: colors.fgMuted, fontSize: fontSize.sm },
  statsRow: { flexDirection: 'row', backgroundColor: colors.bgSecondary, marginHorizontal: spacing.lg, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.fg, fontSize: fontSize.lg, fontWeight: '700' },
  statLabel: { color: colors.fgMuted, fontSize: fontSize.xs, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: colors.border },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.lg },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: layout.buttonRadius, borderWidth: 1, borderColor: colors.border },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionBtnText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  linksRow: { flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm },
  linkText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '500' },
  tabBar: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { color: colors.fgMuted, fontSize: fontSize.sm, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sectionTitle: { color: colors.fgMuted, fontSize: fontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md },
  sectionText: { color: colors.fg, fontSize: fontSize.base },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.badgeBg, borderRadius: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { color: colors.badgeText, fontSize: fontSize.xs, fontWeight: '500' },
  personCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSecondary, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm },
  personAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgTertiary, justifyContent: 'center', alignItems: 'center' },
  personAvatarText: { color: colors.fg, fontSize: fontSize.base, fontWeight: '700' },
  personInfo: { flex: 1, marginLeft: spacing.md },
  personName: { color: colors.fg, fontSize: fontSize.base, fontWeight: '600' },
  personTitle: { color: colors.fgMuted, fontSize: fontSize.sm },
  personLink: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.fgMuted, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.xl },
  errorText: { color: colors.error, fontSize: fontSize.base, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bgSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xxl, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  modalTitle: { color: colors.fg, fontSize: fontSize.xl, fontWeight: '700' },
  fieldLabel: { color: colors.fgMuted, fontSize: fontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  modalInput: { backgroundColor: colors.bg, borderRadius: layout.buttonRadius, paddingHorizontal: spacing.md, height: 48, color: colors.fg, borderWidth: 1, borderColor: colors.border },
  slItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  slItemName: { color: colors.fg, fontSize: fontSize.base, fontWeight: '600' },
  slItemMeta: { color: colors.fgMuted, fontSize: fontSize.xs },
  expoOpt: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  expoOptActive: { backgroundColor: colors.badgeBg, marginHorizontal: -spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 4 },
  expoOptText: { color: colors.fg, fontSize: fontSize.sm },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: layout.buttonRadius, height: 48, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl },
  confirmBtnText: { color: '#fff', fontSize: fontSize.base, fontWeight: '600' },
});
