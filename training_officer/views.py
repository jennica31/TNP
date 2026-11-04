from django.http import JsonResponse
from rest_framework.decorators import (
    api_view,
    permission_classes,
    authentication_classes,
)
from rest_framework.permissions import IsAuthenticated
from base.permissions import ROLES, HasRole
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from student.models import Student
from program_coordinator_api.models import AttendanceData, TrainingPerformance
from django.db.models import Avg, Count, Q

@api_view(["GET"])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([HasRole.of(*ROLES.TRAINING_OVERSIGHT)])
def get_avg_data(request, table_name):
    try:
        # 1. Fetch Students to map uid -> (Branch_Div, Year)
        batch_param = request.query_params.get("batch") or request.query_params.get("year")
        students_qs = Student.objects.all()
        if batch_param:
            students_qs = students_qs.filter(batch=batch_param)
        students = students_qs.values('uid', 'department', 'division', 'batch')
        # AttendanceData.uid is free text with no FK to Student (models.py),
        # so it's joined here in Python by string equality. Normalize both
        # sides - a stray space or case difference from an uploaded sheet
        # would otherwise drop the row silently instead of erroring.
        student_map = {
            s['uid'].strip().upper(): {
                'Branch_Div': f"{s['department']}-{s['division']}",
                'Year': s['batch']
            } for s in students if s['uid']
        }

        stats_map = {}

        # 2. Process Attendance Data
        att_aggs = AttendanceData.objects.values('uid', 'program_name').annotate(
            total=Count('id'),
            present=Count('id', filter=Q(present='Present'))
        )
        for att in att_aggs:
            uid = (att['uid'] or '').strip().upper()
            if uid not in student_map:
                continue
            
            branch_div = student_map[uid]['Branch_Div']
            year = student_map[uid]['Year']
            program = att['program_name']
            key = (branch_div, year, program)

            if key not in stats_map:
                stats_map[key] = {'att_total': 0, 'att_present': 0, 'perf_sum': 0, 'perf_count': 0}
            
            stats_map[key]['att_total'] += att['total']
            stats_map[key]['att_present'] += att['present']

        # 3. Process Performance Data
        perf_aggs = TrainingPerformance.objects.values('student__uid', 'training_type').annotate(
            avg_marks=Avg('categories__marks')
        ).filter(avg_marks__isnull=False)

        for perf in perf_aggs:
            uid = (perf['student__uid'] or '').strip().upper()
            if uid not in student_map:
                continue

            branch_div = student_map[uid]['Branch_Div']
            year = student_map[uid]['Year']
            program = perf['training_type']
            key = (branch_div, year, program)

            if key not in stats_map:
                stats_map[key] = {'att_total': 0, 'att_present': 0, 'perf_sum': 0, 'perf_count': 0}

            stats_map[key]['perf_sum'] += perf['avg_marks']
            stats_map[key]['perf_count'] += 1

        # 4. Format Result
        result = []
        for (branch_div, year, program), stats in stats_map.items():
            try:
                year_num = int(year)
            except (ValueError, TypeError):
                year_num = year

            avg_attendance = 0
            if stats['att_total'] > 0:
                avg_attendance = round((stats['att_present'] / stats['att_total']) * 100, 2)

            avg_performance = 0
            if stats['perf_count'] > 0:
                avg_performance = round(stats['perf_sum'] / stats['perf_count'], 2)

            if stats['att_total'] > 0 or stats['perf_count'] > 0:
                result.append({
                    "Branch_Div": branch_div,
                    "Year": year_num,
                    "Program_name": program,
                    "avg_attendance": avg_attendance,
                    "avg_performance": avg_performance
                })

        return JsonResponse(result, safe=False)

    except Exception as e:
        return JsonResponse(
            {"error": f"Failed to fetch average data: {str(e)}"}, status=500
        )


@api_view(["GET"])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IsAuthenticated])
def get_training_next_serial_number(request):
    """Fetch next institutional serial number for Training notice."""
    try:
        from placements.notice_service import generate_next_serial_number
        sr_no = generate_next_serial_number("Training")
        return JsonResponse({"sr_no": sr_no}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@api_view(["GET"])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IsAuthenticated])
def get_sample_tcs_jobinar_notice(request):
    """Retrieve standardized sample payload based on TCS iON Jobinar document."""
    data = {
        "srNo": "TCET/T&P/ TRG   107     of 2026",
        "date": "2026-10-16",
        "to": "All Concerned students of the 2027 / 2028 / 2029 batch",
        "subject": "Registrations for Free TCS iON Jobinar",
        "intro": "",
        "eligibility_criteria": "B.E / B.Tech (All Branch) / MCA / BCA",
        "details_heading": "The details of the Jobinar are as follows:",
        "organiser": "TCS iON",
        "topic": "Can AI Agents Be Created Without Coding?",
        "session_date": "22nd October 2026 (Thursday)",
        "session_time": "5:00 PM to 6:00 PM IST",
        "mode": "Online",
        "reasons_to_attend": [
            "Discover: Understand how apps, automation, and AI agents bring ideas to life.",
            "Learn: Explore how to build solutions using Power Platform and Copilot Studio.",
            "Explore: Learn about available learning paths, certifications, and emerging career opportunities."
        ],
        "registration_callout": "All eligible and interested students are required to register online",
        "company_registration_link": "https://iur.ls/TCSiONJobinars",
        "college_registration_link": "https://forms.gle/rA9RSZ4Ju2oUMETbA",
        "registration_note": "(It is mandatory to register on both the links - company link and the college link.)",
        "from_field": "Dr. Zahir Aalam",
        "from_designation": "Dean (TP&IL)",
        "notice_type": "Training",
    }
    return JsonResponse(data, status=200)
