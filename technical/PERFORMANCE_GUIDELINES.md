# Performance Guidelines and Optimization

## Database Query Optimization

### Index Requirements
**CRITICAL**: Required database indexes for optimal performance:

```sql
-- Trip requests performance indexes
CREATE INDEX idx_trip_requests_user_id ON trip_requests(userId);
CREATE INDEX idx_trip_requests_department ON trip_requests(department);
CREATE INDEX idx_trip_requests_status ON trip_requests(status);
CREATE INDEX idx_trip_requests_travel_date ON trip_requests(travelDate);
CREATE INDEX idx_trip_requests_project_id ON trip_requests(projectId);

-- Distance caching indexes
CREATE INDEX idx_distances_sites ON distances(fromSiteId, toSiteId, routeType);
CREATE INDEX idx_distances_lookup ON distances(fromSiteId, toSiteId);

-- Audit log performance
CREATE INDEX idx_audit_logs_user_id ON audit_logs(userId);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(createdAt);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- User and department lookups
CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_departments_manager ON departments(managerId);
```

### Query Optimization Patterns
```typescript
// REQUIRED: Efficient data loading with joins
async getTripRequestsWithDetails(): Promise<TripRequestWithDetails[]> {
  return await db.select({
    trip: tripRequests,
    user: users,
    department: departments,
    fromSite: sites,
    toSite: sites,
    project: projects
  })
  .from(tripRequests)
  .leftJoin(users, eq(tripRequests.userId, users.id))
  .leftJoin(departments, eq(users.department, departments.name))
  .leftJoin(sites, eq(tripRequests.fromSiteId, sites.id))
  .leftJoin(sites, eq(tripRequests.toSiteId, sites.id))
  .leftJoin(projects, eq(tripRequests.projectId, projects.id))
  .orderBy(desc(tripRequests.createdAt));
}
```

### Pagination Implementation
```typescript
// REQUIRED: Implement pagination for large datasets
async getPaginatedTripRequests(
  page: number = 1, 
  limit: number = 50,
  filters?: TripRequestFilters
): Promise<PaginatedResponse<TripRequest>> {
  const offset = (page - 1) * limit;
  
  let query = db.select().from(tripRequests);
  
  // Apply filters
  if (filters?.status) {
    query = query.where(eq(tripRequests.status, filters.status));
  }
  if (filters?.department) {
    query = query.where(eq(tripRequests.department, filters.department));
  }
  if (filters?.dateFrom) {
    query = query.where(gte(tripRequests.travelDate, filters.dateFrom));
  }
  
  const [data, total] = await Promise.all([
    query.limit(limit).offset(offset).orderBy(desc(tripRequests.createdAt)),
    db.select({ count: sql`count(*)` }).from(tripRequests).where(/* same filters */)
  ]);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total: total[0].count,
      pages: Math.ceil(total[0].count / limit)
    }
  };
}
```

## Frontend Performance

### Query Optimization with React Query
```typescript
// REQUIRED: Efficient data fetching patterns
const { data: tripRequests, isLoading } = useQuery({
  queryKey: ["/api/trip-requests", { page, filters }],
  queryFn: ({ queryKey }) => {
    const [, params] = queryKey;
    return fetch(`/api/trip-requests?${new URLSearchParams(params)}`).then(res => res.json());
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: false,
});

// REQUIRED: Hierarchical cache invalidation
const mutation = useMutation({
  mutationFn: updateTripRequest,
  onSuccess: () => {
    // Invalidate all trip request queries
    queryClient.invalidateQueries({ queryKey: ["/api/trip-requests"] });
    // Invalidate specific trip
    queryClient.invalidateQueries({ queryKey: ["/api/trip-requests", tripId] });
  },
});
```

### Memoization for Expensive Calculations
```typescript
// REQUIRED: Memoize expensive calculations
import { useMemo } from 'react';

function TripRequestTable({ tripRequests }: { tripRequests: TripRequest[] }) {
  const processedRequests = useMemo(() => {
    return tripRequests.map(request => ({
      ...request,
      costFormatted: formatJordanianDinar(request.cost || 0),
      daysUntilTravel: calculateDaysUntilTravel(request.travelDate),
      canApprove: canUserApproveRequest(user, request),
    }));
  }, [tripRequests, user]);

  const filteredRequests = useMemo(() => {
    return processedRequests.filter(request => 
      request.status.includes(statusFilter) &&
      request.department.includes(departmentFilter)
    );
  }, [processedRequests, statusFilter, departmentFilter]);

  return (
    <Table>
      {filteredRequests.map(request => (
        <TripRequestRow key={request.id} request={request} />
      ))}
    </Table>
  );
}
```

### Virtual Scrolling for Large Lists
```typescript
// RECOMMENDED: For very large datasets (>1000 items)
import { FixedSizeList as List } from 'react-window';

function VirtualizedTripList({ tripRequests }: { tripRequests: TripRequest[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <TripRequestRow request={tripRequests[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={tripRequests.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

## Caching Strategies

### Distance Calculation Caching
```typescript
// IMPLEMENTED: Database-only distance caching
// Distance calculations are cached directly in the PostgreSQL database
// via the distances table with appropriate indexes for fast lookups

