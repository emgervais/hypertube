import { useState, useEffect, useCallback } from 'react'
import MovieCard from './movieCard';
import DropDown from './dropDown'
import { useFetchWithAuth } from '../utils/fetchProtected';

function useInfiniteScroll(callback, offset = 300) {
    const handleScroll = useCallback(() => {
      const scrollY = window.scrollY;
      const visible = window.innerHeight;
      const pageHeight = document.body.offsetHeight;
  
      if (scrollY + visible >= pageHeight - offset) {
        callback();
      }
    }, [callback, offset]);
  
    useEffect(() => {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);
}

export default function Library() {
    const [movieList, setMovieList] = useState([]);
    const [done, setDone] = useState(false);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({sort: "download_count", page: 1});
    const [watched, setWatched] = useState([]);
    const fetchProtected = useFetchWithAuth();

    const resetList = () => {
        setDone(false);
        setMovieList([]);
    }
  const fetchMore = () => {
    if (loading) return;
    setLoading(true);
    setTimeout(() => {
      setFilters({...filters, page: filters.page + 1});
      setLoading(false);
    }, 1000);
  };

    useInfiniteScroll(fetchMore);

    const handleSearch = async (event) => {
        event.preventDefault();
        const name = event.target.searchMovie.value;
        resetList();
        setFilters({...filters, name: name, page: 1});
    }

    useEffect(() => {
        const init = async () => {
            const res = await fetchProtected('/user/watchedMovie');
            const watched = await res.json();
            setWatched(watched);
        }
        init();
    }, []);

    useEffect(() => {
        const fetchFilter = async () => {
            if (done) return;
            try {
                const url = new URL('http://localhost:8080/api/movies/filter');
                for (const [key, value] of Object.entries(filters)) {
                    url.searchParams.set(key, value);
                }
                const res = await fetch(url);
                const movies = await res.json();
                if (movies.length === 0) {
                    setDone(true);
                    return;
                }
                setMovieList(prev => prev.concat(movies).filter((movie, index, self) => index === self.findIndex(m => m.id === movie.id)));
            } catch(e) {
                console.error("Error fetching movies: ", e);
            }
        }
        fetchFilter();
    }, [filters]);

    return (
<div className="flex flex-col m-5 ml-0 h-fit w-full">
  <header className="flex flex-col gap-4 md:flex-row md:justify-between">
    <form
      className="flex flex-col sm:flex-row gap-2 items-center"
      onSubmit={handleSearch}
    >
      <input
        className="border border-gray-300 rounded-md text-center px-2 py-1 w-full sm:w-auto"
        id="searchMovie"
        name="searchMovie"
        type="text"
        required
        autoComplete="off"
        placeholder="Search a movie"
      />
      <button
        type="submit"
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 w-full sm:w-auto"
      >
        Search
      </button>
    </form>

    <ul className="flex flex-wrap justify-center gap-3">
      <li><DropDown position="left" reset={resetList} setFilters={setFilters} options={["2", "4", "6", "8"]} main="Rating" /></li>
      <li><DropDown position="left" reset={resetList} setFilters={setFilters} options={["action", "adventure", "animation", "comedy", "anime", "crime", "documentary", "drama", "sci-fi", "romance"]} main="Genre" /></li>
      <li><DropDown position="right" reset={resetList} setFilters={setFilters} options={["480p", "720p", "1080p", "2160p", "3D"]} main="Quality" /></li>
      <li><DropDown position="right" reset={resetList} setFilters={setFilters} options={["Title", "Rating", "Year"]} main="Sort by" /></li>
    </ul>
  </header>

  <main className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 mt-5">
    {movieList.map((movie) => (
      <MovieCard key={movie.id} movie={movie} isWatched={watched.includes(movie.id)} />
    ))}
  </main>
</div>
    )
}