-- Widen only upload/extraction capacity. Ownership, RLS and retention are unchanged.
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.chat_documents
  DROP CONSTRAINT chat_documents_size_bytes_check,
  ADD CONSTRAINT chat_documents_size_bytes_check
    CHECK (size_bytes > 0 AND size_bytes <= 26214400) NOT VALID,
  DROP CONSTRAINT chat_documents_extracted_chars_check,
  ADD CONSTRAINT chat_documents_extracted_chars_check
    CHECK (extracted_chars >= 0 AND extracted_chars <= 500000) NOT VALID;
ALTER TABLE public.chat_documents VALIDATE CONSTRAINT chat_documents_size_bytes_check;
ALTER TABLE public.chat_documents VALIDATE CONSTRAINT chat_documents_extracted_chars_check;
