/**
 * HFK 와인 소사이어티 시음 기록 백엔드
 *
 * 배포 방법:
 * 1. script.google.com에서 새 프로젝트 생성 ("HFK Wine Society")
 * 2. 이 파일 전체 붙여넣기
 * 3. 좌측 톱니바퀴(프로젝트 설정) → 스크립트 속성 추가:
 *    - SHEET_ID: 와인 시트의 Spreadsheet ID
 *    - ADMIN_PASSWORD: 관리자 비밀번호 (와인/세션 등록·수정·삭제 권한)
 * 4. '배포' → '새 배포' → 유형 'WebApp':
 *    - 실행 계정: 본인
 *    - 액세스 권한: 'Anyone' (URL 알면 누구나)
 * 5. 발급된 웹앱 URL을 index.html의 API_URL에 붙여넣기
 *
 * Sheet 구조 (헤더는 자동 생성됨):
 *   탭1 "Sessions": session_id | name | session_date | location | theme | host | description | created_at
 *   탭2 "Wines":    wine_id | session_id | name_ko | name_original | vintage | country | region |
 *                   variety | producer | price_range | tasted_at | tasted_place | image_url | added_by | created_at
 *   탭3 "Notes":    note_id | wine_id | author | author_token | score | aroma | palate |
 *                   comment | pairing | created_at | updated_at
 */

const SHARED_SECRET = "hfk1004";
const SESSION_SHEET = "Sessions";
const WINE_SHEET = "Wines";
const NOTE_SHEET = "Notes";

const SESSION_HEADERS = [
  "session_id", "name", "session_date", "location", "theme", "host", "description", "created_at"
];
const WINE_HEADERS = [
  "wine_id", "session_id", "name_ko", "name_original", "vintage", "country", "region",
  "variety", "producer", "price_range", "tasted_at", "tasted_place",
  "image_url", "added_by", "created_at"
];
const NOTE_HEADERS = [
  "note_id", "wine_id", "author", "author_token", "score", "aroma", "palate",
  "comment", "pairing", "created_at", "updated_at"
];

// ===== Endpoints =====

