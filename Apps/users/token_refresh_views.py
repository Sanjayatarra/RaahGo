from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken
from users.models import User


class SingleDeviceTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh_str = attrs['refresh']
        refresh = RefreshToken(refresh_str)

        token_nonce = refresh.get('snonce')
        user_id = refresh.get('user_id')

        if user_id:
            user = User.objects.filter(id=user_id).first()
            if user:
                if user.session_nonce and token_nonce != user.session_nonce:
                    raise AuthenticationFailed(
                        'Session expired. Your account was logged in on another device. Please log in again.',
                        code='session_superseded',
                    )
                # Keep snonce in refreshed access token
                if user.session_nonce:
                    refresh.access_token['snonce'] = user.session_nonce

        return {'access': str(refresh.access_token)}


class SingleDeviceTokenRefreshView(TokenRefreshView):
    serializer_class = SingleDeviceTokenRefreshSerializer
