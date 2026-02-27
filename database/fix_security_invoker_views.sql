-- Fix Security Advisor warning:
-- Views should use invoker rights to respect RLS of querying user.

ALTER VIEW IF EXISTS public.product_sales_summary
  SET (security_invoker = true);

ALTER VIEW IF EXISTS public.order_summary
  SET (security_invoker = true);
