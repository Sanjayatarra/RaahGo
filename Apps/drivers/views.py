import random
import uuid
from decimal import Decimal
from datetime import date, datetime
from pathlib import Path
from django.conf import settings
from django.core.files.storage import default_storage
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from users.models import User
from users.serializers import UserSerializer
from users.driver_auth_views import is_valid_email
from .models import Driver, DriverDocument, DriverBankAccount, DriverEmergencyContact, get_max_duty_seconds
from .serializers import (
    DriverSerializer,
    DriverDocumentSerializer,
    DriverBankAccountSerializer,
    DriverEmergencyContactSerializer
)

try:
    from PaddleOCR.main import extract_document
except ImportError:
    import sys
    from pathlib import Path
    parent_path = str(Path(__file__).resolve().parent.parent.parent.parent)
    if parent_path not in sys.path:
        sys.path.insert(0, parent_path)
    try:
        from PaddleOCR.main import extract_document
    except Exception as _e:
        print(f"[PaddleOCR Import Notice]: {_e}")
        extract_document = None


def validate_date_of_birth_18_years(dob_val):
    """
    Validates that date_of_birth is a valid date and the person is at least 18 years old.
    Returns (validated_date, error_message)
    """
    if not dob_val:
        return None, None

    if isinstance(dob_val, str):
        dob_str = dob_val.strip()
        if not dob_str:
            return None, None
        try:
            dob_date = datetime.strptime(dob_str, '%Y-%m-%d').date()
        except ValueError:
            return None, 'Invalid Date of Birth format. Please use YYYY-MM-DD.'
    elif isinstance(dob_val, date):
        dob_date = dob_val
    else:
        return None, 'Invalid Date of Birth.'

    today = date.today()
    if dob_date > today:
        return None, 'Date of Birth cannot be in the future.'

    age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
    if age < 18:
        return None, 'Captain must be at least 18 years old to register.'

    return dob_date, None


def parse_ocr_date(date_val):
    """Safely converts an OCR date string (e.g. '03-05-2041', '03/05/2041') into a datetime.date object."""
    if not date_val:
        return None
    if isinstance(date_val, date):
        return date_val
    if isinstance(date_val, str):
        clean_val = date_val.strip().replace('/', '-')
        for fmt in ('%d-%m-%Y', '%Y-%m-%d', '%d-%m-%y', '%m-%d-%Y'):
            try:
                return datetime.strptime(clean_val, fmt).date()
            except ValueError:
                pass
    return None


