import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError('Email is required')
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.update(role=User.Role.ADMIN, is_staff=True, is_superuser=True)
        return self.create_user(email, password, **extra)


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN'
        EMPLOYEE = 'EMPLOYEE'
        CUSTOMER = 'CUSTOMER'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=8, choices=Role.choices, default=Role.CUSTOMER)
    is_email_verified = models.BooleanField(default=False)
    # Customers only: the Employee who receives their Chat Messages directly while Online.
    assigned_employee = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='assigned_customers', limit_choices_to={'role': Role.EMPLOYEE},
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email
