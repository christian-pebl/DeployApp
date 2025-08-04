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
    const shareRef = doc(db, 'shares', input.shareCode);
    const shareSnap = await getDoc(shareRef);

    if (!shareSnap.exists()) {
      throw new Error('Invalid share code.');
    }

    const shareData = shareSnap.data();
    const projectId = shareData.projectId;

    // Get project
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
      throw new Error('Original project not found.');
    }
    const project = { id: projectSnap.id, ...projectSnap.data() } as any;

    // Get associated objects
    const pinsQuery = query(collection(db, 'pins'), where('projectId', '==', projectId));
    const pinsSnapshot = await getDocs(pinsQuery);
    const pins = pinsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));

    const linesQuery = query(collection(db, 'lines'), where('projectId', '==', projectId));
    const linesSnapshot = await getDocs(linesQuery);
    const lines = linesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));

    const areasQuery = query(collection(db, 'areas'), where('projectId', '==', projectId));
    const areasSnapshot = await getDocs(areasQuery);
    const areas = areasSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));

    return { project, pins, lines, areas };
  }
);

export async function importSharedProject(
  input: ImportProjectInput
): Promise<ImportProjectOutput> {
  return importSharedProjectFlow(input);
}
