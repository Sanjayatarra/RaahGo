import getpass
import re
import uuid
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from users.models import User


class Command(BaseCommand):
    help = 'Create a Super Admin user in RaahGo with verified email and details'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, help='Admin email address')
        parser.add_argument('--username', type=str, help='Admin username')
        parser.add_argument('--phone', type=str, help='Admin phone number')
        parser.add_argument('--password', type=str, help='Admin password')

    def handle(self, *args, **options):
        email = options.get('email')
        username = options.get('username')
        phone = options.get('phone')
        password = options.get('password')

        # ── 1. Validate & Prompt Email ──
        if email:
            try:
                validate_email(email)
            except ValidationError:
                raise CommandError(f'"{email}" is not a valid email address.')
            if User.objects.filter(email__iexact=email, role=User.RoleChoices.SUPER_ADMIN).exists():
                raise CommandError(f'A Super Admin with email "{email}" already exists.')
        else:
            while True:
                val = input('Email address: ').strip()
                if not val:
                    self.stdout.write(self.style.ERROR('Email address cannot be empty.'))
                    continue
                try:
                    validate_email(val)
                except ValidationError:
                    self.stdout.write(self.style.ERROR(f'"{val}" is not a valid email (e.g. admin@raahgo.in). Try again.'))
                    continue
                if User.objects.filter(email__iexact=val, role=User.RoleChoices.SUPER_ADMIN).exists():
                    self.stdout.write(self.style.ERROR(f'A Super Admin with email "{val}" already exists.'))
                    continue
                email = val
                break

        # ── 2. Validate & Prompt Username ──
        if not username:
            default_username = email.split('@')[0]
            val = input(f'Username (default "{default_username}"): ').strip()
            username = val if val else default_username

        # ── 3. Validate & Prompt Phone ──
        if not phone:
            while True:
                val = input('Phone number (optional, e.g. +919876543210): ').strip()
                if not val:
                    phone = None
                    break
                # Clean and check digits
                cleaned = re.sub(r'[\s\-]', '', val)
                if not re.match(r'^\+?[0-9]{10,15}$', cleaned):
                    self.stdout.write(self.style.ERROR('Invalid phone number format. Must be 10-15 digits. Try again.'))
                    continue
                phone = cleaned
                break

        # ── 4. Validate & Prompt Password ──
        if not password:
            while True:
                p1 = getpass.getpass('Password: ')
                if len(p1) < 6:
                    self.stdout.write(self.style.ERROR('Password must be at least 6 characters long.'))
                    continue
                p2 = getpass.getpass('Password (again): ')
                if p1 != p2:
                    self.stdout.write(self.style.ERROR('Passwords do not match. Try again.'))
                    continue
                password = p1
                break

        # ── 5. Create Super Admin User ──
        user = User.objects.create(
            id=uuid.uuid4(),
            email=email,
            username=username,
            phone_number=phone,
            password=password,
            role=User.RoleChoices.SUPER_ADMIN,
            is_active=True,
            is_verified=True,
            is_email_verified=True,
            is_phone_verified=bool(phone),
        )

        self.stdout.write(
            self.style.SUCCESS(
                f'\nSuper Admin created successfully!\n'
                f'  ID:       {user.id}\n'
                f'  Email:    {user.email}\n'
                f'  Username: {user.username}\n'
                f'  Role:     {user.role}'
            )
        )
