"""
Custom JWT Authentication for RaahGo
=====================================
Implements single-device login via session_nonce:
  - On every login, a new random nonce is saved to User.session_nonce.
  - The nonce is embedded in the JWT access token and refresh token as the 'snonce' claim.
  - On each authenticated request, the nonce in the token is compared
    to the current nonce in the DB. A mismatch means the user logged in
    from another device → returns HTTP 401 "Session expired. Please log in again."
"""

import secrets
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken


# ── Nonce helpers ──────────────────────────────────────────────────────────────

def extract_device_info(request):
    """Parse User-Agent and custom headers from incoming request."""
    if not request:
        return {
            'device_type': 'Android',
            'device_name': 'Mobile Device',
            'app_version': 'v2.4.0',
            'firebase_token': None
        }

    user_agent = request.META.get('HTTP_USER_AGENT', '')
    data = getattr(request, 'data', {}) or {}
    device_type = data.get('device_type') or request.META.get('HTTP_X_DEVICE_TYPE')
    device_name = data.get('device_name') or request.META.get('HTTP_X_DEVICE_NAME')
    app_version = data.get('app_version') or request.META.get('HTTP_X_APP_VERSION') or 'v2.4.0'
    firebase_token = data.get('firebase_token') or data.get('fcm_token') or request.META.get('HTTP_X_FCM_TOKEN')

    if not device_type:
        ua_lower = user_agent.lower()
        if 'iphone' in ua_lower or 'ipad' in ua_lower or 'ios' in ua_lower:
            device_type = 'iOS'
        elif 'android' in ua_lower:
            device_type = 'Android'
        else:
            device_type = 'Web'

    if not device_name:
        ua_lower = user_agent.lower()
        if 'iphone' in ua_lower:
            device_name = 'Apple iPhone (iOS)'
        elif 'samsung' in ua_lower:
            device_name = 'Samsung Galaxy (Android)'
        elif 'pixel' in ua_lower:
            device_name = 'Google Pixel (Android)'
        elif 'android' in ua_lower:
            device_name = 'Android Smartphone'
        elif 'chrome' in ua_lower:
            device_name = 'Chrome Browser (Web)'
        elif 'safari' in ua_lower:
            device_name = 'Safari Browser (Web)'
        elif 'firefox' in ua_lower:
            device_name = 'Firefox Browser (Web)'
        else:
            device_name = 'Mobile App Client'

    return {
        'device_type': device_type if device_type in ['Android', 'iOS', 'Web'] else 'Android',
        'device_name': device_name,
        'app_version': app_version,
        'firebase_token': firebase_token
    }


def issue_tokens_for_user(user, request=None) -> dict:
    """
    Rotate the user's session_nonce, embed it in new JWT tokens,
    record/update the active device in UserDevice, deactivate previous sessions,
    and return {'access': '...', 'refresh': '...'}.
    """
    from django.utils import timezone
    from users.models import UserDevice

    nonce = generate_session_nonce()
    user.session_nonce = nonce
    user.last_login = timezone.now()
    user.save(update_fields=['session_nonce', 'last_login'])

    try:
        # Enforce single-device: deactivate older device sessions for this user
        UserDevice.objects.filter(user=user).update(is_active=False)

        dev_info = extract_device_info(request)
        UserDevice.objects.create(
            user=user,
            device_type=dev_info['device_type'] if dev_info['device_type'] in ['Android', 'iOS', 'Web'] else 'Android',
            device_name=(dev_info.get('device_name') or 'Mobile Device')[:100],
            app_version=(dev_info.get('app_version') or 'v2.4.0')[:20],
            firebase_token=dev_info.get('firebase_token') or f"FCM-TK-{nonce[:16].upper()}",
            is_active=True,
            last_active=timezone.now()
        )
    except Exception:
        pass

    refresh = RefreshToken.for_user(user)
    # Embed nonce in BOTH tokens so refresh carries it too
    refresh['snonce'] = nonce
    refresh.access_token['snonce'] = nonce

    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }


# ── Custom authentication class ────────────────────────────────────────────────

class SingleDeviceJWTAuthentication(JWTAuthentication):
    """
    Extends simplejwt's JWTAuthentication to enforce single-device login.

    After standard token validation, it checks that the 'snonce' claim in
    the token matches the nonce stored in the DB for that user. If they
    differ, the token belongs to a session that has been superseded by a
    newer login and is rejected with HTTP 401.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)

        token_nonce = validated_token.get('snonce')

        # If token has no snonce, reject if user has an active session_nonce
        if token_nonce is None:
            if user.session_nonce:
                raise AuthenticationFailed(
                    'Session expired. Your account was logged in on another device. Please log in again.',
                    code='session_superseded',
                )
            return user

        if user.session_nonce != token_nonce:
            raise AuthenticationFailed(
                'Session expired. Your account was logged in on another device. Please log in again.',
                code='session_superseded',
            )

        return user
