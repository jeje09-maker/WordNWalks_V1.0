'use server';
/**
 * @fileOverview Implements a flow to recommend a bible passage for meditation.
 * This has been updated to use a static, curated list for cost-efficiency, removing the AI call.
 *
 * - recommendPassage - A function that suggests a bible passage.
 * - PassageRecommenderInput - The input type for the flow.
 * - PassageRecommenderOutput - The return type containing the passage.
 */

import { z } from 'genkit';
import { biblePassages as masterRecommendationList } from '@/lib/bible-passages.json';

// The input is the list of passages the user has already been recommended.
const PassageRecommenderInputSchema = z.object({
  passageList: z.array(z.string()).describe('A list of bible passages the user has already read.'),
});
export type PassageRecommenderInput = z.infer<typeof PassageRecommenderInputSchema>;

const PassageRecommenderOutputSchema = z.object({
  passage: z.string().describe('The recommended bible passage reference, e.g., "시편 23:1-6".'),
});
export type PassageRecommenderOutput = z.infer<typeof PassageRecommenderOutputSchema>;

/**
 * Recommends a Bible passage from a pre-curated master list.
 * This logic uses a static list (expandable to 730 passages) for cost efficiency, avoiding AI calls.
 * It filters out passages the user has already seen and randomly selects from the remainder.
 * If all passages have been seen, it starts over from the full list.
 */
export async function recommendPassage(
  input: PassageRecommenderInput
): Promise<PassageRecommenderOutput> {
  // Get the list of passages the user has not yet been recommended.
  const alreadyRecommended = new Set(input.passageList || []);
  let availablePassages = masterRecommendationList.filter(
    p => !alreadyRecommended.has(p)
  );

  // If the user has read all passages from the master list, reset and recommend from the full list.
  if (availablePassages.length === 0) {
    availablePassages = masterRecommendationList;
  }
  
  // Select a random passage from the available list.
  const randomIndex = Math.floor(Math.random() * availablePassages.length);
  const recommendedPassage = availablePassages[randomIndex];

  return { passage: recommendedPassage || '시편 23:1-6' }; // Fallback for safety
}
