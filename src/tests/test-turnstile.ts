const API_URL = process.env.API_URL || `http://localhost:8742/cloudflare`;

const body = {
  mode: "turnstile",
  url: "https://1login.wp.pl/",
  sitekey: "0x4AAAAAAAaystnvZAOebwrA",
};

const runTest = async (id: number) => {
  const reqStart = Date.now();
  try {
    console.log(`[Thread ${id}] Sending request...`);
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      const duration = ((Date.now() - reqStart) / 1000).toFixed(2);
      console.error(`[Thread ${id}] Failed to parse JSON response (${duration}s):`);
      console.error(responseText.slice(0, 500));
      return { passed: false, duration: parseFloat(duration) };
    }

    const duration = data?.elapsed
      ? data.elapsed.replace("s", "")
      : ((Date.now() - reqStart) / 1000).toFixed(2);

    console.log(`[Thread ${id}] Raw response:`, JSON.stringify(data, null, 2));

    if (response.status === 200 && data?.success === true && data?.token) {
      console.log(`[Thread ${id}] PASSED (${data.elapsed || duration + "s"})`);
      console.log(`[Thread ${id}] Token: ${data.token}`);
      return { passed: true, duration: parseFloat(duration) };
    } else {
      console.log(`[Thread ${id}] FAILED (${duration}s): HTTP ${response.status} - ${data?.message ?? "no message"}`);
      return { passed: false, duration: parseFloat(duration) };
    }
  } catch (error: any) {
    const duration = ((Date.now() - reqStart) / 1000).toFixed(2);
    console.log(`[Thread ${id}] ERROR (${duration}s): ${error.message}`);
    return { passed: false, duration: parseFloat(duration) };
  }
};

const threads = parseInt(process.argv[2] || "1", 10);

console.log(`\n=== Turnstile Test ===`);
console.log(`URL:      ${body.url}`);
console.log(`Sitekey:  ${body.sitekey}`);
console.log(`Threads:  ${threads}`);
console.log(`Server:   ${API_URL}`);
console.log(`=====================\n`);

const startTime = Date.now();
const promises = Array.from({ length: threads }, (_, i) => runTest(i + 1));
const results = await Promise.all(promises);

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log(`\n--- Summary ---`);
console.log(`Threads:    ${threads}`);
console.log(`Passed:     ${passed}`);
console.log(`Failed:     ${failed}`);
console.log(`Total Time: ${totalDuration}s`);
