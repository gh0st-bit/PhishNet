# PhishNet - Technical Architecture

## 🏗️ System Architecture Overview

PhishNet follows a modern three-tier architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Web Client    │  │  Mobile Apps    │  │   Admin     │ │
│  │   (React SPA)   │  │   (Future)      │  │  Dashboard  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Node.js + Express Server                  │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │ │
│  │  │   Routes    │  │  Services   │  │   Middleware    │ │ │
│  │  │   Layer     │  │   Layer     │  │     Layer       │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                            │
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │   PostgreSQL    │  │   File System   │                 │
│  │   Database      │  │   (Uploads)     │                 │
│  └─────────────────┘  └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## 🗄️ Database Architecture

### Schema Design
The database follows a straightforward schema with clear data boundaries:

```sql
-- Core Tables Structure
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      users      │────│    campaigns    │
│                 │    │                 │    │                 │
│ • id (PK)       │    │ • id (PK)       │    │ • id (PK)       │
│ • name          │    │ • org_id (FK)   │    │ • org_id (FK)   │
│ • domain        │    │ • email         │    │ • name          │
│ • created_at    │    │ • role          │    │ • status        │
│ • settings      │    │ • last_login    │    │ • created_at    │
└─────────────────┘    │ • status        │    │ • launch_date   │
                       │ • department    │    │ • template_id   │
                       └─────────────────┘    └─────────────────┘
```

### Key Design Principles
1. **Data Isolation**: Clear ownership and references between entities
2. **Referential Integrity**: Strong foreign key relationships
3. **Audit Trail**: Comprehensive logging of all operations
4. **Scalability**: Optimized indexes and query patterns
5. **Security**: Row-level security policies

### Database Tables

#### Core Tables
```sql
-- Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  department VARCHAR(255),
  position VARCHAR(255),
  phone VARCHAR(50),
  last_login TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Campaigns
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  template_id INTEGER REFERENCES templates(id),
  launch_date TIMESTAMP,
  end_date TIMESTAMP,
  target_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  submitted_count INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Supporting Tables
- **templates**: Email and landing page templates
- **groups**: User group management
- **events**: Campaign event tracking
- **results**: Individual user results
- **notifications**: System notifications
- **smtp_profiles**: Email sending configurations
- **landing_pages**: Custom landing pages

## 🔧 Backend Architecture

### Node.js + Express Structure
```
server/
├── app.ts                 # Application entry point
├── routes.ts              # API route definitions
├── storage.ts             # Database operations layer
├── middleware/            # Custom middleware
│   ├── auth.ts           # Authentication middleware
│   ├── validation.ts     # Request validation
│   └── rate-limit.ts     # Rate limiting
├── services/              # Business logic services
│   ├── campaign-service.ts
│   ├── notification-service.ts
│   ├── email-service.ts
│   └── analytics-service.ts
├── utils/                 # Utility functions
│   ├── encryption.ts
│   ├── validation.ts
│   └── helpers.ts
└── types/                 # TypeScript definitions
    └── index.ts
```

### Service Layer Architecture
```typescript
// Service Layer Pattern
interface CampaignService {
  createCampaign(data: CampaignData): Promise<Campaign>;
  launchCampaign(id: number): Promise<void>;
  trackEvent(event: CampaignEvent): Promise<void>;
  generateReport(id: number): Promise<Report>;
}

// Repository Pattern
interface CampaignRepository {
  create(campaign: Campaign): Promise<Campaign>;
  findById(id: number): Promise<Campaign>;
  update(id: number, data: Partial<Campaign>): Promise<Campaign>;
  delete(id: number): Promise<void>;
}
```

### Authentication & Authorization
```typescript
// Session-based Authentication
interface AuthSession {
  userId: number;
  role: string;
  permissions: string[];
  lastActivity: Date;
}

