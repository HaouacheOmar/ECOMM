from decimal import Decimal

from django.db import transaction
from django.db.models import Avg, Count
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCustomer

from .models import Product, Review


class ReviewSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    rating = serializers.IntegerField(min_value=1, max_value=5)
    text = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    class Meta:
        model = Review
        fields = ['id', 'author', 'rating', 'text', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_author(self, review):
        # A first name, else the part of the email before the @: never the full address.
        return review.customer.first_name or review.customer.email.split('@')[0]


def sellable_product(pk):
    return get_object_or_404(Product, pk=pk, is_archived=False)


class ProductReviewsView(ListAPIView):
    """GET: a Product's Reviews, most recent first (anyone). POST: a Customer rates it; posting again
    edits their Review. The Product's rating_avg and review_count change in the same transaction."""

    serializer_class = ReviewSerializer

    def get_permissions(self):
        return [AllowAny()] if self.request.method == 'GET' else [IsCustomer()]

    def get_queryset(self):
        return Review.objects.filter(product=sellable_product(self.kwargs['pk'])).select_related('customer')

    def post(self, request, pk):
        data = ReviewSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        with transaction.atomic():
            # The Product row lock serialises concurrent Reviews of it, so the totals stay exact.
            product = get_object_or_404(Product.objects.select_for_update(), pk=pk, is_archived=False)
            review, created = Review.objects.update_or_create(
                product=product, customer=request.user,
                defaults={'rating': data.validated_data['rating'], 'text': data.validated_data.get('text', '').strip()},
            )
            totals = product.reviews.aggregate(avg=Avg('rating'), count=Count('id'))
            product.rating_avg = Decimal(totals['avg']).quantize(Decimal('0.01'))
            product.review_count = totals['count']
            product.save(update_fields=['rating_avg', 'review_count'])
        return Response({
            'review': ReviewSerializer(review).data,
            'rating_avg': str(product.rating_avg),
            'review_count': product.review_count,
        }, status=201 if created else 200)


class MyReviewView(APIView):
    """The signed-in Customer's own Review of this Product, to edit it (404 if none yet)."""

    permission_classes = [IsCustomer]

    def get(self, request, pk):
        review = get_object_or_404(Review.objects.select_related('customer'), product=sellable_product(pk), customer=request.user)
        return Response(ReviewSerializer(review).data)
