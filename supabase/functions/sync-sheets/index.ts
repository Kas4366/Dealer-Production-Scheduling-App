import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { sheet_id, week_dates, record_ids } = await req.json();

    if (!sheet_id) {
      return new Response(JSON.stringify({ error: "sheet_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase
      .from("visit_records")
      .select(`
        *,
        dealer:dealers(name, code),
        daily_schedule:daily_schedule(
          scheduled_time, planned_19l, planned_10l,
          status, change_type, original_date,
          swapped_with_dealer:dealers!daily_schedule_swapped_with_dealer_id_fkey(name)
        )
      `);

    if (record_ids && record_ids.length > 0) {
      // Targeted sync: only the specific records requested
      query = query.in("id", record_ids);
    } else if (week_dates && week_dates.length > 0) {
      // Week sync: all records for given dates
      query = query.in("slot_date", week_dates);
    } else {
      // Fallback: all unsynced records
      query = query.eq("synced_to_sheets", false);
    }

    const { data: records, error } = await query;

    if (error) throw error;
    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ message: "No records to sync", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Google service account credentials
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      return new Response(JSON.stringify({ error: "GOOGLE_SERVICE_ACCOUNT_JSON secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getGoogleAccessToken(serviceAccount);

    // Build rows for Google Sheets
    const rows = records.map((r: any) => {
      const ds = r.daily_schedule;
      const date = new Date(r.slot_date + "T00:00:00");
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
      const changeType = ds?.change_type ?? "";
      const originalDay = ds?.original_date ? new Date(ds.original_date + "T00:00:00").toLocaleDateString("en-GB") : "";
      const swappedWith = ds?.swapped_with_dealer?.name ?? "";

      // Saved date (S) and saved time (T) from updated_at, in Sri Lanka time (UTC+5:30)
      const savedAt = r.updated_at ? new Date(r.updated_at) : null;
      const savedDate = savedAt
        ? savedAt.toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" })
        : "";
      const savedTime = savedAt
        ? savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Colombo" })
        : "";

      return [
        date.toLocaleDateString("en-GB"),          // A: Date
        dayName,                                     // B: Day
        r.dealer?.name ?? "",                        // C: Dealer Name
        ds?.scheduled_time ?? "",                    // D: Scheduled Time
        r.status,                                    // E: Slot Status
        ds?.status ?? "",                            // F: Slot Note (schedule status)
        r.actual_arrival_time ?? "",                 // G: Actual Arrival Time
        r.bottles_19l_in ?? 0,                       // H: 19L Bottles In
        r.bottles_19l_out ?? 0,                      // I: 19L Bottles Out
        r.bottles_10l_in ?? 0,                       // J: 10L Bottles In
        r.bottles_10l_out ?? 0,                      // K: 10L Bottles Out
        (r.bottles_19l_out ?? 0) + (r.bottles_10l_out ?? 0), // L: Total Bottles Filled
        (ds?.planned_19l ?? 0) + (ds?.planned_10l ?? 0),     // M: Planned Quantity
        changeType,                                  // N: Slot Change Type
        originalDay,                                 // O: Original Day (if moved)
        swappedWith,                                 // P: Swapped With
        r.recorded_by ?? "",                         // Q: Recorded By
        r.notes ?? "",                               // R: Notes
        savedDate,                                   // S: Saved Date
        savedTime,                                   // T: Saved Time
      ];
    });

    // Append to Google Sheet
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheet_id}/values/Daily%20Records!A:T:append?valueInputOption=USER_ENTERED`;
    const sheetsRes = await fetch(appendUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rows }),
    });

    if (!sheetsRes.ok) {
      const errText = await sheetsRes.text();
      throw new Error(`Google Sheets API error: ${errText}`);
    }

    // Mark records as synced
    const ids = records.map((r: any) => r.id);
    await supabase.from("visit_records").update({ synced_to_sheets: true }).in("id", ids);

    return new Response(JSON.stringify({ message: "Synced successfully", count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const header = { alg: "RS256", typ: "JWT" };
  const encode = (obj: object) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${encode(header)}.${encode(payload)}`;

  const keyData = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${signingInput}.${sigBase64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Failed to get Google access token");
  return tokenData.access_token;
}