// Basic roles
type UserRole = 'admin' | 'user';
```

## 🖥️ Frontend Architecture

### React + TypeScript Structure
```
client/src/
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components (shadcn/ui)
│   ├── forms/            # Form components
│   ├── charts/           # Data visualization
│   └── layout/           # Layout components
├── pages/                # Route components
│   ├── dashboard/
│   ├── campaigns/
│   ├── users/
│   └── settings/
├── hooks/                # Custom React hooks
│   ├── use-auth.tsx
│   ├── use-api.tsx
│   └── use-permissions.tsx
├── services/             # API service layer
│   ├── api.ts
│   ├── auth.ts
│   └── campaigns.ts
├── stores/               # State management
│   ├── auth-store.ts
│   └── app-store.ts
├── utils/                # Utility functions
│   ├── formatting.ts
│   ├── validation.ts
│   └── constants.ts
└── types/                # TypeScript definitions
    └── index.ts
```

### Component Architecture
```typescript
// Component Pattern
interface ComponentProps {
  data: any;
  onAction: (action: string, data: any) => void;
  loading?: boolean;
  error?: string;
}

// Custom Hook Pattern
function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    // Implementation
  }, []);

  return { campaigns, loading, error, fetchCampaigns };
}
```

## 🔐 Security Architecture

### Security Layers
1. **Network Security**
   - HTTPS enforcement
   - CORS configuration
   - Rate limiting
   - DDoS protection

2. **Application Security**
   - Input validation
   - SQL injection prevention
   - XSS protection
   - CSRF tokens

3. **Authentication Security**
   - Password hashing (bcrypt)
   - Session management
   - Account lockout
   - Multi-factor authentication (planned)

4. **Data Security**
   - Data encryption at rest
   - Secure data transmission
   - Access logging
   - Data anonymization

### Security Implementation
```typescript
// Password Security
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Session Security
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Input Validation
const validateInput = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({ error: 'Invalid input' });
    }
  };
};
```

## 📊 Data Flow Architecture

### Request Flow
```
Client Request
     │
     ▼
┌─────────────┐
│ Express     │
│ Middleware  │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Route       │
│ Handler     │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Service     │
│ Layer       │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Database    │
│ Layer       │
└─────────────┘
```

### Real-time Updates
```typescript
// WebSocket Integration (Future)
interface RealtimeUpdate {
  type: 'campaign_event' | 'notification' | 'status_change';
  data: any;
  timestamp: Date;
}

// Server-Sent Events (Current)
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send updates to client
});
```

## 🚀 Deployment Architecture

### Development Environment
- **Database**: PostgreSQL (local)
- **Server**: Node.js with hot reload
- **Client**: Vite dev server
- **File Storage**: Local filesystem

### Production Environment (Planned)
- **Load Balancer**: Nginx
- **Application**: Node.js cluster
- **Database**: PostgreSQL with replication
- **File Storage**: AWS S3 or similar
- **Caching**: Redis
- **Monitoring**: Application monitoring tools

### Scalability Considerations
1. **Horizontal Scaling**: Stateless application design
2. **Database Optimization**: Query optimization and indexing
3. **Caching Strategy**: Redis for session and data caching
4. **CDN Integration**: Static asset delivery
5. **Microservices**: Future migration to microservices architecture

## 📈 Performance Architecture

### Optimization Strategies
1. **Database Performance**
   - Proper indexing strategy
   - Query optimization
   - Connection pooling
   - Read replicas for analytics

2. **Application Performance**
   - Efficient algorithms
   - Memory management
   - Asynchronous processing
   - Response caching

3. **Frontend Performance**
   - Code splitting
   - Lazy loading
   - Image optimization
   - Bundle optimization

### Monitoring & Analytics
```typescript
// Performance Monitoring
interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  errorRate: number;
}

// Application Analytics
interface Analytics {
  userEngagement: UserMetrics;
  campaignPerformance: CampaignMetrics;
  systemHealth: SystemMetrics;
}
```

---

**Document Version:** 1.0
**Last Updated:** July 25, 2025
**Author:** PhishNet Project Team
**Project:** PhishNet Advanced Phishing Simulation Platform
