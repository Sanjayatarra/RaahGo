from rest_framework import serializers
from .models import DriverLocation


class DriverLocationSerializer(serializers.ModelSerializer):
    driver_name = serializers.ReadOnlyField(source='driver.user.username')

    class Meta:
        model = DriverLocation
        fields = '__all__'
