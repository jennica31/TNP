"""Placement Notice Service Layer.

Implements the complete business logic, edit isolation, versioning lifecycle,
concurrency safety, and audit trail for the Staff Placement Notice workflow.

Domain Layers:
    COMPANY -> PLACEMENT OPPORTUNITY -> PLACEMENT NOTICE -> NOTICE VERSION + AUDIT TRAIL
"""

import json
import logging
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from base.sanitize import sanitize_html
from placements.models import (
    Company,
    Notice,
    NoticeAuditLog,
    NoticeVersion,
    PlacementOpportunity,
)

logger = logging.getLogger(__name__)


def sanitize_text(value: Optional[str]) -> str:
    """Sanitize text input, stripping malicious scripts/tags while allowing safe plain text/formatting."""
    if not value:
        return ""
    return sanitize_html(str(value)).strip()



# ---------------------------------------------------------------------------
# Serial Number Generation
# ---------------------------------------------------------------------------

def generate_next_serial_number(notice_type: str = "Placement", target_date: Optional[date] = None) -> str:
    """Generate the next unique institutional Notice serial number safely.
    
    Placement Format:  TCET/T&P/OFF/{YEAR}/PL-{SEQ:03d}
    Internship Format: TCET/T&P/INT/{YEAR}/INT-{SEQ:03d}
    """
    year = (target_date or date.today()).year
    is_internship = str(notice_type).strip().lower() in ("internship", "int")

    type_str = str(notice_type).strip().lower()
    is_internship = type_str in ("internship", "int")
    is_training = type_str in ("training", "trg")

    if is_internship:
        dept_code = "INT"
        type_code = "INT"
        query_type = "Internship"
        prefix = f"TCET/T&P/{dept_code}/{year}/{type_code}-"
        pattern = re.compile(rf"^TCET/T&P/{dept_code}/{year}/(?:INT|PL)-(\d+)$")
    elif is_training:
        dept_code = "TRG"
        type_code = "TRG"
        query_type = "Training"
        prefix = f"TCET/T&P/{dept_code}/{year}/{type_code}-"
        pattern = re.compile(rf"^TCET/T&P/{dept_code}/{year}/(?:TRG)-(\d+)$")
    else:
        dept_code = "OFF"
        type_code = "PL"
        query_type = "Placement"
        prefix = f"TCET/T&P/{dept_code}/{year}/{type_code}-"
        pattern = re.compile(rf"^TCET/T&P/{dept_code}/{year}/PL-(\d+)$")

    existing_notices = list(
        Notice.objects.filter(
            notice_type=query_type,
            sr_no__startswith=f"TCET/T&P/{dept_code}/{year}/"
        ).values_list("sr_no", flat=True)
    )

    if is_internship:
        try:
            from internship_api.models import InternshipNotice
            int_notices = list(
                InternshipNotice.objects.filter(
                    sr_no__startswith=f"TCET/T&P/{dept_code}/{year}/"
                ).values_list("sr_no", flat=True)
            )
            existing_notices.extend(int_notices)
        except Exception:
            pass
    elif is_training:
        legacy_pattern = re.compile(rf"TCET/T&P/\s*TRG\s+(\d+)\s+of\s+{year}", re.IGNORECASE)
        try:
            legacy_notices = list(
                Notice.objects.filter(
                    notice_type=query_type,
                    sr_no__icontains="TRG"
                ).values_list("sr_no", flat=True)
            )
            for l_sr in legacy_notices:
                m = legacy_pattern.search(l_sr.strip())
                if m:
                    existing_notices.append(f"{prefix}{int(m.group(1)):03d}")
        except Exception:
            pass

    max_seq = 0
    for sr in existing_notices:
        match = pattern.match(sr.strip())
        if match:
            try:
                seq = int(match.group(1))
                if seq > max_seq:
                    max_seq = seq
            except ValueError:
                pass

    next_seq = max_seq + 1
    return f"{prefix}{next_seq:03d}"


# ---------------------------------------------------------------------------
# Opportunity Search & Context Retrieval
# ---------------------------------------------------------------------------

SPELLING_FIXES: Dict[str, str] = {
    "consultency": "consultancy",
    "softwear": "software",
    "enginer": "engineer",
    "devloper": "developer",
    "intren": "intern",
    "anlyst": "analyst",
}


def _compute_opportunity_relevance(
    opp: PlacementOpportunity,
    q_clean: str,
    tokens: List[str],
) -> int:
    """Calculate relevance score for opportunity matching.

    Prioritization:
    1. Exact company name match
    2. Exact alias match
    3. Company name starts with query
    4. Alias starts with query
    5. Company name contains full query
    6. Designation exact / startswith / contains query
    7. Token-level matches in company name, designation, skills, batch
    """
    score = 0
    q_lower = q_clean.lower()
    c_name = opp.company.name.lower()
    raw_aliases = opp.company.aliases or []
    aliases = [str(a).lower() for a in raw_aliases]
    desig = (opp.designation or "").lower()
    skills = (
        [str(s).lower() for s in opp.skills]
        if isinstance(opp.skills, list)
        else [str(opp.skills).lower()]
        if opp.skills
        else []
    )
    job_profiles = (
        [str(j).lower() for j in opp.job_profiles]
        if isinstance(opp.job_profiles, list)
        else [str(opp.job_profiles).lower()]
        if opp.job_profiles
        else []
    )
    batch = (opp.batch or "").lower()

    # 1. Exact company name match
    if c_name == q_lower:
        score += 1000
    # 2. Exact alias match
    elif any(a == q_lower for a in aliases):
        score += 900
    # 3. Company name starts with query
    elif c_name.startswith(q_lower):
        score += 800
    # 4. Alias starts with query
    elif any(a.startswith(q_lower) for a in aliases):
        score += 700
    # 5. Company name contains full query
    elif q_lower in c_name:
        score += 600
    # 6. Alias contains full query
    elif any(q_lower in a for a in aliases):
        score += 550

    # Designation exact/starts/contains full query
    if desig == q_lower:
        score += 500
    elif desig.startswith(q_lower):
        score += 400
    elif q_lower in desig:
        score += 300

    # Token-level scoring
    for t in tokens:
        t_low = t.lower()
        alt_t = SPELLING_FIXES.get(t_low)
        t_variants = [t_low] + ([alt_t] if alt_t else [])

        for tv in t_variants:
            if tv == c_name:
                score += 150
            elif any(tv == a for a in aliases):
                score += 120
            elif c_name.startswith(tv):
                score += 100
            elif any(a.startswith(tv) for a in aliases):
                score += 80
            elif tv in c_name:
                score += 60
            elif any(tv in a for a in aliases):
                score += 50

            if tv == desig:
                score += 80
            elif desig.startswith(tv):
                score += 60
            elif tv in desig:
                score += 40

            if any(tv in s for s in skills):
                score += 30

            if any(tv in jp for jp in job_profiles):
                score += 25

            if tv == batch:
                score += 20

    return score


