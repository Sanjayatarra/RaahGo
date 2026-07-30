import uuid
from django.db import models
from drivers.models import Driver


class DriverLocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(
        Driver,
        on_delete=models.CASCADE,
        related_name='locations'
    )
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    heading = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    speed = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    is_online = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'driver_locations'
        verbose_name = 'Driver Location'
        verbose_name_plural = 'Driver Locations'

    def __str__(self):
        return f"{self.driver.user.username} - ({self.latitude}, {self.longitude})"
