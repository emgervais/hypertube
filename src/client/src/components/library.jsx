import { useState, useEffect } from 'react'
import MovieCard from './movieCard';

export default function Library() {
    const [movieList, setMovieList] = useState([]);

    useEffect(() => {
        const init = async () => {
            const res = await fetch('http://localhost:8080/api/movies/pop');
            const movies = await res.json();
            setMovieList(movies);
        }
        init();
    }, [])
    const handleSearch = async (event) => {
        event.preventDefault()
        const name = event.target.searchMovie.value;
        const res = await fetch(`http://localhost:8080/api/movies/name/${name}`);
        const movies = await res.json();
        setMovieList(movies);
    }
    return (
        <div className='flex flex-col flex-5 m-5'>
            <header className='flex justify-center'>
                <form className='flex' onSubmit={handleSearch}>
                    <input className='border-solid border-1 border-inherit rounded-md text-center' id="searchMovie" name="searchMovie" type="searchMovie" required autoComplete="searchMovie" placeholder="Search a movie"></input>
                    <button type="submit" className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500"> Search </button>
                </form>
            </header>
            <main className='grid grid-cols-5'>
                {movieList.map((movie) => {
                    return (<MovieCard movie={movie}/>)
                })}
            </main>
        </div>
    )
}