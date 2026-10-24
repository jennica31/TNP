"""Tests for separated Student Users and Faculty & Staff Users in Django Admin.

Verifies:
1. Student account workflows are preserved and protected.
2. Faculty & Staff users have a dedicated interface with department and program assignments.
3. Strict role separation between Student and Faculty/Staff workflows.
4. Single source of truth (FacultyResponsibility) is correctly populated and maintained.
5. Password hashing and credential safety are preserved during edits.
6. Admin permissions and Django system checks.
"""

import pytest
from django.contrib.admin.sites import AdminSite
from django.core.exceptions import ValidationError
from django.test import RequestFactory

from base.admin import (
    CustomUserAdmin,
    FacultyStaffDepartmentFilter,
    FacultyStaffDesignationFilter,
    FacultyStaffProgramFilter,
    FacultyStaffUserAdmin,
    FacultyStaffUserChangeForm,
    FacultyStaffUserCreationForm,
    StudentUserAdmin,
    StudentUserChangeForm,
    StudentUserCreationForm,
    get_department_choices,
    get_designation_choices,
)
from base.models import (
    NON_STUDENT_ROLES,
    FacultyResponsibility,
    FacultyStaffUser,
    StudentUser,
    User,
)
from student.models import Student
from tests import factories


class DummyAdminSite(AdminSite):
    pass


@pytest.fixture
def admin_site():
    return DummyAdminSite()


@pytest.fixture
def request_factory():
    return RequestFactory()


# =============================================================================
# A. Student User Tests & Regression Protection
# =============================================================================

@pytest.mark.django_db
def test_student_user_queryset_isolated():
    """StudentUser manager and queryset must only return student accounts."""
    s1 = factories.UserFactory(role="student")
    s2 = factories.UserFactory(role="student")
    f1 = factories.UserFactory(role="faculty")
    st1 = factories.UserFactory(role="staff")

    student_users = list(StudentUser.objects.all())
    assert s1 in student_users
    assert s2 in student_users
    assert f1 not in student_users
    assert st1 not in student_users


@pytest.mark.django_db
def test_student_user_creation_form_enforces_student_role():
    """StudentUserCreationForm must automatically enforce role='student'."""
    data = {
        "email": "fresh_student@example.test",
        "full_name": "Fresh Student",
        "password1": "SecurePass123!",
        "password2": "SecurePass123!",
    }
    form = StudentUserCreationForm(data=data)
    assert form.is_valid(), form.errors

    user = form.save()
    assert user.role == "student"
    assert user.email == "fresh_student@example.test"
    assert user.full_name == "Fresh Student"
    assert user.is_staff is False
    assert user.is_superuser is False
    assert user.check_password("SecurePass123!")
    # Student should not have faculty responsibility
    assert not FacultyResponsibility.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_student_user_change_form_preserves_password_and_role():
    """Editing student user profile via StudentUserChangeForm preserves credentials and student role."""
    user = factories.UserFactory(role="student", password="original-password")
    student = factories.StudentFactory(user=user, uid="2025-IT-001", department="IT", batch="2025")

    data = {
        "email": user.email,
        "full_name": "Updated Student Name",
        "password": user.password,
    }
    form = StudentUserChangeForm(data=data, instance=user)
    assert form.is_valid(), form.errors

    saved_user = form.save()
    assert saved_user.role == "student"
    assert saved_user.full_name == "Updated Student Name"
    assert saved_user.check_password("original-password")
    # Student profile remains intact
    assert saved_user.students.uid == "2025-IT-001"
    assert saved_user.students.department == "IT"


@pytest.mark.django_db
def test_student_user_admin_displays_academic_details(admin_site, request_factory):
    """StudentUserAdmin list and detail displays student profile attributes without error."""
    user = factories.UserFactory(role="student")
    student = factories.StudentFactory(
        user=user, uid="2025-CMPN-042", department="CMPN", batch="2025", academic_year="BE"
    )

    admin = StudentUserAdmin(StudentUser, admin_site)
    assert admin.get_student_uid(user) == "2025-CMPN-042"
    assert admin.get_student_department(user) == "CMPN"
    assert admin.get_student_batch(user) == "2025"
    assert admin.get_student_year(user) == "BE"


# =============================================================================
# B. Faculty & Staff Users Tests
# =============================================================================

@pytest.mark.django_db
def test_faculty_staff_user_queryset_isolated():
    """FacultyStaffUser manager and queryset must only return non-student accounts."""
    s = factories.UserFactory(role="student")
    f = factories.UserFactory(role="faculty")
    st = factories.UserFactory(role="staff")
    adm = factories.UserFactory(role="system_admin")

    staff_users = list(FacultyStaffUser.objects.all())
    assert s not in staff_users
    assert f in staff_users
    assert st in staff_users
    assert adm in staff_users


