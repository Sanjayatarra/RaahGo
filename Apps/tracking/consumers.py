"""
WebSocket Consumers for RaahGo Driver & Customer Real-Time Communications
=========================================================================
Features:
- Private authenticated driver group: driver_<driver_id>
- Private authenticated customer group: customer_<customer_id>
- Dynamic ride telemetry group: ride_<booking_id>
- Low-latency dispatch of ride offers, status changes, heartbeats, and location streams.
"""

import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from tracking.redis_client import RedisPresenceService

logger = logging.getLogger(__name__)


class DriverSocketConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for drivers (Captains).
    Receives ride offers, offer cancellations, heartbeats, and transmits live location.
    """

    async def connect(self):
        user = self.scope.get('user')
        driver = self.scope.get('driver')

        if not user or not user.is_authenticated or not driver:
            logger.warning("[DriverSocket] Unauthorized connection attempt rejected.")
            await self.close(code=4401)
            return

        self.driver = driver
        self.driver_id = str(driver.id)
        self.driver_group = f"driver_{self.driver_id}"
        self.active_ride_group = None

        # Join driver's private notification group
        await self.channel_layer.group_add(self.driver_group, self.channel_name)
        await self.accept()

        logger.info(f"[DriverSocket] Driver {self.driver_id} connected to {self.driver_group}")

        # Send connection acknowledgment with driver's current status
        await self.send_json({
            'event': 'connection_ack',
            'status': 'connected',
            'driver_id': self.driver_id,
            'message': 'Driver real-time socket established.'
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'driver_group') and self.driver_group:
            await self.channel_layer.group_discard(self.driver_group, self.channel_name)
        if hasattr(self, 'active_ride_group') and self.active_ride_group:
            await self.channel_layer.group_discard(self.active_ride_group, self.channel_name)
        logger.info(f"[DriverSocket] Driver disconnected (code {close_code})")

    async def receive_json(self, content, **kwargs):
        """Process incoming client WebSocket messages."""
        msg_type = content.get('type') or content.get('event')

        # 1. High-frequency GPS location telemetry from driver device
        if msg_type == 'location_update':
            lat = content.get('latitude') or content.get('lat')
            lng = content.get('longitude') or content.get('lng')
            heading = content.get('heading', 0.0)
            speed = content.get('speed', 0.0)
            vtype = content.get('vehicle_type') or 'standard'
            active_ride_id = content.get('active_ride_id')

            if lat is not None and lng is not None:
                # Update Redis presence & GEO index without hitting MySQL on every tick
                await database_sync_to_async(RedisPresenceService.update_driver_location)(
                    driver_id=self.driver_id,
                    lat=float(lat),
                    lng=float(lng),
                    vehicle_type=vtype,
                    is_online=True,
                    is_available=(not bool(active_ride_id)),
                    heading=float(heading),
                    speed=float(speed),
                    active_ride_id=active_ride_id
                )

                # If driver is on an active ride, stream location to the customer's ride group
                if active_ride_id:
                    ride_group = f"ride_{active_ride_id}"
                    await self.channel_layer.group_send(
                        ride_group,
                        {
                            'type': 'driver_location_update',
                            'payload': {
                                'driver_id': self.driver_id,
                                'latitude': float(lat),
                                'longitude': float(lng),
                                'heading': float(heading),
                                'speed': float(speed)
                            }
                        }
                    )

                await self.send_json({'event': 'location_ack', 'status': 'received'})

        # 2. Driver Heartbeat (keep-alive)
        elif msg_type == 'heartbeat':
            await database_sync_to_async(RedisPresenceService.record_heartbeat)(self.driver_id)
            await self.send_json({'event': 'heartbeat_ack', 'status': 'alive'})

        # 3. Join active ride tracking group
        elif msg_type == 'track_ride':
            ride_id = content.get('ride_id')
            if ride_id:
                self.active_ride_group = f"ride_{ride_id}"
                await self.channel_layer.group_add(self.active_ride_group, self.channel_name)
                await self.send_json({'event': 'track_ride_ack', 'ride_id': ride_id})

    # ──────────────────────────────────────────────────────────────────────────
    # Handlers for Messages Dispatched to Driver Group
    # ──────────────────────────────────────────────────────────────────────────

    async def ride_offer(self, event):
        """Dispatched when matching engine selects driver for a ride offer."""
        await self.send_json({
            'event': 'ride_offer',
            'data': event['payload']
        })

    async def offer_closed(self, event):
        """Dispatched when offer is closed (accepted by other driver, expired, or cancelled)."""
        await self.send_json({
            'event': 'offer_closed',
            'data': event['payload']
        })

    async def ride_assigned(self, event):
        """Dispatched to confirm ride acceptance."""
        await self.send_json({
            'event': 'ride_assigned',
            'data': event['payload']
        })

    async def ride_cancelled(self, event):
        """Dispatched when active or offered ride is cancelled by customer or admin."""
        await self.send_json({
            'event': 'ride_cancelled',
            'data': event['payload']
        })


class CustomerSocketConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for customers (Passengers).
    Receives search updates, driver assignment, live driver coordinates, and completion.
    """

    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            logger.warning("[CustomerSocket] Unauthorized connection attempt rejected.")
            await self.close(code=4401)
            return

        self.user = user
        self.customer_id = str(user.id)
        self.customer_group = f"customer_{self.customer_id}"
        self.active_ride_group = None

        await self.channel_layer.group_add(self.customer_group, self.channel_name)
        await self.accept()

        logger.info(f"[CustomerSocket] Customer {self.customer_id} connected to {self.customer_group}")

        await self.send_json({
            'event': 'connection_ack',
            'status': 'connected',
            'customer_id': self.customer_id,
            'message': 'Customer real-time socket established.'
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'customer_group') and self.customer_group:
            await self.channel_layer.group_discard(self.customer_group, self.channel_name)
        if hasattr(self, 'active_ride_group') and self.active_ride_group:
            await self.channel_layer.group_discard(self.active_ride_group, self.channel_name)
        logger.info(f"[CustomerSocket] Customer disconnected (code {close_code})")

    async def receive_json(self, content, **kwargs):
        msg_type = content.get('type') or content.get('event')

        # 1. Customer Live Location
        if msg_type == 'location_update':
            lat = content.get('latitude') or content.get('lat')
            lng = content.get('longitude') or content.get('lng')
            booking_id = content.get('booking_id')
            if lat is not None and lng is not None:
                await database_sync_to_async(RedisPresenceService.update_customer_location)(
                    customer_id=self.customer_id,
                    lat=float(lat),
                    lng=float(lng),
                    booking_id=booking_id
                )
                await self.send_json({'event': 'location_ack', 'status': 'received'})

        # 2. Subscribe to Active Ride Telemetry (live driver location updates)
        elif msg_type == 'track_ride':
            ride_id = content.get('ride_id')
            if ride_id:
                if self.active_ride_group:
                    await self.channel_layer.group_discard(self.active_ride_group, self.channel_name)
                self.active_ride_group = f"ride_{ride_id}"
                await self.channel_layer.group_add(self.active_ride_group, self.channel_name)
                await self.send_json({'event': 'track_ride_ack', 'ride_id': ride_id})

    # ──────────────────────────────────────────────────────────────────────────
    # Handlers for Messages Dispatched to Customer Group / Ride Group
    # ──────────────────────────────────────────────────────────────────────────

    async def ride_searching(self, event):
        """Notifies customer that matching is active / searching radius."""
        await self.send_json({
            'event': 'ride_searching',
            'data': event['payload']
        })

    async def ride_assigned(self, event):
        """Notifies customer that captain has accepted the ride."""
        await self.send_json({
            'event': 'ride_assigned',
            'data': event['payload']
        })

    async def driver_location_update(self, event):
        """Streams real-time driver coordinates to customer map."""
        await self.send_json({
            'event': 'driver_location_update',
            'data': event['payload']
        })

    async def no_driver_available(self, event):
        """Notifies customer that overall search deadline elapsed with no driver."""
        await self.send_json({
            'event': 'no_driver_available',
            'data': event['payload']
        })

    async def ride_completed(self, event):
        """Notifies customer that trip has completed."""
        await self.send_json({
            'event': 'ride_completed',
            'data': event['payload']
        })

    async def ride_cancelled(self, event):
        """Notifies customer of ride cancellation."""
        await self.send_json({
            'event': 'ride_cancelled',
            'data': event['payload']
        })
