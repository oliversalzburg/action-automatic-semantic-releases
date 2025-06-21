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
    body: null,
    footer: null,
    header: "Update Crowdin configuration file",
    mentions: [],
    merge: null,
    notes: [],
    references: [],
    revert: null,
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
    body: null,
    footer: null,
    header: "Update Crowdin configuration file",
    mentions: new Array<string>(),
    merge: null,
    notes: new Array<CommitNote>(),
    references: new Array<CommitReference>(),
    revert: null,
    scope: null,
    subject: null,
    type: null,
  };
  const expandedCommitMsg: ParsedCommit = {
    body: parsedCommitMsg.body ?? "",
    extra: {
      breakingChange: false,
      commit: commit as CommitsSinceRelease[number],
      pullRequests: [],
    },
    footer: parsedCommitMsg.footer ?? "",
    header: parsedCommitMsg.header ?? "",
    mentions: parsedCommitMsg.mentions,
    merge: parsedCommitMsg.merge ?? "",
    notes: parsedCommitMsg.notes,
    references: parsedCommitMsg.references,
    revert: parsedCommitMsg.revert ?? null,
    scope: parsedCommitMsg.scope ?? "",
    sha: commit.sha,
    subject: parsedCommitMsg.subject ?? "",
    type: parsedCommitMsg.type as ConventionalCommitType,
  };

  const entry = getFormattedChangelogEntry(expandedCommitMsg, false);
  expect(entry).to.equal(
    "- Update Crowdin configuration file (8f5fd3a938a1162daedf135293e163fba99d07ef)",
  );
});
