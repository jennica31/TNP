import os
import django
import pandas as pd

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from base.models import User, FacultyResponsibility

DEFAULT_SEED_PASSWORD = os.getenv("DEFAULT_SEED_PASSWORD", "tcet@1234")

df = pd.read_excel('TNP FAculty List.xlsx')

count = 0
for idx, row in df.iterrows():
    name = row.get('Unnamed: 4')
    designation = row.get('Unnamed: 5')
    email = row.get('Unnamed: 6')
    dept = row.get('Unnamed: 3')

    if pd.isna(name) or pd.isna(email) or str(email).strip() == 'Email-Id':
        continue

    # Determine role based on designation
    role = "faculty" # default for department coordinators
    desig_lower = str(designation).lower()
    if 'training officer' in desig_lower:
        role = 'training_officer'
    elif 'placement officer' in desig_lower:
        role = 'placement_officer'
    elif 'internship officer' in desig_lower:
        role = 'internship_officer'
    elif 'dean' in desig_lower:
        role = 'system_admin'

    user, created = User.objects.get_or_create(
        email=str(email).strip(),
        defaults={
            'full_name': str(name).strip(),
            'role': role,
            'is_staff': True
        }
    )
    
    if not created:
        user.role = role
        user.is_staff = True
        user.save()
        
    if not user.has_usable_password():
        user.set_password(DEFAULT_SEED_PASSWORD)
        user.save()

    dept_str = str(dept).strip() if pd.notna(dept) else None
    desig_str = str(designation).strip() if pd.notna(designation) else None

    resp, resp_created = FacultyResponsibility.objects.get_or_create(
        user=user,
        defaults={
            'department': dept_str,
            'designation': desig_str,
        }
    )
    if not resp_created:
        resp.department = dept_str
        if desig_str:
            resp.designation = desig_str
        resp.save()
    count += 1

print(f"Successfully imported and updated {count} faculty/staff members!")
