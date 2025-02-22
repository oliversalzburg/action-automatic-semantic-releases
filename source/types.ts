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
 * The arguments for the action.
 */
export interface ActionParameters {
  /**
   * The git tag associated with this automatic release.
   */
  automaticReleaseTag: string;

  /**
   * A prefix for the release body.
   */
  bodyPrefix?: string;

  /**
   * A suffix for the release body.
   */
  bodySuffix?: string;

  /**
   * Is this still a draft?
   */
  draftRelease: boolean;

  /**
   * Is this a pre-release?
   */
  preRelease: boolean;

  /**
   * Title of the release.
   */
  releaseTitle: string;

  /**
   * Files to put into the release.
   */
  files: Array<string>;

  /**
   * If enabled, no tags will be moved.
   */
  dryRun: boolean;

  /**
   * If enabled, similar changes will be grouped in the changelog.
   */
  mergeSimilar: boolean;

  /**
   * If enabled, render the names of commit authors, instead of the commit hash.
   */
  withAuthors: boolean;
}

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
