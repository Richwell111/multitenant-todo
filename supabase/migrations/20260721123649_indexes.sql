create index tasks_company_id_status_idx
  on public.tasks (company_id, status);

create index licences_redeemed_by_company_id_idx
  on public.licences (redeemed_by_company_id);
