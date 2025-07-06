import { fetchMovies, findMovie, fetchMovieDetails } from '../utils/apiUtils.js';

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
        reply.status(500).send({error: "Failed to fetch users"})
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
        reply.status(500).send({error: "Failed to fetch user"})
    }
}


async function getMovies(req, reply) {
    try {
        const results = await fetchMovies();
        reply.status(200).send(results.map(movie => ({
            id: movie.id,
            name:  movie.title
        })));
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: "Failed to fetch movies"})
    }
}

async function getMovie(req, reply) {
    try {
        const [movie, subs] = await findMovie(req.params.id);
        if(!movie)
            return reply.status(404).send({error: "Could not find the movie"});

        const commentsCollection = this.mongo.db.collection("comments");
        const comments = await commentsCollection.find({movie_id: req.params.id}).toArray()
        reply.status(200).send({id: movie.imdb_code, name: movie.title, rating: movie.rating, year: movie.year, length: movie.runtime, subtitles: Object.fromEntries(subs), comments: comments});
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: "Could not get movies and/or comments"})
    }  
}

async function getMovieFilter(req, reply) {
    try {
        const movies = await fetchMovies(req.query);
        reply.status(200).send(movies);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: e.message});
    }
}

async function getMovieDetails(req, reply) {
    try{
        const details = await fetchMovieDetails(req.params.id);
        return reply.status(200).send(details)
    }catch(e) {
        console.log(e);
        return reply.status(500).send({error: "Could not find the movie details"});
    }
}

async function getComments(req, reply) {
    try {
        const collection = this.mongo.db.collection("comments");
        const comments = await collection.find().sort({date: -1}).limit(10).toArray();
        reply.status(200).send(comments);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: "Could not find comments"})
    }
}

async function getMovieComments(req, reply) {
    try {
        const collection = this.mongo.db.collection("comments");
        const comments = await collection.find({movie_id: req.params.id}).toArray();
        return reply.status(200).send(comments);
    }catch(e) {
        console.log(e);
        return reply.status(500).send({error: "Could not find the comments"});
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
        reply.status(500).send({error: "Could not find the comment"})
    }
}

async function postComment(req, reply) {
    try {
        const date = new Date()
        const userCollection = this.mongo.db.collection("users");
        const id = new this.mongo.ObjectId(req.user.id)
        const user = await userCollection.findOne(id);
        const collection = this.mongo.db.collection("comments");
        const comment = {username: user.username, movie_id: req.body.movie_id, comment: req.body.comment, date: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.toTimeString().slice(0, 8)}`}
        await collection.insertOne(comment);
        reply.status(200).send(comment);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: 'Could not add the comment'})
    }
}

async function patchComment(req, reply) {
    try {
        const commentId = new this.mongo.ObjectId(req.params.id);
        const collection = this.mongo.db.collection("comments");
        const comment = await collection.findOneAndUpdate(commentId, {$set: {comment: req.body.comment, username: req.body.username}});
        if (!comment)
            return reply.status(201).send({message: "Could not find the comment"});
        reply.status(200).send();
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: "Could not modify the comment"})
    }
}

async function deleteComment(req, reply) {
    try {
        const commentId = new this.mongo.ObjectId(req.params.id);
        const collection = this.mongo.db.collection("comments");
        const comment = await collection.findOneAndDelete(commentId);
        if (!comment)
            return reply.status(201).send({message: "Could not find the comment"});
        reply.status(200).send();
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: "Could not delete comment"})
    }
}

export default {getUsers, getUser, getMovies, getMovie, getComments, postComment, getComment, patchComment, deleteComment, getMovieComments, getMovieFilter, getMovieDetails}