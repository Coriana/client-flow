/**
 * Fuzzy matching utility for inventory item matching
 */

// Calculate Levenshtein distance between two strings
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return dp[m][n];
}

// Normalize string for comparison
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[\-\/\(\)]/g, ' ')  // Replace dashes, slashes, parens with spaces
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .replace(/\b(the|a|an)\b/gi, '') // Remove common articles
    .trim();
}

// Calculate similarity score (0-1) where 1 = exact match
export function similarityScore(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check if one string contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = Math.min(s1.length, s2.length);
    const longer = Math.max(s1.length, s2.length);
    return 0.7 + (0.3 * shorter / longer); // 70-100% for contains match
  }
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  return Math.max(0, 1 - distance / maxLength);
}

export interface MatchResult<T> {
  item: T;
  score: number;
  matchedField: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
  unit?: string | null;
  unit_cost?: number | null;
}

// Find best matches from a list of inventory items
export function findBestMatches(
  query: string,
  items: InventoryItem[],
  threshold: number = 0.4,
  maxResults: number = 5
): MatchResult<InventoryItem>[] {
  const results: MatchResult<InventoryItem>[] = [];
  
  for (const item of items) {
    // Check SKU first (exact or near-exact match gets highest priority)
    const skuScore = similarityScore(query, item.sku) * 1.5; // Weight SKU matches higher
    
    // Check name
    const nameScore = similarityScore(query, item.name);
    
    // Check category (lower weight)
    const categoryScore = item.category ? similarityScore(query, item.category) * 0.3 : 0;
    
    // Take the best score
    let bestScore = nameScore;
    let matchedField = 'name';
    
    if (skuScore > bestScore) {
      bestScore = skuScore;
      matchedField = 'sku';
    }
    
    if (categoryScore > bestScore) {
      bestScore = categoryScore;
      matchedField = 'category';
    }
    
    // Cap at 1.0
    bestScore = Math.min(1, bestScore);
    
    if (bestScore >= threshold) {
      results.push({ item, score: bestScore, matchedField });
    }
  }
  
  // Sort by score descending and limit results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

// Get confidence level based on score
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

// Get confidence color class
export function getConfidenceColor(score: number): string {
  const level = getConfidenceLevel(score);
  switch (level) {
    case 'high': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30';
    case 'medium': return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30';
    case 'low': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30';
  }
}
