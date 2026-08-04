import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("workflow smoke script requires explicit configuration before it can send data", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ["scripts/smoke-workflow.mjs"], {
      cwd: new URL("..", import.meta.url),
      env: {...process.env, THESEUS_ACCESS_TOKEN: "ths_int_test-token-value"},
    }),
    (error) => {
      assert.match(error.stderr, /THESEUS_BASE_URL must be set/);
      assert(!error.stderr.includes("ths_int_test-token-value"));
      return true;
    },
  );
});
