from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Driver, DriverDocument, DriverBankAccount, DriverEmergencyContact
from .serializers import (
    DriverSerializer,
    DriverDocumentSerializer,
    DriverBankAccountSerializer,
    DriverEmergencyContactSerializer
)


class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.all()
    serializer_class = DriverSerializer

    @action(detail=True, methods=['post'])
    def toggle_availability(self, request, pk=None):
        driver = self.get_object()
        new_status = request.data.get('status')
        if new_status in [choice[0] for choice in Driver.AvailabilityStatus.choices]:
            driver.availability_status = new_status
            driver.save()
            return Response({'status': f'Driver availability set to {new_status}'}, status=status.HTTP_200_OK)
        return Response({'error': 'Invalid availability status'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def update_approval(self, request, pk=None):
        driver = self.get_object()
        new_status = request.data.get('status')
        if new_status in [choice[0] for choice in Driver.ApprovalStatus.choices]:
            driver.approval_status = new_status
            driver.save()
            return Response({'status': f'Driver approval status updated to {new_status}'}, status=status.HTTP_200_OK)
        return Response({'error': 'Invalid approval status'}, status=status.HTTP_400_BAD_REQUEST)


class DriverDocumentViewSet(viewsets.ModelViewSet):
    queryset = DriverDocument.objects.all()
    serializer_class = DriverDocumentSerializer


class DriverBankAccountViewSet(viewsets.ModelViewSet):
    queryset = DriverBankAccount.objects.all()
    serializer_class = DriverBankAccountSerializer


class DriverEmergencyContactViewSet(viewsets.ModelViewSet):
    queryset = DriverEmergencyContact.objects.all()
    serializer_class = DriverEmergencyContactSerializer
