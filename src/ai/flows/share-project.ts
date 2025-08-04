'use server';

/**
 * @fileOverview A project sharing AI agent.
 *
 * - importSharedProject - Imports a project using a share code.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from 'genkit/logging';

// Schema for importing a project
const ImportProjectInputSchema = z.object({
  shareCode: z.string().describe('The share code to import.'),
});
export type ImportProjectInput = z.infer<typeof ImportProjectInputSchema>;

const ProjectDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  userId: z.string(),
});
const PinDataSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
  notes: z.string().optional(),
  labelVisible: z.boolean().optional(),
  projectId: z.string().optional(),
  userId: z.string(),
});
const LineDataSchema = z.object({
  id: z.string(),
  path: z.array(z.object({ lat: z.number(), lng: z.number() })),
  label: z.string(),
  notes: z.string().optional(),
  labelVisible: z.boolean().optional(),
  projectId: z.string().optional(),
  userId: z.string(),
});
const AreaDataSchema = z.object({
  id: z.string(),
  path: z.array(z.object({ lat: z.number(), lng: z.number() })),
  label: z.string(),
  notes: z.string().optional(),
  labelVisible: z.boolean().optional(),
  fillVisible: z.boolean().optional(),
  projectId: z.string().optional(),
  userId: z.string(),
});

const ImportProjectOutputSchema = z.object({
  project: ProjectDataSchema,
  pins: z.array(PinDataSchema),
  lines: z.array(LineDataSchema),
  areas: z.array(AreaDataSchema),
});
export type ImportProjectOutput = z.infer<typeof ImportProjectOutputSchema>;

// Flow to import a project
export const importSharedProjectFlow = ai.defineFlow(
  {
    name: 'importSharedProjectFlow',
    inputSchema: ImportProjectInputSchema,
    outputSchema: ImportProjectOutputSchema,
  },
  async (input) => {
    logger.info(`[IMPORT_FLOW] 1. Received request with share code: ${input.shareCode}`);
    const shareRef = doc(db, 'shares', input.shareCode);
    const shareSnap = await getDoc(shareRef);

    if (!shareSnap.exists()) {
      logger.error(`[IMPORT_FLOW] 2. ❌ Share code not found in 'shares' collection.`);
      throw new Error('Invalid share code.');
    }

    const shareData = shareSnap.data();
    const projectId = shareData.projectId;
    logger.info(`[IMPORT_FLOW] 2. ✅ Share code found. Corresponds to project ID: ${projectId}`);

    // Get project
    logger.info(`[IMPORT_FLOW] 3. Fetching project document...`);
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
      logger.error(`[IMPORT_FLOW] 4. ❌ Original project with ID ${projectId} not found.`);
      throw new Error('Original project not found.');
    }
    const project = { id: projectSnap.id, ...projectSnap.data() } as any;
    logger.info(`[IMPORT_FLOW] 4. ✅ Successfully fetched project: "${project.name}"`);

    // Get associated objects
    logger.info(`[IMPORT_FLOW] 5. Fetching associated pins...`);
    const pinsQuery = query(collection(db, 'pins'), where('projectId', '==', projectId));
    const pinsSnapshot = await getDocs(pinsQuery);
    const pins = pinsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
    logger.info(`[IMPORT_FLOW]    - Found ${pins.length} pins.`);

    logger.info(`[IMPORT_FLOW] 6. Fetching associated lines...`);
    const linesQuery = query(collection(db, 'lines'), where('projectId', '==', projectId));
    const linesSnapshot = await getDocs(linesQuery);
    const lines = linesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
    logger.info(`[IMPORT_FLOW]    - Found ${lines.length} lines.`);

    logger.info(`[IMPORT_FLOW] 7. Fetching associated areas...`);
    const areasQuery = query(collection(db, 'areas'), where('projectId', '==', projectId));
    const areasSnapshot = await getDocs(areasQuery);
    const areas = areasSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
    logger.info(`[IMPORT_FLOW]    - Found ${areas.length} areas.`);
    
    logger.info(`[IMPORT_FLOW] 8. ✅ Successfully gathered all data. Returning to client.`);
    return { project, pins, lines, areas };
  }
);

export async function importSharedProject(
  input: ImportProjectInput
): Promise<ImportProjectOutput> {
  return importSharedProjectFlow(input);
}
