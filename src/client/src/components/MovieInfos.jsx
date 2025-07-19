import { useEffect, useState } from "react"

export default function Movieinfos({id, title, year, runtime, rating}) {
    const [summary, setSummary] = useState("");
    const [director, setDirector] = useState("");
    const [cast, setCast] = useState([]);

    useEffect(() => {
        const fetchDetails = async () => {
            const res = await fetch(`http://127.0.0.1:8080/api/movieDetails/${id}`);
            const details = await res.json();
            setCast(details.cast);
            setSummary(details.summary)
            setDirector(details.director)
        }
        fetchDetails();
    }, [])
    return (
        <div>
            <div className="text-indigo-600 mb-5 text-2xl md:text-6xl text-center">{title} ({year})</div>
            <div className="flex justify-center mb-5 text-xs md:text-lg">
            {director ? <h5 className="mr-5">Director: {director.name}</h5> : ""}
            <h5 className="mr-5">length: {runtime} min</h5>
            <h5>rating: {rating}/10</h5>
            </div>
            <p className="mb-5 text-xs md:text-lg">{summary}</p>
            <div className="flex justify-between">
            {cast.map((c) => {
                return(
                    <h6 className="mb-5 mr-3 text-[0.5rem] md:text-lg">{c.name} as {c.character ? c.character : c.job}</h6>
                )
            })}
            </div>
        </div>
    )
}