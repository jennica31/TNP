from django.contrib import admin
from .models import PlacementReport, PlacementRegisterEntry, CompanyRecord, PhaseWiseReport


class PlacementRegisterEntryInline(admin.TabularInline):
    model = PlacementRegisterEntry
    extra = 0


class PhaseWiseReportInline(admin.TabularInline):
    model = PhaseWiseReport
    extra = 0


@admin.register(PlacementReport)
class PlacementReportAdmin(admin.ModelAdmin):
    list_display = ["batch", "program", "ref_no", "report_date", "is_draft", "updated_at"]
    list_filter = ["batch", "program", "is_draft"]
    inlines = [PlacementRegisterEntryInline, PhaseWiseReportInline]


@admin.register(PlacementRegisterEntry)
class PlacementRegisterEntryAdmin(admin.ModelAdmin):
    list_display = ["sr_no", "student_name", "branch", "employer_name", "employer_category", "salary_lpa", "campus_on_off"]
    list_filter = ["employer_category", "campus_on_off", "report__batch"]
    search_fields = ["student_name", "tnp_uid", "employer_name"]


@admin.register(CompanyRecord)
class CompanyRecordAdmin(admin.ModelAdmin):
    list_display = ["company_name", "first_visit_year", "mnc_status", "criteria_yes_no", "technical_yes_no", "is_current_batch"]
    search_fields = ["company_name"]
    list_filter = ["mnc_status", "is_current_batch"]


@admin.register(PhaseWiseReport)
class PhaseWiseReportAdmin(admin.ModelAdmin):
    list_display = ["report", "phase", "total_admitted", "students_placed", "companies_visited"]
    list_filter = ["phase"]
