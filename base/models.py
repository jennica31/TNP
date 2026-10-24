from django.contrib.auth.models import AbstractBaseUser, UserManager, PermissionsMixin
from django.db import models
import os
import uuid
from django.core.mail import send_mail
from django.conf import settings
from datetime import timedelta
from django.utils import timezone
import pyotp
from django.contrib.auth.hashers import make_password, check_password


class CustomUserManager(UserManager):
    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("You have not provided a valid e-mail address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        try:
            send_mail(
                "Account Created",
                f"Your account has been created. Your username is {email}. Please use the forgot password option or contact your administrator to set your password.",
                settings.EMAIL_HOST_USER,  # Use settings.EMAIL_HOST_USER as the from email
                [email],  # Recipient list should be a list of email addresses
                fail_silently=False,  # Make sure to catch actual errors
            )
        except Exception as e:
            # Error log removed to prevent PII leakage
            pass
        user.save(using=self._db)
        return user

    def create_user(self, email=None, password=None, **extra_fields):
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "system_admin")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    USER_ROLE_TYPE = [
        ("student", "student"),
        ("system_admin", "system_admin"),
        ("principal", "principal"),
        ("training_officer", "training_officer"),
        ("placement_officer", "placement_officer"),
        ("internship_officer", "internship_officer"),
        ("faculty", "faculty"),
        ("staff", "staff"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=100)
    role = models.CharField(choices=USER_ROLE_TYPE, max_length=200, default="student")
    is_superuser = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = CustomUserManager()

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        app_label = "base"

    def get_full(self):
        return self.full_name

    def save(self, *args, **kwargs):
        if not self.password:
            default_pwd = getattr(settings, "DEFAULT_SEED_PASSWORD", os.getenv("DEFAULT_SEED_PASSWORD", "tcet@1234"))
            self.set_password(default_pwd)
        elif not (self.password.startswith(('pbkdf2_sha256$', 'pbkdf2_sha1$', 'argon2$', 'bcrypt$', 'scrypt$', 'bcrypt_sha256$', 'md5$')) or self.password.startswith('!')):
            self.set_password(self.password)
        super().save(*args, **kwargs)


class UserDevice(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    device_id = models.CharField(max_length=255, unique=True)
    is_verified = models.BooleanField(default=False)
    last_login = models.DateTimeField(auto_now=True)


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp_secret = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def generate_otp_secret(cls, user):
        otp_secret = pyotp.random_base32()
        return cls.objects.create(user=user, otp_secret=otp_secret)

    def verify_otp(self, otp):
        totp = pyotp.TOTP(self.otp_secret, interval=600)  # 10 minutes validity
        return totp.verify(otp) and self.created_at >= timezone.now() - timedelta(
            minutes=10
        )


class UserOTP(models.Model):
    """
    Production-grade, cryptographically secure 6-digit OTP model.
    Stores hashed OTP (never plain text), explicit 2-minute expiration,
    attempt tracking, resend cooldowns, and single-use password reset tokens.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otps")
    otp_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts_count = models.IntegerField(default=0)
    resend_count = models.IntegerField(default=0)
    is_used = models.BooleanField(default=False)
    reset_token = models.CharField(max_length=100, null=True, blank=True, unique=True, db_index=True)
    reset_token_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "User OTP"
        verbose_name_plural = "User OTPs"

    @classmethod
    def create_otp_for_user(cls, user, ttl_seconds=120):
        import secrets
        # Invalidate all prior unused OTPs for this user
        cls.objects.filter(user=user, is_used=False).update(is_used=True)

        # Generate cryptographically secure 6-digit number
        raw_otp = f"{secrets.randbelow(1000000):06d}"
        otp_hash = make_password(raw_otp)
        expires_at = timezone.now() + timedelta(seconds=ttl_seconds)

        otp_instance = cls.objects.create(
            user=user,
            otp_hash=otp_hash,
            expires_at=expires_at,
        )
        return otp_instance, raw_otp

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def verify_otp_code(self, raw_otp):
        import secrets
        if self.is_used or self.is_expired():
            return False, "OTP has expired or already been used."

        if self.attempts_count >= 5:
            self.is_used = True
            self.save(update_fields=["is_used"])
            return False, "Too many failed attempts. Please request a new OTP."

        self.attempts_count += 1

        if check_password(raw_otp, self.otp_hash):
            self.is_used = True
            self.reset_token = secrets.token_urlsafe(32)
            self.reset_token_expires_at = timezone.now() + timedelta(minutes=10)
            self.save(update_fields=["attempts_count", "is_used", "reset_token", "reset_token_expires_at"])
            return True, self.reset_token
        else:
            self.save(update_fields=["attempts_count"])
            remaining = 5 - self.attempts_count
            return False, f"Invalid OTP. {remaining} attempt(s) remaining."


class PasskeyCredential(models.Model):
    """
    WebAuthn / FIDO2 Passkey credential model for biometrics and hardware keys.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="passkeys")
    credential_id = models.CharField(max_length=255, unique=True, db_index=True)
    public_key = models.TextField()
    sign_count = models.BigIntegerField(default=0)
    device_type = models.CharField(max_length=50, default="single_device")
    backed_up = models.BooleanField(default=False)
    transports = models.JSONField(default=list, blank=True)
    name = models.CharField(max_length=100, default="Passkey")
    created_at = models.DateTimeField(auto_now_add=True)
    last_used = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Passkey Credential"
        verbose_name_plural = "Passkey Credentials"

    def __str__(self):
        return f"{self.user.email} - {self.name} ({self.device_type})"


class PasskeyChallenge(models.Model):
    """
    Challenge storage for WebAuthn registration and authentication flows.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name="passkey_challenges")
    challenge = models.CharField(max_length=255, unique=True, db_index=True)
    challenge_type = models.CharField(max_length=20, choices=[("register", "Register"), ("login", "Login")])
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_expired(self):
        return timezone.now() >= self.expires_at


PROGRAM_OPTIONS = [
    ("ACT_Technical", "ACT_Technical"),
    ("ACT_Aptitude", "ACT_Aptitude"),
    ("Coding_Contest", "Coding_Contest"),
    ("SDP", "SDP"),
]


class FacultyResponsibility(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    designation = models.CharField(max_length=255, null=True, blank=True)
    program = models.CharField(max_length=255, null=True, blank=True)
    department = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        verbose_name = "Faculty Responsibility"
        verbose_name_plural = "Faculty Responsibilities"

    def __str__(self):
        parts = []
        if self.designation:
            parts.append(f"Desig: {self.designation}")
        if self.department:
            parts.append(f"Dept: {self.department}")
        if self.program:
            parts.append(f"Program: {self.program}")
        desc = " | ".join(parts) if parts else "No assignment"
        return f"{self.user.email} ({desc})"


NON_STUDENT_ROLES = [
    choice for choice in User.USER_ROLE_TYPE if choice[0] != "student"
]


class StudentUserManager(CustomUserManager):
    def get_queryset(self):
        return super().get_queryset().filter(role="student")


class FacultyStaffUserManager(CustomUserManager):
    def get_queryset(self):
        return super().get_queryset().exclude(role="student")


class StudentUser(User):
    objects = StudentUserManager()

    class Meta:
        proxy = True
        verbose_name = "Student User"
        verbose_name_plural = "Student Users"


class FacultyStaffUser(User):
    objects = FacultyStaffUserManager()

    class Meta:
        proxy = True
        verbose_name = "Faculty & Staff User"
        verbose_name_plural = "Faculty & Staff Users"

