from django.urls import path
from rest_framework.routers import DefaultRouter

from . import employees, passwords, views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register('employees', employees.EmployeeViewSet, basename='employee')
router.register('employee-sessions', employees.EmployeeSessionViewSet, basename='employee-session')

urlpatterns = [
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/refresh/', views.RefreshView.as_view(), name='refresh'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/verify/', views.VerifyEmailView.as_view(), name='verify-email'),
    path('auth/verify/resend/', views.ResendVerificationView.as_view(), name='verify-resend'),
    path('auth/password/reset/', passwords.ForgotPasswordView.as_view(), name='password-reset'),
    path('auth/password/reset/confirm/', passwords.ResetPasswordView.as_view(), name='password-reset-confirm'),
    path('auth/password/change/', passwords.ChangePasswordView.as_view(), name='password-change'),
    path('me/', views.MeView.as_view(), name='me'),
] + router.urls
