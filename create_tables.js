const { Client } = require('pg');

const client = new Client({
  host: 'db.nixqngmwwrnhpsdoxgoh.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Zhayad37185_36',
  ssl: {
    rejectUnauthorized: false
  }
});

const sql = `
CREATE TABLE IF NOT EXISTS methodology_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  year TEXT,
  publisher TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS methodology_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES methodology_books(id) ON DELETE CASCADE,
  method_category TEXT NOT NULL,
  content TEXT NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE methodology_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE methodology_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read methodology_books" ON methodology_books FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read methodology_chunks" ON methodology_chunks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated all methodology_books" ON methodology_books FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all methodology_chunks" ON methodology_chunks FOR ALL TO authenticated USING (true) WITH CHECK (true);
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query(sql);
    console.log('Tables created successfully');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
