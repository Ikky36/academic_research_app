'use server'

import { generateInstrumentQuestions, continueInstrumentChat, generateFinalInstrument, generateBlueprint, generateLatentDefinition, ChatMessage } from '@/services/instrumen'

export async function generateLatentVariableDefinitionAction(
  latentVarName: string,
  concepts: { name: string, definition: string }[],
  userApiKey?: string,
  isPaidApi?: boolean
) {
  return await generateLatentDefinition(latentVarName, concepts, userApiKey, isPaidApi);
}

export async function generateInstrumentQuestionsAction(
  projectId: string,
  instrumentType: string,
  pendekatan: string,
  variables: string,
  gap: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  return await generateInstrumentQuestions(projectId, instrumentType, pendekatan, variables, gap, userApiKey, isPaidApi);
}

export async function continueInstrumentChatAction(
  projectId: string,
  instrumentType: string,
  pendekatan: string,
  variables: string,
  chatHistory: ChatMessage[],
  userApiKey?: string,
  isPaidApi?: boolean
) {
  return await continueInstrumentChat(projectId, instrumentType, pendekatan, variables, chatHistory, userApiKey, isPaidApi);
}

export async function generateFinalInstrumentAction(
  instrumentType: string,
  variables: string,
  summary: string,
  subject?: string,
  subjectDescription?: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  return await generateFinalInstrument(instrumentType, variables, summary, subject, subjectDescription, userApiKey, isPaidApi);
}

export async function generateBlueprintAction(
  projectId: string,
  instrumentType: string,
  selectedDomains: string[],
  variables: string,
  gap: string,
  manualTopics: string,
  subject?: string,
  subjectDescription?: string,
  isPaidApi?: boolean
) {
  return await generateBlueprint(projectId, instrumentType, selectedDomains, variables, gap, manualTopics, subject, subjectDescription, undefined, isPaidApi);
}
