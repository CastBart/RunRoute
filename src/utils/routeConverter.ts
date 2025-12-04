/**
 * Route Converter Utility
 * Converts Run GPS data to Route format with polyline simplification
 * Implements Douglas-Peucker algorithm for reducing GPS points while preserving shape
 */

import { Location, Route, Run } from '../types';
import { DistanceUnit } from './unitConversions';

/**
 * Calculate perpendicular distance from a point to a line
 * @param point - The point to measure distance from
 * @param lineStart - Start of the line
 * @param lineEnd - End of the line
 * @returns Distance in kilometers
 */
const perpendicularDistance = (
  point: Location,
  lineStart: Location,
  lineEnd: Location
): number => {
  const { latitude: x, longitude: y } = point;
  const { latitude: x1, longitude: y1 } = lineStart;
  const { latitude: x2, longitude: y2 } = lineEnd;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;

  // Convert to approximate kilometers (rough estimate)
  return Math.sqrt(dx * dx + dy * dy) * 111.32;
};

/**
 * Douglas-Peucker algorithm for polyline simplification
 * Reduces GPS points while preserving the overall shape
 * @param points - Array of location points
 * @param tolerance - Distance tolerance in kilometers (default 0.00005 km = 5cm)
 * @returns Simplified array of points
 */
const douglasPeucker = (points: Location[], tolerance: number): Location[] => {
  if (points.length <= 2) return points;

  // Find point with maximum perpendicular distance
  let maxDistance = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(
      points[i],
      points[0],
      points[points.length - 1]
    );
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance > tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[points.length - 1]];
};

/**
 * Simplify a polyline by reducing the number of points
 * @param points - Array of GPS points
 * @param tolerance - Distance tolerance in kilometers (default 0.00005 km = 5cm)
 * @returns Simplified polyline as Location array
 */
export const simplifyPolyline = (
  points: Location[],
  tolerance: number = 0.00005
): Location[] => {
  if (!points || points.length < 2) {
    return points;
  }

  const simplified = douglasPeucker(points, tolerance);

  // Ensure we don't have too many points (max 500)
  if (simplified.length > 500) {
    // Increase tolerance and try again
    return simplifyPolyline(points, tolerance * 2);
  }

  return simplified;
};

/**
 * Calculate the distance between two geographic points using Haversine formula
 * @param point1 - First location
 * @param point2 - Second location
 * @returns Distance in kilometers
 */
const calculateDistance = (point1: Location, point2: Location): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.latitude * Math.PI) / 180) *
      Math.cos((point2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Detect if a route is a loop (circular route)
 * @param polyline - Array of location points
 * @param thresholdKm - Distance threshold in kilometers (default 0.1 km = 100m)
 * @returns True if route is a loop
 */
export const detectLoop = (
  polyline: Location[],
  thresholdKm: number = 0.1
): boolean => {
  if (!polyline || polyline.length < 2) {
    return false;
  }

  const startPoint = polyline[0];
  const endPoint = polyline[polyline.length - 1];
  const distance = calculateDistance(startPoint, endPoint);

  return distance < thresholdKm;
};

/**
 * Generate a suggested route name based on run data
 * @param run - The run data
 * @param distanceUnit - User's preferred distance unit
 * @returns Formatted route name
 */
export const generateRouteName = (
  run: { distance: number; polyline: Location[]; start_time: string },
  distanceUnit: DistanceUnit
): string => {
  const isLoop = detectLoop(run.polyline);

  // Format distance
  let distanceStr: string;
  if (distanceUnit === 'miles') {
    const miles = run.distance * 0.621371;
    distanceStr = `${miles.toFixed(1)}mi`;
  } else {
    distanceStr = `${run.distance.toFixed(1)}km`;
  }

  // Format date
  const date = new Date(run.start_time);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${monthNames[date.getMonth()]} ${date.getDate()}`;

  return `${distanceStr} ${isLoop ? 'Loop' : 'Route'} - ${dateStr}`;
};

/**
 * Convert a Run to a Route format
 * @param run - The completed run data
 * @param name - Name for the route
 * @param sourceType - How the route was created
 * @param isCommunity - Whether this is a community route
 * @returns Route object (without id and created_at)
 */
export const convertRunToRoute = (
  run: Run,
  name: string,
  sourceType: 'own_run' | 'social_post' | 'manual',
  isCommunity: boolean
): Omit<Route, 'id' | 'created_at'> => {
  // Simplify polyline
  const simplifiedPolyline = simplifyPolyline(run.polyline, 0.00005);

  // Extract start and end locations
  const start_location = simplifiedPolyline[0];
  const end_location = simplifiedPolyline[simplifiedPolyline.length - 1];

  // Detect if loop
  const is_loop = detectLoop(simplifiedPolyline);

  // Create route object
  const route: any = {
    user_id: run.user_id,
    name,
    start_location,
    end_location,
    waypoints: [], // No waypoints for saved runs
    polyline: simplifiedPolyline,
    distance: run.distance,
    estimated_duration: run.duration,
    is_loop,
    is_community_route: isCommunity,
    save_count: 0,
    original_run_id: run.id,
    original_user_id: run.user_id,
    source_type: sourceType,
  };

  return route;
};

/**
 * Compare two polylines to check if they are equal
 * Used for duplicate detection
 * @param poly1 - First polyline
 * @param poly2 - Second polyline
 * @param tolerance - Distance tolerance in kilometers (default 0.05 km = 50m)
 * @returns True if polylines are considered equal
 */
export const arePolylinesEqual = (
  poly1: Location[],
  poly2: Location[],
  tolerance: number = 0.05
): boolean => {
  if (!poly1 || !poly2) return false;
  if (poly1.length < 10 || poly2.length < 10) return false;

  // Compare first 10 points
  for (let i = 0; i < Math.min(10, poly1.length, poly2.length); i++) {
    const distance = calculateDistance(poly1[i], poly2[i]);
    if (distance > tolerance) return false;
  }

  // Compare last 10 points
  const startIdx1 = poly1.length - 10;
  const startIdx2 = poly2.length - 10;
  for (let i = 0; i < 10; i++) {
    const idx1 = startIdx1 + i;
    const idx2 = startIdx2 + i;
    if (idx1 >= 0 && idx2 >= 0 && idx1 < poly1.length && idx2 < poly2.length) {
      const distance = calculateDistance(poly1[idx1], poly2[idx2]);
      if (distance > tolerance) return false;
    }
  }

  return true;
};

/**
 * Check if a run duplicates any existing routes
 * @param runPolyline - The run's polyline
 * @param existingRoutes - Array of user's existing routes
 * @returns True if duplicate found
 */
export const isDuplicateRoute = (
  runPolyline: Location[],
  existingRoutes: Route[]
): boolean => {
  for (const route of existingRoutes) {
    if (arePolylinesEqual(runPolyline, route.polyline)) {
      return true;
    }
  }
  return false;
};
