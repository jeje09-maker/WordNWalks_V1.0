'use server';
/**
 * @fileOverview This file implements a Genkit flow for evaluating a user's meditation and journal.
 *
 * - evaluateMeditation - A function that handles the meditation evaluation process.
 * - MeditationEvaluatorInput - The input type for the evaluateMeditation function.
 * - MeditationEvaluatorOutput - The return type for the evaluateMeditation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const MeditationEvaluatorInputSchema = z.object({
  passage: z.string().describe('The bible passage the user meditated on.'),
  journalContent: z.string().describe("The user's entire written journal content for the day, including meditation, reflections, and prayers."),
});
export type MeditationEvaluatorInput = z.infer<typeof MeditationEvaluatorInputSchema>;

const MeditationEvaluatorOutputSchema = z.object({
  evaluation: z.string().describe('A simple, warm evaluation and encouragement based on the entire journal content. Written in Korean.'),
  missions: z.array(z.string()).length(2).describe('Two practical, mission-oriented statements for the user to accomplish today. They should be encouraging imperative statements. Written in Korean.'),
});
export type MeditationEvaluatorOutput = z.infer<typeof MeditationEvaluatorOutputSchema>;

export async function evaluateMeditation(
  input: MeditationEvaluatorInput
): Promise<MeditationEvaluatorOutput> {
  return meditationEvaluatorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'meditationEvaluatorPrompt',
  input: { schema: MeditationEvaluatorInputSchema },
  output: { schema: MeditationEvaluatorOutputSchema },
  prompt: `You are a warm and encouraging spiritual mentor. Your task is to analyze a user's entire journal entry for the day and provide feedback in Korean.

The user provides the following:
- Bible Passage: {{{passage}}}
- Their full journal entry for the day: {{{journalContent}}}

Please perform the following steps:

1.  **Evaluation (evaluation):** Read the user's entire journal entry. Write a short, simple, and warm evaluation. Offer encouragement and affirm their reflections. Keep it concise (about 2-3 sentences).

2.  **Missions (missions):** Based on the bible passage and the user's entire journal, create exactly two practical, actionable mission statements for the day. These missions MUST be concrete and help the user apply the scripture to their life.
    *   If the journal mentions specific people the user interacted with, try to create at least one mission related to those relationships. For example, "오늘 [사람 이름]님에게 묵상한 말씀을 바탕으로 격려의 메시지를 보내보세요." (Today, try sending a message of encouragement to [Person's Name] based on your meditation.)
    *   If no specific person is mentioned, create a generally applicable but still concrete mission.
    *   The statements MUST be phrased as gentle, encouraging imperatives in Korean. Do NOT ask questions.

Your final output must be a single JSON object that strictly adheres to the output schema. All output must be in Korean.`,
});

const meditationEvaluatorFlow = ai.defineFlow(
  {
    name: 'meditationEvaluatorFlow',
    inputSchema: MeditationEvaluatorInputSchema,
    outputSchema: MeditationEvaluatorOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
