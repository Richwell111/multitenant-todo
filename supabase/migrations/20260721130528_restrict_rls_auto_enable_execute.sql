-- public.rls_auto_enable() is invoked internally by the ensure_rls event
-- trigger. Application and API roles do not need to call it directly.
revoke execute on function public.rls_auto_enable() from PUBLIC;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.rls_auto_enable() from service_role;
