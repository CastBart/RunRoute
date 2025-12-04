/**
 * Unit conversion and formatting utilities for distance, pace, and speed
 * Handles conversion between kilometers and miles throughout the app
 */

export type DistanceUnit = 'km' | 'miles';

// Conversion constants
const KM_TO_MILES = 0.621371;
const MILES_TO_KM = 1.60934;
const METERS_TO_FEET = 3.28084;

/**
 * Convert distance from kilometers to the specified unit
 * @param km - Distance in kilometers
 * @param unit - Target unit ('km' or 'miles')
 * @returns Distance in the specified unit
 */
export const convertDistance = (km: number, unit: DistanceUnit): number => {
  return unit === 'miles' ? km * KM_TO_MILES : km;
};

/**
 * Convert distance from miles to kilometers
 * @param miles - Distance in miles
 * @returns Distance in kilometers
 */
export const convertMilesToKm = (miles: number): number => {
  return miles * MILES_TO_KM;
};

/**
 * Format distance with unit label
 * @param km - Distance in kilometers
 * @param unit - Display unit ('km' or 'miles')
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "5.00 km" or "3.11 mi"
 */
export const formatDistance = (
  km: number,
  unit: DistanceUnit,
  decimals: number = 2
): string => {
  const distance = convertDistance(km, unit);
  const unitLabel = getUnitLabel(unit, true);
  return `${distance.toFixed(decimals)} ${unitLabel}`;
};

/**
 * Convert pace from seconds/km to seconds/mile if needed
 * @param secondsPerKm - Pace in seconds per kilometer
 * @param unit - Target unit ('km' or 'miles')
 * @returns Pace in seconds per unit
 */
export const convertPaceToUnit = (
  secondsPerKm: number,
  unit: DistanceUnit
): number => {
  return unit === 'miles' ? secondsPerKm * MILES_TO_KM : secondsPerKm;
};

/**
 * Format pace as "m:ss /km" or "m:ss /mi"
 * @param secondsPerKm - Pace in seconds per kilometer
 * @param unit - Display unit ('km' or 'miles')
 * @returns Formatted pace string like "5:30 /km" or "8:51 /mi"
 */
export const formatPace = (secondsPerKm: number, unit: DistanceUnit): string => {
  const paceInUnit = convertPaceToUnit(secondsPerKm, unit);
  const mins = Math.floor(paceInUnit / 60);
  const secs = Math.floor(paceInUnit % 60);
  const unitLabel = getUnitLabel(unit, true);
  return `${mins}:${secs.toString().padStart(2, '0')} /${unitLabel}`;
};

/**
 * Convert speed from km/h to mph if needed
 * @param kmh - Speed in kilometers per hour
 * @param unit - Target unit ('km' or 'miles')
 * @returns Speed in the specified unit per hour
 */
export const convertSpeed = (kmh: number, unit: DistanceUnit): number => {
  return unit === 'miles' ? kmh * KM_TO_MILES : kmh;
};

/**
 * Format speed as "km/h" or "mph"
 * @param kmh - Speed in kilometers per hour
 * @param unit - Display unit ('km' or 'miles')
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted speed string like "10.5 km/h" or "6.5 mph"
 */
export const formatSpeed = (
  kmh: number,
  unit: DistanceUnit,
  decimals: number = 1
): string => {
  const speed = convertSpeed(kmh, unit);
  const speedLabel = unit === 'miles' ? 'mph' : 'km/h';
  return `${speed.toFixed(decimals)} ${speedLabel}`;
};

/**
 * Get the unit label
 * @param unit - Unit type ('km' or 'miles')
 * @param short - If true, returns short form (km/mi), otherwise long form (kilometer/mile)
 * @returns Unit label string
 */
export const getUnitLabel = (unit: DistanceUnit, short: boolean = true): string => {
  if (short) {
    return unit === 'km' ? 'km' : 'mi';
  } else {
    return unit === 'km' ? 'kilometer' : 'mile';
  }
};

/**
 * Get the plural unit label
 * @param unit - Unit type ('km' or 'miles')
 * @param short - If true, returns short form (km/mi), otherwise long form (kilometers/miles)
 * @returns Plural unit label string
 */
export const getUnitLabelPlural = (
  unit: DistanceUnit,
  short: boolean = true
): string => {
  if (short) {
    return unit === 'km' ? 'km' : 'mi';
  } else {
    return unit === 'km' ? 'kilometers' : 'miles';
  }
};

/**
 * Get interval distance (1 km or 1 mile)
 * @param unit - Unit type ('km' or 'miles')
 * @returns Interval distance (always 1 in the specified unit)
 */
export const getIntervalDistance = (unit: DistanceUnit): number => {
  return 1; // Always 1 km or 1 mile
};

/**
 * Convert meters to feet
 * @param meters - Distance/elevation in meters
 * @returns Distance/elevation in feet
 */
export const convertMetersToFeet = (meters: number): number => {
  return meters * METERS_TO_FEET;
};

/**
 * Format elevation with appropriate unit
 * @param meters - Elevation in meters
 * @param unit - Display unit ('km' uses meters, 'miles' uses feet)
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted elevation string like "150 m" or "492 ft"
 */
export const formatElevation = (
  meters: number,
  unit: DistanceUnit,
  decimals: number = 0
): string => {
  if (unit === 'miles') {
    const feet = convertMetersToFeet(meters);
    return `${feet.toFixed(decimals)} ft`;
  } else {
    return `${meters.toFixed(decimals)} m`;
  }
};
