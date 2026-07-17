import { NextResponse } from "next/server";

// TEMPORARY DEBUG ROUTE — delete this file once the credentials issue is fixed.
// It never returns the actual key material, only sanitized diagnostics.
export async function GET() {
  const blob = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const legacyEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const legacyKey = process.env.GOOGLE_PRIVATE_KEY;

  const report = {
    hasJsonBlob: Boolean(blob),
    hasLegacyEmail: Boolean(legacyEmail),
    hasLegacyKey: Boolean(legacyKey),
    hasSheetId: Boolean(process.env.GOOGLE_SHEET_ID),
  };

  let privateKey = null;
  let email = null;

  if (blob) {
    report.jsonBlobLength = blob.length;
    try {
      const parsed = JSON.parse(blob);
      report.jsonParseOk = true;
      report.hasClientEmail = Boolean(parsed.client_email);
      report.hasPrivateKeyField = Boolean(parsed.private_key);
      email = parsed.client_email;
      privateKey = parsed.private_key;
    } catch (err) {
      report.jsonParseOk = false;
      report.jsonParseError = err.message;
    }
  } else if (legacyKey) {
    email = legacyEmail;
    privateKey = legacyKey.replace(/\\n/g, "\n");
  }

  if (privateKey) {
    report.privateKeyLength = privateKey.length;
    report.containsLiteralBackslashN = privateKey.includes("\\n");
    report.containsRealNewlines = privateKey.includes("\n");
    report.startsCorrectly = privateKey.trim().startsWith("-----BEGIN PRIVATE KEY-----");
    report.endsCorrectly = privateKey.trim().endsWith("-----END PRIVATE KEY-----");

    try {
      const crypto = await import("crypto");
      crypto.createPrivateKey(privateKey);
      report.cryptoAcceptsKey = true;
    } catch (err) {
      report.cryptoAcceptsKey = false;
      report.cryptoError = err.message;
    }
  }

  if (email) {
    report.clientEmailDomainLooksValid = /iam\.gserviceaccount\.com$/.test(email.trim());
  }

  return NextResponse.json(report);
}
