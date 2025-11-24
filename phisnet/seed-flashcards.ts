import { db } from "./server/db";
import { flashcardDecks, flashcards } from "./shared/schema";

const flashcardData = [
  {
    title: "Phishing Basics",
    description: "Learn to identify common phishing tactics and red flags",
    category: "Security Awareness",
    cards: [
      { front: "What is phishing?", back: "A social engineering attack that uses fraudulent emails, messages, or websites to trick victims into revealing sensitive information or installing malware." },
      { front: "What is spear phishing?", back: "A targeted phishing attack aimed at specific individuals or organizations, using personalized information to appear more legitimate." },
      { front: "Name 3 common signs of a phishing email", back: "1) Generic greetings like 'Dear Customer'\n2) Urgent or threatening language\n3) Suspicious links or attachments\n4) Spelling and grammar errors\n5) Requests for sensitive information" },
      { front: "What is whaling?", back: "A type of phishing attack that targets high-profile executives or senior management (the 'big fish' in an organization)." },
      { front: "What should you do if you receive a suspicious email?", back: "1) Don't click any links or open attachments\n2) Don't reply to the email\n3) Report it to your IT/security team\n4) Delete the email\n5) If unsure, verify through a separate communication channel" },
    ]
  },
  {
    title: "Password Security",
    description: "Best practices for creating and managing secure passwords",
    category: "Security Fundamentals",
    cards: [
      { front: "What makes a strong password?", back: "At least 12 characters long, includes uppercase and lowercase letters, numbers, and special characters, avoids dictionary words and personal information." },
      { front: "What is a passphrase?", back: "A longer password made up of multiple words or a sentence, typically easier to remember but harder to crack than traditional passwords." },
      { front: "Should you reuse passwords across different accounts?", back: "No! Each account should have a unique password. If one account is compromised, all accounts with the same password are at risk." },
      { front: "What is two-factor authentication (2FA)?", back: "An extra layer of security requiring a second form of verification (like a code sent to your phone) in addition to your password." },
      { front: "How often should you change your passwords?", back: "Change passwords every 60-90 days, immediately after a suspected breach, and never reuse old passwords." },
      { front: "What is a password manager?", back: "A secure tool that stores and encrypts all your passwords, allowing you to use strong, unique passwords for every account without memorizing them all." },
    ]
  },
  {
    title: "Social Engineering",
    description: "Understanding manipulation tactics used by attackers",
    category: "Security Awareness",
    cards: [
      { front: "What is social engineering?", back: "The psychological manipulation of people to perform actions or divulge confidential information, often exploiting human trust rather than technical vulnerabilities." },
      { front: "What is pretexting?", back: "Creating a fabricated scenario or false identity to gain someone's trust and extract information or access." },
      { front: "What is baiting?", back: "Luring victims with something enticing (like free downloads or USB drives) that contains malware or leads to a trap." },
      { front: "What is tailgating or piggybacking?", back: "Following an authorized person into a restricted area without proper authentication, exploiting courtesy or lack of attention." },
      { front: "Name 3 tactics social engineers use", back: "1) Creating urgency or fear\n2) Impersonating authority figures\n3) Exploiting curiosity or greed\n4) Building rapport and trust\n5) Using information from social media" },
      { front: "How can you protect against social engineering?", back: "1) Verify identities through official channels\n2) Don't share sensitive info over phone/email\n3) Be skeptical of unsolicited requests\n4) Follow security policies\n5) Report suspicious behavior" },
    ]
  },
  {
    title: "Malware Types",
    description: "Identify different types of malicious software",
    category: "Threat Intelligence",
    cards: [
      { front: "What is ransomware?", back: "Malware that encrypts victim's files or locks their system, demanding payment (ransom) for restoration." },
      { front: "What is a trojan horse?", back: "Malware disguised as legitimate software that creates a backdoor for attackers once installed." },
      { front: "What is a computer virus?", back: "Malicious code that replicates by attaching itself to other programs or files, spreading when those files are shared or executed." },
      { front: "What is spyware?", back: "Software that secretly monitors and collects information about a user's activities without their knowledge." },
      { front: "What is a worm?", back: "Self-replicating malware that spreads across networks without requiring user action or host programs." },
      { front: "What is adware?", back: "Software that automatically displays or downloads unwanted advertisements, often bundled with free programs." },
      { front: "What is a rootkit?", back: "Malware designed to hide its presence and maintain privileged access to a system, often by modifying the operating system." },
    ]
  },
  {
    title: "Network Security",
    description: "Fundamental concepts of secure network practices",
    category: "Security Fundamentals",
    cards: [
      { front: "What is a firewall?", back: "A security system that monitors and controls incoming and outgoing network traffic based on predetermined security rules." },
      { front: "What is VPN?", back: "Virtual Private Network - creates an encrypted tunnel between your device and a remote server, protecting your data and hiding your IP address." },
      { front: "What is the difference between HTTP and HTTPS?", back: "HTTPS (HTTP Secure) encrypts data between browser and server using SSL/TLS, while HTTP sends data in plain text. Always look for HTTPS on websites handling sensitive data." },
      { front: "What is Wi-Fi encryption?", back: "Protection for wireless networks using protocols like WPA2 or WPA3 to prevent unauthorized access and protect data in transit." },
      { front: "Why are public Wi-Fi networks risky?", back: "They're often unencrypted, allowing attackers to intercept data, perform man-in-the-middle attacks, or set up fake hotspots." },
      { front: "What is network segmentation?", back: "Dividing a network into smaller isolated segments to contain breaches and limit unauthorized access to sensitive systems." },
    ]
  },
  {
    title: "Data Protection",
    description: "Learn how to safeguard sensitive information",
    category: "Security Fundamentals",
    cards: [
      { front: "What is data encryption?", back: "Converting data into coded format that can only be read with the correct decryption key, protecting confidentiality." },
      { front: "What is PII?", back: "Personally Identifiable Information - data that can identify a specific individual (name, SSN, address, email, etc.)." },
      { front: "What is the principle of least privilege?", back: "Users should only have access to the minimum information and resources necessary to perform their job functions." },
      { front: "What is data classification?", back: "Categorizing data based on sensitivity level (e.g., public, internal, confidential, restricted) to apply appropriate security controls." },
      { front: "What is a data breach?", back: "Unauthorized access, disclosure, or theft of sensitive or confidential information." },
      { front: "What are the 3 pillars of information security (CIA Triad)?", back: "Confidentiality - keeping data private\nIntegrity - ensuring data accuracy\nAvailability - ensuring authorized access when needed" },
    ]
  },
  {
    title: "Mobile Security",
    description: "Protect your mobile devices from threats",
    category: "Device Security",
    cards: [
      { front: "What are the main risks of jailbreaking or rooting?", back: "Removes built-in security protections, exposes device to malware, voids warranty, and prevents security updates." },
      { front: "What is mobile app permission management?", back: "Reviewing and controlling what data and features each app can access (camera, location, contacts, etc.)." },
      { front: "What should you do if your phone is lost or stolen?", back: "1) Remotely lock or wipe the device\n2) Change passwords for accounts\n3) Report to mobile carrier\n4) Report to authorities\n5) Monitor for suspicious activity" },
      { front: "What is mobile phishing (smishing)?", back: "Phishing attacks delivered via SMS text messages, often containing malicious links or requesting sensitive information." },
      { front: "Why should you keep your mobile OS updated?", back: "Updates include critical security patches that fix vulnerabilities attackers could exploit." },
      { front: "What is app sandboxing?", back: "Security feature that isolates apps from each other and the OS to prevent malicious apps from accessing other app data." },
    ]
  },
  {
    title: "Email Security",
    description: "Best practices for secure email communication",
    category: "Security Awareness",
    cards: [
      { front: "What is email spoofing?", back: "Forging an email header to make it appear from a trusted sender, commonly used in phishing attacks." },
      { front: "What is BEC (Business Email Compromise)?", back: "Targeted attack where criminals impersonate executives or vendors to trick employees into transferring money or sensitive data." },
      { front: "What should you check before clicking an email link?", back: "1) Hover over link to see actual URL\n2) Verify sender address\n3) Check for HTTPS\n4) Look for misspellings in domain\n5) When in doubt, navigate directly to site" },
      { front: "What is email encryption?", back: "Scrambling email content so only the intended recipient with the decryption key can read it." },
      { front: "What is SPF, DKIM, and DMARC?", back: "Email authentication protocols that help prevent spoofing and verify legitimate senders." },
    ]
  },
  {
    title: "Incident Response",
    description: "What to do when security incidents occur",
    category: "Security Operations",
    cards: [
      { front: "What are the 6 phases of incident response?", back: "1) Preparation\n2) Identification\n3) Containment\n4) Eradication\n5) Recovery\n6) Lessons Learned" },
      { front: "What should you do immediately after discovering a security incident?", back: "1) Don't panic\n2) Disconnect affected systems from network\n3) Document everything\n4) Report to security team immediately\n5) Don't attempt to fix it yourself" },
      { front: "What is an incident response plan?", back: "A documented set of procedures for detecting, responding to, and recovering from security incidents." },
      { front: "Why is documenting an incident important?", back: "Provides evidence for investigation, helps identify root cause, supports legal proceedings, and improves future response." },
      { front: "What is the difference between an event and an incident?", back: "Event: Any observable occurrence in a system\nIncident: An event that violates security policy or compromises assets" },
    ]
  },
  {
    title: "Cloud Security",
    description: "Understanding security in cloud environments",
    category: "Cloud Computing",
    cards: [
      { front: "What is the shared responsibility model?", back: "Cloud provider secures the infrastructure (hardware, network), while customer secures their data, applications, and access controls." },
      { front: "What is cloud data encryption at rest and in transit?", back: "At rest: encrypting stored data in cloud storage\nIn transit: encrypting data as it moves between user and cloud" },
      { front: "What are the main cloud service models?", back: "IaaS (Infrastructure as a Service)\nPaaS (Platform as a Service)\nSaaS (Software as a Service)" },
      { front: "What is multi-factor authentication for cloud access?", back: "Requiring multiple verification methods (password + phone code + biometric) to access cloud services." },
      { front: "What are cloud access security brokers (CASB)?", back: "Security tools that sit between users and cloud services to enforce security policies and monitor activity." },
      { front: "What is shadow IT?", back: "Unauthorized use of cloud services or applications without IT department approval, creating security risks." },
    ]
  },
];

