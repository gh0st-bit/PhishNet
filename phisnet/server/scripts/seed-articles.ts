import 'dotenv/config';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { articles, organizations, users } from '../../shared/schema';

async function seedArticles() {
  try {
    // Get first organization
    const orgs = await db.select().from(organizations).limit(1);
    if (orgs.length === 0) {
      console.error('No organization found. Please create an organization first.');
      process.exit(1);
    }
    const orgId = orgs[0].id;
    console.log(`Using organization: ${orgs[0].name} (id=${orgId})`);

    // Get first user from that organization
    const orgUsers = await db.select().from(users).where(eq(users.organizationId, orgId)).limit(1);
    if (orgUsers.length === 0) {
      console.error('No users found in organization. Please create a user first.');
      process.exit(1);
    }
    const userId = orgUsers[0].id;
    console.log(`Using author: ${orgUsers[0].firstName} ${orgUsers[0].lastName} (id=${userId})`);

    // Sample articles data
    const sampleArticles = [
      {
        organizationId: orgId,
        title: "Phishing Awareness Basics",
        content: `# What is Phishing?

Phishing is a cybercrime in which targets are contacted by email, telephone, or text message by someone posing as a legitimate institution to lure individuals into providing sensitive data.

## Common Signs of Phishing

1. **Urgent or threatening language** - "Your account will be closed!"
2. **Suspicious sender address** - Look carefully at the email domain
3. **Generic greetings** - "Dear Customer" instead of your name
4. **Unexpected attachments** - Don't open attachments from unknown senders
5. **Suspicious links** - Hover over links to see the actual URL

## How to Protect Yourself

- Always verify the sender's email address
- Never click on suspicious links
- Use multi-factor authentication
- Keep your software updated
- Report suspicious emails to IT immediately

Remember: When in doubt, always verify through official channels!`,
        excerpt: "Learn the fundamental concepts of phishing attacks and how to identify them.",
        category: "phishing",
        tags: ["phishing", "email-security", "awareness", "basics"],
        thumbnailUrl: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800",
        readTimeMinutes: 5,
        authorId: userId,
        published: true,
        publishedAt: new Date(),
      },
      {
        organizationId: orgId,
        title: "Creating Strong Passwords",
        content: `# Password Best Practices

Strong passwords are your first line of defense against unauthorized access.

## What Makes a Strong Password?

- **Length**: At least 12 characters
- **Complexity**: Mix of uppercase, lowercase, numbers, and symbols
- **Uniqueness**: Different password for each account
- **Unpredictability**: Avoid common words, names, or dates

## Password Do's and Don'ts

### ✅ DO:
- Use a password manager
- Enable multi-factor authentication
- Change passwords if there's a breach
- Use passphrases (e.g., "Coffee!Morning@2025")

### ❌ DON'T:
- Reuse passwords across accounts
- Share passwords with anyone
- Write passwords on sticky notes
- Use personal information

## Password Manager Benefits

A password manager can:
- Generate strong, random passwords
- Store all passwords securely
- Auto-fill login forms
- Sync across devices

Invest in your security today!`,
        excerpt: "Master the art of creating and managing secure passwords.",
        category: "passwords",
        tags: ["passwords", "security", "authentication", "best-practices"],
        thumbnailUrl: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800",
        readTimeMinutes: 7,
        authorId: userId,
        published: true,
        publishedAt: new Date(),
      },
      {
        organizationId: orgId,
        title: "Social Engineering: The Human Factor",
        content: `# Understanding Social Engineering

Social engineering attacks exploit human psychology rather than technical vulnerabilities.

## Types of Social Engineering Attacks

### 1. Pretexting
Attackers create a fabricated scenario to obtain information. Example: Someone claiming to be from IT support asking for your password.

### 2. Baiting
Offering something enticing to trick victims. Example: Free USB drives left in parking lots.

### 3. Tailgating
Following authorized personnel into restricted areas without proper credentials.

### 4. Quid Pro Quo
Requesting information in exchange for a service. Example: "Give me your login, and I'll fix your computer."

## Red Flags to Watch For

- Unusual requests for sensitive information
- Pressure to act immediately
- Requests to bypass normal procedures
- Too good to be true offers
- Unverified identities

## Defense Strategies

1. **Verify identities** through known contact methods
2. **Follow protocols** even when pressured
3. **Report suspicious behavior** to security team
4. **Think before you act** - slow down and assess
5. **Trust your instincts** - if something feels off, it probably is

Stay vigilant and protect your organization!`,
        excerpt: "Understand social engineering tactics and how to defend against them.",
        category: "social_engineering",
        tags: ["social-engineering", "security", "awareness", "psychology"],
        thumbnailUrl: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=800",
        readTimeMinutes: 10,
        authorId: userId,
        published: true,
        publishedAt: new Date(),
      },
      {
        organizationId: orgId,
        title: "Data Protection and Privacy",
        content: `# Protecting Sensitive Data

Data protection is everyone's responsibility. Learn how to handle sensitive information properly.

## Types of Sensitive Data

- Personal Identifiable Information (PII)
- Financial records
- Health information
- Intellectual property
- Trade secrets

## Data Protection Principles

### Confidentiality
Ensure only authorized individuals access sensitive data.

### Integrity
Maintain accuracy and completeness of data.

### Availability
Ensure data is accessible when needed by authorized users.

## Best Practices

### At Work
- Lock your computer when away from desk
- Use encrypted email for sensitive information
- Shred physical documents
- Follow clean desk policy
- Report data breaches immediately

### At Home
- Use VPN for remote work
- Secure your home network
- Keep work and personal devices separate
- Avoid public Wi-Fi for work tasks

## Regulatory Compliance

Understanding regulations like:
- GDPR (General Data Protection Regulation)
- HIPAA (Health Insurance Portability and Accountability Act)
- PCI DSS (Payment Card Industry Data Security Standard)

Your role in compliance matters!`,
        excerpt: "Essential guidelines for protecting sensitive information.",
        category: "data_protection",
        tags: ["data-protection", "privacy", "compliance", "gdpr"],
        thumbnailUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800",
        readTimeMinutes: 8,
        authorId: userId,
        published: true,
        publishedAt: new Date(),
      },
      {
        organizationId: orgId,
        title: "Mobile Security Essentials",
        content: `# Securing Your Mobile Devices

Mobile devices are now primary targets for cyber attacks. Here's how to protect them.

## Common Mobile Threats

1. **Malicious Apps** - Apps that steal data or damage devices
2. **Unsecured Wi-Fi** - Public networks that intercept communications
3. **Phishing SMS** (Smishing) - Fraudulent text messages
4. **Lost/Stolen Devices** - Physical access to sensitive data

## Security Measures

### Device Settings
- Use strong passcodes or biometrics
- Enable automatic updates
- Activate "Find My Device" features
- Enable remote wipe capability
- Use device encryption

### App Safety
- Download only from official stores
- Review app permissions carefully
- Remove unused apps
- Keep apps updated
- Avoid rooting/jailbreaking

### Network Security
- Avoid public Wi-Fi for sensitive tasks
- Use VPN when connecting to public networks
- Disable auto-connect to Wi-Fi
- Turn off Bluetooth when not needed

## For Business Use

If you use mobile devices for work:
- Separate work and personal apps
- Use mobile device management (MDM)
- Follow company BYOD policies
- Report lost devices immediately
- Regular security training

Stay secure on the go!`,
        excerpt: "Protect your mobile devices from modern security threats.",
        category: "general",
        tags: ["mobile-security", "smartphones", "apps", "wifi"],
        thumbnailUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800",
        readTimeMinutes: 6,
        authorId: userId,
        published: true,
        publishedAt: new Date(),
      },
      {
        organizationId: orgId,
        title: "Incident Response: What to Do When Attacked",
        content: `# Responding to Security Incidents

Quick and proper response to security incidents can minimize damage. Here's your action plan.

## Immediate Actions

### If You Suspect Compromise

1. **Don't Panic** - Stay calm and think clearly
2. **Disconnect** - Isolate affected systems if possible
3. **Document** - Note what happened and when
4. **Report** - Contact IT/Security team immediately
5. **Preserve Evidence** - Don't delete logs or files

## Types of Incidents

### Data Breach
- Change passwords immediately
- Notify affected parties
- Follow breach notification procedures

### Ransomware
- Do not pay ransom
- Disconnect from network
- Report to authorities
- Restore from backups

### Phishing Victim
- Change compromised credentials
- Notify IT security
- Monitor accounts for suspicious activity
- Alert others who may be targeted

## Reporting Procedures

### What to Report
- Suspicious emails
- Lost/stolen devices
- Unauthorized access
- Malware infections
- Data leaks

### How to Report
- Use official incident reporting channels
- Provide detailed information
- Include screenshots if possible
- Follow up as requested

## Post-Incident

- Participate in incident review
- Learn from the experience
- Update security measures
- Share lessons learned
- Stay vigilant for follow-up attacks

Remember: Early reporting saves time and reduces damage!`,
        excerpt: "Learn the proper steps to take when facing a security incident.",
        category: "incident_response",
        tags: ["incident-response", "security", "emergency", "procedures"],
        thumbnailUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800",
        readTimeMinutes: 9,
        authorId: userId,
        published: false, // This one is draft to test filtering
        publishedAt: new Date(),
      },
    ];

    // Check for existing articles to avoid duplicates
    const existingArticles = await db.select().from(articles).where(eq(articles.organizationId, orgId));
    const existingTitles = new Set(existingArticles.map(a => a.title));

    const articlesToInsert = sampleArticles.filter(a => !existingTitles.has(a.title));

    if (articlesToInsert.length === 0) {
      console.log('All sample articles already exist. Skipping insertion.');
      process.exit(0);
    }

    const insertedArticles = await db.insert(articles).values(articlesToInsert).returning();
    
    console.log(`✅ Successfully inserted ${insertedArticles.length} articles:`);
    insertedArticles.forEach((article, idx) => {
      console.log(`   ${idx + 1}. "${article.title}" (${article.published ? 'Published' : 'Draft'})`);
    });

    console.log('\n📊 Summary:');
    console.log(`   Total articles in DB: ${existingArticles.length + insertedArticles.length}`);
    console.log(`   Published: ${insertedArticles.filter(a => a.published).length}`);
    console.log(`   Drafts: ${insertedArticles.filter(a => !a.published).length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed articles:', error);
    process.exit(1);
  }
}

seedArticles();
