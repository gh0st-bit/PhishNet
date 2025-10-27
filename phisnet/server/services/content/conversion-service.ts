import TurndownService from 'turndown';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ConversionResult {
  markdown: string;
  title: string;
  summary: string;
  wordCount: number;
  extractedLinks: string[];
  extractedImages: string[];
}

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  markdown: string;
  metadata: {
    description?: string;
    keywords?: string;
    author?: string;
    publishDate?: string;
  };
  extractedData: {
    emails: string[];
    phoneNumbers: string[];
    socialLinks: string[];
  };
}

class ConversionService {
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '_',
      strongDelimiter: '**',
      linkStyle: 'inlined'
    });

    // Add custom rules for better conversion
    this.setupCustomRules();
  }

  /**
   * Convert HTML string to Markdown
   */
  convertHtmlToMarkdown(html: string): ConversionResult {
    const $ = cheerio.load(html);
    
    // Extract metadata
    const title = $('title').text() || $('h1').first().text() || 'Untitled';
    const extractedLinks = this.extractLinks($);
    const extractedImages = this.extractImages($);
    
    // Clean up the HTML for better conversion
    const cleanedHtml = this.cleanHtml($);
    
    // Convert to markdown
    const markdown = this.turndownService.turndown(cleanedHtml);
    
    // Generate summary (first paragraph or first 200 chars)
    const summary = this.generateSummary(markdown);
    
    // Count words
    const wordCount = this.countWords(markdown);

    return {
      markdown,
      title,
      summary,
      wordCount,
      extractedLinks,
      extractedImages
    };
  }

  /**
   * Scrape and convert a web page to markdown
   */
  async scrapeAndConvert(url: string): Promise<ScrapedContent> {
    try {
      console.log(`🔍 Scraping content from: ${url}`);
      
      // Fetch the web page
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const html = response.data;
      const $ = cheerio.load(html);
      
      // Extract basic information
      const title = $('title').text() || $('h1').first().text() || 'Untitled';
      const content = this.extractMainContent($);
      
      // Convert to markdown
      const conversionResult = this.convertHtmlToMarkdown(html);
      
      // Extract metadata
      const metadata = this.extractMetadata($);
      
      // Extract contact information
      const extractedData = this.extractContactData(html);
      
      console.log(`✅ Successfully scraped and converted: ${title}`);
      
      return {
        url,
        title,
        content,
        markdown: conversionResult.markdown,
        metadata,
        extractedData
      };
      
    } catch (error) {
      console.error(`❌ Error scraping ${url}:`, error);
      throw new Error(`Failed to scrape content from ${url}: ${error}`);
    }
  }

  /**
   * Extract main content from a web page (removes nav, footer, ads, etc.)
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ads, .social-share').remove();
    
    // Try to find main content area
    const mainSelectors = [
      'main',
      'article', 
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '#content',
      '#main'
    ];
    
    for (const selector of mainSelectors) {
      const mainContent = $(selector);
      if (mainContent.length > 0 && mainContent.text().trim().length > 100) {
        return mainContent.html() || '';
      }
    }
    
    // Fallback to body content
    return $('body').html() || '';
  }

  /**
   * Extract metadata from HTML
   */
  private extractMetadata($: cheerio.CheerioAPI) {
    return {
      description: $('meta[name="description"]').attr('content') || 
                  $('meta[property="og:description"]').attr('content'),
      keywords: $('meta[name="keywords"]').attr('content'),
      author: $('meta[name="author"]').attr('content') || 
             $('meta[property="article:author"]').attr('content'),
      publishDate: $('meta[property="article:published_time"]').attr('content') ||
                  $('meta[name="publish-date"]').attr('content')
    };
  }

  /**
   * Extract contact information from HTML content
   */
  private extractContactData(html: string) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
    
    const emails = [...new Set(html.match(emailRegex) || [])];
    const phoneNumbers = [...new Set(html.match(phoneRegex) || [])];
    
    // Extract social media links
    const $ = cheerio.load(html);
    const socialLinks: string[] = [];
    
    $('a[href*="linkedin.com"], a[href*="twitter.com"], a[href*="facebook.com"], a[href*="instagram.com"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        socialLinks.push(href);
      }
    });
    
    return {
      emails,
      phoneNumbers,
      socialLinks: [...new Set(socialLinks)]
    };
  }

  private setupCustomRules() {
    // Remove empty paragraphs
    this.turndownService.addRule('removeEmptyParagraphs', {
      filter: (node) => {
        return node.nodeName === 'P' && node.textContent?.trim() === '';
      },
      replacement: () => ''
    });

    // Better table handling
    this.turndownService.addRule('tables', {
      filter: 'table',
      replacement: (content) => {
        return '\n\n' + content + '\n\n';
      }
    });
  }

  private cleanHtml($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('script, style, noscript, iframe, embed, object').remove();
    
    // Remove empty elements
    $('*').each((_, elem) => {
      const $elem = $(elem);
      if ($elem.text().trim() === '' && $elem.find('img, video, audio').length === 0) {
        $elem.remove();
      }
    });
    
    return $.html();
  }

  private extractLinks($: cheerio.CheerioAPI): string[] {
    const links: string[] = [];
    $('a[href]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && href.startsWith('http')) {
        links.push(href);
      }
    });
    return [...new Set(links)];
  }

  private extractImages($: cheerio.CheerioAPI): string[] {
    const images: string[] = [];
    $('img[src]').each((_, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        images.push(src);
      }
    });
    return [...new Set(images)];
  }

  private generateSummary(markdown: string): string {
    // Remove markdown formatting for summary
    const plainText = markdown
      .replace(/#{1,6}\s/g, '') // headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // bold
      .replace(/\*(.*?)\*/g, '$1') // italic
      .replace(/\[.*?\]\(.*?\)/g, '') // links
      .replace(/```[\s\S]*?```/g, '') // code blocks
      .replace(/`(.*?)`/g, '$1'); // inline code
    
    // Get first paragraph or first 200 characters
    const firstParagraph = plainText.split('\n\n')[0];
    return firstParagraph.length > 200 
      ? firstParagraph.substring(0, 200) + '...'
      : firstParagraph;
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
}

export const conversionService = new ConversionService();