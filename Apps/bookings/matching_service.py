"""
Ride Matching & Auto-Dispatch Service for RaahGo
================================================
Handles:
1. Spatial driver discovery using Redis GEOSEARCH around pickup coordinates.
2. Filtering by vehicle type, presence freshness, heartbeat, availability, and active reservations.
3. Radius expansion: 2.0 km -> 5.0 km.
4. Concurrent offers (top 3) with atomic Redis reservations (SET NX EX) and 15s window.
5. Notification via Django Channels and Firebase Cloud Messaging.
6. Automatic retries, excluding rejected drivers, respecting the 60s overall deadline.
7. Immediate cancellation on ride assignment or customer abort.
8. Non-blocking asynchronous background execution.
"""

import os
import time
import uuid
import threading
import logging
from datetime import timedelta
from typing import List, Dict, Set, Optional

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from bookings.models import Booking, RideOffer, BookingTracking
from drivers.models import Driver
from tracking.redis_client import RedisPresenceService, get_redis_client
from bookings.outbox_service import OutboxService
from notifications.fcm_service import FCMNotificationService
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


class MatchingService:
    """Core matching and automated offer dispatch engine."""

    @classmethod
    def start_matching_for_booking(cls, booking_id: str):
        """
        Entry point called when a customer requests a ride.
        Spawns an asynchronous background worker thread to execute the matching cycle
        so the HTTP response returns immediately.
        """
        thread = threading.Thread(
            target=cls.run_dispatch_loop,
            args=(str(booking_id),),
            daemon=True,
            name=f"dispatch-booking-{booking_id[:8]}"
        )
        thread.start()
        logger.info(f"[MatchingEngine] Launched background dispatch worker for Booking {booking_id}")
        return thread

    @classmethod
    def run_dispatch_loop(cls, booking_id: str):
        """
        Background dispatch loop for a single booking:
        - Runs within an overall deadline (default 60s).
        - Attempts batch dispatch with 15s windows.
        - Expands radius from 2 km to 5 km when candidates are scarce.
        - Stops immediately upon assignment or cancellation.
        """
        # Load configuration parameters directly from environment / .env
        initial_radius_km = float(os.getenv('MATCHING_INITIAL_RADIUS_KM', 2.0))
        max_radius_km = float(os.getenv('MATCHING_MAX_RADIUS_KM', 5.0))
        offer_window_sec = int(os.getenv('MATCHING_OFFER_WINDOW_SECONDS', 15))
        deadline_sec = int(os.getenv('MATCHING_OVERALL_DEADLINE_SECONDS', 60))
        concurrent_offers_count = int(os.getenv('MATCHING_CONCURRENT_OFFERS', 3))

        start_time = time.time()
        deadline_time = start_time + deadline_sec
        current_radius = initial_radius_km

        rejected_driver_ids: Set[str] = set()
        offered_driver_ids: Set[str] = set()
        batch_number = 0

        logger.info(f"[MatchingEngine] Starting dispatch for Booking {booking_id} (Deadline: {deadline_sec}s, Window: {offer_window_sec}s)")

        while time.time() < deadline_time:
            # 1. Inspect MySQL authoritative status of the booking
            booking = Booking.objects.filter(id=booking_id).first()
            if not booking:
                logger.warning(f"[MatchingEngine] Booking {booking_id} not found. Aborting dispatch.")
                return

            if booking.status != Booking.BookingStatus.SEARCHING:
                logger.info(f"[MatchingEngine] Booking {booking_id} is now '{booking.status}'. Terminating dispatch.")
                return

            batch_number += 1
            remaining_total_time = max(0, int(deadline_time - time.time()))

            # Notify customer of search progress
            channel_layer = get_channel_layer()
            if channel_layer and booking.customer_id:
                async_to_sync(channel_layer.group_send)(
                    f"customer_{booking.customer_id}",
                    {
                        'type': 'ride_searching',
                        'payload': {
                            'booking_id': str(booking.id),
                            'booking_number': str(booking.booking_number),
                            'search_radius_km': current_radius,
                            'batch_number': batch_number,
                            'remaining_seconds': remaining_total_time
                        }
                    }
                )

            # 2. Find eligible nearby drivers via Redis GEOSEARCH
            pickup_lat = float(booking.pickup_latitude)
            pickup_lng = float(booking.pickup_longitude)
            vtype_name = booking.vehicle_type.name if booking.vehicle_type else 'Bike'

            candidates = RedisPresenceService.find_nearby_eligible_drivers(
                pickup_lat=pickup_lat,
                pickup_lng=pickup_lng,
                radius_km=current_radius,
                vehicle_type=vtype_name,
                limit=concurrent_offers_count * 2,
                excluded_driver_ids=list(rejected_driver_ids.union(offered_driver_ids))
            )

            # If candidates are too few and we haven't expanded to max radius yet, expand radius!
            if len(candidates) < concurrent_offers_count and current_radius < max_radius_km:
                logger.info(f"[MatchingEngine] Only {len(candidates)} candidates in {current_radius} km. Expanding search radius to {max_radius_km} km.")
                current_radius = max_radius_km
                candidates = RedisPresenceService.find_nearby_eligible_drivers(
                    pickup_lat=pickup_lat,
                    pickup_lng=pickup_lng,
                    radius_km=current_radius,
                    vehicle_type=vtype_name,
                    limit=concurrent_offers_count * 2,
                    excluded_driver_ids=list(rejected_driver_ids.union(offered_driver_ids))
                )

            # 3. Create concurrent offers for up to 3 candidates
            selected_candidates = candidates[:concurrent_offers_count]
            active_offers_in_batch: List[RideOffer] = []

            for cand in selected_candidates:
                d_id = cand['driver_id']
                driver_obj = Driver.objects.filter(id=d_id, approval_status=Driver.ApprovalStatus.APPROVED).first()
                if not driver_obj:
                    continue

                # Acquire atomic reservation in Redis (SET NX EX)
                reservation_token = str(uuid.uuid4())
                reservation_acquired = RedisPresenceService.acquire_driver_reservation(
                    driver_id=d_id,
                    token=reservation_token,
                    ttl_seconds=offer_window_sec + 3  # Add 3s buffer
                )

                if not reservation_acquired:
                    # Driver was reserved by another ride concurrent matching
                    continue

                # Create authoritative RideOffer row in MySQL
                offer_expires_at = timezone.now() + timedelta(seconds=offer_window_sec)
                offer = RideOffer.objects.create(
                    booking=booking,
                    driver=driver_obj,
                    status=RideOffer.OfferStatus.PENDING,
                    reservation_token=reservation_token,
                    estimated_distance_km=cand['distance_km'],
                    estimated_fare=booking.total_fare,
                    expires_at=offer_expires_at
                )

                active_offers_in_batch.append(offer)
                offered_driver_ids.add(d_id)

                # Send WebSocket notification to driver private group
                offer_payload = {
                    'offer_id': str(offer.id),
                    'ride_id': str(booking.id),
                    'booking_number': str(booking.booking_number),
                    'pickup_address': booking.pickup_address,
                    'pickup_lat': float(booking.pickup_latitude),
                    'pickup_lng': float(booking.pickup_longitude),
                    'dropoff_address': booking.dropoff_address,
                    'dropoff_lat': float(booking.dropoff_latitude),
                    'dropoff_lng': float(booking.dropoff_longitude),
                    'distance_km': float(cand['distance_km']),  # Geographic distance
                    'estimated_fare': float(booking.total_fare),
                    'expires_at': offer_expires_at.isoformat(),
                    'ttl_seconds': offer_window_sec
                }

                if channel_layer:
                    async_to_sync(channel_layer.group_send)(
                        f"driver_{d_id}",
                        {
                            'type': 'ride_offer',
                            'payload': offer_payload
                        }
                    )

                # Send FCM Push Notification for mobile apps in background
                FCMNotificationService.send_driver_ride_offer(
                    driver_user=driver_obj.user,
                    offer_payload=offer_payload,
                    ttl_seconds=offer_window_sec
                )

                logger.info(f"[MatchingEngine] Sent Offer {offer.id} to Driver {d_id} (Dist: {cand['distance_km']} km)")

            # 4. Wait for the offer window while monitoring state reactively
            # Check every 500ms whether any offer was accepted, rejected, or ride cancelled
            window_end = time.time() + offer_window_sec

            while time.time() < window_end:
                time.sleep(0.5)

                # Re-check booking state
                b_check = Booking.objects.filter(id=booking_id).values('status', 'driver_id').first()
                if not b_check:
                    return

                # If ride was accepted by a driver -> terminate immediately
                if b_check['status'] == Booking.BookingStatus.ACCEPTED:
                    logger.info(f"[MatchingEngine] Booking {booking_id} was ACCEPTED by Driver {b_check['driver_id']}. Stopping dispatch.")
                    cls._close_unaccepted_offers(active_offers_in_batch, reason='accepted_by_other')
                    return

                # If ride was cancelled by customer -> terminate immediately
                if b_check['status'] == Booking.BookingStatus.CANCELLED:
                    logger.info(f"[MatchingEngine] Booking {booking_id} was CANCELLED. Stopping dispatch.")
                    cls._close_unaccepted_offers(active_offers_in_batch, reason='cancelled_by_customer')
                    return

                # Check if all active offers in this batch have already been answered (e.g. all rejected)
                pending_count = RideOffer.objects.filter(
                    id__in=[o.id for o in active_offers_in_batch],
                    status=RideOffer.OfferStatus.PENDING
                ).count()

                if pending_count == 0:
                    # All drivers rejected or answered before 15s elapsed
                    logger.info(f"[MatchingEngine] All {len(active_offers_in_batch)} offers in batch {batch_number} resolved early.")
                    break

            # 5. Clean up expired / unaccepted offers for this batch
            cls._close_unaccepted_offers(active_offers_in_batch, reason='expired')

            # Populate rejected_driver_ids from any rejected offers
            rejected_ids = list(RideOffer.objects.filter(
                booking_id=booking_id,
                status=RideOffer.OfferStatus.REJECTED
            ).values_list('driver_id', flat=True))
            rejected_driver_ids.update(str(rid) for rid in rejected_ids)

        # 6. Overall Deadline Exceeded -> Terminal Search Outcome
        cls._handle_search_timeout(booking_id)

    @classmethod
    def _close_unaccepted_offers(cls, offers: List[RideOffer], reason: str = 'expired'):
        """Expire unaccepted offers and release their Redis reservations with matching tokens."""
        channel_layer = get_channel_layer()

        for offer in offers:
            # Refresh offer from DB
            o = RideOffer.objects.filter(id=offer.id).first()
            if not o or o.status != RideOffer.OfferStatus.PENDING:
                continue

            new_status = RideOffer.OfferStatus.CANCELLED if reason in ('accepted_by_other', 'cancelled_by_customer') else RideOffer.OfferStatus.EXPIRED
            o.status = new_status
            o.save(update_fields=['status', 'updated_at'])

            d_id = str(o.driver_id)
            if o.reservation_token:
                # Release reservation token in Redis safely using Lua compare-and-delete
                RedisPresenceService.release_driver_reservation(d_id, o.reservation_token)

            # Send offer_closed event over Channels
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"driver_{d_id}",
                    {
                        'type': 'offer_closed',
                        'payload': {
                            'offer_id': str(o.id),
                            'ride_id': str(o.booking_id),
                            'reason': reason
                        }
                    }
                )

    @classmethod
    def _handle_search_timeout(cls, booking_id: str):
        """Handle expiration of overall search deadline (60s)."""
        with transaction.atomic():
            booking = Booking.objects.select_for_update().filter(id=booking_id).first()
            if not booking or booking.status != Booking.BookingStatus.SEARCHING:
                return

            booking.status = Booking.BookingStatus.CANCELLED
            booking.save(update_fields=['status', 'updated_at'])

            BookingTracking.objects.create(
                booking=booking,
                status=Booking.BookingStatus.CANCELLED,
                remarks="Search deadline exceeded: no captain available within timeout window."
            )

            # Create outbox message to notify customer
            OutboxService.create_message(
                event_type='no_driver_available',
                payload={
                    'booking_id': str(booking.id),
                    'booking_number': str(booking.booking_number),
                    'message': 'No captain found in your area. Please try requesting again.'
                }
            )

        logger.info(f"[MatchingEngine] Search deadline reached for Booking {booking_id}. Marked CANCELLED.")
