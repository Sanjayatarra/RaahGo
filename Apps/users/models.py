import uuid
from django.db import models


class User(models.Model):
    class GenderChoices(models.TextChoices):
        MALE = 'Male', 'Male'
        FEMALE = 'Female', 'Female'
        OTHER = 'Other', 'Other'

    class RoleChoices(models.TextChoices):
        CUSTOMER = 'Customer', 'Customer'
        DRIVER = 'Driver', 'Driver'
        ADMIN = 'Admin', 'Admin'
        SUPER_ADMIN = 'Super Admin', 'Super Admin'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)
    first_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField(unique=True, null=True, blank=True)
    phone_number = models.CharField(max_length=15, unique=True, null=True, blank=True)
    password = models.CharField(max_length=255, null=True, blank=True)
    profile_image = models.CharField(max_length=500, blank=True, null=True)
    gender = models.CharField(
        max_length=10,
        choices=GenderChoices.choices,
        blank=True,
        null=True
    )
    date_of_birth = models.DateField(null=True, blank=True)
    role = models.CharField(
        max_length=20,
        choices=RoleChoices.choices,
        default=RoleChoices.CUSTOMER
    )
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    is_phone_verified = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    last_login = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.username} ({self.role})"


class UserAddress(models.Model):
    class TitleChoices(models.TextChoices):
        HOME = 'Home', 'Home'
        WORK = 'Work', 'Work'
        OTHER = 'Other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='addresses'
    )
    title = models.CharField(
        max_length=30,
        choices=TitleChoices.choices,
        default=TitleChoices.HOME
    )
    contact_name = models.CharField(max_length=150, blank=True, null=True)
    contact_phone = models.CharField(max_length=15, blank=True, null=True)
    address_line_1 = models.TextField()
    address_line_2 = models.TextField(blank=True, null=True)
    landmark = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100, default='India')
    postal_code = models.CharField(max_length=10)
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True
    )
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_addresses'
        verbose_name = 'User Address'
        verbose_name_plural = 'User Addresses'

    def __str__(self):
        return f"{self.title} - {self.user.username}"


class OTPVerification(models.Model):
    class PurposeChoices(models.TextChoices):
        REGISTER = 'Register', 'Register'
        LOGIN = 'Login', 'Login'
        RESET_PASSWORD = 'Reset Password', 'Reset Password'
        CHANGE_PHONE = 'Change Phone', 'Change Phone'
        CHANGE_EMAIL = 'Change Email', 'Change Email'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='otp_verifications'
    )
    phone_number = models.CharField(max_length=15, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    otp = models.CharField(max_length=6)
    purpose = models.CharField(
        max_length=20,
        choices=PurposeChoices.choices
    )
    expires_at = models.DateTimeField()
    attempts = models.IntegerField(default=0)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'otp_verifications'
        verbose_name = 'OTP Verification'
        verbose_name_plural = 'OTP Verifications'

    def __str__(self):
        target = self.email or self.phone_number or "N/A"
        return f"{target} - {self.purpose} ({'Verified' if self.is_verified else 'Pending'})"


class UserDevice(models.Model):
    class DeviceTypeChoices(models.TextChoices):
        ANDROID = 'Android', 'Android'
        IOS = 'iOS', 'iOS'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='devices'
    )
    device_type = models.CharField(
        max_length=10,
        choices=DeviceTypeChoices.choices
    )
    firebase_token = models.TextField(blank=True, null=True)
    app_version = models.CharField(max_length=20, blank=True, null=True)
    device_name = models.CharField(max_length=100, blank=True, null=True)
    last_active = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_devices'
        verbose_name = 'User Device'
        verbose_name_plural = 'User Devices'

    def __str__(self):
        return f"{self.user.username} - {self.device_name or self.device_type}"
