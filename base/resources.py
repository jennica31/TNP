import os
from django.db import transaction
from import_export import resources
from .models import FacultyResponsibility, User
from django.contrib.auth.hashers import make_password
from uuid import uuid4

DEFAULT_FACULTY_IMPORT_PASSWORD = os.getenv("DEFAULT_FACULTY_IMPORT_PASSWORD", "tcet@1234")


class FacultyResponsibilityResource(resources.ModelResource):
    class Meta:
        model = FacultyResponsibility
        fields = (
            "user",
            "designation",
            "program",
            "department",
        )
        import_id_fields = ("program", "department")

    def skip_row(self, instance, original, row, import_validation_errors=None):
        email = row.get("email")
        if not email or not str(email).strip():
            return True
        return super().skip_row(instance, original, row, import_validation_errors)

    def import_row(self, row, instance_loader, **kwargs):
        email = row.get("email")
        if not email or not str(email).strip():
            return super().import_row(row, instance_loader, **kwargs)

        email = str(email).strip()
        
        # Get existing or cached user
        user = getattr(self, "existing_users", {}).get(email) or getattr(self, "created_users_cache", {}).get(email)
        
        if not user:
            # We must create the user
            raw_password = row.get("password")
            if raw_password and str(raw_password).strip():
                hashed_password = make_password(str(raw_password).strip())
            else:
                hashed_password = make_password(DEFAULT_FACULTY_IMPORT_PASSWORD)
                
            user = User.objects.create(
                id=uuid4(),
                email=email,
                full_name=row.get("full_name", "") or "",
                password=hashed_password,
                role="faculty",
            )
            # Store in cache
            if not hasattr(self, "created_users_cache"):
                self.created_users_cache = {}
            self.created_users_cache[email] = user
            
        row["user"] = user.id

        # Set defaults for designation, program and department if not provided
        row["designation"] = row.get("designation", None)
        row["program"] = row.get("program", None)
        row["department"] = row.get("department", None)

        return super().import_row(row, instance_loader, **kwargs)

    def get_or_init_instance(self, instance_loader, row):
        # Ensure `user` field links correctly to an existing User
        instance, created = super().get_or_init_instance(instance_loader, row)
        if not created:
            email = str(row.get("email", "")).strip()
            user = getattr(self, "existing_users", {}).get(email) or getattr(self, "created_users_cache", {}).get(email)
            if not user and email:
                try:
                    user = User.objects.get(email=email)
                except User.DoesNotExist:
                    user = None
            if user:
                instance.user = user
        return instance, created

    @transaction.atomic
    def import_data(
        self,
        dataset,
        dry_run=False,
        raise_errors=False,
        use_transactions=None,
        collect_failed_rows=False,
        **kwargs,
    ):
        self.dry_run = dry_run
        
        # Pre-fetch existing users to avoid N+1 SELECT queries
        emails = []
        for row in dataset.dict:
            email = row.get("email")
            if email:
                emails.append(str(email).strip())
                
        self.existing_users = {
            user.email: user for user in User.objects.filter(email__in=emails)
        }
        self.created_users_cache = {}
        
        return super().import_data(
            dataset,
            dry_run,
            raise_errors,
            use_transactions,
            collect_failed_rows,
            **kwargs,
        )
