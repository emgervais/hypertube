db = db.getSiblingDB('hypertube');

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