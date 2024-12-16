import * as core from "@actions/core";
import { type GitHub } from "@actions/github/lib/utils.js";
import { GetResponseDataTypeFromEndpointMethod } from "@octokit/types";
import { CommitMeta, CommitNote, CommitReference } from "conventional-commits-parser";
import { CommitsSinceRelease } from "./AutomaticReleases.js";

/**
 * Shortens a SHA hash.
 * @param sha - The full SHA.
 * @returns The shortened hash.
 */
export const getShortSHA = (sha: string): string => {
  const coreAbbrev = 7;
  return sha.substring(0, coreAbbrev);
};

/**
 * The type of the API response for comparing commits.
 */
export type CompareCommitsItem = GetResponseDataTypeFromEndpointMethod<
  InstanceType<typeof GitHub>["rest"]["repos"]["compareCommits"]
>["commits"][number];

/**
 * The type of a parsed commit.
 */
export type ParsedCommitsExtraCommit = CompareCommitsItem & {
  author: {
    email: string;
    name: string;
    username: string;
  } | null;
  committer: {
    email: string;
    name: string;
    username: string;
  };
  distinct: boolean;
  id: string;
  message: string;
  timestamp: string;
  tree_id: string;
  url: string;
};

/**
 * Additional parts of a parsed commit.
 */
export interface ParsedCommitsExtra {
  /**
   * Metadata about the commit itself.
   */
  commit: CommitsSinceRelease[number];

  /**
   * Pull requests this commit is associated with.
   */
  pullRequests: Array<{
    number: number;
    url: string;
  }>;

  /**
   * Is this commit a breaking change?
   */
  breakingChange: boolean;
}

export enum ConventionalCommitTypes {
  feat = "Features",
  fix = "Bug Fixes",
  docs = "Documentation",
  style = "Styles",
  refactor = "Code Refactoring",
  perf = "Performance Improvements",
  test = "Tests",
  build = "Builds",
  ci = "Continuous Integration",
  chore = "Chores",
  revert = "Reverts",
}

/**
 * Relevant information about a commit.
 */
export interface ParsedCommit {
  /**
   * The hash of this commit.
   */
  sha: string;

  /**
   * The conventional commit type.
   */
  type: ConventionalCommitTypes;

  /**
   * The conventional commit scope.
   */
  scope: string;

  /**
   * The subject.
   */
  subject: string;

  /**
   * Merge commit?
   */
  merge: string;

  /**
   * Header.
   */
  header: string;

  /**
   * Body.
   */
  body: string;

  /**
   * Footer.
   */
  footer: string;

  /**
   * Additional notes.
   */
  notes: Array<CommitNote>;

  /**
   * Extras.
   */
  extra: ParsedCommitsExtra;

  /**
   * References to other commits.
   */
  references: Array<CommitReference>;

  /**
   * Pings to other users.
   */
  mentions: Array<string>;

  /**
   * Is this a revert of another commit?
   */
  revert: CommitMeta | null;
}

const getFormattedChangelogEntry = (parsedCommit: ParsedCommit, withAuthors: boolean): string => {
  let entry = "";

  const url = parsedCommit.extra.commit.html_url;
  const sha = getShortSHA(parsedCommit.extra.commit.sha);
  const author = parsedCommit.extra.commit.commit.author?.name ?? "<unknown author>";

  let prString = "";
  prString = parsedCommit.extra.pullRequests.reduce((acc, pr) => {
    // e.g. #1
    // e.g. #1,#2
    // e.g. ''
    if (acc) {
      acc += ",";
    }
    return `${acc}[#${pr.number.toString()}](${pr.url})`;
  }, "");
  if (prString) {
    prString = " " + prString;
  }

  const scopeStr = parsedCommit.scope ? `**${parsedCommit.scope}**: ` : "";
  entry = `- ${scopeStr}${parsedCommit.subject}${prString} ([${withAuthors ? author : sha}](${url}))`;

  return entry;
};

/**
 * Generates a changelog for a given set of commits.
 * @param parsedCommits - The commit for which to generate the changelog.
 * @param withAuthors - If enabled, render the names of commit authors, instead of the commit hash.
 * @param mergeSimilar - If enabled, similar changes will be groups in the changelog.
 * @returns The final changelog.
 */
