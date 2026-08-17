import getpass
import uuid
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from users.models import User


class Command(BaseCommand):
    help = 'Change password for a user by username, email, phone, or UUID'

    def add_arguments(self, parser):
        parser.add_argument('identifier', nargs='?', type=str, help='Username, Email, Phone, or User UUID')
        parser.add_argument('--role', type=str, help='Filter by role (e.g. Admin, Super Admin, Customer, Driver)')

    def handle(self, *args, **options):
        identifier = options.get('identifier')
        role = options.get('role')

        if not identifier:
            identifier = input('Username, Email, or Phone: ').strip()
            if not identifier:
                raise CommandError('Identifier cannot be empty.')

        # Build lookup query: check id (if valid UUID), username, email, or phone
        query = Q(username__iexact=identifier) | Q(email__iexact=identifier) | Q(phone_number=identifier)
        try:
            val_uuid = uuid.UUID(identifier)
            query |= Q(id=val_uuid)
        except ValueError:
            pass

        if role:
            query &= Q(role__iexact=role)

        users = list(User.objects.filter(query))

        if not users:
            raise CommandError(f'User with identifier "{identifier}" not found.')

        # If multiple users found across different roles (e.g. same email for Customer & Admin)
        if len(users) > 1:
            self.stdout.write(self.style.WARNING(f'Multiple accounts found for "{identifier}":'))
            for idx, u in enumerate(users, start=1):
                self.stdout.write(f'  [{idx}] {u.username} ({u.role}) - ID: {u.id}')
            choice = input(f'Select account (1-{len(users)}, default 1): ').strip()
            try:
                chosen_idx = int(choice) - 1 if choice else 0
                target_user = users[chosen_idx]
            except (ValueError, IndexError):
                raise CommandError('Invalid selection.')
        else:
            target_user = users[0]

        self.stdout.write(f'Changing password for: {target_user.username} ({target_user.role}) - Email: {target_user.email}')

        # Prompt for new password
        while True:
            p1 = getpass.getpass('New password: ')
            if len(p1) < 6:
                self.stdout.write(self.style.ERROR('Password must be at least 6 characters long.'))
                continue
            p2 = getpass.getpass('New password (again): ')
            if p1 != p2:
                self.stdout.write(self.style.ERROR('Passwords do not match. Try again.'))
                continue
            break

        target_user.password = p1
        target_user.save(update_fields=['password', 'updated_at'])

        self.stdout.write(
            self.style.SUCCESS(
                f'Password changed successfully for {target_user.username} ({target_user.role})!'
            )
        )
