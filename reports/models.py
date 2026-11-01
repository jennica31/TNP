"""Report Management models for TNP Portal.

Stores placement report data following the official TCET TNP report formats:
- PlacementReport: Main report (TCET/TNP/FRM/IP-06/09)
- PlacementRegisterEntry: Student placement register (TCET/TNP/FRM/IP-06/02)
- CompanyRecord: Batch-wise company record (TCET/T&P/FRM/IP-06/11)
- PhaseWiseReport: Phase-wise placement data (TCET/T&P/FRM/IP-06/11)
"""

from django.db import models
import statistics


class PlacementReport(models.Model):
    """Main Placement Data Analysis report. TCET/TNP/FRM/IP-06/09."""

    REVISION_CHOICES = [("A", "A"), ("B", "B"), ("C", "C")]

    # Document metadata
    batch = models.CharField(max_length=50, db_index=True)  # e.g. "2027"
    program = models.CharField(max_length=50, default="MCA")  # MCA/BE/etc.
    ref_no = models.CharField(max_length=100, blank=True, default="")
    report_no = models.CharField(max_length=100, blank=True, default="")
    revision = models.CharField(max_length=10, choices=REVISION_CHOICES, default="B")
    report_date = models.DateField(null=True, blank=True)

    # Student Admission and Consent (section 05)
    admitted_final_year = models.PositiveIntegerField(default=0)
    opt_out = models.PositiveIntegerField(default=0)
    interested = models.PositiveIntegerField(default=0)
    eligible = models.PositiveIntegerField(default=0)
    not_eligible = models.PositiveIntegerField(default=0)

    # Completion info
    due_date = models.DateField(null=True, blank=True)
    completion_date = models.DateField(null=True, blank=True)
    reason_if_late = models.TextField(blank=True, default="")

    # Signatories (stored as JSON for flexibility)
    signatories = models.JSONField(default=dict, blank=True)
    # e.g. {"clerk": {"name": "Rajesh Singh", "designation": "Sr.Clerk", "date": ""},
    #        "placement_officer": {"name": "Rupali Mane", "designation": "Dy.(Placement Officer)", "date": ""},
    #        "dean": {"name": "Dr. Zahir Aalam", "designation": "Dean(TP&IL)", "date": ""},
    #        "vice_principal": {"name": "Dr. R.R. Sedamkar", "designation": "Vice-Principal", "date": ""}}

    copy_to = models.JSONField(default=list, blank=True)
    # e.g. ["Principal", "Vice Principal", "All Deans", "All HODs"]

    # Phase 1 process rows (editable company placement process entries for Section 01)
    phase1_processes = models.JSONField(default=list, blank=True)

    # Draft management
    is_draft = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reports_placement_report"
        unique_together = [("batch", "program")]

    def __str__(self):
        return f"Placement Report {self.batch} {self.program}"


class PlacementRegisterEntry(models.Model):
    """Individual student placement entry. TCET/TNP/FRM/IP-06/02."""

    EMPLOYER_CATEGORY_CHOICES = [
        ("CAT-1", "CAT-1 (Super Dream)"),
        ("CAT-2", "CAT-2 (Dream)"),
        ("CAT-3", "CAT-3 (Normal)"),
    ]
    PLACEMENT_TYPE_CHOICES = [
        ("Regular", "Regular"),
        ("HackwithInfy", "HackwithInfy"),
        ("AEDP", "AEDP"),
        ("PLI", "PLI"),
        ("OJT", "OJT"),
        ("Off-Campus", "Off-Campus"),
    ]
    CAMPUS_CHOICES = [
        ("ON", "On Campus"),
        ("OFF", "Off Campus"),
    ]

    report = models.ForeignKey(
        PlacementReport,
        on_delete=models.CASCADE,
        related_name="register_entries",
    )
    sr_no = models.PositiveIntegerField()
    branch = models.CharField(max_length=50)  # e.g. MCA-A, MCA-B
    division = models.CharField(max_length=10, blank=True, default="")
    tnp_uid = models.CharField(max_length=100)  # e.g. 25-MCAA25-27
    student_name = models.CharField(max_length=255)
    employer_visit_date = models.CharField(max_length=100, blank=True, default="")
    employer_category = models.CharField(max_length=10, choices=EMPLOYER_CATEGORY_CHOICES, default="CAT-3")
    placement_type = models.CharField(max_length=50, choices=PLACEMENT_TYPE_CHOICES, default="Regular")
    employer_name = models.CharField(max_length=255)
    stipend_offered = models.CharField(max_length=50, blank=True, default="")
    salary_lpa = models.FloatField(null=True, blank=True)
    num_offers = models.PositiveIntegerField(null=True, blank=True)
    remark = models.TextField(blank=True, default="")
    dual_offer = models.BooleanField(default=False)
    campus_on_off = models.CharField(max_length=5, choices=CAMPUS_CHOICES, default="ON")
    date_of_joining = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "reports_placement_register_entry"
        ordering = ["sr_no"]

    def __str__(self):
        return f"#{self.sr_no} {self.student_name} → {self.employer_name}"


