from django.urls import path, re_path
from rest_framework.routers import DefaultRouter
from .views import ServiceViewSet, tile_proxy_view

router = DefaultRouter()
router.register(r'', ServiceViewSet, basename='service')

urlpatterns = [
    re_path(r'^tiles/(?P<z>\d+)/(?P<x>\d+)/(?P<y>\d+)\.png$', tile_proxy_view, name='tile_proxy_png'),
    re_path(r'^tiles/(?P<z>\d+)/(?P<x>\d+)/(?P<y>\d+)/?$', tile_proxy_view, name='tile_proxy'),
] + router.urls
