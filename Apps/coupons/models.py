import uuid
from django.db import models


class Coupon(models.Model):
    class DiscountType(models.TextChoices):
        FLAT = 'Flat', 'Flat Amount'
        PERCENTAGE = 'Percentage', 'Percentage Rate'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    discount_type = models.CharField(
        max_length=20,
        choices=DiscountType.choices
    )
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    max_discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    min_booking_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00
    )
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    usage_limit = models.PositiveIntegerField(default=100)
    times_used = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'coupons'
        verbose_name = 'Coupon'
        verbose_name_plural = 'Coupons'

    def __str__(self):
        return f"Coupon Code: {self.code} ({self.discount_value} {self.discount_type})"
