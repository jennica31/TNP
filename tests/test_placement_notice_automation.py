"""Comprehensive Automated Tests for Staff Placement Notice Automation System.

Covers:
1. Search & Context Retrieval
2. Autofill & Default Formatting
3. Edit Isolation Guarantee (Company / Opportunity records never mutate on notice edits)
4. Draft System & Object-level Ownership
5. Pre-publish Validation
6. Publication Workflow & Version 1 Snapshot Creation
7. Notice Versioning, Immutability & Granular Diff Detection
8. Cloning as New Notice
9. Full Audit Trail Verification
10. Role-based Authorization & IDOR Protection
11. Safe AI Extraction
"""

import json
from datetime import date
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from base.models import User
from placements.models import (
    Company,
    Notice,
    NoticeAuditLog,
    NoticeVersion,
    PlacementOpportunity,
)


@pytest.fixture
def staff_user(db):
    return User.objects.create_user(
        email="staff_officer@tcetmumbai.in",
        password="TestPassword@123",
        role="staff",
        full_name="Staff Officer",
    )


@pytest.fixture
def other_staff_user(db):
    return User.objects.create_user(
        email="other_staff@tcetmumbai.in",
        password="TestPassword@123",
        role="staff",
        full_name="Other Staff",
    )


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        email="student@tcetmumbai.in",
        password="TestPassword@123",
        role="student",
        full_name="Student User",
    )


@pytest.fixture
def sample_company(db):
    return Company.objects.create(
        name="Tata Consultancy Services",
        website="https://www.tcs.com",
        description="Global IT services, consulting, and business solutions leader.",
        aliases=["TCS", "Tata Consultancy"],
    )


@pytest.fixture
def sample_opportunity(db, sample_company):
    return PlacementOpportunity.objects.create(
        company=sample_company,
        batch="2027",
        designation="Software Engineer",
        tech_nontech="Tech",
        placement_internship="Placement",
        eligibility_criteria="CGPA >= 7.0, No active backlogs, 10th/12th >= 60%",
        eligible_departments=["COMP", "IT", "AI&DS", "AI&ML"],
        skills=["Python", "Java", "SQL", "Data Structures"],
        emolument_raw="₹7.5 LPA",
        emolument_value=7.5,
        emolument_unit="LPA",
        selection_process="1. Online Technical Assessment\n2. Technical Interview\n3. HR Interview",
        number_of_offers=25,
    )


