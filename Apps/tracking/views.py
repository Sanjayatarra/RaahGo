from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import DriverLocation
from .serializers import DriverLocationSerializer


class DriverLocationViewSet(viewsets.ModelViewSet):
    queryset = DriverLocation.objects.all()
    serializer_class = DriverLocationSerializer

    @action(detail=False, methods=['post'])
    def update_location(self, request):
        driver_id = request.data.get('driver_id')
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        heading = request.data.get('heading', 0.0)
        speed = request.data.get('speed', 0.0)

        if not driver_id or lat is None or lng is None:
            return Response({'error': 'driver_id, latitude, and longitude are required'}, status=status.HTTP_400_BAD_REQUEST)

        location, created = DriverLocation.objects.update_or_create(
            driver_id=driver_id,
            defaults={
                'latitude': Decimal(str(lat)),
                'longitude': Decimal(str(lng)),
                'heading': Decimal(str(heading)),
                'speed': Decimal(str(speed)),
                'is_online': True
            }
        )

        serializer = self.get_serializer(location)
        return Response(serializer.data, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)
