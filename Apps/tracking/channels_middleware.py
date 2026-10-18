"""
Channels JWT Authentication Middleware
======================================
Authenticates incoming WebSocket handshakes using SimpleJWT tokens.
Token can be passed in:
1. Query parameter: ws://localhost:8000/ws/v1/driver/socket/?token=<access_token>
2. Request Header: Authorization: Bearer <access_token>
3. Sec-WebSocket-Protocol subprotocol header
"""

import urllib.parse
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from users.models import User
from drivers.models import Driver


@database_sync_to_async
def get_user_and_driver_from_token(token_str: str):
    """Decode JWT token and retrieve User and Driver models from database."""
    try:
        token = AccessToken(token_str)
        user_id = token.get('user_id')
        if not user_id:
            return AnonymousUser(), None

        user = User.objects.filter(id=user_id, is_active=True).first()
        if not user:
            return AnonymousUser(), None

        # Check single-device session nonce if present
        token_nonce = token.get('snonce')
        if token_nonce and user.session_nonce and user.session_nonce != token_nonce:
            # Token superseded by a newer login on another device
            return AnonymousUser(), None

        driver = Driver.objects.filter(user=user).first()
        return user, driver
    except Exception:
        return AnonymousUser(), None


class JWTAuthMiddleware:
    """Channels ASGI middleware to authenticate users via JWT."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        token_str = None

        # 1. Look for token in query string (?token=...)
        query_string = scope.get('query_string', b'').decode('utf-8')
        if query_string:
            qs_params = urllib.parse.parse_qs(query_string)
            if 'token' in qs_params and qs_params['token']:
                token_str = qs_params['token'][0]

        # 2. Look in headers if not found in query string
        if not token_str:
            headers = dict(scope.get('headers', []))
            auth_header = headers.get(b'authorization', b'').decode('utf-8')
            if auth_header and auth_header.startswith('Bearer '):
                token_str = auth_header.split(' ')[1]

        # 3. Look in subprotocols (sec-websocket-protocol)
        if not token_str:
            subprotocols = scope.get('subprotocols', [])
            for proto in subprotocols:
                if proto.startswith('token.'):
                    token_str = proto.replace('token.', '')
                    break

        if token_str:
            user, driver = await get_user_and_driver_from_token(token_str)
            scope['user'] = user
            scope['driver'] = driver
        else:
            scope['user'] = AnonymousUser()
            scope['driver'] = None

        return await self.inner(scope, receive, send)
