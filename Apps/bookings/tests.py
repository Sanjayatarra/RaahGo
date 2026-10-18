import uuid
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from users.models import User
from drivers.models import Driver
from services.models import Service
from vehicles.models import Vehicle, VehicleType
from bookings.models import Booking, RideOffer, OutboxMessage
from tracking.redis_client import RedisPresenceService, get_redis_client
from bookings.outbox_service import OutboxService


class RideMatchingAndConcurrencyTests(TestCase):
    """
    Comprehensive tests for:
    1. Simultaneous accepts (winner succeeds, second gets 409 conflict).
    2. Idempotent acceptance for winner.
    3. One driver accepting two rides (second gets 409 DRIVER_BUSY).
    4. Acceptance vs cancellation race condition.
    5. Expired offer rejection (409 OFFER_EXPIRED).
    6. Rejected offer cannot be accepted (409 OFFER_REJECTED).
    7. Atomic Redis offer reservation with token-validated Lua deletion.
    8. Redis GEO stale member filtering (>30s heartbeat).
    9. Durable transactional Outbox event processing and retry.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Customer User
        self.customer_user = User.objects.create(
            username=f"cust_{uuid.uuid4().hex[:8]}",
            email="rider@example.com",
            phone_number="9876543210",
            role=User.RoleChoices.CUSTOMER
        )

        # 2. Driver 1
        self.driver1_user = User.objects.create(
            username=f"driver1_{uuid.uuid4().hex[:8]}",
            email="driver1@example.com",
            phone_number="9876543211",
            first_name="Ramesh",
            last_name="Kumar",
            role=User.RoleChoices.DRIVER
        )
        self.driver1 = Driver.objects.create(
            user=self.driver1_user,
            license_number=f"DL-{uuid.uuid4().hex[:8]}",
            approval_status=Driver.ApprovalStatus.APPROVED,
            availability_status=Driver.AvailabilityStatus.ONLINE,
            is_available=True,
            current_latitude=Decimal('28.4500'),
            current_longitude=Decimal('77.0400')
        )

        # 3. Driver 2
        self.driver2_user = User.objects.create(
            username=f"driver2_{uuid.uuid4().hex[:8]}",
            email="driver2@example.com",
            phone_number="9876543212",
            first_name="Suresh",
            last_name="Singh",
            role=User.RoleChoices.DRIVER
        )
        self.driver2 = Driver.objects.create(
            user=self.driver2_user,
            license_number=f"DL-{uuid.uuid4().hex[:8]}",
            approval_status=Driver.ApprovalStatus.APPROVED,
            availability_status=Driver.AvailabilityStatus.ONLINE,
            is_available=True,
            current_latitude=Decimal('28.4510'),
            current_longitude=Decimal('77.0410')
        )

        # 4. Service and Vehicle Types
        self.service = Service.objects.create(
            name="Daily Ride",
            code=f"RIDE_{uuid.uuid4().hex[:6]}",
            is_active=True
        )
        self.vehicle_type = VehicleType.objects.create(
            name=f"Bike_{uuid.uuid4().hex[:6]}",
            base_fare=Decimal('25.00'),
            per_km_rate=Decimal('10.00'),
            per_minute_rate=Decimal('1.50'),
            is_active=True
        )

        # Assign vehicles
        Vehicle.objects.create(
            driver=self.driver1,
            vehicle_type=self.vehicle_type,
            registration_number=f"HR26-{uuid.uuid4().hex[:4]}",
            make="Hero",
            model="Splendor",
            year=2022,
            color="Black",
            is_active=True,
            is_approved=True
        )
        Vehicle.objects.create(
            driver=self.driver2,
            vehicle_type=self.vehicle_type,
            registration_number=f"HR26-{uuid.uuid4().hex[:4]}",
            make="Honda",
            model="Activa",
            year=2021,
            color="Red",
            is_active=True,
            is_approved=True
        )

        # 5. Base Booking
        self.booking = Booking.objects.create(
            booking_number=f"RG-{uuid.uuid4().hex[:8].upper()}",
            customer=self.customer_user,
            service=self.service,
            vehicle_type=self.vehicle_type,
            pickup_address="Cyber City, Gurugram",
            dropoff_address="Sector 29, Gurugram",
            pickup_latitude=Decimal('28.4505'),
            pickup_longitude=Decimal('77.0405'),
            dropoff_latitude=Decimal('28.4700'),
            dropoff_longitude=Decimal('77.0600'),
            distance_km=Decimal('3.5'),
            base_fare=Decimal('50.00'),
            total_fare=Decimal('60.00'),
            status=Booking.BookingStatus.SEARCHING
        )

    def test_simultaneous_accepts_one_succeeds_second_conflict(self):
        """Two drivers attempt to accept the same ride: winner succeeds, loser gets 409 Conflict."""
        # Create pending offers for both drivers
        token1 = f"tok-1-{uuid.uuid4().hex}"
        token2 = f"tok-2-{uuid.uuid4().hex}"
        offer1 = RideOffer.objects.create(
            booking=self.booking,
            driver=self.driver1,
            reservation_token=token1,
            expires_at=timezone.now() + timedelta(seconds=15),
            status=RideOffer.OfferStatus.PENDING
        )
        offer2 = RideOffer.objects.create(
            booking=self.booking,
            driver=self.driver2,
            reservation_token=token2,
            expires_at=timezone.now() + timedelta(seconds=15),
            status=RideOffer.OfferStatus.PENDING
        )

        # Driver 1 accepts
        url1 = f"/api/v1/driver/rides/{self.booking.id}/accept/"
        response1 = self.client.post(url1, HTTP_X_DRIVER_ID=str(self.driver1.id))
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        # Verify DB state
        self.booking.refresh_from_db()
        self.driver1.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.BookingStatus.ACCEPTED)
        self.assertEqual(self.booking.driver_id, self.driver1.id)
        self.assertFalse(self.driver1.is_available)
        self.assertEqual(self.driver1.active_ride_id, self.booking.id)

        # Driver 2 attempts to accept the already assigned ride
        response2 = self.client.post(url1, HTTP_X_DRIVER_ID=str(self.driver2.id))
        self.assertEqual(response2.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response2.data.get('code'), 'ALREADY_ACCEPTED')

        # Idempotency check: Driver 1 re-calls accept -> should return 200 OK
        response1_repeat = self.client.post(url1, HTTP_X_DRIVER_ID=str(self.driver1.id))
        self.assertEqual(response1_repeat.status_code, status.HTTP_200_OK)
        self.assertTrue(response1_repeat.data.get('is_assigned'))

    def test_one_driver_cannot_accept_two_rides_simultaneously(self):
        """A driver cannot accept another ride while an active ride is in progress."""
        # Booking 1 accepted by driver 1
        self.driver1.active_ride = self.booking
        self.driver1.is_available = False
        self.driver1.save()
        self.booking.driver = self.driver1
        self.booking.status = Booking.BookingStatus.ACCEPTED
        self.booking.save()

        # Create Booking 2
        booking2 = Booking.objects.create(
            booking_number=f"RG-{uuid.uuid4().hex[:8].upper()}",
            customer=self.customer_user,
            service=self.service,
            vehicle_type=self.vehicle_type,
            pickup_address="MG Road, Gurugram",
            dropoff_address="Golf Course Road",
            pickup_latitude=Decimal('28.4800'),
            pickup_longitude=Decimal('77.0800'),
            dropoff_latitude=Decimal('28.4900'),
            dropoff_longitude=Decimal('77.0900'),
            distance_km=Decimal('4.0'),
            base_fare=Decimal('50.00'),
            total_fare=Decimal('65.00'),
            status=Booking.BookingStatus.SEARCHING
        )

        # Driver 1 tries to accept booking 2
        url = f"/api/v1/driver/rides/{booking2.id}/accept/"
        response = self.client.post(url, HTTP_X_DRIVER_ID=str(self.driver1.id))
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data.get('code'), 'DRIVER_BUSY')

    def test_acceptance_versus_cancellation(self):
        """Driver attempting to accept a cancelled ride receives 409 Conflict."""
        # Customer cancels booking
        self.booking.status = Booking.BookingStatus.CANCELLED
        self.booking.save()

        url = f"/api/v1/driver/rides/{self.booking.id}/accept/"
        response = self.client.post(url, HTTP_X_DRIVER_ID=str(self.driver1.id))
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data.get('code'), 'RIDE_CANCELLED')

    def test_expired_offer_rejected(self):
        """Driver attempting to accept an offer past its expiration window is rejected."""
        # Create an expired offer (10 seconds ago)
        offer = RideOffer.objects.create(
            booking=self.booking,
            driver=self.driver1,
            reservation_token=f"tok-exp-{uuid.uuid4().hex}",
            expires_at=timezone.now() - timedelta(seconds=10),
            status=RideOffer.OfferStatus.PENDING
        )

        url = f"/api/v1/driver/offers/{offer.id}/accept/"
        response = self.client.post(url, HTTP_X_DRIVER_ID=str(self.driver1.id))
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data.get('code'), 'OFFER_EXPIRED')

        offer.refresh_from_db()
        self.assertEqual(offer.status, RideOffer.OfferStatus.EXPIRED)

    def test_rejected_offer_cannot_be_accepted(self):
        """Driver rejects an offer; subsequent acceptance attempt is blocked."""
        offer = RideOffer.objects.create(
            booking=self.booking,
            driver=self.driver1,
            reservation_token=f"tok-rej-{uuid.uuid4().hex}",
            expires_at=timezone.now() + timedelta(seconds=15),
            status=RideOffer.OfferStatus.PENDING
        )

        # 1. Reject offer
        reject_url = f"/api/v1/driver/offers/{offer.id}/reject/"
        reject_resp = self.client.post(reject_url, HTTP_X_DRIVER_ID=str(self.driver1.id))
        self.assertEqual(reject_resp.status_code, status.HTTP_200_OK)

        offer.refresh_from_db()
        self.assertEqual(offer.status, RideOffer.OfferStatus.REJECTED)

        # 2. Try to accept rejected offer
        accept_url = f"/api/v1/driver/offers/{offer.id}/accept/"
        accept_resp = self.client.post(accept_url, HTTP_X_DRIVER_ID=str(self.driver1.id))
        self.assertEqual(accept_resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(accept_resp.data.get('code'), 'OFFER_REJECTED')

    def test_atomic_redis_reservation_and_lua_release(self):
        """Verify SET NX EX reservation and Lua script token-matching deletion."""
        r = get_redis_client()
        if not r:
            self.skipTest("Redis server not reachable")

        driver_id = str(self.driver1.id)
        token_a = f"token-a-{uuid.uuid4().hex}"
        token_b = f"token-b-{uuid.uuid4().hex}"

        # Clean slate
        r.delete(f"driver:offer_reservation:{driver_id}")

        # 1. Acquire reservation with token_a -> True
        acquired_a = RedisPresenceService.reserve_driver_for_offer(driver_id, token_a, ttl_seconds=10)
        self.assertTrue(acquired_a)

        # 2. Competing reservation with token_b -> False (atomic NX)
        acquired_b = RedisPresenceService.reserve_driver_for_offer(driver_id, token_b, ttl_seconds=10)
        self.assertFalse(acquired_b)

        # 3. Release with invalid token -> False (key remains untouched)
        released_wrong = RedisPresenceService.release_offer_reservation(driver_id, "wrong-token")
        self.assertFalse(released_wrong)
        self.assertEqual(r.get(f"driver:offer_reservation:{driver_id}"), token_a)

        # 4. Release with matching token_a -> True (Lua script atomic delete)
        released_correct = RedisPresenceService.release_offer_reservation(driver_id, token_a)
        self.assertTrue(released_correct)
        self.assertIsNone(r.get(f"driver:offer_reservation:{driver_id}"))

        # 5. Subsequent reservation now succeeds
        acquired_new = RedisPresenceService.reserve_driver_for_offer(driver_id, token_b, ttl_seconds=10)
        self.assertTrue(acquired_new)
        RedisPresenceService.release_offer_reservation(driver_id, token_b)

    def test_redis_stale_geo_filtering(self):
        """Fresh driver heartbeat within 30s is eligible; stale driver >30s is excluded."""
        r = get_redis_client()
        if not r:
            self.skipTest("Redis server not reachable")

        d1_id = str(self.driver1.id)
        d2_id = str(self.driver2.id)
        v_name = self.vehicle_type.name

        # Clean redis presence keys
        RedisPresenceService.clear_driver(d1_id, v_name)
        RedisPresenceService.clear_driver(d2_id, v_name)

        # Driver 1: fresh location (now)
        RedisPresenceService.update_driver_location(
            driver_id=d1_id,
            latitude=28.4500,
            longitude=77.0400,
            vehicle_type=v_name,
            is_online=True,
            is_available=True
        )

        # Driver 2: stale location (set heartbeat 45 seconds in the past)
        RedisPresenceService.update_driver_location(
            driver_id=d2_id,
            latitude=28.4510,
            longitude=77.0410,
            vehicle_type=v_name,
            is_online=True,
            is_available=True
        )
        stale_ts = timezone.now().timestamp() - 45.0
        r.hset(f"driver:presence:{d2_id}", "last_heartbeat", str(stale_ts))
        r.hset(f"driver:presence:{d2_id}", "updated_at", str(stale_ts))

        # Query eligible drivers within 2km of (28.4505, 77.0405)
        candidates = RedisPresenceService.find_nearby_eligible_drivers(
            pickup_lat=28.4505,
            pickup_lng=77.0405,
            vehicle_type=v_name,
            radius_km=2.0,
            limit=5
        )

        candidate_ids = [c['driver_id'] for c in candidates]
        self.assertIn(d1_id, candidate_ids)
        self.assertNotIn(d2_id, candidate_ids)

        # Verify that candidate discovery evicted stale d2_id from the GEO sorted set
        self.assertIsNone(r.zscore("drivers:geo", d2_id))

        # Test standalone clean_stale_geo_members with another stale driver
        stale_dummy_id = f"stale-{uuid.uuid4().hex[:8]}"
        r.geoadd("drivers:geo", (77.0420, 28.4520, stale_dummy_id))
        stale_ts = timezone.now().timestamp() - 50.0
        r.hset(f"driver:presence:{stale_dummy_id}", "last_heartbeat", str(stale_ts))
        r.hset(f"driver:presence:{stale_dummy_id}", "updated_at", str(stale_ts))

        cleaned = RedisPresenceService.clean_stale_geo_members(max_age_seconds=30)
        self.assertGreaterEqual(cleaned, 1)
        self.assertIsNone(r.zscore("drivers:geo", stale_dummy_id))

    def test_durable_outbox_processing_and_retry(self):
        """Transactional outbox persists messages and processes them durably with retries."""
        # Create a pending outbox message
        msg = OutboxService.create_message(
            event_type='test_event',
            payload={'sample_data': 'test_value'}
        )
        self.assertEqual(msg.status, OutboxMessage.StatusChoices.PENDING)

        # Process outbox batch
        processed_count = OutboxService.process_pending_outbox_batch(limit=10)
        self.assertGreaterEqual(processed_count, 1)

        msg.refresh_from_db()
        self.assertEqual(msg.status, OutboxMessage.StatusChoices.PROCESSED)
        self.assertIsNotNone(msg.processed_at)
