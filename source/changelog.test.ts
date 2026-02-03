import * as core from "@actions/core";
import { expect } from "chai";
import { it } from "mocha";
import { parseCommit } from "./changelog.js";
import type { CommitSinceRelease } from "./types.js";

it("parses commits as expected", () => {
  const result = parseCommit(core, {
    commit: { message: "feat!: Something crazy" },
  } as CommitSinceRelease);
  expect(result?.notes.some(_ => _.title === "BREAKING CHANGE")).to.be.true;
});
