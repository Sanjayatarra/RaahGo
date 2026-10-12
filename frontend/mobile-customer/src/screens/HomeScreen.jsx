import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { fetchCustomerWithAuth } from '../services/apiClient';

export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [pickup, setPickup] = useState('Current Location (Gurugram)');
  const [destination, setDestination] = useState('');
  const [activeRide, setActiveRide] = useState(null);

  useEffect(() => {
    loadUserData();
    checkActiveRide();
    const interval = setInterval(checkActiveRide, 8000);
    return () => clearInterval(interval);
  }, []);

  const loadUserData = async () => {
    try {
      const uStr = await AsyncStorage.getItem('raahgo_customer_user');
      if (uStr) {
        const u = JSON.parse(uStr);
        setUser(u.user || u.customer || u);
      }
    } catch (e) {}
  };

  const checkActiveRide = async () => {
    try {
      const res = await fetchCustomerWithAuth('/api/v1/customer/rides/current/');
      if (res.ok) {
        const data = await res.json();
        if (data && (data.id || data.ride?.id)) {
          setActiveRide(data.ride || data);
        } else {
          setActiveRide(null);
        }
      }
    } catch (e) {}
  };

  const handleProceedBooking = () => {
    if (!destination.trim()) {
      Alert.alert('Destination Needed', 'Please enter where you want to go');
      return;
    }
    navigation.navigate('BookRide', {
      pickupText: pickup,
      destText: destination,
    });
  };

  const setPresetDestination = (placeName) => {
    setDestination(placeName);
    navigation.navigate('BookRide', {
      pickupText: pickup,
      destText: placeName,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.greetingText}>HELLO,</Text>
          <Text style={styles.userNameText}>
            {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'Passenger'}
          </Text>
        </View>

        <TouchableOpacity style={styles.coinsBadge} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="sparkles" size={16} color="#d97706" />
          <Text style={styles.coinsText}>120 Coins</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Active Ride Banner */}
        {activeRide && (
          <TouchableOpacity
            style={styles.activeRideCard}
            onPress={() => navigation.navigate('ActiveRide', { rideId: activeRide.id })}
          >
            <View style={styles.activeHeader}>
              <Ionicons name="car-sport" size={22} color="#ffffff" />
              <Text style={styles.activeTitle}>Trip in progress</Text>
            </View>
            <Text style={styles.activeSub}>
              Driver: {activeRide.driver_name || 'Assigned Driver'} • Tap to track live
            </Text>
          </TouchableOpacity>
        )}

        {/* Search / Booking Box */}
        <View style={styles.searchCard}>
          <Text style={styles.cardTitle}>Where are you going?</Text>

          <View style={styles.inputWrapper}>
            <Ionicons name="radio-button-on" size={16} color="#10b981" style={styles.iconPin} />
            <TextInput
              style={styles.input}
              placeholder="Pickup Location"
              value={pickup}
              onChangeText={setPickup}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="location" size={16} color="#ef4444" style={styles.iconPin} />
            <TextInput
              style={styles.input}
              placeholder="Enter destination address..."
              value={destination}
              onChangeText={setDestination}
              placeholderTextColor="#9ca3af"
            />
          </View>

          <TouchableOpacity style={styles.findRideBtn} onPress={handleProceedBooking}>
            <Text style={styles.findRideText}>Find Rides & Prices →</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Destinations */}
        <Text style={styles.sectionHeading}>Frequent Destinations</Text>
        <View style={styles.quickPlacesRow}>
          <TouchableOpacity
            style={styles.quickPlaceItem}
            onPress={() => setPresetDestination('Cyber City, DLF Phase 2')}
          >
            <Ionicons name="briefcase-outline" size={22} color="#2563eb" />
            <Text style={styles.quickPlaceText}>Work</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickPlaceItem}
            onPress={() => setPresetDestination('IGI Airport Terminal 3')}
          >
            <Ionicons name="airplane-outline" size={22} color="#059669" />
            <Text style={styles.quickPlaceText}>Airport</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickPlaceItem}
            onPress={() => setPresetDestination('Huda City Centre Metro')}
          >
            <Ionicons name="train-outline" size={22} color="#d97706" />
            <Text style={styles.quickPlaceText}>Metro</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickPlaceItem}
            onPress={() => setPresetDestination('Ambience Mall, NH-8')}
          >
            <Ionicons name="cart-outline" size={22} color="#7c3aed" />
            <Text style={styles.quickPlaceText}>Mall</Text>
          </TouchableOpacity>
        </View>

        {/* Available Ride Categories */}
        <Text style={styles.sectionHeading}>Ride Options in Your City</Text>

        <View style={styles.categoryCard}>
          <Ionicons name="bicycle" size={32} color="#2563eb" />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.catName}>RaahGo Bike</Text>
            <Text style={styles.catDesc}>Fastest way through traffic • Affordable</Text>
          </View>
          <Text style={styles.catFare}>from ₹35</Text>
        </View>

        <View style={styles.categoryCard}>
          <Ionicons name="car-outline" size={32} color="#059669" />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.catName}>RaahGo Auto</Text>
            <Text style={styles.catDesc}>Doorstep pickup • No bargaining</Text>
          </View>
          <Text style={styles.catFare}>from ₹60</Text>
        </View>

        <View style={styles.categoryCard}>
          <Ionicons name="car-sport" size={32} color="#7c3aed" />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.catName}>RaahGo Cab Prime</Text>
            <Text style={styles.catDesc}>Air conditioned comfort • Top drivers</Text>
          </View>
          <Text style={styles.catFare}>from ₹120</Text>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Ionicons name="home" size={24} color="#2563eb" />
          <Text style={[styles.navLabel, { color: '#2563eb' }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            if (activeRide) {
              navigation.navigate('ActiveRide', { rideId: activeRide.id });
            } else {
              Alert.alert('No Active Ride', 'Book a ride to track it live');
            }
          }}
        >
          <Ionicons name="compass-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Activity</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons name="person-outline" size={24} color="#6b7280" />
          <Text style={styles.navLabel}>Account</Text>
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  greetingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6b7280',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  coinsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  coinsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
    marginLeft: 6,
  },
  scroll: {
    padding: 16,
    paddingBottom: 85,
  },
  activeRideCard: {
    backgroundColor: '#1e3a8a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 8,
  },
  activeSub: {
    color: '#bfdbfe',
    fontSize: 13,
    marginTop: 6,
  },
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  iconPin: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: '#111827',
  },
  findRideBtn: {
    backgroundColor: '#2563eb',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  findRideText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  quickPlacesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickPlaceItem: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 4,
    elevation: 1,
  },
  quickPlaceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 6,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  catName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  catDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  catFare: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
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
