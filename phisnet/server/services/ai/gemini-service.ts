import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ProfileGenerationRequest {
  firstName: string;
  lastName: string;
  email: string;
  title?: string;
  company: string;
  linkedinProfile?: string;
  additionalInfo?: string;
}

export interface PretextGenerationRequest {
  profile: ProfileGenerationRequest;
  campaignType: 'credential_harvest' | 'malware_delivery' | 'social_engineering' | 'awareness_test';
  urgencyLevel: 'low' | 'medium' | 'high';
  pretext: 'it_support' | 'hr_update' | 'security_alert' | 'document_share' | 'custom';
  customContext?: string;
}

export interface GeneratedProfile {
  summary: string;
  interests: string[];
  workStyle: string;
  likelyVulnerabilities: string[];
  recommendedApproach: string;
}

export interface GeneratedPretext {
  subject: string;
  emailBody: string;
  callToAction: string;
  urgencyIndicators: string[];
  personalizationElements: string[];
}

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  /**
   * Generate a detailed profile for a target individual
   */
  async generateProfile(request: ProfileGenerationRequest): Promise<GeneratedProfile> {
    const prompt = this.buildProfilePrompt(request);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseProfileResponse(text);
    } catch (error) {
      console.error('Error generating profile:', error);
      throw new Error('Failed to generate profile with Gemini AI');
    }
  }

  /**
   * Generate personalized phishing pretext
   */
  async generatePretext(request: PretextGenerationRequest): Promise<GeneratedPretext> {
    const prompt = this.buildPretextPrompt(request);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parsePretextResponse(text);
    } catch (error) {
      console.error('Error generating pretext:', error);
      throw new Error('Failed to generate pretext with Gemini AI');
    }
  }

  /**
   * Analyze company information and suggest email formats
   */
  async analyzeEmailPatterns(companyDomain: string, sampleEmails: string[]): Promise<string[]> {
    const prompt = `
    Analyze the following company domain and sample emails to identify the email format patterns:
    
    Domain: ${companyDomain}
    Sample emails: ${sampleEmails.join(', ')}
    
    Identify the most likely email format patterns used by this organization.
    Common patterns include:
    - firstname.lastname@domain.com
    - firstnamelastname@domain.com  
    - first.last@domain.com
    - flastname@domain.com
    - firstname@domain.com
    
    Return ONLY a JSON array of the most likely patterns in order of probability.
    Example: ["firstname.lastname@domain.com", "flastname@domain.com"]
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\[.*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return ['firstname.lastname@domain.com']; // fallback
    } catch (error) {
      console.error('Error analyzing email patterns:', error);
      return ['firstname.lastname@domain.com']; // fallback
    }
  }

  private buildProfilePrompt(request: ProfileGenerationRequest): string {
    return `
    You are a cybersecurity professional conducting authorized security awareness testing. Generate a detailed profile for the following individual to help create realistic but ethical security training scenarios.

    Individual Information:
    - Name: ${request.firstName} ${request.lastName}
    - Email: ${request.email}
    - Title: ${request.title || 'Unknown'}
    - Company: ${request.company}
    - LinkedIn: ${request.linkedinProfile || 'Not provided'}
    - Additional Info: ${request.additionalInfo || 'None'}

    Create a comprehensive profile that includes:
    1. Professional summary and work style
    2. Likely interests and hobbies (inferred from role/industry)
    3. Potential security vulnerabilities or awareness gaps
    4. Recommended approach for security awareness training

    Format your response as JSON:
    {
      "summary": "Brief professional summary",
      "interests": ["interest1", "interest2", "interest3"],
      "workStyle": "Description of likely work style and habits",
      "likelyVulnerabilities": ["vulnerability1", "vulnerability2"],
      "recommendedApproach": "Suggested training approach"
    }

    Focus on realistic, professional insights that would help in legitimate security awareness training.
    `;
  }

  private buildPretextPrompt(request: PretextGenerationRequest): string {
    const { profile, campaignType, urgencyLevel, pretext, customContext } = request;
    
    return `
    You are a cybersecurity professional creating realistic phishing simulation emails for authorized security awareness training.

    Target Profile:
    - Name: ${profile.firstName} ${profile.lastName}
    - Role: ${profile.title || 'Employee'}
    - Company: ${profile.company}
    - Email: ${profile.email}

    Campaign Parameters:
    - Type: ${campaignType}
    - Urgency: ${urgencyLevel}
    - Pretext: ${pretext}
    - Custom Context: ${customContext || 'None'}

    Create a realistic but safe phishing simulation email that:
    1. Is personalized to the target
    2. Uses appropriate urgency level
    3. Follows the specified pretext
    4. Includes clear indicators this is a simulation (for training purposes)
    5. Has a believable call-to-action

    Format your response as JSON:
    {
      "subject": "Email subject line",
      "emailBody": "Full email body with personalization",
      "callToAction": "Specific action requested",
      "urgencyIndicators": ["indicator1", "indicator2"],
      "personalizationElements": ["element1", "element2"]
    }

    Remember: This is for authorized security awareness training only.
    `;
  }

  private parseProfileResponse(text: string): GeneratedProfile {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error parsing profile response:', error);
    }

    // Fallback response
    return {
      summary: 'Professional individual in their role',
      interests: ['technology', 'professional development', 'industry trends'],
      workStyle: 'Standard office worker with regular email usage',
      likelyVulnerabilities: ['urgency-based attacks', 'authority-based social engineering'],
      recommendedApproach: 'Standard security awareness training with emphasis on email security'
    };
  }

  private parsePretextResponse(text: string): GeneratedPretext {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error parsing pretext response:', error);
    }

    // Fallback response
    return {
      subject: 'Security Awareness Training Exercise',
      emailBody: 'This is a security awareness training exercise. Please follow the instructions provided by your security team.',
      callToAction: 'Contact IT security team for more information',
      urgencyIndicators: ['training exercise'],
      personalizationElements: ['company name', 'role-specific content']
    };
  }
}

export const geminiService = new GeminiService();