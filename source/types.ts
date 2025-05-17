import core from "@actions/core";
import { Context } from "@actions/github/lib/context.js";
import { type GitHub } from "@actions/github/lib/utils.js";
import { GetResponseDataTypeFromEndpointMethod } from "@octokit/types";
import { CommitMeta, CommitNote, CommitReference } from "conventional-commits-parser";

/**
 * Type of the GitHub core.
 */
export type CoreType = typeof core;

/**
 * The type of the API response for creating a new release.
 */
export type NewGitHubRelease = GetResponseDataTypeFromEndpointMethod<
  InstanceType<typeof GitHub>["rest"]["repos"]["createRelease"]
>;
/**
 * The type of the API response for comparing commits.
 */
export type CommitsSinceRelease = GetResponseDataTypeFromEndpointMethod<
  InstanceType<typeof GitHub>["rest"]["repos"]["compareCommits"]
>["commits"];
export type CommitSinceRelease = CommitsSinceRelease[number];
/**
 * The type of the API response for comparing commits.
 */
export type CompareCommitsItem = GetResponseDataTypeFromEndpointMethod<
  InstanceType<typeof GitHub>["rest"]["repos"]["compareCommits"]
>["commits"][number];
/**
 * The type of the API response for listing PRs.
 */
export type PullRequestsAssociatedWithCommit = GetResponseDataTypeFromEndpointMethod<
  InstanceType<typeof GitHub>["rest"]["repos"]["listPullRequestsAssociatedWithCommit"]
>;

/**
 * The arguments for the action.
 * Keep these in sync with the parameter declaration in 'action.yml' and 'getAndValidateArgs'.
 */
export interface ActionParameters {
  /**
   * The git tag associated with this automatic release.
   */
  automaticReleaseTag: string;

  /**
   * A prefix for the release body.
   */
  bodyPrefix: string;

  /**
   * A suffix for the release body.
   */
  bodySuffix: string;

  /**
   * Name for the changelog metadata artifact.
   */
  changelogArtifact: string;

  /**
   * Is this still a draft?
   */
  draftRelease: boolean;

  /**
   * If enabled, no tags will be moved.
   */
  dryRun: boolean;

  /**
   * Files to put into the release.
   */
  files: Array<string>;

  /**
   * If enabled, similar changes will be grouped in the changelog.
   */
  mergeSimilar: boolean;

  /**
   * Is this a pre-release?
   */
  preRelease: boolean;

  /**
   * Should we actually publish a release?
   */
  publish: boolean;

  /**
   * The current version of the project.
   */
  rootVersion: string;

  /**
   * Title of the release.
   */
  title: string;

  /**
   * If enabled, render the names of commit authors, instead of the commit hash.
   */
  withAuthors: boolean;
}

/**
 * The construction options for the action.
 */
export interface AutomaticReleasesOptions {
  /**
   * The execution context.
   */
  context: Context;

  /**
   * Instance of the GitHub core module.
   */
  core: typeof core;

  /**
   * Instance of OctoKit to use for API operations.
   */
  octokit: InstanceType<typeof GitHub>;
}

/**
 * Information about a tag.
 */
export interface TagInfo extends Record<string, string> {
  /**
   * Owner of the repository.
   */
  owner: string;

  /**
   * Name of the repository.
   */
  repo: string;
}

/**
 * Information about a tag reference.
 */
export interface TagRefInfo extends Record<string, string> {
  /**
   * Owner of the repository.
   */
  owner: string;

  /**
   * Name of the repository.
   */
  repo: string;

  /**
   * Git reference.
   */
  ref: string;
}

/**
 * Information about a git reference.
 */
export interface RefInfo extends Record<string, string> {
  /**
   * Owner of the repository.
   */
  owner: string;

  /**
   * Name of the repository.
   */
  repo: string;

  /**
   * SHA of the commit to tag.
   */
  sha: string;

  /**
   * Git reference.
   */
  ref: string;
}

/**
 * Information about a GitHub release.
 */
export interface ReleaseInfo extends Record<string, string> {
  /**
   * Owner of the repository.
   */
  owner: string;

  /**
   * Name of the repository.
   */
  repo: string;

  /**
   * Tag the release points to.
   */
  tag: string;
}

/**
 * Extended information about a GitHub release.
 */
export interface ReleaseInfoFull extends Record<string, string | boolean> {
  /**
   * Owner of the repository.
   */
  owner: string;

  /**
   * Name of the repository.
   */
  repo: string;

  /**
   * Name of the tag.
   */
  tag_name: string;

  /**
   * Tag reference.
   */
  name: string;

  /**
   * Is this a draft?
   */
  draft: boolean;

  /**
   * Is this a pre-release?
   */
  prerelease: boolean;

  /**
   * Text of the release.
   */
  body: string;
}

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

export const ConventionalCommitTypes = {
  feat: "Features",
  fix: "Bug Fixes",
  docs: "Documentation",
  style: "Styles",
  refactor: "Code Refactoring",
  perf: "Performance Improvements",
  test: "Tests",
  build: "Builds",
  ci: "Continuous Integration",
  chore: "Chores",
  revert: "Reverts",
};
/**
 * Just the identifiers.
 */
export type ConventionalCommitType = keyof typeof ConventionalCommitTypes;

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
  type: keyof typeof ConventionalCommitTypes;

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

/**
 * Describes the metadata of a changelog.
 */
export interface Changelog
  extends Record<keyof typeof ConventionalCommitTypes, Array<ParsedCommit>> {
  /**
   * Breaking Changes
   */
  breakingChanges: Array<ParsedCommit>;

  /**
   * Dependency Changes
   */
  deps: Record<keyof typeof ConventionalCommitTypes, Array<ParsedCommit>>;

  /**
   * All commits.
   */
  commits: Array<ParsedCommit>;

  /**
   * Non-Conventional Commits
   */
  unconventional: Array<ParsedCommit>;
}
