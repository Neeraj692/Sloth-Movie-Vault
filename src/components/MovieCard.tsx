import React from 'react';
import { motion } from 'framer-motion';
import { Star, Film } from 'lucide-react';

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

interface MovieCardProps {
  movie: Movie;
  onClick: (movie: Movie) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, onClick }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      whileHover={{ scale: 1.05 }}
      className="flex flex-col group relative cursor-pointer rounded-xl overflow-hidden bg-zinc-900 shadow-md hover:shadow-2xl hover:shadow-yellow-500/20 transition-all duration-300 border border-white/5"
      onClick={() => onClick(movie)}
    >
      {/* Poster Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-800">
        {movie.poster_url ? (
          <img
            src={movie.poster_url}
            alt={movie.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700">
            <Film className="w-12 h-12 mb-2 opacity-50" />
            <span className="text-xs font-medium uppercase tracking-wider">No Poster</span>
          </div>
        )}

        {/* Rating Badge */}
        {movie.imdb_rating && movie.imdb_rating !== 'N/A' && (
          <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md text-white px-2 py-1 rounded-md flex items-center gap-1 text-xs font-bold border border-white/10 shadow-lg">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            {Number(movie.imdb_rating.replace('⭐ ', '').split(' ')[0]).toFixed(1)}
          </div>
        )}
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Details Section */}
      <div className="p-4 flex flex-col gap-1 bg-zinc-900">
        <h3 className="text-white font-bold text-sm sm:text-base truncate group-hover:text-yellow-500 transition-colors">
          {movie.title}
        </h3>
        <p className="text-zinc-400 text-xs sm:text-sm">
          {movie.year || 'Unknown Year'}
        </p>
      </div>
    </motion.div>
  );
};
