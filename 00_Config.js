const APP = Object.freeze({
  NAME: "Novel Flashcard",
  TITLE: "Novel Flashcard",
  VERSION: "0.1.0",
  TIMEZONE: "Asia/Bangkok"
});

const SHEETS = Object.freeze({
  NOVELS: "Novels",
  EPISODES: "Episodes",
  VOCAB: "VocabFavorites",
  LOOKUP_LOG: "LookupLog"
});

const SCHEMAS = Object.freeze({
  Novels: ["id", "title", "description", "source_lang", "created_at", "updated_at"],
  Episodes: ["id", "novel_id", "episode_no", "title", "content", "created_at", "updated_at"],
  VocabFavorites: [
    "id",
    "word",
    "novel_id",
    "episode_id",
    "cedict_raw",
    "en_meaning",
    "th_explain",
    "note",
    "created_at"
  ],
  LookupLog: ["id", "word", "cedict_raw", "en_meaning", "th_explain", "created_at"]
});

function cfg_now_() {
  return Utilities.formatDate(new Date(), APP.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function cfg_uuid_() {
  return Utilities.getUuid();
}
