from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import PlacementReport, PlacementRegisterEntry, CompanyRecord, PhaseWiseReport
from .serializers import (
    PlacementReportSerializer,
    PlacementReportListSerializer,
    PlacementRegisterEntrySerializer,
    CompanyRecordSerializer,
    PhaseWiseReportSerializer,
)


# ─── Placement Reports ─────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def report_list(request):
    if request.method == "GET":
        reports = PlacementReport.objects.all().order_by("-updated_at")
        return Response(PlacementReportListSerializer(reports, many=True).data)

    data = request.data.copy()
    serializer = PlacementReportSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def report_detail(request, pk):
    report = get_object_or_404(PlacementReport, pk=pk)

    if request.method == "GET":
        return Response(PlacementReportSerializer(report).data)

    if request.method in ("PUT", "PATCH"):
        partial = request.method == "PATCH"
        serializer = PlacementReportSerializer(report, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == "DELETE":
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Placement Register Entries ────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def register_entry_list(request, report_pk):
    report = get_object_or_404(PlacementReport, pk=report_pk)

    if request.method == "GET":
        entries = report.register_entries.all()
        return Response(PlacementRegisterEntrySerializer(entries, many=True).data)

    data = request.data.copy()
    data["report"] = report.pk
    serializer = PlacementRegisterEntrySerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def register_entry_detail(request, report_pk, pk):
    report = get_object_or_404(PlacementReport, pk=report_pk)
    entry = get_object_or_404(PlacementRegisterEntry, pk=pk, report=report)

    if request.method == "GET":
        return Response(PlacementRegisterEntrySerializer(entry).data)

    if request.method in ("PUT", "PATCH"):
        partial = request.method == "PATCH"
        data = request.data.copy()
        data["report"] = report.pk
        serializer = PlacementRegisterEntrySerializer(entry, data=data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == "DELETE":
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Company Records ───────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def company_record_list(request):
    if request.method == "GET":
        batch = request.query_params.get("batch", "")
        search = request.query_params.get("search", "")
        current = request.query_params.get("current_batch_only", "")

        records = CompanyRecord.objects.all()
        if search:
            records = records.filter(company_name__icontains=search)
        if current == "true":
            records = records.filter(is_current_batch=True)
        return Response(CompanyRecordSerializer(records, many=True).data)

    serializer = CompanyRecordSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def company_record_detail(request, pk):
    record = get_object_or_404(CompanyRecord, pk=pk)

    if request.method == "GET":
        return Response(CompanyRecordSerializer(record).data)

    if request.method in ("PUT", "PATCH"):
        partial = request.method == "PATCH"
        serializer = CompanyRecordSerializer(record, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == "DELETE":
        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Phase-wise Reports ────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def phase_report_list(request, report_pk):
    report = get_object_or_404(PlacementReport, pk=report_pk)

    if request.method == "GET":
        phases = report.phase_reports.all()
        return Response(PhaseWiseReportSerializer(phases, many=True).data)

    data = request.data.copy()
    data["report"] = report.pk
    serializer = PhaseWiseReportSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def phase_report_detail(request, report_pk, pk):
    report = get_object_or_404(PlacementReport, pk=report_pk)
    phase = get_object_or_404(PhaseWiseReport, pk=pk, report=report)

    if request.method == "GET":
        return Response(PhaseWiseReportSerializer(phase).data)

    partial = request.method == "PATCH"
    data = request.data.copy()
    data["report"] = report.pk
    serializer = PhaseWiseReportSerializer(phase, data=data, partial=partial)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─── Bulk save for register entries ───────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_entries_bulk(request, report_pk):
    """Replace all register entries for a report with the given list."""
    report = get_object_or_404(PlacementReport, pk=report_pk)
    entries_data = request.data.get("entries", [])

    with transaction.atomic():
        report.register_entries.all().delete()
        created = []
        for i, entry_data in enumerate(entries_data, start=1):
            entry_data["report"] = report.pk
            if "sr_no" not in entry_data:
                entry_data["sr_no"] = i
            serializer = PlacementRegisterEntrySerializer(data=entry_data)
            if serializer.is_valid():
                created.append(serializer.save())
            else:
                raise Exception(f"Row {i}: {serializer.errors}")

    return Response(
        PlacementRegisterEntrySerializer(created, many=True).data,
        status=status.HTTP_201_CREATED,
    )


# ─── Draft save/load helpers ───────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_by_batch(request):
    """Get report by batch+program, or return 404."""
    batch = request.query_params.get("batch", "")
    program = request.query_params.get("program", "MCA")
    try:
        report = PlacementReport.objects.get(batch=batch, program=program)
        return Response(PlacementReportSerializer(report).data)
    except PlacementReport.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
