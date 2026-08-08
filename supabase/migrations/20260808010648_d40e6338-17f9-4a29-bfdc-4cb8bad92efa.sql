GRANT SELECT ON public.pool TO anon;
CREATE POLICY "Anyone can read pool" ON public.pool FOR SELECT TO anon USING (true);