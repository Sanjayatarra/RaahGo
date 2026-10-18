import time
import logging
from django.core.management.base import BaseCommand
from django.utils import timezone

from bookings.models import Booking, RideOffer
from bookings.matching_service import MatchingService
from tracking.redis_client import RedisPresenceService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run background matching worker to poll searching rides, clean stale GEO members, and expire outdated offers."

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=float,
            default=2.0,
            help='Polling interval in seconds (default: 2.0)'
        )

    def handle(self, *args, **options):
        interval = options['interval']
        self.stdout.write(self.style.SUCCESS(f"[*] Starting RaahGo Matching Background Worker (interval={interval}s)..."))

        last_stale_cleanup = 0.0

        while True:
            now_ts = time.time()
            try:
                # 1. Clean stale drivers from Redis GEO set (older than 30s) every 15 seconds
                if now_ts - last_stale_cleanup >= 15.0:
                    cleaned = RedisPresenceService.clean_stale_geo_members(max_age_seconds=30)
                    if cleaned > 0:
                        self.stdout.write(f"[GEO Cleanup] Removed {cleaned} stale drivers from GEO index.")
                    last_stale_cleanup = now_ts

                # 2. Expire outdated MySQL offers older than their expiry time
                expired_count = RideOffer.objects.filter(
                    status=RideOffer.OfferStatus.PENDING,
                    expires_at__lte=timezone.now()
                ).update(status=RideOffer.OfferStatus.EXPIRED)
                if expired_count > 0:
                    self.stdout.write(f"[Offer Cleanup] Expired {expired_count} timed-out ride offers.")

                # 3. Discover unassigned SEARCHING rides that need matching
                searching_bookings = Booking.objects.filter(
                    status=Booking.BookingStatus.SEARCHING
                ).values_list('id', flat=True)[:10]

                for b_id in searching_bookings:
                    MatchingService.start_matching_for_booking(b_id)

            except Exception as e:
                self.stderr.write(self.style.ERROR(f"[Worker Error] {e}"))

            time.sleep(interval)
