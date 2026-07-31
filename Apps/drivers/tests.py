import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from django.test import override_settings
from rest_framework.test import APIRequestFactory
from django.test import TestCase

from drivers.models import DriverDocument
from drivers.views import DriverViewSet


class DriverDocumentPersistenceTests(TestCase):
    def setUp(self):
        self.media_directory = tempfile.TemporaryDirectory()
        self.settings_override = override_settings(MEDIA_ROOT=self.media_directory.name)
        self.settings_override.enable()

    def tearDown(self):
        self.settings_override.disable()
        self.media_directory.cleanup()

    def test_complete_profile_saves_uploaded_document_files(self):
        uploads = {
            'document_license': SimpleUploadedFile('license.pdf', b'license-data', 'application/pdf'),
            'document_rc': SimpleUploadedFile('rc.pdf', b'rc-data', 'application/pdf'),
            'document_insurance': SimpleUploadedFile('insurance.pdf', b'insurance-data', 'application/pdf'),
            'document_aadhaar': SimpleUploadedFile('aadhaar.pdf', b'aadhaar-data', 'application/pdf'),
            'document_photo': SimpleUploadedFile('photo.jpg', b'photo-data', 'image/jpeg'),
        }
        request = APIRequestFactory().post(
            '/api/v1/drivers/complete_profile/',
            {
                'phone_number': '9876543210',
                'email': 'captain@example.com',
                'username': 'captain-doc-test',
                **uploads,
            },
            format='multipart',
        )

        response = DriverViewSet.as_view({'post': 'complete_captain_profile'})(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(DriverDocument.objects.count(), 5)
        urls = list(DriverDocument.objects.values_list('document_url', flat=True))
        for filename in ('license.pdf', 'rc.pdf', 'insurance.pdf', 'aadhaar.pdf', 'photo.jpg'):
            self.assertTrue(any(url.endswith(filename) for url in urls))
        license_url = next(url for url in urls if url.endswith('license.pdf'))
        storage_name = license_url.split('/media/', 1)[1]
        with default_storage.open(storage_name, 'rb') as stored_file:
            self.assertEqual(stored_file.read(), b'license-data')

        profile_request = APIRequestFactory().get(
            '/api/v1/drivers/profile/',
            {'phone_number': '9876543210'},
        )
        profile_response = DriverViewSet.as_view({'get': 'onboarding_profile'})(profile_request)
        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.data['documents']['license']['name'], 'license.pdf')
        self.assertIn(6, profile_response.data['completed_steps'])
