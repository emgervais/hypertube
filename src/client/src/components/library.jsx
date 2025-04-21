import { useState, useEffect, useCallback } from 'react'
import MovieCard from './movieCard';
import DropDown from './dropDown'


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
        event.preventDefault()
        const name = event.target.searchMovie.value;
        setMovieList([]);
        setDone(false);
        setFilters({...filters, name: name, page: 1});
    }

    useEffect(() => {
        const fetchFilter = async () => {
            if (done) return;
            const url = new URL('http://localhost:8080/api/movies/filter');
            for (const [key, value] of Object.entries(filters))
                url.searchParams.set(key, value);
            const res = await fetch(url);
            const movies = await res.json();
            if (movies.length === 0)
                return setDone(true);
            setMovieList(movieList.concat(movies));
        }
        fetchFilter();
    }, [filters]);

    return (
        <div className='flex flex-col flex-5 m-5 items-left h-fit' >
            <header className='flex justify-center'>
                <div>
                    <form className='flex' onSubmit={handleSearch}>
                        <input className='border-solid border-1 border-inherit rounded-md text-center mr-2' id="searchMovie" name="searchMovie" type="searchMovie" required autoComplete="searchMovie" placeholder="Search a movie"></input>
                        <button type="submit" className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500"> Search </button>
                    </form>
                </div>
                <ul className='flex space-between'>
                    <li className='ml-3 mr-3 flex items-center'><DropDown options={["1", "2", "3", "4"]} main="Rating"/></li>
                    <li className='ml-3 mr-3 flex items-center'><DropDown options={["action", "adventure", "animation", "comedy", "anime", "crime", "documentary", "drama", "sci-fi", "romance"]} main="Genre"/></li>
                    <li className='ml-3 mr-3 flex items-center'><DropDown options={["1980", "1990", "2000", "2010", "2020"]} main="Year"/></li>
                </ul>
                <DropDown options={["Name", "Rating", "Year", "Length", "Peers", "Seeders"]} main="Sort by"/>
            </header>
            <main className='grid grid-cols-6 gap-5 w-9/10 mt-5'>
                {movieList.map((movie) => {
                    return (<MovieCard movie={movie} isWatched={false}/>)
                })}
            </main>
        </div>
    )
}