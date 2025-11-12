import { db } from './db';
import { users, organizations, campaigns, groups, targets, campaignResults, emailTemplates, landingPages, smtpProfiles } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Seed script to add realistic Pakistani-style data for umarwaqar@mail.com
 * Creates 3 months of campaign history with Pakistani names and realistic metrics
 */

const PAKISTANI_NAMES = [
  'Ahmed Ali', 'Muhammad Abdullah', 'Ali Hassan', 'Usman Khan', 'Bilal Ahmed',
  'Hamza Malik', 'Zain Abbas', 'Faisal Mahmood', 'Talha Hussain', 'Arslan Shah',
  'Imran Siddiqui', 'Kamran Iqbal', 'Shahzad Akram', 'Adnan Rashid', 'Farhan Aslam',
  'Hassan Raza', 'Junaid Tariq', 'Kashif Saeed', 'Nasir Mehmood', 'Omar Farooq',
  'Qasim Nawaz', 'Rizwan Butt', 'Salman Haider', 'Tariq Aziz', 'Waqar Younas',
  'Yasir Chaudhry', 'Zahid Latif', 'Asad Ullah', 'Babar Azam', 'Danish Rauf',
  'Ehsan Qadir', 'Fahad Mustafa', 'Ghulam Abbas', 'Haris Sohail', 'Ibrahim Khan',
  'Jawad Alam', 'Kaleem Baig', 'Luqman Waheed', 'Moiz Ahmed', 'Nabeel Qureshi'
];

const PAKISTANI_COMPANIES = [
  'National Bank of Pakistan', 'Allied Bank Limited', 'Habib Bank', 'MCB Bank',
  'United Bank Limited', 'Faysal Bank', 'Bank Alfalah', 'Meezan Bank',
  'Pakistan Telecom', 'Telenor Pakistan', 'Jazz (Mobilink)', 'Zong Pakistan',
  'Systems Limited', 'NetSol Technologies', 'TPS Pakistan', 'Inbox Business Technologies'
];

const PAKISTANI_DOMAINS = [
  'netsol.com', 'tps.com.pk', 'systemsltd.com', 'pknic.net.pk',
  'ptcl.net.pk', 'ubldigital.com', 'mcb.com.pk', 'hbl.com',
  'nayatel.com', 'comsats.edu.pk', 'lums.edu.pk', 'nust.edu.pk'
];

function generateEmail(name: string, domain: string): string {
  const firstName = name.split(' ')[0].toLowerCase();
  const lastName = name.split(' ')[1]?.toLowerCase() || '';
  const random = Math.random();
  
  if (random < 0.5) {
    return `${firstName}.${lastName}@${domain}`;
  } else if (random < 0.8) {
    return `${firstName}${lastName}@${domain}`;
  } else {
    return `${firstName.charAt(0)}${lastName}@${domain}`;
  }
}

