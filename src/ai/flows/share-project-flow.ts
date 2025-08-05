'use server';

import { 
  collection, 
  doc, 
  writeBatch, 
  serverTimestamp 
} from 'firebase/firestore';
import { z } from 'genkit';
import { 
  defineFlow, 
  run, 
  Action 
} from 'genkit/server';
import { db } from '../../lib/firebase';

export const shareProjectFlow = defineFlow(
  {
    name: 'shareProject',
    inputSchema: z.object({ projectId: z.string(), userId: z.string() }),
    outputSchema: z.object({ shareId: z.string() }),
  },
  async ({ projectId, userId }) => {
    const shareId = doc(collection(db, 'shares')).id;
    const shareRef = doc(db, 'shares', shareId);
    const shareByProjectRef = doc(db, 'shares_by_project', projectId);
    const batch = writeBatch(db);

    batch.set(shareRef, { 
      id: shareId,
      projectId,
      userId, 
      createdAt: serverTimestamp(),
    });
    batch.set(shareByProjectRef, { shareId: shareId });

    await batch.commit();
    return { shareId };
  }
);
