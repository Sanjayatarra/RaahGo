"""
Transactional Outbox & Event Dispatcher Service for RaahGo
===========================================================
Ensures that after a MySQL transaction commits:
1. Redis presence & GEO indexes are reconciled with MySQL authority.
2. WebSockets push events to driver and customer private Channels groups.
3. FCM notifications are dispatched to mobile devices.
4. Process crashes or network failures cannot drop updates (messages remain Pending until acknowledged).
"""

import logging
from typing import Dict, Any, Optional
from django.db import transaction
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from bookings.models import OutboxMessage, Booking, RideOffer
from drivers.models import Driver
from tracking.redis_client import RedisPresenceService
from notifications.fcm_service import FCMNotificationService

logger = logging.getLogger(__name__)


class OutboxService:
    """Service to create and process durable Outbox events."""

    @classmethod
    def create_message(cls, event_type: str, payload: Dict[str, Any]) -> OutboxMessage:
        """
        Record an outbox message inside the caller's active database transaction.
        Also registers an on_commit callback for immediate dispatch.
        """
        msg = OutboxMessage.objects.create(
            event_type=event_type,
            payload=payload,
            status=OutboxMessage.StatusChoices.PENDING
        )

        # Trigger near-instantaneous post-commit dispatch
        transaction.on_commit(lambda: cls.dispatch_message_safely(msg.id))
        return msg

    @classmethod
    def dispatch_message_safely(cls, message_id):
        """Wrapper to execute dispatch without raising exceptions in on_commit."""
        try:
            cls.process_single_message(message_id)
        except Exception as e:
            logger.error(f"[Outbox] Error dispatching message {message_id}: {e}")

    @classmethod
    def process_single_message(cls, message_id) -> bool:
        """Process a single outbox message and update its status."""
        msg = OutboxMessage.objects.filter(id=message_id).first()
        if not msg or msg.status == OutboxMessage.StatusChoices.PROCESSED:
            return True

        channel_layer = get_channel_layer()
        payload = msg.payload or {}
        event_type = msg.event_type

        try:
            # ──────────────────────────────────────────────────────────────────
            # 1. Event: ride_assigned
            # ──────────────────────────────────────────────────────────────────
            if event_type == 'ride_assigned':
                driver_id = str(payload.get('driver_id'))
                customer_id = str(payload.get('customer_id'))
                ride_id = str(payload.get('ride_id'))
                winning_offer_id = str(payload.get('offer_id'))
                reservation_token = payload.get('reservation_token')

                # A. Reconcile Redis presence: driver is busy with this active ride
                RedisPresenceService.set_driver_busy(driver_id, active_ride_id=ride_id)

                # Release reservation token for the driver who accepted
                if reservation_token:
                    RedisPresenceService.release_driver_reservation(driver_id, reservation_token)

                # B. Notify customer via WebSocket group
                if channel_layer and customer_id:
                    async_to_sync(channel_layer.group_send)(
                        f"customer_{customer_id}",
                        {
                            'type': 'ride_assigned',
                            'payload': payload
                        }
                    )

                # Notify ride channel
                if channel_layer and ride_id:
                    async_to_sync(channel_layer.group_send)(
                        f"ride_{ride_id}",
                        {
                            'type': 'ride_assigned',
                            'payload': payload
                        }
                    )

                # Send FCM push to customer
                try:
                    from users.models import User
                    customer_user = User.objects.filter(customer__id=customer_id).first() or User.objects.filter(id=customer_id).first()
                    booking_obj = Booking.objects.filter(id=ride_id).first()
                    driver_obj = Driver.objects.filter(id=driver_id).first()
                    if customer_user and booking_obj and driver_obj:
                        FCMNotificationService.send_customer_ride_assigned(customer_user, booking_obj, driver_obj)
                except Exception as fcm_err:
                    logger.warning(f"[Outbox FCM] Error sending ride_assigned push: {fcm_err}")

                # C. Close competing pending offers and release their reservations
                competing_offers = RideOffer.objects.filter(
                    booking_id=ride_id
                ).exclude(id=winning_offer_id)

                for co in competing_offers:
                    c_driver_id = str(co.driver_id)
                    if co.reservation_token:
                        RedisPresenceService.release_driver_reservation(c_driver_id, co.reservation_token)

                    if channel_layer:
                        async_to_sync(channel_layer.group_send)(
                            f"driver_{c_driver_id}",
                            {
                                'type': 'offer_closed',
                                'payload': {
                                    'offer_id': str(co.id),
                                    'ride_id': ride_id,
                                    'reason': 'accepted_by_other'
                                }
                            }
                        )

            # ──────────────────────────────────────────────────────────────────
            # 2. Event: offer_closed
            # ──────────────────────────────────────────────────────────────────
            elif event_type == 'offer_closed':
                driver_id = str(payload.get('driver_id'))
                token = payload.get('reservation_token')
                reason = payload.get('reason', 'expired')

                if token and driver_id:
                    RedisPresenceService.release_driver_reservation(driver_id, token)

                if channel_layer and driver_id:
                    async_to_sync(channel_layer.group_send)(
                        f"driver_{driver_id}",
                        {
                            'type': 'offer_closed',
                            'payload': payload
                        }
                    )

            # ──────────────────────────────────────────────────────────────────
            # 3. Event: no_driver_available
            # ──────────────────────────────────────────────────────────────────
            elif event_type == 'no_driver_available':
                customer_id = str(payload.get('customer_id'))
                if channel_layer and customer_id:
                    async_to_sync(channel_layer.group_send)(
                        f"customer_{customer_id}",
                        {
                            'type': 'no_driver_available',
                            'payload': payload
                        }
                    )
                # Send FCM push
                try:
                    from users.models import User
                    customer_user = User.objects.filter(customer__id=customer_id).first() or User.objects.filter(id=customer_id).first()
                    booking_id = payload.get('booking_id') or payload.get('ride_id')
                    booking_obj = Booking.objects.filter(id=booking_id).first()
                    if customer_user and booking_obj:
                        FCMNotificationService.send_customer_no_driver_found(customer_user, booking_obj)
                except Exception as fcm_err:
                    logger.warning(f"[Outbox FCM] Error sending no_driver_available push: {fcm_err}")

            # ──────────────────────────────────────────────────────────────────
            # 4. Event: ride_cancelled
            # ──────────────────────────────────────────────────────────────────
            elif event_type == 'ride_cancelled':
                driver_id = payload.get('driver_id')
                customer_id = payload.get('customer_id')
                ride_id = payload.get('ride_id') or payload.get('booking_id')

                # Release pending reservations
                pending_driver_ids = payload.get('pending_driver_ids') or []
                for p_did in pending_driver_ids:
                    offers = RideOffer.objects.filter(booking_id=ride_id, driver_id=p_did)
                    for off in offers:
                        if off.reservation_token:
                            RedisPresenceService.release_driver_reservation(p_did, off.reservation_token)
                    if channel_layer:
                        async_to_sync(channel_layer.group_send)(
                            f"driver_{p_did}",
                            {
                                'type': 'offer_closed',
                                'payload': {
                                    'offer_id': str(off.id) if offers else '',
                                    'ride_id': str(ride_id),
                                    'reason': 'ride_cancelled'
                                }
                            }
                        )

                if driver_id:
                    RedisPresenceService.set_driver_available(str(driver_id))

                if channel_layer:
                    if customer_id:
                        async_to_sync(channel_layer.group_send)(
                            f"customer_{customer_id}",
                            {'type': 'ride_cancelled', 'payload': payload}
                        )
                    if driver_id:
                        async_to_sync(channel_layer.group_send)(
                            f"driver_{driver_id}",
                            {'type': 'ride_cancelled', 'payload': payload}
                        )
                    if ride_id:
                        async_to_sync(channel_layer.group_send)(
                            f"ride_{ride_id}",
                            {'type': 'ride_cancelled', 'payload': payload}
                        )

            # ──────────────────────────────────────────────────────────────────
            # 5. Event: ride_completed
            # ──────────────────────────────────────────────────────────────────
            elif event_type == 'ride_completed':
                driver_id = payload.get('driver_id')
                customer_id = payload.get('customer_id')
                ride_id = payload.get('ride_id') or payload.get('booking_id')

                if driver_id:
                    RedisPresenceService.set_driver_available(str(driver_id))

                if channel_layer:
                    if customer_id:
                        async_to_sync(channel_layer.group_send)(
                            f"customer_{customer_id}",
                            {'type': 'ride_completed', 'payload': payload}
                        )
                    if ride_id:
                        async_to_sync(channel_layer.group_send)(
                            f"ride_{ride_id}",
                            {'type': 'ride_completed', 'payload': payload}
                        )

            msg.status = OutboxMessage.StatusChoices.PROCESSED
            msg.processed_at = timezone.now()
            msg.save(update_fields=['status', 'processed_at'])
            return True

        except Exception as e:
            logger.error(f"[Outbox] Failed processing message {message_id}: {e}")
            msg.status = OutboxMessage.StatusChoices.FAILED
            msg.retry_count += 1
            msg.last_error = str(e)
            msg.save(update_fields=['status', 'retry_count', 'last_error'])
            return False

    @classmethod
    def process_pending_outbox_batch(cls, limit: int = 50) -> int:
        """Batch processor for background worker to retry any pending/failed messages."""
        pending_ids = list(OutboxMessage.objects.filter(
            status__in=[OutboxMessage.StatusChoices.PENDING, OutboxMessage.StatusChoices.FAILED],
            retry_count__lt=5
        ).order_by('created_at').values_list('id', flat=True)[:limit])

        processed_count = 0
        for mid in pending_ids:
            if cls.process_single_message(mid):
                processed_count += 1
        return processed_count
