import React, { useState, useEffect } from 'react';
import { Search, Play, Plus, Check, Star, X, Clock, Film, ChevronLeft, Info, Trash2, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchApi, getImageUrl } from './lib/tmdb';

interface Movie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  overview: string;
  genre_ids?: number[];
}

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}

function RatingBadge({ rating, isImdb = false }: { rating: number | string, isImdb?: boolean }) {
  if (!rating || rating === 'N/A' || rating === 0) return <div className="bg-black/80 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg border border-white/10">NR</div>;
  
  const numRating = typeof rating === 'string' ? parseFloat(rating) : rating;
  
  return (
    <div className="bg-black/80 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg flex items-center gap-1 border border-white/10 backdrop-blur-md">
      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
      <span>{numRating.toFixed(1)}</span>
      <span className="text-gray-400 text-[10px] ml-0.5">{isImdb ? 'IMDb' : 'Score'}</span>
    </div>
  );
}

function MovieCard({ movie, onClick, onAdd, isWatchlisted, isWatched }: any) {
  const title = movie.title || movie.name;
  const releaseDate = movie.release_date || movie.first_air_date;
  const rating = movie.imdb_rating || movie.vote_average;
  const isImdb = !!movie.imdb_rating;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5 }}
      className="group relative rounded-xl overflow-hidden bg-[#141414] cursor-pointer border border-white/5 shadow-lg"
      onClick={onClick}
    >
      <div className="aspect-[2/3] relative overflow-hidden">
        <img src={getImageUrl(movie.poster_path)} alt={title} className="w-full h-full object-cover transition duration-500 group-hover:scale-110 group-hover:opacity-40" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition duration-300 z-10">
          <button className="bg-yellow-400 text-black px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-yellow-500 transition">
            <Info className="w-4 h-4" /> Details
          </button>
          {!isWatched && (
            <button 
              onClick={(e) => { e.stopPropagation(); onAdd(movie); }}
              className="bg-black/60 text-white border border-white/20 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-white/20 transition backdrop-blur-md"
            >
              {isWatchlisted ? <Check className="w-4 h-4 text-yellow-400" /> : <Plus className="w-4 h-4" />} 
              {isWatchlisted ? 'In Watchlist' : 'Watchlist'}
            </button>
          )}
        </div>

        <div className="absolute top-2 right-2 z-20">
          <RatingBadge rating={rating} isImdb={isImdb} />
        </div>
        {isWatched && (
          <div className="absolute top-2 left-2 z-20 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg flex items-center gap-1">
            <Check className="w-3 h-3" /> Watched
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-white font-semibold text-sm truncate" title={title}>{title}</h3>
        <p className="text-gray-400 text-xs mt-1">{releaseDate ? releaseDate.substring(0, 4) : 'N/A'}</p>
      </div>
    </motion.div>
  );
}

