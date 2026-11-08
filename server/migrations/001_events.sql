-- requirement-v6.md FR-93, FR-94: API keys, devices, pets and events.
-- Works on MySQL 8 and MariaDB 10.6+. All times are UTC.

CREATE TABLE api_keys (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  label VARCHAR(100) NOT NULL,
  prefix VARCHAR(16) NOT NULL,
  hash CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  last_used_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY api_keys_hash (hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE devices (
  id CHAR(36) NOT NULL,
  app_version VARCHAR(100) NOT NULL,
  first_seen_at DATETIME(3) NOT NULL,
  last_seen_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pets (
  id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  adopted_at DATETIME(3) NOT NULL,
  -- Set by a pet.replaced event: the app wiped this pet for a new adoption.
  replaced_at DATETIME(3) NULL,
  device_id CHAR(36) NOT NULL,
  first_seen_at DATETIME(3) NOT NULL,
  -- Time of the newest event seen for this pet (its name is taken from that event).
  last_event_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE events (
  id CHAR(36) NOT NULL,
  type VARCHAR(40) NOT NULL,
  schema_version SMALLINT UNSIGNED NOT NULL,
  pet_id CHAR(36) NOT NULL,
  device_id CHAR(36) NOT NULL,
  at DATETIME(3) NOT NULL,
  tz_offset SMALLINT NOT NULL,
  app_version VARCHAR(100) NOT NULL,
  pet_name VARCHAR(100) NOT NULL,
  hunger DECIMAL(5, 2) NOT NULL,
  happiness DECIMAL(5, 2) NOT NULL,
  mood VARCHAR(16) NOT NULL,
  data JSON NOT NULL,
  received_at DATETIME(3) NOT NULL,
  api_key_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY events_pet_at (pet_id, at),
  KEY events_type_at (type, at),
  KEY events_at (at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
