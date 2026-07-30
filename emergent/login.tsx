import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '@/src/theme';
import { api } from '@/src/api';

type Role = 'customer' | 'driver' | 'admin';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('customer');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setErr('');
    if (phone.trim().length < 8) { setErr('Enter a valid phone number'); return; }
    setLoading(true);
    try {
      const res = await api('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone: phone.trim(), role }) });
      router.push({ pathname: '/(auth)/verify', params: { phone: phone.trim(), role, name: name.trim(), devOtp: res.dev_otp } });
    } catch (e: any) {
      setErr(e.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const roles: { key: Role; label: string; icon: any }[] = [
    { key: 'customer', label: 'Customer', icon: 'account' },
    { key: 'driver', label: 'Driver', icon: 'steering' },
    { key: 'admin', label: 'Admin', icon: 'shield-crown' },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient colors={[theme.colors.brandPrimary, '#FF9F0A']} style={styles.hero}>
        <SafeAreaView edges={['top']}>
          <View style={styles.heroContent}>
            <MaterialCommunityIcons name="taxi" size={64} color="#000" />
            <Text style={styles.brand}>RideNow</Text>
            <Text style={styles.tagline}>Rides. Porter. Parcel.</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>Sign in with your phone number</Text>

          <Text style={styles.label}>I am a</Text>
          <View style={styles.roleRow}>
            {roles.map(r => (
              <Pressable
                key={r.key}
                testID={`role-${r.key}`}
                onPress={() => setRole(r.key)}
                style={[styles.roleBtn, role === r.key && styles.roleBtnActive]}
              >
                <MaterialCommunityIcons name={r.icon} size={22} color={role === r.key ? '#000' : theme.colors.onSurfaceTertiary} />
                <Text style={[styles.roleTxt, role === r.key && styles.roleTxtActive]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>

          {role !== 'admin' && (
            <>
              <Text style={styles.label}>Name (optional)</Text>
              <TextInput
                testID="name-input"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={theme.colors.onSurfaceTertiary}
                style={styles.input}
              />
            </>
          )}

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            testID="phone-input"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+91 98765 43210"
            placeholderTextColor={theme.colors.onSurfaceTertiary}
            style={styles.input}
          />
          {role === 'admin' && <Text style={styles.hint}>Admin phone: +919999999999</Text>}

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <Pressable testID="send-otp-btn" onPress={send} disabled={loading} style={[styles.cta, loading && { opacity: 0.6 }]}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>Send OTP</Text>}
          </Pressable>

          <Text style={styles.mock}>Demo OTP: 123456</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  hero: { paddingBottom: theme.spacing.xl },
  heroContent: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xl, alignItems: 'flex-start' },
  brand: { fontSize: 36, fontWeight: '800', color: '#000', marginTop: theme.spacing.sm },
  tagline: { fontSize: 16, color: '#000', opacity: 0.7, marginTop: 4 },
  form: { padding: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.onSurface },
  subtitle: { fontSize: 14, color: theme.colors.onSurfaceTertiary, marginTop: 4, marginBottom: theme.spacing.xl },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurfaceSecondary, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  roleRow: { flexDirection: 'row', gap: theme.spacing.sm },
  roleBtn: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', gap: 4, backgroundColor: theme.colors.surfaceSecondary },
  roleBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  roleTxt: { fontSize: 12, color: theme.colors.onSurfaceTertiary, fontWeight: '600' },
  roleTxtActive: { color: '#000' },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.lg, paddingVertical: 14, fontSize: 16, color: theme.colors.onSurface, backgroundColor: theme.colors.surface },
  hint: { fontSize: 12, color: theme.colors.onSurfaceTertiary, marginTop: 6 },
  err: { color: theme.colors.error, marginTop: theme.spacing.md, fontSize: 13 },
  cta: { marginTop: theme.spacing.xl, backgroundColor: theme.colors.brandPrimary, paddingVertical: 16, borderRadius: theme.radius.md, alignItems: 'center' },
  ctaTxt: { color: '#000', fontSize: 16, fontWeight: '700' },
  mock: { textAlign: 'center', marginTop: theme.spacing.md, color: theme.colors.onSurfaceTertiary, fontSize: 12 },
});
