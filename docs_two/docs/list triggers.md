SELECT
event_object_table AS table_name,
trigger_name,
event_manipulation AS trigger_event, -- INSERT, UPDATE, or DELETE
action_timing AS execution_timing, -- BEFORE or AFTER
action_statement AS trigger_action -- The trigger function called
FROM
information_schema.triggers
WHERE
trigger_schema = 'public'
ORDER BY
trigger_name;
