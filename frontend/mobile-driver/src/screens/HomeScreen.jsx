import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { fetchWithAuth } from '../services/apiClient';

export default function HomeScreen({ navigation }) {
  const [driver, setDriver] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [earningsToday, setEarningsToday] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    loadDriverData();
    fetchCurrentRide();
    fetchEarnings();

    // Start background polling for requests
    pollTimerRef.current = setInterval(() => {
      fetchCurrentRide();
      if (isOnline) {
        fetchIncomingRequests();
      }
    }, 4000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOnline]);

  const loadDriverData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('raahgo_driver_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        setDriver(u.driver || u.user || u);
      }
    } catch (e) {}
  };

  const fetchEarnings = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/driver/earnings/today/');
      if (res.ok) {
        const data = await res.json();
        setEarningsToday(data.total_earnings || data.earnings || 0);
      }
    } catch (e) {}
  };

  const fetchCurrentRide = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/driver/rides/current/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.ride && data.ride.id) {
          setActiveRide(data.ride);
        } else if (data && data.id) {
          setActiveRide(data);
        } else {
          setActiveRide(null);
        }
      }
    } catch (e) {}
  };

  const fetchIncomingRequests = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/driver/rides/requests/');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.requests || [];
        setIncomingRequests(list);
      }
    } catch (e) {}
  };

  const toggleDutyStatus = async () => {
    const nextStatus = !isOnline;
    setLoadingStatus(true);
    const endpoint = nextStatus
      ? '/api/v1/driver/status/online/'
      : '/api/v1/driver/status/offline/';

    try {
      const res = await fetchWithAuth(endpoint, { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setIsOnline(nextStatus);
        Alert.alert('Duty Status', nextStatus ? 'You are now Online & ready for rides' : 'You are now Offline');
      } else {
        Alert.alert('Status Error', data.error || data.detail || 'Could not update status');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Failed to toggle online status');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleAcceptRide = async (rideId) => {
    try {
      const res = await fetchWithAuth(`/api/v1/driver/rides/${rideId}/accept/`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        Alert.alert('Accepted', 'Ride assigned successfully!');
        setIncomingRequests([]);
        fetchCurrentRide();
        navigation.navigate('ActiveRide', { rideId });
      } else {
        Alert.alert('Accept Failed', data.error || data.detail || 'Could not accept ride');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to accept ride');
    }
  };

  const handleRejectRide = async (rideId) => {
    try {
      await fetchWithAuth(`/api/v1/driver/rides/${rideId}/reject/`, {
        method: 'POST',
      });
      setIncomingRequests((prev) => prev.filter((r) => (r.id || r.ride_id) !== rideId));
    } catch (err) {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchEarnings(), fetchCurrentRide(), isOnline && fetchIncomingRequests()]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Captain Portal</Text>
          <Text style={styles.driverName}>
            {driver?.first_name ? `${driver.first_name} ${driver.last_name || ''}` : 'RaahGo Captain'}
          </Text>
        </View>

        <View style={styles.dutyContainer}>
          <Text style={[styles.dutyText, isOnline ? styles.textOnline : styles.textOffline]}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
          {loadingStatus ? (
            <ActivityIndicator size="small" color="#059669" />
          ) : (
            <Switch
              value={isOnline}
              onValueChange={toggleDutyStatus}
              trackColor={{ false: '#d1d5db', true: '#a7f3d0' }}
              thumbColor={isOnline ? '#059669' : '#f3f4f6'}
            />
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Active Ride Banner */}
        {activeRide && (
          <TouchableOpacity
            style={styles.activeRideCard}
            onPress={() => navigation.navigate('ActiveRide', { rideId: activeRide.id })}
          >
            <View style={styles.activeRideBadge}>
              <Ionicons name="navigate-circle" size={24} color="#ffffff" />
              <Text style={styles.activeRideBadgeText}>ACTIVE TRIP IN PROGRESS</Text>
            </View>
            <Text style={styles.activeRideInfo}>
              Customer: {activeRide.customer_name || 'Passenger'}
            </Text>
            <Text style={styles.activeRideAction}>Tap to view trip & directions →</Text>
          </TouchableOpacity>
        )}

        {/* Quick Metrics */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="wallet-outline" size={22} color="#059669" />
            <Text style={styles.statLabel}>Today's Earnings</Text>
            <Text style={styles.statValue}>₹{earningsToday}</Text>
          </View>

          <View style={styles.statBox}>
            <Ionicons name="star" size={22} color="#f59e0b" />
            <Text style={styles.statLabel}>Rating</Text>
            <Text style={styles.statValue}>4.9 ★</Text>
          </View>
        </View>

        {/* Incoming Requests */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {isOnline ? 'Nearby Ride Requests' : 'You Are Offline'}
          </Text>
          {isOnline && <Text style={styles.liveIndicator}>● Live searching</Text>}
        </View>

        {!isOnline ? (
          <View style={styles.offlinePlaceholder}>
            <Ionicons name="moon-outline" size={48} color="#9ca3af" />
            <Text style={styles.placeholderTitle}>Go Online to Receive Rides</Text>
            <Text style={styles.placeholderSub}>
              Switch your status toggle at top right to start receiving ride requests in your area.
            </Text>
          </View>
        ) : incomingRequests.length === 0 ? (
          <View style={styles.waitingCard}>
            <ActivityIndicator size="small" color="#059669" style={{ marginBottom: 12 }} />
            <Text style={styles.waitingText}>Listening for ride requests nearby...</Text>
          </View>
        ) : (
          incomingRequests.map((req) => {
            const id = req.id || req.ride_id;
            return (
              <View key={id} style={styles.requestCard}>
                <View style={styles.reqTop}>
                  <View style={styles.fareBadge}>
                    <Text style={styles.fareText}>₹{req.fare || req.estimated_fare || '150'}</Text>
                  </View>
                  <Text style={styles.vehicleBadge}>{req.vehicle_type || 'Ride'}</Text>
                </View>

                <View style={styles.locationRow}>
                  <Ionicons name="radio-button-on" size={16} color="#059669" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {req.pickup_address || 'Pickup Point'}
                  </Text>
                </View>

                <View style={styles.locationRow}>
                  <Ionicons name="location" size={16} color="#ef4444" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {req.dropoff_address || 'Destination Point'}
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleRejectRide(id)}
                  >
                    <Text style={styles.rejectBtnText}>Decline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn]}
                    onPress={() => handleAcceptRide(id)}
                  >
                    <Text style={styles.acceptBtnText}>Accept Ride</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Ionicons name="speedometer" size={24} color="#059669" />
          <Text style={[styles.navLabel, { color: '#059669' }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Earnings')}
        >
          <Ionicons name="cash-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Earnings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons name="person-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  greeting: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  driverName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  dutyContainer: {
    alignItems: 'center',
  },
  dutyText: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  textOnline: {
    color: '#059669',
  },
  textOffline: {
    color: '#9ca3af',
  },
  scroll: {
    padding: 16,
    paddingBottom: 80,
  },
  activeRideCard: {
    backgroundColor: '#064e3b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 4,
  },
  activeRideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeRideBadgeText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 8,
  },
  activeRideInfo: {
    color: '#ecfdf5',
    fontSize: 15,
    marginBottom: 6,
  },
  activeRideAction: {
    color: '#a7f3d0',
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  liveIndicator: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  offlinePlaceholder: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    elevation: 1,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
  },
  placeholderSub: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
  },
  waitingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  waitingText: {
    color: '#6b7280',
    fontSize: 14,
  },
  requestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  reqTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fareBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fareText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#064e3b',
  },
  vehicleBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtn: {
    backgroundColor: '#fee2e2',
  },
  rejectBtnText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  acceptBtn: {
    backgroundColor: '#059669',
  },
  acceptBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    height: 65,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 2,
  },
});
