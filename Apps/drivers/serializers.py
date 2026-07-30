from rest_framework import serializers
from .models import Driver, DriverDocument, DriverBankAccount, DriverEmergencyContact


class DriverSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Driver
        fields = '__all__'


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
