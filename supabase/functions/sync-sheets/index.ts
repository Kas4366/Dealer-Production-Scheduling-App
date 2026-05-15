import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SHEET_TAB = "Daily Records";

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
      query = query.in("id", record_ids);
    } else if (week_dates && week_dates.length > 0) {
      query = query.in("slot_date", week_dates);
    } else {
      query = query.eq("synced_to_sheets", false);
    }

    const { data: records, error } = await query;

    if (error) throw error;
    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ message: "No records to sync", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      return new Response(JSON.stringify({ error: "GOOGLE_SERVICE_ACCOUNT_JSON secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getGoogleAccessToken(serviceAccount);

    // Collect existing sheet row numbers that need to be deleted before re-appending.
    // Sort descending so deleting higher rows first doesn't shift the indices of lower rows.
    const rowsToDelete: number[] = records
      .filter((r: any) => r.sheet_row_number != null)
      .map((r: any) => r.sheet_row_number as number)
      .sort((a: number, b: number) => b - a);

    if (rowsToDelete.length > 0) {
      const tabId = await getSheetTabId(sheet_id, SHEET_TAB, accessToken);
      const deleteRequests = rowsToDelete.map((rowIdx: number) => ({
        deleteDimension: {
          range: {
            sheetId: tabId,
            dimension: "ROWS",
            // Sheets API uses 0-indexed; our stored value is 1-indexed
            startIndex: rowIdx - 1,
            endIndex: rowIdx,
          },
        },
      }));

      const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheet_id}:batchUpdate`;
      const batchRes = await fetch(batchUpdateUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests: deleteRequests }),
      });

      if (!batchRes.ok) {
        const errText = await batchRes.text();
        throw new Error(`Google Sheets batchUpdate (delete rows) error: ${errText}`);
      }
    }

    // Build and append fresh rows
    const rows = records.map((r: any) => buildRow(r));

    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheet_id}/values/${encodeURIComponent(SHEET_TAB + "!A:U")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
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
      throw new Error(`Google Sheets API append error: ${errText}`);
    }

    const appendData = await sheetsRes.json();

    // Parse the start row from the response (e.g. "Daily Records!A47:U49" → 47)
    const updatedRange: string = appendData?.updates?.updatedRange ?? "";
    const startRow = parseStartRow(updatedRange);

    if (startRow !== null) {
      for (let i = 0; i < records.length; i++) {
        await supabase
          .from("visit_records")
          .update({ synced_to_sheets: true, sheet_row_number: startRow + i })
          .eq("id", records[i].id);
      }
    } else {
      const ids = records.map((r: any) => r.id);
      await supabase.from("visit_records").update({ synced_to_sheets: true }).in("id", ids);
    }

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

// Cache the sheet tab's numeric sheetId within a single request execution
const sheetTabIdCache: Record<string, number> = {};

async function getSheetTabId(spreadsheetId: string, tabName: string, accessToken: string): Promise<number> {
  const cacheKey = `${spreadsheetId}:${tabName}`;
  if (sheetTabIdCache[cacheKey] !== undefined) return sheetTabIdCache[cacheKey];

  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaRes = await fetch(metaUrl, {
    headers: { "Authorization": `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) throw new Error("Could not fetch spreadsheet metadata");
  const meta = await metaRes.json();
  const sheet = meta.sheets?.find((s: any) => s.properties?.title === tabName);
  if (!sheet) throw new Error(`Sheet tab "${tabName}" not found`);
  const id = sheet.properties.sheetId as number;
  sheetTabIdCache[cacheKey] = id;
  return id;
}

function parseStartRow(updatedRange: string): number | null {
  // e.g. "Daily Records!A47:U49" — extract first row number after the "!"
  const match = updatedRange.match(/![^0-9]*(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function buildRow(r: any): unknown[] {
  const ds = r.daily_schedule;
  const date = new Date(r.slot_date + "T00:00:00");
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
  const changeType = ds?.change_type ?? "";
  const originalDay = ds?.original_date ? new Date(ds.original_date + "T00:00:00").toLocaleDateString("en-GB") : "";
  const swappedWith = ds?.swapped_with_dealer?.name ?? "";

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
    r.bottles_home ?? 0,                         // L: Home Bottles
    (r.bottles_19l_out ?? 0) + (r.bottles_10l_out ?? 0) + (r.bottles_home ?? 0), // M: Total Filled
    (ds?.planned_19l ?? 0) + (ds?.planned_10l ?? 0),  // N: Planned Quantity
    changeType,                                  // O: Slot Change Type
    originalDay,                                 // P: Original Day (if moved)
    swappedWith,                                 // Q: Swapped With
    r.recorded_by ?? "",                         // R: Recorded By
    r.notes ?? "",                               // S: Notes
    savedDate,                                   // T: Saved Date
    savedTime,                                   // U: Saved Time
  ];
}

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
