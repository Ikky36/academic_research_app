
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

-- Enable RLS
ALTER TABLE methodology_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE methodology_chunks ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow read for authenticated users, full access for admins. For simplicity, allow all authenticated users to read)
CREATE POLICY "Allow authenticated read methodology_books" ON methodology_books FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read methodology_chunks" ON methodology_chunks FOR SELECT TO authenticated USING (true);

-- Allow admins to insert/update/delete (Assuming admins have a specific role or just allow authenticated for now if we don't have strict roles)
CREATE POLICY "Allow authenticated all methodology_books" ON methodology_books FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all methodology_chunks" ON methodology_chunks FOR ALL TO authenticated USING (true) WITH CHECK (true);
