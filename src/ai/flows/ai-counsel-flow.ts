'use server';
/**
 * @fileOverview A flow for high-intelligence AI spiritual counsel and life assistance.
 * Prioritizes answering the specific user message with Gemini-level intelligence.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const AICounselInputSchema = z.object({
  message: z.string().describe('The user\'s specific question or chat message.'),
  journalContext: z.string().optional().describe('Context from the user\'s day for personalized wisdom.'),
});
export type AICounselInput = z.infer<typeof AICounselInputSchema>;

const AICounselOutputSchema = z.object({
  response: z.string().describe('A very short (1-2 sentences) direct answer to the message.'),
});
export type AICounselOutput = z.infer<typeof AICounselOutputSchema>;

export async function getAiCounsel(input: AICounselInput): Promise<AICounselOutput> {
  return aiCounselFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiCounselPrompt',
  input: {schema: AICounselInputSchema},
  output: {schema: AICounselOutputSchema},
  prompt: `You are a world-class integrated theologian and a highly intelligent life assistant (Gemini-level). 

      CRITICAL MISSION: 
      1. Directly and accurately answer the "User's Message" provided below. Do NOT ignore it or talk about unrelated things.
      2. If it's a Bible/Theology question, give profound yet clear scholarly insight.
      3. If it's a general life question (e.g., weather, facts, daily tips), provide precise and helpful information.
      4. Use the "Journal Context" ONLY to add a warm, personalized touch to your answer.

      CONSTRAINTS:
      - LENGTH: Strictly 1 to 2 sentences. Be extremely concise.
      - LANGUAGE: Korean (unless the user asks in another language).
      - QUALITY: Every word must carry weight. No generic fluff.

      Journal Context (Today's Life): {{{journalContext}}}
      USER'S MESSAGE TO ANSWER NOW: {{{message}}}`,
});

const aiCounselFlow = ai.defineFlow(
  {
    name: 'aiCounselFlow',
    inputSchema: AICounselInputSchema,
    outputSchema: AICounselOutputSchema,
  },
  async input => {
    // Ensure the prompt receives the full input object including the message
    const {output} = await prompt(input);
    return output!;
  }
);
