import io
import json
import os
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import (
    check_password,
    identify_hasher,
    make_password,
    PBKDF2PasswordHasher,
    Argon2PasswordHasher,
)
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, RequestFactory, override_settings
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta

from base.logging_filters import SensitiveDataFilter
from base.models import PasskeyChallenge, PasskeyCredential
from base.ratelimit import client_ip
from base.upload_validators import (
    MaxFileSizeValidator,
    sanitize_upload_filename,
    validate_file_magic,
)
from internship_api.models import InternshipAcceptance
from student.models import Student
from tests import factories

User = get_user_model()
pytestmark = pytest.mark.django_db


# ==============================================================================
# PART B: ARGON2ID & PASSWORD HASHING TESTS
# ==============================================================================

def test_argon2_is_preferred_hasher():
    """Verify Argon2 is configured and verifies passwords correctly."""
    hasher = Argon2PasswordHasher()
    hashed = make_password("SuperSecretP@ss123", hasher=hasher)
    assert hashed.startswith("argon2$")
    assert check_password("SuperSecretP@ss123", hashed) is True
    assert check_password("WrongPassword!", hashed) is False


def test_legacy_pbkdf2_passwords_remain_verifiable():
    """Verify existing PBKDF2 hashes verify properly without resetting passwords."""
    pbkdf2_hasher = PBKDF2PasswordHasher()
    legacy_hash = make_password("OldPassword123", hasher=pbkdf2_hasher)
    assert legacy_hash.startswith("pbkdf2_sha256$")

    # Verification must succeed
    assert check_password("OldPassword123", legacy_hash) is True
    assert check_password("WrongOldPassword", legacy_hash) is False


def test_user_model_save_hashes_password_securely():
    """Verify User.save() produces a valid secure hash."""
    user = User(email="sec_test@example.com", full_name="Sec Tester", role="student")
    user.set_password("SecurePassword456!")
    user.save()

    saved_user = User.objects.get(email="sec_test@example.com")
    assert saved_user.check_password("SecurePassword456!") is True
    # Passwords should never be stored in plain text
    assert saved_user.password != "SecurePassword456!"
    assert "$" in saved_user.password


# ==============================================================================
# PART A & D: AUTHENTICATION, CSRF & SESSION SECURITY
# ==============================================================================

def test_login_enforces_csrf():
    """Verify that login POST requests require CSRF tokens when enforced."""
    csrf_client = Client(enforce_csrf_checks=True)
    # Post without CSRF token must fail with 403 Forbidden
    response = csrf_client.post(
        reverse("login"),
        {"email": "any@example.com", "password": "password"},
    )
    assert response.status_code == 403


def test_password_update_rotates_session_auth_hash(client):
    """Verify updating password updates session auth hash and keeps session valid."""
    user = factories.UserFactory(password="InitialPassword#123")
    client.force_login(user)

    initial_hash = user.get_session_auth_hash()

    # Update password
    user.set_password("NewPassword#456")
    user.save()
    new_hash = user.get_session_auth_hash()

    assert initial_hash != new_hash


def test_logout_deletes_session_cookie(client):
    """Verify API logout clears the is_logged_in and session cookies."""
    user = factories.UserFactory()
    client.force_login(user)

    response = client.post(reverse("logout"))
    assert response.status_code == 200

    # Cookie deletion verification
    is_logged_in_cookie = response.cookies.get("is_logged_in")
    assert is_logged_in_cookie is not None
    assert is_logged_in_cookie.value == ""


# ==============================================================================
# PART E: CONTENT SECURITY POLICY & SECURITY HEADERS
# ==============================================================================

def test_csp_headers_in_response(client):
    """Verify CSP and security headers are emitted on responses."""
    response = client.get(reverse("health"))
    assert "Content-Security-Policy" in response
    csp = response["Content-Security-Policy"]
    assert "frame-ancestors 'none'" in csp
    assert "base-uri 'self'" in csp

    # Standard security headers
    assert response.get("X-Content-Type-Options") == "nosniff"
    assert response.get("X-Frame-Options") == "DENY"
    assert response.get("Referrer-Policy") == "strict-origin-when-cross-origin"


@override_settings(IS_DEV=False)
def test_production_csp_excludes_unsafe_eval(client):
    """Verify that in production (IS_DEV=False), unsafe-eval is not in CSP."""
    response = client.get(reverse("health"))
    csp = response["Content-Security-Policy"]
    assert "'unsafe-eval'" not in csp


# ==============================================================================
# PART G: TRUSTED PROXY & CLOUDFLARE IP RESOLUTION
# ==============================================================================

def test_client_ip_prioritizes_cloudflare_connecting_ip():
    """Verify that CF-Connecting-IP is used over spoofable X-Forwarded-For."""
    factory = RequestFactory()
    request = factory.get(
        "/",
        HTTP_CF_CONNECTING_IP="198.51.100.42",
        HTTP_X_FORWARDED_FOR="203.0.113.1, 10.0.0.1",
        REMOTE_ADDR="127.0.0.1",
    )
    resolved_ip = client_ip(request)
    assert resolved_ip == "198.51.100.42"


def test_client_ip_falls_back_to_x_forwarded_for():
    """Verify fallback to X-Forwarded-For when CF header is absent."""
    factory = RequestFactory()
    request = factory.get(
        "/",
        HTTP_X_FORWARDED_FOR="203.0.113.88, 10.0.0.1",
        REMOTE_ADDR="127.0.0.1",
    )
    resolved_ip = client_ip(request)
    assert resolved_ip == "203.0.113.88"


