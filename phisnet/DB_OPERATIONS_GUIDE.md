# PhishNet Database Operations Guide

## Database Backup & Restore

### Recent Backup
**Created:** 2025-12-10 18:36:37 (UTC-5)  
**File:** `phisnet/backups/phishnet_backup_2025-12-10_18-36-37.sql`  
**Size:** ~16.6 MB

### How to Restore from Backup
```bash
# Using psql
$env:PGPASSWORD='kali'
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h localhost -U postgres -d phishnet -f "backups\phishnet_backup_2025-12-10_18-36-37.sql"

# Or using PowerShell one-liner
$env:PGPASSWORD='kali'; & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h localhost -U postgres -d phishnet < "backups\phishnet_backup_2025-12-10_18-36-37.sql"
```

### How to Create a New Backup
```bash
cd phisnet

# PowerShell
$env:PGPASSWORD='kali'
& 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe' -h localhost -U postgres -d phishnet > "backups\phishnet_backup_$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').sql"

# Or bash (Git Bash / WSL)
export PGPASSWORD='kali'
pg_dump -h localhost -U postgres -d phishnet > "backups/phishnet_backup_$(date +%Y-%m-%d_%H-%M-%S).sql"
```

---

## Inserting Data into the Database

### Method 1: Using TypeScript Scripts (Recommended for App-Specific Data)

#### Create a new insert script in `server/scripts/`:

**Example: `server/scripts/insert-users.ts`**
```typescript
import { db } from '../db';
import { users, organizations } from '@shared/schema';

async function insertUsers() {
  try {
    // Insert into users table
    const newUser = await db.insert(users)
      .values({
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'hashed_password_here',
        organizationId: 1,
        isAdmin: false,
        status: 'active',
      })
      .returning();
    
    console.log('User inserted:', newUser);
  } catch (error) {
    console.error('Error inserting user:', error);
  }
}

insertUsers();
```

**Run the script:**
```bash
cd phisnet
npx tsx server/scripts/insert-users.ts
```

---

### Method 2: Direct SQL via psql (For Raw SQL Inserts)

#### Interactive SQL Insert:
```bash
$env:PGPASSWORD='kali'
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h localhost -U postgres -d phishnet
```

Then run SQL commands:
```sql
-- Insert organization
INSERT INTO organizations (name, industry, description, created_at, updated_at)
VALUES ('Acme Corp', 'Technology', 'Demo Organization', NOW(), NOW());

-- Insert user
INSERT INTO users (
  email, first_name, last_name, password, organization_id, is_admin, status, created_at, updated_at
) VALUES (
  'admin@acme.com', 'Admin', 'User', 'hashed_pwd', 1, true, 'active', NOW(), NOW()
);

-- Insert target group
INSERT INTO groups (name, description, organization_id, created_at, updated_at)
VALUES ('Engineering', 'Engineering Department', 1, NOW(), NOW());

-- Insert targets
INSERT INTO targets (first_name, last_name, email, department, group_id, organization_id, created_at, updated_at)
VALUES ('John', 'Engineer', 'john@acme.com', 'Engineering', 1, 1, NOW(), NOW());

-- View inserted data
SELECT * FROM users WHERE email = 'admin@acme.com';
SELECT * FROM organizations;
SELECT * FROM targets;
```

---

### Method 3: Using Drizzle ORM Studio (GUI)

```bash
cd phisnet
npm run db:studio
```

This opens a browser-based GUI at `http://localhost:5555` where you can:
- Browse all tables
- Insert records with a form
- View and edit existing data
- Run custom queries

---

### Method 4: SQL File Insert (Batch Operations)

**Create `seed-data.sql`:**
```sql
-- Insert multiple organizations
INSERT INTO organizations (name, industry, created_at, updated_at) VALUES
('Org 1', 'Finance', NOW(), NOW()),
('Org 2', 'Healthcare', NOW(), NOW()),
('Org 3', 'Retail', NOW(), NOW())
RETURNING id;

-- Insert SMTP profiles
INSERT INTO smtp_profiles (name, host, port, username, password, from_email, from_name, organization_id, created_at, updated_at)
VALUES (
  'Gmail SMTP',
  'smtp.gmail.com',
  587,
  'your_email@gmail.com',
  'your_app_password',
  'security@company.com',
  'Security Team',
  1,
  NOW(),
  NOW()
);
```

**Run the batch SQL:**
```bash
$env:PGPASSWORD='kali'
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h localhost -U postgres -d phishnet -f "seed-data.sql"
```

---

## Common Insert Patterns

### Insert Campaign
```typescript
const campaign = await db.insert(campaigns)
  .values({
    name: 'Q4 Security Awareness',
    description: 'Q4 phishing simulation',
    organizationId: 1,
    targetGroupId: 1,
    emailTemplateId: 1,
    smtpProfileId: 1,
    landingPageId: 1,
    status: 'draft',
  })
  .returning();
```

### Insert Email Template
```typescript
const template = await db.insert(emailTemplates)
  .values({
    name: 'Password Reset Alert',
    subject: 'Urgent: Verify Your Password',
    html_content: '<h1>Click to verify</h1>',
    text_content: 'Click to verify',
    sender_name: 'IT Support',
    sender_email: 'it@company.com',
    organization_id: 1,
  })
  .returning();
```

### Insert Credential Capture Record
```typescript
const capture = await db.insert(credentialCaptures)
  .values({
    campaignId: 1,
    templateId: 1,
    landingId: 1,
    targetId: 1,
    organizationId: 1,
    email: 'user@company.com',
    username: 'john_doe',
    password: 'submitted_password',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    submittedAt: new Date(),
  })
  .returning();
```

---

## Checking What's in the Database

```bash
# Connect to psql
$env:PGPASSWORD='kali'
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h localhost -U postgres -d phishnet

# Useful queries once inside psql:
\dt                          # List all tables
\d organizations             # Describe organizations table schema
SELECT * FROM organizations; # View all organizations
SELECT COUNT(*) FROM users;  # Count users
\q                           # Exit psql
```

---

## Database Connection Details

| Setting | Value |
|---------|-------|
| **Host** | localhost |
| **Port** | 5432 |
| **Database** | phishnet |
| **User** | postgres |
| **Password** | kali |
| **URL** | postgresql://postgres:kali@localhost:5432/phishnet |

---

## Troubleshooting

### Error: "relation already exists"
**Cause:** Migration tried to create a table that already exists  
**Fix:** Either skip the migration or drop the table first:
```sql
DROP TABLE IF EXISTS table_name CASCADE;
```

### Error: "password authentication failed"
**Check:**
1. Verify PostgreSQL is running: `Get-Service postgres*`
2. Verify credentials in `.env` file
3. Ensure database user exists and password is correct

### Lost connection to database
**Reconnect:**
```bash
# Restart PostgreSQL service
net stop PostgreSQL-x64-17
net start PostgreSQL-x64-17
```

---

## Best Practices

✅ **Do:**
- Always create a backup before making bulk changes
- Use TypeScript scripts for repeatable inserts
- Validate data before inserting
- Use transactions for related inserts (wrap in `db.transaction()`)
- Test inserts in a transaction first before committing

❌ **Don't:**
- Insert directly with hardcoded passwords (use environment variables)
- Skip backups before major operations
- Insert invalid/incomplete records
- Bypass schema validation

---

## Backup Location
`phisnet/backups/` - All backups stored here with timestamp format: `phishnet_backup_YYYY-MM-DD_HH-MM-SS.sql`
