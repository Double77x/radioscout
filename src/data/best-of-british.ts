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
  "19621204-3051-48ea-ba58-1de4e02d034f", // BBC Radio 4
  "2a363fb7-37f5-4b44-b920-55ec0d01b745", // BBC Radio 4 Extra
  "ccd9d009-b369-4451-9ebb-a2138bed734f", // BBC Radio 4 Extra (alt feed, fallback)
  "cae35448-1285-4f12-b3e0-2f4fdde00002", // BBC Radio 5 Live
  "1c6dcd6f-88c6-4fd4-8191-078435168e85", // BBC Radio 6 Music
  "eec6dc9b-79de-4609-8c6d-88f2bfeb8110", // BBC Radio 6 Music (alt feed, fallback)
  "598c4d0e-6b06-43fb-bff4-717c591213a9", // BBC World Service
  "35773c40-a6d0-4316-bc39-18477a8c63d0", // BBC Radio 3 Unwind (http row, plays via the https-upgrade allowlist)
  "e3740a99-2ce3-413f-b6d4-074620d4243b", // BBC Radio 5 Sports Extra (UK only)
  "3f98c448-d139-46ad-9a8c-f820ec004414", // BBC Live News
  // Bauer (Kiss / Kisstory / Absolute / GHR / Hits / Planet Rock / Magic Classical, all https).
  "53733e08-7728-40ee-b968-59e71f0281b6", // KISSTORY
  "19b250fe-9027-4caf-b6ea-33022f0b6392", // KISSTORY R&B
  "5984167a-b25e-4eec-a878-ff9253ee0c4a", // KISS UK
  "0f1a8621-d35a-4073-83d3-7ee14207a9a9", // KISS national
  "700f82f3-c713-4905-8ed3-f5184c254c9d", // Absolute Radio (https row)
  "c6c204d3-3ffd-4e85-b0f9-29bf6de7ddf4", // Absolute Radio 80s
  "1bfae443-4fa5-45ed-92a5-8aecd6a70756", // Greatest Hits Radio (West Midlands feed — the directory has no national row)
  "b2ad284d-bef1-4f68-8bbd-14195092ea5f", // Greatest Hits Radio 60s
  "4c6d43e7-b474-440f-be56-d899dd0e757e", // Greatest Hits Radio 70s
  "4cb7a690-b0cc-4259-8aac-4674c69da10e", // Greatest Hits Radio 80s
  "0f8f58d2-07e3-4ddb-af14-918a3e90369a", // Hits Radio UK
  "dec031e0-4419-45d2-9f3e-76e91d876c40", // Planet Rock
  "6c747331-3129-4e21-b620-3153f1a360e3", // Kerrang! Radio (url carries unsubstituted ~TEMPLATE~ params, still serves audio)
  "d18943f2-7c18-4e1d-8cf2-9ce1c5616f86", // Magic Classical (ex-Scala)
  // Global (Capital / Heart / Smooth / Classic / Gold / LBC / Radio X).
  "038bfc04-cebb-4fc7-ac13-823b83c8a9d9", // Capital FM London
  "bee4aa5e-e55c-499d-9bbd-75ad1b9c76b9", // Capital Dance
  "d1bc420f-6aaa-426b-a810-b496622717d6", // Capital XTRA
  "4ad5bdc7-01e5-47c9-a1f9-751671b4707e", // Capital
  "42679ed6-49cb-428e-9b74-94af62ad8a0a", // Heart FM
  "c4077677-dc2f-11e9-a8ba-52543be04c81", // Heart 80s
  "702a65d7-3fec-405d-b224-b6c47b87c407", // Heart 70s
  "52bb00fe-dc31-11e9-a8ba-52543be04c81", // Heart 90s
  "ea5d9964-6b60-4f75-a95d-2bc5217d245b", // Heart 00s
  "fa76f16f-dc31-11e9-a8ba-52543be04c81", // Heart Dance
  "962b27a3-0601-11e8-ae97-52543be04c81", // Smooth Radio (http row, plays via the https-upgrade allowlist)
  "478fd7f4-dc36-11e9-a8ba-52543be04c81", // Smooth Chill
  "bd1c441c-132a-4d48-a3f3-bdb386f4b09a", // Classic FM HD
  "0a1e0bb0-dc37-11e9-a8ba-52543be04c81", // Gold
  "172d8c95-fecd-40b7-af6f-9cdf4e8829e4", // Magic Radio UK
  "8e32c763-b926-4e57-9b8f-d60f1c5b48e3", // LBC News
  "9f5d0645-ae1e-4e9f-9b2f-91fa63d5b1fa", // TalkSPORT
  "9617bbd8-0601-11e8-ae97-52543be04c81", // Radio X (http row, plays via the https-upgrade allowlist)
  // News UK + independent (all https; Times and Virgin 301 to *.live.stream.broadcasting.news).
  "00a8642f-98b2-4cd7-86f9-53f6dfaba63c", // Virgin Radio
  "05d6f5d1-827c-4cc4-8845-175bc33af435", // Times Radio
  "fecf5be0-e69b-46fa-9a47-0029ae4849e0", // talkSPORT 2
  "695da448-1840-4e4f-adda-57d699900b58", // Boom Radio
  "d835e8dc-a3cd-490b-9881-fa5c7b1c2280", // Sunrise Radio
];
