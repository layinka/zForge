import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { lastValueFrom, Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

// Constants for cache configuration
const CACHE_STORAGE_KEY = 'coingecko_price_cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CoinPrice {
  [coinId: string]: {
    usd: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
    usd_24h_change?: number;
    last_updated_at?: number;
  };
}

interface CacheEntry {
  data: CoinPrice;
  timestamp: number;
}

export const coingeckoIdSymbolMappings: { [key: string]: string } = {
  'dualStake': 'b14g-dualcore',
  'stCORE': 'coredao-staked-core',
  'stBTC': 'bitcoin',
  'core': 'coredao',
  'btc': 'bitcoin',
}

@Injectable({
  providedIn: 'root'
})
export class CoinGeckoService {
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  private cache = new Map<string, CacheEntry>();
  private cacheTimeout = CACHE_EXPIRY_MS;

  constructor(private http: HttpClient) {
    this.loadCacheFromStorage();
    
    // Listen for storage events to sync cache across tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === CACHE_STORAGE_KEY) {
          this.loadCacheFromStorage();
        }
      });
    }
  }

  private loadCacheFromStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      
      const cachedData = localStorage.getItem(CACHE_STORAGE_KEY);
      if (cachedData) {
        const parsed: Record<string, CacheEntry> = JSON.parse(cachedData);
        const now = Date.now();
        
        // Filter out expired entries and ensure they match CacheEntry type
        const validEntries = Object.entries(parsed)
          .filter(([_, entry]) => 
            entry && 
            typeof entry === 'object' &&
            'data' in entry &&
            'timestamp' in entry &&
            now - (entry as CacheEntry).timestamp < CACHE_EXPIRY_MS
          )
          .map(([key, entry]) => [key, entry as CacheEntry] as [string, CacheEntry]);
        
        this.cache = new Map(validEntries);
      }
    } catch (error) {
      console.error('Failed to load cache from storage', error);
      this.cache.clear();
    }
  }

  private saveCacheToStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      
      const cacheObj = Object.fromEntries(this.cache);
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheObj));
    } catch (error) {
      console.error('Failed to save cache to storage', error);
    }
  }

  private setCache(key: string, data: any) {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now()
    };
    this.cache.set(key, entry);
    this.saveCacheToStorage();
  }

  private getCache(key: string): any | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > CACHE_EXPIRY_MS) {
      this.cache.delete(key);
      this.saveCacheToStorage();
      return undefined;
    }
    
    return entry.data;
  }

  async getCoinPrice(
    coinId: string, 
    vsCurrency: string = 'usd',
    includeMarketCap: boolean = false,
    include24hrVol: boolean = false,
    include24hrChange: boolean = false,
    includeLastUpdated: boolean = false
  ): Promise<number> {
    const cacheKey = `${coinId}_${vsCurrency}_${includeMarketCap}_${include24hrVol}_${include24hrChange}_${includeLastUpdated}`;
    
    // Check cache first
    const cachedData = this.getCache(cacheKey);
    if (cachedData) {
      return cachedData[coinId]?.usd;
    }

    // Build query parameters
    const params = new URLSearchParams({
      ids: coinId,
      vs_currencies: vsCurrency
    });

    if (includeMarketCap) params.append('include_market_cap', 'true');
    if (include24hrVol) params.append('include_24hr_vol', 'true');
    if (include24hrChange) params.append('include_24hr_change', 'true');
    if (includeLastUpdated) params.append('include_last_updated_at', 'true');

    const headers = new HttpHeaders({
      'accept': 'application/json',
      'x-cg-demo-api-key': environment.coingeckoApiKey
    });

    const url = `${this.baseUrl}/simple/price?${params.toString()}`;

    try {
      const response = await lastValueFrom( this.http.get<CoinPrice>(url, { headers })
        .pipe(
          tap(response => {
            // Cache the response
            this.cache.set(cacheKey, {
              data: response,
              timestamp: Date.now()
            });
          })
        ));
      
      if (!response) {
        throw new Error('No response from CoinGecko API');
      }
      
      return response[coinId].usd;
    } catch (error) {
      console.error('Error fetching coin price:', error);
      throw error;
    }
  }

  async getCoinPriceFromSymbol(
    coinSymbol: string, 
    vsCurrency: string = 'usd',
    // includeMarketCap: boolean = false,
    // include24hrVol: boolean = false,
    // include24hrChange: boolean = false,
    // includeLastUpdated: boolean = false
  ): Promise<number> {    

    const coinId = coingeckoIdSymbolMappings[coinSymbol];
    if (!coinId) {
      throw new Error(`Coin ID not found for symbol: ${coinSymbol}`);
    }
    const allPrices = await this.getCoinPrices(Object.values(coingeckoIdSymbolMappings), vsCurrency);
    const coinPrice = allPrices[coinId]?.usd;
    return coinPrice;
  }

  async getCoinPrices(
    coinIds: string[], 
    vsCurrency: string = 'usd',
    includeMarketCap: boolean = false,
    include24hrVol: boolean = false,
    include24hrChange: boolean = false,
    includeLastUpdated: boolean = false
  ): Promise<CoinPrice> {
    const cacheKey = `${coinIds.join(',')}_${vsCurrency}_${includeMarketCap}_${include24hrVol}_${include24hrChange}_${includeLastUpdated}`;
    
    // Check cache first
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp) < this.cacheTimeout) {
      return cachedEntry.data;
    }

    // Build query parameters
    const params = new URLSearchParams({
      ids: coinIds.join(','),
      vs_currencies: vsCurrency
    });

    if (includeMarketCap) params.append('include_market_cap', 'true');
    if (include24hrVol) params.append('include_24hr_vol', 'true');
    if (include24hrChange) params.append('include_24hr_change', 'true');
    if (includeLastUpdated) params.append('include_last_updated_at', 'true');

    const headers = new HttpHeaders({
      'accept': 'application/json',
      'x-cg-demo-api-key': environment.coingeckoApiKey // Replace with your actual demo API key
    });

    const url = `${this.baseUrl}/simple/price?${params.toString()}`;

    return await lastValueFrom(this.http.get<CoinPrice>(url, { headers }).pipe(
      tap(response => {
        // Cache the response
        this.cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });
        this.saveCacheToStorage();
      })
    ));
  }

  getCoinPriceWithDetails(
    coinId: string, 
    vsCurrency: string = 'usd'
  ): Observable<CoinPrice[string]> {
    const cacheKey = `${coinId}_${vsCurrency}_details`;
    
    // Check cache first
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp) < this.cacheTimeout) {
      return of(cachedEntry.data[coinId]);
    }

    const params = new URLSearchParams({
      ids: coinId,
      vs_currencies: vsCurrency,
      include_market_cap: 'true',
      include_24hr_vol: 'true',
      include_24hr_change: 'true',
      include_last_updated_at: 'true'
    });

    const headers = new HttpHeaders({
      'accept': 'application/json',
      'x-cg-demo-api-key': environment.coingeckoApiKey // Replace with your actual demo API key
    });

    const url = `${this.baseUrl}/simple/price?${params.toString()}`;

    return this.http.get<CoinPrice>(url, { headers }).pipe(
      tap(response => {
        // Cache the response
        this.cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });
      }),
      map(response => response[coinId])
    );
  }

  // Method to clear cache manually if needed
  clearCache(): void {
    this.cache.clear();
  }

  // Method to clear expired cache entries
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
}