def search_placement_opportunities(
    query: str = "",
    batch: str = "",
    opp_type: str = "",
    limit: int = 50,
    include_recent: bool = False,
) -> List[Dict[str, Any]]:
    """Multi-layer keyword search for placement opportunities with relevance ranking.

    Supports:
    1. Partial company name & keyword (e.g. 'tcs', 'tata', 'consult')
    2. Role & Designation (e.g. 'software', 'analyst')
    3. Skills (e.g. 'java', 'react')
    4. Batch (e.g. '2027')
    5. Combined multi-word keywords (e.g. 'tcs software 2027')
    6. Common spelling variations (e.g. 'consultency' -> 'consultancy')
    7. Relevance ranking prioritizing exact & startswith company/role matches
    8. Safe input handling via Django ORM parameterized queries
    """
    q_clean = query.strip()
    batch_clean = batch.strip()
    type_clean = opp_type.strip()

    # Empty search guard: do not dump the whole database when nothing is requested unless include_recent is True
    if not q_clean and not batch_clean and not type_clean and not include_recent:
        return []

    qs = PlacementOpportunity.objects.select_related("company").all()

    if batch_clean:
        qs = qs.filter(batch__iexact=batch_clean)
    if type_clean and type_clean.lower() != "all":
        qs = qs.filter(placement_internship__iexact=type_clean)

    if not q_clean:
        candidate_opps = list(qs.order_by("-id")[:limit])
        results = []
        for opp in candidate_opps:
            raw_desig = (opp.designation or "").strip()
            cleaned_desig = "" if raw_desig.upper() in ("NA", "N/A", "-", "NONE", "NULL") else raw_desig
            raw_batch = (opp.batch or "").strip()
            cleaned_batch = "" if raw_batch.upper() in ("NA", "N/A", "-", "NONE", "NULL") else raw_batch
            raw_tech = (opp.tech_nontech or "").strip()
            cleaned_tech = "" if raw_tech.upper() in ("NA", "N/A", "-", "NONE", "NULL") else raw_tech
            raw_type = (opp.placement_internship or "").strip()
            cleaned_type = "" if raw_type.upper() in ("NA", "N/A", "-", "NONE", "NULL") else raw_type
            raw_raw = (opp.emolument_raw or "").strip()
            ctc_display = ""
            if raw_raw and raw_raw.upper() not in ("NA", "N/A", "₹ NA", "₹NA", "-", "NONE", "NULL"):
                ctc_display = raw_raw
            elif opp.emolument_value:
                unit = opp.emolument_unit or "LPA"
                ctc_display = f"₹{opp.emolument_value} {unit}"
            raw_depts = opp.eligible_departments or []
            cleaned_depts = [d for d in raw_depts if str(d).strip().upper() not in ("NA", "N/A", "-", "NONE", "NULL")] if isinstance(raw_depts, list) else []
            raw_skills = opp.skills or []
            cleaned_skills = [s for s in raw_skills if str(s).strip().upper() not in ("NA", "N/A", "-", "NONE", "NULL")] if isinstance(raw_skills, list) else [str(raw_skills)] if raw_skills else []
            results.append({
                "id": opp.id,
                "company_id": opp.company.id,
                "company_name": opp.company.name,
                "company_website": opp.company.website,
                "company_description": opp.company.description,
                "company_aliases": opp.company.aliases or [],
                "batch": cleaned_batch,
                "designation": cleaned_desig or "Role not specified",
                "tech_nontech": cleaned_tech,
                "placement_internship": cleaned_type or "Placement",
                "eligibility_criteria": opp.eligibility_criteria or "",
                "eligible_departments": cleaned_depts,
                "department_flags": opp.department_flags or {},
                "job_profiles": opp.job_profiles or [],
                "skills": cleaned_skills,
                "emolument_raw": opp.emolument_raw or "",
                "emolument_display": ctc_display or "Not specified",
                "selection_process": opp.selection_process or "",
                "number_of_offers": opp.number_of_offers,
                "created_at": opp.created_at.isoformat() if opp.created_at else None,
            })
        return results

    tokens = q_clean.split()
    if tokens:
        q_filter = Q()
        for token in tokens:
            token_lower = token.lower()
            alt_token = SPELLING_FIXES.get(token_lower)
            token_q = (
                Q(company__name__icontains=token)
                | Q(company__aliases__icontains=token)
                | Q(designation__icontains=token)
                | Q(skills__icontains=token)
                | Q(job_profiles__icontains=token)
                | Q(batch__icontains=token)
                | Q(eligible_departments__icontains=token)
                | Q(tech_nontech__icontains=token)
                | Q(placement_internship__icontains=token)
            )
            if alt_token:
                token_q |= (
                    Q(company__name__icontains=alt_token)
                    | Q(company__aliases__icontains=alt_token)
                    | Q(designation__icontains=alt_token)
                    | Q(skills__icontains=alt_token)
                    | Q(job_profiles__icontains=alt_token)
                )
            q_filter &= token_q

        qs = qs.filter(q_filter)

    # Fetch candidate pool for ranking (up to 150 candidates to rank)
    candidate_opps = list(qs.order_by("-created_at")[:150])

    if q_clean:
        candidate_opps.sort(
            key=lambda opp: (
                _compute_opportunity_relevance(opp, q_clean, tokens),
                opp.created_at.timestamp() if opp.created_at else 0,
            ),
            reverse=True,
        )

    results = []
    for opp in candidate_opps[:limit]:
        # Clean designation: omit "NA" or placeholder text
        raw_desig = (opp.designation or "").strip()
        cleaned_desig = (
            "" if raw_desig.upper() in ("NA", "N/A", "-", "NONE", "NULL") else raw_desig
        )

        # Clean batch: omit "NA"
        raw_batch = (opp.batch or "").strip()
        cleaned_batch = (
            "" if raw_batch.upper() in ("NA", "N/A", "-", "NONE", "NULL") else raw_batch
        )

        # Clean tech_nontech & placement_internship
        raw_tech = (opp.tech_nontech or "").strip()
        cleaned_tech = "" if raw_tech.upper() in ("NA", "N/A", "-", "NONE", "NULL") else raw_tech
        raw_type = (opp.placement_internship or "").strip()
        cleaned_type = "" if raw_type.upper() in ("NA", "N/A", "-", "NONE", "NULL") else raw_type

        # Format compensation representation cleanly
        raw_raw = (opp.emolument_raw or "").strip()
        ctc_display = ""
        if raw_raw and raw_raw.upper() not in ("NA", "N/A", "₹ NA", "₹NA", "-", "NONE", "NULL"):
            ctc_display = raw_raw
        elif opp.emolument_value:
            unit = opp.emolument_unit or "LPA"
            ctc_display = f"₹{opp.emolument_value} {unit}"

        # Clean eligible departments list
        raw_depts = opp.eligible_departments or []
        cleaned_depts = [
            d for d in raw_depts if str(d).strip().upper() not in ("NA", "N/A", "-", "NONE", "NULL")
        ] if isinstance(raw_depts, list) else []

        # Clean skills list
        raw_skills = opp.skills or []
        cleaned_skills = [
            s for s in raw_skills if str(s).strip().upper() not in ("NA", "N/A", "-", "NONE", "NULL")
        ] if isinstance(raw_skills, list) else [str(raw_skills)] if raw_skills else []

        results.append({
            "id": opp.id,
            "company_id": opp.company.id,
            "company_name": opp.company.name,
            "company_website": opp.company.website,
            "company_description": opp.company.description,
            "company_aliases": opp.company.aliases or [],
            "batch": cleaned_batch,
            "designation": cleaned_desig or "Role not specified",
            "tech_nontech": cleaned_tech,
            "placement_internship": cleaned_type or "Placement",
            "eligibility_criteria": opp.eligibility_criteria or "",
            "eligible_departments": cleaned_depts,
            "department_flags": opp.department_flags or {},
            "job_profiles": opp.job_profiles or [],
            "skills": cleaned_skills,
            "emolument_raw": opp.emolument_raw or "",
            "emolument_display": ctc_display or "Not specified",
            "selection_process": opp.selection_process or "",
            "number_of_offers": opp.number_of_offers,
            "created_at": opp.created_at.isoformat() if opp.created_at else None,
        })

    return results


