import { db } from '../../db';
import { threatIntelligence, threatStatistics } from '@shared/schema';
import { eq, sql, and, desc, gte } from 'drizzle-orm';
import type { ThreatIntelligence, InsertThreatIntelligence } from '@shared/schema';
import { UrlhausFeedProvider } from './urlhaus-provider';
import { OpenPhishFeedProvider } from './openphish-provider';
import { ThreatFoxProvider } from './threatfox-provider';
import { OTXProvider } from './otx-provider';
import { PhishingDatabaseProvider } from './phishing-database-provider';
import type { ThreatData, ThreatFeedProvider } from './threat-feed-base';

export interface ThreatAnalysis {
  totalThreats: number;
  newThreatsToday: number;
  activeSources: number;
  topThreatTypes: Array<{ type: string; count: number }>;
  recentThreats: ThreatIntelligence[];
  threatTrends: Array<{ date: string; count: number; type: string }>;
}

export class ThreatIntelligenceService {
  private readonly providers: ThreatFeedProvider[] = [];
  private isIngesting = false;

  constructor() {
    this.providers = [
      new UrlhausFeedProvider(),
      new OpenPhishFeedProvider(),
      new ThreatFoxProvider(),
      new OTXProvider(),
      new PhishingDatabaseProvider(),
    ];
  }

  /**
   * Orchestrate threat feed ingestion from all providers
   */
  async ingestAllFeeds(): Promise<void> {
    if (this.isIngesting) {
      console.log('⏳ Threat feed ingestion already in progress...');
      return;
    }

    this.isIngesting = true;
    console.log('🔄 Starting threat feed ingestion...');

    try {
      const results = await Promise.allSettled(
        this.providers.map(provider => this.ingestFromProvider(provider))
      );

      let totalIngested = 0;
      results.forEach((result, index) => {
        const providerName = this.providers[index].name;
        if (result.status === 'fulfilled') {
          totalIngested += result.value;
          console.log(`✅ ${providerName}: ${result.value} threats ingested`);
        } else {
          console.error(`❌ ${providerName} failed:`, result.reason);
        }
      });

      // Update statistics
      await this.updateThreatStatistics();

      console.log(`🎉 Threat feed ingestion completed. Total: ${totalIngested} new threats`);
    } catch (error) {
      console.error('💥 Threat feed ingestion failed:', error);
    } finally {
      this.isIngesting = false;
    }
  }

  /**
   * Ingest threats from a specific provider
   */
  private async ingestFromProvider(provider: ThreatFeedProvider): Promise<number> {
    try {
      const threats = await provider.fetchThreats();
      
      if (threats.length === 0) {
        return 0;
      }

      return await this.storeThreatData(threats);
    } catch (error) {
      console.error(`Error ingesting from ${provider.name}:`, error);
      return 0;
    }
  }