function doGet(e) {
  try {
    const sessions = readSheet(SESSION_SHEET, SESSION_HEADERS);
    const wines = readSheet(WINE_SHEET, WINE_HEADERS);
    const notes = readSheet(NOTE_SHEET, NOTE_HEADERS);
    sessions.sort((a, b) => (b.session_date || "").localeCompare(a.session_date || ""));
    wines.sort((a, b) => (b.tasted_at || "").localeCompare(a.tasted_at || ""));
    notes.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    // author_token 은 응답에서 제거 (작성자 본인만 자기 브라우저에서 매칭)
    const safeNotes = notes.map(n => {
      const c = Object.assign({}, n);
      delete c.author_token;
      return c;
    });
    return jsonResponse({ ok: true, sessions: sessions, wines: wines, notes: safeNotes });
  } catch (err) {
    return jsonResponse({ ok: false, error: "exception: " + err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.auth !== SHARED_SECRET) {
      return jsonResponse({ ok: false, error: "unauthorized" });
    }
    const action = body.action;
    const routes = {
      ping: () => ({ ok: true, message: "pong" }),
      verifyAdmin: () => verifyAdmin(body),
      addSession: () => addSession(body),
      updateSession: () => updateSession(body),
      deleteSession: () => deleteSession(body),
      addWine: () => addWine(body),
      updateWine: () => updateWine(body),
      deleteWine: () => deleteWine(body),
      addNote: () => addNote(body),
      updateNote: () => updateNote(body),
      deleteNote: () => deleteNote(body)
    };
    const fn = routes[action];
    if (!fn) return jsonResponse({ ok: false, error: "unknown action: " + action });
    return jsonResponse(fn());
  } catch (err) {
    return jsonResponse({ ok: false, error: "exception: " + err.message });
  }
}

// ===== Admin auth =====

function getAdminPassword() {
  return PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD") || "";
}

function verifyAdmin(body) {
  const pw = getAdminPassword();
  if (!pw) return { ok: false, error: "ADMIN_PASSWORD 스크립트 속성이 설정되지 않았습니다" };
  if ((body.admin_password || "") !== pw) return { ok: false, error: "관리자 비밀번호가 올바르지 않습니다" };
  return { ok: true };
}

function requireAdmin(body) {
  const r = verifyAdmin(body);
  return r.ok ? null : r;
}

// ===== Sessions =====

function addSession(body) {
  const bad = requireAdmin(body); if (bad) return bad;
  const now = new Date().toISOString();
  const row = {
    session_id: "s-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    name: (body.name || "").trim(),
    session_date: (body.session_date || "").trim(),
    location: (body.location || "").trim(),
    theme: (body.theme || "").trim(),
    host: (body.host || "").trim(),
    description: (body.description || "").trim(),
    created_at: now
  };
  if (!row.name) return { ok: false, error: "세션 이름을 입력해 주세요" };
  if (!row.session_date) return { ok: false, error: "세션 일자를 입력해 주세요" };
  const sheet = getSheet(SESSION_SHEET, SESSION_HEADERS);
  sheet.appendRow(SESSION_HEADERS.map(h => row[h]));
  return { ok: true, session: row };
}

function updateSession(body) {
  const bad = requireAdmin(body); if (bad) return bad;
  if (!body.session_id) return { ok: false, error: "session_id가 필요합니다" };
  const sheet = getSheet(SESSION_SHEET, SESSION_HEADERS);
  const rowIdx = findRow(sheet, "session_id", body.session_id);
  if (rowIdx < 0) return { ok: false, error: "세션을 찾을 수 없습니다" };
  const updatable = ["name", "session_date", "location", "theme", "host", "description"];
  updatable.forEach(k => {
    if (body[k] !== undefined) {
      const col = SESSION_HEADERS.indexOf(k) + 1;
      sheet.getRange(rowIdx, col).setValue(String(body[k] || "").trim());
    }
  });
  return { ok: true };
}

function deleteSession(body) {
  const bad = requireAdmin(body); if (bad) return bad;
  if (!body.session_id) return { ok: false, error: "session_id가 필요합니다" };
  const sheet = getSheet(SESSION_SHEET, SESSION_HEADERS);
  const rowIdx = findRow(sheet, "session_id", body.session_id);
  if (rowIdx < 0) return { ok: false, error: "세션을 찾을 수 없습니다" };
  // 와인의 session_id 비우기
  const wineSheet = getSheet(WINE_SHEET, WINE_HEADERS);
  const sidCol = WINE_HEADERS.indexOf("session_id") + 1;
  const last = wineSheet.getLastRow();
  if (last >= 2) {
    const range = wineSheet.getRange(2, sidCol, last - 1, 1);
    const values = range.getValues();
    let changed = false;
    for (let i = 0; i < values.length; i++) {
      if (values[i][0] === body.session_id) { values[i][0] = ""; changed = true; }
    }
    if (changed) range.setValues(values);
  }
  sheet.deleteRow(rowIdx);
  return { ok: true };
}

// ===== Wines =====

function addWine(body) {
  const bad = requireAdmin(body); if (bad) return bad;
  const now = new Date().toISOString();
  const row = {
    wine_id: "w-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    session_id: (body.session_id || "").trim(),
    name_ko: (body.name_ko || "").trim(),
    name_original: (body.name_original || "").trim(),
    vintage: (body.vintage || "").toString().trim(),
    country: (body.country || "").trim(),
    region: (body.region || "").trim(),
    variety: (body.variety || "").trim(),
    producer: (body.producer || "").trim(),
    price_range: (body.price_range || "").trim(),
    tasted_at: (body.tasted_at || "").trim(),
    tasted_place: (body.tasted_place || "").trim(),
    image_url: (body.image_url || "").trim(),
    added_by: (body.added_by || "").trim(),
    created_at: now
  };
  if (!row.name_ko && !row.name_original) return { ok: false, error: "와인명을 입력해 주세요" };
  if (!row.tasted_at) return { ok: false, error: "시음일을 입력해 주세요" };
  const sheet = getSheet(WINE_SHEET, WINE_HEADERS);
  sheet.appendRow(WINE_HEADERS.map(h => row[h]));
  return { ok: true, wine: row };
}

function updateWine(body) {
  const bad = requireAdmin(body); if (bad) return bad;
  if (!body.wine_id) return { ok: false, error: "wine_id가 필요합니다" };
  const sheet = getSheet(WINE_SHEET, WINE_HEADERS);
  const rowIdx = findRow(sheet, "wine_id", body.wine_id);
  if (rowIdx < 0) return { ok: false, error: "와인을 찾을 수 없습니다" };
  const updatable = ["session_id", "name_ko", "name_original", "vintage", "country", "region",
    "variety", "producer", "price_range", "tasted_at", "tasted_place", "image_url", "added_by"];
  updatable.forEach(k => {
    if (body[k] !== undefined) {
      const col = WINE_HEADERS.indexOf(k) + 1;
      sheet.getRange(rowIdx, col).setValue(String(body[k] || "").trim());
    }
  });
  return { ok: true };
}

function deleteWine(body) {
  const bad = requireAdmin(body); if (bad) return bad;
  if (!body.wine_id) return { ok: false, error: "wine_id가 필요합니다" };
  const sheet = getSheet(WINE_SHEET, WINE_HEADERS);
  const rowIdx = findRow(sheet, "wine_id", body.wine_id);
  if (rowIdx < 0) return { ok: false, error: "와인을 찾을 수 없습니다" };
  // 해당 와인의 노트 모두 삭제
  deleteRowsWhere(NOTE_SHEET, NOTE_HEADERS, "wine_id", body.wine_id);
  sheet.deleteRow(rowIdx);
  return { ok: true };
}

// ===== Notes =====

function addNote(body) {
  const now = new Date().toISOString();
  const token = Utilities.getUuid();
  const row = {
    note_id: "n-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    wine_id: (body.wine_id || "").trim(),
    author: (body.author || "").trim(),
    author_token: token,
    score: (body.score || "").toString().trim(),
    aroma: (body.aroma || "").trim(),
    palate: (body.palate || "").trim(),
    comment: (body.comment || "").trim(),
    pairing: (body.pairing || "").trim(),
    created_at: now,
    updated_at: now
  };
  if (!row.wine_id) return { ok: false, error: "wine_id가 필요합니다" };
  if (!row.author) return { ok: false, error: "작성자를 입력해 주세요" };
  if (!row.comment && !row.aroma && !row.palate) {
    return { ok: false, error: "시음 노트 내용을 입력해 주세요" };
  }
  const sheet = getSheet(NOTE_SHEET, NOTE_HEADERS);
  sheet.appendRow(NOTE_HEADERS.map(h => row[h]));
  // 응답에 token 포함 (클라이언트가 localStorage 에 저장하여 향후 수정/삭제 권한 검증에 사용)
  const respNote = Object.assign({}, row);
  delete respNote.author_token;
  return { ok: true, note: respNote, author_token: token };
}

function updateNote(body) {
  if (!body.note_id) return { ok: false, error: "note_id가 필요합니다" };
  const sheet = getSheet(NOTE_SHEET, NOTE_HEADERS);
  const rowIdx = findRow(sheet, "note_id", body.note_id);
  if (rowIdx < 0) return { ok: false, error: "노트를 찾을 수 없습니다" };
  // 권한: author_token 일치 OR 관리자
  const tokenCol = NOTE_HEADERS.indexOf("author_token") + 1;
  const storedToken = String(sheet.getRange(rowIdx, tokenCol).getValue() || "");
  const isAdmin = verifyAdmin(body).ok;
  const isAuthor = body.author_token && body.author_token === storedToken;
  if (!isAdmin && !isAuthor) return { ok: false, error: "본인이 작성한 노트만 수정할 수 있습니다" };

  const updatable = ["author", "score", "aroma", "palate", "comment", "pairing"];
  updatable.forEach(k => {
    if (body[k] !== undefined) {
      const col = NOTE_HEADERS.indexOf(k) + 1;
      sheet.getRange(rowIdx, col).setValue(String(body[k] || "").trim());
    }
  });
  // updated_at
  sheet.getRange(rowIdx, NOTE_HEADERS.indexOf("updated_at") + 1).setValue(new Date().toISOString());
  return { ok: true };
}

function deleteNote(body) {
  if (!body.note_id) return { ok: false, error: "note_id가 필요합니다" };
  const sheet = getSheet(NOTE_SHEET, NOTE_HEADERS);
  const rowIdx = findRow(sheet, "note_id", body.note_id);
  if (rowIdx < 0) return { ok: false, error: "노트를 찾을 수 없습니다" };
  const tokenCol = NOTE_HEADERS.indexOf("author_token") + 1;
  const storedToken = String(sheet.getRange(rowIdx, tokenCol).getValue() || "");
  const isAdmin = verifyAdmin(body).ok;
  const isAuthor = body.author_token && body.author_token === storedToken;
  if (!isAdmin && !isAuthor) return { ok: false, error: "본인이 작성한 노트만 삭제할 수 있습니다" };
  sheet.deleteRow(rowIdx);
  return { ok: true };
}

// ===== Sheet helpers =====

function readSheet(name, headers) {
  const sheet = getSheet(name, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const range = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return range.map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      let v = r[i];
      if (v instanceof Date) v = Utilities.formatDate(v, "Asia/Seoul", "yyyy-MM-dd");
      obj[h] = v === null || v === undefined ? "" : String(v);
    });
    return obj;
  });
}

function getSheet(name, headers) {
  const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (!id) throw new Error("SHEET_ID 스크립트 속성이 설정되지 않았습니다");
  const ss = SpreadsheetApp.openById(id);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    // 헤더 누락 컬럼 자동 보강 (예: 기존 시트에 session_id, author_token 등 컬럼이 없을 때)
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const missing = headers.filter(h => existingHeaders.indexOf(h) < 0);
    if (missing.length > 0) {
      const startCol = existingHeaders.length + 1;
      sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
    }
  }
  return sheet;
}

function findRow(sheet, headerKey, value) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = headers.indexOf(headerKey) + 1;
  if (col < 1) return -1;
  const vals = sheet.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(value)) return i + 2;
  }
  return -1;
}

function deleteRowsWhere(sheetName, headers, headerKey, value) {
  const sheet = getSheet(sheetName, headers);
  const last = sheet.getLastRow();
  if (last < 2) return;
  const col = headers.indexOf(headerKey) + 1;
  const vals = sheet.getRange(2, col, last - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === String(value)) sheet.deleteRow(i + 2);
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
