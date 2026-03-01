import assert from "node:assert";
import { it } from "node:test";
import * as core from "@actions/core";
import { parseCommit } from "./changelog.js";
import type { CommitSinceRelease } from "./types.js";

it("parses commits as expected", () => {
  const result = parseCommit(core, {
    commit: { message: "feat!: Something crazy" },
  } as CommitSinceRelease);
  assert.strictEqual(
    result?.notes.some(_ => _.title === "BREAKING CHANGE"),
    true,
  );
});
