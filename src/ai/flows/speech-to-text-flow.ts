'use server';
/**
 * @fileOverview A Genkit flow for transcribing audio to text.
 *
 * - transcribeAudio - A function that handles the speech-to-text process.
 * - SpeechToTextInput - The input type for the transcribeAudio function.
 * - SpeechToTextOutput - The return type for the transcribeAudio function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SpeechToTextInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "The audio to transcribe, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type SpeechToTextInput = z.infer<typeof SpeechToTextInputSchema>;

const SpeechToTextOutputSchema = z.object({
  transcript: z.string().describe('The transcribed text from the audio.'),
});
export type SpeechToTextOutput = z.infer<typeof SpeechToTextOutputSchema>;

export async function transcribeAudio(
  input: SpeechToTextInput
): Promise<SpeechToTextOutput> {
  return speechToTextFlow(input);
}

const speechToTextFlow = ai.defineFlow(
  {
    name: 'speechToTextFlow',
    inputSchema: SpeechToTextInputSchema,
    outputSchema: SpeechToTextOutputSchema,
  },
  async (input) => {
    const { text } = await ai.generate({
      prompt: [
        { text: "다음 한국어 오디오를 텍스트로 변환해줘. 문장 부호를 포함해서 정확하게 작성해줘." },
        { media: { url: input.audioDataUri } }
      ],
    });

    return { transcript: text };
  }
);
