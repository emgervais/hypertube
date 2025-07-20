db = db.getSiblingDB('hypertube');

db.users.insertOne({
  username: "admin123",
  password: "$2b$10$6dLLX2oC2MeFdt7tGFGHWubZ9J2euoueAU2fDj4NJyq8oEHyayMGq",
  name: 'a',
  surname: 'b',
  language: 'en',
  resetToken: null,
  resetExpire: null,
  isOauth: false,
  isAdmin: true,
  email: "admin@example.com",
  watchedMovie: []
});

db.movies.insertOne({
    filmId: "tt1254207",
    lastSeen: 1752420206639,
    isDownloaded: false,
    subtitles: [],
    bitBody: {
      length: 596,
      torrentUrl: "https://archive.org/download/BigBuckBunny_124/BigBuckBunny_124_archive.torrent",
      file: null
    }
  });