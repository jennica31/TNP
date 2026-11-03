from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as login_user, logout
from django.contrib.auth.decorators import login_required
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from base.validators import password_strength_errors
from base.audit import log_security_event
from django.contrib.auth import update_session_auth_hash
import logging
from django_ratelimit.decorators import ratelimit
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from datetime import timedelta
import re
import secrets
import base64
import json
from base.models import User, PasswordResetOTP, UserOTP, PasskeyCredential, PasskeyChallenge

logger = logging.getLogger(__name__)

def _reset_session_email(group, request):
    return request.session.get("email") or request.session.session_key or ""

try:
    import webauthn
    from webauthn.helpers.structs import (
        AuthenticatorSelectionCriteria,
        UserVerificationRequirement,
        ResidentKeyRequirement,
        PublicKeyCredentialDescriptor,
    )
    from webauthn.helpers import generate_challenge, generate_user_handle, parse_registration_credential_json, parse_authentication_credential_json
    WEBAUTHN_AVAILABLE = True
except ImportError:
    WEBAUTHN_AVAILABLE = False


def redirect_user(request, user):
    login_user(request, user)
    response = redirect(settings.CLIENT_URL)
    domain = getattr(settings, "SESSION_COOKIE_DOMAIN", None)
    response.set_cookie("is_logged_in", "true", httponly=False, samesite="Lax", domain=domain)
    return response


@never_cache
@ratelimit(key="post:email", rate="5/m", method="POST", block=True)
@ratelimit(key="ip", rate="100/m", method="POST", block=True)
def login(request):
    if request.method == "POST":
        email = request.POST.get("email")
        password = request.POST.get("password")

        if not email or not password:
            messages.error(request, "Both email and password are required.")
            return render(request, "base/login.html")

        user = authenticate(request, email=email, password=password)
        if user is not None:
            log_security_event("LOGIN_SUCCESS", request=request, user=user)
            response = redirect_user(request, user)
            return response
        else:
            log_security_event("LOGIN_FAILURE", request=request, details={"email": email}, status="FAILURE")
            messages.error(request, "Invalid email or password.")

    return render(request, "base/login.html")


def send_otp_email(user, raw_otp):
    """
    Renders HTML + Plaintext templates and dispatches OTP email via SMTP with timeout.
    Returns (success: bool, error_msg: str).
    """
    subject = "Password Reset OTP - TCET T&P Automation"
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", settings.EMAIL_HOST_USER)
    
    context = {
        "otp": raw_otp,
        "full_name": user.full_name,
        "email": user.email,
    }
    
    try:
        html_content = render_to_string("emails/otp.html", context)
        text_content = render_to_string("emails/otp.txt", context)
        
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[user.email],
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        print(f"--> [SMTP SUCCESS] OTP email sent successfully to {user.email}!")
        logger.info(f"OTP email sent successfully to {user.email}")
        return True, ""
    except Exception as e:
        logger.error(f"Failed to send OTP email to {user.email}: {str(e)}")
        if getattr(settings, "IS_DEV", False):
            logger.warning(f"[DEV MODE] OTP for {user.email} is: {raw_otp}")
            return True, ""
        return False, str(e)


# ---------------------------------------------------------------------------
# API Endpoints for Password Reset Workflow (React SPA)
# ---------------------------------------------------------------------------

@never_cache
@ratelimit(key="post:email", rate="3/h", method="POST", block=True)
@ratelimit(key="ip", rate="60/h", method="POST", block=True)
def password_reset_request(request):
    if request.method == "POST":
        email = request.POST.get("email", "").strip().lower()
        try:
            user = User.objects.get(email=email)
            otp_obj, raw_otp = UserOTP.create_otp_for_user(user, ttl_seconds=120)
            send_otp_email(user, raw_otp)
        except User.DoesNotExist:
            pass
        request.session["email"] = email
        messages.success(
            request, "If an account with that email exists, an OTP has been sent."
        )
        return redirect(f"{settings.CLIENT_URL}/verify-otp")

    return redirect(f"{settings.CLIENT_URL}/forgot-password")


