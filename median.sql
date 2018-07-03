CREATE OR REPLACE FUNCTION array_median(real[])
  RETURNS real AS
$$
    SELECT CASE WHEN array_upper($1,1) = 0 THEN null ELSE asorted[ceiling(array_upper(asorted,1)/2.0)] END
    FROM (SELECT ARRAY(SELECT ($1)[n] FROM
generate_series(1, array_upper($1, 1)) AS n
    WHERE ($1)[n] IS NOT NULL
            ORDER BY ($1)[n]
) As asorted) As foo ;
$$
  LANGUAGE 'sql' IMMUTABLE;


CREATE OR REPLACE FUNCTION array_median(timestamp[])
  RETURNS timestamp AS
$$
    SELECT CASE WHEN array_upper($1,1) = 0 THEN null ELSE asorted[ceiling(array_upper(asorted,1)/2.0)] END
    FROM (SELECT ARRAY(SELECT ($1)[n] FROM
generate_series(1, array_upper($1, 1)) AS n
    WHERE ($1)[n] IS NOT NULL
            ORDER BY ($1)[n]
) As asorted) As foo ;
$$
  LANGUAGE 'sql' IMMUTABLE;


CREATE AGGREGATE median(real) (
  SFUNC=array_append,
  STYPE=real[],
  FINALFUNC=array_median
);

CREATE AGGREGATE median(timestamp) (
  SFUNC=array_append,
  STYPE=timestamp[],
  FINALFUNC=array_median
);