async getDistance(fromSiteId: number, toSiteId: number, routeType: string = "fastest"): Promise<Distance | null> {
  // Check database cache (no in-memory caching needed)
  const dbDistance = await this.storage.getDistance(fromSiteId, toSiteId, routeType);
  if (dbDistance) {
    return dbDistance;
  }
  
  // Calculate and cache in database if not found
  return await this.calculateAndCacheDistance(fromSiteId, toSiteId, routeType);
}
```

### API Response Optimization
```typescript
// IMPLEMENTED: Database-driven response optimization
// All frequently accessed data is retrieved directly from PostgreSQL
// with optimized indexes and JOIN operations for fast response times

// Direct database access with optimized queries
async function getOptimizedDepartments(): Promise<Department[]> {
  // Uses database indexes for fast retrieval
  return await storage.getDepartments();
}

// Usage in API routes - no caching layer needed
app.get("/api/departments", async (req, res) => {
  const departments = await storage.getDepartments();
  res.json(departments);
});
```

## OpenRouteService API Optimization

### Rate Limiting and Batching
```typescript
// REQUIRED: Efficient API usage
class OpenRouteServiceOptimizer {
  private requestQueue: Array<{ coordinates: number[][]; resolve: Function; reject: Function }> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second between requests
  
  async calculateDistance(fromSite: Site, toSite: Site): Promise<number> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        coordinates: [[fromSite.gpsLng, fromSite.gpsLat], [toSite.gpsLng, toSite.gpsLat]],
        resolve,
        reject
      });
      
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) return;
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      
      // Rate limiting
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest));
      }
      
      try {
        const distance = await this.callOpenRouteService(request.coordinates);
        request.resolve(distance);
      } catch (error) {
        request.reject(error);
      }
      
      this.lastRequestTime = Date.now();
    }
    
    this.processing = false;
  }
}
```

### Bulk Distance Pre-calculation
```typescript
// RECOMMENDED: Pre-calculate common routes during off-peak hours
async function preCalculateCommonRoutes(): Promise<void> {
  const sites = await storage.getActiveSites();
  const commonPairs = await getCommonSitePairs(); // Based on historical data
  
  console.log(`Pre-calculating ${commonPairs.length} common routes...`);
  
  for (const pair of commonPairs) {
    const fromSite = sites.find(s => s.id === pair.fromSiteId);
    const toSite = sites.find(s => s.id === pair.toSiteId);
    
    if (fromSite && toSite) {
      const existing = await storage.getDistance(pair.fromSiteId, pair.toSiteId);
      if (!existing) {
        await storage.calculateAndCacheDistance(pair.fromSiteId, pair.toSiteId);
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  console.log('Pre-calculation completed');
}

// Run during application startup or via cron job
if (process.env.NODE_ENV === 'production') {
  setTimeout(preCalculateCommonRoutes, 30000); // Start 30 seconds after app start
}
```

## Memory Management

### Connection Pool Optimization
```typescript
// REQUIRED: Optimize database connection pool
import { Pool } from '@neondatabase/serverless';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Memory Leak Prevention
```typescript
// REQUIRED: Proper cleanup in React components
function TripRequestPage() {
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    // Set up polling
    intervalRef.current = setInterval(fetchRequests, 30000);
    
    return () => {
      // Cleanup interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  // Component implementation
}
```

## Monitoring and Metrics

### Performance Monitoring
```typescript
// REQUIRED: Track key performance metrics
class PerformanceMonitor {
  static trackApiCall(endpoint: string, duration: number, success: boolean): void {
    console.log(`API ${endpoint}: ${duration}ms ${success ? 'SUCCESS' : 'FAILED'}`);
    
    // In production, send to monitoring service
    if (duration > 1000) {
      console.warn(`Slow API call detected: ${endpoint} took ${duration}ms`);
    }
  }
  
  static trackDatabaseQuery(query: string, duration: number): void {
    if (duration > 500) {
      console.warn(`Slow database query: ${query} took ${duration}ms`);
    }
  }
}

// Usage in API routes
app.get("/api/trip-requests", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const requests = await storage.getTripRequests();
    const duration = Date.now() - startTime;
    
    PerformanceMonitor.trackApiCall("/api/trip-requests", duration, true);
    res.json({ trips: requests });
  } catch (error) {
    const duration = Date.now() - startTime;
    PerformanceMonitor.trackApiCall("/api/trip-requests", duration, false);
    throw error;
  }
});
```

### Database Query Analysis
```sql
-- REQUIRED: Regular performance analysis
EXPLAIN ANALYZE SELECT * FROM trip_requests 
WHERE status = 'Pending Department Approval' 
ORDER BY createdAt DESC 
LIMIT 50;

-- Monitor slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC;
```