-- "QR Code payment" replaces the GCash-only option. Old 'gcash' orders keep working.
alter type public.payment_method add value if not exists 'qr';