export const generateChangelogFromParsedCommits = (
  parsedCommits: Array<ParsedCommit>,
  withAuthors: boolean,
  mergeSimilar: boolean,
): string => {
  let changelog = "";

  const commitsWithoutDeps = parsedCommits.filter(commit => commit.scope !== "deps");
  const commitsDeps = parsedCommits.filter(commit => commit.scope === "deps");

  // Breaking Changes
  const breaking = parsedCommits
    .filter(val => val.extra.breakingChange)
    .sort((a, b) => a.header.localeCompare(b.header))
    .map(val => getFormattedChangelogEntry(val, withAuthors));
  if (breaking.length) {
    changelog += "## Breaking Changes\n";
    changelog += breaking.join("\n").trim();
  }

  for (const key of Object.keys(ConventionalCommitTypes) as Array<
    keyof typeof ConventionalCommitTypes
  >) {
    const commits = commitsWithoutDeps
      .filter(val => val.type === (key as ConventionalCommitTypes))
      .sort((a, b) => a.header.localeCompare(b.header));

    const clBlock = [];
    let lastCommitMessage: undefined | string;
    let groupedCommitsCache;
    for (const commit of commits) {
      if (mergeSimilar && lastCommitMessage === commit.header) {
        groupedCommitsCache = groupedCommitsCache ? [...groupedCommitsCache, commit] : [commit];
        continue;
      }

      if (groupedCommitsCache && 0 < groupedCommitsCache.length) {
        clBlock.push(`- ${groupedCommitsCache.map(commit => commit.sha).join(", ")}`);
      }

      const message = getFormattedChangelogEntry(commit, withAuthors);
      clBlock.push(message);

      lastCommitMessage = commit.header;
    }

    if (clBlock.length) {
      changelog += `\n\n## ${ConventionalCommitTypes[key]} (${clBlock.length})\n`;
      changelog += clBlock.join("\n").trim();
    }
  }

  if (commitsDeps.length) {
    changelog += `\n\n## Dependency Changes (${commitsDeps.length})\n`;

    for (const key of Object.keys(ConventionalCommitTypes) as Array<
      keyof typeof ConventionalCommitTypes
    >) {
      const clBlock = commitsDeps
        .filter(val => val.type === (key as ConventionalCommitTypes))
        .sort((a, b) => a.header.localeCompare(b.header))
        .map(val => getFormattedChangelogEntry(val, withAuthors));
      if (clBlock.length) {
        changelog += `\n<details>\n`;
        changelog += `<summary>${ConventionalCommitTypes[key]} (${clBlock.length})</summary>\n\n`;
        changelog += clBlock.join("\n").trim();
        changelog += `\n</details>\n`;
      }
    }
  }

  // Commits
  const commitsBlock = commitsWithoutDeps
    .filter(val => !Object.keys(ConventionalCommitTypes).includes(val.type))
    .map(val => getFormattedChangelogEntry(val, withAuthors));
  if (commitsBlock.length) {
    changelog += "\n\n## Commits without convention\n";
    changelog += commitsBlock.join("\n").trim();
  }

  return changelog.trim();
};

/**
 * Determine whether the given commit is a breaking change.
 * @param commit - The commit metadata.
 * @returns Whether the commit signifies a breaking change.
 */
export const isBreakingChange = (commit: CommitMeta): boolean => {
  const re = /^BREAKING\s+CHANGES?:\s+/;
  return re.test(commit.body || "") || re.test(commit.footer || "");
};

/**
 * Retrieve the name of a tag from its git reference.
 * @param inputRef - The git reference.
 * @returns The name of the tag.
 */
export const parseGitTag = (inputRef: string): string => {
  const re = /^(refs\/)?tags\/(.*)$/;
  const resMatch = inputRef.match(re);
  if (!resMatch?.[2]) {
    core.debug(`Input "${inputRef}" does not appear to be a tag`);
    return "";
  }
  return resMatch[2];
};

/**
 * Retrieve the default changelog options.
 * @returns The default changelog options.
 */
export const getChangelogOptions = () => {
  const defaultOpts = {
    headerPattern: /^(\w*)(?:\((.*)\))?: (.*)$/,
    headerCorrespondence: ["type", "scope", "subject"],
    noteKeywords: ["BREAKING CHANGE"],
    mergePattern: /^Merge pull request #(.*) from (.*)$/,
    mergeCorrespondence: ["issueId", "source"],
    revertPattern: /^(?:Revert|revert:)\s"?([\s\S]+?)"?\s*This reverts commit (\w{7,40})\b/i,
    revertCorrespondence: ["header", "hash"],
  };
  core.debug(`Changelog options: ${JSON.stringify(defaultOpts)}`);
  return defaultOpts;
};

/**
 * Convert the given arguments so that we can log them safely through OctoKit.
 * @param args - Arguments to log.
 * @returns A string that can safely be logged.
 */
export const octokitLogger = (
  ...args: Array<string | Record<string, unknown> | undefined>
): string => {
  return args
    .filter(arg => arg !== undefined)
    .map(arg => {
      if (typeof arg === "string") {
        return arg;
      }

      const argCopy = { ...arg };

      // Do not log file buffers
      if (argCopy.file) {
        argCopy.file = "== raw file buffer info removed ==";
      }
      if (argCopy.data) {
        argCopy.data = "== raw file buffer info removed ==";
      }

      return JSON.stringify(argCopy);
    })
    .reduce((acc, val) => `${acc} ${val}`, "");
};
