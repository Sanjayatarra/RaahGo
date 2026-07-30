import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api, saveToken } from '@/src/api';
import { useAuth } from '@/src/auth';

export default function Verify() {
  const params = useLocalSearchParams<{ phone: string; role: string; name?: string; devOtp?: string }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const { refresh } = useAuth();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 300); }, []);

  const verify = async () => {
    setErr('');
    if (otp.trim().length !== 6) { setErr('Enter 6-digit OTP'); return; }
    setLoading(true);
    try {
      const res = await api('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: params.phone, otp: otp.trim(), name: params.name || undefined }),
      });
      await saveToken(res.access_token);
      await refresh();
      const role = res.user?.role;
      if (role === 'driver') router.replace('/(driver)/dashboard');
      else if (role === 'admin') router.replace('/(admin)/dashboard');
      else router.replace('/(customer)/home');
    } catch (e: any) {
      setErr(e.message || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Pressable testID="back-btn" onPress={() => router.back()} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={26} color={theme.colors.onSurface} />
      </Pressable>
      <View style={styles.body}>
        <MaterialCommunityIcons name="message-lock" size={56} color={theme.colors.brandPrimary} />
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.sub}>Sent to {params.phone}</Text>

        <TextInput
          testID="otp-input"
          ref={inputRef}
          value={otp}
          onChangeText={t => setOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="123456"
          placeholderTextColor={theme.colors.onSurfaceTertiary}
          style={styles.otp}
          maxLength={6}
        />
        {params.devOtp ? <Text style={styles.hint}>Dev OTP: {params.devOtp}</Text> : null}
        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Pressable testID="verify-btn" onPress={verify} disabled={loading} style={[styles.cta, loading && { opacity: 0.6 }]}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>Verify & Continue</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}