from rest_framework import serializers
from .models import Driver, DriverDocument, DriverBankAccount, DriverEmergencyContact, get_max_duty_seconds


class DriverSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')
    current_daily_online_seconds = serializers.SerializerMethodField()
    max_duty_seconds = serializers.SerializerMethodField()

    class Meta:
        model = Driver
        fields = '__all__'

    def get_current_daily_online_seconds(self, obj):
        return obj.get_current_daily_online_seconds()

    def get_max_duty_seconds(self, obj):
        return get_max_duty_seconds()


class DriverDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverDocument
        fields = '__all__'


class DriverBankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverBankAccount
        fields = '__all__'


class DriverEmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverEmergencyContact
        fields = '__all__'
