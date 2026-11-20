ALTER TABLE reported_messages DROP CONSTRAINT reported_messages_reporter_id_organization_id_fkey;
ALTER TABLE reported_messages ADD CONSTRAINT reported_messages_reporter_tenant_fk FOREIGN KEY(reporter_id,organization_id) REFERENCES users(id,organization_id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION record_content_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data jsonb; next_version integer;
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'updated_at')=(to_jsonb(OLD)-'updated_at') THEN RETURN NEW; END IF;
 row_data=to_jsonb(NEW);
 IF TG_TABLE_NAME='quizzes' THEN row_data=row_data||jsonb_build_object('questions',(SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.order_index,q.id),'[]'::jsonb) FROM quiz_questions q WHERE q.quiz_id=NEW.id)); END IF;
 IF TG_TABLE_NAME='flashcard_decks' THEN row_data=row_data||jsonb_build_object('cards',(SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.order_index,q.id),'[]'::jsonb) FROM flashcards q WHERE q.deck_id=NEW.id)); END IF;
 PERFORM pg_advisory_xact_lock(hashtext(TG_TABLE_NAME||':'||(row_data->>'id')));
 SELECT COALESCE(max(version),0)+1 INTO next_version FROM content_versions WHERE entity_type=TG_TABLE_NAME AND entity_id=(row_data->>'id')::integer;
 INSERT INTO content_versions(organization_id,entity_type,entity_id,version,snapshot) VALUES((row_data->>'organization_id')::integer,TG_TABLE_NAME,(row_data->>'id')::integer,next_version,row_data);
 RETURN NEW;
END $$;
CREATE FUNCTION record_child_content_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id integer;parent_type text;row_data jsonb;next_version integer;
BEGIN
 IF TG_TABLE_NAME='quiz_questions' THEN
  parent_type='quizzes';parent_id=COALESCE(NEW.quiz_id,OLD.quiz_id);
  SELECT to_jsonb(p)||jsonb_build_object('questions',(SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.order_index,q.id),'[]'::jsonb) FROM quiz_questions q WHERE q.quiz_id=p.id)) INTO row_data FROM quizzes p WHERE p.id=parent_id;
 ELSE
  parent_type='flashcard_decks';parent_id=COALESCE(NEW.deck_id,OLD.deck_id);
  SELECT to_jsonb(p)||jsonb_build_object('cards',(SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.order_index,q.id),'[]'::jsonb) FROM flashcards q WHERE q.deck_id=p.id)) INTO row_data FROM flashcard_decks p WHERE p.id=parent_id;
 END IF;
 IF row_data IS NULL THEN RETURN NULL;END IF;
 PERFORM pg_advisory_xact_lock(hashtext(parent_type||':'||parent_id));
 SELECT COALESCE(max(version),0)+1 INTO next_version FROM content_versions WHERE entity_type=parent_type AND entity_id=parent_id;
 INSERT INTO content_versions(organization_id,entity_type,entity_id,version,snapshot) VALUES((row_data->>'organization_id')::integer,parent_type,parent_id,next_version,row_data);
 RETURN NULL;
END $$;
CREATE TRIGGER quiz_child_version AFTER INSERT OR UPDATE OR DELETE ON quiz_questions FOR EACH ROW EXECUTE FUNCTION record_child_content_version();
CREATE TRIGGER deck_child_version AFTER INSERT OR UPDATE OR DELETE ON flashcards FOR EACH ROW EXECUTE FUNCTION record_child_content_version();
