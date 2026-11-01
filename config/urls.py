"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic.base import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from . import views
from base.views import user_profile, password_update

handler500 = "base.error_utils.handle_500"

from django.conf import settings

admin.site.site_url = getattr(settings, "CLIENT_URL", "http://localhost:5173")

# The React build is served by its own Nginx container (client_app/) at the
# apex domain, not by Django - there is no catch-all SPA route or
# django.conf.urls.static.static() here anymore (that helper is a no-op
# outside DEBUG=True anyway, so it never actually served anything in
# production; see views.serve_media for the real media-serving route).

urlpatterns = [
    path("", views.root_redirect, name="root_redirect"),
    # Browsers request this at the origin root regardless of the <link
    # rel="icon"> tag every base/templates page already declares - without
    # this route it 404s on every single page load (T-27).
    path(
        "favicon.ico",
        RedirectView.as_view(url="/static/img/tcet-logo.png", permanent=True),
        name="favicon",
    ),
    path("admin/", admin.site.urls),
    path("api/health/", views.health, name="health"),
    # T-22. /api/schema/ is what the typed TS client is generated from;
    # /api/schema/docs/ is a human-readable browser for it.
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="schema-docs",
    ),
    path("api/department_coordinator/", include("department_coordinator.urls")),
    path("auth/", include("base.urls")),
    path("api/placement_officer/", include("placements.urls_reports")),
    path("api/training_officer/", include("training_officer.urls")),
    path("api/", views.my_protected_view, name="check-auth"),
    path("api/notifications/", include("notifications.urls")),
    path("api/program_coordinator/", include("program_coordinator_api.urls")),
    path("api/internship/", include("internship_api.urls")),
    path("api/student/", include("student.urls")),
    path("api/faculty_coordinator/", include("faculty_coordinator.urls")),
    path("api/logout/", views.logout_api, name="logout"),
    path("profile/", user_profile, name="user_profile"),
    path(
        "profile/update_password",
        password_update,
        name="user_profile_update_password",
    ),
    path("api/staff/", include("placements.urls_drives")),
    path("api/reports/", include("reports.urls")),
    re_path(r"^media/(?P<path>.*)$", views.serve_media, name="serve_media"),
]