@never_cache
@ratelimit(key=_reset_session_email, rate="5/h", method="POST", block=True)
@ratelimit(key="ip", rate="100/h", method="POST", block=True)
def password_reset_verify_otp(request):
    if request.method == "POST":
        email = request.session.get("email")
        otp = request.POST.get("otp", "").strip()
        try:
            user = User.objects.get(email=email)
            otp_obj = UserOTP.objects.filter(user=user, is_used=False).order_by("-created_at").first()
            if otp_obj:
                success, token_or_err = otp_obj.verify_otp_code(otp)
                if success:
                    request.session["reset_user_id"] = str(user.id)
                    request.session["reset_token"] = token_or_err
                    return redirect(f"{settings.CLIENT_URL}/reset-password")
                else:
                    messages.error(request, token_or_err)
            else:
                messages.error(request, "Invalid or expired OTP.")
        except User.DoesNotExist:
            messages.error(request, "Invalid email or OTP.")
    return redirect(f"{settings.CLIENT_URL}/verify-otp")


@never_cache
@ratelimit(key=_reset_session_email, rate="5/h", method="POST", block=True)
@ratelimit(key="ip", rate="100/h", method="POST", block=True)
def password_reset_confirm(request):
    user_id = request.session.get("reset_user_id")
    if not user_id:
        return redirect(f"{settings.CLIENT_URL}/forgot-password")
    user = User.objects.get(id=user_id)
    if request.method == "POST":
        password = request.POST.get("password")
        confirm_password = request.POST.get("confirm_password")
        if password != confirm_password:
            messages.error(request, "Passwords do not match.")
        else:
            errors = password_strength_errors(password, user=user)
            if errors:
                messages.error(request, " ".join(errors))
            else:
                user.set_password(password)
                user.save()
                del request.session["reset_user_id"]
                if "reset_token" in request.session:
                    del request.session["reset_token"]
                messages.success(request, "Your password has been reset successfully.")
                return redirect(f"{settings.CLIENT_URL}/login")
    return redirect(f"{settings.CLIENT_URL}/reset-password")


