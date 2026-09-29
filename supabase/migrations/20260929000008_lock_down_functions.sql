-- Trigger functions and internal helpers are not part of the API.
-- (RLS helpers such as can_edit_product stay executable because policies
-- call them as the requesting role; they only answer questions about the
-- caller's own access.)

revoke execute on function
  public.handle_brand_follow(),
  public.handle_category_follow(),
  public.handle_collection_follow(),
  public.handle_collection_product(),
  public.handle_new_product(),
  public.handle_new_seller(),
  public.handle_new_user(),
  public.handle_price_change(),
  public.handle_product_save(),
  public.handle_reminder_created(),
  public.handle_submission_message(),
  public.submission_missing_fields(uuid)
from public, anon, authenticated;
