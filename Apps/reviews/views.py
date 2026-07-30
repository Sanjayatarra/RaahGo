from django.db.models import Avg
from rest_framework import viewsets
from .models import Rating
from .serializers import RatingSerializer


class RatingViewSet(viewsets.ModelViewSet):
    queryset = Rating.objects.all().order_by('-created_at')
    serializer_class = RatingSerializer

    def perform_create(self, serializer):
        rating_obj = serializer.save()
        
        # Update driver's overall average rating if reviewee_driver exists
        if rating_obj.reviewee_driver:
            driver = rating_obj.reviewee_driver
            avg_rating = Rating.objects.filter(reviewee_driver=driver).aggregate(Avg('rating'))['rating__avg']
            if avg_rating is not None:
                driver.rating = round(avg_rating, 2)
                driver.save()
