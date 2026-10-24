"""API Views for Duty Chart generation, autofill, and persistence."""

import logging
import re
from datetime import date
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from base.error_utils import safe_error_payload
from base.models import User, FacultyResponsibility
from base.permissions import HasRole, ROLES
from placements.models import Company, Notice, PlacementOpportunity

logger = logging.getLogger(__name__)

DRIVE_PERMS = [IsAuthenticated, HasRole.of(*ROLES.PLACEMENT_DRIVE)]


def generate_next_dc_serial(year: int = None) -> str:
    """Generate serial number in exact institutional format: TCET/T&P/DC  <seq>   of <year>"""
    curr_year = year or date.today().year
    existing = Notice.objects.filter(
        notice_type="Duty Chart",
        sr_no__icontains="TCET/T&P/DC"
    ).values_list("sr_no", flat=True)

    max_seq = 46  # base sequence starting from 47
    pattern = re.compile(r"TCET/T&P/DC\s+(\d+)\s+of\s+(\d+)", re.IGNORECASE)
    for sr in existing:
        m = pattern.search(sr)
        if m:
            try:
                seq = int(m.group(1))
                if seq > max_seq:
                    max_seq = seq
            except ValueError:
                pass
    next_seq = max_seq + 1
    return f"TCET/T&P/DC  {next_seq}   of {curr_year}"


class DutyChartInitialDataAPIView(APIView):
    """Provides initial data for Duty Chart.
    
    All variable content fields are blank by default.
    Only genuine institutional sequence and current date are provided.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        # Active placement opportunities for optional autofill
        companies = []
        for opp in PlacementOpportunity.objects.select_related("company").all()[:20]:
            c_name = opp.company.name if opp.company else opp.designation
            companies.append({
                "id": opp.id,
                "company_id": opp.company_id,
                "name": c_name,
                "job_title": opp.designation,
                "batch": getattr(opp, "batch", ""),
            })

        # Available faculty and staff from User table for selection in Duty Chart
        faculty_users = []
        user_qs = (
            User.objects.exclude(role="student")
            .prefetch_related("facultyresponsibility_set")
            .order_by("full_name")
        )
        for u in user_qs:
            resp = u.facultyresponsibility_set.first()
            dept = (resp.department or "") if resp else ""
            desig = (resp.designation or "") if resp and resp.designation else u.role.replace("_", " ").title()
            faculty_users.append({
                "id": str(u.id),
                "name": u.full_name,
                "email": u.email,
                "department": dept,
                "designation": desig,
                "role": u.role,
            })

        # Genuine institutional sequence and current date
        next_serial = generate_next_dc_serial()
        today_str = str(date.today())

        # Clean blank template: NO sample faculty names, NO sample dates, NO sample reporting times, NO checkmarks, NO fake responsibilities
        blank_template = {
            "srNo": next_serial,
            "date": today_str,
            "to": "",
            "subject": "",
            "intro": "",
            "eventDates": [],
            "tableData": [
                {
                    "srNo": 1,
                    "name": "",
                    "designation": "",
                    "department": "",
                    "reportingTime": "",
                    "dutyDates": {},
                    "sign": "",
                    "roles": "",
                    "roleGroupId": "",
                }
            ],
            "notes": [],
            "signatoryName": "",
            "signatoryDesignation": "",
            "copyTo": [],
        }

        return Response({
            "success": True,
            "nextSerial": next_serial,
            "currentDate": today_str,
            "companies": companies,
            "facultyList": faculty_users,
            "defaultTemplate": blank_template,
            "tableData": blank_template["tableData"],
        }, status=status.HTTP_200_OK)


class DutyChartDraftListCreateAPIView(APIView):
    """Save or list Duty Chart drafts."""
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        drafts = Notice.objects.filter(notice_type="Duty Chart").order_by("-updated_at")
        results = []
        for d in drafts:
            results.append({
                "id": d.id,
                "srNo": d.sr_no,
                "subject": d.subject,
                "date": str(d.date),
                "status": d.status,
                "updated_at": d.updated_at.isoformat() if d.updated_at else None,
                "formData": d.custom_data.get("formData", {}),
                "tableData": d.custom_data.get("tableData", []),
                "eventDates": d.custom_data.get("eventDates", []),
            })
        return Response(results, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        payload = request.data
        form_data = payload.get("formData", {})
        table_data = payload.get("tableData", [])
        event_dates = payload.get("eventDates", [])
        notice_id = payload.get("id")

        sr_no = form_data.get("srNo", "").strip() or generate_next_dc_serial()
        subject = form_data.get("subject", "").strip() or "Duty Chart"
        notice_date_str = form_data.get("date", str(date.today()))
        try:
            parsed_date = date.fromisoformat(notice_date_str)
        except Exception:
            parsed_date = date.today()

        with transaction.atomic():
            if notice_id:
                try:
                    notice = Notice.objects.get(id=notice_id, notice_type="Duty Chart")
                except Notice.DoesNotExist:
                    notice = Notice(notice_type="Duty Chart")
            else:
                notice = Notice(notice_type="Duty Chart")

            notice.sr_no = sr_no
            notice.subject = subject
            notice.date = parsed_date
            notice.intro = form_data.get("intro", "")
            notice.to = form_data.get("to", "")
            notice.note = "\n".join(form_data.get("notes", [])) if isinstance(form_data.get("notes"), list) else str(form_data.get("notes", ""))
            notice.from_field = form_data.get("signatoryName", "")
            notice.from_designation = form_data.get("signatoryDesignation", "")
            notice.status = payload.get("status", "DRAFT")
            notice.location = form_data.get("location", "T&P Cell")

            if request.user and request.user.is_authenticated:
                if not notice.created_by:
                    notice.created_by = request.user
                notice.updated_by = request.user

            notice.custom_data = {
                "formData": form_data,
                "tableData": table_data,
                "eventDates": event_dates,
            }
            notice.save()

        return Response({
            "success": True,
            "id": notice.id,
            "srNo": notice.sr_no,
            "status": notice.status,
            "message": "Duty Chart saved successfully.",
        }, status=status.HTTP_200_OK)


class DutyChartDetailAPIView(APIView):
    """Retrieve or delete a specific Duty Chart record."""
    permission_classes = [AllowAny]

    def get(self, request, pk, *args, **kwargs):
        notice = get_object_or_404(Notice, pk=pk, notice_type="Duty Chart")
        return Response({
            "id": notice.id,
            "srNo": notice.sr_no,
            "subject": notice.subject,
            "date": str(notice.date),
            "status": notice.status,
            "formData": notice.custom_data.get("formData", {}),
            "tableData": notice.custom_data.get("tableData", []),
            "eventDates": notice.custom_data.get("eventDates", []),
        }, status=status.HTTP_200_OK)
