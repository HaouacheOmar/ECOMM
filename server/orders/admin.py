from django.contrib import admin

from .models import Order, OrderItem, PickupPoint

admin.site.register(PickupPoint)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer', 'status', 'delivery_method', 'total_amount', 'created_at']
    list_filter = ['status', 'delivery_method']
    inlines = [OrderItemInline]
