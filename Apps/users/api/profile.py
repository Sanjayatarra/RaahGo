from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from users.serializers import UserSerializer

class ProfileGetView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class ProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]
    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ProfileAvatarView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        profile_image = request.data.get('profile_image')
        if not profile_image:
            return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)
            
        request.user.profile_image = profile_image
        request.user.save()
        return Response({'status': 'Avatar updated successfully', 'profile_image': profile_image})
