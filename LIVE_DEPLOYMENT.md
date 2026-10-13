# Live deployment — v3.2.1

The existing Google Sheets / Apps Script project was updated on 11 October 2026. Deployment version 19 serves application v3.2.1 at the retained URL:

https://script.google.com/macros/s/AKfycbyGZpPdDNpe3ddA6uzmg6AYdqLvrB-29B3mnTotCZyRJtlRbNuBADr7kiyoZgM-8J777A/exec

The final read-only server check succeeded. Existing accounts, credentials, API key, event records and job history were retained. The endpoint URL/status are configured. Firmware schema remains 2.

The v3.2.1 repair opens a separate HTTPS live-camera scanner, validates its QR return messages, and adds a copy/paste fallback. The companion is deployed privately at https://qc-camera-scanner.proudaphid4.chatgpt.site and still needs an explicit audience change for operator access without ChatGPT sign-in. See CAMERA_FIX.md.

The actual phone/ESP32 checks and signed-in dashboard visual review remain to be performed. The saved package includes local regression tests, persisted-source checksums, a credential-free backend check and the pre-upgrade source backup. Multi-person account promotion/reset approvals remain outside this implementation; current account permissions are unchanged.
