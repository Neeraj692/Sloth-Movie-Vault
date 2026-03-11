import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MovieCard } from './MovieCard';

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

interface SearchResultsProps {
  keyword: string;
  results: Movie[];
  isLoading: boolean;
  onMovieClick: (movie: Movie) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ keyword, results, isLoading, onMovieClick }) => {
  return (
    <div className="w-full">
      <div className="mb-8 border-b border-white/10 pb-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Search Results for <span className="text-yellow-500">"{keyword}"</span>
        </h2>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Searching movies...</p>
        </div>
      ) : results.length > 0 ? (
        <motion.div 
          layout 
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10"
        >
          <AnimatePresence>
            {results.map((movie) => (
              <MovieCard 
                key={movie.id} 
                movie={movie} 
                onClick={onMovieClick} 
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-zinc-400 text-lg">No movies found for "{keyword}".</p>
          <p className="text-zinc-500 text-sm mt-2">Try adjusting your search terms.</p>
        </div>
      )}
    </div>
  );
};
