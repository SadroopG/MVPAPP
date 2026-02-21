import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, FlatList, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/api';

const C = { bg: '#0f172a', card: '#1e293b', card2: '#334155', border: 'rgba(255,255,255,0.08)', blue: '#3b82f6', blueDim: 'rgba(59,130,246,0.15)',
  fg: '#f8fafc', muted: '#94a3b8', dim: '#64748b', success: '#10b981' };

export default function AdminScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'upload' | 'users'>('upload');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [expos, setExpos] = useState<any[]>([]);
  const [selExpo, setSelExpo] = useState('');
  const [showExpoModal, setShowExpoModal] = useState(false);

  useFocusEffect(useCallback(() => {
    api.getExpos().then(setExpos).catch(() => {});
    if (tab === 'users') loadUsers();
  }, [tab]));

  const loadUsers = async () => {
    setLoadingUsers(true);
    try { setUsers(await api.getUsers()); } catch { }
    setLoadingUsers(false);
  };

  const handleUpload = async () => {
    if (!selExpo) { Alert.alert('Select Expo', 'Please select which expo to import data into'); return; }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', '*/*'] });
      if (res.canceled || !res.assets?.[0]) return;
      setUploading(true);
      const content = await FileSystem.readAsStringAsync(res.assets[0].uri);
      if (!content) { Alert.alert('Error', 'Could not read file'); setUploading(false); return; }
      const r = await api.uploadCSV(content, selExpo);
      setResult(r);
      Alert.alert('Success', `Uploaded ${r.count} companies`);
    } catch (e: any) { Alert.alert('Error', e.message); }
    setUploading(false);
  };

  const expoName = expos.find(e => e.id === selExpo)?.name || 'Select expo...';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Admin Panel</Text>
        <View style={s.roleBadge}><Text style={s.roleText}>{user?.role}</Text></View>
      </View>

      <View style={s.tabBar}>
        <TouchableOpacity testID="admin-upload-tab" style={[s.tabItem, tab === 'upload' && s.tabOn]} onPress={() => setTab('upload')}>
          <Feather name="upload" size={15} color={tab === 'upload' ? '#fff' : C.dim} />
          <Text style={[s.tabText, tab === 'upload' && s.tabTextOn]}>CSV Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="admin-users-tab" style={[s.tabItem, tab === 'users' && s.tabOn]} onPress={() => setTab('users')}>
          <Feather name="users" size={15} color={tab === 'users' ? '#fff' : C.dim} />
          <Text style={[s.tabText, tab === 'users' && s.tabTextOn]}>Users</Text>
        </TouchableOpacity>
      </View>

      {tab === 'upload' ? (
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.uploadCard}>
            <View style={s.cardIcon}><Feather name="upload-cloud" size={36} color={C.blue} /></View>
            <Text style={s.cardTitle}>Import Companies</Text>
            <Text style={s.cardDesc}>Upload CSV with exhibitor data for an expo</Text>

            <TouchableOpacity testID="select-expo-btn" style={s.expoSelector} onPress={() => setShowExpoModal(true)}>
              <Feather name="compass" size={16} color={C.blue} />
              <Text style={s.expoSelectorText}>{expoName}</Text>
              <Feather name="chevron-down" size={16} color={C.dim} />
            </TouchableOpacity>

            <View style={s.formatBox}>
              <Text style={s.formatTitle}>CSV Format</Text>
              <Text style={s.formatText}>name, HQ, revenue, booth, industry, contacts</Text>
              <Text style={s.formatHint}>contacts: JSON array [{'"'}name{'"'}: {'"'}...{'"'}, {'"'}role{'"'}: {'"'}...{'"'}]</Text>
            </View>

            <TouchableOpacity testID="upload-csv-btn" style={[s.uploadBtn, uploading && { opacity: 0.6 }]} onPress={handleUpload} disabled={uploading}>
              {uploading ? <ActivityIndicator color="#fff" /> : (
                <><Feather name="upload" size={16} color="#fff" /><Text style={s.uploadBtnText}>Choose & Upload CSV</Text></>
              )}
            </TouchableOpacity>
          </View>

          {result && (
            <View style={s.resultCard}>
              <View style={s.resultHead}><Feather name="check-circle" size={18} color={C.success} /><Text style={s.resultTitle}>Upload Complete</Text></View>
              <Text style={s.resultText}>{result.count} companies imported</Text>
              {result.preview?.map((p: any, i: number) => (
                <View key={i} style={s.previewRow}><Text style={s.previewText}>{p.name} — {p.hq}</Text></View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {loadingUsers ? <ActivityIndicator style={{ marginTop: 40 }} color={C.blue} size="large" /> : (
            <FlatList data={users} keyExtractor={i => i.id} contentContainerStyle={s.usersList}
              renderItem={({ item }) => (
                <View style={s.userRow} testID={`user-${item.id}`}>
                  <View style={s.userAvatar}><Text style={s.avatarText}>{(item.name || '?')[0].toUpperCase()}</Text></View>
                  <View style={s.userInfo}><Text style={s.userName}>{item.name}</Text><Text style={s.userEmail}>{item.email}</Text></View>
                  <View style={[s.userRole, item.role === 'admin' && s.adminRole]}>
                    <Text style={[s.userRoleText, item.role === 'admin' && s.adminRoleText]}>{item.role}</Text>
                  </View>
                </View>
              )} />
          )}
        </View>
      )}

      <Modal visible={showExpoModal} transparent animationType="slide">
        <View style={s.modalBg}><View style={s.modalBox}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Select Expo</Text>
            <TouchableOpacity onPress={() => setShowExpoModal(false)}><Feather name="x" size={22} color={C.fg} /></TouchableOpacity></View>
          {expos.map(e => (
            <TouchableOpacity key={e.id} style={[s.expoItem, selExpo === e.id && s.expoItemOn]}
              onPress={() => { setSelExpo(e.id); setShowExpoModal(false); }}>
              <Text style={s.expoItemName}>{e.name}</Text>
              <Text style={s.expoItemMeta}>{e.region} · {e.date}</Text>
            </TouchableOpacity>
          ))}
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: '700', color: C.fg, letterSpacing: -0.5 },
  roleBadge: { backgroundColor: C.blueDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  roleText: { color: C.blue, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  tabBar: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: C.card, borderRadius: 10, padding: 4, marginBottom: 16 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  tabOn: { backgroundColor: C.blue },
  tabText: { color: C.dim, fontSize: 13, fontWeight: '600' },
  tabTextOn: { color: '#fff' },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  uploadCard: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 24, alignItems: 'center' },
  cardIcon: { width: 72, height: 72, borderRadius: 18, backgroundColor: C.blueDim, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  cardTitle: { color: C.fg, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  cardDesc: { color: C.muted, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  expoSelector: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  expoSelectorText: { flex: 1, color: C.fg, fontSize: 14, fontWeight: '500' },
  formatBox: { backgroundColor: C.bg, borderRadius: 8, padding: 14, width: '100%', marginBottom: 20 },
  formatTitle: { color: C.dim, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  formatText: { color: C.fg, fontSize: 13, fontFamily: 'System' },
  formatHint: { color: C.dim, fontSize: 11, marginTop: 6 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.blue, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 24 },
  uploadBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  resultCard: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.success + '44', padding: 16, marginTop: 16 },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  resultTitle: { color: C.success, fontSize: 15, fontWeight: '700' },
  resultText: { color: C.fg, fontSize: 13, marginBottom: 8 },
  previewRow: { backgroundColor: C.bg, borderRadius: 4, padding: 8, marginBottom: 4 },
  previewText: { color: C.muted, fontSize: 12 },
  usersList: { paddingHorizontal: 16, paddingBottom: 100 },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 8 },
  userAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card2, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: C.blue, fontSize: 15, fontWeight: '700' },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { color: C.fg, fontSize: 14, fontWeight: '600' },
  userEmail: { color: C.dim, fontSize: 12 },
  userRole: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: C.border },
  adminRole: { backgroundColor: C.blueDim, borderColor: C.blue + '44' },
  userRoleText: { color: C.dim, fontSize: 11, fontWeight: '600' },
  adminRoleText: { color: C.blue },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: C.fg, fontSize: 18, fontWeight: '700' },
  expoItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  expoItemOn: { backgroundColor: C.blueDim, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 6 },
  expoItemName: { color: C.fg, fontSize: 15, fontWeight: '600' },
  expoItemMeta: { color: C.dim, fontSize: 12, marginTop: 2 },
});
