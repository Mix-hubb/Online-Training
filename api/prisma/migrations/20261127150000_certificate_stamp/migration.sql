-- 2026-11-27: certificate layout with a stamp image over the issuer name.
ALTER TABLE "CertificateTemplate" ADD COLUMN "stampUrl" TEXT;