@pytest.mark.django_db
def test_faculty_staff_creation_form_saves_department_and_program():
    """FacultyStaffUserCreationForm saves user and creates FacultyResponsibility atomically."""
    data = {
        "email": "faculty_test@example.test",
        "full_name": "Prof. Alan Turing",
        "role": "faculty",
        "department": "CMPN",
        "program": "ACT_Technical",
        "password1": "FacultyPass123!",
        "password2": "FacultyPass123!",
        "is_staff": False,
        "is_superuser": False,
    }
    form = FacultyStaffUserCreationForm(data=data)
    assert form.is_valid(), form.errors

    user = form.save()
    assert user.role == "faculty"
    assert user.check_password("FacultyPass123!")
    assert user.is_staff is False
    assert user.is_superuser is False

    # Check FacultyResponsibility record
    resp = FacultyResponsibility.objects.filter(user=user).first()
    assert resp is not None
    assert resp.department == "CMPN"
    assert resp.program == "ACT_Technical"


@pytest.mark.django_db
def test_faculty_staff_creation_form_rejects_student_role():
    """FacultyStaffUserCreationForm must reject 'student' role."""
    data = {
        "email": "impostor@example.test",
        "full_name": "Not A Staff",
        "role": "student",
        "password1": "Pass1234!",
        "password2": "Pass1234!",
    }
    form = FacultyStaffUserCreationForm(data=data)
    assert not form.is_valid()
    assert "role" in form.errors


@pytest.mark.django_db
def test_faculty_staff_creation_supports_all_staff_roles():
    """All valid non-student roles can be created through the faculty/staff form."""
    for role_code, _ in NON_STUDENT_ROLES:
        data = {
            "email": f"user_{role_code}@example.test",
            "full_name": f"User {role_code}",
            "role": role_code,
            "department": "IT",
            "password1": "Password123!",
            "password2": "Password123!",
        }
        form = FacultyStaffUserCreationForm(data=data)
        assert form.is_valid(), f"Failed for role {role_code}: {form.errors}"
        user = form.save()
        assert user.role == role_code
        assert user.check_password("Password123!")


@pytest.mark.django_db
def test_faculty_staff_change_form_loads_and_updates_responsibility():
    """FacultyStaffUserChangeForm populates existing assignments and updates them without resetting password."""
    user = factories.UserFactory(role="faculty", password="initial-staff-pass")
    resp = factories.FacultyResponsibilityFactory(user=user, department="IT", program="SDP")

    # Change form initialization loads department and program
    form_init = FacultyStaffUserChangeForm(instance=user)
    assert form_init.fields["department"].initial == "IT"
    assert form_init.fields["program"].initial == "SDP"

    # Update department to EXTC and program to ACT_Aptitude
    data = {
        "email": user.email,
        "full_name": user.full_name,
        "role": "faculty",
        "password": user.password,
        "department": "EXTC",
        "program": "ACT_Aptitude",
        "is_staff": False,
        "is_superuser": False,
    }
    form = FacultyStaffUserChangeForm(data=data, instance=user)
    assert form.is_valid(), form.errors
    updated_user = form.save()

    # Password was not reset
    assert updated_user.check_password("initial-staff-pass")

    # FacultyResponsibility was updated, not duplicated
    responsibilities = FacultyResponsibility.objects.filter(user=updated_user)
    assert responsibilities.count() == 1
    updated_resp = responsibilities.first()
    assert updated_resp.department == "EXTC"
    assert updated_resp.program == "ACT_Aptitude"


@pytest.mark.django_db
def test_faculty_staff_change_form_rejects_student_role():
    """FacultyStaffUserChangeForm prevents changing a staff user into a student."""
    user = factories.UserFactory(role="faculty")
    data = {
        "email": user.email,
        "full_name": user.full_name,
        "role": "student",
        "password": user.password,
    }
    form = FacultyStaffUserChangeForm(data=data, instance=user)
    assert not form.is_valid()
    assert "role" in form.errors


# =============================================================================
# C. Admin Usability, Filters & Permission Tests
# =============================================================================

@pytest.mark.django_db
def test_custom_user_admin_disables_direct_add():
    """Generic CustomUserAdmin disables direct add to prevent workflow confusion."""
    admin_site = DummyAdminSite()
    admin = CustomUserAdmin(User, admin_site)
    req = RequestFactory().get("/admin/base/user/")
    assert admin.has_add_permission(req) is False


