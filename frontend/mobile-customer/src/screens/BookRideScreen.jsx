import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchCustomerWithAuth } from '../services/apiClient';

export default function BookRideScreen({ route, navigation }) {
  const { pickupText = 'Current Location', destText = 'Destination' } = route.params || {};
  const [selectedVehicle, setSelectedVehicle] = useState('auto');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [fareEstimate, setFareEstimate] = useState(null);

  const vehicleOptions = [
    {
      id: 'bike',
      name: 'RaahGo Moto',
      eta: '3 mins',
      fare: 45,
      icon: 'bicycle',
      desc: 'Quick & affordable single seat',
    },
    {
      id: 'auto',
      name: 'RaahGo Auto',
      eta: '4 mins',
      fare: 85,
      icon: 'car-outline',
      desc: 'Doorstep 3-seater auto',
    },
    {
      id: 'cab_mini',
      name: 'RaahGo Mini',
      eta: '6 mins',
      fare: 160,
      icon: 'car',
      desc: 'Comfy AC hatchback (4 seats)',
    },
    {
      id: 'cab_sedan',
      name: 'RaahGo Sedan',
      eta: '8 mins',
      fare: 220,
      icon: 'car-sport',
      desc: 'Spacious sedan with trunk space',
    },
  ];

  useEffect(() => {
    fetchFares();
  }, []);

  const fetchFares = async () => {
    try {
      const res = await fetchCustomerWithAuth(
        `/api/v1/customer/rides/fare-estimate/?pickup_address=${encodeURIComponent(pickupText)}&dropoff_address=${encodeURIComponent(destText)}`
      );
      if (res.ok) {
        const data = await res.json();
        setFareEstimate(data);
      }
    } catch (e) {}
  };

  const handleCreateBooking = async () => {
    setLoading(true);
    try {
      const chosen = vehicleOptions.find((v) => v.id === selectedVehicle);
      const res = await fetchCustomerWithAuth('/api/v1/customer/rides/', {
        method: 'POST',
        body: JSON.stringify({
          pickup_address: pickupText,
          dropoff_address: destText,
          vehicle_type: selectedVehicle,
          payment_method: paymentMethod,
          fare: chosen?.fare || 100,
          pickup_latitude: 28.4415,
          pickup_longitude: 77.0395,
          dropoff_latitude: 28.4900,
          dropoff_longitude: 77.0800,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert('Ride Requested!', 'Searching for nearby captains...');
        const rideId = data.id || data.ride?.id;
        navigation.navigate('ActiveRide', { rideId });
      } else {
        Alert.alert('Booking Error', data.error || data.detail || 'Could not place booking request');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Failed to communicate with server.');
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
        <Text style={styles.topBarTitle}>Select a Ride</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Route Preview Card */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <Ionicons name="radio-button-on" size={16} color="#10b981" />
            <Text style={styles.routeText} numberOfLines={1}>{pickupText}</Text>
          </View>
          <View style={styles.line} />
          <View style={styles.routeRow}>
            <Ionicons name="location" size={16} color="#ef4444" />
            <Text style={styles.routeText} numberOfLines={1}>{destText}</Text>
          </View>
        </View>

        {/* Vehicle Options */}
        <Text style={styles.sectionTitle}>Available Vehicles</Text>
        {vehicleOptions.map((opt) => {
          const isSelected = selectedVehicle === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.vehicleCard, isSelected && styles.vehicleCardActive]}
              onPress={() => setSelectedVehicle(opt.id)}
            >
              <View style={styles.vehicleIconBadge}>
                <Ionicons
                  name={opt.icon}
                  size={26}
                  color={isSelected ? '#2563eb' : '#4b5563'}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.vehicleName}>{opt.name}</Text>
                  <Text style={styles.vehicleEta}> • {opt.eta}</Text>
                </View>
                <Text style={styles.vehicleDesc}>{opt.desc}</Text>
              </View>

              <Text style={styles.vehicleFare}>₹{opt.fare}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Payment Method */}
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.paymentRow}>
          <TouchableOpacity
            style={[styles.paymentBtn, paymentMethod === 'cash' && styles.paymentBtnActive]}
            onPress={() => setPaymentMethod('cash')}
          >
            <Ionicons
              name="cash-outline"
              size={18}
              color={paymentMethod === 'cash' ? '#2563eb' : '#6b7280'}
            />
            <Text
              style={[
                styles.paymentText,
                paymentMethod === 'cash' && styles.paymentTextActive,
              ]}
            >
              Cash
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentBtn, paymentMethod === 'wallet' && styles.paymentBtnActive]}
            onPress={() => setPaymentMethod('wallet')}
          >
            <Ionicons
              name="wallet-outline"
              size={18}
              color={paymentMethod === 'wallet' ? '#2563eb' : '#6b7280'}
            />
            <Text
              style={[
                styles.paymentText,
                paymentMethod === 'wallet' && styles.paymentTextActive,
              ]}
            >
              RaahGo Wallet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentBtn, paymentMethod === 'upi' && styles.paymentBtnActive]}
            onPress={() => setPaymentMethod('upi')}
          >
            <Ionicons
              name="qr-code-outline"
              size={18}
              color={paymentMethod === 'upi' ? '#2563eb' : '#6b7280'}
            />
            <Text
              style={[
                styles.paymentText,
                paymentMethod === 'upi' && styles.paymentTextActive,
              ]}
            >
              UPI
            </Text>
          </TouchableOpacity>
        </View>

        {/* Confirm Booking Button */}
        <TouchableOpacity
          style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
          onPress={handleCreateBooking}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.confirmBtnText}>
              Confirm {vehicleOptions.find((v) => v.id === selectedVehicle)?.name}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3a8a',
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
  scroll: {
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    minHeight: '100%',
  },
  routeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 10,
    flex: 1,
  },
  line: {
    height: 14,
    width: 2,
    backgroundColor: '#d1d5db',
    marginLeft: 7,
    marginVertical: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 1,
  },
  vehicleCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  vehicleIconBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  vehicleEta: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  vehicleDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  vehicleFare: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  paymentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  paymentBtnActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  paymentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
  },
  paymentTextActive: {
    color: '#2563eb',
  },
  confirmBtn: {
    backgroundColor: '#2563eb',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  confirmBtnDisabled: {
    backgroundColor: '#93c5fd',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
