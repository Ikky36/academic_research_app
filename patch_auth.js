const fs = require('fs');

async function patch() {
  const res = await fetch('https://api.supabase.com/v1/projects/dlwwrwwarmflxknynfvk/config/auth', {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer sbp_5348d3b208a1e94f1d447aaa2822e977d95e29ed',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      external_google_enabled: true,
      external_google_client_id: "284714742779-9pi6liivpn83bulk77na0m4is36c033k.apps.googleusercontent.com",
      external_google_secret: "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"
    })
  });
  console.log(res.status, await res.text());
}
patch();
