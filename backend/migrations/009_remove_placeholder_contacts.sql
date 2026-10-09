-- Keep staged profiles visibly unverified and avoid fabricated contact details.
UPDATE group_catalog SET data = (
  SELECT json_group_array(json_set(value,
    '$.phone', 'Not available',
    '$.pickup', replace(json_extract(value, '$.pickup'), ' demo area', ' area')))
  FROM (SELECT value FROM json_each(group_catalog.data) ORDER BY CAST(key AS INTEGER))
) WHERE key = 'riders';

UPDATE group_catalog SET data = (
  SELECT json_group_array(json_set(value,
    '$.phone', 'Not available',
    '$.plate', 'Not verified'))
  FROM (SELECT value FROM json_each(group_catalog.data) ORDER BY CAST(key AS INTEGER))
) WHERE key = 'drivers';
