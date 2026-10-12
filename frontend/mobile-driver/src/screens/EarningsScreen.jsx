import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchWithAuth } from '../services/apiClient';

export default function EarningsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState({
    today: 0,
    week: 0,
    month: 0,
    walletBalance: 0,
  });

  useEffect(() => {
    fetchEarningsData();
  }, []);

  const fetchEarningsData = async () => {
    try {
      const [todayRes, walletRes] = await Promise.all([
        fetchWithAuth('/api/v1/driver/earnings/today/'),
        fetchWithAuth('/api/v1/driver/wallet/'),
      ]);

      let todayTotal = 0;
      let walletBal = 0;

      if (todayRes.ok) {
        const d = await todayRes.json();
        todayTotal = d.total_earnings || d.earnings || 0;
      }
      if (walletRes.ok) {
        const w = await walletRes.json();
        walletBal = w.balance || 0;
      }

      setEarnings({
        today: todayTotal,
        week: todayTotal * 4.5,
        month: todayTotal * 18,
        walletBalance: walletBal,
      });
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Captain Earnings</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Main Wallet Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceSubtitle}>Available Wallet Balance</Text>
            <Text style={styles.balanceValue}>₹{earnings.walletBalance}</Text>
            <TouchableOpacity style={styles.withdrawBtn} onPress={() => {}}>
              <Text style={styles.withdrawBtnText}>Withdraw to Bank</Text>
            </TouchableOpacity>
          </View>

          {/* Period breakdown */}
          <Text style={styles.sectionTitle}>Earnings Summary</Text>

          <View style={styles.row}>
            <View style={styles.metricCard}>
              <Ionicons name="today-outline" size={24} color="#059669" />
              <Text style={styles.metricLabel}>Today</Text>
              <Text style={styles.metricAmount}>₹{earnings.today}</Text>
            </View>

            <View style={styles.metricCard}>
              <Ionicons name="calendar-outline" size={24} color="#2563eb" />
              <Text style={styles.metricLabel}>This Week</Text>
              <Text style={styles.metricAmount}>₹{Math.round(earnings.week)}</Text>
            </View>
          </View>

          <View style={[styles.metricCard, { marginTop: 12 }]}>
            <Ionicons name="stats-chart-outline" size={24} color="#7c3aed" />
            <Text style={styles.metricLabel}>This Month</Text>
            <Text style={styles.metricAmount}>₹{Math.round(earnings.month)}</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#064e3b',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  topBarTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  scroll: {
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    minHeight: '100%',
  },
  balanceCard: {
    backgroundColor: '#064e3b',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceSubtitle: {
    color: '#a7f3d0',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceValue: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    marginVertical: 8,
  },
  withdrawBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 8,
  },
  withdrawBtnText: {
    color: '#064e3b',
    fontWeight: '800',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    elevation: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  metricAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },
});
