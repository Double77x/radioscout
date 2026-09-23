/**
 * Curated "Best of British" shelf: station uuids taken from real user
 * favourites (2026-09-23 backup exports). Resolved in one `stationsByUuid`
 * round-trip, then playable-filtered, name-deduped and A–Z sorted by
 * `use-best-of-british`. Rows that die or go HTTP-only in the directory
 * drop out silently — never hand-edit URLs here, just add/remove uuids.
 */
export const BEST_OF_BRITISH_UUIDS: string[] = [
  // BBC network (akamaized HLS rows play via the https-upgrade allowlist).
  "a740cc4c-9563-4fbe-a13f-e7f9e89b7441", // BBC Radio 1
  "fdbdc2b0-c184-437b-8643-9a5bfa45c253", // BBC Radio 1 (alt feed, fallback)
  "308d38c6-e8a4-41e9-8ffe-9be2623826a4", // BBC Radio 1Xtra
  "c78f16b7-2e96-4560-912c-0fd2313e3d2f", // BBC Radio 1 Anthems
  "f2547182-2dab-4ad2-b4d8-bb03533c2e9c", // BBC Radio 1 Dance
  "3606ef8c-cd58-4440-8c47-dbf1e0cacdac", // BBC Radio 2
  "03e68f6d-1ca3-459f-891a-c55d84711646", // BBC Radio 3
  "98137c2d-ce68-4e33-8cb7-ddf3692ecc9d", // BBC Radio 4
  "2a363fb7-37f5-4b44-b920-55ec0d01b745", // BBC Radio 4 Extra
  "ccd9d009-b369-4451-9ebb-a2138bed734f", // BBC Radio 4 Extra (alt feed, fallback)
  "cae35448-1285-4f12-b3e0-2f4fdde00002", // BBC Radio 5 Live
  "1c6dcd6f-88c6-4fd4-8191-078435168e85", // BBC Radio 6 Music
  "eec6dc9b-79de-4609-8c6d-88f2bfeb8110", // BBC Radio 6 Music (alt feed, fallback)
  "59813592-9a30-4e5c-bfc6-665724728582", // BBC Live News
  // Bauer (Kiss / Kisstory / Absolute, all https).
  "53733e08-7728-40ee-b968-59e71f0281b6", // KISSTORY
  "19b250fe-9027-4caf-b6ea-33022f0b6392", // KISSTORY R&B
  "5984167a-b25e-4eec-a878-ff9253ee0c4a", // KISS UK
  "0f1a8621-d35a-4073-83d3-7ee14207a9a9", // KISS national
  "700f82f3-c713-4905-8ed3-f5184c254c9d", // Absolute Radio (https row)
  "c6c204d3-3ffd-4e85-b0f9-29bf6de7ddf4", // Absolute Radio 80s
  // Global (Capital / Heart / Smooth / Classic / Gold / LBC / Radio X).
  "80d74009-e473-4454-9602-139b88485ba5", // Capital FM London
  "df3607fb-311d-43b1-bd0c-98d91a4f2df4", // Capital Dance
  "d1bc420f-6aaa-426b-a810-b496622717d6", // Capital XTRA
  "42679ed6-49cb-428e-9b74-94af62ad8a0a", // Heart FM
  "c4077677-dc2f-11e9-a8ba-52543be04c81", // Heart 80s
  "962b27a3-0601-11e8-ae97-52543be04c81", // Smooth Radio (http row, plays via the https-upgrade allowlist)
  "478fd7f4-dc36-11e9-a8ba-52543be04c81", // Smooth Chill
  "bd1c441c-132a-4d48-a3f3-bdb386f4b09a", // Classic FM HD
  "0a1e0bb0-dc37-11e9-a8ba-52543be04c81", // Gold
  "172d8c95-fecd-40b7-af6f-9cdf4e8829e4", // Magic Radio UK
  "8e32c763-b926-4e57-9b8f-d60f1c5b48e3", // LBC News
  "177dda8f-ce5f-4f18-a19e-c6c8b6f5319a", // TalkSPORT
  "9617bbd8-0601-11e8-ae97-52543be04c81", // Radio X (http row, plays via the https-upgrade allowlist)
];