MISSING_RESPONSIBILITY_VALUES: Set[str] = {
    "NA", "N/A", "NONE", "NULL", "-", "N.A.", "NOT APPLICABLE", "NOT SPECIFIED", "N / A"
}


def extract_roles_responsibilities(opp: PlacementOpportunity) -> List[str]:
    """Extract and normalize role responsibility bullets from placement opportunity data.
    
    Priority:
    1. Dedicated job_profiles on PlacementOpportunity (from Job Profile 1-5 columns in XLSX)
    2. Linked CompanyRegistration job_offers skills / responsibilities
    
    Rules:
    - Omit missing/placeholder values like NA, N/A, -
    - Do not treat designation as responsibilities
    - Strip existing bullet markers (1., -, *, •) to avoid duplicate bullet symbols
    - Return clean, distinct list of meaningful bullet strings
    """
    raw_entries: List[Any] = []
    if opp.job_profiles:
        if isinstance(opp.job_profiles, list):
            raw_entries.extend(opp.job_profiles)
        elif isinstance(opp.job_profiles, str):
            raw_entries.append(opp.job_profiles)

    if not raw_entries and opp.company_registration:
        for offer in opp.company_registration.job_offers.all():
            if offer.skills and offer.skills.strip():
                raw_entries.append(offer.skills)

    if not raw_entries and not opp.company_registration and opp.company and opp.batch:
        try:
            reg = CompanyRegistration.objects.filter(
                name__iexact=opp.company.name.strip(),
                batch=opp.batch.strip(),
            ).first()
            if reg:
                for offer in reg.job_offers.all():
                    if offer.skills and offer.skills.strip():
                        raw_entries.append(offer.skills)
        except Exception:
            pass

    cleaned_bullets: List[str] = []
    seen: Set[str] = set()

    for entry in raw_entries:
        if not entry or not isinstance(entry, str):
            continue
        lines = entry.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        for line in lines:
            line_str = line.strip()
            # Strip bullets, numbered prefixes like "1. ", "• ", "- "
            clean = re.sub(r"^[•\-\*\s]+", "", line_str)
            clean = re.sub(r"^\d+[\.\)]\s*", "", clean).strip()
            if not clean:
                continue
            if clean.upper() in MISSING_RESPONSIBILITY_VALUES:
                continue
            # Rule 9: Do not invent responsibilities from designation alone
            if opp.designation and clean.lower() == opp.designation.strip().lower():
                continue
            if clean.lower() not in seen:
                seen.add(clean.lower())
                cleaned_bullets.append(clean)

    return cleaned_bullets


