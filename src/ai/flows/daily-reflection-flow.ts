'use server';
/**
 * @fileOverview This file implements a Genkit flow for providing a final reflection on the user's day.
 *
 * - reflectOnDay - A function that handles the daily reflection generation process.
 * - DailyReflectionInput - The input type for the reflectOnDay function.
 * - DailyReflectionOutput - The return type for the reflectOnDay function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const DailyReflectionInputSchema = z.object({
  journalContent: z.string().describe("The user's entire written journal content for the day."),
});
export type DailyReflectionInput = z.infer<typeof DailyReflectionInputSchema>;

const DailyReflectionOutputSchema = z.object({
  reflectionMessage: z.string().describe("The AI's warm message of encouragement, exhortation, and support based on the day's journal. Written in Korean."),
});
export type DailyReflectionOutput = z.infer<typeof DailyReflectionOutputSchema>;

export async function reflectOnDay(
  input: DailyReflectionInput
): Promise<DailyReflectionOutput> {
  return dailyReflectionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'dailyReflectionPrompt',
  input: { schema: DailyReflectionInputSchema },
  output: { schema: DailyReflectionOutputSchema },
  prompt: `You are a warm and deeply empathetic spiritual mentor. Your task is to read a user's entire journal for the day and write a final message to help them close their day feeling seen, understood, and encouraged.

The user's journal includes:
- Their bible meditation and reflections on scripture.
- Their prayers.
- Their emotional and spiritual state (daily check-in).
- Their daily activities and interactions with God and people.
- Their struggles and moments of gratitude.

Analyze all of this information holistically. Then, write a personal and warm message of encouragement, exhortation, and support. Acknowledge their efforts, validate their feelings (both good and bad), and gently point them back to God's grace and presence in their life. Keep the message to 3-4 sentences and write in Korean.

User's journal:
{{{journalContent}}}`,
});

const dailyReflectionFlow = ai.defineFlow(
  {
    name: 'dailyReflectionFlow',
    inputSchema: DailyReflectionInputSchema,
    outputSchema: DailyReflectionOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
