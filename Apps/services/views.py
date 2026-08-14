import os
import requests
import math
from rest_framework import viewsets, status
from rest_framework.decorators import action, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import Service
from .serializers import ServiceSerializer

INDIA_BBOX = '68.1,6.5,97.4,35.5'


def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = (math.sin(dLat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.filter(is_active=True)
    serializer_class = ServiceSerializer
    permission_classes = [AllowAny]

    # 1. Backend Autocomplete Location Search API Endpoint (India Only, Proximity Biased)
    @action(detail=False, methods=['get'], url_path='location/search', permission_classes=[AllowAny])
    def location_search(self, request):
        query = request.query_params.get('q', '').strip()
        if not query or len(query) < 1:
            return Response([], status=status.HTTP_200_OK)

        user_lat = request.query_params.get('lat')
        user_lon = request.query_params.get('lon')

        headers = {'User-Agent': 'RaahGo-Location-Service/1.0 (India)'}
        results = []

        try:
            url = f"https://photon.komoot.io/api/?q={query}&limit=12&bbox={INDIA_BBOX}&lang=en"
            if user_lat and user_lon:
                url += f"&lat={user_lat}&lon={user_lon}"

            resp = requests.get(url, headers=headers, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                features = data.get('features', [])
                indian_features = [
                    f for f in features
                    if f.get('properties', {}).get('countrycode', '').upper() == 'IN' or
                       'india' in f.get('properties', {}).get('country', '').lower()
                ]

                list_to_map = indian_features

                for f in list_to_map:
                    props = f.get('properties', {})
                    title = props.get('name') or props.get('street') or props.get('district') or props.get('city') or query
                    city = props.get('city') or props.get('county') or props.get('district') or props.get('state') or ''

                    parts = [
                        props.get('street'),
                        props.get('district') or props.get('suburb') or props.get('locality'),
                        props.get('city') or props.get('county') or props.get('state'),
                        'India'
                    ]
                    filtered_parts = [p for p in parts if p and p.lower() != title.lower()]
                    subtitle = ', '.join(filtered_parts) or 'India'

                    coords = f.get('geometry', {}).get('coordinates', [])
                    dist_km = 99999

                    if user_lat and user_lon and len(coords) == 2:
                        try:
                            dist_km = calculate_distance(float(user_lat), float(user_lon), coords[1], coords[0])
                        except Exception:
                            pass

                    # max_radius km restriction
                    radius_str = os.getenv('LOCATION_SUGGESTION_RADIUS_KM', '50')
                    try:
                        max_radius = float(radius_str)
                    except ValueError:
                        max_radius = 50.0

                    if user_lat and user_lon and dist_km > max_radius:
                        continue

                    # Determine icon & tag
                    osm_val = str(props.get('osm_value', '')).lower()
                    osm_key = str(props.get('osm_key', '')).lower()
                    icon = '📍'
                    tag = props.get('osm_value') or props.get('osm_key') or 'Location'

                    if 'airport' in osm_val or 'airport' in title.lower():
                        icon = '✈️'
                        tag = 'Airport'
                    elif 'station' in osm_val or 'railway' in osm_val or 'station' in title.lower():
                        icon = '🚆'
                        tag = 'Transit'
                    elif 'bus' in osm_val or 'terminal' in osm_val:
                        icon = '🚌'
                        tag = 'Bus Stand'
                    elif 'university' in osm_val or 'school' in osm_val or 'college' in osm_val:
                        icon = '🎓'
                        tag = 'Education'
                    elif 'mall' in osm_val or 'supermarket' in osm_val or 'shop' in osm_val:
                        icon = '🛍️'
                        tag = 'Shopping'
                    elif 'hospital' in osm_val or 'clinic' in osm_val:
                        icon = '🏥'
                        tag = 'Medical'
                    elif 'restaurant' in osm_val or 'cafe' in osm_val or 'food' in osm_val:
                        icon = '🍽️'
                        tag = 'Food'
                    elif 'building' in osm_key or 'office' in osm_val:
                        icon = '🏢'
                        tag = 'Commercial'
                    elif props.get('city') or props.get('town'):
                        icon = '🏙️'
                        tag = 'City'

                    results.append({
                        'title': title,
                        'subtitle': subtitle,
                        'icon': icon,
                        'tag': tag,
                        'city': city,
                        'distanceKm': dist_km,
                        'coordinates': coords
                    })
        except Exception as e:
            print(f"[Backend Location Photon Search Error]: {e}")

        # Fallback to OpenStreetMap Nominatim if Photon returns no results
        if not results:
            try:
                nom_url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&addressdetails=1&limit=10&countrycodes=in"
                nom_resp = requests.get(nom_url, headers=headers, timeout=5)
                if nom_resp.status_code == 200:
                    nom_data = nom_resp.json()
                    for item in nom_data:
                        display = item.get('display_name', '')
                        parts = display.split(',')
                        title = parts[0].strip() if parts else display
                        subtitle = ', '.join([p.strip() for p in parts[1:4]]) if len(parts) > 1 else 'India'

                        item_lat = float(item.get('lat', 0))
                        item_lon = float(item.get('lon', 0))
                        dist_km = 99999

                        if user_lat and user_lon:
                            try:
                                dist_km = calculate_distance(float(user_lat), float(user_lon), item_lat, item_lon)
                            except Exception:
                                pass

                        # max_radius km restriction
                        radius_str = os.getenv('LOCATION_SUGGESTION_RADIUS_KM', '50')
                        try:
                            max_radius = float(radius_str)
                        except ValueError:
                            max_radius = 50.0

                        if user_lat and user_lon and dist_km > max_radius:
                            continue

                        icon = '✈️' if item.get('type') == 'aeroway' else '🚆' if item.get('type') == 'railway' else '📍'

                        results.append({
                            'title': title,
                            'subtitle': subtitle,
                            'icon': icon,
                            'tag': item.get('type', 'Location'),
                            'city': 'India',
                            'distanceKm': dist_km,
                            'coordinates': [item_lon, item_lat]
                        })
            except Exception as e:
                print(f"[Backend Location Nominatim Search Error]: {e}")

        results.sort(key=lambda x: x['distanceKm'])
        return Response(results[:6], status=status.HTTP_200_OK)

    # 2. Backend Reverse Geocoding API Endpoint
    @action(detail=False, methods=['get'], url_path='location/reverse', permission_classes=[AllowAny])
    def location_reverse(self, request):
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon')

        if not lat or not lon:
            return Response({'error': 'lat and lon are required'}, status=status.HTTP_400_BAD_REQUEST)

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 RaahGo/2.0'
        }
        formatted_address = None

        # 1. Primary: Nominatim Reverse Geocoding
        try:
            url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json&addressdetails=1&zoom=18"
            resp = requests.get(url, headers=headers, timeout=5)

            if resp.status_code == 200:
                data = resp.json()
                addr = data.get('address', {})
                road = (addr.get('road') or addr.get('suburb') or addr.get('neighbourhood') or
                        addr.get('residential') or addr.get('commercial') or addr.get('amenity') or '')
                city = (addr.get('city') or addr.get('town') or addr.get('suburb') or
                        addr.get('district') or addr.get('state_district') or addr.get('county') or '')
                state = addr.get('state') or ''

                parts = [p for p in [road, city, state] if p]
                if parts:
                    # Remove consecutive duplicates
                    clean_parts = []
                    for p in parts:
                        if not clean_parts or p.lower() != clean_parts[-1].lower():
                            clean_parts.append(p)
                    formatted_address = ', '.join(clean_parts)
                elif data.get('display_name'):
                    display_parts = [p.strip() for p in data.get('display_name', '').split(',')]
                    formatted_address = ', '.join(display_parts[:3])
        except Exception as e:
            print(f"[Backend Reverse Geocode Nominatim Error]: {e}")

        # 2. Fallback: BigDataCloud Client Reverse Geocode
        if not formatted_address:
            try:
                url = f"https://api.bigdatacloud.net/data/reverse-geocode-client?latitude={lat}&longitude={lon}&localityLanguage=en"
                resp = requests.get(url, headers=headers, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    locality = data.get('locality') or data.get('principalSubdivision') or ''
                    city = data.get('city') or ''
                    state = data.get('principalSubdivision') or ''
                    parts = [locality, city, state]
                    clean_parts = []
                    for p in parts:
                        if p and (not clean_parts or p.lower() != clean_parts[-1].lower()):
                            clean_parts.append(p)
                    if clean_parts:
                        formatted_address = ', '.join(clean_parts)
            except Exception as e:
                print(f"[Backend Reverse Geocode BigDataCloud Error]: {e}")

        # 3. Fallback: Photon Reverse API
        if not formatted_address:
            try:
                url = f"https://photon.komoot.io/reverse?lon={lon}&lat={lat}"
                resp = requests.get(url, headers=headers, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    features = data.get('features', [])
                    if features:
                        props = features[0].get('properties', {})
                        road = props.get('name') or props.get('street') or props.get('district') or ''
                        city = props.get('city') or props.get('state') or props.get('county') or ''
                        parts = [p for p in [road, city, 'India'] if p]
                        formatted_address = ', '.join(parts)
            except Exception as e:
                print(f"[Backend Reverse Geocode Photon Error]: {e}")

        if formatted_address:
            return Response({
                'address': formatted_address,
                'lat': lat,
                'lon': lon
            }, status=status.HTTP_200_OK)

        return Response({'address': f"Location ({float(lat):.4f}, {float(lon):.4f})", 'lat': lat, 'lon': lon}, status=status.HTTP_200_OK)

    # 3. Backend Multi-Route OSRM Proxy API Endpoint
    @action(detail=False, methods=['get'], url_path='location/route', permission_classes=[AllowAny])
    def location_route(self, request):
        pLat = request.query_params.get('pLat')
        pLng = request.query_params.get('pLng')
        dLat = request.query_params.get('dLat')
        dLng = request.query_params.get('dLng')

        if not all([pLat, pLng, dLat, dLng]):
            return Response({'error': 'pLat, pLng, dLat, dLng required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            url = f"https://router.project-osrm.org/route/v1/driving/{pLng},{pLat};{dLng},{dLat}?overview=full&geometries=geojson&alternatives=true&steps=true"
            headers = {'User-Agent': 'RaahGo-Routing-Service/1.0'}
            resp = requests.get(url, headers=headers, timeout=8)

            if resp.status_code == 200:
                return Response(resp.json(), status=status.HTTP_200_OK)
        except Exception as e:
            print(f"[Backend Route Engine Error]: {e}")

        return Response({'routes': []}, status=status.HTTP_200_OK)
