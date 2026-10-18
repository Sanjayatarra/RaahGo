"""
Redis Client & Presence/Location Service for RaahGo
====================================================
Manages:
1. High-frequency driver GPS updates & heartbeat presence in Redis (bypassing continuous MySQL writes).
2. Redis GEO sets for spatial indexing (drivers:geo and drivers:geo:<vehicle_type>).
3. Stale driver detection & cleaning (30s threshold).
4. Atomic offer reservations (SET ... NX EX) with atomic Lua release verification.
5. Customer live location tracking.
"""

import os
import time
import json
import logging
from typing import List, Dict, Optional, Tuple
import redis

logger = logging.getLogger(__name__)

# Reusable connection pool
_pool: Optional[redis.ConnectionPool] = None


def get_redis_client() -> redis.Redis:
    """Return a thread-safe Redis client instance backed by a connection pool."""
    global _pool
    if _pool is None:
        _pool = redis.ConnectionPool(
            host=os.environ.get('REDIS_HOST', '127.0.0.1'),
            port=os.environ.get('REDIS_PORT', 6379),
            db=os.environ.get('REDIS_DB', 0),
            decode_responses=True
        )
    return redis.Redis(connection_pool=_pool)


# Lua script for atomic reservation release: only delete if the token matches
RELEASE_RESERVATION_LUA = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


