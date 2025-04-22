export default async function fetchYTS(params) {
    try {
    const url = new URL("https://yts.mx/api/v2/list_movies.json")
    const names = {
        name: "query_term",
        rating: "minimum_rating",
        genre: "genre",
        quality: "quality",
        sort: "sort_by",
        page: "page"
    }
    for(const [key, value] of Object.entries(params)) {
        if(value === undefined)
            continue;
        url.searchParams.set(names[key], value);
    }
    if(params.sort && "title" === params.sort)
        url.searchParams.set("order_by", "asc");

    url.searchParams.set("limit", 50);
    // console.log("TYSUrl: ", url.toString())
        const res = await fetch(url);
        const movies = await res.json();
        return (movies.data.movies.map((movie) => ({
                id: movie.imdb_code,
                title: movie.title,
                year: movie.year,
                runtime: movie.runtime,
                genres: movie.genres,
                image: movie.medium_cover_image,
                rating: movie.rating,
                torrents: movie.torrents
            })));
    } catch(e) {
        console.log(e)
        return ([])
    }
}

// "torrents": [
//     {
//       "url": "https://yts.mx/torrent/download/9560D60B509E7E75AD72378A09CE20207DB6906E",
//       "hash": "9560D60B509E7E75AD72378A09CE20207DB6906E",
//       "quality": "720p",
//       "type": "web",
//       "is_repack": "0",
//       "video_codec": "x264",
//       "bit_depth": "8",
//       "audio_channels": "2.0",
//       "seeds": 0,
//       "peers": 0,
//       "size": "944.73 MB",
//       "size_bytes": 990621204,
//       "date_uploaded": "2025-04-22 06:46:03",
//       "date_uploaded_unix": 1745297163
//     },