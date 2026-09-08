import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, useParams, useNavigate, Link } from 'react-router-dom';
import { Film, Check, Trash2, Plus, Star, Search, Play, X, Calendar, Clock, Info, Users, Share2, MessageCircle, Tv, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchResults } from './components/SearchResults';
import { GoogleLogin } from '@react-oauth/google';

interface Movie {
  id: string;
  imdb_id?: string;
  title: string;
  poster_url?: string;
  imdb_rating?: string;
  year?: string;
  genre?: string;
  runtime?: number;
  overview?: string;
  status?: string;
  remark?: string;
  added_date?: string;
}

function Watchlist() {
  const { username } = useParams<{ username: string }>();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMovieQuery, setNewMovieQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [extendedDetails, setExtendedDetails] = useState<any>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [isFetchingTrailer, setIsFetchingTrailer] = useState(false);
  const [activeTab, setActiveTab] = useState<'wishlist' | 'watched'>('wishlist');
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);

  const searchCache = useRef<Record<string, any[]>>({});
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('movievault_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const query = newMovieQuery.trim();
    if (query.length === 0) {
      setGlobalSearchResults([]);
      return;
    }

    if (searchCache.current[query.toLowerCase()]) {
      setGlobalSearchResults(searchCache.current[query.toLowerCase()]);
      return;
    }

    let abortController = new AbortController();
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: abortController.signal
        });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        searchCache.current[query.toLowerCase()] = data;
        setGlobalSearchResults(data);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Search error", error);
        }
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      clearTimeout(delayDebounceFn);
      abortController.abort();
    };
  }, [newMovieQuery]);

  const fetchMovies = async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/users/${username}/movies`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMovies(data);
      } else {
        setMovies([]);
      }
    } catch (error) {
      console.error('Failed to fetch movies', error);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, [username]);

  const handleMovieClick = async (movie: Movie) => {
    setSelectedMovie(movie);
    setTrailerKey(null);
    setExtendedDetails(null);
    setIsFetchingTrailer(true);
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    const movieId = movie.id;
    if (apiKey && movieId) {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}&append_to_response=videos,credits,watch/providers`);
        const data = await res.json();
        setExtendedDetails(data);
        
        if (data.videos && data.videos.results) {
          const trailer = data.videos.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
          if (trailer) {
            setTrailerKey(trailer.key);
          }
        }
      } catch (err) {
        console.error("Failed to fetch extended details", err);
      }
    }
    setIsFetchingTrailer(false);
  };

  const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('movievault_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const toggleStatus = async (movie: Movie, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const newStatus = movie.status === 'wishlist' ? 'watched' : 'wishlist';
      const res = await fetch(`/api/users/${username}/movies/${movie.id}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update status');
      }
      
      if (selectedMovie && selectedMovie.id === movie.id) {
        setSelectedMovie({ ...selectedMovie, status: newStatus });
      }
      fetchMovies();
    } catch (error: any) {
      console.error('Failed to update status', error);
      alert(error.message || 'Failed to update status');
    }
  };

  const deleteMovie = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/users/${username}/movies/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete movie');
      }
      if (selectedMovie && selectedMovie.id === id) {
        setSelectedMovie(null);
      }
      fetchMovies();
    } catch (error: any) {
      console.error('Failed to delete movie', error);
      alert(error.message || 'Failed to delete movie');
    }
  };

  const handleAddMovie = async (tmdbId: string) => {
    if (isAdding || !username) return;
    setIsAdding(true);
    setNewMovieQuery('');
    try {
      const res = await fetch(`/api/users/${username}/movies`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ movieId: tmdbId }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add movie');
      }
      
      fetchMovies();
    } catch (error: any) {
      console.error('Failed to add movie', error);
      alert(error.message || 'Failed to add movie');
    } finally {
      setIsAdding(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/watchlist/${username}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const handleWhatsAppShare = () => {
    const url = `${window.location.origin}/watchlist/${username}`;
    const text = `Check out my movie watchlist on MovieVault 🦥: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const displayedMovies = movies.filter(m => m.status === activeTab && m.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const featuredMovie = displayedMovies.length > 0 ? displayedMovies[0] : null;

  const getWatchProviders = () => {
    if (!extendedDetails || !extendedDetails['watch/providers']) return null;
    const inProviders = extendedDetails['watch/providers'].results?.['IN'];
    if (!inProviders) return [];
    
    const providersMap = new Map();
    
    const addProviders = (list: any[]) => {
      if (!list) return;
      list.forEach(p => {
        if (!providersMap.has(p.provider_id)) {
          providersMap.set(p.provider_id, p);
        }
      });
    };
    
    addProviders(inProviders.flatrate);
    addProviders(inProviders.rent);
    addProviders(inProviders.buy);
    
    return Array.from(providersMap.values());
  };

  const watchProviders = getWatchProviders();

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential, claimUsername: username })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      
      localStorage.setItem('movievault_token', data.token);
      localStorage.setItem('movievault_username', data.user.username);
      localStorage.setItem('movievault_user', JSON.stringify(data.user));
      setCurrentUser(data.user);
      
      // If we claimed a username, we are already on that page.
      // If they were assigned a new one, redirect.
      if (data.user.username !== username) {
        window.location.href = `/watchlist/${data.user.username}`;
      } else {
        fetchMovies();
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      alert(err.message || 'Failed to sign in with Google');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('movievault_token');
    localStorage.removeItem('movievault_username');
    localStorage.removeItem('movievault_user');
    setCurrentUser(null);
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 font-sans selection:bg-yellow-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-yellow-500 p-2 rounded-xl shadow-lg shadow-yellow-500/20 group-hover:shadow-yellow-500/40 transition-all">
              <Film className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Movie<span className="text-yellow-500">Vault</span> 🦥
            </h1>
          </Link>
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <form 
              ref={searchRef} 
              className="relative flex flex-1 sm:w-80 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const query = newMovieQuery.trim();
                
                if (/^\d+$/.test(query)) {
                  handleAddMovie(query);
                  return;
                }
                
                const imdbMatch = query.match(/tt\d+/);
                if (imdbMatch) {
                  handleAddMovie(imdbMatch[0]);
                  return;
                }
              }}
            >
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-zinc-500" />
                </div>
                <input
                  type="text"
                  value={newMovieQuery}
                  onChange={(e) => setNewMovieQuery(e.target.value)}
                  placeholder="Search movies to add..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
                />
              </div>
            </form>
            
            <div className="hidden sm:flex items-center gap-2 bg-white/5 p-1 rounded-full border border-white/10">
              <button onClick={handleShare} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white" title="Copy Link">
                <Share2 className="w-4 h-4" />
              </button>
              <button onClick={handleWhatsAppShare} className="p-2 hover:bg-[#25D366]/20 rounded-full transition-colors text-zinc-400 hover:text-[#25D366]" title="Share on WhatsApp">
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Auth / Profile Block */}
            <div className="flex items-center gap-2">
              {currentUser ? (
                <div className="flex items-center gap-3 ml-2 bg-white/5 pl-2 pr-4 py-1.5 rounded-full border border-white/10">
                  <img src={currentUser.picture || `https://ui-avatars.com/api/?name=${currentUser.name || currentUser.username}&background=EAB308&color=000`} alt="Profile" className="w-7 h-7 rounded-full" />
                  <span className="text-sm font-medium text-white hidden sm:block">{currentUser.name || currentUser.username}</span>
                  <button onClick={handleLogout} className="text-zinc-400 hover:text-white transition-colors ml-2" title="Sign Out">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="ml-2 scale-90 sm:scale-100 origin-right">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => alert('Google login failed')}
                    type="icon"
                    theme="filled_black"
                    shape="circle"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {newMovieQuery.trim().length > 0 ? (
        <main className="max-w-7xl mx-auto px-6 py-12">
          <SearchResults 
            keyword={newMovieQuery.trim()} 
            results={globalSearchResults} 
            isLoading={isSearching} 
            onMovieClick={handleMovieClick} 
          />
        </main>
      ) : (
        <>
          {/* Hero Section */}
          {!loading && featuredMovie && (
        <div className="relative w-full h-[60vh] min-h-[400px] max-h-[600px] bg-[#0a0a0a] overflow-hidden border-b border-white/5">
          <div className="absolute inset-0">
            {featuredMovie.poster_url && (
              <img 
                src={featuredMovie.poster_url} 
                alt={featuredMovie.title} 
                className="w-full h-full object-cover opacity-20 blur-3xl scale-110" 
                referrerPolicy="no-referrer"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />
          </div>
          
          <div className="relative h-full max-w-7xl mx-auto px-6 flex items-center">
            <div className="flex gap-8 items-center w-full">
              {featuredMovie.poster_url && (
                <motion.img 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  src={featuredMovie.poster_url} 
                  alt={featuredMovie.title} 
                  className="hidden md:block w-64 rounded-2xl shadow-2xl shadow-black/50 border border-white/10" 
                  referrerPolicy="no-referrer"
                />
              )}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="max-w-2xl"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-yellow-500 mb-4 uppercase tracking-wider">
                  {username}'s Featured
                </div>
                <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 tracking-tight leading-tight">
                  {featuredMovie.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mb-6 text-sm font-medium text-zinc-400">
                  <div className="flex items-center gap-1 text-white font-bold bg-white/10 px-2 py-1 rounded-md border border-white/5">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    {featuredMovie.imdb_rating && featuredMovie.imdb_rating !== 'N/A' ? Number(String(featuredMovie.imdb_rating).replace('⭐ ', '').split(' ')[0]).toFixed(1) : 'NR'}
                  </div>
                  <span>{featuredMovie.year}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                    {featuredMovie.genre?.split(',')[0] || 'Unknown'}
                  </span>
                </div>
                <p className="text-lg text-zinc-400 mb-8 line-clamp-3 md:line-clamp-4 leading-relaxed">
                  {featuredMovie.overview || 'No description available.'}
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleMovieClick(featuredMovie)}
                    className="bg-white text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-zinc-200 transition-colors shadow-lg"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    Details
                  </button>
                  <button 
                    onClick={() => toggleStatus(featuredMovie)} 
                    className="bg-white/10 text-white border border-white/10 px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-white/20 transition-colors backdrop-blur-md"
                  >
                    {featuredMovie.status === 'watched' ? <Check className="w-5 h-5 text-green-400" /> : <Plus className="w-5 h-5" />}
                    {featuredMovie.status === 'watched' ? 'Watched' : 'Mark as Watched'}
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Tabs and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 border-b border-white/10 pb-4 gap-4">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('wishlist')}
              className={`text-lg font-bold transition-colors relative ${activeTab === 'wishlist' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Wishlist
              {activeTab === 'wishlist' && (
                <motion.div layoutId="activeTab" className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-yellow-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('watched')}
              className={`text-lg font-bold transition-colors relative ${activeTab === 'watched' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Watched
              {activeTab === 'watched' && (
                <motion.div layoutId="activeTab" className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-yellow-500" />
              )}
            </button>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-zinc-500" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your movies..."
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
              />
            </div>
            <div className="sm:hidden flex items-center gap-2">
              <button onClick={handleShare} className="p-2 bg-white/5 rounded-full text-zinc-400"><Share2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10">
            <AnimatePresence>
              {displayedMovies.map((movie) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  key={movie.id} 
                  className="flex flex-col group relative cursor-pointer" 
                  onClick={() => handleMovieClick(movie)}
                >
                  {/* Poster Container */}
                  <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-zinc-900 shadow-lg border border-white/5 group-hover:border-yellow-500/50 transition-colors duration-300">
                    {movie.poster_url ? (
                      <img 
                        src={movie.poster_url} 
                        alt={movie.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700">
                        <Film className="w-12 h-12 mb-2 opacity-50" />
                        <span className="text-xs font-medium uppercase tracking-wider">No Poster</span>
                      </div>
                    )}
                    
                    {/* Hover Overlay Actions */}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                      <button 
                        onClick={(e) => toggleStatus(movie, e)} 
                        className="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-colors w-3/4 justify-center backdrop-blur-md"
                      >
                        {movie.status === 'watched' ? <Plus className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        {movie.status === 'watched' ? 'To Wishlist' : 'Watched'}
                      </button>
                      <button 
                        onClick={(e) => deleteMovie(movie.id, e)} 
                        className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-red-500 hover:text-white transition-colors w-3/4 justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>

                    {/* Status Indicator */}
                    {movie.status === 'watched' && (
                      <div className="absolute top-2 right-2 bg-green-500/90 backdrop-blur-sm text-white p-1.5 rounded-full shadow-lg">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  
                  {/* Rating Badge */}
                  <div className="relative -mt-5 ml-3 z-10 w-10 h-10 rounded-full bg-[#0a0a0a] border border-white/10 flex items-center justify-center text-white font-bold text-xs shadow-lg group-hover:border-yellow-500/50 transition-colors">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 absolute top-1" />
                    <span className="mt-2">{movie.imdb_rating && movie.imdb_rating !== 'N/A' ? Number(String(movie.imdb_rating).replace('⭐ ', '').split(' ')[0]).toFixed(1) : 'NR'}</span>
                  </div>
                  
                  {/* Title & Year */}
                  <div className="px-1 pt-2">
                    <h2 className="text-white font-bold text-sm leading-tight line-clamp-1 group-hover:text-yellow-500 transition-colors" title={movie.title}>
                      {movie.title}
                    </h2>
                    <p className="text-zinc-500 text-xs mt-1">{movie.year || 'Unknown Year'}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && displayedMovies.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 text-center px-4">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
              <Film className="w-10 h-10 text-zinc-600" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">This list is empty</h3>
            <p className="text-zinc-500 max-w-md mx-auto mb-8">
              {activeTab === 'wishlist' 
                ? "Start building your wishlist by searching for movies above."
                : "You haven't marked any movies as watched yet."}
            </p>
          </motion.div>
        )}
      </main>
      </>
      )}

      {/* Movie Details Modal */}
      <AnimatePresence>
        {selectedMovie && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-5xl bg-[#0f0f0f] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]"
            >
              <button 
                onClick={() => setSelectedMovie(null)} 
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/10 rounded-full text-white transition-colors backdrop-blur-md border border-white/10"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Trailer or Backdrop */}
              <div className="w-full aspect-video sm:aspect-[21/9] bg-black relative border-b border-white/5">
                {isFetchingTrailer ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
                  </div>
                ) : trailerKey ? (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
                    title="Trailer"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {selectedMovie.poster_url ? (
                      <img src={selectedMovie.poster_url} alt={selectedMovie.title} className="w-full h-full object-cover opacity-30 blur-sm" />
                    ) : (
                      <Film className="w-20 h-20 text-zinc-800" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] to-transparent" />
                    <p className="absolute bottom-6 text-zinc-500 font-medium">No trailer available</p>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col md:flex-row gap-8">
                  {selectedMovie.poster_url && (
                    <img 
                      src={selectedMovie.poster_url} 
                      alt={selectedMovie.title} 
                      className="w-32 md:w-48 rounded-xl shadow-2xl border border-white/10 hidden md:block object-cover aspect-[2/3]" 
                    />
                  )}
                  <div className="flex-1">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-1 tracking-tight">
                      {selectedMovie.title} <span className="text-zinc-500 font-normal">({selectedMovie.year})</span>
                    </h2>
                    
                    {extendedDetails?.tagline && (
                      <p className="text-yellow-500/80 italic mb-4 text-lg">{extendedDetails.tagline}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-zinc-300 mb-6">
                      <span className="flex items-center gap-1 text-white bg-white/10 border border-white/5 px-2 py-1 rounded-md font-bold">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        {selectedMovie.imdb_rating && selectedMovie.imdb_rating !== 'N/A' ? Number(String(selectedMovie.imdb_rating).replace('⭐ ', '').split(' ')[0]).toFixed(1) : 'NR'}
                      </span>
                      
                      {extendedDetails?.release_date && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-zinc-500" />
                          {new Date(extendedDetails.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                      )}
                      
                      {(extendedDetails?.runtime > 0 || (selectedMovie.runtime && selectedMovie.runtime > 0)) && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-zinc-500" />
                          {Math.floor((extendedDetails?.runtime || selectedMovie.runtime || 0) / 60)}h {(extendedDetails?.runtime || selectedMovie.runtime || 0) % 60}m
                        </span>
                      )}

                      {extendedDetails?.status && (
                        <span className="flex items-center gap-1.5">
                          <Info className="w-4 h-4 text-zinc-500" />
                          {extendedDetails.status}
                        </span>
                      )}
                    </div>

                    {/* Genres */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {(extendedDetails?.genres || []).map((g: any) => (
                        <span key={g.id} className="px-3 py-1 bg-white/5 text-zinc-300 rounded-full text-xs font-medium border border-white/10">
                          {g.name}
                        </span>
                      ))}
                      {!extendedDetails && selectedMovie.genre?.split(',').map((g, i) => (
                        <span key={i} className="px-3 py-1 bg-white/5 text-zinc-300 rounded-full text-xs font-medium border border-white/10">
                          {g.trim()}
                        </span>
                      ))}
                    </div>

                    <p className="text-zinc-300 leading-relaxed mb-8 text-lg">
                      {extendedDetails?.overview || selectedMovie.overview || 'No description available.'}
                    </p>

                    {/* Cast */}
                    {(extendedDetails?.credits?.cast?.length > 0) && (
                      <div className="mb-8">
                        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                          <Users className="w-4 h-4 text-yellow-500" /> Top Cast
                        </h3>
                        <div className="flex flex-wrap gap-4">
                          {extendedDetails.credits.cast.slice(0, 5).map((actor: any) => (
                            <div key={actor.id} className="flex items-center gap-3 bg-white/5 pr-4 rounded-full border border-white/10">
                              {actor.profile_path ? (
                                <img src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} alt={actor.name} className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500"><Users className="w-5 h-5" /></div>
                              )}
                              <div className="flex flex-col py-1">
                                <span className="text-sm font-medium text-white leading-tight">{actor.name}</span>
                                <span className="text-xs text-zinc-500 leading-tight">{actor.character}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Where to Watch */}
                    {extendedDetails && (
                      <div className="mb-8">
                        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                          <Tv className="w-4 h-4 text-yellow-500" /> Where to Watch
                        </h3>
                        {watchProviders && watchProviders.length > 0 ? (
                          <div className="flex flex-wrap gap-3">
                            {watchProviders.map((provider: any) => (
                              <a 
                                key={provider.provider_id} 
                                href={extendedDetails['watch/providers']?.results?.['IN']?.link || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-white/5 pr-3 rounded-full border border-white/10 hover:bg-white/10 hover:border-yellow-500/50 transition-all cursor-pointer group" 
                                title={`Watch on ${provider.provider_name}`}
                              >
                                <img 
                                  src={`https://image.tmdb.org/t/p/original${provider.logo_path}`} 
                                  alt={provider.provider_name} 
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                                <span className="text-sm font-medium text-white group-hover:text-yellow-500 transition-colors">{provider.provider_name}</span>
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-zinc-400 text-sm bg-white/5 p-4 rounded-xl border border-white/10 inline-block">
                            Currently not available on streaming platforms.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4">
                      {movies.find(m => m.id === selectedMovie.id) ? (
                        <>
                          <button
                            onClick={() => toggleStatus(movies.find(m => m.id === selectedMovie.id)!)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all shadow-lg ${
                              movies.find(m => m.id === selectedMovie.id)?.status === 'watched'
                                ? 'bg-white/10 text-white border border-white/10 hover:bg-white/20'
                                : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-500/20'
                            }`}
                          >
                            {movies.find(m => m.id === selectedMovie.id)?.status === 'watched' ? <Plus className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                            {movies.find(m => m.id === selectedMovie.id)?.status === 'watched' ? 'Move to Wishlist' : 'Mark as Watched'}
                          </button>
                          <button
                            onClick={() => deleteMovie(selectedMovie.id)}
                            className="flex items-center gap-2 px-6 py-3 rounded-full font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                            Remove from Vault
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleAddMovie(selectedMovie.id)}
                          disabled={isAdding}
                          className="flex items-center gap-2 px-8 py-3 rounded-full font-bold bg-yellow-500 text-black hover:bg-yellow-400 shadow-lg shadow-yellow-500/20 transition-all disabled:opacity-50"
                        >
                          {isAdding ? (
                            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          ) : (
                            <Plus className="w-5 h-5" />
                          )}
                          Add to Vault
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Home() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const savedUsername = localStorage.getItem('movievault_username');
    // We only auto-redirect if they have a token or just a username
    // But it's safer to let them click since we added Google Login
    if (savedUsername && localStorage.getItem('movievault_token')) {
      navigate(`/watchlist/${savedUsername}`);
    }
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      const normalized = username.trim().toLowerCase();
      // For guest access, we don't set a token, just the username
      localStorage.setItem('movievault_username', normalized);
      navigate(`/watchlist/${normalized}`);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setError('');
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      
      localStorage.setItem('movievault_token', data.token);
      localStorage.setItem('movievault_username', data.user.username);
      localStorage.setItem('movievault_user', JSON.stringify(data.user));
      navigate(`/watchlist/${data.user.username}`);
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setError(err.message || 'Failed to sign in with Google');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 selection:bg-yellow-500/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-yellow-500/20 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-yellow-600/20 blur-[120px]" />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#0f0f0f] p-8 rounded-3xl border border-white/10 shadow-2xl relative z-10"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-yellow-500 p-4 rounded-2xl shadow-lg shadow-yellow-500/20">
            <Film className="w-10 h-10 text-black" />
          </div>
        </div>
        <h1 className="text-3xl font-extrabold text-center text-white mb-2 tracking-tight">
          Movie<span className="text-yellow-500">Vault</span> 🦥
        </h1>
        <p className="text-zinc-400 text-center mb-8">Sign in to manage your smart watchlist, or view a public one.</p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        <div className="flex justify-center mb-6">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              console.log('Login Failed');
              setError('Google login failed. Please try again.');
            }}
            theme="filled_black"
            shape="pill"
          />
        </div>

        <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-zinc-500 text-sm">or enter public username</span>
            <div className="flex-grow border-t border-white/10"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. neeraj"
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10"
          >
            View Public Watchlist
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/watchlist/:username" element={<Watchlist />} />
    </Routes>
  );
}

export default App;
