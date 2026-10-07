"""
Django settings for the E-Shop server.

Local values come from environment variables, loaded from server/.env
(see .env.example).
"""

import os
from datetime import timedelta
from pathlib import Path

from celery.schedules import crontab
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env(name, default):
    return os.environ.get(name, default)


SECRET_KEY = env('DJANGO_SECRET_KEY', 'django-insecure-f_iqche^9=f-9nr$651#hjao62q@l+e1&1g^#93qd19+f_ehpp')
DEBUG = env('DJANGO_DEBUG', '1') == '1'
ALLOWED_HOSTS = env('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')  # TLS ends at the host's proxy

FRONTEND_ORIGIN = env('FRONTEND_ORIGIN', 'http://localhost:5173')
PASSWORD_RESET_TIMEOUT = 3600  # reset links last 1 hour (and work once)


# Application definition

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'drf_spectacular',
    'channels',
    'accounts',
    'products',
    'orders',
    'chat',
    'demo',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

AUTH_USER_MODEL = 'accounts.User'


# Database: PostgreSQL from docker-compose (host port 5433)

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME', 'eshop'),
        'USER': env('DB_USER', 'eshop'),
        'PASSWORD': env('DB_PASSWORD', 'eshop'),
        'HOST': env('DB_HOST', 'localhost'),
        'PORT': env('DB_PORT', '5433'),
        'OPTIONS': {'sslmode': env('DB_SSLMODE', 'prefer')},  # 'require' for Supabase
    }
}


# Redis: Channels layer, cache, Celery broker

REDIS_URL = env('REDIS_URL', 'redis://localhost:6379/0')

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {'hosts': [REDIS_URL]},
    },
}

# Seconds an Employee stays Online with no chat connection (covers reloads and token refreshes).
CHAT_OFFLINE_GRACE = float(env('CHAT_OFFLINE_GRACE', '10'))

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
    },
}

CELERY_BROKER_URL = REDIS_URL
CELERY_TASK_ACKS_LATE = True
# Hosting without a worker (Render free): tasks run inline and Beat's schedule doesn't run.
if env('CELERY_EAGER', '0') == '1':
    CELERY_TASK_ALWAYS_EAGER = True
CELERY_TIMEZONE = 'UTC'
CELERY_BEAT_SCHEDULE = {
    'precompute-bestsellers': {'task': 'products.tasks.precompute_bestsellers', 'schedule': 15 * 60},
    'refresh-recommendations': {'task': 'products.tasks.refresh_recommendations', 'schedule': crontab(hour=3, minute=0)},
}

# Portfolio demo: "Try as ..." logins and simulated shop activity (seed it with `manage.py seed_demo`).
DEMO_MODE = env('DEMO_MODE', '0') == '1'
if DEMO_MODE:
    # A random Order or Customer chat message about every 45 s (the middle of 30-60 s).
    CELERY_BEAT_SCHEDULE['simulate-activity'] = {'task': 'demo.tasks.simulate_activity', 'schedule': 45}


# Password validation

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# API

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework_simplejwt.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(seconds=int(env('JWT_ACCESS_SECONDS', '300'))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'E-Shop API',
    'VERSION': '0.1.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

CORS_ALLOWED_ORIGINS = [FRONTEND_ORIGIN]
CORS_ALLOW_CREDENTIALS = True


# Internationalization

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# Static and media files

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'  # collectstatic, served by WhiteNoise
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Hosted: uploads go to a public Supabase Storage bucket (S3 API), since the host's disk is wiped
# on every restart. Unset locally, so media stays in MEDIA_ROOT.
S3_BUCKET = env('S3_BUCKET', '')
if S3_BUCKET:
    S3_PUBLIC_URL = env('S3_PUBLIC_URL', '')  # https://<ref>.supabase.co/storage/v1/object/public/<bucket>
    MEDIA_URL = S3_PUBLIC_URL + '/'
    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.s3.S3Storage',
            'OPTIONS': {
                'bucket_name': S3_BUCKET,
                'endpoint_url': env('S3_ENDPOINT', ''),  # https://<ref>.supabase.co/storage/v1/s3
                'region_name': env('S3_REGION', ''),
                'access_key': env('S3_ACCESS_KEY', ''),
                'secret_key': env('S3_SECRET_KEY', ''),
                'addressing_style': 'path',
                'querystring_auth': False,
                'custom_domain': S3_PUBLIC_URL.removeprefix('https://'),
            },
        },
        'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
    }

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Email: printed to the console while hosting is local

MAILERS = {
    'default': {
        'BACKEND': 'django.core.mail.backends.console.EmailBackend',
    },
}
