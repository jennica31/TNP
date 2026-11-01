"""Seed the 2027 MCA batch placement report data from the Excel workbook."""
from django.core.management.base import BaseCommand
from django.db import transaction
from reports.models import PlacementReport, PlacementRegisterEntry, CompanyRecord, PhaseWiseReport
import datetime


class Command(BaseCommand):
    help = "Seed 2027 MCA batch report data from Excel workbook"

    def handle(self, *args, **options):
        with transaction.atomic():
            # Create main report
            report, created = PlacementReport.objects.get_or_create(
                batch="2027",
                program="MCA",
                defaults={
                    "ref_no": "TCET/TNP/FRM/IP-06/09",
                    "report_no": "TCET/ T&P / REP  94    of 2026",
                    "revision": "B",
                    "report_date": datetime.date(2026, 10, 16),
                    "admitted_final_year": 125,
                    "opt_out": 4,
                    "interested": 121,
                    "eligible": 117,
                    "not_eligible": 4,
                    "due_date": datetime.date(2026, 9, 27),
                    "completion_date": datetime.date(2026, 9, 24),
                    "reason_if_late": "Capgemini result Declared as on 16/10/2026",
                    "signatories": {
                        "clerk": {"name": "Rajesh Singh", "designation": "Sr.Clerk", "date": "/10/26"},
                        "placement_officer": {"name": "Rupali Mane", "designation": "Dy.(Placement Officer)", "date": "/10/26"},
                        "dean": {"name": "Dr. Zahir Aalam", "designation": "Dean(TP&IL)", "date": "/10/26"},
                        "vice_principal": {"name": "Dr. R.R. Sedamkar", "designation": "Vice-Principal", "date": ""},
                    },
                    "copy_to": ["Principal", "Vice Principal", "All Deans", "All HODs"],
                    "is_draft": False,
                },
            )
            if created:
                self.stdout.write("Created PlacementReport 2027 MCA")
            else:
                self.stdout.write("PlacementReport 2027 MCA already exists — skipping report creation")
                return

            # Placement register entries from Excel
            ENTRIES = [
                {"sr_no": 1, "branch": "MCA-B", "division": "", "tnp_uid": "25-MCAB50-27", "student_name": "YADAV ANUJ INDRABALAK URMILA", "employer_visit_date": "09/04/2026 & 09/09/2026", "employer_category": "CAT-2", "placement_type": "HackwithInfy", "employer_name": "Infosys Digital Specialist Engineer", "stipend_offered": "", "salary_lpa": 6.25, "num_offers": 1, "dual_offer": False, "campus_on_off": "ON"},
                {"sr_no": 2, "branch": "MCA-A", "division": "", "tnp_uid": "25-MCAA25-27", "student_name": "GUPTA SHOMESH SHASHIDHAR SHASHIKALA", "employer_visit_date": "24/06/2026 & 25/06/2026", "employer_category": "CAT-2", "placement_type": "Regular", "employer_name": "Tata Consultancy Service - Digital", "stipend_offered": "", "salary_lpa": 7.39, "num_offers": 2, "dual_offer": False, "campus_on_off": "ON"},
                {"sr_no": 3, "branch": "MCA-A", "division": "", "tnp_uid": "25-MCAA29-27", "student_name": "JADHAV SHRUTI SANJAY POOJA", "employer_visit_date": "24/06/2026 & 25/06/2026", "employer_category": "CAT-3", "placement_type": "Regular", "employer_name": "Tata Consultancy Service - Ninja", "stipend_offered": "", "salary_lpa": 3.62, "num_offers": None, "dual_offer": True, "campus_on_off": "ON"},
                {"sr_no": 4, "branch": "MCA-A", "division": "", "tnp_uid": "25-MCAA32-27", "student_name": "KAZI FIROZ RAHMAN MOHD SADIK PARVEEN", "employer_visit_date": "26/08/2026", "employer_category": "CAT-3", "placement_type": "PLI", "employer_name": "C2L BIZ Solutions Pvt. Ltd.", "stipend_offered": "7500", "salary_lpa": 3.5, "num_offers": 3, "dual_offer": False, "campus_on_off": "ON"},
                {"sr_no": 5, "branch": "MCA-A", "division": "", "tnp_uid": "25-MCAA40-27", "student_name": "LOHAR DINESH ROSHANLAL DEU DEVI", "employer_visit_date": "26/08/2026", "employer_category": "CAT-3", "placement_type": "PLI", "employer_name": "C2L BIZ Solutions Pvt. Ltd.", "stipend_offered": "7500", "salary_lpa": 3.5, "num_offers": None, "dual_offer": False, "campus_on_off": "ON"},
                {"sr_no": 6, "branch": "MCA-B", "division": "", "tnp_uid": "25-MCAB59-27", "student_name": "YADAV SONIYA SABHELAL ASHA", "employer_visit_date": "26/08/2026", "employer_category": "CAT-3", "placement_type": "PLI", "employer_name": "C2L BIZ Solutions Pvt. Ltd.", "stipend_offered": "7500", "salary_lpa": 3.5, "num_offers": None, "dual_offer": False, "campus_on_off": "ON"},
                {"sr_no": 7, "branch": "MCA-A", "division": "", "tnp_uid": "25-MCAA06-27", "student_name": "CHAUDHARI ABHISHEK SUNIL MEERA", "employer_visit_date": "05-09-2026", "employer_category": "CAT-2", "placement_type": "PLI", "employer_name": "Airdawg Labs Caudal AI Labs Pvt. Ltd.", "stipend_offered": "10000", "salary_lpa": 6.0, "num_offers": 2, "dual_offer": False, "campus_on_off": "ON"},
                {"sr_no": 8, "branch": "MCA-B", "division": "", "tnp_uid": "25-MCAB62-27", "student_name": "YASH ARYAN RAKESH KUMAR REKHA", "employer_visit_date": "05-09-2026", "employer_category": "CAT-2", "placement_type": "PLI", "employer_name": "Airdawg Labs Caudal AI Labs Pvt. Ltd.", "stipend_offered": "10000", "salary_lpa": 6.0, "num_offers": None, "dual_offer": False, "campus_on_off": "ON"},
                {"sr_no": 9, "branch": "MCA-B", "division": "", "tnp_uid": "25-MCAB40-27", "student_name": "UPADHYAY HARSH SUBHASHCHANDRA SHYAMBALA", "employer_visit_date": "05/10/2026 &06/10/2026", "employer_category": "CAT-3", "placement_type": "Regular", "employer_name": "Capgemini-spark", "stipend_offered": "", "salary_lpa": 4.25, "num_offers": 8, "dual_offer": False, "campus_on_off": "OFF"},
                {"sr_no": 10, "branch": "MCA-A", "division": "", "tnp_uid": "25-MCAA03-27", "student_name": "BAGARIA ROHAN PARESH KOMAL", "employer_visit_date": "05/10/2026 &06/10/2026", "employer_category": "CAT-3", "placement_type": "Regular", "employer_name": "Capgemini-spark", "stipend_offered": "", "salary_lpa": 4.25, "num_offers": None, "dual_offer": False, "campus_on_off": "OFF"},
                {"sr_no": 11, "branch": "MCA-A", "division": "", "tnp_uid": "25-MCAA47-27", "student_name": "NAIK KANIKA LEKHRAJ SAKSHI", "employer_visit_date": "05/10/2026 &06/10/2026", "employer_category": "CAT-3", "placement_type": "Regular", "employer_name": "Capgemini-spark", "stipend_offered": "", "salary_lpa": 4.25, "num_offers": None, "dual_offer": False, "campus_on_off": "OFF"},
                {"sr_no": 12, "branch": "MCA-A", "division": "", "tnp_uid": "25-MCAB36-27", "student_name": "TIWARI ABHISHEK GRIJESH SANGEETA", "employer_visit_date": "05/10/2026 &06/10/2026", "employer_category": "CAT-3", "placement_type": "Regular", "employer_name": "Capgemini-spark", "stipend_offered": "", "salary_lpa": 4.25, "num_offers": None, "dual_offer": False, "campus_on_off": "OFF"},
                {"sr_no": 13, "branch": "MCA-A", "division": "", "tnp_uid": "25-MCAA12-27", "student_name": "DIVAKAR SHIVAM RAJESH SUCHETA", "employer_visit_date": "05/10/2026 &06/10/2026", "employer_category": "CAT-3", "placement_type": "Regular", "employer_name": "Capgemini-spark", "stipend_offered": "", "salary_lpa": 4.25, "num_offers": None, "dual_offer": False, "campus_on_off": "OFF"},
                {"sr_no": 14, "branch": "MCA-A", "division": "", "tnp_uid": "25-MCAA29-27", "student_name": "JADHAV SHRUTI SANJAY POOJA", "employer_visit_date": "05/10/2026 &06/10/2026", "employer_category": "CAT-3", "placement_type": "Regular", "employer_name": "Capgemini-spark", "stipend_offered": "", "salary_lpa": 4.25, "num_offers": None, "dual_offer": False, "campus_on_off": "OFF"},
                {"sr_no": 15, "branch": "MCA-A", "division": "", "tnp_uid": "25-MCAA18-27", "student_name": "GOND PALLAVI PRITHVIRAJ SARITADEVI", "employer_visit_date": "05/10/2026 &06/10/2026", "employer_category": "CAT-2", "placement_type": "Regular", "employer_name": "Capgemini-dev", "stipend_offered": "", "salary_lpa": 5.75, "num_offers": None, "dual_offer": False, "campus_on_off": "OFF"},
                {"sr_no": 16, "branch": "MCA-A", "division": "", "tnp_uid": "25-MCAA48-27", "student_name": "NAVGHARE SHUBHAM SAMEER SHREYA", "employer_visit_date": "05/10/2026 &06/10/2026", "employer_category": "CAT-2", "placement_type": "Regular", "employer_name": "Capgemini-dev", "stipend_offered": "", "salary_lpa": 5.75, "num_offers": None, "dual_offer": False, "campus_on_off": "OFF"},
            ]

            for e in ENTRIES:
                PlacementRegisterEntry.objects.create(report=report, **e)
            self.stdout.write(f"Created {len(ENTRIES)} placement register entries")

            # Phase I data
            PhaseWiseReport.objects.create(
                report=report,
                phase="I",
                total_admitted=125,
                opt_out=4,
                opted_higher_studies=0,
                interested=121,
                eligible=117,
                companies_visited=19,
                students_placed=15,
                monthly_data={
                    "JUNE": {"companies": 2, "placed": 3},
                    "JULY": {"companies": 0, "placed": 0},
                    "AUGUST": {"companies": 10, "placed": 3},
                    "SEPTEMBER": {"companies": 4, "placed": 2},
                    "OCTOBER": {"companies": 3, "placed": 7},
                    "NOVEMBER": {"companies": 0, "placed": 0},
                    "DECEMBER": {"companies": 0, "placed": 0},
                },
                due_date=datetime.date(2026, 10, 19),
                completion_date=datetime.date(2026, 10, 16),
                reason_if_late="Capgemini result Declared as on 16/10/2026",
            )
            self.stdout.write("Created Phase I report")

            # Phase II data (blank — to be filled by clerk)
            PhaseWiseReport.objects.create(
                report=report,
                phase="II",
                total_admitted=125,
                opt_out=0,
                opted_higher_studies=0,
                interested=0,
                eligible=0,
                companies_visited=0,
                students_placed=0,
                monthly_data={
                    "JANUARY": {"companies": 0, "placed": 0},
                    "FEBRUARY": {"companies": 0, "placed": 0},
                    "MARCH": {"companies": 0, "placed": 0},
                    "APRIL": {"companies": 0, "placed": 0},
                    "MAY": {"companies": 0, "placed": 0},
                },
            )
            self.stdout.write("Created Phase II report (empty)")

            # Phase III data (blank — to be filled by clerk)
            PhaseWiseReport.objects.create(
                report=report,
                phase="III",
                total_admitted=125,
                opt_out=0,
                opted_higher_studies=0,
                interested=0,
                eligible=0,
                companies_visited=0,
                students_placed=0,
                off_campus_placed=0,
                monthly_data={
                    "JUNE": {"companies": 0, "placed": 0},
                    "JULY": {"companies": 0, "placed": 0},
                    "AUGUST": {"companies": 0, "placed": 0},
                    "SEPTEMBER": {"companies": 0, "placed": 0},
                    "OCTOBER": {"companies": 0, "placed": 0},
                    "NOVEMBER": {"companies": 0, "placed": 0},
                    "DECEMBER": {"companies": 0, "placed": 0},
                },
            )
            self.stdout.write("Created Phase III report (empty)")

            # Company records for 2027 batch
            COMPANIES_2027 = [
                {"company_name": "Infosys", "first_visit_year": "2006", "mnc_status": "Indian Company", "criteria_yes_no": "Yes", "technical_yes_no": "Yes", "batch_data": {"2019": "78(119)", "2020": "38", "2021": "77", "2022": "41", "2023": "16", "2024": "1", "2027": "1"}, "is_current_batch": True},
                {"company_name": "Tata Consultancy Services", "first_visit_year": "2006", "mnc_status": "", "criteria_yes_no": "Yes", "technical_yes_no": "No", "batch_data": {"2019": "28", "2020": "35", "2021": "85", "2022": "15", "2023": "24", "2024": "40", "2027": "2"}, "is_current_batch": True},
                {"company_name": "HyperVerge", "first_visit_year": "2025", "mnc_status": "Indian Company", "criteria_yes_no": "", "technical_yes_no": "", "batch_data": {"2019": "—", "2020": "—", "2021": "—", "2022": "—", "2023": "NV", "2024": "NV", "2027": "In Process"}, "is_current_batch": True},
                {"company_name": "C2L BIZ Solutions Pvt. Ltd.", "first_visit_year": "2021", "mnc_status": "", "criteria_yes_no": "Yes", "technical_yes_no": "No", "batch_data": {"2019": "—", "2020": "—", "2021": "0", "2022": "4", "2023": "6", "2024": "NV", "2027": "2"}, "is_current_batch": True},
                {"company_name": "Capgemini", "first_visit_year": "2016", "mnc_status": "MNCs", "criteria_yes_no": "Yes", "technical_yes_no": "Yes", "batch_data": {"2019": "NV", "2020": "71", "2021": "73", "2022": "14", "2023": "89", "2024": "56", "2027": "8"}, "is_current_batch": True},
                {"company_name": "Hexaware", "first_visit_year": "2010", "mnc_status": "Indian Company", "criteria_yes_no": "Yes", "technical_yes_no": "No", "batch_data": {"2019": "1", "2020": "0", "2021": "4", "2022": "7", "2023": "2", "2024": "2", "2027": "In Process"}, "is_current_batch": True},
                {"company_name": "Interactive Brokers Group, Inc.", "first_visit_year": "2027", "mnc_status": "—", "criteria_yes_no": "", "technical_yes_no": "", "batch_data": {"2019": "—", "2020": "—", "2021": "—", "2022": "—", "2023": "—", "2024": "—", "2027": "In Process"}, "is_current_batch": True},
                {"company_name": "Airdawg Labs Caudal AI Labs Pvt. Ltd.", "first_visit_year": "2027", "mnc_status": "—", "criteria_yes_no": "", "technical_yes_no": "", "batch_data": {"2019": "—", "2020": "—", "2021": "—", "2022": "—", "2023": "—", "2024": "—", "2027": "3"}, "is_current_batch": True},
                {"company_name": "LDS infotech Pvt Ltd.", "first_visit_year": "2025", "mnc_status": "", "criteria_yes_no": "", "technical_yes_no": "", "batch_data": {"2019": "—", "2020": "—", "2021": "—", "2022": "—", "2023": "—", "2024": "—", "2027": "In Process"}, "is_current_batch": True},
                {"company_name": "WisdmLabs", "first_visit_year": "2025", "mnc_status": "", "criteria_yes_no": "", "technical_yes_no": "", "batch_data": {"2027": "In Process"}, "is_current_batch": True},
                {"company_name": "Real Value Infospace LLP", "first_visit_year": "2026", "mnc_status": "Indian Company", "criteria_yes_no": "", "technical_yes_no": "", "batch_data": {"2027": "In Process"}, "is_current_batch": True},
                {"company_name": "Vital Edge Technologies", "first_visit_year": "2025", "mnc_status": "Indian Company", "criteria_yes_no": "", "technical_yes_no": "", "batch_data": {"2027": "In Process"}, "is_current_batch": True},
                {"company_name": "JISA Softech Pvt. Ltd", "first_visit_year": "2025", "mnc_status": "", "criteria_yes_no": "", "technical_yes_no": "", "batch_data": {"2027": "In Process"}, "is_current_batch": True},
                {"company_name": "PriceLabs", "first_visit_year": "2026", "mnc_status": "MNCs", "criteria_yes_no": "", "technical_yes_no": "", "batch_data": {"2027": "In Process"}, "is_current_batch": True},
                {"company_name": "Vistex Asia Pacific Pvt. Ltd.", "first_visit_year": "2012", "mnc_status": "MNCs", "criteria_yes_no": "Yes", "technical_yes_no": "No", "batch_data": {"2019": "0", "2020": "4", "2021": "1", "2022": "0", "2023": "0", "2024": "NV", "2027": "In Process"}, "is_current_batch": True},
                {"company_name": "Newgen", "first_visit_year": "2014", "mnc_status": "", "criteria_yes_no": "Yes", "technical_yes_no": "No", "batch_data": {"2021": "1", "2027": "In Process"}, "is_current_batch": True},
                {"company_name": "2Factor", "first_visit_year": "2026", "mnc_status": "", "criteria_yes_no": "", "technical_yes_no": "", "batch_data": {"2027": "In Process"}, "is_current_batch": True},
            ]

            created_count = 0
            for c in COMPANIES_2027:
                obj, was_created = CompanyRecord.objects.get_or_create(
                    company_name=c["company_name"],
                    defaults={k: v for k, v in c.items() if k != "company_name"},
                )
                if was_created:
                    created_count += 1

            self.stdout.write(f"Created {created_count} company records")
            self.stdout.write(self.style.SUCCESS("Seeding complete"))