class CompanyRecord(models.Model):
    """Batch-wise and company-wise placement record. TCET/T&P/FRM/IP-06/11."""

    MNC_CHOICES = [
        ("MNCs", "MNCs"),
        ("Indian Company", "Indian Company"),
        ("", "—"),
    ]

    report = models.ForeignKey(
        PlacementReport,
        on_delete=models.CASCADE,
        related_name="company_records",
        null=True,
        blank=True,
    )
    company_name = models.CharField(max_length=255, db_index=True)
    first_visit_year = models.CharField(max_length=10, blank=True, default="")
    mnc_status = models.CharField(max_length=50, blank=True, default="", choices=MNC_CHOICES)
    criteria_yes_no = models.CharField(max_length=5, blank=True, default="")
    technical_yes_no = models.CharField(max_length=5, blank=True, default="")
    # batch_data stores placement counts per batch year
    # e.g. {"2019": "0", "2020": "2", "2021": "2", "2022": "0", "2023": "1", "2024": "8", "2027": "3"}
    batch_data = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True, default="")
    is_current_batch = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reports_company_record"
        ordering = ["company_name"]

    def __str__(self):
        return self.company_name


class PhaseWiseReport(models.Model):
    """Phase-wise placement data. TCET/T&P/FRM/IP-06/11, phase wise sheet."""

    PHASE_CHOICES = [
        ("I", "Phase I (A)"),
        ("II", "Phase II (B)"),
        ("III", "Phase III (C)"),
    ]

    report = models.ForeignKey(
        PlacementReport,
        on_delete=models.CASCADE,
        related_name="phase_reports",
    )
    phase = models.CharField(max_length=5, choices=PHASE_CHOICES)

    total_admitted = models.PositiveIntegerField(default=0)
    opt_out = models.PositiveIntegerField(default=0)
    opted_higher_studies = models.PositiveIntegerField(default=0)
    interested = models.PositiveIntegerField(default=0)
    eligible = models.PositiveIntegerField(default=0)
    companies_visited = models.PositiveIntegerField(default=0)
    students_placed = models.PositiveIntegerField(default=0)

    # Monthly breakdown: {"JUNE": {"companies": 2, "placed": 3}, "JULY": {"companies": 0, "placed": 0}, ...}
    monthly_data = models.JSONField(default=dict, blank=True)

    # Off-campus (Phase III)
    off_campus_placed = models.PositiveIntegerField(default=0)

    # Completion info
    due_date = models.DateField(null=True, blank=True)
    completion_date = models.DateField(null=True, blank=True)
    reason_if_late = models.TextField(blank=True, default="")

    class Meta:
        db_table = "reports_phase_wise_report"
        unique_together = [("report", "phase")]
        ordering = ["phase"]

    def __str__(self):
        return f"Phase {self.phase} — {self.report}"

    @property
    def sub_total(self):
        return self.students_placed + self.off_campus_placed

    @property
    def placement_percentage(self):
        if self.interested:
            return round(self.sub_total / self.interested * 100, 2)
        return 0.0
