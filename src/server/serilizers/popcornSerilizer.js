export default async function fetchPopcorn(params) {
    const url = new URL(`https://jfper.link/movies/${params.page || 1}`)
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
    console.log(url.toString())
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
    return (results);
}
