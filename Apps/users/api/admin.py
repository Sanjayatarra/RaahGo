from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from rest_framework import status
from users.models import User
from users.serializers import UserSerializer

class AdminUsersView(APIView):
    permission_classes = [IsAdminUser]
    def get(self, request):
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

class AdminRolesView(APIView):
    permission_classes = [IsAdminUser]
    def get(self, request):
        roles = [choice[0] for choice in User.RoleChoices.choices]
        return Response({'roles': roles})

class AdminPermissionsView(APIView):
    permission_classes = [IsAdminUser]
    def get(self, request):
        return Response({'permissions': ['read', 'write', 'delete']})

class AdminActivateView(APIView):
    permission_classes = [IsAdminUser]
    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            user.is_active = True
            user.save()
            return Response({'status': 'User activated'})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

class AdminDeactivateView(APIView):
    permission_classes = [IsAdminUser]
    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            user.is_active = False
            user.save()
            return Response({'status': 'User deactivated'})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

class AdminDeleteView(APIView):
    permission_classes = [IsAdminUser]
    def delete(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            user.delete()
            return Response({'status': 'User deleted'}, status=status.HTTP_204_NO_CONTENT)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