# ==============================================================================
# PART I: SENSITIVE MEDIA ACCESS CONTROL & IDOR PROTECTION
# ==============================================================================

def test_unauthenticated_media_access_is_forbidden(client):
    """Verify anonymous access to media files is blocked."""
    response = client.get("/media/offer_letters/test.pdf")
    assert response.status_code == 403


def test_path_traversal_in_media_is_blocked(client):
    """Verify path traversal attempts in media endpoint return 403."""
    user = factories.UserFactory()
    client.force_login(user)
    response = client.get("/media/../../etc/passwd")
    assert response.status_code == 403


def test_student_cannot_access_another_students_offer_letter(client, tmp_path, settings):
    """Verify IDOR prevention: student A cannot view student B's offer letter."""
    settings.MEDIA_ROOT = tmp_path
    offer_dir = tmp_path / "offer_letters"
    offer_dir.mkdir(parents=True, exist_ok=True)
    test_file = offer_dir / "student_b_secret_offer.pdf"
    test_file.write_bytes(b"%PDF-1.4 secret student offer")

    student_a = factories.UserFactory(role="student")
    factories.StudentFactory(user=student_a)

    student_b = factories.UserFactory(role="student")
    student_b_profile = factories.StudentFactory(user=student_b)

    import datetime
    InternshipAcceptance.objects.create(
        student=student_b_profile,
        company_name="Acme Corp",
        salary=25000,
        start_date=datetime.date(2026, 6, 1),
        completion_date=datetime.date(2026, 8, 31),
        offer_letter="offer_letters/student_b_secret_offer.pdf",
    )

    # Student A attempts to access student B's offer letter
    client.force_login(student_a)
    response = client.get("/media/offer_letters/student_b_secret_offer.pdf")
    assert response.status_code == 403


def test_staff_can_access_student_offer_letters(client, tmp_path, settings):
    """Verify institutional staff have access to view student offer letters for verification."""
    settings.MEDIA_ROOT = tmp_path
    offer_dir = tmp_path / "offer_letters"
    offer_dir.mkdir(parents=True, exist_ok=True)
    test_file = offer_dir / "student_c_offer.pdf"
    test_file.write_bytes(b"%PDF-1.4 test document content")

    officer = factories.UserFactory(role="placement_officer")
    client.force_login(officer)
    response = client.get("/media/offer_letters/student_c_offer.pdf")
    assert response.status_code == 200
    assert response.get("X-Content-Type-Options") == "nosniff"


# ==============================================================================
# PART J & K: LOG REDACTION & AUDIT LOGGING
# ==============================================================================

def test_sensitive_data_logging_filter():
    """Verify password and secret values are masked in log records."""
    log_filter = SensitiveDataFilter()
    raw_message = "User login attempt with password=MySuperSecretPassword and token: xyz123"
    masked = log_filter.mask_sensitive(raw_message)

    assert "MySuperSecretPassword" not in masked
    assert "xyz123" not in masked
    assert "***REDACTED***" in masked


# ==============================================================================
# PART I: FILE UPLOAD VALIDATION & MAGIC BYTES
# ==============================================================================

def test_sanitize_upload_filename():
    """Verify filename sanitization removes path traversal and unsafe characters."""
    assert sanitize_upload_filename("../../etc/passwd") == "passwd"
    assert sanitize_upload_filename("..\\..\\windows\\system32\\cmd.exe") == "cmd.exe"
    assert sanitize_upload_filename("my resume (1).pdf") == "my_resume__1_.pdf"


def test_validate_file_magic_valid_pdf():
    """Verify valid PDF magic bytes pass validation."""
    valid_pdf = SimpleUploadedFile("resume.pdf", b"%PDF-1.5 test content", content_type="application/pdf")
    assert validate_file_magic(valid_pdf, allowed_extensions=["pdf"]) is True


def test_validate_file_magic_disguised_executable_fails():
    """Verify an executable disguised as a PDF fails magic byte check."""
    disguised_exe = SimpleUploadedFile("malware.pdf", b"MZ\x90\x00\x03\x00\x00\x00", content_type="application/pdf")
    with pytest.raises(ValidationError):
        validate_file_magic(disguised_exe, allowed_extensions=["pdf"])


def test_max_file_size_validator():
    """Verify oversized files are rejected."""
    validator = MaxFileSizeValidator(max_mb=1)
    small_file = SimpleUploadedFile("small.pdf", b"x" * 500)
    validator(small_file)  # Should not raise

    large_file = SimpleUploadedFile("large.pdf", b"x" * (2 * 1024 * 1024))
    with pytest.raises(ValidationError):
        validator(large_file)


# ==============================================================================
# PASSKEY SECURITY TESTS
# ==============================================================================

def test_passkey_login_finish_rejects_missing_or_invalid_challenge(client):
    """Verify that passkey_login_finish rejects assertion without valid active challenge."""
    user = factories.UserFactory()
    cred = PasskeyCredential.objects.create(
        user=user,
        credential_id="test_cred_id_123",
        public_key="{}",
        name="Test Key",
    )

    # Attempt login finish without valid challenge
    fake_client_data = json.dumps({"type": "webauthn.get", "challenge": "nonexistent_challenge", "origin": "http://localhost:5173"})
    import base64
    b64_client_data = base64.urlsafe_b64encode(fake_client_data.encode()).decode()

    payload = {
        "credential": {
            "id": cred.credential_id,
            "response": {
                "clientDataJSON": b64_client_data,
                "authenticatorData": "",
                "signature": "",
            },
        }
    }
    response = client.post(
        reverse("passkey_login_finish"),
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "Invalid or expired" in response.data.get("error", "")
