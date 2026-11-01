from django.urls import path
from . import views

urlpatterns = [
    # Reports
    path("reports/", views.report_list, name="report-list"),
    path("reports/by-batch/", views.report_by_batch, name="report-by-batch"),
    path("reports/<int:pk>/", views.report_detail, name="report-detail"),

    # Register entries (nested under report)
    path("reports/<int:report_pk>/entries/", views.register_entry_list, name="entry-list"),
    path("reports/<int:report_pk>/entries/bulk/", views.register_entries_bulk, name="entry-bulk"),
    path("reports/<int:report_pk>/entries/<int:pk>/", views.register_entry_detail, name="entry-detail"),

    # Phase-wise reports (nested under report)
    path("reports/<int:report_pk>/phases/", views.phase_report_list, name="phase-list"),
    path("reports/<int:report_pk>/phases/<int:pk>/", views.phase_report_detail, name="phase-detail"),

    # Company records (standalone, not nested)
    path("companies/", views.company_record_list, name="company-list"),
    path("companies/<int:pk>/", views.company_record_detail, name="company-detail"),
]