class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.all()
    serializer_class = DriverSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @action(detail=False, methods=['get'])
    def onboarding_profile(self, request):
        phone_number = (request.query_params.get('phone_number') or '').replace(' ', '').replace('-', '')
        email = request.query_params.get('email')
        users = User.objects.filter(role=User.RoleChoices.DRIVER)
        user = users.filter(phone_number=phone_number).first() if phone_number else None
        if not user and email:
            user = users.filter(email__iexact=email).first()
        if not user and hasattr(request, 'user') and request.user and request.user.is_authenticated:
            user = request.user

        if not user:
            return Response({'error': 'Captain profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        driver = Driver.objects.filter(user=user).first()
        if not driver:
            return Response({'error': 'Captain driver record not found.'}, status=status.HTTP_404_NOT_FOUND)

        vehicle = driver.vehicles.first() if driver else None

        doc_type_mapping = {
            DriverDocument.DocumentType.LICENSE: 'license',
            DriverDocument.DocumentType.RC: 'rc',
            DriverDocument.DocumentType.INSURANCE: 'insurance',
            DriverDocument.DocumentType.AADHAAR: 'aadhaar',
            DriverDocument.DocumentType.PHOTO: 'photo',
            DriverDocument.DocumentType.BACKGROUND_CHECK: 'aadhaar',
            DriverDocument.DocumentType.PERMIT: 'photo',
            'Aadhaar': 'aadhaar',
            'Photo': 'photo',
        }
        documents = {}
        for doc in (driver.documents.all() if driver else []):
            key = doc_type_mapping.get(doc.document_type, doc.document_type.lower().replace(' ', '_'))
            documents[key] = {
                'id': str(doc.id),
                'name': doc.document_url.split('/')[-1] if doc.document_url else doc.document_type,
                'url': doc.document_url,
                'status': doc.verification_status,
            }

        bank = DriverBankAccount.objects.filter(driver=driver).first() if driver else None
        emergency = DriverEmergencyContact.objects.filter(driver=driver).first() if driver else None

        completed_steps = [1, 2]
        if user.first_name and user.date_of_birth:
            completed_steps.append(3)
        if vehicle and vehicle.registration_number:
            completed_steps.extend([4, 5])
        if len(documents) >= 5 or ('license' in documents and 'rc' in documents):
            completed_steps.append(6)
        if bank and bank.account_number:
            completed_steps.append(7)
        if emergency and emergency.phone_number:
            completed_steps.append(8)
        if driver and driver.terms_accepted:
            completed_steps.append(9)
        if driver and driver.approval_status == Driver.ApprovalStatus.APPROVED:
            completed_steps.append(10)
            completed_steps.append(11)

        return Response({
            'user': UserSerializer(user).data,
            'approval_status': driver.approval_status if driver else 'Pending',
            'operating_address': driver.operating_address if driver else '',
            'service_city': driver.service_city if driver else '',
            'operating_pincode': driver.operating_pincode if driver else '',
            'terms_accepted': driver.terms_accepted if driver else False,
            'terms_accepted_at': driver.terms_accepted_at.strftime('%Y-%m-%d %H:%M:%S') if (driver and driver.terms_accepted_at) else None,
            'vehicle': {
                'category': vehicle.vehicle_type.name if vehicle and vehicle.vehicle_type else 'Sedan',
                'number': vehicle.registration_number if vehicle else '',
                'model': vehicle.model if vehicle else '',
                'fuel_type': vehicle.color if vehicle else 'CNG + Petrol',
            } if vehicle else None,
            'documents': documents,
            'bank': DriverBankAccountSerializer(bank).data if bank else None,
            'emergency_contact': DriverEmergencyContactSerializer(emergency).data if emergency else None,
            'completed_steps': completed_steps,
        })

    @action(detail=False, methods=['post'])
    def complete_captain_profile(self, request):
        step_raw = request.data.get('step')
        step = None
        if step_raw is not None:
            try:
                step = int(step_raw)
            except (ValueError, TypeError):
                step = None

        phone_number = request.data.get('phone_number')
        email = request.data.get('email')
        clean_phone = phone_number.replace(' ', '').replace('-', '') if phone_number else None

        if email:
            email = email.strip()
            if not is_valid_email(email):
                return Response(
                    {'error': 'Please enter a valid email address format (e.g. name@gmail.com).'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Validate date_of_birth if provided (must be at least 18 years old)
        raw_dob = request.data.get('date_of_birth')
        validated_dob = None
        if raw_dob:
            validated_dob, dob_err = validate_date_of_birth_18_years(raw_dob)
            if dob_err:
                return Response({'error': dob_err}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Resolve User and Driver
        user = None
        if clean_phone:
            user = User.objects.filter(phone_number=clean_phone, role=User.RoleChoices.DRIVER).first()
        if not user and email:
            user = User.objects.filter(email__iexact=email, role=User.RoleChoices.DRIVER).first()
        if not user and hasattr(request, 'user') and request.user and request.user.is_authenticated:
            user = request.user

        if not user:
            first_name = request.data.get('first_name', '')
            last_name = request.data.get('last_name', '')
            full_name = request.data.get('full_name') or request.data.get('name')
            if full_name and not (first_name or last_name):
                parts = full_name.strip().split(' ', 1)
                first_name = parts[0].strip()
                last_name = parts[1].strip() if len(parts) > 1 else ''

            base_uname = request.data.get('username') or f"captain_{random.randint(1000, 9999)}"
            final_uname = base_uname
            if User.objects.filter(username=final_uname, role=User.RoleChoices.DRIVER).exists():
                final_uname = f"{base_uname}_{random.randint(100, 999)}"

            user = User.objects.create(
                username=final_uname,
                email=email if email and not User.objects.filter(email__iexact=email, role=User.RoleChoices.DRIVER).exists() else None,
                phone_number=clean_phone if clean_phone and not User.objects.filter(phone_number=clean_phone, role=User.RoleChoices.DRIVER).exists() else None,
                role=User.RoleChoices.DRIVER,
                first_name=first_name or 'Captain',
                last_name=last_name or '',
                gender=request.data.get('gender', 'Male'),
                date_of_birth=validated_dob,
                is_verified=False,
                is_phone_verified=True
            )
        else:
            # If user already exists (e.g. registered via phone) and email is provided, link it
            if email and not user.email:
                clean_email = email.strip()
                if not User.objects.filter(email__iexact=clean_email, role=User.RoleChoices.DRIVER).exclude(id=user.id).exists():
                    user.email = clean_email
                    user.save(update_fields=['email'])

        driver = Driver.objects.filter(user=user).first()
        if not driver:
            license_number = request.data.get('license_number') or f"DL-{random.randint(10000, 99999)}"
            driver = Driver.objects.create(
                user=user,
                license_number=license_number,
                approval_status=Driver.ApprovalStatus.PENDING,
                availability_status=Driver.AvailabilityStatus.OFFLINE
            )

        # 2. Process Specific Step Chunk
        # --- Step 3: Basic Details Chunk ---
        if step == 3 or (step is None and (request.data.get('first_name') or request.data.get('full_name') or request.data.get('date_of_birth') or request.data.get('email'))):
            first_name = request.data.get('first_name')
            last_name = request.data.get('last_name')
            full_name = request.data.get('full_name') or request.data.get('name')
            if full_name and not (first_name or last_name):
                parts = full_name.strip().split(' ', 1)
                first_name = parts[0].strip()
                last_name = parts[1].strip() if len(parts) > 1 else ''

            if first_name: user.first_name = first_name
            if last_name: user.last_name = last_name
            if request.data.get('gender'): user.gender = request.data.get('gender')
            if validated_dob:
                user.date_of_birth = validated_dob

            if email:
                clean_email = email.strip()
                dup_email = User.objects.filter(email__iexact=clean_email, role=User.RoleChoices.DRIVER).exclude(id=user.id).exclude(email='').first()
                if dup_email:
                    return Response({'error': f'Email address "{clean_email}" is already registered to another Captain.'}, status=status.HTTP_400_BAD_REQUEST)
                user.email = clean_email

            username = request.data.get('username')
            if username and username != user.username:
                if not User.objects.filter(username=username, role=User.RoleChoices.DRIVER).exclude(id=user.id).exists():
                    user.username = username

            user.save()

        # --- Step 4: Service Selection Chunk ---
        if step == 4:
            # Service selection chunk acknowledged
            pass

        # --- Step 5: Vehicle Details Chunk ---
        if step == 5 or (step is None and request.data.get('vehicle_number')):
            vehicle_number = (request.data.get('vehicle_number') or '').strip().upper().replace(' ', '')
            vehicle_category = request.data.get('vehicle_category')
            vehicle_model = request.data.get('vehicle_model')
            fuel_type = request.data.get('fuel_type') or ''

            if not vehicle_number:
                return Response({'error': 'Please enter a valid vehicle registration number.'}, status=status.HTTP_400_BAD_REQUEST)
            if not vehicle_category:
                return Response({'error': 'Please select a vehicle category.'}, status=status.HTTP_400_BAD_REQUEST)

            from vehicles.models import Vehicle, VehicleType

            # Check if this registration number is already registered to another driver
            existing_veh = Vehicle.objects.filter(registration_number__iexact=vehicle_number).exclude(driver=driver).first()
            if existing_veh:
                return Response(
                    {'error': f'Vehicle registration number "{vehicle_number}" is already registered to another Captain.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            vtype = VehicleType.objects.filter(name__iexact=vehicle_category).first() or VehicleType.objects.first()
            if not vtype:
                return Response({'error': f'Vehicle type "{vehicle_category}" is not configured in settings.'}, status=status.HTTP_400_BAD_REQUEST)

            make = vehicle_model.split(' ')[0] if vehicle_model and ' ' in vehicle_model else (vehicle_model or '')
            model = ' '.join(vehicle_model.split(' ')[1:]) if vehicle_model and ' ' in vehicle_model else (vehicle_model or '')

            try:
                veh = Vehicle.objects.filter(driver=driver).first()
                if not veh:
                    veh = Vehicle.objects.filter(registration_number__iexact=vehicle_number).first()

                if veh:
                    veh.driver = driver
                    veh.registration_number = vehicle_number
                    veh.vehicle_type = vtype
                    veh.make = make or 'Standard'
                    veh.model = model or make or 'Standard'
                    veh.color = fuel_type
                    veh.year = 2024
                    veh.is_active = False
                    veh.is_approved = False
                    veh.save()
                    Vehicle.objects.filter(driver=driver).exclude(id=veh.id).delete()
                else:
                    Vehicle.objects.create(
                        driver=driver,
                        registration_number=vehicle_number,
                        vehicle_type=vtype,
                        make=make or 'Standard',
                        model=model or make or 'Standard',
                        color=fuel_type,
                        year=2024,
                        is_active=False,
                        is_approved=False
                    )
            except Exception as e:
                return Response({'error': f'Unable to save vehicle details: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # --- Step 6: Documents Upload Chunk ---
        if step == 6 or (step is None and request.FILES):
            document_types = {
                'document_license': DriverDocument.DocumentType.LICENSE,
                'document_rc': DriverDocument.DocumentType.RC,
                'document_insurance': DriverDocument.DocumentType.INSURANCE,
                'document_aadhaar': DriverDocument.DocumentType.AADHAAR,
                'document_photo': DriverDocument.DocumentType.PHOTO,
            }
            for field_name, document_type in document_types.items():
                uploaded_file = request.FILES.get(field_name)
                if not uploaded_file:
                    continue
                extension = Path(uploaded_file.name).suffix.lower()
                if extension not in {'.pdf', '.jpg', '.jpeg', '.png', '.webp'}:
                    return Response({'error': f'Unsupported file type for {field_name}.'}, status=status.HTTP_400_BAD_REQUEST)
                if uploaded_file.size > 10 * 1024 * 1024:
                    return Response({'error': f'{field_name} must be 10 MB or smaller.'}, status=status.HTTP_400_BAD_REQUEST)

                # Clean up previous file for this document type to avoid disk duplication
                old_doc = DriverDocument.objects.filter(driver=driver, document_type=document_type).first()
                if old_doc and old_doc.document_url:
                    try:
                        media_prefix = getattr(settings, 'MEDIA_URL', '/media/')
                        old_rel_path = old_doc.document_url.split(media_prefix)[-1] if media_prefix in old_doc.document_url else old_doc.document_url.split('/media/')[-1]
                        if default_storage.exists(old_rel_path):
                            default_storage.delete(old_rel_path)
                    except Exception:
                        pass

                storage_path = default_storage.save(
                    f'driver_documents/{driver.id}/{document_type}/{uploaded_file.name}',
                    uploaded_file,
                )
                document_url = request.build_absolute_uri(default_storage.url(storage_path))
                
                doc_number = None
                parsed_expiry = None

                if extract_document and document_type != 'Photo': 
                    try:
                        local_doc_path = default_storage.path(storage_path)
                        result = extract_document(local_doc_path, document_type)
                        print(f"[PaddleOCR Extracted for {document_type}]:", result)
                        
                        if isinstance(result, dict):
                            doc_number = result.get('DocsNo') or result.get('aadhaar_number') or result.get('License No.')
                            raw_expiry = result.get('ExpireyDate') or result.get('Date of Expiry')
                            parsed_expiry = parse_ocr_date(raw_expiry)
                        elif isinstance(result, (list, tuple)):
                            doc_number = result[0] if len(result) > 0 else None
                            raw_expiry = result[2] if len(result) > 2 else None
                            parsed_expiry = parse_ocr_date(raw_expiry)
                    except Exception as ocr_err:
                        print(f"[PaddleOCR extraction note for {document_type}]: {ocr_err}")

                doc_defaults = {
                    'document_url': document_url,
                    'verification_status': DriverDocument.VerificationStatus.PENDING,
                }
                if doc_number:
                    doc_defaults['document_number'] = str(doc_number).strip()
                if parsed_expiry:
                    doc_defaults['expiry_date'] = parsed_expiry

                doc, _ = DriverDocument.objects.update_or_create(
                    driver=driver,
                    document_type=document_type,
                    defaults=doc_defaults,
                )
                # Ensure no other duplicate records exist for this document type
                DriverDocument.objects.filter(driver=driver, document_type=document_type).exclude(id=doc.id).delete()

        # --- Step 7: Bank Details Chunk ---
        if step == 7 or (step is None and request.data.get('account_number')):
            account_number = request.data.get('account_number')
            account_holder_name = request.data.get('account_holder_name') or f"{user.first_name} {user.last_name}".strip()
            bank_name = request.data.get('bank_name')
            ifsc_code = request.data.get('ifsc_code')

            passbook_file = request.FILES.get('passbook_image') or request.FILES.get('passbook_photo') or request.FILES.get('passbook')
            passbook_url = None
            if passbook_file:
                ext = Path(passbook_file.name).suffix.lower()
                if ext in {'.pdf', '.jpg', '.jpeg', '.png', '.webp'} and passbook_file.size <= 10 * 1024 * 1024:
                    old_bank = DriverBankAccount.objects.filter(driver=driver).first()
                    if old_bank and old_bank.passbook_image:
                        try:
                            media_prefix = getattr(settings, 'MEDIA_URL', '/media/')
                            old_rel_path = old_bank.passbook_image.split(media_prefix)[-1] if media_prefix in old_bank.passbook_image else old_bank.passbook_image.split('/media/')[-1]
                            if default_storage.exists(old_rel_path):
                                default_storage.delete(old_rel_path)
                        except Exception:
                            pass

                    storage_path = default_storage.save(
                        f'driver_passbooks/{driver.id}/{passbook_file.name}',
                        passbook_file,
                    )
                    passbook_url = request.build_absolute_uri(default_storage.url(storage_path))

            if account_number and bank_name and ifsc_code:
                bank_acc = DriverBankAccount.objects.filter(driver=driver).first()
                if bank_acc:
                    bank_acc.account_number = account_number
                    bank_acc.account_holder_name = account_holder_name
                    bank_acc.ifsc_code = ifsc_code
                    bank_acc.bank_name = bank_name
                    if passbook_url:
                        bank_acc.passbook_image = passbook_url
                    bank_acc.is_verified = False
                    bank_acc.is_primary = True
                    bank_acc.save()
                    DriverBankAccount.objects.filter(driver=driver).exclude(id=bank_acc.id).delete()
                else:
                    DriverBankAccount.objects.create(
                        driver=driver,
                        account_number=account_number,
                        account_holder_name=account_holder_name,
                        ifsc_code=ifsc_code,
                        bank_name=bank_name,
                        passbook_image=passbook_url,
                        is_verified=False,
                        is_primary=True
                    )

        # --- Step 8: Emergency Contact Chunk ---
        if step == 8 or (step is None and (request.data.get('emergency_name') or request.data.get('emergency_phone'))):
            emergency_name = request.data.get('emergency_name')
            emergency_relation = request.data.get('emergency_relation')
            emergency_phone = request.data.get('emergency_phone')

            if emergency_name and emergency_phone:
                contact = DriverEmergencyContact.objects.filter(driver=driver).first()
                if contact:
                    contact.name = emergency_name
                    contact.relationship = emergency_relation or ''
                    contact.phone_number = emergency_phone
                    contact.save()
                    DriverEmergencyContact.objects.filter(driver=driver).exclude(id=contact.id).delete()
                else:
                    DriverEmergencyContact.objects.create(
                        driver=driver,
                        name=emergency_name,
                        relationship=emergency_relation or '',
                        phone_number=emergency_phone
                    )

        # --- Step 9: Terms Accepted & GPS Location Capture Chunk ---
        if step == 9 or request.data.get('terms_agreed'):
            terms_agreed = request.data.get('terms_agreed')
            all_agreed = False
            if isinstance(terms_agreed, dict):
                all_agreed = bool(
                    terms_agreed.get('partnerAgreement') and
                    terms_agreed.get('safetyPolicy') and
                    terms_agreed.get('zeroTolerance')
                )
            elif terms_agreed is True or terms_agreed == 'true':
                all_agreed = True

            if step == 9 and not all_agreed:
                return Response(
                    {'error': 'Please accept all 3 partner terms and conditions before proceeding.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if all_agreed:
                driver.terms_accepted = True
                driver.terms_accepted_at = timezone.now()
                driver.save(update_fields=['terms_accepted', 'terms_accepted_at'])
                print(f"[TERMS ACCEPTED IN DB]: Driver {driver.id} agreed to all 3 conditions at {driver.terms_accepted_at}")

        lat = request.data.get('latitude')
        lon = request.data.get('longitude')
        if lat is not None and lon is not None:
            try:
                lat_f = float(lat)
                lon_f = float(lon)
                driver.current_latitude = lat_f
                driver.current_longitude = lon_f
                driver.last_location_update = timezone.now()
                driver.save(update_fields=['current_latitude', 'current_longitude', 'last_location_update'])

                from tracking.models import DriverLocation
                loc = DriverLocation.objects.filter(driver=driver).first()
                if loc:
                    loc.latitude = lat_f
                    loc.longitude = lon_f
                    loc.is_online = driver.availability_status == Driver.AvailabilityStatus.ONLINE
                    loc.save()
                    DriverLocation.objects.filter(driver=driver).exclude(id=loc.id).delete()
                else:
                    DriverLocation.objects.create(
                        driver=driver,
                        latitude=lat_f,
                        longitude=lon_f,
                        is_online=driver.availability_status == Driver.AvailabilityStatus.ONLINE
                    )
                print(f"[GPS LOCATION SAVED TO DB]: Lat={lat_f}, Lon={lon_f} for Driver ID={driver.id}")
            except (ValueError, TypeError) as e:
                print(f"GPS parsing note: {e}")

        # --- Step 10: Admin Verification Chunk ---
        if step == 10:
            driver.approval_status = Driver.ApprovalStatus.PENDING
            driver.save(update_fields=['approval_status'])

        # --- Step 12: Final Launch Chunk ---
        if step == 12:
            if driver.approval_status == Driver.ApprovalStatus.APPROVED:
                driver.availability_status = Driver.AvailabilityStatus.ONLINE
                driver.save(update_fields=['availability_status'])

        print(f"\n==========================================")
        print(f"[DJANGO BACKEND CHUNK SAVED: Step {step}]")
        print(f"Captain User: {user.first_name} {user.last_name} ({user.id})")
        print(f"Driver ID: {driver.id}")
        print(f"Phone: {user.phone_number}")
        print(f"Approval Status: {driver.approval_status}")
        print(f"==========================================\n")

        return Response({
            'status': f'Step {step} chunk saved successfully.',
            'step': step,
            'driver_id': str(driver.id),
            'user_id': str(user.id),
            'user': UserSerializer(user).data,
            'approval_status': driver.approval_status,
            'documents': DriverDocumentSerializer(driver.documents.all(), many=True).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def toggle_availability(self, request, pk=None):
        driver = self.get_object()
        raw_status = request.data.get('status') or request.data.get('availability_status') or ''
        # Standardize title-case e.g. 'online' -> 'Online'
        new_status = raw_status.strip().title() if isinstance(raw_status, str) else raw_status
        from django.utils import timezone
        today = timezone.now().date()

        # Reset daily duty tracking if new date
        if driver.last_duty_reset_date != today:
            driver.daily_online_seconds = 0
            driver.last_duty_reset_date = today
            driver.last_online_start = None
            driver.save()

        # Enforce dynamic Daily Shift Limit from DB SystemSetting
        max_duty_sec = get_max_duty_seconds()
        max_duty_hours = max_duty_sec / 3600

        if new_status == Driver.AvailabilityStatus.ONLINE:
            from .driver_api_views import check_driver_can_go_online
            can_go_online, block_reason = check_driver_can_go_online(driver)
            if not can_go_online:
                return Response({
                    'error': f'Cannot go online: {block_reason}',
                    'approval_status': driver.approval_status,
                    'is_online': False
                }, status=status.HTTP_403_FORBIDDEN)

            current_duty_sec = driver.get_current_daily_online_seconds()
            # Check accumulated duty seconds for today
            if current_duty_sec >= max_duty_sec:
                driver.availability_status = Driver.AvailabilityStatus.OFFLINE
                driver.last_online_start = None
                driver.save()
                return Response({
                    'error': f'Daily {int(max_duty_hours)}-hour online shift limit reached for today. Maximum {int(max_duty_hours)} hours online per day permitted. Please rest until tomorrow.',
                    'current_daily_online_seconds': current_duty_sec,
                    'max_duty_seconds': max_duty_sec
                }, status=status.HTTP_400_BAD_REQUEST)

            # Pick and save rider's / driver's current location to DB
            lat = request.data.get('latitude') or request.data.get('lat') or request.query_params.get('driver_lat') or request.query_params.get('lat')
            lon = request.data.get('longitude') or request.data.get('lng') or request.data.get('lon') or request.query_params.get('driver_lng') or request.query_params.get('lng')
            heading = request.data.get('heading', 0)
            speed = request.data.get('speed', 0)

            if lat is not None and lon is not None:
                try:
                    lat_f = round(Decimal(str(lat)), 7)
                    lon_f = round(Decimal(str(lon)), 7)
                    driver.current_latitude = lat_f
                    driver.current_longitude = lon_f
                    driver.last_location_update = timezone.now()

                    from tracking.models import DriverLocation
                    DriverLocation.objects.update_or_create(
                        driver=driver,
                        defaults={
                            'latitude': lat_f,
                            'longitude': lon_f,
                            'heading': Decimal(str(heading)),
                            'speed': Decimal(str(speed)),
                            'is_online': True
                        }
                    )
                except Exception:
                    pass
            elif driver.current_latitude and driver.current_longitude:
                try:
                    from tracking.models import DriverLocation
                    DriverLocation.objects.update_or_create(
                        driver=driver,
                        defaults={
                            'latitude': driver.current_latitude,
                            'longitude': driver.current_longitude,
                            'heading': Decimal(str(heading)),
                            'speed': Decimal(str(speed)),
                            'is_online': True
                        }
                    )
                except Exception:
                    pass

            driver.last_online_start = timezone.now()
            driver.availability_status = Driver.AvailabilityStatus.ONLINE
            driver.save()
            return Response({
                'status': 'Driver availability set to Online',
                'is_online': True,
                'is_available': True,
                'latitude': float(driver.current_latitude) if driver.current_latitude else None,
                'longitude': float(driver.current_longitude) if driver.current_longitude else None,
                'current_daily_online_seconds': driver.get_current_daily_online_seconds(),
                'max_duty_seconds': max_duty_sec
            }, status=status.HTTP_200_OK)

        elif new_status == Driver.AvailabilityStatus.OFFLINE:
            if driver.last_online_start:
                midnight_today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
                effective_start = max(driver.last_online_start, midnight_today)
                elapsed = int((timezone.now() - effective_start).total_seconds())
                driver.daily_online_seconds = min(max_duty_sec, driver.daily_online_seconds + max(0, elapsed))
                driver.last_online_start = None

            driver.availability_status = Driver.AvailabilityStatus.OFFLINE
            driver.save()

            try:
                from tracking.models import DriverLocation
                DriverLocation.objects.filter(driver=driver).update(is_online=False)
            except Exception:
                pass

            return Response({
                'status': 'Driver availability set to Offline',
                'is_online': False,
                'is_available': False,
                'current_daily_online_seconds': driver.get_current_daily_online_seconds(),
                'max_duty_seconds': max_duty_sec
            }, status=status.HTTP_200_OK)

        if new_status in [choice[0] for choice in Driver.AvailabilityStatus.choices]:
            driver.availability_status = new_status
            driver.save()
            return Response({'status': f'Driver availability set to {new_status}'}, status=status.HTTP_200_OK)
        return Response({'error': 'Invalid availability status'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def update_approval(self, request, pk=None):
        driver = self.get_object()
        new_status = request.data.get('status')
        if new_status in [choice[0] for choice in Driver.ApprovalStatus.choices]:
            driver.approval_status = new_status
            driver.save()
            return Response({'status': f'Driver approval status updated to {new_status}'}, status=status.HTTP_200_OK)
        return Response({'error': 'Invalid approval status'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def update_location(self, request, pk=None):
        driver = self.get_object()
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')

        if latitude is not None and longitude is not None:
            from django.utils import timezone
            from tracking.models import DriverLocation

            today = timezone.now().date()
            if driver.last_duty_reset_date != today:
                driver.daily_online_seconds = 0
                driver.last_duty_reset_date = today

            current_duty_sec = driver.get_current_daily_online_seconds()
            max_duty_sec = get_max_duty_seconds()

            # Auto force OFFLINE if max duty hours reached
            if current_duty_sec >= max_duty_sec and driver.availability_status == Driver.AvailabilityStatus.ONLINE:
                driver.availability_status = Driver.AvailabilityStatus.OFFLINE

            lat_val = round(float(latitude), 7)
            lng_val = round(float(longitude), 7)

            driver.current_latitude = lat_val
            driver.current_longitude = lng_val
            driver.last_location_update = timezone.now()
            driver.save()

            # Save in DriverLocation database table
            loc_obj, created = DriverLocation.objects.update_or_create(
                driver=driver,
                defaults={
                    'latitude': lat_val,
                    'longitude': lng_val,
                    'is_online': (driver.availability_status == Driver.AvailabilityStatus.ONLINE or driver.availability_status == Driver.AvailabilityStatus.IN_TRIP),
                    'heading': request.data.get('heading', 0.0),
                    'speed': request.data.get('speed', 0.0)
                }
            )

            return Response({
                'status': 'Driver GPS location updated and saved to DriverLocation table successfully',
                'driver_id': str(driver.id),
                'latitude': driver.current_latitude,
                'longitude': driver.current_longitude,
                'is_online': loc_obj.is_online,
                'current_daily_online_seconds': current_duty_sec,
                'max_duty_seconds': max_duty_sec,
                'updated_at': driver.last_location_update
            }, status=status.HTTP_200_OK)
        return Response({'error': 'latitude and longitude are required'}, status=status.HTTP_400_BAD_REQUEST)


class DriverDocumentViewSet(viewsets.ModelViewSet):
    queryset = DriverDocument.objects.all()
    serializer_class = DriverDocumentSerializer


class DriverBankAccountViewSet(viewsets.ModelViewSet):
    queryset = DriverBankAccount.objects.all()
    serializer_class = DriverBankAccountSerializer


class DriverEmergencyContactViewSet(viewsets.ModelViewSet):
    queryset = DriverEmergencyContact.objects.all()
    serializer_class = DriverEmergencyContactSerializer
