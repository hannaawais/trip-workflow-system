# Cost Calculation System Documentation

## OpenRouteService API Integration

### API Configuration
**CRITICAL**: Distance calculations require valid OpenRouteService API key:

```typescript
// Required environment variable
OPENROUTESERVICE_API_KEY=your_api_key_here

// API endpoint configuration
const OPENROUTESERVICE_BASE_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';
```

### Distance Calculation Workflow
```typescript
// REQUIRED: Cache-first approach to minimize API calls
async calculateAndCacheDistance(fromSiteId: number, toSiteId: number, routeType: string = "fastest"): Promise<Distance> {
  // 1. Check cache first
  const cached = await this.getDistance(fromSiteId, toSiteId, routeType);
  if (cached) return cached;
  
  // 2. Get site coordinates
  const fromSite = await this.getSite(fromSiteId);
  const toSite = await this.getSite(toSiteId);
  
  // 3. Call OpenRouteService API
  const response = await fetch(`${OPENROUTESERVICE_BASE_URL}`, {
    method: 'POST',
    headers: {
      'Authorization': process.env.OPENROUTESERVICE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates: [
        [fromSite.gpsLng, fromSite.gpsLat],
        [toSite.gpsLng, toSite.gpsLat]
      ]
    })
  });
  
  // 4. Cache and return result
  const data = await response.json();
  const distance = data.routes[0].summary.distance / 1000; // Convert to kilometers
  
  return await this.createDistance({
    fromSiteId,
    toSiteId,
    kilometers: distance,
    routeType
  });
}
```

## KM Rate Management

### Current Rate Retrieval
```typescript
// REQUIRED: Always use current effective rate
async getCurrentKmRate(date: Date = new Date()): Promise<KmRate | undefined> {
  const rates = await this.getKmRates();
  return rates
    .filter(rate => rate.effectiveFrom <= date && 
                   (!rate.effectiveTo || rate.effectiveTo >= date))
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
}
```

### Rate History Management
```typescript
// CRITICAL: Maintain rate history for audit purposes
async createKmRate(kmRate: InsertKmRate): Promise<KmRate> {
  // Validate effective dates
  if (kmRate.effectiveTo && kmRate.effectiveFrom >= kmRate.effectiveTo) {
    throw new Error("Effective from date must be before effective to date");
  }
  
  // End previous rate when new rate starts
  const currentRate = await this.getCurrentKmRate(kmRate.effectiveFrom);
  if (currentRate && !currentRate.effectiveTo) {
    await this.updateKmRate(currentRate.id, {
      effectiveTo: new Date(kmRate.effectiveFrom.getTime() - 1000) // 1 second before new rate
    });
  }
  
  return await db.insert(kmRates).values(kmRate).returning()[0];
}
```

## Trip Cost Calculation

### Automatic Cost Calculation
```typescript
// REQUIRED: Calculate cost when trip is approved
async calculateTripCost(tripRequest: TripRequest): Promise<number> {
  // Get distance (cached or calculate)
  const distance = await this.calculateAndCacheDistance(
    tripRequest.fromSiteId,
    tripRequest.toSiteId,
    "fastest"
  );
  
  // Get current KM rate
  const kmRate = await this.getCurrentKmRate(tripRequest.travelDate);
  if (!kmRate) {
    throw new Error("No KM rate available for travel date");
  }
  
  // Calculate cost (distance × rate)
  const cost = distance.kilometers * kmRate.rateValue;
  
  // Update trip with calculated cost
  await this.updateTripRequestCost(tripRequest.id, cost, distance.kilometers);
  
  return cost;
}
```

