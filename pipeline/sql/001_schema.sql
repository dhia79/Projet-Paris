-- ============================================================================
--  Projet Paris - Ilots de Fraicheur
--  MySQL 8.0 serving schema (Cloud SQL)
--
--  Written by `python -m paris_pipeline.run`, read and written by the Go API.
--  Apply with:  mysql -h <host> -u <user> -p < 001_schema.sql
-- ============================================================================

CREATE DATABASE IF NOT EXISTS paris_fraicheur
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE paris_fraicheur;

-- ---------------------------------------------------------------------------
--  Reference: the 20 arrondissements. Seeded once, joined for labels and area.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS arrondissements (
  code            CHAR(5)       NOT NULL COMMENT '75001..75020',
  number          TINYINT       NOT NULL COMMENT '1..20',
  label           VARCHAR(8)    NOT NULL COMMENT 'chart-friendly short label, e.g. 11e',
  name            VARCHAR(64)   NOT NULL,
  area_km2        DECIMAL(6, 3) NULL,
  population      INT UNSIGNED  NULL,
  PRIMARY KEY (code),
  UNIQUE KEY uq_arrondissement_number (number)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
--  Reference: the Open Data Paris datasets we ingest.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sources (
  slug         VARCHAR(64)  NOT NULL COMMENT 'Open Data Paris dataset slug',
  label        VARCHAR(128) NOT NULL,
  is_required  BOOLEAN      NOT NULL DEFAULT TRUE,
  PRIMARY KEY (slug)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
--  Core entity. Mirrors the `CoolSpot` TypeScript contract 1:1 so the Go API
--  can marshal a row straight to the shape the React store already expects.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cool_spots (
  id              VARCHAR(96)  NOT NULL COMMENT 'namespaced: fountain:123 / green:456 / facility:789',
  name            VARCHAR(255) NOT NULL,
  category        ENUM('fountain', 'green_space', 'indoor', 'mist') NOT NULL,
  arrondissement  CHAR(5)      NULL,
  address         VARCHAR(512) NOT NULL,
  is_free         BOOLEAN      NOT NULL DEFAULT TRUE,
  price           ENUM('FREE', 'MUNICIPAL') NOT NULL DEFAULT 'FREE',
  lat             DECIMAL(10, 7) NULL,
  lon             DECIMAL(10, 7) NULL,
  opening_hours   VARCHAR(255) NULL,
  is_open_now     BOOLEAN      NOT NULL DEFAULT TRUE,
  canopy_score    TINYINT UNSIGNED NOT NULL DEFAULT 50 COMMENT '0..100',
  water_access    BOOLEAN      NOT NULL DEFAULT FALSE,
  shade_level     VARCHAR(128) NOT NULL DEFAULT '',
  -- JSON rather than a junction table: the list is short, read-only and always
  -- consumed whole by the UI. Normalizing it would buy nothing here.
  features        JSON         NOT NULL,
  source          VARCHAR(64)  NOT NULL,
  ingested_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_spot_category (category),
  KEY idx_spot_arrondissement (arrondissement),
  KEY idx_spot_source (source),
  -- Covers the dashboard default view: filter by arrondissement, sort by score.
  KEY idx_spot_arr_score (arrondissement, canopy_score DESC),
  KEY idx_spot_price (price),
  FULLTEXT KEY ft_spot_search (name, address),

  CONSTRAINT fk_spot_arrondissement FOREIGN KEY (arrondissement)
    REFERENCES arrondissements (code) ON DELETE SET NULL,
  CONSTRAINT fk_spot_source FOREIGN KEY (source)
    REFERENCES sources (slug) ON DELETE RESTRICT,
  CONSTRAINT ck_spot_canopy CHECK (canopy_score BETWEEN 0 AND 100),
  -- Coordinates are all-or-nothing; a half-set point is a normalization bug.
  CONSTRAINT ck_spot_coords CHECK ((lat IS NULL) = (lon IS NULL))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
--  Citizen reports submitted from the EmergencyWizard, via the Go API.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citizen_reports (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  spot_id      VARCHAR(96)  NOT NULL,
  kind         ENUM('out_of_service', 'crowded', 'closed', 'wrong_info', 'other') NOT NULL,
  comment      VARCHAR(1000) NULL,
  reported_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status       ENUM('pending', 'confirmed', 'rejected') NOT NULL DEFAULT 'pending',
  PRIMARY KEY (id),
  KEY idx_report_spot (spot_id, reported_at DESC),
  KEY idx_report_status (status),
  CONSTRAINT fk_report_spot FOREIGN KEY (spot_id)
    REFERENCES cool_spots (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
--  One row per pipeline run per dataset. The Go API surfaces the latest rows
--  as the `DatasetLoadReport[]` the dashboard footer already renders.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id           VARCHAR(128) NOT NULL COMMENT 'pipeline run identifier',
  source           VARCHAR(64)  NOT NULL,
  status           ENUM('ok', 'failed') NOT NULL,
  raw_count        INT UNSIGNED NOT NULL DEFAULT 0,
  normalized_count INT UNSIGNED NOT NULL DEFAULT 0,
  error            VARCHAR(512) NULL,
  started_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_run_source (run_id, source),
  KEY idx_run_recent (source, started_at DESC)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
--  Heat-vulnerability score per arrondissement, computed and written by
--  analytics/r. Kept out of `arrondissements` so a failed analytics run never
--  blocks the serving reference data.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS arrondissement_scores (
  code                CHAR(5)      NOT NULL,
  computed_on         DATE         NOT NULL,
  spots_per_km2       DECIMAL(8, 3) NOT NULL DEFAULT 0,
  mean_canopy_score   DECIMAL(5, 2) NOT NULL DEFAULT 0,
  water_access_ratio  DECIMAL(5, 4) NOT NULL DEFAULT 0,
  -- 0 = well covered, 100 = most underserved during a heatwave.
  vulnerability_index DECIMAL(5, 2) NOT NULL DEFAULT 0,
  cluster             TINYINT UNSIGNED NULL COMMENT 'k-means group from analytics/r',
  PRIMARY KEY (code, computed_on),
  CONSTRAINT fk_score_arrondissement FOREIGN KEY (code)
    REFERENCES arrondissements (code) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
--  Tree census per arrondissement, from the city's `les-arbres` register.
--  This is what makes `cool_spots.canopy_score` a measurement rather than a
--  hash: the pipeline counts registered trees within 300 m of every spot.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS arrondissement_trees (
  code         CHAR(5)      NOT NULL,
  computed_on  DATE         NOT NULL,
  tree_count   INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (code, computed_on),
  CONSTRAINT fk_trees_arrondissement FOREIGN KEY (code)
    REFERENCES arrondissements (code) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
--  Daily history of the per-arrondissement aggregates.
--
--  Twenty rows a day. A decade of this is ~73k rows, which is why it lives in
--  MySQL rather than in a warehouse: the questions history answers here are
--  "how did coverage move between two heatwaves", and MySQL answers them
--  instantly at this size.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS arrondissement_history (
  code               CHAR(5)      NOT NULL,
  snapshot_date      DATE         NOT NULL,
  total              INT UNSIGNED NOT NULL DEFAULT 0,
  fountain           INT UNSIGNED NOT NULL DEFAULT 0,
  green_space        INT UNSIGNED NOT NULL DEFAULT 0,
  indoor             INT UNSIGNED NOT NULL DEFAULT 0,
  mist               INT UNSIGNED NOT NULL DEFAULT 0,
  mean_canopy_score  DECIMAL(5, 2) NOT NULL DEFAULT 0,
  water_access_ratio DECIMAL(5, 4) NOT NULL DEFAULT 0,
  PRIMARY KEY (code, snapshot_date),
  KEY idx_history_date (snapshot_date),
  CONSTRAINT fk_history_arrondissement FOREIGN KEY (code)
    REFERENCES arrondissements (code) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
--  Read model for the dashboard ArrondissementChart - one query, no N+1.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_arrondissement_stats AS
SELECT
  a.code,
  a.label,
  COUNT(s.id)                     AS total,
  SUM(s.category = 'fountain')    AS fountain,
  SUM(s.category = 'green_space') AS green_space,
  SUM(s.category = 'indoor')      AS indoor,
  SUM(s.category = 'mist')        AS mist,
  ROUND(AVG(s.canopy_score), 2)   AS mean_canopy_score,
  ROUND(AVG(s.water_access), 4)   AS water_access_ratio
FROM arrondissements a
LEFT JOIN cool_spots s ON s.arrondissement = a.code
GROUP BY a.code, a.label;