@never_cache
@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
@ratelimit(key="post:email", rate="5/m", method="POST", block=True)
@ratelimit(key="ip", rate="60/h", method="POST", block=True)
def api_password_reset_request(request):
    """
    POST /auth/api/password_reset/request/
    Initiates password recovery. Generates a secure 2-minute 6-digit OTP and emails it.
    """
    email = request.data.get("email", "").strip().lower()
    if not email:
        return Response({"error": "Email address is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
        # Check active OTP cooldown
        latest_otp = UserOTP.objects.filter(user=user, is_used=False).order_by("-created_at").first()
        if latest_otp and not latest_otp.is_expired():
            remaining = int((latest_otp.expires_at - timezone.now()).total_seconds())
            if remaining > 0:
                # Return active timer status
                return Response(
                    {
                        "status": "otp_sent",
                        "email": email,
                        "expires_in_seconds": remaining,
                        "cooldown_seconds": remaining,
                        "message": f"An active OTP was already sent. Please wait {remaining} seconds before requesting again.",
                    },
                    status=status.HTTP_200_OK,
                )

        otp_obj, raw_otp = UserOTP.create_otp_for_user(user, ttl_seconds=120)
        sent, err = send_otp_email(user, raw_otp)
        if not sent:
            logger.error(f"SMTP delivery failed for {user.email}: {err}")
            return Response(
                {"error": f"Failed to send email via SMTP ({err}). Please configure a valid Gmail App Password in .env."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    except User.DoesNotExist:
        # Uniform timing response to prevent email enumeration
        pass

    return Response(
        {
            "status": "otp_sent",
            "email": email,
            "expires_in_seconds": 120,
            "cooldown_seconds": 120,
            "message": "If an account with that email exists, an OTP has been sent.",
        },
        status=status.HTTP_200_OK,
    )


@never_cache
@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
@ratelimit(key="post:email", rate="5/m", method="POST", block=True)
@ratelimit(key="ip", rate="60/h", method="POST", block=True)
def api_password_reset_resend_otp(request):
    """
    POST /auth/api/password_reset/resend_otp/
    Resends OTP after cooldown expires. Invalidates previous OTP and restarts 2-min timer.
    """
    email = request.data.get("email", "").strip().lower()
    if not email:
        return Response({"error": "Email address is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
        latest_otp = UserOTP.objects.filter(user=user, is_used=False).order_by("-created_at").first()
        if latest_otp and not latest_otp.is_expired():
            remaining = int((latest_otp.expires_at - timezone.now()).total_seconds())
            if remaining > 0:
                return Response(
                    {
                        "error": f"Please wait {remaining} seconds before requesting a new OTP.",
                        "remaining_seconds": remaining,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        otp_obj, raw_otp = UserOTP.create_otp_for_user(user, ttl_seconds=120)
        sent, err = send_otp_email(user, raw_otp)
        if not sent:
            return Response(
                {"error": f"Failed to deliver OTP email: {err}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    except User.DoesNotExist:
        pass

    return Response(
        {
            "status": "otp_resent",
            "email": email,
            "expires_in_seconds": 120,
            "cooldown_seconds": 120,
            "message": "A new OTP has been sent to your email address.",
        },
        status=status.HTTP_200_OK,
    )


@never_cache
@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
@ratelimit(key="post:email", rate="10/m", method="POST", block=True)
@ratelimit(key="ip", rate="100/h", method="POST", block=True)
def api_password_reset_verify_otp(request):
    """
    POST /auth/api/password_reset/verify_otp/
    Verifies 6-digit OTP code. Issues a single-use 10-minute reset_token on success.
    """
    email = request.data.get("email", "").strip().lower()
    otp_code = request.data.get("otp", "").strip()

    if not email or not otp_code:
        return Response({"error": "Both email and OTP code are required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
        otp_obj = UserOTP.objects.filter(user=user, is_used=False).order_by("-created_at").first()
        if not otp_obj:
            return Response({"error": "No active OTP found. Please request a new OTP."}, status=status.HTTP_400_BAD_REQUEST)

        success, result_or_error = otp_obj.verify_otp_code(otp_code)
        if success:
            return Response(
                {
                    "status": "otp_verified",
                    "reset_token": result_or_error,
                    "message": "OTP verified successfully. Proceed to reset your password.",
                },
                status=status.HTTP_200_OK,
            )
        else:
            return Response({"error": result_or_error}, status=status.HTTP_400_BAD_REQUEST)

    except User.DoesNotExist:
        return Response({"error": "Invalid email or OTP code."}, status=status.HTTP_400_BAD_REQUEST)


@never_cache
@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
@ratelimit(key="ip", rate="30/h", method="POST", block=True)
def api_password_reset_confirm(request):
    """
    POST /auth/api/password_reset/confirm/
    Updates password using valid reset_token. Instantly synchronizes authentication state.
    """
    reset_token = request.data.get("reset_token", "").strip()
    new_password = request.data.get("new_password", "").strip()
    confirm_password = request.data.get("confirm_password", "").strip()

    if not reset_token or not new_password or not confirm_password:
        return Response({"error": "Reset token and passwords are required."}, status=status.HTTP_400_BAD_REQUEST)

    if new_password != confirm_password:
        return Response({"error": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        otp_obj = UserOTP.objects.get(reset_token=reset_token)
        if not otp_obj.reset_token_expires_at or timezone.now() >= otp_obj.reset_token_expires_at:
            return Response({"error": "Password reset token has expired. Please request a new OTP."}, status=status.HTTP_400_BAD_REQUEST)

        user = otp_obj.user

        # Password strength check. Was length-only; the reset-password screen
        # (client_app/src/pages/auth/ResetPassword.tsx) shows a 4-item
        # requirements checklist, so the server needs to enforce all four,
        # not just the first one - the browser check is a courtesy, not the
        # boundary (base/permissions.py: "The API is the security boundary").
        errors = password_strength_errors(new_password, user=user)
        if errors:
            return Response({"error": " ".join(errors)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        # Invalidate reset token
        otp_obj.reset_token = None
        otp_obj.save(update_fields=["reset_token"])

        logger.info(f"Password reset successfully for user {user.email}")
        return Response(
            {
                "status": "password_reset_success",
                "message": "Password updated successfully. You may now log in with your new password.",
            },
            status=status.HTTP_200_OK,
        )
    except UserOTP.DoesNotExist:
        return Response({"error": "Invalid or expired password reset token."}, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Passkey (WebAuthn / FIDO2) API Endpoints
# ---------------------------------------------------------------------------

@never_cache
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def passkey_register_begin(request):
    """
    POST /auth/api/passkey/register/begin/
    Initiates WebAuthn Passkey registration for the authenticated user.
    """
    user = request.user
    rp_id = getattr(settings, "WEBAUTHN_RP_ID", request.get_host().split(":")[0])
    rp_name = getattr(settings, "WEBAUTHN_RP_NAME", "TCET T&P Automation")

    challenge_str = secrets.token_urlsafe(32)
    PasskeyChallenge.objects.create(
        user=user,
        challenge=challenge_str,
        challenge_type="register",
        expires_at=timezone.now() + timedelta(minutes=5),
    )

    existing_credentials = PasskeyCredential.objects.filter(user=user)
    exclude_credentials = [
        {
            "id": cred.credential_id,
            "type": "public-key",
        }
        for cred in existing_credentials
    ]

    options = {
        "rp": {"name": rp_name, "id": rp_id},
        "user": {
            "id": base64.b64encode(str(user.id).encode()).decode(),
            "name": user.email,
            "displayName": user.full_name or user.email,
        },
        "challenge": challenge_str,
        "pubKeyCredParams": [
            {"type": "public-key", "alg": -7},   # ES256
            {"type": "public-key", "alg": -257}, # RS256
        ],
        "timeout": 60000,
        "excludeCredentials": exclude_credentials,
        "authenticatorSelection": {
            "authenticatorAttachment": "platform",
            "userVerification": "preferred",
            "residentKey": "preferred",
        },
        "attestation": "none",
    }
    return Response(options, status=status.HTTP_200_OK)



def _extract_challenge_from_client_data(client_data_raw):
    if not client_data_raw:
        return None
    try:
        pad = len(client_data_raw) % 4
        if pad:
            client_data_raw += "=" * (4 - pad)
        decoded_bytes = base64.urlsafe_b64decode(client_data_raw)
        client_data = json.loads(decoded_bytes.decode("utf-8"))
        challenge = client_data.get("challenge", "")
        # Remove padding in challenge if any
        return challenge.rstrip("=")
    except Exception:
        return None

@never_cache
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def passkey_register_finish(request):
    """
    POST /auth/api/passkey/register/finish/
    Completes WebAuthn Passkey registration.
    """
    user = request.user
    credential = request.data.get("credential")
    name = request.data.get("name", "My Passkey").strip()

    if not credential:
        return Response({"error": "Credential data is required."}, status=status.HTTP_400_BAD_REQUEST)

    cred_id = credential.get("id") or credential.get("rawId")
    if not cred_id:
        return Response({"error": "Invalid credential ID."}, status=status.HTTP_400_BAD_REQUEST)

    client_data_raw = credential.get("response", {}).get("clientDataJSON")
    submitted_challenge = _extract_challenge_from_client_data(client_data_raw)
    
    challenge_qs = PasskeyChallenge.objects.filter(
        user=user,
        challenge_type="register",
        expires_at__gt=timezone.now(),
    )
    if submitted_challenge:
        matched_challenge = challenge_qs.filter(challenge__startswith=submitted_challenge).first()
    else:
        matched_challenge = None

    if not matched_challenge:
        return Response({"error": "Invalid or expired registration challenge."}, status=status.HTTP_400_BAD_REQUEST)

    matched_challenge.delete()

    PasskeyCredential.objects.create(
        user=user,
        credential_id=str(cred_id),
        public_key=json.dumps(credential),
        name=name,
        device_type="platform",
    )
    log_security_event("PASSKEY_REGISTER_SUCCESS", request=request, user=user)

    return Response({"status": "passkey_registered", "name": name}, status=status.HTTP_201_CREATED)


@never_cache
@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def passkey_login_begin(request):
    """
    POST /auth/api/passkey/login/begin/
    Initiates WebAuthn Passkey authentication.
    """
    email = request.data.get("email", "").strip().lower()
    challenge_str = secrets.token_urlsafe(32)
    
    user = None
    allow_credentials = []
    if email:
        try:
            user = User.objects.get(email=email)
            user_credentials = PasskeyCredential.objects.filter(user=user)
            allow_credentials = [{"id": c.credential_id, "type": "public-key"} for c in user_credentials]
        except User.DoesNotExist:
            pass

    PasskeyChallenge.objects.create(
        user=user,
        challenge=challenge_str,
        challenge_type="login",
        expires_at=timezone.now() + timedelta(minutes=5),
    )

    options = {
        "challenge": challenge_str,
        "timeout": 60000,
        "allowCredentials": allow_credentials,
        "userVerification": "preferred",
    }
    return Response(options, status=status.HTTP_200_OK)


@never_cache
@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def passkey_login_finish(request):
    """
    POST /auth/api/passkey/login/finish/
    Completes Passkey login, authenticates user, and sets session cookies.
    """
    credential = request.data.get("credential")
    if not credential:
        return Response({"error": "Credential data is required."}, status=status.HTTP_400_BAD_REQUEST)

    cred_id = credential.get("id") or credential.get("rawId")
    try:
        passkey = PasskeyCredential.objects.get(credential_id=str(cred_id))
        user = passkey.user

        client_data_raw = credential.get("response", {}).get("clientDataJSON")
        submitted_challenge = _extract_challenge_from_client_data(client_data_raw)

        challenge_qs = PasskeyChallenge.objects.filter(
            challenge_type="login",
            expires_at__gt=timezone.now(),
        )
        if submitted_challenge:
            matched_challenge = challenge_qs.filter(challenge__startswith=submitted_challenge).first()
        else:
            matched_challenge = None

        if not matched_challenge:
            log_security_event("PASSKEY_LOGIN_FAILURE", request=request, details={"reason": "Invalid or expired challenge"}, status="FAILURE")
            return Response({"error": "Invalid or expired authentication challenge."}, status=status.HTTP_400_BAD_REQUEST)

        if matched_challenge.user and matched_challenge.user != user:
            log_security_event("PASSKEY_LOGIN_FAILURE", request=request, details={"reason": "User mismatch"}, status="FAILURE")
            return Response({"error": "Credential does not match expected challenge user."}, status=status.HTTP_400_BAD_REQUEST)

        # Single-use challenge: prevent replay attacks
        matched_challenge.delete()

        passkey.last_used = timezone.now()
        passkey.save(update_fields=["last_used"])

        # Authenticate and set session cookie
        login_user(request, user)
        log_security_event("PASSKEY_LOGIN_SUCCESS", request=request, user=user)
        response = Response(
            {
                "status": "authenticated",
                "email": user.email,
                "role": user.role,
                "full_name": user.full_name,
            },
            status=status.HTTP_200_OK,
        )
        domain = getattr(settings, "SESSION_COOKIE_DOMAIN", None)
        response.set_cookie("is_logged_in", "true", httponly=False, samesite="Lax", domain=domain)
        return response

    except PasskeyCredential.DoesNotExist:
        log_security_event("PASSKEY_LOGIN_FAILURE", request=request, details={"reason": "Unrecognized credential"}, status="FAILURE")
        return Response({"error": "Unrecognized Passkey credential."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def passkey_credentials_api(request, pk=None):
    """
    GET /auth/api/passkey/credentials/ — List passkeys
    DELETE /auth/api/passkey/credentials/<pk>/ — Delete passkey
    """
    if request.method == "GET":
        passkeys = PasskeyCredential.objects.filter(user=request.user)
        data = [
            {
                "id": str(p.id),
                "name": p.name,
                "created_at": p.created_at,
                "last_used": p.last_used,
            }
            for p in passkeys
        ]
        return Response(data, status=status.HTTP_200_OK)

    if request.method == "DELETE" and pk:
        try:
            passkey = PasskeyCredential.objects.get(id=pk, user=request.user)
            passkey.delete()
            return Response({"status": "deleted"}, status=status.HTTP_200_OK)
        except PasskeyCredential.DoesNotExist:
            return Response({"error": "Passkey not found."}, status=status.HTTP_404_NOT_FOUND)


@login_required
def user_profile(request):
    user = User.objects.get(id=request.user.id)
    return render(
        request,
        "base/user_profile.html",
        {"user": user, "client_url": settings.CLIENT_URL},
    )


def logout_view(request):
    log_security_event("LOGOUT", request=request, user=request.user)
    logout(request)
    response = redirect('login')
    domain = getattr(settings, "SESSION_COOKIE_DOMAIN", None)
    response.delete_cookie("is_logged_in", domain=domain)
    response.delete_cookie(settings.SESSION_COOKIE_NAME, domain=domain)
    return response


@never_cache
@login_required
def password_update(request):
    user = User.objects.get(id=request.user.id)
    if request.method == "POST":
        password = request.POST.get("new_password")
        confirm_password = request.POST.get("confirm_password")
        if password != confirm_password:
            messages.error(request, "Passwords do not match.")
        else:
            # This form previously had no strength check at all - only the
            # match check above - so a logged-in user could set a one-
            # character password. Same rules as the reset-password flow.
            errors = password_strength_errors(password, user=user)
            if errors:
                messages.error(request, " ".join(errors))
            else:
                user.set_password(password)
                user.save()
                update_session_auth_hash(request, user)
                log_security_event("PASSWORD_CHANGE", request=request, user=user)
                messages.success(request, "Password updated successfully.")
    return render(request, "base/password_update.html")
