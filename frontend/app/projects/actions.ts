'use server'

import { createClient } from '@/utils/server'
import { revalidatePath } from 'next/cache'

export async function createProject(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const projectName = formData.get('projectName') as string
  const description = formData.get('description') as string
  const isPublic = formData.get('visibility') === 'public'
  
  //const classesRaw = formData.get('detectionClasses') as string
  //const detectionClasses = classesRaw ? classesRaw.split(',').map(c => c.trim()) : []

  const { error } = await supabase.from('projects')
    .insert({
      user_id: user.id, 
      project_name: projectName,
      description: description,
      is_public: isPublic,
      image_count: 0,
      // detection_classes: detectionClasses 
    })

  if (error) {
    console.error('Error creating project:', error.message)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}