var fs = require('fs');

// Capture the env var at --require time and write it to a result file.
// PM2_REQUIRE_RESULT_FILE tells us where to write, so cluster and fork
// tests can share this fixture without colliding.
var resultFile = process.env.PM2_REQUIRE_RESULT_FILE;
if (resultFile) {
  fs.writeFileSync(
    resultFile,
    JSON.stringify({ value: process.env.PM2_TEST_REQUIRE_VAR || null })
  );
}
