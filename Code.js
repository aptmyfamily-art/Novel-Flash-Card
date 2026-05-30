function doGet() {
  DB_initAllSchemas();
  const t = HtmlService.createTemplateFromFile("Index");
  return t
    .evaluate()
    .setTitle(APP.TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function _ok(data) {
  return { ok: true, data: data };
}

function _err(msg) {
  return { ok: false, error: String(msg) };
}

function api(req) {
  try {
    req = req || {};
    const action = String(req.action || "");
    const payload = req.payload || {};
    switch (action) {
      case "novel.list":
        return _ok(Novel_list_());
      case "novel.upsert":
        return _ok(Novel_upsert_(payload));
      case "episode.list":
        return _ok(Episode_list_(payload.novel_id));
      case "episode.upsert":
        return _ok(Episode_upsert_(payload));
      case "vocab.favorite.add":
        return _ok(Vocab_favoriteAdd_(payload));
      case "vocab.favorite.list":
        return _ok(Vocab_favoriteList_(payload.novel_id));
      case "vocab.lookup":
        return _ok(Vocab_lookup_(payload.word || ""));
      default:
        return _err("Unknown action: " + action);
    }
  } catch (e) {
    return _err(e && e.message ? e.message : String(e));
  }
}

function Novel_list_() {
  return DB_selectAll_("Novels");
}

function Novel_upsert_(payload) {
  const now = cfg_now_();
  const row = {
    id: payload.id || cfg_uuid_(),
    title: String(payload.title || "").trim(),
    description: String(payload.description || "").trim(),
    source_lang: "zh",
    created_at: payload.created_at || now,
    updated_at: now
  };
  if (!row.title) throw new Error("Novel title is required");
  DB_insert_("Novels", "Novels", row);
  return row;
}

function Episode_list_(novelId) {
  if (!novelId) return [];
  return DB_findBy_("Episodes", "novel_id", novelId).sort(function (a, b) {
    return Number(a.episode_no || 0) - Number(b.episode_no || 0);
  });
}

function Episode_upsert_(payload) {
  const now = cfg_now_();
  const row = {
    id: payload.id || cfg_uuid_(),
    novel_id: String(payload.novel_id || ""),
    episode_no: Number(payload.episode_no || 0),
    title: String(payload.title || "").trim(),
    content: String(payload.content || ""),
    created_at: payload.created_at || now,
    updated_at: now
  };
  if (!row.novel_id) throw new Error("novel_id is required");
  if (!row.episode_no) throw new Error("episode_no is required");
  DB_insert_("Episodes", "Episodes", row);
  return row;
}

function Vocab_favoriteAdd_(payload) {
  const row = {
    id: cfg_uuid_(),
    word: String(payload.word || "").trim(),
    novel_id: String(payload.novel_id || ""),
    episode_id: String(payload.episode_id || ""),
    cedict_raw: String(payload.cedict_raw || ""),
    en_meaning: String(payload.en_meaning || ""),
    th_explain: String(payload.th_explain || ""),
    note: String(payload.note || ""),
    created_at: cfg_now_()
  };
  if (!row.word) throw new Error("word is required");
  DB_insert_("VocabFavorites", "VocabFavorites", row);
  return row;
}

function Vocab_favoriteList_(novelId) {
  const rows = DB_selectAll_("VocabFavorites");
  if (!novelId) return rows;
  return rows.filter(function (r) {
    return String(r.novel_id) === String(novelId);
  });
}

function Vocab_lookup_(word) {
  const text = String(word || "").trim();
  if (!text) throw new Error("word is required");

  const cedict = Cedict_lookup_(text);
  const th = Translate_en_to_th_(cedict.en_meaning || text);

  const out = {
    word: text,
    cedict_raw: cedict.cedict_raw,
    en_meaning: cedict.en_meaning,
    th_explain: th
  };

  DB_insert_("LookupLog", "LookupLog", {
    id: cfg_uuid_(),
    word: out.word,
    cedict_raw: out.cedict_raw,
    en_meaning: out.en_meaning,
    th_explain: out.th_explain,
    created_at: cfg_now_()
  });
  return out;
}

function Cedict_lookup_(word) {
  const url = "https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=" + encodeURIComponent(word);
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const html = resp.getContentText();

  // Pull a concise English gloss from search result html as pragmatic MVP parser.
  const match = html.match(/<div class="defs">([\s\S]*?)<\/div>/i);
  let en = "";
  if (match && match[1]) {
    en = match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (!en) en = "No CEDICT gloss found.";

  return {
    cedict_raw: en,
    en_meaning: en
  };
}

function Translate_en_to_th_(text) {
  try {
    return LanguageApp.translate(String(text || ""), "en", "th");
  } catch (e) {
    return "แปลไทยไม่สำเร็จ: " + (e && e.message ? e.message : String(e));
  }
}
