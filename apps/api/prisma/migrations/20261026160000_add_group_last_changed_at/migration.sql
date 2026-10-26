ALTER TABLE "groups"
ADD COLUMN "lastChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE FUNCTION update_group_last_changed_at() RETURNS TRIGGER AS $$
BEGIN
  NEW."lastChangedAt" := GREATEST(
    clock_timestamp(),
    OLD."lastChangedAt" + INTERVAL '1 millisecond'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER groups_last_changed_at
BEFORE UPDATE ON "groups"
FOR EACH ROW
EXECUTE FUNCTION update_group_last_changed_at();

CREATE FUNCTION touch_group_last_changed_at() RETURNS TRIGGER AS $$
DECLARE
  target_group_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_group_id := OLD."groupId";
  ELSE
    target_group_id := NEW."groupId";
  END IF;
  UPDATE "groups"
  SET "lastChangedAt" = GREATEST(
    clock_timestamp(),
    "lastChangedAt" + INTERVAL '1 millisecond'
  )
  WHERE "id" = target_group_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER people_last_changed_at
AFTER INSERT OR UPDATE OR DELETE ON "people"
FOR EACH ROW
EXECUTE FUNCTION touch_group_last_changed_at();

CREATE TRIGGER expenses_last_changed_at
AFTER INSERT OR UPDATE OR DELETE ON "expenses"
FOR EACH ROW
EXECUTE FUNCTION touch_group_last_changed_at();

CREATE TRIGGER expense_drafts_last_changed_at
AFTER INSERT OR UPDATE OR DELETE ON "expense_drafts"
FOR EACH ROW
EXECUTE FUNCTION touch_group_last_changed_at();

CREATE TRIGGER settlement_transfers_last_changed_at
AFTER INSERT OR UPDATE OR DELETE ON "settlement_transfers"
FOR EACH ROW
EXECUTE FUNCTION touch_group_last_changed_at();

CREATE TRIGGER group_members_last_changed_at
AFTER INSERT OR UPDATE OR DELETE ON "group_members"
FOR EACH ROW
EXECUTE FUNCTION touch_group_last_changed_at();

CREATE TRIGGER group_sessions_last_changed_at
AFTER INSERT OR UPDATE OR DELETE ON "group_sessions"
FOR EACH ROW
EXECUTE FUNCTION touch_group_last_changed_at();

CREATE TRIGGER history_last_changed_at
AFTER INSERT OR UPDATE OR DELETE ON "history"
FOR EACH ROW
EXECUTE FUNCTION touch_group_last_changed_at();

CREATE FUNCTION touch_group_last_changed_at_from_draft_selection() RETURNS TRIGGER AS $$
DECLARE
  target_draft_id TEXT;
  target_group_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_draft_id := OLD."draftId";
  ELSE
    target_draft_id := NEW."draftId";
  END IF;
  SELECT "groupId" INTO target_group_id
  FROM "expense_drafts"
  WHERE "id" = target_draft_id;

  IF target_group_id IS NOT NULL THEN
    UPDATE "groups"
    SET "lastChangedAt" = GREATEST(
      clock_timestamp(),
      "lastChangedAt" + INTERVAL '1 millisecond'
    )
    WHERE "id" = target_group_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER draft_selections_last_changed_at
AFTER INSERT OR UPDATE OR DELETE ON "draft_selections"
FOR EACH ROW
EXECUTE FUNCTION touch_group_last_changed_at_from_draft_selection();
