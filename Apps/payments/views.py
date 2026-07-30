from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Payment, Refund
from .serializers import PaymentSerializer, RefundSerializer


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().order_by('-created_at')
    serializer_class = PaymentSerializer

    @action(detail=True, methods=['post'])
    def mark_success(self, request, pk=None):
        payment = self.get_object()
        transaction_id = request.data.get('transaction_id')
        payment.status = Payment.PaymentStatus.SUCCESS
        if transaction_id:
            payment.transaction_id = transaction_id
        payment.paid_at = timezone.now()
        payment.save()
        return Response({'status': 'Payment processed successfully'}, status=status.HTTP_200_OK)


class RefundViewSet(viewsets.ModelViewSet):
    queryset = Refund.objects.all().order_by('-created_at')
    serializer_class = RefundSerializer
