export interface Idea {
  id: string
  title: string
  content: string
  keywords: string[]
  created_at: string
  source_url?: string
  bookmarked?: boolean
  user_id?: string
}

