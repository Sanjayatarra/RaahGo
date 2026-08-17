from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Wallet, WalletTransaction
from .serializers import WalletSerializer, WalletTransactionSerializer
from users.models import SystemSetting


class WalletViewSet(viewsets.ModelViewSet):
    queryset = Wallet.objects.all()
    serializer_class = WalletSerializer

    @action(detail=True, methods=['post'])
    def topup(self, request, pk=None):
        wallet = self.get_object()
        amount = Decimal(str(request.data.get('amount', '0.00')))
        description = request.data.get('description', 'Wallet top-up')
        reference_id = request.data.get('reference_id')

        if amount <= 0:
            return Response({'error': 'Amount must be greater than zero'}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce maximum wallet limit from Admin Settings
        max_wallet_str = SystemSetting.get_setting('wallet_max', '10000')
        try:
            max_wallet = Decimal(str(max_wallet_str))
            if (wallet.balance + amount) > max_wallet:
                return Response({
                    'error': f'Top-up exceeds maximum wallet balance limit of ₹{max_wallet}. Current balance: ₹{wallet.balance}'
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            pass

        wallet.balance += amount
        wallet.save()

        WalletTransaction.objects.create(
            wallet=wallet,
            amount=amount,
            transaction_type=WalletTransaction.TransactionType.CREDIT,
            description=description,
            reference_id=reference_id
        )

        return Response({'status': 'Top-up successful', 'new_balance': wallet.balance}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def debit(self, request, pk=None):
        wallet = self.get_object()
        amount = Decimal(str(request.data.get('amount', '0.00')))
        description = request.data.get('description', 'Wallet payment')
        reference_id = request.data.get('reference_id')

        if amount <= 0:
            return Response({'error': 'Amount must be greater than zero'}, status=status.HTTP_400_BAD_REQUEST)

        if wallet.balance < amount:
            return Response({'error': 'Insufficient wallet balance'}, status=status.HTTP_400_BAD_REQUEST)

        wallet.balance -= amount
        wallet.save()

        WalletTransaction.objects.create(
            wallet=wallet,
            amount=amount,
            transaction_type=WalletTransaction.TransactionType.DEBIT,
            description=description,
            reference_id=reference_id
        )

        return Response({'status': 'Debit successful', 'new_balance': wallet.balance}, status=status.HTTP_200_OK)


class WalletTransactionViewSet(viewsets.ModelViewSet):
    queryset = WalletTransaction.objects.all().order_by('-created_at')
    serializer_class = WalletTransactionSerializer
