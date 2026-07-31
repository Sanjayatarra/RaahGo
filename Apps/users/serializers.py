from rest_framework import serializers
from .models import User, UserAddress, OTPVerification, UserDevice


class UserSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        role = attrs.get('role', getattr(self.instance, 'role', User.RoleChoices.CUSTOMER))
        queryset = User.objects.filter(role=role)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        checks = (
            ('username', 'username', 'A user with this username already exists for this role.'),
            ('email', 'email__iexact', 'A user with this email already exists for this role.'),
            ('phone_number', 'phone_number', 'A user with this mobile number already exists for this role.'),
        )
        errors = {}
        for field, lookup, message in checks:
            value = attrs.get(field)
            if value and queryset.filter(**{lookup: value}).exists():
                errors[field] = message
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    class Meta:
        model = User
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True}
        }


class UserAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAddress
        fields = '__all__'


class OTPVerificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = OTPVerification
        fields = '__all__'


class UserDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserDevice
        fields = '__all__'
