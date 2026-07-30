import uuid
from django.db import models
from users.models import User


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        SYSTEM = 'System', 'System Notification'
        BOOKING = 'Booking', 'Booking Notification'
        PAYMENT = 'Payment', 'Payment Notification'
        PROMOTIONAL = 'Promotional', 'Promotional Notification'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=200)
    body = models.TextField()
    notification_type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM
    )
    is_read = models.BooleanField(default=False)
    data_payload = models.JSONField(default=dict, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'

    def __str__(self):
        return f"Notification to {self.user.username}: {self.title}"
