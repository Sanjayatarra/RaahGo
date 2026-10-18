"""
WebSocket URL Routing for RaahGo
================================
Defines WebSocket routes for driver and customer real-time connections.
"""

from django.urls import re_path
from .consumers import DriverSocketConsumer, CustomerSocketConsumer

websocket_urlpatterns = [
    re_path(r'^ws/v1/driver/socket/?$', DriverSocketConsumer.as_asgi()),
    re_path(r'^ws/v1/customer/socket/?$', CustomerSocketConsumer.as_asgi()),
]
