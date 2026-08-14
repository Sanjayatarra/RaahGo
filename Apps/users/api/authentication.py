from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from users.models import User
from users.serializers import UserSerializer

class RegisterView(APIView):
    def post(self, request):
        return Response({'message': 'Register endpoint'})

class LoginView(APIView):
    def post(self, request):
        email = request.data.get('email')
        phone_number = request.data.get('phone_number')
        password = request.data.get('password')
        
        user = None
        if email:
            user = User.objects.filter(email__iexact=email).first()
        elif phone_number:
            user = User.objects.filter(phone_number=phone_number).first()
            
        if not user or user.password != password:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
            
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({'status': 'Logged out successfully'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'status': 'Logged out successfully'}, status=status.HTTP_200_OK)

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
