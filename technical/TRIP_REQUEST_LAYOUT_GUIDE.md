# Trip Request Form Layout Guide

## Current Implementation: `trip-request-page-redesigned.tsx`

This document serves as the definitive guide for the optimized trip request form layout that has been tested and refined.

## Key Design Principles

### 1. One-Page Layout
- Both "Trip Details" and "Cost Information" sections fit on one screen without scrolling
- Compact padding (p-5) and reduced gaps (gap-5) throughout
- Minimal spacing between sections (mt-6)

### 2. Project Field Logic
- **Urgent trips**: Project field is optional and available
- **Planned trips**: Project field is required 
- **Ticket trips**: Project field is hidden completely

### 3. Section Organization
**Trip Details Section:**
- Trip date, trip type, origin/destination site selectors
- Purpose field and conditional project field
- Two-column responsive grid layout

**Cost Information Section:**
- Real-time distance calculation using OpenRouteService API
- Automatic cost calculation with current KM rates
- Visual indicators for calculation status

### 4. Technical Features
- Real distance calculation (not mock data)
- Integrated site selector with "Abbreviation - English Name" format
- Automatic cost updates when sites or trip type changes
- Form validation with proper error handling

### 5. Spacing Standards
- Section padding: `p-5`
- Grid gaps: `gap-5` 
- Section margins: `mt-6`
- Card content: compact but readable

## File Structure
- Main page: `client/src/pages/trip-request-page-redesigned.tsx`
- Routing: Lines 28-29 in `client/src/App.tsx`
- Cost calculation: `client/src/lib/cost-calculator.ts`
- Site selector: `client/src/components/ui/site-selector.tsx`

## Known Working Features
1. OpenRouteService API integration for real distance calculation
2. Project field conditional logic based on trip type
3. Automatic cost calculation with current rates
4. Responsive two-column layout
5. One-page form experience without scrolling

## Important Notes
- This is the ONLY trip request page in use
- All old problematic versions have been removed
- Layout optimizations preserve functionality while maximizing screen space
- Real API integration eliminates need for placeholder data