class RedisPresenceService:
    """Service handling driver presence, heartbeats, GEO indexing, and offer reservations."""

    @classmethod
    def _normalize_vtype(cls, vehicle_type: Optional[str]) -> str:
        if not vehicle_type:
            return 'standard'
        v = str(vehicle_type).strip().lower()
        if 'bike' in v or 'two' in v or 'moto' in v:
            return 'bike'
        if 'auto' in v or 'rick' in v:
            return 'auto'
        if 'truck' in v or 'tempo' in v or 'freight' in v:
            return 'freight'
        if 'comfort' in v or 'sedan' in v or 'premium' in v:
            return 'comfort'
        return 'cab'

    # ──────────────────────────────────────────────────────────────────────────
    # 1. Driver Presence & Frequent GPS Updates
    # ──────────────────────────────────────────────────────────────────────────

    @classmethod
    def update_driver_location(
        cls,
        driver_id: str,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        vehicle_type: Optional[str] = None,
        is_online: bool = True,
        is_available: bool = True,
        heading: float = 0.0,
        speed: float = 0.0,
        active_ride_id: Optional[str] = None,
        **kwargs
    ) -> bool:
        """
        Record driver live GPS coordinates and presence state in Redis.
        Updates both the driver's presence hash and spatial GEO indexes.
        Supports both (lat, lng) and (latitude, longitude) kwargs.
        """
        if lat is None:
            lat = kwargs.get('latitude', 0.0)
        if lng is None:
            lng = kwargs.get('longitude', 0.0)
        lat = float(lat)
        lng = float(lng)

        r = get_redis_client()
        now = time.time()
        ttl = int(os.getenv('DRIVER_PRESENCE_TTL_SECONDS', 60))
        norm_vtype = cls._normalize_vtype(vehicle_type)

        presence_key = f"driver:presence:{driver_id}"
        geo_all_key = "drivers:geo"
        geo_vtype_key = f"drivers:geo:{norm_vtype}"

        try:
            pipe = r.pipeline()
            # 1. Update presence hash
            pipe.hset(presence_key, mapping={
                'driver_id': str(driver_id),
                'lat': str(lat),
                'lng': str(lng),
                'vehicle_type': norm_vtype,
                'raw_vehicle_type': str(vehicle_type),
                'is_online': '1' if is_online else '0',
                'is_available': '1' if is_available else '0',
                'active_ride_id': str(active_ride_id or ''),
                'heading': str(heading),
                'speed': str(speed),
                'last_heartbeat': str(now),
                'updated_at': str(now)
            })
            pipe.expire(presence_key, ttl)

            # 2. Update GEO index only if driver is online and available
            if is_online and is_available and not active_ride_id:
                pipe.geoadd(geo_all_key, (lng, lat, str(driver_id)))
                pipe.geoadd(geo_vtype_key, (lng, lat, str(driver_id)))
            else:
                pipe.zrem(geo_all_key, str(driver_id))
                pipe.zrem(geo_vtype_key, str(driver_id))

            pipe.execute()
            return True
        except Exception as e:
            logger.error(f"[RedisPresence] update_driver_location error for driver {driver_id}: {e}")
            return False

    @classmethod
    def record_heartbeat(cls, driver_id: str) -> bool:
        """Update driver heartbeat timestamp and refresh key expiration."""
        r = get_redis_client()
        now = time.time()
        ttl = int(os.getenv('DRIVER_PRESENCE_TTL_SECONDS', 60))
        presence_key = f"driver:presence:{driver_id}"
        try:
            if r.exists(presence_key):
                r.hset(presence_key, 'last_heartbeat', str(now))
                r.expire(presence_key, ttl)
                return True
            return False
        except Exception as e:
            logger.error(f"[RedisPresence] record_heartbeat error for {driver_id}: {e}")
            return False

    @classmethod
    def get_driver_presence(cls, driver_id: str) -> Optional[Dict]:
        """Fetch current driver presence state from Redis."""
        r = get_redis_client()
        presence_key = f"driver:presence:{driver_id}"
        try:
            data = r.hgetall(presence_key)
            if not data:
                return None
            return {
                'driver_id': data.get('driver_id', str(driver_id)),
                'lat': float(data['lat']) if 'lat' in data else None,
                'lng': float(data['lng']) if 'lng' in data else None,
                'vehicle_type': data.get('vehicle_type', 'standard'),
                'raw_vehicle_type': data.get('raw_vehicle_type', ''),
                'is_online': data.get('is_online') == '1',
                'is_available': data.get('is_available') == '1',
                'active_ride_id': data.get('active_ride_id') or None,
                'heading': float(data.get('heading', 0.0)),
                'speed': float(data.get('speed', 0.0)),
                'last_heartbeat': float(data.get('last_heartbeat', 0.0)),
                'updated_at': float(data.get('updated_at', 0.0))
            }
        except Exception as e:
            logger.error(f"[RedisPresence] get_driver_presence error for {driver_id}: {e}")
            return None

    @classmethod
    def set_driver_busy(cls, driver_id: str, active_ride_id: str) -> bool:
        """
        Mark driver as busy with an assigned ride (backend authority only).
        Removes driver from available GEO search index.
        """
        r = get_redis_client()
        presence_key = f"driver:presence:{driver_id}"
        geo_all_key = "drivers:geo"
        try:
            vtype = r.hget(presence_key, 'vehicle_type') or 'standard'
            geo_vtype_key = f"drivers:geo:{vtype}"

            pipe = r.pipeline()
            pipe.hset(presence_key, mapping={
                'is_available': '0',
                'active_ride_id': str(active_ride_id),
                'updated_at': str(time.time())
            })
            pipe.zrem(geo_all_key, str(driver_id))
            pipe.zrem(geo_vtype_key, str(driver_id))
            pipe.execute()
            return True
        except Exception as e:
            logger.error(f"[RedisPresence] set_driver_busy error: {e}")
            return False

    @classmethod
    def set_driver_available(cls, driver_id: str, vehicle_type: Optional[str] = None) -> bool:
        """
        Mark driver as free and available again after ride completion or cancellation.
        Re-indexes driver in GEO search if online.
        Optionally updates the stored vehicle_type when provided.
        """
        r = get_redis_client()
        presence_key = f"driver:presence:{driver_id}"
        geo_all_key = "drivers:geo"
        try:
            data = r.hgetall(presence_key)
            if not data:
                return False

            is_online = data.get('is_online') == '1'
            lat = data.get('lat')
            lng = data.get('lng')
            vtype = vehicle_type or data.get('vehicle_type', 'standard')
            geo_vtype_key = f"drivers:geo:{vtype}"

            hset_mapping = {
                'is_available': '1',
                'active_ride_id': '',
                'updated_at': str(time.time())
            }
            if vehicle_type:
                hset_mapping['vehicle_type'] = vehicle_type

            pipe = r.pipeline()
            pipe.hset(presence_key, mapping=hset_mapping)
            if is_online and lat and lng:
                pipe.geoadd(geo_all_key, (float(lng), float(lat), str(driver_id)))
                pipe.geoadd(geo_vtype_key, (float(lng), float(lat), str(driver_id)))
            pipe.execute()
            return True
        except Exception as e:
            logger.error(f"[RedisPresence] set_driver_available error: {e}")
            return False

    @classmethod
    def set_driver_offline(cls, driver_id: str, vehicle_type: Optional[str] = None) -> bool:
        """Mark driver as offline and purge from all GEO indexes.
        Optionally accepts vehicle_type to ensure the correct GEO key is cleared.
        """
        r = get_redis_client()
        presence_key = f"driver:presence:{driver_id}"
        geo_all_key = "drivers:geo"
        try:
            vtype = vehicle_type or r.hget(presence_key, 'vehicle_type') or 'standard'
            geo_vtype_key = f"drivers:geo:{vtype}"

            hset_mapping = {
                'is_online': '0',
                'is_available': '0',
                'updated_at': str(time.time())
            }
            if vehicle_type:
                hset_mapping['vehicle_type'] = vehicle_type

            pipe = r.pipeline()
            pipe.hset(presence_key, mapping=hset_mapping)
            pipe.zrem(geo_all_key, str(driver_id))
            pipe.zrem(geo_vtype_key, str(driver_id))
            pipe.execute()
            return True
        except Exception as e:
            logger.error(f"[RedisPresence] set_driver_offline error: {e}")
            return False

    # ──────────────────────────────────────────────────────────────────────────
    # 2. Customer Live Location Tracking
    # ──────────────────────────────────────────────────────────────────────────

    @classmethod
    def update_customer_location(cls, customer_id: str, lat: float, lng: float, booking_id: Optional[str] = None) -> bool:
        """Store customer live location in Redis."""
        r = get_redis_client()
        key = f"customer:location:{customer_id}"
        now = time.time()
        try:
            r.hset(key, mapping={
                'customer_id': str(customer_id),
                'lat': str(lat),
                'lng': str(lng),
                'booking_id': str(booking_id or ''),
                'updated_at': str(now)
            })
            r.expire(key, 60)
            return True
        except Exception as e:
            logger.error(f"[RedisPresence] update_customer_location error: {e}")
            return False

    @classmethod
    def get_customer_location(cls, customer_id: str) -> Optional[Dict]:
        """Retrieve customer live location from Redis."""
        r = get_redis_client()
        key = f"customer:location:{customer_id}"
        try:
            data = r.hgetall(key)
            if not data or 'lat' not in data:
                return None
            return {
                'customer_id': str(customer_id),
                'lat': float(data['lat']),
                'lng': float(data['lng']),
                'booking_id': data.get('booking_id') or None,
                'updated_at': float(data.get('updated_at', 0.0))
            }
        except Exception as e:
            logger.error(f"[RedisPresence] get_customer_location error: {e}")
            return None

    # ──────────────────────────────────────────────────────────────────────────
    # 3. Spatial Search (GEOSEARCH) & Stale Cleaning
    # ──────────────────────────────────────────────────────────────────────────

    @classmethod
    def find_nearby_eligible_drivers(
        cls,
        pickup_lat: float,
        pickup_lng: float,
        radius_km: float = 2.0,
        vehicle_type: Optional[str] = None,
        limit: int = 15,
        excluded_driver_ids: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Perform spatial search using Redis GEOSEARCH.
        Filters out:
        - Mismatched vehicle types
        - Stale locations / heartbeats older than DRIVER_HEARTBEAT_TIMEOUT_SECONDS (30s)
        - Drivers not online or not available
        - Drivers with an active ride
        - Drivers currently holding an active pending offer reservation
        - Drivers in excluded_driver_ids (who rejected this ride)

        Also purges stale GEO members encountered during search.
        Returns a sorted list of eligible candidates with geographic distance.
        """
        r = get_redis_client()
        now = time.time()
        timeout = int(os.getenv('DRIVER_HEARTBEAT_TIMEOUT_SECONDS', 30))
        norm_vtype = cls._normalize_vtype(vehicle_type) if vehicle_type else None
        geo_key = f"drivers:geo:{norm_vtype}" if norm_vtype else "drivers:geo"
        excluded_set = set(str(d) for d in (excluded_driver_ids or []))

        # Check if index exists
        if not r.exists(geo_key):
            # Fall back to main GEO index if vehicle-specific set is empty
            geo_key = "drivers:geo"
            if not r.exists(geo_key):
                return []

        try:
            # Redis GEOSEARCH: returns [(member, distance_km, (lng, lat)), ...]
            raw_results = r.geosearch(
                name=geo_key,
                longitude=float(pickup_lng),
                latitude=float(pickup_lat),
                radius=float(radius_km),
                unit='km',
                withdist=True,
                withcoord=True,
                sort='ASC',
                count=limit * 2
            )
        except Exception as e:
            logger.error(f"[RedisPresence] geosearch error on {geo_key}: {e}")
            return []

        eligible = []
        stale_driver_ids = []

        for item in raw_results:
            # item format: [member_id, distance_km, (lng, lat)]
            driver_id = item[0]
            dist_km = float(item[1])
            coords = item[2] if len(item) > 2 else None

            if driver_id in excluded_set:
                continue

            presence = cls.get_driver_presence(driver_id)

            # Check if presence key expired or stale
            if not presence:
                stale_driver_ids.append(driver_id)
                continue

            # Heartbeat freshness check (<= 30 seconds)
            last_activity = max(presence.get('last_heartbeat', 0), presence.get('updated_at', 0))
            if (now - last_activity) > timeout:
                stale_driver_ids.append(driver_id)
                continue

            # Online and available checks
            if not presence.get('is_online') or not presence.get('is_available'):
                stale_driver_ids.append(driver_id)
                continue

            # Active ride check (must have no active ride)
            if presence.get('active_ride_id'):
                stale_driver_ids.append(driver_id)
                continue

            # Vehicle type match check
            if norm_vtype and presence.get('vehicle_type') != norm_vtype:
                # Driver does not match requested vehicle type
                continue

            # Check if driver is already holding an offer reservation (1 offer at a time)
            if cls.has_active_offer_reservation(driver_id):
                continue

            eligible.append({
                'driver_id': driver_id,
                'distance_km': round(dist_km, 3), # Strictly geographic distance
                'lat': coords[1] if coords else presence.get('lat'),
                'lng': coords[0] if coords else presence.get('lng'),
                'vehicle_type': presence.get('vehicle_type'),
                'raw_vehicle_type': presence.get('raw_vehicle_type')
            })

            if len(eligible) >= limit:
                break

        # Clean stale members from Redis GEO index asynchronously/in-pipeline
        if stale_driver_ids:
            try:
                pipe = r.pipeline()
                for sid in stale_driver_ids:
                    pipe.zrem("drivers:geo", sid)
                    if norm_vtype:
                        pipe.zrem(f"drivers:geo:{norm_vtype}", sid)
                pipe.execute()
                logger.info(f"[RedisPresence] Cleaned {len(stale_driver_ids)} stale members from {geo_key}")
            except Exception as e:
                logger.warning(f"[RedisPresence] Error cleaning stale members: {e}")

        return eligible

    @classmethod
    def clean_stale_geo_members(cls, max_age_seconds: int = 30) -> int:
        """
        Scan GEO index members and evict drivers whose presence key has expired
        or whose heartbeat/update timestamp is older than max_age_seconds.
        Ensures that key expiry does not leave ghost entries in GEO sorted sets.
        """
        r = get_redis_client()
        geo_all_key = "drivers:geo"
        now = time.time()
        cleaned_count = 0

        try:
            all_drivers = r.zrange(geo_all_key, 0, -1)
            if not all_drivers:
                return 0

            stale_to_remove = []
            for did in all_drivers:
                presence_key = f"driver:presence:{did}"
                presence_data = r.hgetall(presence_key)
                if not presence_data:
                    stale_to_remove.append(did)
                    continue

                last_hb = float(presence_data.get('last_heartbeat', 0))
                updated = float(presence_data.get('updated_at', 0))
                last_activity = max(last_hb, updated)

                if (now - last_activity) > max_age_seconds:
                    stale_to_remove.append(did)

            if stale_to_remove:
                pipe = r.pipeline()
                for s_id in stale_to_remove:
                    pipe.zrem(geo_all_key, s_id)
                # Purge from vehicle type specific keys
                for v_key in r.keys("drivers:geo:*"):
                    for s_id in stale_to_remove:
                        pipe.zrem(v_key, s_id)
                pipe.execute()
                cleaned_count = len(stale_to_remove)
                logger.info(f"[RedisPresence] clean_stale_geo_members evicted {cleaned_count} stale drivers.")

            return cleaned_count
        except Exception as e:
            logger.error(f"[RedisPresence] clean_stale_geo_members error: {e}")
            return 0

    # ──────────────────────────────────────────────────────────────────────────
    # 4. Atomic Offer Reservations (SET ... NX EX) & Token-Validated Release
    # ──────────────────────────────────────────────────────────────────────────

    @classmethod
    def acquire_driver_reservation(cls, driver_id: str, token: str, ttl_seconds: int = 18) -> bool:
        """
        Acquire an exclusive offer reservation for a driver.
        Uses Redis SET ... NX EX to ensure a driver receives AT MOST ONE pending offer at a time.
        Returns True if acquired, False if driver already reserved.
        """
        r = get_redis_client()
        key = f"driver:offer_reservation:{driver_id}"
        try:
            # Set key to token ONLY if it does not exist, with expiration
            acquired = r.set(key, token, ex=ttl_seconds, nx=True)
            return bool(acquired)
        except Exception as e:
            logger.error(f"[RedisPresence] acquire_driver_reservation error for {driver_id}: {e}")
            return False

    @classmethod
    def release_driver_reservation(cls, driver_id: str, token: str) -> bool:
        """
        Release driver offer reservation safely using atomic Lua script.
        Only deletes if the stored token matches the provided token.
        Prevents old cleanup jobs from releasing newer reservations.
        """
        r = get_redis_client()
        key = f"driver:offer_reservation:{driver_id}"
        try:
            result = r.eval(RELEASE_RESERVATION_LUA, 1, key, token)
            return result == 1
        except Exception as e:
            logger.error(f"[RedisPresence] release_driver_reservation error for {driver_id}: {e}")
            return False

    @classmethod
    def has_active_offer_reservation(cls, driver_id: str) -> bool:
        """Check if driver currently has an active pending offer reservation in Redis."""
        r = get_redis_client()
        key = f"driver:offer_reservation:{driver_id}"
        try:
            return bool(r.exists(key))
        except Exception:
            return False

    @classmethod
    def clear_driver(cls, driver_id: str, vehicle_type: Optional[str] = None):
        """Purge driver from presence, reservations, and GEO indexes (used in testing and resets)."""
        r = get_redis_client()
        d_str = str(driver_id)
        pipe = r.pipeline()
        pipe.delete(f"driver:presence:{d_str}")
        pipe.delete(f"driver:offer_reservation:{d_str}")
        pipe.zrem("drivers:geo", d_str)
        if vehicle_type:
            pipe.zrem(f"drivers:geo:{vehicle_type.lower()}", d_str)
        pipe.execute()


# Aliases for backward compatibility and alternate nomenclature
RedisPresenceService.reserve_driver_for_offer = RedisPresenceService.acquire_driver_reservation
RedisPresenceService.release_offer_reservation = RedisPresenceService.release_driver_reservation