function HeroBanner({ movie, onClick }: any) {
  if (!movie) return <div className="w-full h-[60vh] bg-[#0a0a0a] animate-pulse" />;
  return (
    <div className="relative w-full h-[60vh] sm:h-[70vh] bg-black cursor-pointer group" onClick={onClick}>
      <img src={getImageUrl(movie.backdrop_path, 'original')} className="w-full h-full object-cover opacity-60 transition duration-700 group-hover:opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
      <div className="absolute bottom-0 left-0 p-6 sm:p-12 max-w-4xl">
        <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-4xl sm:text-6xl font-bold text-white mb-4 drop-shadow-lg">
          {movie.title}
        </motion.h1>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="flex items-center gap-4 mb-4 text-sm font-medium">
          <span className="text-yellow-400 flex items-center gap-1"><Star className="w-4 h-4 fill-yellow-400" /> {movie.vote_average?.toFixed(1)}</span>
          <span className="text-gray-300">{movie.release_date?.substring(0, 4)}</span>
        </motion.div>
        <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-gray-300 text-sm sm:text-base mb-8 line-clamp-3 max-w-2xl drop-shadow-md">
          {movie.overview}
        </motion.p>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="flex gap-4">
          <button className="bg-yellow-400 text-black px-6 sm:px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-yellow-500 transition shadow-lg shadow-yellow-400/20">
            <Play className="w-5 h-5 fill-black" /> Watch Trailer
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function MovieDetails({ id, onClose, isWatchlisted, isWatched, onAddWatchlist, onRemoveWatchlist, onMarkWatched, onMovieSelect }: any) {
  const [movie, setMovie] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchApi(`/movie/${id}`, { append_to_response: 'videos,credits,recommendations' })
      .then(async (data) => {
        if (data.imdb_id) {
          try {
            const omdbRes = await fetch(`https://www.omdbapi.com/?i=${data.imdb_id}&apikey=trilogy`);
            const omdbData = await omdbRes.json();
            if (omdbData.imdbRating && omdbData.imdbRating !== "N/A") {
              data.imdb_rating = omdbData.imdbRating;
            }
          } catch (e) {
            console.error("OMDB fetch error:", e);
          }
        }
        setMovie(data);
      })
      .catch(async (err) => {
        // Fallback to TV show if movie fetch fails
        try {
          const tvData = await fetchApi(`/tv/${id}`, { append_to_response: 'videos,credits,recommendations,external_ids' });
          if (tvData.external_ids?.imdb_id) {
            const omdbRes = await fetch(`https://www.omdbapi.com/?i=${tvData.external_ids.imdb_id}&apikey=trilogy`);
            const omdbData = await omdbRes.json();
            if (omdbData.imdbRating && omdbData.imdbRating !== "N/A") {
              tvData.imdb_rating = omdbData.imdbRating;
            }
          }
          setMovie(tvData);
        } catch (e) {
          console.error("Failed to fetch details", e);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !movie) return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex items-center justify-center">
       <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const trailer = movie.videos?.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
  const cast = movie.credits?.cast?.slice(0, 10) || [];
  const recommendations = movie.recommendations?.results?.slice(0, 12) || [];

  return (
    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-50 bg-[#0a0a0a] overflow-y-auto">
      <button onClick={onClose} className="absolute top-6 left-6 z-50 bg-black/50 p-3 rounded-full text-white hover:bg-yellow-400 hover:text-black transition backdrop-blur-md">
        <ChevronLeft className="w-6 h-6" />
      </button>

      <div className="relative w-full h-[50vh] sm:h-[70vh]">
        <img src={getImageUrl(movie.backdrop_path, 'original')} className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] to-transparent" />
        
        <div className="absolute bottom-0 left-0 w-full p-6 sm:p-12 flex flex-col sm:flex-row gap-8 items-end sm:items-start max-w-7xl mx-auto">
          <img src={getImageUrl(movie.poster_path)} className="w-32 sm:w-64 rounded-xl shadow-2xl border border-white/10 hidden sm:block -mb-16 z-10" />
          <div className="flex-1 z-10">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">{movie.title || movie.name} <span className="text-gray-400 font-normal">({(movie.release_date || movie.first_air_date)?.substring(0,4)})</span></h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mb-6">
              <RatingBadge rating={movie.imdb_rating || movie.vote_average} isImdb={!!movie.imdb_rating} />
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {movie.runtime || movie.episode_run_time?.[0] || '?'} min</span>
              <span>•</span>
              <span>{movie.genres?.map((g: any) => g.name).join(', ')}</span>
            </div>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed max-w-3xl mb-8">{movie.overview}</p>
            
            <div className="flex flex-wrap gap-4">
              {!isWatched ? (
                <>
                  <button onClick={() => isWatchlisted ? onRemoveWatchlist(movie.id) : onAddWatchlist(movie)} className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 transition ${isWatchlisted ? 'bg-white/10 text-white hover:bg-red-500/20 hover:text-red-400' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    {isWatchlisted ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    {isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  </button>
                  <button onClick={() => onMarkWatched(movie)} className="bg-emerald-500 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20">
                    <Check className="w-5 h-5" /> Mark as Watched
                  </button>
                </>
              ) : (
                <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-6 py-3 rounded-full font-bold flex items-center gap-2">
                  <Check className="w-5 h-5" /> You've watched this
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-12 py-12 sm:pt-24 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          {trailer && (
            <section>
              <h2 className="text-2xl font-bold text-white mb-6 border-l-4 border-yellow-400 pl-3">Official Trailer</h2>
              <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/5">
                <iframe 
                  src={`https://www.youtube.com/embed/${trailer.key}`} 
                  title="YouTube video player" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              </div>
            </section>
          )}

          <section>
            <h2 className="text-2xl font-bold text-white mb-6 border-l-4 border-yellow-400 pl-3">Top Billed Cast</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
              {cast.map((actor: any) => (
                <div key={actor.id} className="min-w-[140px] bg-[#141414] rounded-xl overflow-hidden border border-white/5 snap-start">
                  <img src={getImageUrl(actor.profile_path, 'w200')} alt={actor.name} className="w-full h-[175px] object-cover bg-[#1f1f1f]" />
                  <div className="p-3">
                    <h4 className="text-white font-semibold text-sm leading-tight mb-1">{actor.name}</h4>
                    <p className="text-gray-400 text-xs leading-tight">{actor.character}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <div className="bg-[#141414] rounded-2xl p-6 border border-white/5">
            <h3 className="text-lg font-bold text-white mb-4">Facts</h3>
            <div className="space-y-4 text-sm">
              <div>
                <span className="block text-gray-500 mb-1">Status</span>
                <span className="text-gray-200">{movie.status}</span>
              </div>
              <div>
                <span className="block text-gray-500 mb-1">Release Date</span>
                <span className="text-gray-200">{movie.release_date}</span>
              </div>
              <div>
                <span className="block text-gray-500 mb-1">Budget</span>
                <span className="text-gray-200">${movie.budget?.toLocaleString() || '-'}</span>
              </div>
              <div>
                <span className="block text-gray-500 mb-1">Revenue</span>
                <span className="text-gray-200">${movie.revenue?.toLocaleString() || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {recommendations.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 sm:px-12 pb-24">
          <h2 className="text-2xl font-bold text-white mb-6 border-l-4 border-yellow-400 pl-3">Recommended Movies</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recommendations.map((rec: any) => (
              <MovieCard 
                key={rec.id} 
                movie={rec} 
                onClick={() => onMovieSelect(rec.id)} 
                onAdd={onAddWatchlist}
                isWatchlisted={false} 
                isWatched={false}
              />
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}

function HomeView({ watchlist, watched, onMovieSelect, onRemoveWatchlist, onRemoveWatched, onMarkWatched }: any) {
  const [tab, setTab] = useState('watchlist');
  const heroMovie = watchlist.find((m: any) => m.vote_average > 7.0) || watchlist[0] || watched[0];

  return (
    <div className="pb-24">
      {heroMovie ? (
        <HeroBanner movie={heroMovie} onClick={() => onMovieSelect(heroMovie?.id)} />
      ) : (
        <div className="w-full h-[50vh] bg-gradient-to-b from-[#141414] to-[#0a0a0a] flex flex-col items-center justify-center border-b border-white/5">
          <span className="text-6xl mb-6">🦥</span>
          <h2 className="text-3xl font-bold text-white mb-4">Welcome to MovieVault</h2>
          <p className="text-gray-400 text-lg">Search or discover movies to build your watchlist.</p>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="flex items-center gap-8 mb-8 border-b border-white/10">
          <button onClick={() => setTab('watchlist')} className={`pb-4 text-lg font-bold transition ${tab === 'watchlist' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500 hover:text-white'}`}>
            My Watchlist ({watchlist.length})
          </button>
          <button onClick={() => setTab('watched')} className={`pb-4 text-lg font-bold transition ${tab === 'watched' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500 hover:text-white'}`}>
            Recently Watched ({watched.length})
          </button>
        </div>

        {tab === 'watchlist' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {watchlist.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">Your watchlist is empty. Go to Discover or Search to add some!</div>}
            {watchlist.map((movie: any) => (
              <MovieCard key={movie.id} movie={movie} onClick={() => onMovieSelect(movie.id)} isWatchlisted={true} isWatched={false} onAdd={() => {}} />
            ))}
          </div>
        )}

        {tab === 'watched' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {watched.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">You haven't watched any movies yet.</div>}
            {watched.map((movie: any) => (
              <MovieCard key={movie.id} movie={movie} onClick={() => onMovieSelect(movie.id)} isWatchlisted={false} isWatched={true} onAdd={() => {}} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DiscoverView({ onMovieSelect, isWatchlisted, isWatched, onAddWatchlist }: any) {
  const [movies, setMovies] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [year, setYear] = useState('');

  useEffect(() => {
    fetchApi('/genre/movie/list').then(res => setGenres(res.genres));
  }, []);

  useEffect(() => {
    const params: any = { sort_by: sortBy };
    if (selectedGenre) params.with_genres = selectedGenre;
    if (year) params.primary_release_year = year;
    
    fetchApi('/discover/movie', params).then(res => setMovies(res.results));
  }, [selectedGenre, sortBy, year]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-3xl font-bold text-white mb-8">Discover Movies</h2>
      
      <div className="flex flex-wrap gap-4 mb-8 bg-[#141414] p-4 rounded-2xl border border-white/5">
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-[#1f1f1f] text-white border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-yellow-400 outline-none">
          <option value="popularity.desc">Most Popular</option>
          <option value="vote_average.desc">Highest Rated</option>
          <option value="primary_release_date.desc">Latest Releases</option>
        </select>
        
        <select value={selectedGenre} onChange={e => setSelectedGenre(e.target.value)} className="bg-[#1f1f1f] text-white border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-yellow-400 outline-none">
          <option value="">All Genres</option>
          {genres.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <select value={year} onChange={e => setYear(e.target.value)} className="bg-[#1f1f1f] text-white border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-yellow-400 outline-none">
          <option value="">All Years</option>
          {Array.from({length: 30}, (_, i) => new Date().getFullYear() - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
        {movies.map(movie => (
          <MovieCard key={movie.id} movie={movie} onClick={() => onMovieSelect(movie.id)} isWatchlisted={isWatchlisted(movie.id)} isWatched={isWatched(movie.id)} onAdd={onAddWatchlist} />
        ))}
      </div>
    </div>
  );
}

function SearchResults({ query, onMovieSelect, isWatchlisted, isWatched, onAddWatchlist }: any) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const imdbMatch = query.match(/tt\d+/);
        if (imdbMatch) {
          const imdbId = imdbMatch[0];
          const res = await fetchApi(`/find/${imdbId}`, { external_source: 'imdb_id' });
          let combinedResults = [];
          if (res.movie_results) combinedResults.push(...res.movie_results);
          if (res.tv_results) combinedResults.push(...res.tv_results);
          
          if (combinedResults.length > 0) {
            try {
              const omdbRes = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=trilogy`);
              const omdbData = await omdbRes.json();
              if (omdbData.imdbRating && omdbData.imdbRating !== "N/A") {
                combinedResults[0].imdb_rating = omdbData.imdbRating;
              }
            } catch (e) {}
            setResults(combinedResults);
          } else {
            setResults([]);
          }
        } else {
          const res = await fetchApi('/search/multi', { query });
          setResults(res.results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv'));
        }
      } catch (error) {
        console.error(error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  if (loading) return <div className="p-12 text-center text-yellow-400"><div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-2xl font-bold text-white mb-8">Search Results for "{query}"</h2>
      {results.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No movies found.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {results.map(movie => (
            <MovieCard key={movie.id} movie={movie} onClick={() => onMovieSelect(movie.id)} isWatchlisted={isWatchlisted(movie.id)} isWatched={isWatched(movie.id)} onAdd={onAddWatchlist} />
          ))}
        </div>
      )}
    </div>
  );
}



function AboutView() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#141414] rounded-3xl p-8 sm:p-12 border border-white/5 shadow-2xl">
        <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center mb-8 transform -rotate-6">
          <Film className="w-8 h-8 text-black" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-8">About This Project</h2>
        
        <div className="space-y-6 text-gray-300 text-lg leading-relaxed">
          <p className="text-xl text-white font-medium">Hello there 👋<br/>Thanks for visiting my website.</p>
          
          <p>My name is <strong className="text-yellow-400">Neeraj Yadav</strong>, and I am a curious web developer who loves building useful and creative things on the internet. I enjoy exploring new technologies, experimenting with ideas, and turning simple concepts into practical web applications.</p>
          
          <p>This website is a small project where I keep track of movies I want to watch. As someone who enjoys movies, I wanted a simple place where I can discover films, watch trailers, check ratings, and maintain my personal watchlist.</p>
          
          <p>If you are also a movie lover, I hope this website helps you discover great movies and keep track of what you plan to watch next.</p>
          
          <p className="text-white font-medium pt-4">Thanks again for visiting and exploring the site!</p>
        </div>
      </motion.div>
    </div>
  );
}

function Navbar({ currentTab, setCurrentTab, searchQuery, setSearchQuery }: any) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'discover', label: 'Discover' },
    { id: 'about', label: 'About' },
  ];

  const handleNavClick = (id: string) => {
    setCurrentTab(id);
    setSearchQuery('');
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => handleNavClick('home')}>
          <span className="text-2xl">🦥</span>
          <h1 className="text-xl font-bold text-white">Movie<span className="text-yellow-400">Vault</span></h1>
        </div>
        
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(link => (
            <button key={link.id} onClick={() => handleNavClick(link.id)} className={`font-medium transition ${currentTab === link.id && !searchQuery ? 'text-yellow-400' : 'text-gray-300 hover:text-white'}`}>
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
          <div className="w-full max-w-xs relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search movies..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-[#141414] border border-white/10 rounded-full focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-sm text-white placeholder:text-gray-500"
            />
          </div>
          <button className="md:hidden p-2 text-gray-300 hover:text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden overflow-hidden bg-[#0a0a0a] border-b border-white/5">
            <div className="px-4 py-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search movies..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#141414] border border-white/10 rounded-full focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-sm text-white placeholder:text-gray-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                {navLinks.map(link => (
                  <button key={link.id} onClick={() => handleNavClick(link.id)} className={`text-left px-4 py-2 rounded-lg font-medium transition ${currentTab === link.id && !searchQuery ? 'bg-yellow-400/10 text-yellow-400' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<'home' | 'discover' | 'about'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);

  const [watchlist, setWatchlist] = useLocalStorage<Movie[]>('tmdb_watchlist', []);
  const [watched, setWatched] = useLocalStorage<Movie[]>('tmdb_watched', []);

  useEffect(() => {
    const migrated = localStorage.getItem('tmdb_migrated');
    if (migrated) return;

    const migrateMovies = async () => {
      try {
        const res = await fetch('/api/movies');
        const dbMovies = await res.json();
        
        if (!dbMovies || !Array.isArray(dbMovies) || dbMovies.length === 0) {
          localStorage.setItem('tmdb_migrated', 'true');
          return;
        }

        const currentWatchlist = JSON.parse(localStorage.getItem('tmdb_watchlist') || '[]');
        const currentWatched = JSON.parse(localStorage.getItem('tmdb_watched') || '[]');
        let changed = false;

        for (const dbMovie of dbMovies) {
          const alreadyExists = currentWatchlist.some((m:any) => m.legacy_id === dbMovie.Id) || 
                                currentWatched.some((m:any) => m.legacy_id === dbMovie.Id);
          if (alreadyExists) continue;

          try {
            const findRes = await fetchApi(`/find/${dbMovie.Id}`, { external_source: 'imdb_id' });
            const tmdbMovie = findRes.movie_results?.[0];

            if (tmdbMovie) {
              const movieToSave = { ...tmdbMovie, legacy_id: dbMovie.Id };
              if (dbMovie.Watched) currentWatched.push(movieToSave);
              else currentWatchlist.push(movieToSave);
              changed = true;
            } else {
              const fallbackMovie = {
                id: parseInt(dbMovie.Id.replace(/\\D/g, '')) || Math.floor(Math.random() * 1000000),
                title: dbMovie.Title,
                poster_path: dbMovie.PosterUrl,
                backdrop_path: dbMovie.PosterUrl,
                release_date: dbMovie.Year ? `${dbMovie.Year}-01-01` : '',
                vote_average: parseFloat(dbMovie.ImdbRating) || 0,
                overview: dbMovie.Description,
                legacy_id: dbMovie.Id
              };
              if (dbMovie.Watched) currentWatched.push(fallbackMovie);
              else currentWatchlist.push(fallbackMovie);
              changed = true;
            }
          } catch (e) {
            console.error('Failed to migrate movie', dbMovie.Id, e);
          }
        }

        if (changed) {
          localStorage.setItem('tmdb_watchlist', JSON.stringify(currentWatchlist));
          localStorage.setItem('tmdb_watched', JSON.stringify(currentWatched));
          localStorage.setItem('tmdb_migrated', 'true');
          window.location.reload();
        } else {
          localStorage.setItem('tmdb_migrated', 'true');
        }
      } catch (err) {
        console.error("Migration failed:", err);
      }
    };

    migrateMovies();
  }, []);

  const addToWatchlist = (movie: Movie) => {
    if (!watchlist.find(m => m.id === movie.id)) {
      setWatchlist([...watchlist, movie]);
    }
  };

  const removeFromWatchlist = (id: number) => {
    setWatchlist(watchlist.filter(m => m.id !== id));
  };

  const markAsWatched = (movie: Movie) => {
    if (!watched.find(m => m.id === movie.id)) {
      setWatched([movie, ...watched]);
      removeFromWatchlist(movie.id);
    }
  };

  const removeFromWatched = (id: number) => {
    setWatched(watched.filter(m => m.id !== id));
  };

  const isWatchlisted = (id: number) => !!watchlist.find(m => m.id === id);
  const isWatched = (id: number) => !!watched.find(m => m.id === id);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-yellow-400/30">
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      
      <main>
        {searchQuery ? (
          <SearchResults query={searchQuery} onMovieSelect={setSelectedMovieId} isWatchlisted={isWatchlisted} isWatched={isWatched} onAddWatchlist={addToWatchlist} />
        ) : currentTab === 'home' ? (
          <HomeView watchlist={watchlist} watched={watched} onMovieSelect={setSelectedMovieId} onRemoveWatchlist={removeFromWatchlist} onRemoveWatched={removeFromWatched} onMarkWatched={markAsWatched} />
        ) : currentTab === 'discover' ? (
          <DiscoverView onMovieSelect={setSelectedMovieId} isWatchlisted={isWatchlisted} isWatched={isWatched} onAddWatchlist={addToWatchlist} />
        ) : (
          <AboutView />
        )}
      </main>

      <AnimatePresence>
        {selectedMovieId && (
          <MovieDetails 
            id={selectedMovieId} 
            onClose={() => setSelectedMovieId(null)} 
            isWatchlisted={isWatchlisted(selectedMovieId)}
            isWatched={isWatched(selectedMovieId)}
            onAddWatchlist={addToWatchlist}
            onRemoveWatchlist={removeFromWatchlist}
            onMarkWatched={markAsWatched}
            onMovieSelect={setSelectedMovieId}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
