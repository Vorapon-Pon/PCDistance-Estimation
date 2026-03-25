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
  
  const classesRaw = formData.get('classesData') as string

  const { data: project, error } = await supabase.from('projects')
    .insert({
      user_id: user.id, 
      project_name: projectName,
      description: description,
      is_public: isPublic,
      image_count: 0
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error.message)
    return { error: error.message }
  }

  if (classesRaw) {
    try {
      const selectedClasses: { name: string, color: string }[] = JSON.parse(classesRaw)
      
      if (selectedClasses.length > 0) {
        const classInserts = selectedClasses.map(cls => ({
          project_id: project.id, 
          name: cls.name,
          color: cls.color,
          is_active: true
        }))

        const { error: classesError } = await supabase
          .from('project_classes')
          .insert(classInserts)

        if (classesError) {
          console.error('Error inserting classes:', classesError.message)
        }
      }
    } catch (parseError) {
      console.error('Error parsing classes data:', parseError)
    }
  }

  revalidatePath('/projects')
  
  return { success: true }
}