from rest_framework.routers import DefaultRouter
from .views import (
    DriverViewSet,
    DriverDocumentViewSet,
    DriverBankAccountViewSet,
    DriverEmergencyContactViewSet
)

router = DefaultRouter()
router.register(r'drivers', DriverViewSet, basename='driver')
router.register(r'documents', DriverDocumentViewSet, basename='driver-document')
router.register(r'bank-accounts', DriverBankAccountViewSet, basename='driver-bank-account')
router.register(r'emergency-contacts', DriverEmergencyContactViewSet, basename='driver-emergency-contact')

urlpatterns = router.urls
