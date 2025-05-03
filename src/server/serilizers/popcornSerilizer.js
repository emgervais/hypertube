export default async function fetchPopcorn(params) {
    try {
    const url = new URL(`https://fusme.link/movies/${params.page || 1}`)
    const names = {
        name: "keywords",
        genre: "genre",
        sort: "sort"
    }
    const sortValues = {
        title: "name",
        rating: "rating",
        year: "released",
        download_count: "trending"
    }
    for(let [key, value] of Object.entries(params)) {
        if(value === undefined || !names[key])
            continue;
        if (key === "sort")
            value = sortValues[value];
        url.searchParams.set(names[key], value);
    }
    if(params.sort && "title" === params.sort)
        url.searchParams.set("order", "1");
    else
        url.searchParams.set("order", "-1");

    const res = await fetch(url);
    const movies = await res.json();
    const results = movies.filter((movie) => {
        if (params.rating && movie.rating.percentage / 10 < params.rating) {
            return false;
        }
        if (params.quality) {
            for (const [_, torrents] of Object.entries(movie.torrents)) {
                for (const [quality, _] of Object.entries(torrents)) {
                    if (params.quality !== '3D') {
                        if (parseInt(quality.slice(0, -2)) >= parseInt(params.quality.slice(0, -2))) {
                            return true;
                        }
                    } else if (params.quality === '3D' && quality === '3D') {
                        return true;
                    }
                }
            }
            return false;
        }
        return true;
    });
    return (results.map((movie) => ({
        id: movie.imdb_id,
        title: movie.title,
        year: movie.year,
        runtime: movie.runtime,
        genres: movie.genres,
        image: movie.images.poster,
        rating: movie.rating.percentage / 10,
        torrents: movie.torrents
    })));
    } catch(e) {
        console.log(e);
        return ([]);
    }
}

// [{
//     "_id":"UniqueString1",
//     "imdb_id":"UniqueString1",
//     "title":"String",
//     "year":0,
//     "slug":"String",
//     "synopsis":"String",
//     "runtime":0,
//     "rating":{"percentage":0,"watching":0,"votes":0}
//     "images":{"banner":"String"
//         "fanart":"String"
//         "poster":"String"}
//     "genres":["String"]
//     "type":"String"
//     "language":"String"
//     "released":0
//     "trailer":"String"
//     "certification":"String"
//     "torrents":{"en":{"1080p":{"provider":"String"
//         "filesize":"String"
//         "size":0
//         "peer":0
//         "seed":0
//         "url":"String"}
//     "720p":{"provider":"String"
//         "filesize":"String"
//         "size":0
//         "peer":0
//         "seed":0
//         "url":"String"}}}}]
