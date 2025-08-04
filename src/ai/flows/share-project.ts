'use server';

/**
 * @fileOverview Defines the data structures for projects and their components.
 */

import { z } from 'genkit';

export const ProjectDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  userId: z.string(),
  createdAt: z.any(),
});
export type ProjectData = z.infer<typeof ProjectDataSchema>;

export const PinDataSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
  notes: z.string().optional(),
  labelVisible: z.boolean().optional(),
  projectId: z.string().optional(),
  userId: z.string(),
  tagIds: z.array(z.string()).optional(),
});
export type PinData = z.infer<typeof PinDataSchema>;

export const LineDataSchema = z.object({
  id: z.string(),
  path: z.array(z.object({ lat: z.number(), lng: z.number() })),
  label: z.string(),
  notes: z.string().optional(),
  labelVisible: z.boolean().optional(),
  projectId: z.string().optional(),
  userId: z.string(),
  tagIds: z.array(z.string()).optional(),
});
export type LineData = z.infer<typeof LineDataSchema>;

export const AreaDataSchema = z.object({
  id: z.string(),
  path: z.array(z.object({ lat: z.number(), lng: z.number() })),
  label: z.string(),
  notes: z.string().optional(),
  labelVisible: z.boolean().optional(),
  fillVisible: z.boolean().optional(),
  projectId: z.string().optional(),
  userId: z.string(),
  tagIds: z.array(z.string()).optional(),
});
export type AreaData = z.infer<typeof AreaDataSchema>;

export const TagDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  projectId: z.string(),
  userId: z.string(),
});
export type TagData = z.infer<typeof TagDataSchema>;
