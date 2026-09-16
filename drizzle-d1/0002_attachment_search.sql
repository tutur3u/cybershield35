CREATE VIRTUAL TABLE chat_attachment_chunks_fts USING fts5(content, content='chat_attachment_chunks', content_rowid='rowid', tokenize='unicode61 remove_diacritics 0');
INSERT INTO chat_attachment_chunks_fts(chat_attachment_chunks_fts) VALUES('rebuild');
CREATE TRIGGER chat_attachment_chunks_fts_insert AFTER INSERT ON chat_attachment_chunks BEGIN
  INSERT INTO chat_attachment_chunks_fts(rowid,content) VALUES(NEW.rowid,NEW.content);
END;
CREATE TRIGGER chat_attachment_chunks_fts_delete AFTER DELETE ON chat_attachment_chunks BEGIN
  INSERT INTO chat_attachment_chunks_fts(chat_attachment_chunks_fts,rowid,content) VALUES('delete',OLD.rowid,OLD.content);
END;
CREATE TRIGGER chat_attachment_chunks_fts_update AFTER UPDATE OF content ON chat_attachment_chunks BEGIN
  INSERT INTO chat_attachment_chunks_fts(chat_attachment_chunks_fts,rowid,content) VALUES('delete',OLD.rowid,OLD.content);
  INSERT INTO chat_attachment_chunks_fts(rowid,content) VALUES(NEW.rowid,NEW.content);
END;