@pytest.mark.django_db
def test_faculty_staff_admin_list_display_and_filters(admin_site, request_factory):
    """FacultyStaffUserAdmin list_display renders departments, programs, and filters accurately."""
    u1 = factories.UserFactory(role="faculty", full_name="Prof One")
    factories.FacultyResponsibilityFactory(user=u1, department="IT", program="ACT_Technical")

    u2 = factories.UserFactory(role="training_officer", full_name="Officer Two")
    factories.FacultyResponsibilityFactory(user=u2, department="CMPN", program="SDP")

    admin = FacultyStaffUserAdmin(FacultyStaffUser, admin_site)
    assert admin.get_department(u1) == "IT"
    assert admin.get_program(u1) == "ACT_Technical"
    assert admin.get_department(u2) == "CMPN"
    assert admin.get_program(u2) == "SDP"

    # Test Department Filter
    req_it = request_factory.get("/admin/base/facultystaffuser/?department=IT")
    filter_it = FacultyStaffDepartmentFilter(
        req_it, req_it.GET.copy(), FacultyStaffUser, admin
    )
    qs_it = filter_it.queryset(req_it, FacultyStaffUser.objects.all())
    assert u1 in qs_it
    assert u2 not in qs_it

    # Test Program Filter
    req_sdp = request_factory.get("/admin/base/facultystaffuser/?program=SDP")
    filter_sdp = FacultyStaffProgramFilter(
        req_sdp, req_sdp.GET.copy(), FacultyStaffUser, admin
    )
    qs_sdp = filter_sdp.queryset(req_sdp, FacultyStaffUser.objects.all())
    assert u2 in qs_sdp
    assert u1 not in qs_sdp


@pytest.mark.django_db
def test_is_staff_not_automatically_granted():
    """Creating a faculty member does not automatically grant is_staff (admin access)."""
    data = {
        "email": "faculty_nostaff@example.test",
        "full_name": "Faculty No Staff",
        "role": "faculty",
        "department": "IT",
        "password1": "Pass1234!",
        "password2": "Pass1234!",
        "is_staff": False,
    }
    form = FacultyStaffUserCreationForm(data=data)
    assert form.is_valid(), form.errors
    user = form.save()
    assert user.is_staff is False
    assert user.is_superuser is False


@pytest.mark.django_db
def test_faculty_staff_designation_and_department_choices():
    """All 14 institutional departments and requested designations are available in dropdown choices."""
    dept_choices = [c[0] for c in get_department_choices()]
    for expected_dept in ["CS&E", "ES&H", "E&TC", "Civil", "IT", "Comp", "IOT", "M&ME", "Mech", "AI&ML", "AI&DS", "E&CS", "CA", "T&P"]:
        assert expected_dept in dept_choices, f"Department {expected_dept} missing from choices"

    desig_choices = [c[0] for c in get_designation_choices()]
    for expected_desig in [
        "Dean (Training, Placement & Industry Linkage)",
        "Dy. Training Officer",
        "Dy. Placement Officer",
        "Dy. Internship Officer",
        "Department Coordinator",
        "T&P Staff",
    ]:
        assert expected_desig in desig_choices, f"Designation {expected_desig} missing from choices"


@pytest.mark.django_db
def test_faculty_staff_creation_and_change_with_designation(admin_site, request_factory):
    """FacultyStaffUserCreationForm and FacultyStaffUserChangeForm correctly persist and update designation."""
    # Creation
    create_data = {
        "email": "dean_test@example.test",
        "full_name": "Dr. Zahir Aalam",
        "role": "faculty",
        "designation": "Dean (Training, Placement & Industry Linkage)",
        "department": "CS&E",
        "password1": "DeanPass123!",
        "password2": "DeanPass123!",
    }
    create_form = FacultyStaffUserCreationForm(data=create_data)
    assert create_form.is_valid(), create_form.errors
    user = create_form.save()

    resp = FacultyResponsibility.objects.filter(user=user).first()
    assert resp is not None
    assert resp.department == "CS&E"
    assert resp.designation == "Dean (Training, Placement & Industry Linkage)"

    admin = FacultyStaffUserAdmin(FacultyStaffUser, admin_site)
    assert admin.get_designation(user) == "Dean (Training, Placement & Industry Linkage)"
    assert admin.get_department(user) == "CS&E"

    # Change form loads initial designation
    change_form_init = FacultyStaffUserChangeForm(instance=user)
    assert change_form_init.fields["designation"].initial == "Dean (Training, Placement & Industry Linkage)"

    # Update designation
    update_data = {
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "password": user.password,
        "designation": "Department Coordinator",
        "department": "IT",
    }
    change_form = FacultyStaffUserChangeForm(data=update_data, instance=user)
    assert change_form.is_valid(), change_form.errors
    updated_user = change_form.save()

    updated_resp = FacultyResponsibility.objects.filter(user=updated_user).first()
    assert updated_resp.designation == "Department Coordinator"
    assert updated_resp.department == "IT"
    assert admin.get_designation(updated_user) == "Department Coordinator"

    # Test Designation Filter
    req = request_factory.get("/admin/base/facultystaffuser/?designation=Department+Coordinator")
    desig_filter = FacultyStaffDesignationFilter(req, req.GET.copy(), FacultyStaffUser, admin)
    filtered_qs = desig_filter.queryset(req, FacultyStaffUser.objects.all())
    assert updated_user in filtered_qs

