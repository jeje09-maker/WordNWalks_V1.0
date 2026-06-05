
import { BIBLE_SEGMENTS_OT, BIBLE_SEGMENTS_NT, BIBLE_BOOK_KEYS } from './bible-segments';

/**
 * Calculates the number of verses in a range string like "1:1-13" or "23".
 */
function getPassageLength(range: string): number {
  if (!range) return 1;
  const parts = range.split('-');
  if (parts.length < 2) {
    return 1;
  }
  const startPart = parts[0].split(':').pop() || '0';
  const endPart = parts[1].split(':').pop() || '0';
  const start = parseInt(startPart);
  const end = parseInt(endPart);
  if (isNaN(start) || isNaN(end)) return 1;
  return end - start + 1;
}

/**
 * Deterministically picks a Bible passage for the given date.
 */
export function getDailyRecommendation(dateStr: string) {
  const allSegments: { bookKey: string; segment: any }[] = [];
  
  // Collect all predefined segments from OT and NT
  Object.entries(BIBLE_SEGMENTS_OT).forEach(([bookKey, segments]) => {
    if (Array.isArray(segments)) {
      segments.forEach(s => allSegments.push({ bookKey, segment: s }));
    }
  });
  Object.entries(BIBLE_SEGMENTS_NT).forEach(([bookKey, segments]) => {
    if (Array.isArray(segments)) {
      segments.forEach(s => allSegments.push({ bookKey, segment: s }));
    }
  });

  if (allSegments.length === 0) {
    return { passage: '시편 23:1-6', segmentId: 'psalms_023_001_023_006' };
  }

  // Filter for segments that are likely clear in theme and <= 15 verses
  const filtered = allSegments.filter(({ segment }) => {
    return getPassageLength(segment.range) <= 15;
  });

  // If somehow no segments match, fallback to the full list
  const sourceList = filtered.length > 0 ? filtered : allSegments;

  // Use the date as a seed for deterministic randomness
  const seed = dateStr.replace(/-/g, '');
  const numSeed = parseInt(seed) || 0;
  
  // Pick an index based on the seed
  const index = numSeed % sourceList.length;
  const picked = sourceList[index];
  
  const bookName = BIBLE_BOOK_KEYS[picked.bookKey] || picked.bookKey;
  
  return {
    passage: `${bookName} ${picked.segment.range}`,
    segmentId: picked.segment.id
  };
}
