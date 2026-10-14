from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin

from . import figures


class StatsView(APIView):
    """Admin only. ?month=YYYY-MM picks the month (default: the current month in shop time)."""

    permission_classes = [IsAdmin]

    def month(self):
        value = self.request.query_params.get('month')
        if value is None:
            return figures.current_month()
        return figures.parse_month(value)

    def get(self, request):
        month = self.month()
        if month is None:
            return Response({'month': ['Use the format YYYY-MM.']}, status=400)
        return Response(self.figures(*month))


class MonthView(StatsView):
    """The month's Revenue, Spent, Gross profit and Delivered Orders, with the previous month's."""

    def figures(self, year, month):
        return {'current': figures.summary(year, month), 'previous': figures.summary(*figures.previous_month(year, month))}


class ProductsView(StatsView):
    """The month's top Products (units, Revenue, Gross profit), slow Products, and Categories."""

    def figures(self, year, month):
        return {**figures.product_rankings(year, month), 'categories': figures.category_breakdown(year, month)}


class HistoryView(StatsView):
    """The 12 months ending with the chosen month, and yearly totals."""

    def figures(self, year, month):
        return figures.history(year, month)


class LowStockView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(figures.low_stock())