  /**
   * Store threat data in database with deduplication
   */
  private async storeThreatData(threats: ThreatData[]): Promise<number> {
    if (threats.length === 0) return 0;

    try {
      // Get existing threats to avoid duplicates
      const existingThreats = await db
        .select({ url: threatIntelligence.url, domain: threatIntelligence.domain })
        .from(threatIntelligence)
        .where(
          and(
            eq(threatIntelligence.source, threats[0].source),
            gte(threatIntelligence.firstSeen, new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
          )
        );

      const existingSet = new Set(
        existingThreats.map(t => t.url || t.domain).filter(Boolean)
      );

      // Filter out duplicates
      const newThreats = threats.filter(threat => {
        const key = threat.url || threat.domain;
        return key && !existingSet.has(key);
      });

      console.log(`[${threats[0]?.source || 'unknown'}] Total: ${threats.length}, Existing: ${existingThreats.length}, New: ${newThreats.length}`);

      if (newThreats.length === 0) {
        return 0;
      }

      // Convert to database format with data sanitization
      const dbThreats: InsertThreatIntelligence[] = newThreats.map(threat => {
        const normalizedIndicator = (threat.indicator || threat.url || threat.domain || '')
          ?.toString()
          .trim()
          .toLowerCase() || null;
        const dbThreat = {
          url: this.sanitizeText(threat.url, 2000) || null,
          domain: this.sanitizeText(threat.domain, 255) || null,
          indicator: threat.indicator || null, // Now TEXT type, no limit needed
          indicatorType: this.sanitizeText(threat.indicatorType, 50) || null,
          threatType: this.sanitizeText(threat.threatType, 100) || null,
          malwareFamily: this.sanitizeText(threat.malwareFamily, 100) || null,
          campaignName: this.sanitizeText(threat.campaignName, 200) || null,
          source: threat.source,
          confidence: threat.confidence || 50,
          isActive: true,
          firstSeen: threat.firstSeen || new Date(),
          lastSeen: threat.lastSeen || null,
          expiresAt: null,
          tags: threat.tags || [],
          description: threat.description || null,
          rawData: threat.rawData || null,
          usedInSimulations: false,
          organizationId: null, // Global threats
          normalizedIndicator
        };
        
        // Log threat being stored for debugging
        if (threat.source === 'alienvault-otx') {
          console.log(`[STORE] OTX Threat: ${threat.threatType} | Domain: ${threat.domain} | Active: ${dbThreat.isActive} | Family: ${threat.malwareFamily}`);
        }
        
        return dbThreat;
      });

      // Batch upsert using unique index on normalizedIndicator
      await db
        .insert(threatIntelligence)
        .values(dbThreats)
        .onConflictDoUpdate({
          target: threatIntelligence.normalizedIndicator,
          set: {
            // Update freshness and confidence if we see it again
            lastSeen: sql`GREATEST(${threatIntelligence.lastSeen}, NOW())`,
            confidence: sql`GREATEST(${threatIntelligence.confidence}, EXCLUDED.confidence)`,
            isActive: true,
            updatedAt: sql`NOW()`
          }
        });

      return dbThreats.length;
    } catch (error) {
      console.error('Error storing threat data:', error);
      return 0;
    }
  }

  /**
   * Get threat analysis for dashboard
   */
  async getThreatAnalysis(organizationId?: number): Promise<ThreatAnalysis> {
    try {
      const [
        totalThreats,
        newThreatsToday,
        activeSources,
        topThreatTypes,
        recentThreats,
        threatTrends
      ] = await Promise.all([
        this.getTotalThreatsCount(),
        this.getNewThreatsToday(),
        this.getActiveSourcesCount(),
        this.getTopThreatTypes(),
        this.getRecentThreats(10),
        this.getThreatTrends(7)
      ]);

      return {
        totalThreats: totalThreats[0]?.count || 0,
        newThreatsToday: newThreatsToday[0]?.count || 0,
        activeSources: activeSources[0]?.count || 0,
        topThreatTypes: topThreatTypes.map(t => ({ 
          type: t.threatType || 'unknown', 
          count: t.count || 0 
        })),
        recentThreats,
        threatTrends: threatTrends.map(t => ({
          date: t.date || '',
          count: t.count || 0,
          type: t.threatType || 'unknown'
        }))
      };
    } catch (error) {
      console.error('Error getting threat analysis:', error);
      return {
        totalThreats: 0,
        newThreatsToday: 0,
        activeSources: 0,
        topThreatTypes: [],
        recentThreats: [],
        threatTrends: []
      };
    }
  }

  /**
   * Get recent threats for dashboard
   */
  async getRecentThreats(limit: number = 50): Promise<ThreatIntelligence[]> {
    // Get a mix of recent threats from different types to ensure variety
    const threatsPerType = Math.ceil(limit / 2); // Split between threat types
    
    // Get recent phishing threats
    const phishingThreats = await db
      .select()
      .from(threatIntelligence)
      .where(
        and(
          eq(threatIntelligence.isActive, true),
          eq(threatIntelligence.threatType, 'phishing')
        )
      )
      .orderBy(desc(threatIntelligence.firstSeen))
      .limit(threatsPerType);
    
    // Get recent malware threats
    const malwareThreats = await db
      .select()
      .from(threatIntelligence)
      .where(
        and(
          eq(threatIntelligence.isActive, true),
          eq(threatIntelligence.threatType, 'malware')
        )
      )
      .orderBy(desc(threatIntelligence.firstSeen))
      .limit(threatsPerType);
    
    // Combine and sort all threats by firstSeen
    const allThreats = [...phishingThreats, ...malwareThreats];
    const sorted = allThreats.slice().sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime());
    return sorted.slice(0, limit);
  }

