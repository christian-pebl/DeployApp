import { createClient } from '@supabase/supabase-js'

// Simple client-side only approach to avoid SSR issues
let supabaseInstance: any = null

export function createSupabaseClient() {
  if (typeof window === 'undefined') {
    // Return a dummy client for SSR
    return null
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
    )
  }

  return supabaseInstance
}

export const supabase = createSupabaseClient()

// Simplified types
export type Project = {
  id: string
  name: string
  description?: string
  user_id: string
  created_at: string
  updated_at: string
}

export type Pin = {
  id: string
  lat: number
  lng: number
  label: string
  notes?: string
  label_visible: boolean
  user_id: string
  project_id?: string
  created_at: string
  updated_at: string
}

export type Line = {
  id: string
  path: any // JSON
  label: string
  notes?: string
  label_visible: boolean
  user_id: string
  project_id?: string
  created_at: string
  updated_at: string
}

export type Area = {
  id: string
  path: any // JSON
  label: string
  notes?: string
  label_visible: boolean
  fill_visible: boolean
  user_id: string
  project_id?: string
  created_at: string
  updated_at: string
}

export type Tag = {
  id: string
  name: string
  color: string
  user_id: string
  project_id: string
  created_at: string
  updated_at: string
}