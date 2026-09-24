-- Sample data for local development.
-- Slugs and prices match the `trustedPricing` table in app/api/bookings/route.ts —
-- change both together if you edit one.

insert into public.safari_packages
  (slug, title, meta, description, hero_image_url, tag, location, duration_days, duration,
   starting_price, best_time, travel_style, highlights, included, excluded, accommodation,
   transport, wildlife, published)
values
  ('great-migration', 'The Great Migration', '8 days', 'Follow the herds across the Mara.',
   '/images/elephants-savannah.jpg', 'Signature', 'Masai Mara, Kenya', 8, '8 days / 7 nights',
   4200, 'Jul – Oct', 'Private safari',
   array['Migration river crossings', 'Private guide', 'Luxury tented camps'],
   array['All meals', 'Park fees', 'Private vehicle'], array['International flights', 'Visa fees'],
   'Luxury tented camps', 'Private 4x4 with pop-up roof',
   array['Wildebeest', 'Lion', 'Elephant', 'Crocodile'], true),
  ('northern-wilds', 'Northern Wilds', '9 days', 'Remote wilderness in the north.',
   '/images/rhino-encounter.jpg', 'Adventure', 'Samburu & Laikipia, Kenya', 9, '9 days / 8 nights',
   3900, 'Jan – Mar, Jun – Sep', 'Private safari',
   array['Rare northern species', 'Community conservancies', 'Small-group camps'],
   array['All meals', 'Park fees', 'Private vehicle'], array['International flights', 'Visa fees'],
   'Boutique lodges', 'Private 4x4 with pop-up roof',
   array['Grevys zebra', 'Reticulated giraffe', 'Elephant'], true),
  ('family-safari', 'The Family Safari', '7 days', 'Kenya designed for every age.',
   '/images/giraffe-encounter.jpg', 'Family', 'Amboseli & Tsavo, Kenya', 7, '7 days / 6 nights',
   3600, 'Year-round', 'Family safari',
   array['Kid-friendly camps', 'Shorter drive times', 'Junior ranger activities'],
   array['All meals', 'Park fees', 'Private vehicle'], array['International flights', 'Visa fees'],
   'Family-suite lodges', 'Private 4x4 with pop-up roof',
   array['Elephant', 'Giraffe', 'Zebra'], true)
on conflict (slug) do nothing;

insert into public.safari_availability
  (safari_package_id, available_from, available_to, capacity, booked_spaces, status)
select id, current_date + 30, current_date + 37, 12, 0, 'available'
  from public.safari_packages where slug = 'great-migration'
union all
select id, current_date + 45, current_date + 53, 10, 0, 'available'
  from public.safari_packages where slug = 'northern-wilds'
union all
select id, current_date + 20, current_date + 26, 14, 0, 'available'
  from public.safari_packages where slug = 'family-safari'
on conflict (safari_package_id, available_from, available_to) do nothing;
