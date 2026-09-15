-- 0027_sync_settings_to_active_session.sql
-- The LP prefers the ACTIVE session's speaker/schedule fields over the global
-- settings row (getWebinarConfig), but the admin panel saves edits to the
-- settings row. Before this, admin edits saved fine but never appeared on the
-- live page while a session was active.
--
-- This trigger mirrors any CHANGED settings field onto the active session, so
-- admin edits always reach the live page — for this and every future webinar,
-- independent of app code version. Only columns that actually changed are
-- copied (IS DISTINCT FROM), so e.g. saving a Webinar-tab text field does not
-- clobber a per-session speaker that came from a speaker submission.

CREATE OR REPLACE FUNCTION excel_to_ai.sync_settings_to_active_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = excel_to_ai
AS $$
BEGIN
  UPDATE excel_to_ai.webinar_sessions ws SET
    speaker_name    = CASE WHEN NEW.speaker_name         IS DISTINCT FROM OLD.speaker_name         THEN NEW.speaker_name         ELSE ws.speaker_name    END,
    speaker_title   = CASE WHEN NEW.speaker_title        IS DISTINCT FROM OLD.speaker_title        THEN NEW.speaker_title        ELSE ws.speaker_title   END,
    speaker_image   = CASE WHEN NEW.speaker_image        IS DISTINCT FROM OLD.speaker_image        THEN NEW.speaker_image        ELSE ws.speaker_image   END,
    speaker_bio     = CASE WHEN NEW.speaker_bio          IS DISTINCT FROM OLD.speaker_bio          THEN NEW.speaker_bio          ELSE ws.speaker_bio     END,
    date_label      = CASE WHEN NEW.webinar_date_label   IS DISTINCT FROM OLD.webinar_date_label   THEN NEW.webinar_date_label   ELSE ws.date_label      END,
    time_label      = CASE WHEN NEW.webinar_time_label   IS DISTINCT FROM OLD.webinar_time_label   THEN NEW.webinar_time_label   ELSE ws.time_label      END,
    datetime_utc    = CASE WHEN NEW.webinar_datetime_utc IS DISTINCT FROM OLD.webinar_datetime_utc THEN NEW.webinar_datetime_utc ELSE ws.datetime_utc    END,
    duration_label  = CASE WHEN NEW.duration_label       IS DISTINCT FROM OLD.duration_label       THEN NEW.duration_label       ELSE ws.duration_label  END,
    zoom_webinar_id = CASE WHEN NEW.zoom_webinar_id      IS DISTINCT FROM OLD.zoom_webinar_id      THEN NEW.zoom_webinar_id      ELSE ws.zoom_webinar_id END
  WHERE ws.status = 'active';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_settings_to_active_session ON excel_to_ai.settings;
CREATE TRIGGER trg_sync_settings_to_active_session
AFTER UPDATE ON excel_to_ai.settings
FOR EACH ROW
WHEN (OLD.id = 'speaker')
EXECUTE FUNCTION excel_to_ai.sync_settings_to_active_session();
