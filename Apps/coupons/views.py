from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Coupon
from .serializers import CouponSerializer


class CouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.filter(is_active=True)
    serializer_class = CouponSerializer

    @action(detail=False, methods=['post'])
    def validate_coupon(self, request):
        code = request.data.get('code')
        booking_amount = Decimal(str(request.data.get('booking_amount', '0.00')))

        if not code:
            return Response({'error': 'Coupon code is required'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        coupon = Coupon.objects.filter(
            code__iexact=code,
            is_active=True,
            valid_from__lte=now,
            valid_until__gte=now
        ).first()

        if not coupon:
            return Response({'error': 'Invalid or expired coupon code'}, status=status.HTTP_400_BAD_REQUEST)

        if coupon.times_used >= coupon.usage_limit:
            return Response({'error': 'Coupon usage limit reached'}, status=status.HTTP_400_BAD_REQUEST)

        if booking_amount < coupon.min_booking_amount:
            return Response({
                'error': f'Minimum booking amount of {coupon.min_booking_amount} required'
            }, status=status.HTTP_400_BAD_REQUEST)

        discount = Decimal('0.00')
        if coupon.discount_type == Coupon.DiscountType.FLAT:
            discount = coupon.discount_value
        elif coupon.discount_type == Coupon.DiscountType.PERCENTAGE:
            discount = (booking_amount * coupon.discount_value) / Decimal('100.00')
            if coupon.max_discount_amount and discount > coupon.max_discount_amount:
                discount = coupon.max_discount_amount

        discount = min(discount, booking_amount)

        return Response({
            'code': coupon.code,
            'discount_amount': round(discount, 2),
            'final_amount': round(booking_amount - discount, 2)
        }, status=status.HTTP_200_OK)
