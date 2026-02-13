import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/api';
import { colors, fontSize, spacing, layout } from '../../src/theme';

export default function AdminScreen() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [tab, setTab] = useState<'upload' | 'users'>('upload');
  const [fileType, setFileType] = useState<'expos' | 'exhibitors'>('expos');

  useFocusEffect(useCallback(() => {
    if (tab === 'users') loadUsers();
  }, [tab]));

  const loadUsers = async () => {
    setLoadingUsers(true);
    try { setUsers(await api.getUsers()); } catch { }
    setLoadingUsers(false);
  };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'] });
      if (result.canceled || !result.assets?.[0]) return;
      setUploading(true);
      const file = result.assets[0];
      let content = '';
      if (file.uri) {
        content = await FileSystem.readAsStringAsync(file.uri);
      }
      if (!content) {
        Alert.alert('Error', 'Could not read file');
        setUploading(false);
        return;
      }
      const res = await api.uploadCSV(content, fileType);
      setUploadResult(res);
      Alert.alert('Success', `Uploaded ${res.count} ${fileType}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setUploading(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.updateUserRole(userId, newRole);
      loadUsers();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Admin Panel</Text>
        <View style={s.roleTag}>
          <Text style={s.roleText}>{user?.role || 'user'}</Text>
        </View>
      </View>

      <View style={s.tabBar}>
        <TouchableOpacity testID="admin-upload-tab" style={[s.tabItem, tab === 'upload' && s.tabActive]} onPress={() => setTab('upload')}>
          <Text style={[s.tabText, tab === 'upload' && s.tabTextActive]}>CSV Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="admin-users-tab" style={[s.tabItem, tab === 'users' && s.tabActive]} onPress={() => setTab('users')}>
          <Text style={[s.tabText, tab === 'users' && s.tabTextActive]}>Users</Text>
        </TouchableOpacity>
      </View>

      {tab === 'upload' ? (
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.card}>
            <View style={s.cardIcon}><Feather name="upload-cloud" size={32} color={colors.primary} /></View>
            <Text style={s.cardTitle}>Upload CSV Data</Text>
            <Text style={s.cardDesc}>Import expo and exhibitor data from CSV files</Text>

            <Text style={s.fieldLabel}>Data Type</Text>
            <View style={s.typeRow}>
              <TouchableOpacity testID="type-expos" style={[s.typeBtn, fileType === 'expos' && s.typeBtnActive]} onPress={() => setFileType('expos')}>
                <Feather name="compass" size={16} color={fileType === 'expos' ? colors.primary : colors.fgMuted} />
                <Text style={[s.typeBtnText, fileType === 'expos' && { color: colors.primary }]}>Expos</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="type-exhibitors" style={[s.typeBtn, fileType === 'exhibitors' && s.typeBtnActive]} onPress={() => setFileType('exhibitors')}>
                <Feather name="users" size={16} color={fileType === 'exhibitors' ? colors.primary : colors.fgMuted} />
                <Text style={[s.typeBtnText, fileType === 'exhibitors' && { color: colors.primary }]}>Exhibitors</Text>
              </TouchableOpacity>
            </View>

            <View style={s.formatBox}>
              <Text style={s.formatTitle}>Expected CSV Format:</Text>
              {fileType === 'expos' ? (
                <Text style={s.formatText}>name, date, location</Text>
              ) : (
                <Text style={s.formatText}>expo_id, company, hq, industry, revenue, team_size, booth, linkedin, website, solutions, people_json</Text>
              )}
            </View>

            <TouchableOpacity testID="upload-csv-btn" style={[s.uploadBtn, uploading && s.btnDisabled]} onPress={handleUpload} disabled={uploading}>
              {uploading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Feather name="upload" size={18} color="#fff" />
                  <Text style={s.uploadBtnText}>Select & Upload CSV</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {uploadResult && (
            <View style={s.resultCard}>
              <View style={s.resultHeader}>
                <Feather name="check-circle" size={20} color={colors.success} />
                <Text style={s.resultTitle}>Upload Successful</Text>
              </View>
              <Text style={s.resultText}>Records uploaded: {uploadResult.count}</Text>
              {uploadResult.preview?.length > 0 && (
                <>
                  <Text style={s.previewTitle}>Preview (first {uploadResult.preview.length}):</Text>
                  {uploadResult.preview.map((item: any, idx: number) => (
                    <View key={idx} style={s.previewItem}>
                      <Text style={s.previewText}>{item.company || item.name || JSON.stringify(item).substring(0, 60)}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={s.usersContainer}>
          {loadingUsers ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
          ) : (
            <FlatList
              data={users}
              keyExtractor={item => item.id}
              contentContainerStyle={s.usersList}
              renderItem={({ item }) => (
                <View style={s.userCard} testID={`user-${item.id}`}>
                  <View style={s.userAvatar}>
                    <Text style={s.avatarText}>{(item.name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={s.userInfo}>
                    <Text style={s.userName}>{item.name}</Text>
                    <Text style={s.userEmail}>{item.email}</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.roleBadge, item.role === 'admin' && s.adminBadge]}
                    onPress={() => handleRoleChange(item.id, item.role === 'admin' ? 'user' : 'admin')}
                  >
                    <Text style={[s.roleBadgeText, item.role === 'admin' && s.adminBadgeText]}>{item.role}</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={s.emptyText}>No users found</Text>}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.fg },
  roleTag: { backgroundColor: colors.badgeBg, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 4 },
  roleText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase' },
  tabBar: { flexDirection: 'row', marginHorizontal: spacing.lg, backgroundColor: colors.bgSecondary, borderRadius: layout.cardRadius, padding: 4, marginBottom: spacing.md },
  tabItem: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.fgMuted, fontSize: fontSize.sm, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: colors.bgSecondary, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: colors.border, padding: spacing.xxl, alignItems: 'center' },
  cardIcon: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.badgeBg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  cardTitle: { color: colors.fg, fontSize: fontSize.xl, fontWeight: '700', marginBottom: spacing.sm },
  cardDesc: { color: colors.fgMuted, fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.xxl },
  fieldLabel: { color: colors.fgMuted, fontSize: fontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, alignSelf: 'flex-start' },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl, width: '100%' },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: layout.buttonRadius, borderWidth: 1, borderColor: colors.border },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: colors.badgeBg },
  typeBtnText: { color: colors.fgMuted, fontSize: fontSize.sm, fontWeight: '600' },
  formatBox: { backgroundColor: colors.bg, borderRadius: layout.buttonRadius, padding: spacing.md, width: '100%', marginBottom: spacing.xl },
  formatTitle: { color: colors.fgMuted, fontSize: fontSize.xs, fontWeight: '600', marginBottom: spacing.xs },
  formatText: { color: colors.fg, fontSize: fontSize.xs, fontFamily: 'System' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: layout.buttonRadius, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl },
  btnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: '#fff', fontSize: fontSize.base, fontWeight: '600' },
  resultCard: { backgroundColor: colors.bgSecondary, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: colors.success + '44', padding: spacing.lg, marginTop: spacing.lg },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  resultTitle: { color: colors.success, fontSize: fontSize.base, fontWeight: '700' },
  resultText: { color: colors.fg, fontSize: fontSize.sm },
  previewTitle: { color: colors.fgMuted, fontSize: fontSize.xs, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.sm },
  previewItem: { backgroundColor: colors.bg, borderRadius: 4, padding: spacing.sm, marginBottom: spacing.xs },
  previewText: { color: colors.fg, fontSize: fontSize.xs },
  usersContainer: { flex: 1 },
  usersList: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSecondary, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.badgeBg, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: colors.primary, fontSize: fontSize.base, fontWeight: '700' },
  userInfo: { flex: 1, marginLeft: spacing.md },
  userName: { color: colors.fg, fontSize: fontSize.sm, fontWeight: '600' },
  userEmail: { color: colors.fgMuted, fontSize: fontSize.xs },
  roleBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  adminBadge: { backgroundColor: colors.badgeBg, borderColor: colors.primary },
  roleBadgeText: { color: colors.fgMuted, fontSize: fontSize.xs, fontWeight: '600' },
  adminBadgeText: { color: colors.primary },
  emptyText: { color: colors.fgMuted, fontSize: fontSize.sm, textAlign: 'center', marginTop: 40 },
});
