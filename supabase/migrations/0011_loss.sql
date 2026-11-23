-- FreedomDay migration 0011: losses
-- A loss (business, trading, a bad deal) is money you earned and then lost. It is saved as a
-- negative transaction in a 'loss' category and comes off Earned: it is not counted as Spent.
-- Run after 0009 (Supabase > SQL Editor > paste > Run). Safe to re-run.
begin;
set local lock_timeout = '10s';

-- 1. allow the new 'loss' bucket
alter table fin.categories drop constraint if exists categories_bucket_check;
alter table fin.categories add constraint categories_bucket_check
  check (bucket in ('income','loss','fixed','kids','daily','sinking','invest','discretionary','transfer'));

-- 2. default loss categories
insert into fin.categories(household_id, name, bucket) values
  (null, 'Business loss', 'loss'), (null, 'Trading loss', 'loss'), (null, 'Other loss', 'loss')
on conflict (household_id, name) do update set bucket = excluded.bucket;

-- 3. summaries: a loss lowers the day's income instead of adding to spending
create or replace function fin.apply_rollup(p_household uuid, p_day date, p_category int,
                                            p_amount bigint, p_sign int) returns void
language plpgsql security definer set search_path = fin as $$
declare
  b text := (select bucket from fin.categories where id = p_category);
begin
  if b = 'transfer' then
    return;
  end if;
  if b = 'loss' then
    -- saved as a negative amount, so adding it takes it off income
    insert into fin.daily_household_summary as d(household_id, day, income_paise, expense_paise)
    values (p_household, p_day, p_sign * p_amount, 0)
    on conflict (household_id, day) do update set income_paise = d.income_paise + excluded.income_paise;
    return;
  end if;
  insert into fin.daily_household_summary as d(household_id, day, income_paise, expense_paise)
  values (p_household, p_day, p_sign * greatest(p_amount, 0), p_sign * greatest(-p_amount, 0))
  on conflict (household_id, day) do update
    set income_paise  = d.income_paise  + excluded.income_paise,
        expense_paise = d.expense_paise + excluded.expense_paise;
  if p_category is not null and p_amount < 0 then
    insert into fin.monthly_category_spend as m(household_id, month, category_id, spend_paise, txn_count)
    values (p_household, date_trunc('month', p_day)::date, p_category, p_sign * -p_amount, p_sign)
    on conflict (household_id, month, category_id) do update
      set spend_paise = m.spend_paise + excluded.spend_paise,
          txn_count   = m.txn_count   + excluded.txn_count;
  end if;
end $$;
revoke execute on function fin.apply_rollup(uuid, date, int, bigint, int) from public;

notify pgrst, 'reload schema';
commit;
