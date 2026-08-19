import uuid
from django.db import models
from users.models import User
from drivers.models import Driver
from services.models import Service
from vehicles.models import VehicleType


class Booking(models.Model):
    class BookingStatus(models.TextChoices):
        SEARCHING = 'Searching', 'Searching for Driver'
        ACCEPTED = 'Accepted', 'Driver Accepted'
        ARRIVED = 'Arrived', 'Driver Arrived'
        IN_TRIP = 'In Trip', 'In Trip'
        COMPLETED = 'Completed', 'Completed'
        CANCELLED = 'Cancelled', 'Cancelled'

    class PaymentStatus(models.TextChoices):
        PENDING = 'Pending', 'Pending'
        PAID = 'Paid', 'Paid'
        REFUNDED = 'Refunded', 'Refunded'
        FAILED = 'Failed', 'Failed'
    class PaymentMethod(models.TextChoices):
        COD = 'COD', 'Cash'
        ONLINE = 'Online', 'Online Payment'
        RAAHGO_WALLET = 'RaahGo Wallet', 'RaahGo Wallet'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking_number = models.CharField(max_length=30, unique=True)
    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='bookings'
    )
    driver = models.ForeignKey(
        Driver,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='driver_bookings'
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name='bookings'
    )
    vehicle_type = models.ForeignKey(
        VehicleType,
        on_delete=models.PROTECT,
        related_name='bookings'
    )
    status = models.CharField(
        max_length=20,
        choices=BookingStatus.choices,
        default=BookingStatus.SEARCHING
    )
    pickup_address = models.TextField()
    dropoff_address = models.TextField()
    pickup_latitude = models.DecimalField(max_digits=10, decimal_places=7)
    pickup_longitude = models.DecimalField(max_digits=10, decimal_places=7)
    dropoff_latitude = models.DecimalField(max_digits=10, decimal_places=7)
    dropoff_longitude = models.DecimalField(max_digits=10, decimal_places=7)
    distance_km = models.DecimalField(max_digits=8, decimal_places=2, default=0.0)
    estimated_duration_mins = models.PositiveIntegerField(default=0)
    base_fare = models.DecimalField(max_digits=10, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    total_fare = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.COD
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING
    )
    ride_pin = models.CharField(max_length=10, default='4829')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bookings'
        verbose_name = 'Booking'
        verbose_name_plural = 'Bookings'

    def __str__(self):
        return f"Booking #{self.booking_number} ({self.status})"


class RideDetail(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name='ride_detail'
    )
    passenger_count = models.PositiveIntegerField(default=1)
    notes_for_driver = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'ride_details'
        verbose_name = 'Ride Detail'
        verbose_name_plural = 'Ride Details'

    def __str__(self):
        return f"Ride Detail for #{self.booking.booking_number}"


class ParcelDetail(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name='parcel_detail'
    )
    receiver_name = models.CharField(max_length=150)
    receiver_phone = models.CharField(max_length=15)
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2)
    parcel_type = models.CharField(max_length=100)
    special_instructions = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'parcel_details'
        verbose_name = 'Parcel Detail'
        verbose_name_plural = 'Parcel Details'

    def __str__(self):
        return f"Parcel Detail for #{self.booking.booking_number}"


class MovingDetail(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name='moving_detail'
    )
    helpers_count = models.PositiveIntegerField(default=0)
    pickup_floor = models.PositiveIntegerField(default=0)
    dropoff_floor = models.PositiveIntegerField(default=0)
    has_elevator_pickup = models.BooleanField(default=False)
    has_elevator_dropoff = models.BooleanField(default=False)
    items_description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'moving_details'
        verbose_name = 'Moving Detail'
        verbose_name_plural = 'Moving Details'

    def __str__(self):
        return f"Moving Detail for #{self.booking.booking_number}"


class BookingTracking(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='tracking_history'
    )
    status = models.CharField(max_length=30)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'booking_trackings'
        verbose_name = 'Booking Tracking'
        verbose_name_plural = 'Booking Trackings'

    def __str__(self):
        return f"Tracking #{self.booking.booking_number} - {self.status}"