### Cost Recalculation System
```typescript
// REQUIRED: Recalculate all trip costs when rates change
async recalculateTripCosts(rateId?: number): Promise<number> {
  let tripsToUpdate: TripRequest[];
  
  if (rateId) {
    // Recalculate only trips affected by specific rate
    const rate = await this.getKmRate(rateId);
    tripsToUpdate = await db.select()
      .from(tripRequests)
      .where(
        and(
          gte(tripRequests.travelDate, rate.effectiveFrom),
          rate.effectiveTo ? lte(tripRequests.travelDate, rate.effectiveTo) : undefined,
          isNotNull(tripRequests.kilometers)
        )
      );
  } else {
    // Recalculate all trips with distances but no costs
    tripsToUpdate = await db.select()
      .from(tripRequests)
      .where(
        and(
          isNotNull(tripRequests.kilometers),
          isNull(tripRequests.cost)
        )
      );
  }
  
  let updatedCount = 0;
  for (const trip of tripsToUpdate) {
    try {
      const rate = await this.getCurrentKmRate(trip.travelDate);
      if (rate && trip.kilometers) {
        const newCost = trip.kilometers * rate.rateValue;
        await this.updateTripRequestCost(trip.id, newCost, trip.kilometers);
        updatedCount++;
      }
    } catch (error) {
      console.error(`Failed to recalculate cost for trip ${trip.id}:`, error);
    }
  }
  
  return updatedCount;
}
```

## Jordanian Dinar Currency Handling

### Currency Formatting
```typescript
// REQUIRED: Format all costs in JD with proper precision
export function formatJordanianDinar(amount: number): string {
  return new Intl.NumberFormat('ar-JO', {
    style: 'currency',
    currency: 'JOD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 3
  }).format(amount);
}

// Alternative English format
export function formatJDEnglish(amount: number): string {
  return `${amount.toFixed(3)} JD`;
}
```

### Cost Validation
```typescript
// REQUIRED: Validate cost values
export function validateCost(cost: number): boolean {
  return cost >= 0 && cost <= 10000 && Number.isFinite(cost);
}
```

## Site Management Integration

### Site Data Requirements
```sql
-- Sites table must include GPS coordinates for distance calculation
CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  abbreviation VARCHAR(10) NOT NULL UNIQUE,
  englishName VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  region VARCHAR(100),
  gpsLat DECIMAL(10, 8) NOT NULL, -- Required for distance calculation
  gpsLng DECIMAL(11, 8) NOT NULL, -- Required for distance calculation
  siteType site_type_enum,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### Site Selection Format
```typescript
// REQUIRED: Display format "Abbreviation - English Name"
export function formatSiteDisplay(site: Site): string {
  return `${site.abbreviation} - ${site.englishName}`;
}

// For API responses
export function formatSiteForSelect(sites: Site[]): SelectOption[] {
  return sites
    .filter(site => site.isActive)
    .map(site => ({
      value: site.id.toString(),
      label: formatSiteDisplay(site)
    }));
}
```

## Error Handling and Recovery

### API Rate Limiting
```typescript
// REQUIRED: Handle OpenRouteService rate limits
async function callOpenRouteServiceWithRetry(coordinates: number[][], maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(OPENROUTESERVICE_BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': process.env.OPENROUTESERVICE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coordinates })
      });
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`OpenRouteService API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}
```

### Fallback Distance Calculation
```typescript
// FALLBACK: Straight-line distance when API fails
private calculateStraightLineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1.2; // Add 20% for road distance estimation
}
```

## Performance Optimization

### Distance Caching Strategy
```typescript
// REQUIRED: Cache all calculated distances
CREATE INDEX idx_distances_sites ON distances(fromSiteId, toSiteId, routeType);

// Bulk distance pre-calculation for common routes
async preCalculateCommonRoutes(): Promise<void> {
  const sites = await this.getActiveSites();
  const commonPairs = [
    // Add most frequently used site pairs
    { from: 'AMMAN', to: 'IRBID' },
    { from: 'AMMAN', to: 'ZARQA' },
    // ... other common routes
  ];
  
  for (const pair of commonPairs) {
    const fromSite = sites.find(s => s.abbreviation === pair.from);
    const toSite = sites.find(s => s.abbreviation === pair.to);
    
    if (fromSite && toSite) {
      await this.calculateAndCacheDistance(fromSite.id, toSite.id);
    }
  }
}
```