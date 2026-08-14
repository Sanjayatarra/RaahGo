# RaahGo Database ER Diagram

Below is the Entity-Relationship (ER) diagram reflecting the exact data structure of your Django database, including all models across your custom apps (`users`, `bookings`, `drivers`, `payments`, `vehicles`, etc.).

```mermaid
erDiagram
    Booking {
        UUID id
        Char booking_number
        ForeignKey customer_id
        ForeignKey driver_id
        ForeignKey service_id
        ForeignKey vehicle_type_id
        Char status
        Text pickup_address
        Text dropoff_address
        Decimal pickup_latitude
        Decimal pickup_longitude
        Decimal dropoff_latitude
        Decimal dropoff_longitude
        Decimal distance_km
        PositiveInteger estimated_duration_mins
        Decimal base_fare
        Decimal tax_amount
        Decimal discount_amount
        Decimal total_fare
        Char payment_status
        Char ride_pin
        DateTime created_at
        DateTime updated_at
    }
    RideDetail {
        UUID id
        OneToOne booking_id
        PositiveInteger passenger_count
        Text notes_for_driver
    }
    ParcelDetail {
        UUID id
        OneToOne booking_id
        Char receiver_name
        Char receiver_phone
        Decimal weight_kg
        Char parcel_type
        Text special_instructions
    }
    MovingDetail {
        UUID id
        OneToOne booking_id
        PositiveInteger helpers_count
        PositiveInteger pickup_floor
        PositiveInteger dropoff_floor
        Boolean has_elevator_pickup
        Boolean has_elevator_dropoff
        Text items_description
    }
    BookingTracking {
        UUID id
        ForeignKey booking_id
        Char status
        Text remarks
        DateTime created_at
    }
    Notification {
        UUID id
        ForeignKey user_id
        Char title
        Text body
        Char notification_type
        Boolean is_read
        JSON data_payload
        DateTime created_at
    }
    Payment {
        UUID id
        ForeignKey booking_id
        ForeignKey user_id
        Decimal amount
        Char payment_method
        Char transaction_id
        Char status
        DateTime paid_at
        DateTime created_at
    }
    Refund {
        UUID id
        ForeignKey payment_id
        Decimal amount
        Text reason
        Char status
        DateTime processed_at
        DateTime created_at
    }
    Service {
        UUID id
        Char name
        Char code
        Text description
        Char icon_url
        Boolean is_active
        DateTime created_at
        DateTime updated_at
    }
    DriverLocation {
        UUID id
        ForeignKey driver_id
        Decimal latitude
        Decimal longitude
        Decimal heading
        Decimal speed
        Boolean is_online
        DateTime updated_at
    }
    VehicleType {
        UUID id
        Char name
        Text description
        PositiveInteger capacity_passengers
        Decimal capacity_weight_kg
        Char icon_url
        Decimal base_fare
        Decimal per_km_rate
        Decimal per_minute_rate
        Boolean is_active
        DateTime created_at
        DateTime updated_at
    }
    Vehicle {
        UUID id
        ForeignKey driver_id
        ForeignKey vehicle_type_id
        Char registration_number
        Char make
        Char model
        PositiveInteger year
        Char color
        Boolean is_active
        Boolean is_approved
        DateTime created_at
        DateTime updated_at
    }
    User {
        UUID id
        Char username
        Char first_name
        Char last_name
        Char email
        Char phone_number
        Char password
        Char profile_image
        Char gender
        Date date_of_birth
        Char role
        Boolean is_active
        Boolean is_verified
        Boolean is_phone_verified
        Boolean is_email_verified
        DateTime last_login
        DateTime created_at
        DateTime updated_at
    }
    UserAddress {
        UUID id
        ForeignKey user_id
        Char title
        Char contact_name
        Char contact_phone
        Text address_line_1
        Text address_line_2
        Char landmark
        Char city
        Char state
        Char country
        Char postal_code
        Decimal latitude
        Decimal longitude
        Boolean is_default
        DateTime created_at
        DateTime updated_at
    }
    OTPVerification {
        UUID id
        ForeignKey user_id
        Char phone_number
        Char email
        Char otp
        Char purpose
        DateTime expires_at
        Integer attempts
        Boolean is_verified
        DateTime created_at
    }
    UserDevice {
        UUID id
        ForeignKey user_id
        Char device_type
        Text firebase_token
        Char app_version
        Char device_name
        DateTime last_active
        Boolean is_active
        DateTime created_at
    }
    Driver {
        UUID id
        OneToOne user_id
        Char license_number
        Date license_expiry
        PositiveInteger experience_years
        Decimal rating
        PositiveInteger total_trips
        Char approval_status
        Char availability_status
        Decimal current_latitude
        Decimal current_longitude
        DateTime last_location_update
        PositiveInteger daily_online_seconds
        DateTime last_online_start
        Date last_duty_reset_date
        DateTime created_at
        DateTime updated_at
    }
    DriverDocument {
        UUID id
        ForeignKey driver_id
        Char document_type
        Char document_number
        Char document_url
        Date expiry_date
        Char verification_status
        Text rejection_reason
        DateTime created_at
        DateTime updated_at
    }
    DriverBankAccount {
        UUID id
        ForeignKey driver_id
        Char account_holder_name
        Char account_number
        Char ifsc_code
        Char bank_name
        Boolean is_verified
        Boolean is_primary
        DateTime created_at
        DateTime updated_at
    }
    DriverEmergencyContact {
        UUID id
        ForeignKey driver_id
        Char name
        Char relationship
        Char phone_number
        DateTime created_at
    }
    Rating {
        UUID id
        ForeignKey booking_id
        ForeignKey reviewer_id
        ForeignKey reviewee_driver_id
        PositiveInteger rating
        Text comment
        DateTime created_at
    }
    Wallet {
        UUID id
        OneToOne user_id
        Decimal balance
        Char currency
        DateTime created_at
        DateTime updated_at
    }
    WalletTransaction {
        UUID id
        ForeignKey wallet_id
        Decimal amount
        Char transaction_type
        Char description
        Char reference_id
        DateTime created_at
    }
    Coupon {
        UUID id
        Char code
        Char discount_type
        Decimal discount_value
        Decimal max_discount_amount
        Decimal min_booking_amount
        DateTime valid_from
        DateTime valid_until
        PositiveInteger usage_limit
        PositiveInteger times_used
        Boolean is_active
        DateTime created_at
        DateTime updated_at
    }

    %% Relationships
    Booking }o--|| User : "customer"
    Booking }o--|| Driver : "driver"
    Booking }o--|| Service : "service"
    Booking }o--|| VehicleType : "vehicle_type"
    RideDetail ||--|| Booking : "booking"
    ParcelDetail ||--|| Booking : "booking"
    MovingDetail ||--|| Booking : "booking"
    BookingTracking }o--|| Booking : "booking"
    Notification }o--|| User : "user"
    Payment }o--|| Booking : "booking"
    Payment }o--|| User : "user"
    Refund }o--|| Payment : "payment"
    DriverLocation }o--|| Driver : "driver"
    Vehicle }o--|| Driver : "driver"
    Vehicle }o--|| VehicleType : "vehicle_type"
    UserAddress }o--|| User : "user"
    OTPVerification }o--|| User : "user"
    UserDevice }o--|| User : "user"
    Driver ||--|| User : "user"
    DriverDocument }o--|| Driver : "driver"
    DriverBankAccount }o--|| Driver : "driver"
    DriverEmergencyContact }o--|| Driver : "driver"
    Rating }o--|| Booking : "booking"
    Rating }o--|| User : "reviewer"
    Rating }o--|| Driver : "reviewee_driver"
    Wallet ||--|| User : "user"
    WalletTransaction }o--|| Wallet : "wallet"
```
