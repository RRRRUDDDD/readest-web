export interface DBBook {
  user_id: string;
  book_hash: string;
  meta_hash?: string;
  format: string;
  title: string;
  source_title?: string | null;
  author: string;
  group_id?: string | null;
  group_name?: string | null;
  tags?: string[] | null;
  progress?: [number, number] | null;
  reading_status?: string | null;

  metadata?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  uploaded_at?: string | null;
}

export interface DBBookConfig {
  user_id: string;
  book_hash: string;
  meta_hash?: string;
  location?: string;
  xpointer?: string;
  progress?: string;
  rsvp_position?: string;
  search_config?: string;
  view_settings?: string;

  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface DBBookNote {
  user_id: string;
  book_hash: string;
  meta_hash?: string;
  id: string;
  type: string;
  cfi?: string;
  xpointer0?: string;
  xpointer1?: string;
  page?: number;
  text?: string;
  style?: string;
  color?: string;
  note: string;

  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}
