import uuid
from django.db import models
from users.models import User


class Driver(models.Model):
    class ApprovalStatus(models.TextChoices):
        PENDING = 'Pending', 'Pending'
        APPROVED = 'Approved', 'Approved'
        REJECTED = 'Rejected', 'Rejected'
        SUSPENDED = 'Suspended', 'Suspended'

    class AvailabilityStatus(models.TextChoices):
        OFFLINE = 'Offline', 'Offline'
        ONLINE = 'Online', 'Online'
        IN_TRIP = 'In Trip', 'In Trip'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='driver_profile'
    )
    license_number = models.CharField(max_length=50, unique=True)
    license_expiry = models.DateField(null=True, blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.00)
    total_trips = models.PositiveIntegerField(default=0)
    approval_status = models.CharField(
        max_length=20,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING
    )
    availability_status = models.CharField(
        max_length=20,
        choices=AvailabilityStatus.choices,
        default=AvailabilityStatus.OFFLINE
    )
    current_latitude = models.DecimalField(max_digits=12, decimal_places=7, null=True, blank=True)
    current_longitude = models.DecimalField(max_digits=12, decimal_places=7, null=True, blank=True)
    last_location_update = models.DateTimeField(null=True, blank=True)
    daily_online_seconds = models.PositiveIntegerField(default=0)
    last_online_start = models.DateTimeField(null=True, blank=True)
    last_duty_reset_date = models.DateField(null=True, blank=True)
    terms_accepted = models.BooleanField(default=False)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def get_current_daily_online_seconds(self):
        from django.utils import timezone
        today = timezone.now().date()
        
        # Reset counter if new day
        if self.last_duty_reset_date != today:
            return 0

        total_sec = self.daily_online_seconds
        if self.availability_status in [self.AvailabilityStatus.ONLINE, self.AvailabilityStatus.IN_TRIP] and self.last_online_start:
            # If last_online_start was before today, clamp to beginning of today
            midnight_today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            effective_start = max(self.last_online_start, midnight_today)
            session_sec = int((timezone.now() - effective_start).total_seconds())
            total_sec += max(0, session_sec)

        return min(total_sec, 43200) # 12 Hours Max limit (43,200 seconds)

    class Meta:
        db_table = 'drivers'
        verbose_name = 'Driver'
        verbose_name_plural = 'Drivers'

    def __str__(self):
        return f"Driver: {self.user.username} ({self.approval_status})"


class DriverDocument(models.Model):
    class DocumentType(models.TextChoices):
        LICENSE = 'License', 'Driving License'
        RC = 'RC', 'Registration Certificate'
        INSURANCE = 'Insurance', 'Vehicle Insurance'
        PERMIT = 'Permit', 'Commercial Permit'
        BACKGROUND_CHECK = 'Background Check', 'Background Check'

    class VerificationStatus(models.TextChoices):
        PENDING = 'Pending', 'Pending'
        VERIFIED = 'Verified', 'Verified'
        REJECTED = 'Rejected', 'Rejected'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(
        Driver,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    document_type = models.CharField(
        max_length=30,
        choices=DocumentType.choices
    )
    document_number = models.CharField(max_length=100, blank=True, null=True)
    document_url = models.CharField(max_length=500)
    expiry_date = models.DateField(null=True, blank=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING
    )
    rejection_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'driver_documents'
        verbose_name = 'Driver Document'
        verbose_name_plural = 'Driver Documents'

    def __str__(self):
        return f"{self.driver.user.username} - {self.document_type}"


class DriverBankAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(
        Driver,
        on_delete=models.CASCADE,
        related_name='bank_accounts'
    )
    account_holder_name = models.CharField(max_length=150)
    account_number = models.CharField(max_length=50)
    ifsc_code = models.CharField(max_length=20)
    bank_name = models.CharField(max_length=100)
    is_verified = models.BooleanField(default=False)
    is_primary = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'driver_bank_accounts'
        verbose_name = 'Driver Bank Account'
        verbose_name_plural = 'Driver Bank Accounts'

    def __str__(self):
        return f"{self.bank_name} - {self.account_number[-4:]} ({self.driver.user.username})"


class DriverEmergencyContact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(
        Driver,
        on_delete=models.CASCADE,
        related_name='emergency_contacts'
    )
    name = models.CharField(max_length=150)
    relationship = models.CharField(max_length=50)
    phone_number = models.CharField(max_length=15)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'driver_emergency_contacts'
        verbose_name = 'Driver Emergency Contact'
        verbose_name_plural = 'Driver Emergency Contacts'

    def __str__(self):
        return f"{self.name} ({self.relationship}) for {self.driver.user.username}"
