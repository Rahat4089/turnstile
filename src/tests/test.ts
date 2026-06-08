import { createInterface } from "node:readline";

const API_URL = `http://localhost:8742/cloudflare`;

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

const startTest = async () => {
  try {
    const mode = "iuam";

    const threadsAnswer = await ask("How many threads (concurrent requests)? ");
    const threads = parseInt(threadsAnswer || "1", 10);

    console.log(
      `Testing ${API_URL} in ${mode} mode with ${threads} threads...`,
    );

    const body = {
      mode: "iuam",
      device: "macos",
      url: "https://challenge-endpoint.lusostreams.com/js-challenge",
      // proxy: {
      //   protocol: "http",
      //   host: "core-residential.evomi.com",
      //   port: 1000,
      //   username: "guwalina11",
      //   password: "hjq7gdAEWnnFHrozwVAI_country-IN_hardsession-AC852H45Z",
      // },
    };

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    for (let i = 0; i < threads; i++) {
      promises.push(
        (async (id) => {
          const reqStart = Date.now();
          try {
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
              console.error(
                `[Thread ${id}] ❌ Failed to parse JSON. Raw response content (first 500 chars):\n`,
                responseText.slice(0, 500),
              );
              return { passed: false, duration: parseFloat(duration) };
            }

            console.log(data);
            const duration = data?.elapsed
              ? data.elapsed.replace("s", "")
              : ((Date.now() - reqStart) / 1000).toFixed(2);

            const hasCookie =
              data?.headers?.Cookie || data?.cf_clearance || data?.token;
            if (
              response.status === 200 &&
              (data?.success === true || hasCookie)
            ) {
              console.log(
                `[Thread ${id}] ✅ Passed (${data.elapsed || duration + "s"})`,
              );
              return { passed: true, duration: parseFloat(duration) };
            } else {
              console.log(
                `[Thread ${id}] ❌ Failed (${duration}s): Status ${response.status}`,
              );
              return { passed: false, duration: parseFloat(duration) };
            }
          } catch (error: any) {
            const duration = ((Date.now() - reqStart) / 1000).toFixed(2);
            console.log(
              `[Thread ${id}] ❌ Error (${duration}s): ${error.message}`,
            );
            return { passed: false, duration: parseFloat(duration) };
          }
        })(i + 1),
      );
    }

    const results = await Promise.all(promises);
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const maxDuration = Math.max(...results.map((r) => r.duration));
    const totalDuration =
      threads === 1
        ? maxDuration.toFixed(2)
        : ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n--- Summary ---`);
    console.log(`Total Threads: ${threads}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total Time: ${totalDuration}s`);

    rl.close();
  } catch (error) {
    console.error(error);
    rl.close();
    process.exit(1);
  }
};

startTest();
