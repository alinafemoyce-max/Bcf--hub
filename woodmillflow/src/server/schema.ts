import type { Queryable } from './db';

/** Idempotent schema creation. Every order supports any number of structured cutting items. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 60),
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS production_lines (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 60),
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clock_number  TEXT NOT NULL UNIQUE CHECK (length(clock_number) BETWEEN 1 AND 20),
  name          TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  role          TEXT NOT NULL CHECK (role IN ('employee', 'operator')),
  department_id INT REFERENCES departments(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_sequences (
  year        INT PRIMARY KEY,
  last_value  INT NOT NULL CHECK (last_value >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference           TEXT NOT NULL UNIQUE,
  requester_id        UUID NOT NULL REFERENCES users(id),
  requester_name      TEXT NOT NULL,
  requester_clock     TEXT NOT NULL,
  department_id       INT NOT NULL REFERENCES departments(id),
  production_line_id  INT NOT NULL REFERENCES production_lines(id),
  hull_reference      TEXT CHECK (length(hull_reference) <= 40),
  date_required       DATE,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status              TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN
                        ('submitted','clarification_required','accepted','in_progress','ready','collected','rejected','cancelled')),
  requested_priority  TEXT NOT NULL DEFAULT 'normal' CHECK (requested_priority IN ('normal','urgent')),
  urgent_reason       TEXT CHECK (length(urgent_reason) <= 300),
  approved_priority   TEXT CHECK (approved_priority IN ('normal','high','urgent')),
  notes               TEXT CHECK (length(notes) <= 1000),
  tracking_token      TEXT NOT NULL UNIQUE CHECK (length(tracking_token) >= 32),
  idempotency_key     TEXT UNIQUE,
  CHECK (requested_priority = 'normal' OR urgent_reason IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_submitted_idx ON orders (submitted_at);
CREATE INDEX IF NOT EXISTS orders_requester_idx ON orders (requester_id);

CREATE TABLE IF NOT EXISTS order_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position              INT NOT NULL CHECK (position >= 1),
  material_category     TEXT NOT NULL CHECK (material_category IN
                          ('plywood','mdf','hardwood','softwood','veneered_board','laminate','other')),
  material_description  TEXT NOT NULL CHECK (length(material_description) BETWEEN 1 AND 120),
  thickness_mm          NUMERIC(6,1) CHECK (thickness_mm > 0),
  length_mm             INT NOT NULL CHECK (length_mm > 0),
  width_mm              INT NOT NULL CHECK (width_mm > 0),
  quantity              INT NOT NULL CHECK (quantity > 0),
  grain_direction       TEXT CHECK (grain_direction IN ('lengthways','widthways','not_applicable')),
  cutting_requirements  TEXT[] NOT NULL CHECK (cardinality(cutting_requirements) >= 1),
  cutting_other         TEXT CHECK (length(cutting_other) <= 120),
  drawing_reference     TEXT CHECK (length(drawing_reference) <= 60),
  notes                 TEXT CHECK (length(notes) <= 1000),
  UNIQUE (order_id, position)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

CREATE TABLE IF NOT EXISTS status_history (
  id                BIGSERIAL PRIMARY KEY,
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL DEFAULT 'status' CHECK (event_type IN ('status','priority')),
  previous_status   TEXT,
  new_status        TEXT NOT NULL,
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by        UUID NOT NULL REFERENCES users(id),
  comment           TEXT CHECK (length(comment) <= 1000),
  comment_internal  BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS status_history_order_idx ON status_history (order_id, changed_at);
`;

export async function migrate(db: Queryable): Promise<void> {
  for (const statement of SCHEMA_SQL.split(';').map((s) => s.trim()).filter(Boolean)) {
    await db.query(statement);
  }
}
