from rest_framework import serializers
from .models import VehicleType, Vehicle


class VehicleTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleType
        fields = '__all__'


class VehicleSerializer(serializers.ModelSerializer):
    vehicle_type_name = serializers.ReadOnlyField(source='vehicle_type.name')

    class Meta:
        model = Vehicle
        fields = '__all__'
