update public.hub_tasks
set assigned_to = case assigned_to
  when 'David' then 'david'
  when 'Zac' then 'zacharie'
  when 'Valérie' then 'valerie'
  when 'Steven' then 'steven'
  when 'Théo' then 'theo'
  else assigned_to
end
where assigned_to is not null;

update public.hub_tasks
set assigned_by = case assigned_by
  when 'David' then 'david'
  when 'Zac' then 'zacharie'
  when 'Valérie' then 'valerie'
  when 'Steven' then 'steven'
  when 'Théo' then 'theo'
  else assigned_by
end
where assigned_by is not null;
