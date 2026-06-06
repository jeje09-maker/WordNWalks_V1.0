'use server';
/**
 * @fileOverview A Genkit flow for generating bible segment content.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const BibleSegmentContentInputSchema = z.object({
  passage: z.string().describe('The bible passage reference, e.g., "Genesis 1:1-2:3".'),
  segmentId: z.string().optional().describe('The unique ID for the bible segment.'),
  language: z.string().describe('The target language for the generated content, e.g., "English", "Korean", "Spanish".'),
});
export type BibleSegmentContentInput = z.infer<typeof BibleSegmentContentInputSchema>;

const BibleSegmentContentOutputSchema = z.object({
    title: z.string().describe('A concise and meaningful title for the meditation on this passage.'),
    verses: z.string().describe('The full text of the bible passage in the specified language.'),
    keyVerses: z.array(z.string()).describe('A list of 2-3 key verses from the passage in the specified language.'),
    paragraphs: z.array(z.object({
        range: z.string().describe('The verse range for the paragraph, e.g., "1:1-8".'),
        title: z.string().describe('A title for this paragraph in the specified language.')
    })).describe('An array of objects dividing the passage into logical paragraphs with titles.'),
    analysis: z.string().describe('A detailed commentary or analysis of the entire passage in the specified language.'),
    meditationGuide: z.string().describe('A guide to help someone meditate on the passage in the specified language.'),
    questions: z.array(z.string()).length(2).describe('Exactly two reflection questions: the first for shaping thoughts/understanding, and the second for prompting action/application in the specified language.'),
});
export type BibleSegmentContentOutput = z.infer<typeof BibleSegmentContentOutputSchema>;


export async function generateBibleSegmentContent(
  input: BibleSegmentContentInput
): Promise<BibleSegmentContentOutput> {
  return bibleSegmentContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'bibleSegmentContentPrompt',
  input: { schema: BibleSegmentContentInputSchema },
  output: { schema: BibleSegmentContentOutputSchema },
  prompt: `You are an expert bible commentator. Your task is to generate content for the given passage {{{passage}}} in the specified language: {{{language}}}.

The output must be a single JSON object that strictly adheres to the output schema.

**Localization and Cultural Context Guidelines:**
- ALL fields in the output JSON (title, verses, paragraphs.title, analysis, meditationGuide, questions, keyVerses) MUST be written entirely in the target language: {{{language}}}.
- Do NOT output any English unless the target language {{{language}}} is English. Even if the input passage name (e.g., "Genesis 1:1") is in English, you must translate everything and fetch/render the scripture verses in {{{language}}}.
- For the bible verses, use a standard translation in the target language. For example, if {{{language}}} is "Korean" or "한국어 (Korean)", you must use a standard Korean translation (개역개정 or 새번역) for the verses, title, analysis, guide, etc. If {{{language}}} is English, use NIV or ESV.
- Scripture must remain the central authority.

**Content Generation Instructions:**
1.  **title**: Concise and meaningful title.
2.  **verses**: Full text. Precede every verse with its number in brackets (e.g., "[1] In the beginning...").
3.  **keyVerses**: 2-3 key verses.
4.  **paragraphs**: Divide logically with ranges and titles.
5.  **analysis**: Detailed commentary.
6.  **meditationGuide**: Focus on application. Sentence form only.
7.  **questions**: Create EXACTLY TWO reflection questions: the first question must focus on shaping and organizing thoughts (contemplative/understanding), and the second question must focus on prompting concrete actions and applications in daily life.`,
});

const bibleSegmentContentFlow = ai.defineFlow(
  {
    name: 'bibleSegmentContentFlow',
    inputSchema: BibleSegmentContentInputSchema,
    outputSchema: BibleSegmentContentOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
