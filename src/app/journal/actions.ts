
'use server';

import 'dotenv/config';
import { transcribeAudio as transcribeAudioFlow, SpeechToTextInput } from '@/ai/flows/speech-to-text-flow';
import { evaluateMeditation as evaluateMeditationFlow, MeditationEvaluatorInput, MeditationEvaluatorOutput } from '@/ai/flows/meditation-evaluator-flow';
import { reflectOnDay as reflectOnDayFlow, DailyReflectionInput, DailyReflectionOutput } from '@/ai/flows/daily-reflection-flow';
import { generateBibleSegmentContent as generateBibleSegmentContentFlow, BibleSegmentContentInput, BibleSegmentContentOutput } from '@/ai/flows/bible-segment-content-flow';
import { getAiCounsel as getAiCounselFlow, AICounselInput, AICounselOutput } from '@/ai/flows/ai-counsel-flow';
import { recommendPassage as recommendPassageFlow, PassageRecommenderInput, PassageRecommenderOutput } from '@/ai/flows/passage-recommender-flow';

export async function transcribeAudioAction(input: SpeechToTextInput): Promise<{ transcript?: string; error?: string }> {
  try {
    const result = await transcribeAudioFlow(input);
    return { transcript: result.transcript };
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return { error: 'Failed to transcribe audio. Please try again.' };
  }
}

export async function evaluateMeditationAction(input: MeditationEvaluatorInput): Promise<Partial<MeditationEvaluatorOutput> & { error?: string }> {
  try {
    const result = await evaluateMeditationFlow(input);
    return result;
  } catch (error) {
    console.error('Error evaluating meditation:', error);
    return { error: 'Failed to evaluate meditation. Please try again.' };
  }
}

export async function getDailyReflectionAction(input: DailyReflectionInput): Promise<Partial<DailyReflectionOutput> & { error?: string }> {
  try {
    const result = await reflectOnDayFlow(input);
    return result;
  } catch (error) {
    console.error('Error getting daily reflection:', error);
    return { error: 'Failed to get daily reflection. Please try again.' };
  }
}

export async function generateBibleSegmentContentAction(input: BibleSegmentContentInput): Promise<Partial<BibleSegmentContentOutput> & { error?: string }> {
  try {
    const result = await generateBibleSegmentContentFlow(input);
    return result;
  } catch (error) {
    console.error('Error generating bible segment content:', error);
    return { error: 'Failed to generate content. Please try again.' };
  }
}

export async function getAiCounselAction(input: AICounselInput): Promise<Partial<AICounselOutput> & { error?: string }> {
  try {
    const result = await getAiCounselFlow(input);
    return result;
  } catch (error) {
    console.error('Error getting AI counsel:', error);
    return { error: 'Failed to get counsel. Please try again.' };
  }
}

export async function recommendPassageAction(input: PassageRecommenderInput): Promise<Partial<PassageRecommenderOutput> & { error?: string }> {
  try {
    const result = await recommendPassageFlow(input);
    return result;
  } catch (error) {
    console.error('Error recommending passage:', error);
    return { error: 'Failed to recommend passage. Please try again.' };
  }
}
