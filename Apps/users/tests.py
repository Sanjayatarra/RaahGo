from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from users.models import User, OTPVerification


class RoleScopedUserUniquenessTests(TestCase):
    def test_same_identifiers_are_allowed_for_different_roles(self):
        details = {
            'username': 'shared-user',
            'email': 'shared@example.com',
            'phone_number': '9876543210',
        }
        User.objects.create(role=User.RoleChoices.CUSTOMER, **details)
        User.objects.create(role=User.RoleChoices.DRIVER, **details)

        self.assertEqual(User.objects.filter(email='shared@example.com').count(), 2)

    def test_identifiers_must_be_unique_within_a_role(self):
        role = User.RoleChoices.CUSTOMER
        User.objects.create(
            role=role,
            username='existing',
            email='existing@example.com',
            phone_number='9876543210',
        )

        duplicate_fields = (
            {'username': 'existing'},
            {'email': 'EXISTING@example.com'},
            {'phone_number': '9876543210'},
        )
        for fields in duplicate_fields:
            with self.subTest(fields=fields), self.assertRaises(IntegrityError):
                with transaction.atomic():
                    User.objects.create(role=role, **fields)


class RoleScopedDedicatedAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.driver_user = User.objects.create(
            username='driver_john',
            email='driver@example.com',
            phone_number='9999988888',
            role=User.RoleChoices.DRIVER,
            is_verified=True
        )
        self.customer_user = User.objects.create(
            username='customer_jane',
            email='customer@example.com',
            phone_number='8888877777',
            role=User.RoleChoices.CUSTOMER,
            is_verified=True
        )

    def test_driver_cannot_login_on_customer_api(self):
        # Driver tries to send login OTP on Customer dedicated endpoint /api/v1/customer/send-otp/
        response = self.client.post(
            '/api/v1/customer/send-otp/',
            {'phone_number': '9999988888', 'purpose': 'Login'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('User is not registered as Customer', response.data.get('error', ''))

    def test_customer_cannot_login_on_driver_api(self):
        # Customer tries to send login OTP on Driver dedicated endpoint /api/v1/driver/send-otp/
        response = self.client.post(
            '/api/v1/driver/send-otp/',
            {'phone_number': '8888877777', 'purpose': 'Login'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('User is not registered as Driver', response.data.get('error', ''))

    def test_customer_login_success_on_customer_api(self):
        response = self.client.post(
            '/api/v1/customer/send-otp/',
            {'phone_number': '8888877777', 'purpose': 'Login'}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data.get('status'), 'OTP sent successfully')
