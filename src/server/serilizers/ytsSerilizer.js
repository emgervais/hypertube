

export default async function fetchYTS(params) {
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
    if(params.sort && ["title", "length"].includes(params.sort))
        url.searchParams.set("order_by", "asc");
    url.searchParams.set("limit", 50);
    const res = await fetch(url);
    const movies = await res.json();
    return (movies.data.movies);
}
