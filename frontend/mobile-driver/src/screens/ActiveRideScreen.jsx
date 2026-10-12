import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  SafeAreaView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchWithAuth } from '../services/apiClient';

export default function ActiveRideScreen({ route, navigation }) {
  const { rideId } = route.params || {};
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startOtp, setStartOtp] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchRideDetail();
    const interval = setInterval(fetchRideDetail, 5000);
    return () => clearInterval(interval);
  }, [rideId]);

  const fetchRideDetail = async () => {
    try {
      const endpoint = rideId
        ? `/api/v1/driver/rides/${rideId}/`
        : `/api/v1/driver/rides/current/`;
      const res = await fetchWithAuth(endpoint);
      if (res.ok) {
        const data = await res.json();
        setRide(data.ride || data);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const handleArrived = async () => {
    if (!ride?.id) return;
    setActionLoading(true);
    try {
      const res = await fetchWithAuth(`/api/v1/driver/rides/${ride.id}/arrived/`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Arrived', 'Passenger has been notified that you have arrived!');
        fetchRideDetail();
      } else {
        Alert.alert('Error', data.error || 'Failed to update status');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartTrip = async () => {
    if (!ride?.id) return;
    if (!startOtp.trim()) {
      Alert.alert('OTP Required', 'Please enter the 4-digit ride OTP provided by the passenger');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetchWithAuth(`/api/v1/driver/rides/${ride.id}/start/`, {
        method: 'POST',
        body: JSON.stringify({ otp: startOtp.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Ride Started', 'Have a safe trip with the passenger!');
        fetchRideDetail();
      } else {
        Alert.alert('Start Failed', data.error || data.detail || 'Invalid ride OTP');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTrip = async () => {
    if (!ride?.id) return;
    Alert.alert(
      'Complete Trip',
      `Collect ₹${ride.fare || ride.estimated_fare || '0'} from passenger and end ride?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Complete',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await fetchWithAuth(`/api/v1/driver/rides/${ride.id}/complete/`, {
                method: 'POST',
              });
              const data = await res.json();
              if (res.ok) {
                Alert.alert('Trip Completed', 'Great job captain! Payment collected.');
                navigation.navigate('Home');
              } else {
                Alert.alert('Error', data.error || 'Could not complete trip');
              }
            } catch (err) {
              Alert.alert('Error', 'Network error');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const callPassenger = () => {
    if (ride?.customer_phone) {
      Linking.openURL(`tel:${ride.customer_phone}`);
    } else {
      Alert.alert('Notice', 'Passenger phone number not available');
    }
  };

  const openNavigationMap = () => {
    const lat = ride?.dropoff_latitude || ride?.pickup_latitude || 28.4415;
    const lng = ride?.dropoff_longitude || ride?.pickup_longitude || 77.0395;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-done-circle" size={64} color="#059669" />
        <Text style={styles.emptyTitle}>No Active Trip</Text>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backHomeText}>Return to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rideStatus = ride.status || 'accepted';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Active Trip</Text>
        <TouchableOpacity onPress={openNavigationMap}>
          <Ionicons name="navigate" size={24} color="#34d399" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status Tracker */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>STATUS</Text>
          <Text style={styles.statusValue}>{rideStatus.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.fareHighlight}>Fare: ₹{ride.fare || ride.estimated_fare || '0'}</Text>
        </View>

        {/* Customer Card */}
        <View style={styles.card}>
          <View style={styles.customerRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color="#059669" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.custName}>{ride.customer_name || 'Passenger'}</Text>
              <Text style={styles.custSub}>Payment: {ride.payment_method || 'Cash'}</Text>
            </View>
            <TouchableOpacity style={styles.callBtn} onPress={callPassenger}>
              <Ionicons name="call" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Locations */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Route Details</Text>
          <View style={styles.routeItem}>
            <Ionicons name="radio-button-on" size={18} color="#059669" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.locType}>PICKUP</Text>
              <Text style={styles.locDesc}>{ride.pickup_address || 'Pickup Location'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.routeItem}>
            <Ionicons name="location" size={18} color="#ef4444" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.locType}>DROP-OFF</Text>
              <Text style={styles.locDesc}>{ride.dropoff_address || 'Drop-off Destination'}</Text>
            </View>
          </View>
        </View>

        {/* Action Flow based on Status */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Trip Actions</Text>

          {rideStatus === 'accepted' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.arrivedBtn]}
              onPress={handleArrived}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>✓ I Have Arrived</Text>
              )}
            </TouchableOpacity>
          )}

          {(rideStatus === 'arrived' || rideStatus === 'driver_arrived') && (
            <View>
              <Text style={styles.otpLabel}>Ask passenger for 4-digit ride OTP:</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="4-digit OTP"
                value={startOtp}
                onChangeText={setStartOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                style={[styles.actionBtn, styles.startBtn]}
                onPress={handleStartTrip}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>▶ Start Trip</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {(rideStatus === 'in_progress' || rideStatus === 'started' || rideStatus === 'ongoing') && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.completeBtn]}
              onPress={handleCompleteTrip}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>🏁 End Trip & Collect Cash</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#064e3b',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginTop: 12,
  },
  backHomeBtn: {
    marginTop: 20,
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backHomeText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#064e3b',
  },
  topBarTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  scroll: {
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    minHeight: '100%',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
  },
  statusValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#059669',
    marginVertical: 4,
  },
  fareHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  custName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  custSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  callBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locType: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9ca3af',
  },
  locDesc: {
    fontSize: 14,
    color: '#1f2937',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 12,
  },
  actionBtn: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrivedBtn: {
    backgroundColor: '#2563eb',
  },
  startBtn: {
    backgroundColor: '#059669',
    marginTop: 10,
  },
  completeBtn: {
    backgroundColor: '#064e3b',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  otpLabel: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 8,
  },
  otpInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    height: 48,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    color: '#111827',
  },
});
