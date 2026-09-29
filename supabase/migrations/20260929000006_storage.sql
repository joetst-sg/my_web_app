-- Storage buckets and policies.
--
-- Public buckets serve files by URL (needed for next/image and caching).
-- File names are random UUIDs, and image rows for unpublished products are
-- hidden by RLS, so draft images are not discoverable. Writes are always
-- restricted to the owner of the folder (or staff).
--
-- Path conventions:
--   avatars/{user_id}/{uuid}.webp
--   product-images/products/{product_id}/{uuid}.webp
--   brand-images/brands/{brand_id}/{uuid}.webp
--   collection-images/{user_id}/{uuid}.webp
--   article-images/articles/{uuid}.webp
--   uploads/{user_id}/{uuid}.{ext}          (private)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('brand-images', 'brand-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('collection-images', 'collection-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('article-images', 'article-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('uploads', 'uploads', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- avatars: own folder
create policy "avatars: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_active_user());
create policy "avatars: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- product images: whoever may edit the product
create policy "product-images: editors read" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = 'products'
    and public.can_edit_product(public.try_uuid((storage.foldername(name))[2])));
create policy "product-images: editors insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = 'products'
    and public.can_edit_product(public.try_uuid((storage.foldername(name))[2])));
create policy "product-images: editors update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = 'products'
    and public.can_edit_product(public.try_uuid((storage.foldername(name))[2])));
create policy "product-images: editors delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = 'products'
    and public.can_edit_product(public.try_uuid((storage.foldername(name))[2])));

-- brand images: brand owner or staff
create policy "brand-images: editors read" on storage.objects for select to authenticated
  using (bucket_id = 'brand-images' and (storage.foldername(name))[1] = 'brands'
    and public.can_edit_brand(public.try_uuid((storage.foldername(name))[2])));
create policy "brand-images: editors insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-images' and (storage.foldername(name))[1] = 'brands'
    and public.can_edit_brand(public.try_uuid((storage.foldername(name))[2])));
create policy "brand-images: editors update" on storage.objects for update to authenticated
  using (bucket_id = 'brand-images' and (storage.foldername(name))[1] = 'brands'
    and public.can_edit_brand(public.try_uuid((storage.foldername(name))[2])));
create policy "brand-images: editors delete" on storage.objects for delete to authenticated
  using (bucket_id = 'brand-images' and (storage.foldername(name))[1] = 'brands'
    and public.can_edit_brand(public.try_uuid((storage.foldername(name))[2])));

-- collection covers: own folder
create policy "collection-images: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'collection-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "collection-images: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'collection-images' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_active_user());
create policy "collection-images: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'collection-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "collection-images: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'collection-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- article images: staff only
create policy "article-images: staff read" on storage.objects for select to authenticated
  using (bucket_id = 'article-images' and public.is_staff());
create policy "article-images: staff insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'article-images' and public.is_staff());
create policy "article-images: staff update" on storage.objects for update to authenticated
  using (bucket_id = 'article-images' and public.is_staff());
create policy "article-images: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'article-images' and public.is_staff());

-- private uploads: own folder, staff can read
create policy "uploads: owner or staff read" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff()));
create policy "uploads: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_active_user());
create policy "uploads: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
