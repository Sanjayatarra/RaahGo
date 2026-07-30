import random
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Booking, RideDetail, ParcelDetail, MovingDetail, BookingTracking
from .serializers import (
    BookingSerializer,
    RideDetailSerializer,
    ParcelDetailSerializer,
    MovingDetailSerializer,
    BookingTrackingSerializer
)
from vehicles.models import VehicleType


class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all().order_by('-created_at')
    serializer_class = BookingSerializer

    def perform_create(self, serializer):
        booking_num = f"RG{random.randint(10000000, 99999999)}"
        booking = serializer.save(booking_number=booking_num)
        
        # Log initial status tracking
        BookingTracking.objects.create(
            booking=booking,
            status=booking.status,
            remarks="Booking created, searching for driver."
        )

    @action(detail=False, methods=['post'])
    def calculate_fare(self, request):
        vehicle_type_id = request.data.get('vehicle_type_id')
        distance_km = Decimal(str(request.data.get('distance_km', '0.0')))
        duration_mins = Decimal(str(request.data.get('estimated_duration_mins', '0')))

        try:
            vehicle_type = VehicleType.objects.get(id=vehicle_type_id)
        except VehicleType.DoesNotExist:
            return Response({'error': 'Vehicle type not found'}, status=status.HTTP_404_NOT_FOUND)

        base_fare = vehicle_type.base_fare + (distance_km * vehicle_type.per_km_rate) + (duration_mins * vehicle_type.per_minute_rate)
        tax_amount = base_fare * Decimal('0.05')  # 5% tax
        total_fare = base_fare + tax_amount

        return Response({
            'base_fare': round(base_fare, 2),
            'tax_amount': round(tax_amount, 2),
            'total_fare': round(total_fare, 2)
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        booking = self.get_object()
        driver_id = request.data.get('driver_id')
        if not driver_id:
            return Response({'error': 'Driver ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        booking.driver_id = driver_id
        booking.status = Booking.BookingStatus.ACCEPTED
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=booking.status,
            remarks=f"Accepted by driver ID {driver_id}"
        )
        return Response({'status': 'Booking accepted'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def start_trip(self, request, pk=None):
        booking = self.get_object()
        booking.status = Booking.BookingStatus.IN_TRIP
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=booking.status,
            remarks="Trip started"
        )
        return Response({'status': 'Trip started'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        booking = self.get_object()
        booking.status = Booking.BookingStatus.COMPLETED
        booking.payment_status = Booking.PaymentStatus.PAID
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=booking.status,
            remarks="Trip completed successfully"
        )
        return Response({'status': 'Trip completed'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        reason = request.data.get('reason', 'Cancelled by user')
        booking.status = Booking.BookingStatus.CANCELLED
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=booking.status,
            remarks=f"Cancelled: {reason}"
        )
        return Response({'status': 'Booking cancelled'}, status=status.HTTP_200_OK)


class RideDetailViewSet(viewsets.ModelViewSet):
    queryset = RideDetail.objects.all()
    serializer_class = RideDetailSerializer


class ParcelDetailViewSet(viewsets.ModelViewSet):
    queryset = ParcelDetail.objects.all()
    serializer_class = ParcelDetailSerializer


class MovingDetailViewSet(viewsets.ModelViewSet):
    queryset = MovingDetail.objects.all()
    serializer_class = MovingDetailSerializer


class BookingTrackingViewSet(viewsets.ModelViewSet):
    queryset = BookingTracking.objects.all()
    serializer_class = BookingTrackingSerializer