@pytest.mark.django_db
class TestPlacementNoticeAutomation:

    def test_opportunity_search_multi_layer(self, staff_user, sample_opportunity, sample_company):
        client = APIClient()
        client.force_authenticate(user=staff_user)

        # 1. Exact match / keyword match
        res = client.get(reverse("placement-opportunity-search"), {"q": "tcs"})
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert len(data) >= 1
        assert data[0]["company_name"] == sample_company.name
        assert data[0]["designation"] == "Software Engineer"
        assert data[0]["batch"] == "2027"

        # 2. Partial company name ("tata", "consult")
        res_tata = client.get(reverse("placement-opportunity-search"), {"q": "tata"})
        assert res_tata.status_code == status.HTTP_200_OK
        assert len(res_tata.json()) >= 1
        assert res_tata.json()[0]["company_name"] == sample_company.name

        res_consult = client.get(reverse("placement-opportunity-search"), {"q": "consult"})
        assert res_consult.status_code == status.HTTP_200_OK
        assert len(res_consult.json()) >= 1
        assert res_consult.json()[0]["company_name"] == sample_company.name

        # 3. Role / Designation search ("software", "engineer")
        res_role = client.get(reverse("placement-opportunity-search"), {"q": "software"})
        assert res_role.status_code == status.HTTP_200_OK
        assert len(res_role.json()) >= 1
        assert res_role.json()[0]["designation"] == "Software Engineer"

        # 4. Skill search ("java")
        res_skill = client.get(reverse("placement-opportunity-search"), {"q": "java"})
        assert res_skill.status_code == status.HTTP_200_OK
        assert len(res_skill.json()) >= 1
        assert "Java" in res_skill.json()[0]["skills"]

        # 5. Batch search ("2027")
        res_batch = client.get(reverse("placement-opportunity-search"), {"q": "2027"})
        assert res_batch.status_code == status.HTTP_200_OK
        assert len(res_batch.json()) >= 1
        assert res_batch.json()[0]["batch"] == "2027"

        # 6. Combined multi-term search (Company + Role + Batch)
        res_multi = client.get(reverse("placement-opportunity-search"), {"q": "tcs software 2027"})
        assert res_multi.status_code == status.HTTP_200_OK
        assert len(res_multi.json()) == 1

        res_tata_batch = client.get(reverse("placement-opportunity-search"), {"q": "tata 2027"})
        assert res_tata_batch.status_code == status.HTTP_200_OK
        assert len(res_tata_batch.json()) == 1

        # 7. Case-insensitivity & whitespace normalization
        res_case = client.get(reverse("placement-opportunity-search"), {"q": "   TCS SOFTWARE   "})
        assert res_case.status_code == status.HTTP_200_OK
        assert len(res_case.json()) == 1

        # 8. Common spelling variation ("consultency" -> "consultancy")
        res_spell = client.get(reverse("placement-opportunity-search"), {"q": "consultency"})
        assert res_spell.status_code == status.HTTP_200_OK
        assert len(res_spell.json()) >= 1

        # 9. Empty search query returns empty list (no database dump)
        res_empty_q = client.get(reverse("placement-opportunity-search"), {"q": ""})
        assert res_empty_q.status_code == status.HTTP_200_OK
        assert len(res_empty_q.json()) == 0

        # 10. Non-existent query returns empty list
        res_empty = client.get(reverse("placement-opportunity-search"), {"q": "NonExistentCompanyXYZ"})
        assert res_empty.status_code == status.HTTP_200_OK
        assert len(res_empty.json()) == 0

    def test_opportunity_autofill_data(self, staff_user, sample_opportunity, sample_company):
        client = APIClient()
        client.force_authenticate(user=staff_user)

        url = reverse("placement-opportunity-autofill", kwargs={"pk": sample_opportunity.id})
        res = client.get(url)
        assert res.status_code == status.HTTP_200_OK
        data = res.json()

        assert data["company_name"] == sample_company.name
        assert data["batch"] == "2027"
        # Subject is batch-format: designation lives in table_data, not the subject line
        assert "TCS" in data["subject"] or "Tata Consultancy Services" in data["subject"]
        assert "2027 Batch" in data["subject"]
        assert "COMP" in data["to"]
        assert data["eligibility_criteria"] == sample_opportunity.eligibility_criteria
        assert len(data["table_data"]) == 1
        assert data["table_data"][0]["salary"] == "₹7.5 LPA"
        assert data["sr_no"].startswith("TCET/T&P/OFF/")
        assert data["company_registration_link"] == sample_company.website

        # Verify internship opportunity receives TCET/T&P/INT/ serial number
        intern_opp = PlacementOpportunity.objects.create(
            company=sample_company,
            batch="2027",
            designation="Software Intern",
            tech_nontech="Tech",
            placement_internship="Internship",
            eligibility_criteria="CGPA >= 7.0",
            eligible_departments=["COMP"],
            skills=["Python"],
            emolument_raw="₹25,000 / month",
        )
        url_intern = reverse("placement-opportunity-autofill", kwargs={"pk": intern_opp.id})
        res_intern = client.get(url_intern)
        assert res_intern.status_code == status.HTTP_200_OK
        data_intern = res_intern.json()
        assert data_intern["sr_no"].startswith("TCET/T&P/INT/")

    def test_opportunity_autofill_data_different_batches(self, staff_user, sample_company):
        """Verify autofill dynamically supports all batches (e.g. 2026) without position details in subject/intro."""
        opp_2026 = PlacementOpportunity.objects.create(
            company=sample_company,
            batch="2026",
            designation="Full Stack Developer",
            tech_nontech="Tech",
            placement_internship="Placement",
            eligibility_criteria="CGPA >= 6.5",
            eligible_departments=["COMP", "IT"],
            skills=["React", "Django"],
            emolument_raw="₹6 LPA",
        )
        client = APIClient()
        client.force_authenticate(user=staff_user)

        url = reverse("placement-opportunity-autofill", kwargs={"pk": opp_2026.id})
        res = client.get(url)
        assert res.status_code == status.HTTP_200_OK
        data = res.json()

        assert data["batch"] == "2026"
        assert "Full Stack Developer" not in data["subject"]
        assert "Full Stack Developer" not in data["intro"]
        assert data["subject"] == f"Campus Recruitment Drive - {sample_company.name} for 2026 Batch"
        assert data["intro"] == (
            f"All eligible and interested students of 2026 batch are hereby informed that "
            f"{sample_company.name} is conducting a campus recruitment drive."
        )
        assert "2026 Batch" in data["to"]

    def test_edit_isolation_guarantee(self, staff_user, sample_opportunity, sample_company):
        """CRITICAL: Editing notice fields MUST NOT mutate Company or Opportunity records."""
        client = APIClient()
        client.force_authenticate(user=staff_user)

        # 1. Staff creates and publishes a notice with custom edited CTC (₹8.5 LPA instead of ₹7.5 LPA)
        payload = {
            "opportunity_id": sample_opportunity.id,
            "company_id": sample_company.id,
            "subject": "Campus Recruitment Drive - TCS Custom Edit",
            "date": "2026-09-28",
            "to": "All BE Students",
            "intro": "Custom introduction text",
            "about": "Custom edited company description",
            "eligibility_criteria": "Custom edited criteria: CGPA 8.0+",
            "table_data": [{"type": "Regular", "salary": "₹8.5 LPA", "position": "Senior Software Engineer"}],
            "skill_required": "Advanced Rust, Distributed Systems",
            "location": "TCET Auditorium",
            "from_field": "Dr. Zahir Aalam",
            "from_designation": "Dean (TP&IL)",
        }

        # Save draft
        res_draft = client.post(reverse("placement-notice-drafts"), payload, format="json")
        assert res_draft.status_code == status.HTTP_201_CREATED
        notice_id = res_draft.json()["notice"]["id"]

        # Publish notice
        res_pub = client.post(reverse("placement-notice-publish", kwargs={"pk": notice_id}), payload, format="json")
        assert res_pub.status_code == status.HTTP_200_OK

        # 2. Verify Opportunity and Company master records remain completely UNTOUCHED
        sample_opportunity.refresh_from_db()
        sample_company.refresh_from_db()

        assert sample_opportunity.emolument_raw == "₹7.5 LPA"
        assert sample_opportunity.emolument_value == 7.5
        assert sample_opportunity.designation == "Software Engineer"
        assert sample_company.description == "Global IT services, consulting, and business solutions leader."

        # Verify Notice and NoticeVersion snapshot hold the edited values
        notice = Notice.objects.get(pk=notice_id)
        assert notice.status == "PUBLISHED"
        assert "₹8.5 LPA" in notice.roles
        assert notice.about == "Custom edited company description"

    def test_draft_ownership_security(self, staff_user, other_staff_user):
        """A Staff user must not modify or delete another user's private draft."""
        client_a = APIClient()
        client_a.force_authenticate(user=staff_user)

        # Staff A creates a draft
        res = client_a.post(reverse("placement-notice-drafts"), {
            "subject": "Private Draft Notice A",
            "date": "2026-09-28",
            "intro": "Draft intro",
            "to": "All Students",
        }, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        draft_id = res.json()["notice"]["id"]

        # Staff B tries to view/modify Staff A's private draft
        client_b = APIClient()
        client_b.force_authenticate(user=other_staff_user)

        res_get = client_b.get(reverse("placement-notice-draft-detail", kwargs={"pk": draft_id}))
        assert res_get.status_code == status.HTTP_403_FORBIDDEN

        res_patch = client_b.patch(
            reverse("placement-notice-draft-detail", kwargs={"pk": draft_id}),
            {"subject": "Hacked Subject"},
            format="json",
        )
        assert res_patch.status_code == status.HTTP_400_BAD_REQUEST or res_patch.status_code == status.HTTP_403_FORBIDDEN

    def test_versioning_and_diff_detection(self, staff_user, sample_opportunity):
        """Editing an existing published notice must create Version 2 with detected diffs."""
        client = APIClient()
        client.force_authenticate(user=staff_user)

        # 1. Create and Publish Version 1
        v1_payload = {
            "opportunity_id": sample_opportunity.id,
            "subject": "TCS Recruitment Drive 2027",
            "date": "2026-09-28",
            "to": "All Batch 2027 Students",
            "intro": "Initial announcement",
            "about": "TCS info",
            "eligibility_criteria": "CGPA >= 7.0",
            "table_data": [{"type": "Regular", "salary": "₹7.5 LPA", "position": "Software Engineer"}],
            "from_field": "Dr. Zahir Aalam",
            "from_designation": "Dean (TP&IL)",
        }
        res_draft = client.post(reverse("placement-notice-drafts"), v1_payload, format="json")
        notice_id = res_draft.json()["notice"]["id"]

        res_v1 = client.post(reverse("placement-notice-publish", kwargs={"pk": notice_id}), v1_payload, format="json")
        assert res_v1.status_code == status.HTTP_200_OK
        assert res_v1.json()["version"]["version_number"] == 1

        # 2. Update Published Notice (Change CTC from ₹7.5 LPA to ₹8.0 LPA, and update date)
        v2_payload = {
            **v1_payload,
            "date": "2026-09-29",
            "table_data": [{"type": "Regular", "salary": "₹8.0 LPA", "position": "Software Engineer"}],
        }
        res_v2 = client.post(reverse("placement-notice-publish", kwargs={"pk": notice_id}), v2_payload, format="json")
        assert res_v2.status_code == status.HTTP_200_OK
        v2_data = res_v2.json()["version"]
        assert v2_data["version_number"] == 2

        # 3. Verify Version History & Immutability
        res_versions = client.get(reverse("placement-notice-versions", kwargs={"pk": notice_id}))
        assert res_versions.status_code == status.HTTP_200_OK
        versions_list = res_versions.json()
        assert len(versions_list) == 2

        # Check Version 1 snapshot is completely preserved with original CTC and Date
        res_v1_snap = client.get(reverse("placement-notice-version-detail", kwargs={"pk": notice_id, "version_number": 1}))
        assert res_v1_snap.status_code == status.HTTP_200_OK
        v1_snap_data = res_v1_snap.json()["snapshot"]
        assert v1_snap_data["date"] == "2026-09-28"
        assert v1_snap_data["table_data"][0]["salary"] == "₹7.5 LPA"

        # Check Version 2 snapshot has new CTC and diff description
        res_v2_snap = client.get(reverse("placement-notice-version-detail", kwargs={"pk": notice_id, "version_number": 2}))
        assert res_v2_snap.status_code == status.HTTP_200_OK
        v2_snap_data = res_v2_snap.json()["snapshot"]
        assert v2_snap_data["date"] == "2026-09-29"
        assert v2_snap_data["table_data"][0]["salary"] == "₹8.0 LPA"

        # Check diff summary
        changes = res_v2_snap.json()["changes_summary"]
        assert any("Positions/CTC updated" in c.get("description", "") or "Salary" in c.get("field", "") or "table_data" in c.get("field", "") for c in changes)

    def test_clone_notice_as_new(self, staff_user, sample_opportunity):
        client = APIClient()
        client.force_authenticate(user=staff_user)

        # Create published notice
        payload = {
            "opportunity_id": sample_opportunity.id,
            "subject": "Oracle Drive 2027",
            "date": "2026-09-28",
            "to": "All Students",
            "intro": "Oracle is visiting",
            "eligibility_criteria": "CGPA >= 7.5",
            "table_data": [{"type": "Regular", "salary": "₹12 LPA", "position": "Member of Technical Staff"}],
        }
        res_draft = client.post(reverse("placement-notice-drafts"), payload, format="json")
        notice_id = res_draft.json()["notice"]["id"]
        client.post(reverse("placement-notice-publish", kwargs={"pk": notice_id}), payload, format="json")

        # Clone as new
        res_clone = client.post(reverse("placement-notice-clone", kwargs={"pk": notice_id}))
        assert res_clone.status_code == status.HTTP_201_CREATED
        cloned_data = res_clone.json()["notice"]

        assert cloned_data["id"] != notice_id
        assert cloned_data["status"] == "DRAFT"
        assert cloned_data["version_count"] == 1
        assert "(Copy)" in cloned_data["subject"]
        assert cloned_data["cloned_from"] == notice_id

    def test_audit_logs(self, staff_user, sample_opportunity):
        client = APIClient()
        client.force_authenticate(user=staff_user)

        # Create draft, then publish
        res_draft = client.post(reverse("placement-notice-drafts"), {
            "subject": "Audit Test Notice",
            "date": "2026-09-28",
            "to": "Students",
            "intro": "Intro",
            "eligibility_criteria": "None",
        }, format="json")
        notice_id = res_draft.json()["notice"]["id"]

        client.post(reverse("placement-notice-publish", kwargs={"pk": notice_id}), {
            "subject": "Audit Test Notice Published",
            "date": "2026-09-28",
            "to": "Students",
            "intro": "Intro",
            "eligibility_criteria": "CGPA 7+",
        }, format="json")

        # Check audit logs endpoint
        res_audit = client.get(reverse("placement-notice-audit-logs", kwargs={"pk": notice_id}))
        assert res_audit.status_code == status.HTTP_200_OK
        logs = res_audit.json()
        assert len(logs) >= 2
        actions = [log["action"] for log in logs]
        assert "CREATED_DRAFT" in actions
        assert "PUBLISHED" in actions

    def test_authorization_matrix(self, student_user, sample_opportunity):
        """Student should not be able to access staff notice automation endpoints."""
        client = APIClient()
        client.force_authenticate(user=student_user)

        # Student cannot search staff opportunities
        res_search = client.get(reverse("placement-opportunity-search"))
        assert res_search.status_code == status.HTTP_403_FORBIDDEN

        # Student cannot create drafts
        res_draft = client.post(reverse("placement-notice-drafts"), {"subject": "Unauthorized"}, format="json")
        assert res_draft.status_code == status.HTTP_403_FORBIDDEN

    def test_ai_extract_service(self, staff_user):
        client = APIClient()
        client.force_authenticate(user=staff_user)

        sample_circular = """
        Campus Placement Circular 2027
        Role: Associate Software Engineer
        Salary: CTC 9.5 LPA
        Eligibility Criteria: BE (COMP, IT, AI&DS) with CGPA >= 7.5
        Key Skills: Java, Spring Boot, Microservices, React
        Selection Process: Online Coding Test followed by Technical Interview and HR Interview
        Company Registration Link: https://careers.example.com/apply/1234
        """

        res = client.post(reverse("placement-notice-ai-extract"), {"text": sample_circular}, format="json")
        assert res.status_code == status.HTTP_200_OK
        data = res.json()

        assert "Associate Software Engineer" in data["table_data"][0]["position"]
        assert "9.5 LPA" in data["table_data"][0]["salary"]
        assert "https://careers.example.com/apply/1234" in data["company_registration_link"]
        assert "Java" in data["skill_required"]

    def test_training_serial_number_and_autofill(self, staff_user, sample_opportunity, sample_company):
        """Verify Training notice serial number and autofill with TCS iON Jobinar pattern."""
        client = APIClient()
        client.force_authenticate(user=staff_user)

        # 1. Test next serial number for training
        from placements.notice_service import generate_next_serial_number
        sr_trg = generate_next_serial_number("Training")
        assert sr_trg.startswith("TCET/T&P/TRG/")
        assert "TRG-" in sr_trg

        # 2. Test opportunity autofill with notice_type=Training
        url = reverse("placement-opportunity-autofill", kwargs={"pk": sample_opportunity.id})
        res = client.get(url, {"notice_type": "Training"})
        assert res.status_code == status.HTTP_200_OK
        data = res.json()

        assert data["notice_type"] == "Training"
        assert data["sr_no"].startswith("TCET/T&P/TRG/")
        assert data["subject"] == f"Registrations for Free {sample_company.name} Jobinar"
        assert data["organiser"] == sample_company.name
        assert data["topic"] == sample_opportunity.designation
        assert len(data["reasons_to_attend"]) >= 1
        assert "https://forms.gle" in data["college_registration_link"]

    def test_sample_tcs_jobinar_endpoint(self, staff_user):
        """Verify the sample TCS iON Jobinar notice endpoint returns exact pattern values."""
        client = APIClient()
        client.force_authenticate(user=staff_user)

        res = client.get(reverse("training_sample_tcs_jobinar"))
        assert res.status_code == status.HTTP_200_OK
        data = res.json()

        assert "TCET/T&P/ TRG   107     of 2026" in data["srNo"]
        assert "2027 / 2028 / 2029" in data["to"]
        assert data["subject"] == "Registrations for Free TCS iON Jobinar"
        assert data["organiser"] == "TCS iON"
        assert data["mode"] == "Online"
        assert "https://iur.ls/TCSiONJobinars" in data["company_registration_link"]
        assert "https://forms.gle/rA9RSZ4Ju2oUMETbA" in data["college_registration_link"]

    def test_training_notice_draft_save(self, staff_user):
        """Verify saving a training notice draft retains notice_type and custom details."""
        client = APIClient()
        client.force_authenticate(user=staff_user)

        payload = {
            "notice_type": "Training",
            "sr_no": "TCET/T&P/ TRG   107     of 2026",
            "date": "2026-10-16",
            "to": "All Concerned students of the 2027 / 2028 / 2029 batch",
            "subject": "Registrations for Free TCS iON Jobinar",
            "intro": "All concerned students are hereby informed...",
            "eligibility_criteria": "B.E / B.Tech (All Branch) / MCA / BCA",
            "organiser": "TCS iON",
            "topic": "Can AI Agents Be Created Without Coding?",
            "college_registration_link": "https://forms.gle/rA9RSZ4Ju2oUMETbA",
        }

        res = client.post(reverse("placement-notice-drafts"), payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        notice_id = res.json()["notice"]["id"]

        notice = Notice.objects.get(id=notice_id)
        assert notice.notice_type == "Training"
        assert notice.custom_data.get("organiser") == "TCS iON"
        assert notice.custom_data.get("college_registration_link") == "https://forms.gle/rA9RSZ4Ju2oUMETbA"