  /**
   * Search threats by domain, URL, threat type, malware family, or description
   */
  async searchThreats(query: string, limit: number = 20): Promise<ThreatIntelligence[]> {
    return db
      .select()
      .from(threatIntelligence)
      .where(
        and(
          eq(threatIntelligence.isActive, true),
          sql`(
            ${threatIntelligence.url} ILIKE ${'%' + query + '%'} OR 
            ${threatIntelligence.domain} ILIKE ${'%' + query + '%'} OR 
            ${threatIntelligence.threatType} ILIKE ${'%' + query + '%'} OR 
            ${threatIntelligence.malwareFamily} ILIKE ${'%' + query + '%'} OR 
            ${threatIntelligence.description} ILIKE ${'%' + query + '%'} OR
            ${threatIntelligence.campaignName} ILIKE ${'%' + query + '%'}
          )`
        )
      )
      .orderBy(desc(threatIntelligence.confidence), desc(threatIntelligence.firstSeen))
      .limit(limit);
  }

  private async getTotalThreatsCount() {
    return db
      .select({ count: sql<number>`count(*)` })
      .from(threatIntelligence)
      .where(eq(threatIntelligence.isActive, true));
  }

  private async getNewThreatsToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return db
      .select({ count: sql<number>`count(*)` })
      .from(threatIntelligence)
      .where(
        and(
          eq(threatIntelligence.isActive, true),
          gte(threatIntelligence.firstSeen, today)
        )
      );
  }

  private async getActiveSourcesCount() {
    return db
      .select({ count: sql<number>`count(distinct ${threatIntelligence.source})` })
      .from(threatIntelligence)
      .where(eq(threatIntelligence.isActive, true));
  }

  private async getTopThreatTypes() {
    return db
      .select({
        threatType: threatIntelligence.threatType,
        count: sql<number>`count(*)`
      })
      .from(threatIntelligence)
      .where(eq(threatIntelligence.isActive, true))
      .groupBy(threatIntelligence.threatType)
      .orderBy(sql`count(*) desc`)
      .limit(5);
  }

  private async getThreatTrends(days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return db
      .select({
        date: sql<string>`date(${threatIntelligence.firstSeen})`,
        threatType: threatIntelligence.threatType,
        count: sql<number>`count(*)`
      })
      .from(threatIntelligence)
      .where(
        and(
          eq(threatIntelligence.isActive, true),
          gte(threatIntelligence.firstSeen, startDate)
        )
      )
      .groupBy(sql`date(${threatIntelligence.firstSeen})`, threatIntelligence.threatType)
      .orderBy(sql`date(${threatIntelligence.firstSeen}) desc`);
  }

  private async updateThreatStatistics() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's statistics by source and type
      const stats = await db
        .select({
          source: threatIntelligence.source,
          threatType: threatIntelligence.threatType,
          count: sql<number>`count(*)`
        })
        .from(threatIntelligence)
        .where(gte(threatIntelligence.firstSeen, today))
        .groupBy(threatIntelligence.source, threatIntelligence.threatType);

      // Insert/update statistics
      for (const stat of stats) {
        await db
          .insert(threatStatistics)
          .values({
            date: today,
            source: stat.source,
            threatType: stat.threatType || 'unknown',
            count: stat.count,
            organizationId: null
          })
          .onConflictDoNothing();
      }

      console.log(`📊 Updated threat statistics for ${stats.length} entries`);
    } catch (error) {
      console.error('Error updating threat statistics:', error);
    }
  }

  /**
   * Sanitize text to prevent database constraint violations
   */
  private sanitizeText(text: string | undefined | null, maxLength?: number): string | null {
    if (!text) return null;
    
    const cleaned = text.trim();
    if (!cleaned) return null;
    
    if (maxLength && cleaned.length > maxLength) {
      return cleaned.substring(0, maxLength - 3) + '...';
    }
    
    return cleaned;
  }
}