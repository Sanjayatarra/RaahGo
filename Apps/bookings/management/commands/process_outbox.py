import time
import logging
from django.core.management.base import BaseCommand

from bookings.outbox_service import OutboxService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run durable Outbox polling worker to process pending messages and retries."

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=float,
            default=1.0,
            help='Polling interval in seconds (default: 1.0)'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=50,
            help='Batch size of outbox messages to process (default: 50)'
        )

    def handle(self, *args, **options):
        interval = options['interval']
        batch_size = options['batch_size']
        self.stdout.write(self.style.SUCCESS(f"[*] Starting RaahGo Outbox Worker (interval={interval}s, batch={batch_size})..."))

        while True:
            try:
                processed = OutboxService.process_pending_outbox_batch(limit=batch_size)
                if processed > 0:
                    self.stdout.write(f"[Outbox Worker] Processed {processed} messages.")
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"[Outbox Worker Error] {e}"))

            time.sleep(interval)
