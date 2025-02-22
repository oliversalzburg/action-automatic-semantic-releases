import core from "@actions/core";
import { expect } from "chai";
import { CommitBase, CommitNote, CommitParser, CommitReference } from "conventional-commits-parser";
import { it } from "mocha";
import { getChangelogOptions, getFormattedChangelogEntry } from "./changelog.js";
import { CommitsSinceRelease, ConventionalCommitType, ParsedCommit } from "./types.js";

it("parses commits as expected", () => {
  const clOptions = getChangelogOptions(core);

  const parse = (message: string) => new CommitParser(clOptions).parse(message);

  expect(parse("Update Crowdin configuration file")).to.eql({
    merge: null,
    revert: null,
    header: "Update Crowdin configuration file",
    body: null,
    footer: null,
    mentions: [],
    notes: [],
    references: [],
  });
});

it("renders commits without convention as expected", () => {
  const commit = {
    commit: {
      author: {
        name: "Oliver Salzburg",
      },
    },
    html_url:
      "https://github.com/kitten-science/kitten-scientists/commit/8f5fd3a938a1162daedf135293e163fba99d07ef",
    sha: "8f5fd3a938a1162daedf135293e163fba99d07ef",
  };
  const parsedCommitMsg: CommitBase & {
    scope: string | null;
    subject: string | null;
    type: string | null;
  } = {
    merge: null,
    revert: null,
    header: "Update Crowdin configuration file",
    body: null,
    footer: null,
    mentions: new Array<string>(),
    notes: new Array<CommitNote>(),
    references: new Array<CommitReference>(),
    scope: null,
    type: null,
    subject: null,
  };
  const expandedCommitMsg: ParsedCommit = {
    sha: commit.sha,
    type: parsedCommitMsg.type as ConventionalCommitType,
    scope: parsedCommitMsg.scope ?? "",
    subject: parsedCommitMsg.subject ?? "",
    merge: parsedCommitMsg.merge ?? "",
    header: parsedCommitMsg.header ?? "",
    body: parsedCommitMsg.body ?? "",
    footer: parsedCommitMsg.footer ?? "",
    notes: parsedCommitMsg.notes,
    references: parsedCommitMsg.references,
    mentions: parsedCommitMsg.mentions,
    revert: parsedCommitMsg.revert ?? null,
    extra: {
      commit: commit as CommitsSinceRelease[number],
      pullRequests: [],
      breakingChange: false,
    },
  };

  const entry = getFormattedChangelogEntry(expandedCommitMsg, false);
  expect(entry).to.equal(
    "- Update Crowdin configuration file (8f5fd3a938a1162daedf135293e163fba99d07ef)",
  );
});
