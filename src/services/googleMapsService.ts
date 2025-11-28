import axios from 'axios';
import { Location } from '../types';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

if (!GOOGLE_MAPS_API_KEY) {
  console.warn('Google Maps API key is not configured. Please add it to your .env file.');
}

const DIRECTIONS_API_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const PLACE_DETAILS_API_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

export interface DirectionsResult {
  routes: Array<{
    legs: Array<{
      distance: { value: number; text: string };
      duration: { value: number; text: string };
      start_location: { lat: number; lng: number };
      end_location: { lat: number; lng: number };
      steps: Array<{
        distance: { value: number; text: string };
        duration: { value: number; text: string };
        start_location: { lat: number; lng: number };
        end_location: { lat: number; lng: number };
        polyline: { points: string };
      }>;
    }>;
    overview_polyline: { points: string };
  }>;
}

interface GoogleDirectionsResponse {
  routes: DirectionsResult['routes'];
  status: 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | 'MAX_WAYPOINTS_EXCEEDED' |
          'MAX_ROUTE_LENGTH_EXCEEDED' | 'INVALID_REQUEST' | 'OVER_QUERY_LIMIT' |
          'REQUEST_DENIED' | 'UNKNOWN_ERROR';
  error_message?: string;
}

export interface PlaceAutocompleteResult {
  predictions: Array<{
    description: string;
    place_id: string;
    structured_formatting: {
      main_text: string;
      secondary_text: string;
    };
  }>;
}

export interface PlaceDetailsResult {
  result: {
    geometry: {
      location: { lat: number; lng: number };
    };
    name: string;
    formatted_address: string;
  };
}

/**
 * Get directions from origin to destination
 */
export const getDirections = async (
  origin: Location,
  destination: Location,
  waypoints?: Location[]
): Promise<{ data: DirectionsResult | null; error: string | null }> => {
  try {
    console.log('🗺️ Google Directions API Call');
    console.log('API Key:', GOOGLE_MAPS_API_KEY ? `${GOOGLE_MAPS_API_KEY.substring(0, 10)}...` : 'MISSING');

    const waypointsParam = waypoints && waypoints.length > 0
      ? waypoints.map(wp => `${wp.latitude},${wp.longitude}`).join('|')
      : '';

    const params: any = {
      origin: `${origin.latitude},${origin.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      mode: 'walking', // For running routes
      key: GOOGLE_MAPS_API_KEY,
    };

    if (waypointsParam) {
      params.waypoints = waypointsParam;
    }

    console.log('📤 Request params:', {
      origin: params.origin,
      destination: params.destination,
      mode: params.mode,
      hasWaypoints: !!waypointsParam,
    });

    const response = await axios.get<GoogleDirectionsResponse>(DIRECTIONS_API_URL, { params });

    console.log('📥 Response status:', response.status);
    console.log('📥 Google API status:', response.data.status);
    console.log('📥 Routes found:', response.data.routes?.length || 0);

    // Check Google's API status field (returned even on HTTP 200)
    if (response.data.status !== 'OK') {
      const errorMsg = response.data.error_message || `Google API returned status: ${response.data.status}`;
      console.error('❌ Google API error:', {
        status: response.data.status,
        error_message: response.data.error_message,
        hint: getErrorHint(response.data.status)
      });
      return { data: null, error: errorMsg };
    }

    if (response.data.routes && response.data.routes.length > 0) {
      console.log('✅ Directions API success');
      return { data: response.data as DirectionsResult, error: null };
    }

    console.warn('⚠️ No routes in response despite OK status');
    return { data: null, error: 'No routes found for the given locations' };
  } catch (error: any) {
    console.error('❌ Directions API error:', error.response?.data || error.message);
    if (error.response?.data?.error_message) {
      return { data: null, error: error.response.data.error_message };
    }
    return { data: null, error: error.message || 'Failed to get directions' };
  }
};

/**
 * Search for places using autocomplete
 */
export const searchPlaces = async (
  input: string,
  location?: Location
): Promise<{ data: PlaceAutocompleteResult | null; error: string | null }> => {
  try {
    const params: any = {
      input,
      key: GOOGLE_MAPS_API_KEY,
    };

    if (location) {
      params.location = `${location.latitude},${location.longitude}`;
      params.radius = 50000; // 50km radius
    }

    const response = await axios.get<PlaceAutocompleteResult>(PLACES_API_URL, { params });

    return { data: response.data, error: null };
  } catch (error: any) {
    console.error('Places API error:', error);
    return { data: null, error: error.message || 'Failed to search places' };
  }
};

/**
 * Get place details by place ID
 */
export const getPlaceDetails = async (
  placeId: string
): Promise<{ data: PlaceDetailsResult | null; error: string | null }> => {
  try {
    const params = {
      place_id: placeId,
      fields: 'geometry,name,formatted_address',
      key: GOOGLE_MAPS_API_KEY,
    };

    const response = await axios.get<PlaceDetailsResult>(PLACE_DETAILS_API_URL, { params });

    return { data: response.data, error: null };
  } catch (error: any) {
    console.error('Place Details API error:', error);
    return { data: null, error: error.message || 'Failed to get place details' };
  }
};

/**
 * Decode Google polyline string to array of coordinates
 */
export const decodePolyline = (encoded: string): Location[] => {
  const points: Location[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
};

/**
 * Calculate distance between two coordinates in kilometers
 */
export const calculateDistance = (point1: Location, point2: Location): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);

  const lat1 = toRad(point1.latitude);
  const lat2 = toRad(point2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

const toRad = (value: number): number => {
  return (value * Math.PI) / 180;
};

/**
 * Format distance for display
 */
export const formatDistance = (distanceInKm: number): string => {
  if (distanceInKm < 1) {
    return `${Math.round(distanceInKm * 1000)}m`;
  }
  return `${distanceInKm.toFixed(2)}km`;
};

/**
 * Format duration for display
 */
export const formatDuration = (durationInSeconds: number): string => {
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/**
 * Get helpful error hint based on Google API status
 */
const getErrorHint = (status: string): string => {
  switch (status) {
    case 'REQUEST_DENIED':
      return 'Check API key is valid, Directions API is enabled, and restrictions allow this app';
    case 'OVER_QUERY_LIMIT':
      return 'API quota exceeded or billing not enabled';
    case 'ZERO_RESULTS':
      return 'No route possible between these locations';
    case 'INVALID_REQUEST':
      return 'Invalid request parameters';
    default:
      return 'Unknown error';
  }
};
