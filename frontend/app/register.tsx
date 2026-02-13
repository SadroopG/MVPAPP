import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, fontSize, spacing, layout } from '../src/theme';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password) { setError('Please fill in all fields'); return; }
    if (password.length < 4) { setError('Password must be at least 4 characters'); return; }
    setError('');
    setLoading(true);
    try {
      await register(email, password, name);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <View style={s.iconWrap}>
              <Feather name="user-plus" size={32} color={colors.primary} />
            </View>
            <Text style={s.title}>Create Account</Text>
            <Text style={s.subtitle}>Join Expo Intel to start managing expos</Text>
          </View>

          {error ? <View style={s.errorBox}><Feather name="alert-circle" size={16} color={colors.error} /><Text style={s.errorText}>{error}</Text></View> : null}

          <View style={s.field}>
            <Text style={s.label}>Full Name</Text>
            <View style={s.inputWrap}>
              <Feather name="user" size={18} color={colors.fgMuted} style={s.inputIcon} />
              <TextInput testID="register-name-input" style={s.input} value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor={colors.fgMuted} />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <View style={s.inputWrap}>
              <Feather name="mail" size={18} color={colors.fgMuted} style={s.inputIcon} />
              <TextInput testID="register-email-input" style={s.input} value={email} onChangeText={setEmail} placeholder="you@company.com" placeholderTextColor={colors.fgMuted} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Password</Text>
            <View style={s.inputWrap}>
              <Feather name="lock" size={18} color={colors.fgMuted} style={s.inputIcon} />
              <TextInput testID="register-password-input" style={s.input} value={password} onChangeText={setPassword} placeholder="Min 4 characters" placeholderTextColor={colors.fgMuted} secureTextEntry />
            </View>
          </View>

          <TouchableOpacity testID="register-submit-btn" style={[s.btn, loading && s.btnDisabled]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Account</Text>}
          </TouchableOpacity>

          <View style={s.footer}>
            <Text style={s.footerText}>Already have an account? </Text>
            <TouchableOpacity testID="go-to-login-btn" onPress={() => router.back()}>
              <Text style={s.link}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.xxxl },
  iconWrap: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.badgeBg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  title: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.fg, letterSpacing: -0.8 },
  subtitle: { fontSize: fontSize.sm, color: colors.fgMuted, marginTop: spacing.sm },
  field: { marginBottom: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.fg, marginBottom: spacing.sm },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSecondary, borderRadius: layout.buttonRadius, borderWidth: 1, borderColor: colors.border },
  inputIcon: { marginLeft: spacing.md },
  input: { flex: 1, height: layout.inputHeight, paddingHorizontal: spacing.md, color: colors.fg, fontSize: fontSize.base },
  btn: { backgroundColor: colors.primary, borderRadius: layout.buttonRadius, height: layout.inputHeight, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: fontSize.base, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.fgMuted, fontSize: fontSize.sm },
  link: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: layout.buttonRadius, padding: spacing.md, marginBottom: spacing.lg },
  errorText: { color: colors.error, fontSize: fontSize.sm, marginLeft: spacing.sm },
});
