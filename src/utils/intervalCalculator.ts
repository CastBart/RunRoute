/**
 * Interval Calculator
 * Calculates pace intervals (splits) for completed runs
 * Similar to Strava's km/mile splits feature
 */

import { Location } from '../types';
import { DistanceUnit } from './unitConversions';

export interface PaceInterval {
  distance: number; // Always stored in km
  pace: number; // Always in seconds per km
  duration: number; // in seconds
  elevationGain?: number; // in meters
}

/**
 * Calculate the distance between two geographic points using Haversine formula
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Get the interval distance based on unit preference
 * Always returns distance in kilometers (for consistency with storage)
 * @param unit - User's preferred distance unit
 * @returns Interval distance in kilometers (1 km or ~1.6 km for miles)
 */
export const getIntervalDistance = (unit: DistanceUnit): number => {
  // For miles, 1 mile = 1.60934 km
  return unit === 'miles' ? 1.60934 : 1.0;
};

/**
 * Calculate pace intervals for a completed run
 * @param polyline - Array of GPS points from the run
 * @param timestamps - Array of timestamps (milliseconds) for each point
 * @param elevations - Optional array of elevation values (meters) for each point
 * @param unit - User's preferred unit (determines interval distance: 1 km or 1 mile)
 * @returns Array of PaceInterval objects
 */
export const calculateIntervals = (
  polyline: Location[],
  timestamps?: number[],
  elevations?: number[],
  unit: DistanceUnit = 'km'
): PaceInterval[] => {
  if (!polyline || polyline.length < 2) {
    return [];
  }

  const intervalDistance = getIntervalDistance(unit);
  const intervals: PaceInterval[] = [];

  let accumulatedDistance = 0; // in km
  let intervalStartDistance = 0; // in km
  let intervalStartTime = timestamps?.[0] || 0;
  let intervalStartElevation = elevations?.[0] || 0;
  let currentElevationGain = 0;

  // Iterate through each point in the polyline
  for (let i = 1; i < polyline.length; i++) {
    const prev = polyline[i - 1];
    const curr = polyline[i];

    // Calculate distance from previous point
    const segmentDistance = calculateDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    accumulatedDistance += segmentDistance;

    // Calculate elevation gain for this segment
    if (elevations && elevations[i] && elevations[i - 1]) {
      const elevationChange = elevations[i] - elevations[i - 1];
      if (elevationChange > 0) {
        currentElevationGain += elevationChange;
      }
    }

    // Check if we've completed an interval
    while (accumulatedDistance >= intervalDistance) {
      const intervalEndDistance = intervalStartDistance + intervalDistance;
      const intervalDistanceCovered = intervalDistance;

      // Calculate time for this interval
      const intervalEndTime = timestamps?.[i] || 0;
      const intervalDuration = Math.round((intervalEndTime - intervalStartTime) / 1000); // Convert to seconds

      // Calculate pace (seconds per km)
      const pace = intervalDuration / intervalDistanceCovered;

      // Create interval object
      const interval: PaceInterval = {
        distance: intervalDistanceCovered, // in km
        pace: pace, // seconds per km
        duration: intervalDuration, // seconds
      };

      // Add elevation gain if available
      if (elevations && currentElevationGain > 0) {
        interval.elevationGain = Math.round(currentElevationGain);
      }

      intervals.push(interval);

      // Reset for next interval
      accumulatedDistance -= intervalDistance;
      intervalStartDistance = intervalEndDistance;
      intervalStartTime = intervalEndTime;
      intervalStartElevation = elevations?.[i] || 0;
      currentElevationGain = 0;
    }
  }

  // Handle partial interval at the end
  // Only add if remaining distance is >= 0.1 km (or ~0.06 miles)
  if (accumulatedDistance >= 0.1) {
    const intervalEndTime = timestamps?.[polyline.length - 1] || 0;
    const intervalDuration = Math.round((intervalEndTime - intervalStartTime) / 1000);

    // Calculate pace for partial interval
    const pace = intervalDuration / accumulatedDistance;

    const partialInterval: PaceInterval = {
      distance: accumulatedDistance, // in km
      pace: pace, // seconds per km
      duration: intervalDuration, // seconds
    };

    // Add elevation gain if available
    if (elevations && currentElevationGain > 0) {
      partialInterval.elevationGain = Math.round(currentElevationGain);
    }

    intervals.push(partialInterval);
  }

  return intervals;
};

/**
 * Calculate the total distance from a polyline
 * @param polyline - Array of GPS points
 * @returns Total distance in kilometers
 */
export const calculateTotalDistance = (polyline: Location[]): number => {
  if (!polyline || polyline.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  for (let i = 1; i < polyline.length; i++) {
    const prev = polyline[i - 1];
    const curr = polyline[i];
    totalDistance += calculateDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );
  }

  return totalDistance;
};
