import os
from django.http import HttpResponseForbidden, HttpResponseNotFound
from base.audit import log_security_event
from django.contrib.auth.decorators import login_required
from base.views import redirect_user
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response as JSONResponse
from base.models import User, FacultyResponsibility
from django.contrib.auth import logout
from student.models import Student
from django.views.static import serve
from django.shortcuts import render, redirect
from django.conf import settings
from django.db import connections
from django.http import JsonResponse

def root_redirect(request):
    """
    Redirects root requests on the API domain to the primary frontend application site.
    """
    client_url = getattr(settings, "CLIENT_URL", "http://localhost:5173")
    return redirect(client_url)


def serve_static(request, path, document_root=""):
    return serve(request, path, document_root, show_indexes=True)


def serve_media(request, path):
    """Serve /media/ uploads securely with authentication and object-level permissions.
    Prevents path traversal, unauthenticated data leakage, and IDOR on student documents.
    """
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return HttpResponseForbidden("Authentication required to access media files.")

    # Prevent path traversal
    normalized_path = os.path.normpath(path).lstrip("/\\").replace("\\", "/")
    if ".." in normalized_path.split(os.sep) or normalized_path.startswith(".."):
        return HttpResponseForbidden("Access denied: Invalid path traversal attempt.")

    # Object-level authorization for sensitive offer letters
    if normalized_path.startswith("offer_letters/"):
        if getattr(user, "role", None) == "student" and not getattr(user, "is_superuser", False):
            from internship_api.models import InternshipAcceptance
            filename = os.path.basename(normalized_path)
            owns = (
                InternshipAcceptance.objects.filter(student__user=user, offer_letter=normalized_path).exists()
                or InternshipAcceptance.objects.filter(student__user=user, offer_letter__icontains=filename).exists()
            )
            if not owns:
                log_security_event(
                    "MEDIA_ACCESS_DENIED",
                    request=request,
                    user=user,
                    details={"path": normalized_path},
                    status="FAILURE",
                )
                return HttpResponseForbidden("Access denied: You do not have permission to view this offer letter.")

    response = serve(request, normalized_path, document_root=settings.MEDIA_ROOT)
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-cache, must-revalidate"
    ext = normalized_path.lower().split(".")[-1] if "." in normalized_path else ""
    if ext in ("pdf", "png", "jpg", "jpeg", "webp") or normalized_path.startswith("profile_images/"):
        response["Content-Disposition"] = f'inline; filename="{os.path.basename(normalized_path)}"'
    else:
        response["Content-Disposition"] = f'attachment; filename="{os.path.basename(normalized_path)}"'
    return response


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    try:
        connections["default"].cursor()
        return JsonResponse({"status": "ok"})
    except Exception:
        return JsonResponse({"status": "error"}, status=503)


@api_view(["GET"])
def my_protected_view(request): 
    if not request.user or not request.user.is_authenticated:
        return JSONResponse({"detail": "Not authenticated"}, status=401)
    
    try:
        current_user = User.objects.get(email=request.user.email)
        if current_user.role in ["faculty", "department_coordinator", "program_coordinator"]:
            faculty = FacultyResponsibility.objects.filter(user=current_user).first()
            if faculty:
                return JSONResponse(
                    {
                        "role": current_user.role,
                        "email": current_user.email,
                        "department": faculty.department,
                        "program": faculty.program,
                    }
                )
            else:
                return JSONResponse(
                    {
                        "role": current_user.role,
                        "email": current_user.email,
                        "department": None,
                        "program": None,
                    }
                )
        if current_user.role == "student":
            student = Student.objects.filter(user=current_user).first()
            if student:
                return JSONResponse(
                    {
                        "role": "student",
                        "email": current_user.email,
                        "department": student.department,
                        "academic_year": student.academic_year,
                    }
                )
            else:
                return JSONResponse(
                    {
                        "role": "student",
                        "email": current_user.email,
                        "department": None,
                        "academic_year": None,
                    }
                )
        return JSONResponse({"role": current_user.role, "email": current_user.email})
    except User.DoesNotExist:
        return JSONResponse({"detail": "User not found"}, status=404)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_api(request):
    log_security_event("LOGOUT", request=request, user=request.user)
    logout(request)
    response = JSONResponse({"message": "Logged out successfully."})
    domain = getattr(settings, "SESSION_COOKIE_DOMAIN", None)
    response.delete_cookie("is_logged_in", domain=domain)
    response.delete_cookie(settings.SESSION_COOKIE_NAME, domain=domain)
    return response

@login_required
def index(request):
    return render(request, "index.html")