import jsdom from 'jsdom'

async function getUsers(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const usersData = await collection.find().toArray();
        const users = usersData.map(user => ({
            _id: user._id.toString(),
            username: user.username
        }));
        reply.status(200).send(users);
    } catch (e) {
        console.log(e);
        reply.status(500).send({error: "internal server error"});
    }
}

async function getUser(req, reply) {
    if(!req.params.id)
        return reply.status(422).send({error: "Missing id"})
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.params.id);
        const user = await collection.findOne(id);
        if(!user)
            return reply.status(404).send({error: "Could not find the user"});
        reply.status(200).send({username: user.username, email: user.email, picture: user.picture})
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: "server internal error"})
    }
}


async function getMovies(req, reply) {
    try {
        const res = await fetch('https://yts.mx/api/v2/list_movies.json?limit=50');
        const results = await res.json();
        const movies = results.data.movies.map(movie => ({
            id: movie.id,
            name:  movie.title
        }));
        reply.status(200).send(results.data.movies);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: "Internal server error"});
    }
    
}
async function getMovie(req, reply) {
    
    try {
        const id = req.params.id
        const res = await fetch(`https://yts.mx/api/v2/movie_details.json?imdb_id=${id}`);
        const results = await res.json();
        const subPage = await fetch(`https://yifysubtitles.ch/movie-imdb/${id}`)
        const html = await subPage.text();
        const dom = new jsdom.JSDOM(html)
        const document = dom.window.document;

        const rows = [...document.querySelectorAll('tbody tr')];
        const rowData = rows.map(row => {
          const cells = [...row.querySelectorAll('td')];
          return {[cells[1].textContent]: `https://yifysubtitles.ch${row.querySelector('a').href.replace('subtitles', 'subtitle')}.zip`}
        });
        const subs = [...new Set(rowData.map(row => Object.keys(row)[0]))]
        const movie = results.data.movie
        reply.status(200).send({id: movie.imdb_code, name: movie.title, rating: movie.rating, year: movie.year, length: movie.runtime, subtitles: subs});
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: "Internal server error"});
    }
    
}

async function addMovies(req, reply) {
    const collection = this.mongo.db.collection('movies');
    await collection.insertOne(reply.body);
}

export default {getUsers, getUser, getMovies, addMovies, getMovie}