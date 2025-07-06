import fetchPopcorn from "../serilizers/popcornSerilizer.js";
import fetchYTS from "../serilizers/ytsSerilizer.js";
import jsdom from 'jsdom'

export async function fetchMovies(params={}, page=1) {
        const [moviesPop, moviesTYS] = await Promise.all([
            fetchPopcorn(params),
            fetchYTS(params),
        ]);
        const fullList = moviesTYS.concat(moviesPop);
        const clearList = fullList.filter((movie, index, self) => 
            index === self.findIndex(m => m.id === movie.id)
        );
        if(page === 1) {
            clearList.unshift({
                id: 'tt1254207',
                title: 'Big Buck Bunny',
                year: '2008',
                runtime: '10',
                genres: 'animation',
                image: 'http://localhost:8080/images/bunny.jpg',
                rating: '10',
                summary: 'An enormous, fluffy, and utterly adorable rabbit is heartlessly harassed by the ruthless, loud, bullying gang of a flying squirrel, who is determined to squash his happiness.',
                torrents: 'https://archive.org/download/BigBuckBunny_124/BigBuckBunny_124_archive.torrent'
            });
        }
        return clearList;
}

export async function findMovie(id) {
    try {
        //first check yts
        const res = await fetch(`https://yts.mx/api/v2/movie_details.json?imdb_id=${id}`);
        let movie = res.ok? (await res.json()).data.movie: null;
        //if fails fall back on popcorn if it also fail return empty
        if(!movie) {
            const res = await fetch(`https://fusme.link/movie/${id}`);
            movie = res.ok? await res.json(): null;
        }
        //fetch subs for movie (fetch the html page to substract all language and their respective download links) 
        const subs = new Map;
        const subPage = await fetch(`https://yifysubtitles.ch/movie-imdb/${id}`);
        if(subPage.ok) {
            const html = await subPage.text();
            const dom = new jsdom.JSDOM(html);
            const document = dom.window.document;
        
            const rows = [...document.querySelectorAll('tbody tr')];
            const rowData = rows.map(row => {
              const cells = [...row.querySelectorAll('td')];
              return {[cells[1].textContent]: `https://yifysubtitles.ch${row.querySelector('a').href.replace('subtitles', 'subtitle')}.zip`}
            });
            rowData.forEach((row) => {
                const [language, url] = Object.entries(row)[0]
                if(!subs.has(language))
                    subs.set(language, url);
            })
        }
        return [movie, subs];
    } catch(e) {
        console.log(e);
        return([null, []]);
    }
}

export async function fetchMovieDetails(id) {
    //get tmdb movieid
    const res = await fetch(`https://api.themoviedb.org/3/find/${id}?external_source=imdb_id`, {
        headers: {
            accept: 'application/json',
            Authorization: `Bearer ${process.env.TMDB}`
        }
    });
    if(!res.ok)
        return reply.status(404).send();
    const movieDetails = await res.json();
    //get crew details
    const actorRes = await fetch(`https://api.themoviedb.org/3/movie/${movieDetails.movie_results[0].id}/credits?language=en-US`, {
        headers: {
            accept: 'application/json',
            Authorization: `Bearer ${process.env.TMDB}`
        }
    });
    if(!res.ok)
        return reply.status(404).send();  
    const crewDetails = await actorRes.json();
    const director = crewDetails.crew.find(member => member.job === "Director");
    return({summary: movieDetails.movie_results[0].overview, cast: crewDetails.cast.slice(0, 5), director: director})
}