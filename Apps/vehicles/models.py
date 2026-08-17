import uuid
from django.db import models
from drivers.models import Driver


class VehicleType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)
    capacity_passengers = models.PositiveIntegerField(default=1)
    capacity_weight_kg = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0.0
    )
    icon_url = models.CharField(max_length=500, blank=True, null=True)
    base_fare = models.DecimalField(max_digits=10, decimal_places=2)
    per_km_rate = models.DecimalField(max_digits=10, decimal_places=2)
    per_minute_rate = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'vehicle_types'
        verbose_name = 'Vehicle Type'
        verbose_name_plural = 'Vehicle Types'

    def __str__(self):
        return self.name


class Vehicle(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(
        Driver,
        on_delete=models.CASCADE,
        related_name='vehicles'
    )
    vehicle_type = models.ForeignKey(
        VehicleType,
        on_delete=models.PROTECT,
        related_name='vehicles'
    )
    registration_number = models.CharField(max_length=30, unique=True)
    make = models.CharField(max_length=50)
    model = models.CharField(max_length=50)
    year = models.PositiveIntegerField()
    color = models.CharField(max_length=30)
    is_active = models.BooleanField(default=True)
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'vehicles'
        verbose_name = 'Vehicle'
        verbose_name_plural = 'Vehicles'

    def clean(self):
        super().clean()
        if self.is_active and self.driver:
            existing = Vehicle.objects.filter(driver=self.driver, is_active=True).exclude(pk=self.pk)
            if existing.exists():
                # Will be auto-deactivated on save, but raise validation error if explicitly validating
                pass

    def save(self, *args, **kwargs):
        # Business Rule: A driver can have at most 1 active vehicle.
        # If saving an active vehicle, deactivate all other vehicles for this driver.
        if self.is_active and self.driver:
            Vehicle.objects.filter(driver=self.driver, is_active=True).exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)

    def __str__(self):
        status_str = "Active" if self.is_active else "Inactive"
        return f"{self.make} {self.model} ({self.registration_number}) - {status_str}"