async function seedFlashcards() {
  try {
    console.log("🎴 Starting flashcard seeding...");

    // Get all organizations from database
    const organizations = await db.query.organizations.findMany();
    
    if (organizations.length === 0) {
      console.log("⚠️  No organizations found. Please seed organizations first.");
      return;
    }

    console.log(`📊 Found ${organizations.length} organizations`);

    // Get admin users for each org
    const adminUsers = await db.query.users.findMany({
      where: (users, { inArray }) => inArray(users.organizationId, organizations.map(o => o.id))
    });

    let totalDecks = 0;
    let totalCards = 0;

    for (const org of organizations) {
      console.log(`\n📁 Seeding flashcards for organization: ${org.name} (ID: ${org.id})`);
      
      // Find an admin or any user in this org
      const creator = adminUsers.find(u => u.organizationId === org.id) || adminUsers[0];
      
      if (!creator) {
        console.log(`⚠️  No users found for org ${org.id}, skipping...`);
        continue;
      }

      // Create all flashcard decks for this org
      for (const deckData of flashcardData) {
        const [deck] = await db.insert(flashcardDecks).values({
          organizationId: org.id,
          title: deckData.title,
          description: deckData.description,
          category: deckData.category,
          createdBy: creator.id,
          published: true, // Auto-publish all decks
        }).returning();

        totalDecks++;
        console.log(`  ✓ Created deck: ${deck.title}`);

        // Create cards for this deck
        for (let i = 0; i < deckData.cards.length; i++) {
          await db.insert(flashcards).values({
            deckId: deck.id,
            frontContent: deckData.cards[i].front,
            backContent: deckData.cards[i].back,
            orderIndex: i,
          });
          totalCards++;
        }
        console.log(`    → Added ${deckData.cards.length} cards`);
      }
    }

    console.log(`\n✅ Flashcard seeding complete!`);
    console.log(`📊 Summary:`);
    console.log(`   - Organizations: ${organizations.length}`);
    console.log(`   - Total Decks: ${totalDecks}`);
    console.log(`   - Total Cards: ${totalCards}`);
    console.log(`   - Avg Cards per Deck: ${(totalCards / totalDecks).toFixed(1)}`);

  } catch (error) {
    console.error("❌ Error seeding flashcards:", error);
    throw error;
  }
}

// Run the seeding
seedFlashcards()
  .then(() => {
    console.log("✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

export { seedFlashcards };
