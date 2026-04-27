export interface Profile {
  id: string;
  display_name: string | null;
  email: string;
  is_paired: boolean;
}

export interface Connection {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: 'pending' | 'active' | 'rejected';
  created_at: string;
}

export interface ConnectionWithProfile extends Connection {
  profiles: Profile | null;
}

export interface ServiceResponse<T> {
  data: T | null;
  error: Error | null;
}