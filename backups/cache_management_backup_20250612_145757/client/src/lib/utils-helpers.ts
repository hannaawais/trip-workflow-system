// Utility functions for type safety and data handling

import { User, TripRequest, AdminRequest } from "@shared/schema";

/**
 * Get user's full name from user object
 */
export function getUserName(user: User | null | undefined): string {
  if (!user) return "Unknown User";
  return user.fullName || `${user.username}`;
}

/**
 * Safe date formatting with null handling
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "Invalid Date";
    return dateObj.toLocaleDateString();
  } catch {
    return "Invalid Date";
  }
}

/**
 * Safe date object creation with null handling
 */
export function safeDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return null;
    return dateObj;
  } catch {
    return null;
  }
}

/**
 * Type guard to check if request is TripRequest
 */
export function isTripRequest(request: TripRequest | AdminRequest): request is TripRequest {
  return 'fromSiteId' in request;
}

/**
 * Type guard to check if request is AdminRequest  
 */
export function isAdminRequest(request: TripRequest | AdminRequest): request is AdminRequest {
  return 'targetId' in request;
}

/**
 * Safe array access with default empty array
 */
export function safeArray<T>(data: T[] | unknown): T[] {
  return Array.isArray(data) ? data : [];
}

/**
 * Safe object property access
 */
export function safeProp<T>(obj: any, prop: string, defaultValue: T): T {
  return obj && typeof obj === 'object' && prop in obj ? obj[prop] : defaultValue;
}

/**
 * Convert null to undefined for optional properties
 */
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}