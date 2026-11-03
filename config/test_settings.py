"""Settings used by the test suite (T-06).

Imported via ``DJANGO_SETTINGS_MODULE`` in ``pytest.ini``. Everything here
exists to make the suite fast, hermetic and deterministic - never to make a
test pass. If a test only goes green because of something in this file, that
is a bug in the test.
"""

import os

os.environ.setdefault('ENV', 'DEV')
os.environ.setdefault('SECRET_KEY', 'test-secret-key-for-hermetic-unit-testing-32chars')

from .settings import *  # noqa: F401,F403

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
# SQLite by default so `pytest` works on a bare checkout with no containers.
# Set DATABASE_ENGINE=mysql to run the same suite against the production engine
# (T-05) - required before merging anything that touches the schema, because
# the two engines disagree about constraints, collation and casing.
if os.getenv("DATABASE_ENGINE", "sqlite").lower() == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }

# ---------------------------------------------------------------------------
# No external services
# ---------------------------------------------------------------------------
# Redis is not running in CI. Anything that reaches for the cache or the
# channel layer must work against these in-process stand-ins.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "test-cache",
    }
}
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

# CustomUserManager._create_user sends a welcome mail on every user creation,
# so every factory call would otherwise attempt SMTP.
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

CELERY_TASK_ALWAYS_EAGER = True
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"
# Deliberately False: an endpoint that only dispatches a task should still
# answer 202 in an authorisation test even if the task body then fails on test
# data. Tests that care about task behaviour call the task directly.
CELERY_TASK_EAGER_PROPAGATES = False

# ---------------------------------------------------------------------------
# Speed
# ---------------------------------------------------------------------------
# PBKDF2 costs ~100ms per user created; the permission matrix builds one user
# per role per parametrised case.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------
# The rate limiter is stateful across requests within a test session and would
# make test order significant. It has its own dedicated tests (T-14) which
# re-enable it explicitly.
RATELIMIT_ENABLE = False
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_CLASSES": [],
}

# Test requests arrive over plain HTTP; SECURE_SSL_REDIRECT would answer 301
# before the view ever runs and every status assertion would fail.
SECURE_SSL_REDIRECT = False

# DEBUG mirrors ENV in settings.py, which means it is True locally. Tests must
# run with it off: under DEBUG a view that raises produces a technical 500 page
# with a stack trace instead of the handler's response, so error-path
# assertions would test the debug page rather than the application.
# pytest-django appends "testserver" to ALLOWED_HOSTS for us.
DEBUG = False

# WhiteNoise's compressed storage needs a collectstatic run to exist.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