function getRandomDate(startDate: Date, endDate: Date): Date {
  const start = startDate.getTime();
  const end = endDate.getTime();
  return new Date(start + Math.random() * (end - start));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function seedPakistaniData() {
  console.log('🇵🇰 Starting Pakistani data seeding...');

  try {
    // 1. Find the user
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, 'umarwaqar@mail.com'))
      .limit(1);

    if (!user) {
      console.error('❌ User umarwaqar@mail.com not found. Please create the user first.');
      return;
    }

    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (ID: ${user.id})`);

    if (!user.organizationId) {
      console.error('❌ User does not have an organization assigned.');
      return;
    }

    const orgId = user.organizationId;

    // 2. Get organization details
    const [org] = await db.select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    console.log(`✅ Organization: ${org.name} (ID: ${orgId})`);

    // 3. Create SMTP Profile
    console.log('📧 Creating SMTP profile...');
    const [smtpProfile] = await db.insert(smtpProfiles)
      .values({
        name: 'Pakistan Office SMTP',
        host: 'smtp.gmail.com',
        port: 587,
        username: 'alerts@pkcompany.com',
        password: 'encrypted_password_here',
        fromEmail: 'security@pkcompany.com',
        fromName: 'IT Security Team',
        organizationId: orgId,
      })
      .returning();

    console.log(`✅ SMTP Profile created: ${smtpProfile.name}`);

    // 4. Create Email Templates
    console.log('📝 Creating email templates...');
    const templates = [
      {
        name: 'IT Helpdesk Password Reset',
        subject: 'Urgent: Password Expiry Notice',
        html_content: `
          <html>
            <body style="font-family: Arial, sans-serif;">
              <h2>Password Expiry Notice</h2>
              <p>Dear {{.FirstName}},</p>
              <p>Your company password will expire in 24 hours. Please reset it immediately to avoid account suspension.</p>
              <p><a href="{{.URL}}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password Now</a></p>
              <p>If you did not request this, please contact IT Helpdesk.</p>
              <p>Regards,<br>IT Security Team</p>
            </body>
          </html>
        `,
        text_content: 'Your password will expire soon. Reset at: {{.URL}}',
        type: 'phishing',
        organization_id: orgId,
        sender_name: 'IT Helpdesk',
        sender_email: 'ithelpdesk@company.local',
        description: 'Password reset urgency template'
      },
      {
        name: 'HR Document Review',
        subject: 'Action Required: Review Your Employee Documents',
        html_content: `
          <html>
            <body style="font-family: Arial, sans-serif;">
              <h2>Employee Document Review</h2>
              <p>Dear {{.FirstName}},</p>
              <p>The HR department requires you to review and update your employee documents.</p>
              <p>Please click below to access the secure portal:</p>
              <p><a href="{{.URL}}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Access HR Portal</a></p>
              <p>This is time-sensitive and must be completed within 48 hours.</p>
              <p>Human Resources Department</p>
            </body>
          </html>
        `,
        text_content: 'HR requires document review. Access portal: {{.URL}}',
        type: 'phishing',
        organization_id: orgId,
        sender_name: 'HR Department',
        sender_email: 'hr@company.com',
        description: 'HR urgency template'
      },
      {
        name: 'Bank Security Alert',
        subject: 'Security Alert: Unusual Activity Detected',
        html_content: `
          <html>
            <body style="font-family: Arial, sans-serif;">
              <h2 style="color: #dc3545;">Security Alert</h2>
              <p>Dear Valued Customer,</p>
              <p>We have detected unusual activity on your account. For your security, we have temporarily suspended your account.</p>
              <p>Please verify your identity immediately:</p>
              <p><a href="{{.URL}}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Account</a></p>
              <p>Failure to verify within 24 hours will result in permanent account closure.</p>
              <p>Customer Security Team<br>National Bank</p>
            </body>
          </html>
        `,
        text_content: 'Security alert. Verify account: {{.URL}}',
        type: 'phishing',
        organization_id: orgId,
        sender_name: 'Bank Security',
        sender_email: 'security@nationalbank.pk',
        description: 'Banking security alert'
      }
    ];

    const createdTemplates = [];
    for (const template of templates) {
      const [created] = await db.insert(emailTemplates)
        .values(template)
        .returning();
      createdTemplates.push(created);
      console.log(`  ✅ Template: ${created.name}`);
    }

    // 5. Create Landing Pages
    console.log('🎨 Creating landing pages...');
    const landingPageData = [
      {
        name: 'Fake Password Reset Portal',
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head><title>Password Reset</title></head>
          <body style="font-family: Arial; max-width: 500px; margin: 50px auto; padding: 20px; border: 1px solid #ccc;">
            <h2>Reset Your Password</h2>
            <form id="phishForm">
              <p>Enter your credentials to reset your password:</p>
              <input type="text" name="username" placeholder="Username" required style="width: 100%; padding: 10px; margin: 10px 0;">
              <input type="password" name="password" placeholder="Current Password" required style="width: 100%; padding: 10px; margin: 10px 0;">
              <input type="password" name="newpassword" placeholder="New Password" required style="width: 100%; padding: 10px; margin: 10px 0;">
              <button type="submit" style="width: 100%; padding: 10px; background: #0066cc; color: white; border: none; cursor: pointer;">Reset Password</button>
            </form>
          </body>
          </html>
        `,
        organizationId: orgId,
        captureData: true,
        pageType: 'phishing',
        redirectUrl: 'https://www.google.com'
      },
      {
        name: 'Fake HR Portal',
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head><title>HR Employee Portal</title></head>
          <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5;">
            <div style="background: white; padding: 30px; border-radius: 5px;">
              <h2>Employee Document Portal</h2>
              <form id="phishForm">
                <p>Please login to access your documents:</p>
                <input type="email" name="email" placeholder="Email Address" required style="width: 100%; padding: 10px; margin: 10px 0;">
                <input type="password" name="password" placeholder="Password" required style="width: 100%; padding: 10px; margin: 10px 0;">
                <button type="submit" style="width: 100%; padding: 10px; background: #28a745; color: white; border: none; cursor: pointer;">Login</button>
              </form>
            </div>
          </body>
          </html>
        `,
        organizationId: orgId,
        captureData: true,
        pageType: 'phishing',
        redirectUrl: 'https://www.google.com'
      }
    ];

    const createdLandingPages = [];
    for (const page of landingPageData) {
      const [created] = await db.insert(landingPages)
        .values(page)
        .returning();
      createdLandingPages.push(created);
      console.log(`  ✅ Landing Page: ${created.name}`);
    }

    // 6. Create Groups with Pakistani employees
    console.log('👥 Creating employee groups...');
    const departmentGroups = [
      { name: 'IT Department', count: 15 },
      { name: 'Finance Team', count: 12 },
      { name: 'HR Department', count: 8 },
      { name: 'Sales & Marketing', count: 20 },
      { name: 'Operations', count: 18 },
      { name: 'Management', count: 10 }
    ];

    const allTargets: any[] = [];
    const allGroups: any[] = [];
    let nameIndex = 0;

    for (const dept of departmentGroups) {
      const [group] = await db.insert(groups)
        .values({
          name: dept.name,
          organizationId: orgId,
        })
        .returning();

      allGroups.push(group);
      console.log(`  ✅ Group: ${group.name}`);

      // Create targets for this group
      const groupTargets = [];
      for (let i = 0; i < dept.count; i++) {
        const name = PAKISTANI_NAMES[nameIndex % PAKISTANI_NAMES.length];
        const domain = PAKISTANI_DOMAINS[Math.floor(Math.random() * PAKISTANI_DOMAINS.length)];
        const email = generateEmail(name, domain);
        const [firstName, lastName] = name.split(' ');

        const [target] = await db.insert(targets)
          .values({
            firstName,
            lastName,
            email,
            position: dept.name.includes('Management') ? 'Manager' : 'Employee',
            department: dept.name,
            groupId: group.id,
            organizationId: orgId,
          })
          .returning();

        groupTargets.push(target);
        allTargets.push(target);
        nameIndex++;
      }

      console.log(`    ➕ Added ${groupTargets.length} employees`);
    }

    console.log(`✅ Total employees created: ${allTargets.length}`);

    // 7. Create Campaigns (spanning 3 months)
    console.log('🎯 Creating campaigns...');
    
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

    const campaignConfigs = [
      {
        name: 'Q3 Security Awareness - Password Hygiene',
        templateIndex: 0,
        landingPageIndex: 0,
        startOffset: -90, // days ago
        daysToRun: 7,
        targetPercentage: 0.6, // 60% of employees
        openRate: 0.75,
        clickRate: 0.35,
        submitRate: 0.15
      },
      {
        name: 'HR Policy Update Campaign',
        templateIndex: 1,
        landingPageIndex: 1,
        startOffset: -75,
        daysToRun: 5,
        targetPercentage: 0.8,
        openRate: 0.82,
        clickRate: 0.42,
        submitRate: 0.18
      },
      {
        name: 'Banking Security Phishing Test',
        templateIndex: 2,
        landingPageIndex: 0,
        startOffset: -60,
        daysToRun: 3,
        targetPercentage: 0.5,
        openRate: 0.68,
        clickRate: 0.28,
        submitRate: 0.12
      },
      {
        name: 'IT Department Targeted Test',
        templateIndex: 0,
        landingPageIndex: 0,
        startOffset: -45,
        daysToRun: 4,
        targetPercentage: 0.4,
        openRate: 0.58,
        clickRate: 0.22,
        submitRate: 0.08
      },
      {
        name: 'Executive Team Spear Phishing',
        templateIndex: 2,
        landingPageIndex: 1,
        startOffset: -30,
        daysToRun: 2,
        targetPercentage: 0.3,
        openRate: 0.45,
        clickRate: 0.18,
        submitRate: 0.06
      },
      {
        name: 'All Staff Security Baseline',
        templateIndex: 1,
        landingPageIndex: 0,
        startOffset: -15,
        daysToRun: 7,
        targetPercentage: 1.0,
        openRate: 0.88,
        clickRate: 0.48,
        submitRate: 0.22
      },
      {
        name: 'Finance Team Social Engineering',
        templateIndex: 2,
        landingPageIndex: 1,
        startOffset: -7,
        daysToRun: 3,
        targetPercentage: 0.35,
        openRate: 0.52,
        clickRate: 0.20,
        submitRate: 0.09
      },
      {
        name: 'October Security Drill',
        templateIndex: 0,
        landingPageIndex: 0,
        startOffset: -2,
        daysToRun: 5,
        targetPercentage: 0.7,
        openRate: 0.65,
        clickRate: 0.30,
        submitRate: 0.12
      }
    ];

    for (const config of campaignConfigs) {
      const startDate = addDays(now, config.startOffset);
      const endDate = addDays(startDate, config.daysToRun);
      const isCompleted = endDate < now;
      const isRunning = startDate <= now && endDate >= now;

      const [campaign] = await db.insert(campaigns)
        .values({
          name: config.name,
          emailTemplateId: createdTemplates[config.templateIndex].id,
          landingPageId: createdLandingPages[config.landingPageIndex].id,
          smtpProfileId: smtpProfile.id,
          targetGroupId: allGroups[0].id, // Use first group
          organizationId: orgId,
          status: isCompleted ? 'completed' : isRunning ? 'running' : 'draft',
          scheduledAt: startDate,
          createdById: user.id,
        })
        .returning();

      console.log(`  ✅ Campaign: ${campaign.name} (${campaign.status})`);

      // Select random targets for this campaign
      const shuffled = [...allTargets].sort(() => Math.random() - 0.5);
      const selectedTargets = shuffled.slice(0, Math.floor(allTargets.length * config.targetPercentage));

      // Create campaign results
      let resultsCreated = 0;
      for (const target of selectedTargets) {
        const wasOpened = Math.random() < config.openRate;
        const wasClicked = wasOpened && Math.random() < (config.clickRate / config.openRate);
        const wasSubmitted = wasClicked && Math.random() < (config.submitRate / config.clickRate);

        const sentAt = getRandomDate(startDate, new Date(Math.min(endDate.getTime(), now.getTime())));
        const openedAt = wasOpened ? getRandomDate(sentAt, addDays(sentAt, 1)) : null;
        const clickedAt = wasClicked ? getRandomDate(openedAt!, addDays(openedAt!, 0.5)) : null;

        await db.insert(campaignResults)
          .values({
            campaignId: campaign.id,
            targetId: target.id,
            organizationId: orgId,
            status: wasSubmitted ? 'submitted' : wasClicked ? 'clicked' : wasOpened ? 'opened' : 'sent',
            sentAt,
            opened: wasOpened,
            openedAt,
            clicked: wasClicked,
            clickedAt,
            submittedData: wasSubmitted ? JSON.stringify({
              username: target.email,
              password: '********',
              timestamp: clickedAt?.toISOString()
            }) : null,
          });

        resultsCreated++;
      }

      console.log(`    ➕ Created ${resultsCreated} campaign results`);
    }

    console.log('\n✅ Pakistani data seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Organization: ${org.name}`);
    console.log(`   - Total Employees: ${allTargets.length}`);
    console.log(`   - Departments: ${departmentGroups.length}`);
    console.log(`   - Email Templates: ${createdTemplates.length}`);
    console.log(`   - Landing Pages: ${createdLandingPages.length}`);
    console.log(`   - Campaigns: ${campaignConfigs.length}`);
    console.log(`   - Time Range: Last 3 months`);
    console.log(`\n🎉 Dashboard for umarwaqar@mail.com should now show comprehensive data!`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
}

// Run the seed function
seedPakistaniData()
  .then(() => {
    console.log('✅ Seeding complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
