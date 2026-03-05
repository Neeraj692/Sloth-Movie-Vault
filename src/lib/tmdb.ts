const API_KEY = "614552faab6649681934deb55ec2004b";
const BASE_URL = "https://api.themoviedb.org/3";

export const getImageUrl = (path: string | null, size: string = 'w500') => {
  if (!path) return 'https://via.placeholder.com/500x750?text=No+Poster&bg=141414';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const fetchApi = async (endpoint: string, params: Record<string, string> = {}) => {
  const query = new URLSearchParams({ api_key: API_KEY, ...params });
  const res = await fetch(`${BASE_URL}${endpoint}?${query}`);
  if (!res.ok) throw new Error('TMDB API Error');
  return res.json();
};
