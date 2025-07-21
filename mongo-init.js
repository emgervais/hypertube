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

db.movies.insertOne({
    filmId: "tt0829482",
    lastSeen: 1751919844306,
    isDownloaded: false,
    subtitles: {
      "Arabic": "https://yifysubtitles.ch/subtitle/superbad-2007-arabic-yify-102055.zip",
      "Brazilian Portuguese": "https://yifysubtitles.ch/subtitle/superbad-2007-brazilian-portuguese-yify-102056.zip",
      "Bulgarian": "https://yifysubtitles.ch/subtitle/superbad-2007-bulgarian-yify-102057.zip",
      "Chinese": "https://yifysubtitles.ch/subtitle/superbad-2007-chinese-yify-102058.zip",
      "Croatian": "https://yifysubtitles.ch/subtitle/superbad-2007-croatian-yify-102061.zip",
      "Czech": "https://yifysubtitles.ch/subtitle/superbad-2007-czech-yify-102062.zip",
      "Danish": "https://yifysubtitles.ch/subtitle/superbad-2007-danish-yify-102063.zip",
      "Dutch": "https://yifysubtitles.ch/subtitle/superbad-2007-dutch-yify-102064.zip",
      "English": "https://yifysubtitles.ch/subtitle/superbad-2007-english-yify-102068.zip",
      "Farsi/Persian": "https://yifysubtitles.ch/subtitle/superbad-2007-farsipersian-yify-102069.zip",
      "Finnish": "https://yifysubtitles.ch/subtitle/superbad-2007-finnish-yify-102070.zip",
      "French": "https://yifysubtitles.ch/subtitle/superbad-2007-french-yify-102071.zip",
      "Greek": "https://yifysubtitles.ch/subtitle/superbad-2007-greek-yify-102072.zip",
      "Hebrew": "https://yifysubtitles.ch/subtitle/superbad-2007-hebrew-yify-102073.zip",
      "Hungarian": "https://yifysubtitles.ch/subtitle/superbad-2007-hungarian-yify-102074.zip",
      "Italian": "https://yifysubtitles.ch/subtitle/superbad-2007-italian-yify-102075.zip",
      "Norwegian": "https://yifysubtitles.ch/subtitle/superbad-2007-norwegian-yify-102076.zip",
      "Portuguese": "https://yifysubtitles.ch/subtitle/superbad-2007-portuguese-yify-102077.zip",
      "Romanian": "https://yifysubtitles.ch/subtitle/superbad-2007-romanian-yify-102078.zip",
      "Serbian": "https://yifysubtitles.ch/subtitle/superbad-2007-serbian-yify-102079.zip",
      "Spanish": "https://yifysubtitles.ch/subtitle/superbad-2007-spanish-yify-102080.zip",
      "Vietnamese": "https://yifysubtitles.ch/subtitle/superbad-2007-vietnamese-yify-102081.zip"
    },
    bitBody: {
      length: 6780,
      torrentUrl: "https://yts.mx/torrent/download/C62315B7E811B35E247AA47404E4129A7C93D584",
      file: "src/server/movies/tt0829482/tt0829482.mp4"
    }
  });