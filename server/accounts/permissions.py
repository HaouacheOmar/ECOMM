from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import User


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN)


class ReadOnlyOrAdmin(IsAdmin):
    """Anyone may read; only the Admin may write."""

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or super().has_permission(request, view)


def is_admin(user):
    return user.is_authenticated and user.role == User.Role.ADMIN


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.CUSTOMER)


def is_staff_member(user):
    """The Admin and Employees: they see and process every Order."""
    return user.is_authenticated and user.role in (User.Role.ADMIN, User.Role.EMPLOYEE)


class IsStaff(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and is_staff_member(request.user))
