"""
Firebase Cloud Messaging (FCM) Integration Service for RaahGo
==============================================================
Provides mobile push notifications for background/disconnected clients.
Features:
- Configurable per-message TTL tied to offer expiration window.
- Alert deduplication via collapse_key and offer_id.
- Safe fallback / development simulation when credentials file is omitted.
"""

import os
import json
import logging
from datetime import timedelta
from typing import Dict, List, Optional
from django.conf import settings

logger = logging.getLogger(__name__)

_firebase_initialized = False


def initialize_firebase_app():
    """Initialize firebase_admin SDK once with configured credentials."""
    global _firebase_initialized
    if _firebase_initialized:
        return True

    try:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            _firebase_initialized = True
            return True

        cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH', 'firebase-credentials.json')
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info(f"[FCM] Initialized Firebase Admin SDK with credentials from {cred_path}")
            return True
        else:
            logger.warning(f"[FCM] Firebase credentials not found at '{cred_path}'. Running in mock/development mode.")
            return False
    except Exception as e:
        logger.warning(f"[FCM] Firebase initialization note: {e}")
        return False


class FCMNotificationService:
    """Service to deliver FCM push messages to drivers and customers."""

    @classmethod
    def send_to_devices(
        cls,
        tokens: List[str],
        title: str,
        body: str,
        data_payload: Dict[str, str],
        ttl_seconds: int = 15,
        collapse_key: Optional[str] = None
    ) -> Dict:
        """
        Send FCM Multicast message to mobile devices.
        Sets TTL to remaining offer lifetime to prevent delayed offer notifications.
        """
        if not tokens:
            return {'success': 0, 'failure': 0, 'skipped': True}

        # Filter out empty or mock development tokens
        valid_tokens = [t for t in tokens if t and not t.startswith('FCM-TK-MOCK') and len(t) > 20]
        if not valid_tokens:
            logger.info(f"[FCM Dev Simulation] Notification '{title}' delivered to {len(tokens)} simulated devices.")
            return {'success': len(tokens), 'failure': 0, 'simulated': True}

        is_init = initialize_firebase_app()
        if not is_init:
            logger.info(f"[FCM Dev Simulation] SDK unconfigured; simulated push '{title}' to {len(valid_tokens)} devices.")
            return {'success': len(valid_tokens), 'failure': 0, 'simulated': True}

        try:
            from firebase_admin import messaging

            # Ensure all values in data_payload are strings (FCM requirement)
            sanitized_data = {str(k): str(v) for k, v in (data_payload or {}).items()}

            android_config = messaging.AndroidConfig(
                ttl=timedelta(seconds=max(1, int(ttl_seconds))),
                priority='high',
                collapse_key=collapse_key,
                notification=messaging.AndroidNotification(
                    title=title,
                    body=body,
                    sound='default',
                    channel_id='ride_offers_channel'
                )
            )

            apns_config = messaging.APNSConfig(
                headers={
                    'apns-expiration': str(int(ttl_seconds)),
                    'apns-priority': '10',
                    'apns-collapse-id': collapse_key or ''
                },
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(title=title, body=body),
                        sound='default',
                        badge=1
                    )
                )
            )

            multicast_message = messaging.MulticastMessage(
                tokens=valid_tokens,
                notification=messaging.Notification(title=title, body=body),
                data=sanitized_data,
                android=android_config,
                apns=apns_config
            )

            response = messaging.send_each_for_multicast(multicast_message)
            logger.info(f"[FCM] Sent message '{title}' to {len(valid_tokens)} tokens. Success: {response.success_count}, Failure: {response.failure_count}")
            return {
                'success': response.success_count,
                'failure': response.failure_count,
                'simulated': False
            }
        except Exception as e:
            logger.error(f"[FCM] Error dispatching push notification: {e}")
            return {'success': 0, 'failure': len(valid_tokens), 'error': str(e)}

    @classmethod
    def send_driver_ride_offer(cls, driver_user, offer_payload: Dict, ttl_seconds: int = 15) -> Dict:
        """
        Send high-priority ride offer alert to driver's registered mobile devices.
        Uses offer_id for deduplication and sets short TTL equal to offer window.
        """
        from users.models import UserDevice

        devices = UserDevice.objects.filter(user=driver_user, is_active=True).exclude(firebase_token__isnull=True)
        tokens = list(devices.values_list('firebase_token', flat=True))

        title = "🚖 New Ride Offer!"
        pickup_addr = offer_payload.get('pickup_address', 'Nearby pickup')
        fare = offer_payload.get('estimated_fare', '')
        body = f"Pickup: {pickup_addr} | Fare: ₹{fare} (Expires in {ttl_seconds}s)"

        offer_id = str(offer_payload.get('offer_id', ''))
        collapse_key = f"ride_offer_{offer_payload.get('ride_id', '')}"

        data_payload = {
            'type': 'ride_offer',
            'offer_id': offer_id,
            'ride_id': str(offer_payload.get('ride_id', '')),
            'pickup_address': str(pickup_addr),
            'pickup_lat': str(offer_payload.get('pickup_lat', '')),
            'pickup_lng': str(offer_payload.get('pickup_lng', '')),
            'dropoff_address': str(offer_payload.get('dropoff_address', '')),
            'estimated_fare': str(fare),
            'distance_km': str(offer_payload.get('distance_km', '')),
            'expires_at': str(offer_payload.get('expires_at', '')),
            'ttl_seconds': str(ttl_seconds)
        }

        return cls.send_to_devices(
            tokens=tokens,
            title=title,
            body=body,
            data_payload=data_payload,
            ttl_seconds=ttl_seconds,
            collapse_key=collapse_key
        )

    @classmethod
    def send_customer_ride_assigned(cls, customer_user, booking, driver) -> Dict:
        """Send push notification to customer when captain accepts ride."""
        from users.models import UserDevice

        devices = UserDevice.objects.filter(user=customer_user, is_active=True).exclude(firebase_token__isnull=True)
        tokens = list(devices.values_list('firebase_token', flat=True))

        driver_name = f"{driver.user.first_name or ''} {driver.user.last_name or ''}".strip() or "Captain"
        vehicle = driver.vehicles.filter(is_active=True).first()
        plate = vehicle.registration_number if vehicle else "Assigned Vehicle"

        title = "🚗 Captain Assigned!"
        body = f"{driver_name} ({plate}) is on the way for Booking #{booking.booking_number}."

        data_payload = {
            'type': 'ride_assigned',
            'booking_id': str(booking.id),
            'booking_number': str(booking.booking_number),
            'driver_name': driver_name,
            'driver_phone': str(driver.user.phone_number or ''),
            'plate': plate,
            'ride_pin': str(booking.ride_pin or '')
        }

        return cls.send_to_devices(
            tokens=tokens,
            title=title,
            body=body,
            data_payload=data_payload,
            ttl_seconds=300
        )

    @classmethod
    def send_customer_no_driver_found(cls, customer_user, booking) -> Dict:
        """Send push notification when search deadline expires with no driver available."""
        from users.models import UserDevice

        devices = UserDevice.objects.filter(user=customer_user, is_active=True).exclude(firebase_token__isnull=True)
        tokens = list(devices.values_list('firebase_token', flat=True))

        title = "⚠️ No Captain Available"
        body = f"We couldn't find a nearby captain for Booking #{booking.booking_number}. Please try again."

        data_payload = {
            'type': 'no_driver_available',
            'booking_id': str(booking.id),
            'booking_number': str(booking.booking_number)
        }

        return cls.send_to_devices(
            tokens=tokens,
            title=title,
            body=body,
            data_payload=data_payload,
            ttl_seconds=120
        )
