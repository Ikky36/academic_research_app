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
  instrumentId: string,
  instrumentType: string,
  instrumentName: string,
  pendekatan: string,
  variables: string,
  gap: string,
  methodologyContext?: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  return await generateInstrumentQuestions(projectId, instrumentId, instrumentType, instrumentName, pendekatan, variables, gap, methodologyContext, userApiKey, isPaidApi);
}

export async function continueInstrumentChatAction(
  projectId: string,
  instrumentId: string,
  instrumentType: string,
  instrumentName: string,
  pendekatan: string,
  variables: string,
  chatHistory: ChatMessage[],
  methodologyContext?: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  return await continueInstrumentChat(projectId, instrumentId, instrumentType, instrumentName, pendekatan, variables, chatHistory, methodologyContext, userApiKey, isPaidApi);
}

export async function generateFinalInstrumentAction(
  instrumentType: string,
  instrumentName: string,
  variables: string,
  summary: string,
  subject?: string,
  subjectDescription?: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  return await generateFinalInstrument(instrumentType, instrumentName, variables, summary, subject, subjectDescription, userApiKey, isPaidApi);
}

export async function generateBlueprintAction(
  projectId: string,
  instrumentId: string,
  instrumentType: string,
  instrumentName: string,
  selectedDomains: string[],
  variables: string,
  gap: string,
  manualTopics: string,
  subject?: string,
  subjectDescription?: string,
  isPaidApi?: boolean
) {
  return await generateBlueprint(projectId, instrumentId, instrumentType, instrumentName, selectedDomains, variables, gap, manualTopics, subject, subjectDescription, undefined, isPaidApi);
}
