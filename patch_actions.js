const fs = require('fs');

const codeToAppend = `
export async function generateSkalaV2ConceptualDefAction(
  theoreticalContext: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  const { generateSkalaV2ConceptualDef } = await import('@/services/instrumen');
  return generateSkalaV2ConceptualDef(theoreticalContext, userApiKey, isPaidApi);
}

export async function generateSkalaV2OperationalDefAction(
  conceptualDef: string,
  theoreticalContext: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  const { generateSkalaV2OperationalDef } = await import('@/services/instrumen');
  return generateSkalaV2OperationalDef(conceptualDef, theoreticalContext, userApiKey, isPaidApi);
}

export async function generateSkalaV2TableAction(
  conceptualDef: string,
  operationalDef: string,
  userApiKey?: string,
  isPaidApi?: boolean
) {
  const { generateSkalaV2Table } = await import('@/services/instrumen');
  return generateSkalaV2Table(conceptualDef, operationalDef, userApiKey, isPaidApi);
}
`;

fs.appendFileSync('src/app/dashboard/actions.ts', '\n' + codeToAppend);
console.log('Successfully appended to src/app/dashboard/actions.ts');
