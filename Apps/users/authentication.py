"""
Custom JWT Authentication for RaahGo
=====================================
Implements single-device login via session_nonce:
  - On every login, a new random nonce is saved to User.session_nonce.
  - The nonce is embedded in the JWT access token as the 'snonce' claim.
  - On each authenticated request, the nonce in the token is compared
    to the current nonce in the DB.  A mismatch means the user logged in
    from another device → return 401 "Session expired. Please log in again."
"""

import secrets
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken


# ── Nonce helpers ──────────────────────────────────────────────────────────────

def generate_session_nonce() -> str:
    """Return a cryptographically secure 32-hex-char nonce."""
    return secrets.token_hex(32)


def issue_tokens_for_user(user) -> dict:
    """
    Rotate the user's session_nonce, embed it in new JWT tokens, and
    return {'access': '...', 'refresh': '...'}.
    Call this instead of RefreshToken.for_user() everywhere a new login
    session should be started.
    """
    nonce = generate_session_nonce()
    user.session_nonce = nonce
    user.save(update_fields=['session_nonce', 'last_login'])

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
    the token matches the nonce stored in the DB for that user.  If they
    differ, the token belongs to a session that has been superseded by a
    newer login and is rejected with HTTP 401.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)

        token_nonce = validated_token.get('snonce')

        # Tokens issued before this feature was deployed won't have 'snonce'.
        # Treat them as valid to avoid locking out existing users on first deploy.
        if token_nonce is None:
            return user

        if user.session_nonce != token_nonce:
            raise AuthenticationFailed(
                'Session expired. Your account was logged in on another device. '
                'Please log in again.',
                code='session_superseded',
            )

        return user
