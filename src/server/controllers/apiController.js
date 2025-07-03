import jsdom from 'jsdom'
import fetchYTS from '../serilizers/ytsSerilizer.js'
import fetchPopcorn from "../serilizers/popcornSerilizer.js"
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
        reply.status(500).send({error: e.message})
    }
}

async function getUser(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.params.id);
        const user = await collection.findOne(id);
        if(!user)
            return reply.status(404).send({error: "Could not find the user"});
        reply.status(200).send({username: user.username, email: user.email, picture: user.picture})
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: e.message})
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
        reply.status(500).send({error: e.message})
    }
}

async function findMovie(id) {
    const res = await fetch(`https://yts.mx/api/v2/movie_details.json?imdb_id=${id}`);
    const results = res.ok? await res.json(): [];
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
    const movie = results.data.movie
    return [movie, subs];
}
async function getMovie(req, reply) {
    try {
        const [movie, subs] = await findMovie(req.params.id);
        console.log(subs)
        const commentsCollection = this.mongo.db.collection("comments");
        const comments = await commentsCollection.find({movie_id: req.params.id}).toArray()
        reply.status(200).send({id: movie.imdb_code, name: movie.title, rating: movie.rating, year: movie.year, length: movie.runtime, subtitles: Object.fromEntries(subs), comments: comments});
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: e.message})
    }  
}

async function getMovieFilter(req, reply) {
    try {
        const [moviesPop, moviesTYS] = await Promise.all([
            fetchPopcorn(req.query),
            fetchYTS(req.query),
        ]);
        const fullList = moviesTYS.concat(moviesPop);
        const clearList = fullList.filter((movie, index, self) => 
            index === self.findIndex(m => m.id === movie.id)
        );
        if(req.query.page === 1) {
            clearList.unshift({
                id: 'bunny',
                title: 'bunny',
                year: '2017',
                runtime: '10',
                genres: 'animation',
                image: 'http://localhost:8080/images/bunny.jpg',
                rating: '10',
                torrents: 'https://archive.org/download/BigBuckBunny_124/BigBuckBunny_124_archive.torrent'
            });
        }
        reply.status(200).send(clearList);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: e.message});
    }
}
async function getComments(req, reply) {
    try {
        const collection = this.mongo.db.collection("comments");
        // await collection.drop()
        const comments = await collection.find().sort({date: -1}).limit(10).toArray();
        reply.status(200).send(comments);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: e.message})
    }
}
async function getMovieComments(req, reply) {
    const movieId = req.params.id;
    try {
        const collection = this.mongo.db.collection("comments");
        const comments = await collection.find({movie_id: movieId}).toArray();
        return reply.status(200).send(comments);
    }catch(e) {
        console.log(e);
        return reply.status(500).send({error: e});
    }
}
async function getComment(req, reply) {
    try {
        const collection = this.mongo.db.collection("comments");
        const id = new this.mongo.ObjectId(req.params.id);
        const comment = await collection.findOne(id);
        delete comment['movie_id']
        reply.status(200).send(comment);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: e.message})
    }
}

async function postComment(req, reply) {
    const date = new Date()
    try {
        const userCollection = this.mongo.db.collection("users");
        const id = new this.mongo.ObjectId(req.user.id)
        const user = await userCollection.findOne(id);
        const collection = this.mongo.db.collection("comments");
        const comment = {username: user.username, movie_id: req.body.movie_id, comment: req.body.comment, date: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.toTimeString().slice(0, 8)}`}
        const comments = await collection.insertOne(comment);
        reply.status(200).send(comment);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: e.message})
    }
}

async function patchComment(req, reply) {
    try {
        const commentId = new this.mongo.ObjectId(req.params.id);
        const collection = this.mongo.db.collection("comments");
        const comment = await collection.findOneAndUpdate(commentId, {$set: {comment: req.body.comment, username: req.body.username}});
        if (!comment)
            return reply.status(201).send({message: "Could not find the comment"});
        reply.status(200).send({message: "Comment updated successfully"});
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: e.message})
    }
}
async function deleteComment(req, reply) {
    try {
        const commentId = new this.mongo.ObjectId(req.params.id);
        const collection = this.mongo.db.collection("comments");
        const comment = await collection.findOneAndDelete(commentId);
        if (!comment)
            return reply.status(201).send({message: "Could not find the comment"});
        reply.status(200).send({message: "Comment deleted successfully"});
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: e.message})
    }
}

export default {getUsers, getUser, getMovies, getMovie, getComments, postComment, getComment, patchComment, deleteComment, getMovieComments, getMovieFilter, findMovie}