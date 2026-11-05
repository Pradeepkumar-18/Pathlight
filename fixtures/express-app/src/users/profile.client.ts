import axios from 'axios';

export interface Profile {
  userId: number;
  bio: string;
  followers: number;
}

// Calls the "external" profile service (a local stub, so nothing leaves the machine).
export async function fetchProfile(baseUrl: string, userId: number): Promise<Profile> {
  const response = await axios.get<Profile>(`${baseUrl}/profiles/${userId}`, { timeout: 2000 });
  return response.data;
}