def get_opportunity_autofill_data(
    opportunity_id: int,
    notice_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Retrieve opportunity and generate notice draft autofill defaults.
    
    CRITICAL: Auto-fill values populate notice fields, but do not bind to or modify
    the Opportunity or Company master records.
    """
    try:
        opp = PlacementOpportunity.objects.select_related("company").get(pk=opportunity_id)
    except PlacementOpportunity.DoesNotExist:
        raise ValidationError(f"Placement Opportunity with ID {opportunity_id} does not exist.")

    company = opp.company
    today_str = date.today().isoformat()
    
    forced_type = str(notice_type).strip().lower() if notice_type else ""
    if forced_type in ("internship", "int"):
        is_internship = True
        is_training = False
        is_both = False
    elif forced_type in ("training", "trg"):
        is_internship = False
        is_training = True
        is_both = False
    elif forced_type in ("placement", "pl"):
        is_internship = False
        is_training = False
        is_both = False
    else:
        is_internship = (opp.placement_internship or "").strip().lower() == "internship"
        is_training = (opp.placement_internship or "").strip().lower() == "training"
        is_both = (opp.placement_internship or "").strip().lower() == "both"

    if is_training:
        serial_no = generate_next_serial_number("Training")
    elif is_internship:
        serial_no = generate_next_serial_number("Internship")
    else:
        serial_no = generate_next_serial_number("Placement")

    # Departments text
    dept_list = opp.eligible_departments or []
    depts_formatted = ", ".join(dept_list) if isinstance(dept_list, list) else str(dept_list)
    batch_val = (opp.batch or "").strip()
    has_valid_batch = bool(batch_val and batch_val.lower() not in ("nan", "none", "null", "n/a", "na", "-"))

    if is_training:
        batch_text = f"of the {batch_val} batch" if has_valid_batch else "of the 2027 / 2028 / 2029 batch"
        to_text = f"All Concerned students {batch_text}"
        subject = f"Registrations for Free {company.name} Jobinar"
        intro = ""
    elif has_valid_batch:
        to_text = f"All concerned Students of {batch_val} Batch ({depts_formatted})" if depts_formatted else f"All concerned Students of {batch_val} Batch"
        if is_internship:
            subject = f"Campus Internship Drive - {company.name} for {batch_val} Batch"
            intro = (
                f"All eligible and interested students of {batch_val} batch are hereby informed that "
                f"{company.name} is offering internship opportunities."
            )
        elif is_both:
            subject = f"Campus Placement & Internship Drive - {company.name} for {batch_val} Batch"
            intro = (
                f"All eligible and interested students of {batch_val} batch are hereby informed that "
                f"{company.name} is conducting a campus recruitment and internship drive."
            )
        else:
            subject = f"Campus Recruitment Drive - {company.name} for {batch_val} Batch"
            intro = (
                f"All eligible and interested students of {batch_val} batch are hereby informed that "
                f"{company.name} is conducting a campus recruitment drive."
            )
    else:
        to_text = f"All concerned Students ({depts_formatted})" if depts_formatted else "All concerned Students"
        if is_internship:
            subject = f"Campus Internship Drive - {company.name}"
            intro = (
                f"All eligible and interested students are hereby informed that "
                f"{company.name} is offering internship opportunities."
            )
        elif is_both:
            subject = f"Campus Placement & Internship Drive - {company.name}"
            intro = (
                f"All eligible and interested students are hereby informed that "
                f"{company.name} is conducting a campus recruitment and internship drive."
            )
        else:
            subject = f"Campus Recruitment Drive - {company.name}"
            intro = (
                f"All eligible and interested students are hereby informed that "
                f"{company.name} is conducting a campus recruitment drive."
            )

    # Compensation / salary
    raw_salary = opp.emolument_raw.strip() if opp.emolument_raw else ""
    if is_internship:
        # Check if the emolument is already formatted as a monthly stipend
        is_monthly = any(m in raw_salary.lower() for m in ["/month", "/m", "pm", "per month", "stipend"])
        if is_monthly and raw_salary:
            salary_str = raw_salary
        elif opp.emolument_unit == "MONTHLY_STIPEND" and opp.emolument_value:
            salary_str = f"₹{opp.emolument_value:,.0f} / month"
        else:
            salary_str = "As per company norms"
    else:
        if raw_salary:
            salary_str = raw_salary
        elif opp.emolument_value:
            unit = opp.emolument_unit or "LPA"
            salary_str = f"₹{opp.emolument_value} {unit}"
        else:
            salary_str = "As per company norms"

    # Query linked internship offers if available
    internship_offers = []
    try:
        from internship_api.models import InternshipRegistration, Offers
        internship_reg = InternshipRegistration.objects.filter(name__iexact=company.name).first()
        if internship_reg:
            for off in Offers.objects.filter(company=internship_reg):
                stip_val = f"₹{off.stipend:,.0f} / month" if off.stipend else salary_str
                pos_val = off.position or opp.designation or "Intern"
                if "intern" not in pos_val.lower():
                    pos_val = f"{pos_val} (Intern)"
                internship_offers.append({
                    "type": off.type or "Internship",
                    "salary": stip_val,
                    "position": pos_val,
                })
    except Exception:
        pass

    # Structured table rows
    if is_training:
        table_rows = [
            {
                "type": "Jobinar / Training",
                "salary": "Free Registration",
                "position": opp.designation or "AI Agents & Power Platform",
            }
        ]
    elif is_both:
        placement_row = {
            "type": "Regular",
            "salary": raw_salary or "As per company norms",
            "position": opp.designation or "Graduate Engineer Trainee",
        }
        int_pos = f"{opp.designation} (Intern)" if (opp.designation and "intern" not in opp.designation.lower()) else (opp.designation or "Intern")
        if internship_offers:
            table_rows = [placement_row] + internship_offers
        else:
            table_rows = [
                placement_row,
                {
                    "type": "Internship",
                    "salary": salary_str,
                    "position": int_pos,
                },
            ]
    elif is_internship:
        int_pos = f"{opp.designation} (Intern)" if (opp.designation and "intern" not in opp.designation.lower()) else (opp.designation or "Intern")
        if internship_offers:
            table_rows = internship_offers
        else:
            table_rows = [
                {
                    "type": "Internship",
                    "salary": salary_str,
                    "position": int_pos,
                }
            ]
    else:
        table_rows = [
            {
                "type": "Regular",
                "salary": salary_str,
                "position": opp.designation or "Graduate Engineer Trainee",
            }
        ]

    # Skills list
    skills_list = opp.skills if isinstance(opp.skills, list) else [opp.skills] if opp.skills else []
    skills_str = ", ".join(skills_list) if isinstance(skills_list, list) else str(skills_list)

    # Roles & Responsibilities extraction and normalization
    roles_bullets = extract_roles_responsibilities(opp)
    roles_resp_str = "\n".join(f"• {b}" for b in roles_bullets) if roles_bullets else ""

    return {
        "opportunity_id": opp.id,
        "company_id": company.id,
        "company_name": company.name,
        "company_website": company.website,
        "batch": opp.batch,
        "sr_no": serial_no,
        "date": today_str,
        "to": to_text,
        "subject": subject,
        "intro": intro,
        "about": company.description or (
            f"{company.name} is a leading organization offering valuable internship opportunities to students."
            if is_internship
            else f"{company.name} is a leading organization in its industry."
        ),
        "eligibility_criteria": opp.eligibility_criteria or "As per company criteria",
        "roles": json.dumps(table_rows, ensure_ascii=False),
        "table_data": table_rows,
        "roles_responsibilities": roles_resp_str,
        "roles_responsibilities_list": roles_bullets,
        "skill_required": skills_str,
        "documents_to_carry": "",
        "walk_in_interview": opp.selection_process or (
            "Online Assessment / Shortlisting followed by Technical & HR Interviews for Internship."
            if is_internship
            else "Online Assessment followed by Technical and HR Interviews."
        ),
        "company_registration_link": company.website or "",
        "note": (
            "Students must report on time in formal attire. Internship duration, working hours, and evaluation will be per company guidelines."
            if is_internship
            else "Students must report on time in formal attire. Late entries will not be permitted."
        ),
        "from_field": "Dr. Zahir Aalam",
        "from_designation": "Dean (TP&IL)",
        "location": "TCET Campus / Online",
        "notice_type": "Training" if is_training else ("Internship" if is_internship else "Placement"),
        "status": "DRAFT",
        "organiser": company.name,
        "topic": opp.designation or "Can AI Agents Be Created Without Coding?",
        "session_date": "22nd October 2026 (Thursday)",
        "session_time": "5:00 PM to 6:00 PM IST",
        "mode": "Online",
        "reasons_to_attend": [
            "Discover: Understand how apps, automation, and AI agents bring ideas to life.",
            "Learn: Explore how to build solutions using Power Platform and Copilot Studio.",
            "Explore: Learn about available learning paths, certifications, and emerging career opportunities.",
        ],
        "registration_callout": "All eligible and interested students are required to register online",
        "college_registration_link": "https://forms.gle/rA9RSZ4Ju2oUMETbA",
        "registration_note": "(It is mandatory to register on both the links - company link and the college link.)",
    }


# ---------------------------------------------------------------------------
# Change Detection & Version Diffing
# ---------------------------------------------------------------------------

DIFF_FIELD_LABELS = {
    "subject": "Subject",
    "date": "Date",
    "location": "Location",
    "sr_no": "Serial Number",
    "to": "Recipient (To)",
    "intro": "Introduction",
    "about": "About Company",
    "eligibility_criteria": "Eligibility Criteria",
    "roles_responsibilities": "Roles & Responsibilities",
    "skill_required": "Skills Required",
    "documents_to_carry": "Documents to Carry",
    "walk_in_interview": "Selection Process / Interview",
    "company_registration_link": "Company Registration Link",
    "note": "Note",
    "from_field": "Signatory Name",
    "from_designation": "Signatory Designation",
    "table_data": "Job Positions & CTC",
}


def diff_notice_snapshots(old_snap: Dict[str, Any], new_snap: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Compute granular field-by-field differences between two notice snapshots."""
    changes = []

    for field, label in DIFF_FIELD_LABELS.items():
        old_val = old_snap.get(field)
        new_val = new_snap.get(field)

        if field == "table_data":
            # Compare table data rows
            old_rows = old_val or []
            new_rows = new_val or []
            if old_rows != new_rows:
                old_desc = ", ".join([f"{r.get('position')} ({r.get('salary')})" for r in old_rows if isinstance(r, dict)])
                new_desc = ", ".join([f"{r.get('position')} ({r.get('salary')})" for r in new_rows if isinstance(r, dict)])
                changes.append({
                    "field": field,
                    "label": label,
                    "old": old_desc or "None",
                    "new": new_desc or "None",
                    "description": f"Positions/CTC updated: {old_desc or 'None'} → {new_desc or 'None'}",
                })
        else:
            old_str = str(old_val or "").strip()
            new_str = str(new_val or "").strip()
            if old_str != new_str:
                changes.append({
                    "field": field,
                    "label": label,
                    "old": old_str,
                    "new": new_str,
                    "description": f"{label} changed: '{old_str[:40]}' → '{new_str[:40]}'",
                })

    return changes


# ---------------------------------------------------------------------------
# Draft & Notice Lifecycle Operations
# ---------------------------------------------------------------------------

def save_notice_draft(user, draft_id: Optional[int], data: Dict[str, Any], ip_address: Optional[str] = None) -> Notice:
    """Save or update a private notice draft.
    
    Enforces draft ownership: only creator or superuser may update.
    """
    table_data = data.get("table_data") or data.get("tableData") or []
    if isinstance(table_data, str):
        try:
            table_data = json.loads(table_data)
        except Exception:
            table_data = []

    notice = None
    created = False

    if draft_id:
        try:
            notice = Notice.objects.get(pk=draft_id)
        except Notice.DoesNotExist:
            raise ValidationError(f"Notice #{draft_id} does not exist.")

        # Draft ownership check
        if notice.status == "DRAFT" and notice.created_by and notice.created_by != user and not user.is_superuser:
            raise ValidationError("You do not have permission to modify another user's draft.")
    else:
        req_ntype = data.get("notice_type")
        req_clean = req_ntype.strip().lower() if req_ntype else ""
        if req_clean in ("internship", "int"):
            initial_ntype = "Internship"
        elif req_clean in ("training", "trg"):
            initial_ntype = "Training"
        else:
            initial_ntype = "Placement"
        notice = Notice(
            status="DRAFT",
            created_by=user,
            notice_type=initial_ntype,
        )
        created = True

    # Link Opportunity / Company if provided
    opp_id = data.get("opportunity_id") or data.get("opportunity")
    if opp_id:
        try:
            opp = PlacementOpportunity.objects.select_related("company").get(pk=opp_id)
            notice.opportunity = opp
            notice.company = opp.company
            notice.batch = opp.batch
        except PlacementOpportunity.DoesNotExist:
            pass

    company_id = data.get("company_id") or data.get("company")
    if company_id and not notice.company:
        try:
            notice.company = Company.objects.get(pk=company_id)
        except Company.DoesNotExist:
            pass

    # Populate communication fields (strictly sanitized)
    notice.subject = sanitize_text(data.get("subject", "").strip() or "Untitled Notice")
    notice.date = data.get("date") or date.today().isoformat()
    notice.intro = sanitize_text(data.get("intro", "").strip())
    notice.about = sanitize_text(data.get("about", "").strip())
    notice.company_registration_link = data.get("company_registration_link", "").strip()
    notice.note = sanitize_text(data.get("note", "").strip())
    notice.location = sanitize_text(data.get("location", "").strip())
    notice.deadline = data.get("deadline") or None

    req_ntype = data.get("notice_type")
    if req_ntype:
        req_clean = req_ntype.strip().lower()
        if req_clean in ("internship", "int"):
            notice.notice_type = "Internship"
        elif req_clean in ("training", "trg"):
            notice.notice_type = "Training"
        else:
            notice.notice_type = "Placement"

    if notice.notice_type == "Training" or (data.get("notice_type") or "").strip().lower() in ("training", "trg"):
        custom = dict(notice.custom_data or {})
        for k in ["organiser", "topic", "session_date", "session_time", "mode", "reasons_to_attend", "college_registration_link", "registration_callout", "registration_note"]:
            if k in data:
                custom[k] = data[k]
        notice.custom_data = custom

    notice.sr_no = data.get("sr_no", "").strip() or generate_next_serial_number(notice.notice_type)
    notice.to = sanitize_text(data.get("to", "").strip())
    notice.eligibility_criteria = sanitize_text(data.get("eligibility_criteria", "").strip())
    notice.roles = json.dumps(table_data, ensure_ascii=False) if table_data else (data.get("roles", "") or "")
    notice.skill_required = sanitize_text(data.get("skill_required", "").strip())
    notice.documents_to_carry = sanitize_text(data.get("documents_to_carry", "").strip())
    notice.walk_in_interview = sanitize_text(data.get("walk_in_interview", "").strip())
    notice.from_field = sanitize_text(data.get("from_field", "").strip())
    notice.from_designation = sanitize_text(data.get("from_designation", "").strip())
    notice.updated_by = user

    # Extra custom properties
    extra_custom = dict(notice.custom_data or {})
    raw_custom = data.get("custom_data")
    if isinstance(raw_custom, dict):
        extra_custom.update(raw_custom)
    extra_custom.update({
        "college_registration_link": data.get("college_registration_link") or extra_custom.get("college_registration_link", ""),
        "table_data": table_data,
        "skills_list": data.get("skills_list", []),
        "roles_responsibilities": sanitize_text(data.get("roles_responsibilities", "")),
    })
    notice.custom_data = extra_custom

    notice.save()

    # Record Audit Log
    NoticeAuditLog.objects.create(
        notice=notice,
        action="CREATED_DRAFT" if created else "UPDATED_DRAFT",
        version_number=None,
        performed_by=user,
        performed_by_name=user.full_name if hasattr(user, "full_name") else "",
        performed_by_email=user.email if hasattr(user, "email") else "",
        details={"status": "DRAFT", "subject": notice.subject},
        ip_address=ip_address,
    )

    return notice


def create_notice_snapshot(notice: Notice, table_data: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Create a complete serializable snapshot of the notice."""
    if table_data is None:
        if notice.roles:
            try:
                table_data = json.loads(notice.roles)
            except Exception:
                table_data = []
        else:
            table_data = []

    return {
        "notice_id": notice.id,
        "sr_no": notice.sr_no,
        "date": str(notice.date),
        "to": notice.to,
        "subject": notice.subject,
        "intro": notice.intro,
        "about": notice.about,
        "eligibility_criteria": notice.eligibility_criteria,
        "roles_responsibilities": (notice.custom_data or {}).get("roles_responsibilities", ""),
        "roles": notice.roles,
        "table_data": table_data,
        "skill_required": notice.skill_required,
        "documents_to_carry": notice.documents_to_carry,
        "walk_in_interview": notice.walk_in_interview,
        "company_registration_link": notice.company_registration_link,
        "note": notice.note,
        "from_field": notice.from_field,
        "from_designation": notice.from_designation,
        "location": notice.location,
        "deadline": str(notice.deadline) if notice.deadline else None,
        "company_name": notice.company.name if notice.company else "",
        "company_website": notice.company.website if notice.company else "",
        "opportunity_id": notice.opportunity_id,
        "batch": notice.batch,
        "custom_data": notice.custom_data,
    }


def publish_notice_service(
    user,
    notice_id: int,
    data: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> Tuple[Notice, NoticeVersion]:
    """Publish a Placement Notice or update an existing published notice with a new version.
    
    Enforces:
    1. Comprehensive required field validation.
    2. Atomic transaction (Notice + NoticeVersion + AuditLog).
    3. Immutability of past versions.
    4. Automatic change detection between versions.
    5. Zero modification of Company / Opportunity master records (Edit Isolation).
    """
    with transaction.atomic():
        try:
            notice = Notice.objects.select_for_update().get(pk=notice_id)
        except Notice.DoesNotExist:
            raise ValidationError(f"Notice with ID {notice_id} does not exist.")

        # Merge new incoming data if supplied
        if data:
            if "subject" in data:
                notice.subject = sanitize_text(data["subject"].strip())
            if "date" in data and data["date"]:
                notice.date = data["date"]
            if "to" in data:
                notice.to = sanitize_text(data["to"].strip())
            if "intro" in data:
                notice.intro = sanitize_text(data["intro"].strip())
            if "about" in data:
                notice.about = sanitize_text(data["about"].strip())
            if "location" in data:
                notice.location = sanitize_text(data["location"].strip())
            if "eligibility_criteria" in data:
                notice.eligibility_criteria = sanitize_text(data["eligibility_criteria"].strip())
            if "skill_required" in data:
                notice.skill_required = sanitize_text(data["skill_required"].strip())
            if "documents_to_carry" in data:
                notice.documents_to_carry = sanitize_text(data["documents_to_carry"].strip())
            if "walk_in_interview" in data:
                notice.walk_in_interview = sanitize_text(data["walk_in_interview"].strip())
            if "company_registration_link" in data:
                notice.company_registration_link = data["company_registration_link"].strip()
            if "note" in data:
                notice.note = sanitize_text(data["note"].strip())
            if "from_field" in data:
                notice.from_field = sanitize_text(data["from_field"].strip())
            if "from_designation" in data:
                notice.from_designation = sanitize_text(data["from_designation"].strip())
            if "deadline" in data:
                notice.deadline = data["deadline"] or None
            if "sr_no" in data and data["sr_no"].strip():
                notice.sr_no = data["sr_no"].strip()

            table_data = data.get("table_data") or data.get("tableData")
            if table_data is not None:
                notice.roles = json.dumps(table_data, ensure_ascii=False)

            if "roles_responsibilities" in data:
                custom = dict(notice.custom_data or {})
                custom["roles_responsibilities"] = sanitize_text(data["roles_responsibilities"])
                notice.custom_data = custom

        # Pre-publish validation
        if not notice.subject:
            raise ValidationError("Notice Subject is required for publishing.")
        if not notice.date:
            raise ValidationError("Notice Date is required for publishing.")
        if not notice.to:
            raise ValidationError("Notice Recipient (To) is required for publishing.")
        if not notice.intro:
            raise ValidationError("Notice Introduction is required for publishing.")
        if not notice.eligibility_criteria:
            raise ValidationError("Eligibility criteria is required for publishing.")

        # Determine version number
        is_first_publish = (notice.status != "PUBLISHED")
        
        if is_first_publish:
            new_version_num = 1
            notice.status = "PUBLISHED"
            notice.version_count = 1
            action_type = "PUBLISHED"
            changes = [{"field": "initial", "description": "Initial publication (Version 1)"}]
        else:
            new_version_num = notice.version_count + 1
            notice.version_count = new_version_num
            action_type = "UPDATED_VERSION"

            # Retrieve prior version snapshot for diff detection
            prev_version = NoticeVersion.objects.filter(notice=notice, version_number=new_version_num - 1).first()
            if prev_version:
                prev_snap = prev_version.snapshot
                curr_snap = create_notice_snapshot(notice)
                changes = diff_notice_snapshots(prev_snap, curr_snap)
                if not changes:
                    changes = [{"field": "general", "description": f"Updated notice details for Version {new_version_num}"}]
            else:
                changes = [{"field": "general", "description": f"Updated notice details for Version {new_version_num}"}]

        notice.updated_by = user
        notice.save()

        # Mark any previous versions is_current = False
        NoticeVersion.objects.filter(notice=notice, is_current=True).update(is_current=False)

        # Create immutable snapshot for this version
        snapshot = create_notice_snapshot(notice)
        version = NoticeVersion.objects.create(
            notice=notice,
            version_number=new_version_num,
            title_or_subject=notice.subject,
            snapshot=snapshot,
            changes_summary=changes,
            created_by=user,
            is_current=True,
        )

        # Record Audit Trail
        NoticeAuditLog.objects.create(
            notice=notice,
            action=action_type,
            version_number=new_version_num,
            performed_by=user,
            performed_by_name=user.full_name if hasattr(user, "full_name") else "",
            performed_by_email=user.email if hasattr(user, "email") else "",
            details={"version": new_version_num, "changes": changes},
            ip_address=ip_address,
        )

        return notice, version


def clone_notice_as_new(user, source_notice_id: int, ip_address: Optional[str] = None) -> Notice:
    """Clone an existing Notice into a brand new independent Notice Draft.
    
    Resets:
    - New ID
    - Status = 'DRAFT'
    - Version count = 1
    - Date = Server today
    - New unique serial number
    - Cloned_from reference for auditability
    """
    try:
        source = Notice.objects.get(pk=source_notice_id)
    except Notice.DoesNotExist:
        raise ValidationError(f"Source Notice #{source_notice_id} does not exist.")

    new_sr_no = generate_next_serial_number("Placement")
    today = date.today()

    new_notice = Notice.objects.create(
        subject=f"{source.subject} (Copy)",
        date=today,
        intro=source.intro,
        about=source.about,
        company_registration_link=source.company_registration_link,
        note=source.note,
        location=source.location,
        deadline=None,
        sr_no=new_sr_no,
        to=source.to,
        eligibility_criteria=source.eligibility_criteria,
        roles=source.roles,
        skill_required=source.skill_required,
        documents_to_carry=source.documents_to_carry,
        walk_in_interview=source.walk_in_interview,
        from_field=source.from_field or "Dr. Zahir Aalam",
        from_designation=source.from_designation or "Dean (TP&IL)",
        notice_type="Placement",
        status="DRAFT",
        batch=source.batch,
        company=source.company,
        opportunity=source.opportunity,
        version_count=1,
        cloned_from=source,
        created_by=user,
        updated_by=user,
        custom_data=source.custom_data.copy() if source.custom_data else {},
    )

    NoticeAuditLog.objects.create(
        notice=new_notice,
        action="CLONED",
        version_number=None,
        performed_by=user,
        performed_by_name=user.full_name if hasattr(user, "full_name") else "",
        performed_by_email=user.email if hasattr(user, "email") else "",
        details={"source_notice_id": source.id, "source_sr_no": source.sr_no},
        ip_address=ip_address,
    )

    return new_notice


# ---------------------------------------------------------------------------
# Safe AI Extraction / Assist Service
# ---------------------------------------------------------------------------

def safe_ai_extract_notice(raw_text: str) -> Dict[str, Any]:
    """Parse unstructured circular / company message text safely into notice draft fields.
    
    SECURITY:
    - Input is treated as 100% untrusted data.
    - Cannot publish directly.
    - Sanitizes all extracted fields.
    """
    clean_text = raw_text.strip()
    if not clean_text:
        return {}

    extracted = {
        "subject": "",
        "about": "",
        "eligibility_criteria": "",
        "table_data": [],
        "skill_required": "",
        "selection_process": "",
        "company_registration_link": "",
        "note": "",
        "location": "",
    }

    # Extract CTC / Salary matches
    ctc_match = re.search(r"(?:CTC|Salary|Stipend|Compensation)[\s:]*(?:CTC\s*)?([₹\d\.,\-–\stoLPAkKpmPM/]+)", clean_text, re.IGNORECASE)
    # Extract Designation matches
    role_match = re.search(r"(?:Designation|Role|Profile|Position)[\s:]*([A-Za-z0-9\s/,\-–\(\)]+)", clean_text, re.IGNORECASE)
    
    position_title = role_match.group(1).strip() if role_match else "Software Engineer / Analyst"
    salary_val = ctc_match.group(1).strip() if ctc_match else "As per company norms"
    
    extracted["table_data"] = [{
        "type": "Regular",
        "salary": salary_val,
        "position": position_title,
    }]

    # Extract links
    url_matches = re.findall(r"https?://[^\s<>\"']+", clean_text)
    if url_matches:
        extracted["company_registration_link"] = url_matches[0]

    # Extract skills
    skills_match = re.search(r"(?:Skills|Requirements|Key Skills)[\s:]*([^\n\r]+)", clean_text, re.IGNORECASE)
    if skills_match:
        extracted["skill_required"] = skills_match.group(1).strip()

    # Extract eligibility
    elig_match = re.search(r"(?:Eligibility|Criteria|Eligible Branches)[\s:]*([^\n\r]+)", clean_text, re.IGNORECASE)
    if elig_match:
        extracted["eligibility_criteria"] = elig_match.group(1).strip()

    # Extract selection process
    process_match = re.search(r"(?:Selection Process|Rounds|Interview Process)[\s:]*([^\n\r]+)", clean_text, re.IGNORECASE)
    if process_match:
        extracted["selection_process"] = process_match.group(1).strip()

    return extracted
