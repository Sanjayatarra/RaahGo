import uuid
from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from users.models import User
from drivers.models import Driver, DriverDocument
from vehicles.models import Vehicle, VehicleType
from tracking.models import DriverLocation
from drivers.driver_api_views import DriverStatusOnlineView, DriverStatusOfflineView
from drivers.views import DriverViewSet


class DriverAvailabilityLocationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        # Create driver user
        self.user = User.objects.create(
            username='driver_test_user',
            phone_number='9876543219',
            email='testdriver@example.com',
            role=User.RoleChoices.DRIVER,
            is_active=True
        )
        # Create approved driver
        self.driver = Driver.objects.create(
            user=self.user,
            license_number='DL-TEST-998877',
            approval_status=Driver.ApprovalStatus.APPROVED,
            availability_status=Driver.AvailabilityStatus.OFFLINE,
            rating=Decimal('4.90')
        )
        # Create verified driving license
        DriverDocument.objects.create(
            driver=self.driver,
            document_type='license',
            document_number='DL-TEST-998877',
            verification_status=DriverDocument.VerificationStatus.VERIFIED,
            expiry_date=timezone.now().date() + timedelta(days=365)
        )
        # Create active approved vehicle
        self.vehicle_type = VehicleType.objects.create(
            name='Bike',
            base_fare=Decimal('30.00'),
            per_km_rate=Decimal('8.00'),
            per_minute_rate=Decimal('1.50')
        )
        self.vehicle = Vehicle.objects.create(
            driver=self.driver,
            vehicle_type=self.vehicle_type,
            make='Hero',
            model='Splendor',
            year=2022,
            color='Black',
            registration_number='UP90AB1234',
            is_active=True,
            is_approved=True
        )

    def test_driver_go_online_picks_and_saves_location_in_db(self):
        """Test that DriverStatusOnlineView saves latitude & longitude to Driver and DriverLocation table in DB."""
        lat = 28.4408825
        lng = 77.0389595
        request = self.factory.post(
            '/api/v1/driver/status/online/',
            {
                'driver_id': str(self.driver.id),
                'latitude': lat,
                'longitude': lng,
                'heading': 45.0,
                'speed': 15.0
            },
            format='json'
        )
        response = DriverStatusOnlineView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['is_online'])
        self.assertTrue(response.data.get('location_saved'))

        # Verify Driver model fields in database
        self.driver.refresh_from_db()
        self.assertEqual(self.driver.availability_status, Driver.AvailabilityStatus.ONLINE)
        self.assertAlmostEqual(float(self.driver.current_latitude), lat, places=5)
        self.assertAlmostEqual(float(self.driver.current_longitude), lng, places=5)
        self.assertIsNotNone(self.driver.last_location_update)

        # Verify DriverLocation tracking record in database
        location_record = DriverLocation.objects.filter(driver=self.driver).first()
        self.assertIsNotNone(location_record)
        self.assertAlmostEqual(float(location_record.latitude), lat, places=5)
        self.assertAlmostEqual(float(location_record.longitude), lng, places=5)
        self.assertTrue(location_record.is_online)

    def test_driver_go_offline_updates_db_location_status(self):
        """Test that DriverStatusOfflineView marks DriverLocation as is_online=False in DB."""
        # First set driver online with location
        self.driver.availability_status = Driver.AvailabilityStatus.ONLINE
        self.driver.current_latitude = Decimal('28.4408825')
        self.driver.current_longitude = Decimal('77.0389595')
        self.driver.save()
        DriverLocation.objects.create(
            driver=self.driver,
            latitude=self.driver.current_latitude,
            longitude=self.driver.current_longitude,
            is_online=True
        )

        request = self.factory.post(
            '/api/v1/driver/status/offline/',
            {'driver_id': str(self.driver.id)},
            format='json'
        )
        response = DriverStatusOfflineView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['is_online'])

        self.driver.refresh_from_db()
        self.assertEqual(self.driver.availability_status, Driver.AvailabilityStatus.OFFLINE)

        # Check DriverLocation record in DB
        location_record = DriverLocation.objects.filter(driver=self.driver).first()
        self.assertIsNotNone(location_record)
        self.assertFalse(location_record.is_online)

    def test_toggle_availability_saves_location_in_db(self):
        """Test toggle_availability action in DriverViewSet saves coordinates to DB."""
        lat = 25.290689
        lng = 80.570636
        request = self.factory.post(
            f'/api/v1/drivers/{self.driver.id}/toggle_availability/',
            {
                'status': 'Online',
                'latitude': lat,
                'longitude': lng
            },
            format='json'
        )
        view = DriverViewSet.as_view({'post': 'toggle_availability'})
        response = view(request, pk=str(self.driver.id))
        self.assertEqual(response.status_code, 200)

        self.driver.refresh_from_db()
        self.assertEqual(self.driver.availability_status, Driver.AvailabilityStatus.ONLINE)
        self.assertAlmostEqual(float(self.driver.current_latitude), lat, places=5)
        self.assertAlmostEqual(float(self.driver.current_longitude), lng, places=5)

        location_record = DriverLocation.objects.filter(driver=self.driver).first()
        self.assertIsNotNone(location_record)
        self.assertTrue(location_record.is_online)
        self.assertAlmostEqual(float(location_record.latitude), lat, places=5)
        self.assertAlmostEqual(float(location_record.longitude), lng, places=5)
