from rest_framework import serializers
from .models import PlacementReport, PlacementRegisterEntry, CompanyRecord, PhaseWiseReport
import statistics


class PlacementRegisterEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = PlacementRegisterEntry
        fields = "__all__"


class PhaseWiseReportSerializer(serializers.ModelSerializer):
    sub_total = serializers.ReadOnlyField()
    placement_percentage = serializers.ReadOnlyField()

    class Meta:
        model = PhaseWiseReport
        fields = "__all__"


class CompanyRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyRecord
        fields = "__all__"


class PlacementReportSerializer(serializers.ModelSerializer):
    register_entries = PlacementRegisterEntrySerializer(many=True, read_only=True)
    phase_reports = PhaseWiseReportSerializer(many=True, read_only=True)
    company_records = CompanyRecordSerializer(many=True, read_only=True)
    statistics = serializers.SerializerMethodField()

    class Meta:
        model = PlacementReport
        fields = "__all__"

    def get_statistics(self, obj):
        entries = obj.register_entries.all()
        salaries = [e.salary_lpa for e in entries if e.salary_lpa is not None]
        stipends = [float(e.stipend_offered) for e in entries if e.stipend_offered and e.stipend_offered.isdigit()]

        placed = entries.count()
        on_campus = entries.filter(campus_on_off="ON").count()
        off_campus = entries.filter(campus_on_off="OFF").count()
        cat1_cat2 = entries.filter(employer_category__in=["CAT-1", "CAT-2"]).count()
        companies_visited = entries.values("employer_name").distinct().count()

        def safe_stats(vals):
            if not vals:
                return {"max": None, "min": None, "avg": None, "median": None, "mode": None}
            sorted_vals = sorted(vals)
            try:
                mode_val = statistics.mode(sorted_vals)
            except statistics.StatisticsError:
                mode_val = sorted_vals[0]
            return {
                "max": max(vals),
                "min": min(vals),
                "avg": round(sum(vals) / len(vals), 4),
                "median": statistics.median(sorted_vals),
                "mode": mode_val,
            }

        salary_stats = safe_stats(salaries)
        stipend_stats = safe_stats(stipends)

        # Cumulative figures
        interested = obj.interested or 1
        eligible = obj.eligible or 1
        not_eligible = obj.not_eligible or 1

        return {
            "students_placed": placed,
            "total_offers": sum(e.num_offers or 1 for e in entries),
            "on_campus": on_campus,
            "off_campus": off_campus,
            "cumulative_total": on_campus + off_campus,
            "cumulative_pct_interested": round((on_campus + off_campus) / interested * 100, 2),
            "cumulative_pct_eligible": round((on_campus + off_campus) / eligible * 100, 2),
            "cumulative_pct_not_eligible": round(off_campus / not_eligible * 100, 2) if not_eligible else 0,
            "super_dream_dream_count": cat1_cat2,
            "companies_visited": companies_visited,
            "salary": salary_stats,
            "stipend": stipend_stats,
            "placement_pct_of_interested": round(placed / interested * 100, 2),
            "placement_pct_of_eligible": round(placed / eligible * 100, 2),
            "placement_pct_of_not_eligible": round(off_campus / not_eligible * 100, 2) if not_eligible else 0,
            "avg_placement_index": round(placed / (obj.admitted_final_year or 1), 4),
        }


class PlacementReportListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    class Meta:
        model = PlacementReport
        fields = ["id", "batch", "program", "ref_no", "report_date", "is_draft", "updated_at"]
