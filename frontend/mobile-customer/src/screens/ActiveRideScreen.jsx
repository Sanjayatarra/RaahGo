import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchCustomerWithAuth } from '../services/apiClient';

export default function ActiveRideScreen({ route, navigation }) {
  const { rideId } = route.params || {};
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRideData();
    const interval = setInterval(fetchRideData, 4000);
    return () => clearInterval(interval);
  }, [rideId]);

  const fetchRideData = async () => {
    try {
      const endpoint = rideId
        ? `/api/v1/customer/rides/${rideId}/`
        : `/api/v1/customer/rides/current/`;
      const res = await fetchCustomerWithAuth(endpoint);
      if (res.ok) {
        const data = await res.json();
        setRide(data.ride || data);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride request?',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: async () => {
            if (!ride?.id) return;
            try {
              const res = await fetchCustomerWithAuth(`/api/v1/customer/rides/${ride.id}/cancel/`, {
                method: 'POST',
                body: JSON.stringify({ reason: 'Changed mind' }),
              });
              if (res.ok) {
                Alert.alert('Cancelled', 'Your ride has been cancelled.');
                navigation.navigate('Home');
              } else {
                Alert.alert('Error', 'Could not cancel ride');
              }
            } catch (e) {
              Alert.alert('Error', 'Network error');
            }
          },
        },
      ]
    );
  };

  const handleTriggerSos = async () => {
    Alert.alert(
      'EMERGENCY SOS',
      'This will alert RaahGo Safety Response Team and share your live ride location. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'ACTIVATE SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetchCustomerWithAuth('/api/v1/customer/safety/sos/', {
                method: 'POST',
                body: JSON.stringify({ ride_id: ride?.id }),
              });
              Alert.alert('Emergency Alert Sent', 'Help has been dispatched.');
            } catch (e) {}
          },
        },
      ]
    );
  };

  const callDriver = () => {
    if (ride?.driver_phone) {
      Linking.openURL(`tel:${ride.driver_phone}`);
    } else {
      Alert.alert('Notice', 'Driver contact details will appear once assigned');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Connecting to ride...</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle-outline" size={64} color="#059669" />
        <Text style={styles.emptyTitle}>No Active Booking</Text>
        <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.homeBtnText}>Return to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rideOtp = ride.otp || ride.start_otp || '4821';
  const status = ride.status || 'searching';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Live Ride Tracking</Text>
        <TouchableOpacity onPress={handleTriggerSos}>
          <View style={styles.sosBadge}>
            <Text style={styles.sosText}>SOS</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* OTP Highlight Banner */}
        <View style={styles.otpCard}>
          <Text style={styles.otpLabel}>SHARE THIS OTP WITH YOUR CAPTAIN TO START RIDE</Text>
          <Text style={styles.otpValue}>{rideOtp}</Text>
          <Text style={styles.otpSub}>Do not share with anyone else</Text>
        </View>

        {/* Status Tracker */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.statusTitle}>
              {status === 'searching' || status === 'requested'
                ? 'Searching for nearby drivers...'
                : status === 'driver_arrived' || status === 'arrived'
                ? 'Captain has arrived at your pickup!'
                : status === 'in_progress' || status === 'started'
                ? 'Ride in progress'
                : 'Captain is on the way'}
            </Text>
          </View>
          <Text style={styles.fareText}>Estimated Fare: ₹{ride.fare || ride.estimated_fare || '100'}</Text>
        </View>

        {/* Driver Details Card */}
        <View style={styles.card}>
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Ionicons name="person" size={26} color="#2563eb" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.driverName}>{ride.driver_name || 'Captain Assigned'}</Text>
              <Text style={styles.driverVehicle}>
                {ride.vehicle_number || 'DL-01-AB-1234'} • {ride.vehicle_model || 'Vehicle'}
              </Text>
              <Text style={styles.driverRating}>★ 4.9 (520+ rides)</Text>
            </View>

            <TouchableOpacity style={styles.callBtn} onPress={callDriver}>
              <Ionicons name="call" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Route Details */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Trip Route</Text>
          <View style={styles.routeItem}>
            <Ionicons name="radio-button-on" size={16} color="#10b981" />
            <Text style={styles.routeDesc}>{ride.pickup_address || 'Pickup Point'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.routeItem}>
            <Ionicons name="location" size={16} color="#ef4444" />
            <Text style={styles.routeDesc}>{ride.dropoff_address || 'Drop-off Destination'}</Text>
          </View>
        </View>

        {/* Cancel Button */}
        {status !== 'in_progress' && status !== 'completed' && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelRide}>
            <Text style={styles.cancelBtnText}>Cancel Ride</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3a8a',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginTop: 12,
  },
  homeBtn: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  homeBtnText: {
    color: '#ffffff',
    fontWeight: '700',
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
  sosBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sosText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  scroll: {
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    minHeight: '100%',
  },
  otpCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#93c5fd',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  otpLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e40af',
    textAlign: 'center',
  },
  otpValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1e3a8a',
    letterSpacing: 8,
    marginVertical: 4,
  },
  otpSub: {
    fontSize: 12,
    color: '#6b7280',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
    marginRight: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  fareText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  driverVehicle: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '600',
    marginTop: 2,
  },
  driverRating: {
    fontSize: 12,
    color: '#d97706',
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
  cardHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6b7280',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDesc: {
    marginLeft: 10,
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 10,
  },
  cancelBtn: {
    backgroundColor: '#fee2e2',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  cancelBtnText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '700',
  },
});
