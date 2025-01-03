import core from "@actions/core";
import { Context } from "@actions/github/lib/context.js";
import { type GitHub } from "@actions/github/lib/utils.js";
import { GetResponseDataTypeFromEndpointMethod } from "@octokit/types";
import { mustExist } from "@oliversalzburg/js-utils/data/nil.js";
import { Commit, CommitParser } from "conventional-commits-parser";
import semverLt from "semver/functions/lt.js";
import semverRcompare from "semver/functions/rcompare.js";
import semverValid from "semver/functions/valid.js";
import { uploadReleaseArtifacts } from "./uploadReleaseArtifacts.js";
import {
  ConventionalCommitTypes,
  ParsedCommit,
  generateChangelogFromParsedCommits,
  getChangelogOptions,
  isBreakingChange,
  parseGitTag,
} from "./utils.js";

interface RefInfo extends Record<string, string> {
  /**
   * The owner of the repo.
   */
  owner: string;
  /**
   * The name of the repo.
   */
  repo: string;
  /**
   * The SHA of the commit to tag.
   */
  sha: string;
  /**
   *
   */
  ref: string;
}

interface ReleaseInfo extends Record<string, string> {
  tag: string;
  owner: string;
  repo: string;
}

interface ReleaseInfoFull extends Record<string, string | boolean> {
  owner: string;
  repo: string;
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  body: string;
}

interface TagInfo extends Record<string, string> {
  owner: string;
  repo: string;
}

interface TagRefInfo extends Record<string, string> {
  owner: string;
  repo: string;
  ref: string;
}

/**
 * The arguments for the action.
 */
export interface Args {
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
 * The automatic releases action.
 */
export class AutomaticReleases {
  #options: AutomaticReleasesOptions;

  /**
   * Constructs a new instance of the action.
   * @param options - The options for the action.
   */
  constructor(options: AutomaticReleasesOptions) {
    this.#options = options;
  }

  /**
   * Execute the action.
   */
  async main() {
    const { context, core, octokit } = this.#options;

    const args = this.getAndValidateArgs();

    core.startGroup("Initializing the Automatic Releases action");
    core.debug(`Github context: ${JSON.stringify(context)}`);
    core.endGroup();

    core.startGroup("Determining release tags");
    const releaseTag = args.automaticReleaseTag
      ? args.automaticReleaseTag
      : parseGitTag(context.ref);
    if (!releaseTag) {
      throw new Error(
        `The parameter "automatic_release_tag" was not set and this does not appear to be a GitHub tag event. (Event: ${context.ref})`,
      );
    }

    const previousReleaseTag = args.automaticReleaseTag
      ? args.automaticReleaseTag
      : await this.searchForPreviousReleaseTag(octokit, releaseTag, {
          owner: context.repo.owner,
          repo: context.repo.repo,
        });
    core.endGroup();

    const commitsSinceRelease: CommitsSinceRelease = await this.getCommitsSinceRelease(
      octokit,
      {
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: `tags/${previousReleaseTag}`,
      },
      context.sha,
    );

    const changelog = await this.getChangelog(
      octokit,
      context.repo.owner,
      context.repo.repo,
      commitsSinceRelease,
      args.withAuthors,
      args.mergeSimilar,
    );

    if (args.automaticReleaseTag && !args.dryRun) {
      await this.createReleaseTag(octokit, {
        owner: context.repo.owner,
        ref: `refs/tags/${args.automaticReleaseTag}`,
        repo: context.repo.repo,
        sha: context.sha,
      });

      await this.deletePreviousGitHubRelease(octokit, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        tag: args.automaticReleaseTag,
      });
    }

    const tagName = releaseTag + (args.dryRun ? `-${new Date().getTime()}` : "");
    let body = `${args.bodyPrefix ? args.bodyPrefix + "\n" : ""}${changelog}${args.bodySuffix ? "\n" + args.bodySuffix : ""}`;
    if (125000 < body.length) {
      core.warning(
        `Release body exceeds 125000 characters! Actual length: ${body.length}. Body will be truncated.`,
      );
      body = body.substring(0, 125000 - 1);
    }
    const release = await this.generateNewGitHubRelease(octokit, {
      owner: context.repo.owner,
      repo: context.repo.repo,
      tag_name: tagName,
      name: args.releaseTitle ? args.releaseTitle : releaseTag,
      draft: args.draftRelease,
      prerelease: args.preRelease,
      body,
    });

    await uploadReleaseArtifacts(octokit, context, release, args.files);

    core.debug(`Exporting environment variable AUTOMATIC_RELEASES_TAG with value ${tagName}`);
    core.exportVariable("AUTOMATIC_RELEASES_TAG", tagName);
    core.setOutput("automatic_releases_tag", tagName);
    core.setOutput("upload_url", release.upload_url);
  }

  /**
   * Validates the given arguments for the action and returns them.
   * @returns The validated arguments for the action.
   */
  getAndValidateArgs(): Args {
    const args = {
      automaticReleaseTag: core.getInput("automatic_release_tag", {
        required: false,
      }),
      bodyPrefix: core.getInput("body_prefix", { required: false }),
      bodySuffix: core.getInput("body_suffix", { required: false }),
      draftRelease: core.getBooleanInput("draft", { required: true }),
      preRelease: core.getBooleanInput("prerelease", { required: true }),
      releaseTitle: core.getInput("title", { required: false }),
      files: [] as Array<string>,
      dryRun: core.getBooleanInput("dry_run", { required: false }),
      mergeSimilar: core.getBooleanInput("merge_similar", { required: false }),
      withAuthors: core.getBooleanInput("with_authors", { required: false }),
    };

    const inputFilesStr = core.getInput("files", { required: false });
    if (inputFilesStr) {
      args.files = inputFilesStr.split(/\r?\n/);
    }

    return args;
  }

  /**
   * Create a release tag.
   * @param client - The API client to use.
   * @param refInfo - The information for the tag to create.
   */
  async createReleaseTag(client: InstanceType<typeof GitHub>, refInfo: RefInfo): Promise<void> {
    core.startGroup("Generating release tag");
    const friendlyTagName = refInfo.ref.substring(10); // 'refs/tags/latest' => 'latest'
    core.info(`Attempting to create or update release tag "${friendlyTagName}"`);

    try {
      await client.rest.git.createRef(refInfo);
    } catch (err) {
      const existingTag = refInfo.ref.substring(5); // 'refs/tags/latest' => 'tags/latest'
      core.info(
        `Could not create new tag "${refInfo.ref}" (${
          (err as Error).message
        }) therefore updating existing tag "${existingTag}"`,
      );
      await client.rest.git.updateRef({
        ...refInfo,
        ref: existingTag,
        force: true,
      });
    }

    core.info(`Successfully created or updated the release tag "${friendlyTagName}"`);
    core.endGroup();
  }

  /**
   * Delete the previous release.
   * @param client - The API client to use.
   * @param releaseInfo - Information about the release.
   */
  async deletePreviousGitHubRelease(client: InstanceType<typeof GitHub>, releaseInfo: ReleaseInfo) {
    core.startGroup(`Deleting GitHub releases associated with the tag "${releaseInfo.tag}"`);
    try {
      core.info(`Searching for releases corresponding to the "${releaseInfo.tag}" tag`);
      const resp = await client.rest.repos.getReleaseByTag(releaseInfo);

      core.info(`Deleting release: ${resp.data.id.toString()}`);
      await client.rest.repos.deleteRelease({
        owner: releaseInfo.owner,
        repo: releaseInfo.repo,
        release_id: resp.data.id,
      });
    } catch (err) {
      core.info(
        `Could not find release associated with tag "${releaseInfo.tag}" (${
          (err as Error).message
        })`,
      );
    }
    core.endGroup();
  }

  /**
   * Create a new GitHub release.
   * @param client - The API client to use.
   * @param releaseInfo - Information about the release.
   * @returns The response from the GitHub API.
   */
  async generateNewGitHubRelease(
    client: InstanceType<typeof GitHub>,
    releaseInfo: ReleaseInfoFull,
  ): Promise<NewGitHubRelease> {
    core.startGroup(`Generating new GitHub release for the "${releaseInfo.tag_name}" tag`);

    core.info("Creating new release");
    const resp = await client.rest.repos.createRelease(releaseInfo);
    core.endGroup();
    return resp.data;
  }

  /**
   * Find the tag for the previous release, if any.
   * @param client - The API client to use.
   * @param currentReleaseTag - The current release tag.
   * @param tagInfo - Information about the tag.
   * @returns The previous release tag.
   */
  async searchForPreviousReleaseTag(
    client: InstanceType<typeof GitHub>,
    currentReleaseTag: string,
    tagInfo: TagInfo,
  ): Promise<string> {
    const validSemver = semverValid(currentReleaseTag);
    if (!validSemver) {
      throw new Error(
        `The parameter "automatic_release_tag" was not set and the current tag "${currentReleaseTag}" does not appear to conform to semantic versioning.`,
      );
    }

    const tl = await client.paginate(client.rest.repos.listTags, tagInfo);

    const tagList = tl
      .map(tag => {
        core.debug(`Currently processing tag ${tag.name}`);
        const t = semverValid(tag.name);
        return {
          ...tag,
          semverTag: t,
        };
      })
      .filter(tag => tag.semverTag !== null)
      .sort((a, b) => semverRcompare(mustExist(a.semverTag), mustExist(b.semverTag)));

    let previousReleaseTag = "";
    for (const tag of tagList) {
      if (semverLt(mustExist(tag.semverTag), currentReleaseTag)) {
        previousReleaseTag = tag.name;
        break;
      }
    }

    return previousReleaseTag;
  }

  /**
   * Determine the commits that have been pushed to the repo since the last release.
   * @param client - The API client to use.
   * @param tagInfo - Information about the tag reference.
   * @param currentSha - The current commit SHA.
   * @returns The commits since the last release.
   */
  async getCommitsSinceRelease(
    client: InstanceType<typeof GitHub>,
    tagInfo: TagRefInfo,
    currentSha: string,
  ): Promise<CommitsSinceRelease> {
    core.startGroup("Retrieving commit history");

    core.info("Determining state of the previous release");
    let previousReleaseRef = "" as string;
    core.info(`Searching for SHA corresponding to previous "${tagInfo.ref}" release tag`);
    try {
      await client.rest.git.getRef(tagInfo);
      previousReleaseRef = parseGitTag(tagInfo.ref);
    } catch (err) {
      core.info(
        `Could not find SHA corresponding to tag "${tagInfo.ref}" (${
          (err as Error).message
        }). Assuming this is the first release.`,
      );
      previousReleaseRef = "HEAD";
    }

    let resp:
      | GetResponseDataTypeFromEndpointMethod<
          InstanceType<typeof GitHub>["rest"]["repos"]["compareCommitsWithBasehead"]
        >
      | undefined;
    let commits: CommitsSinceRelease = [];
    core.info(`Retrieving commits between ${previousReleaseRef} and ${currentSha}`);
    try {
      for await (const response of client.paginate.iterator(
        client.rest.repos.compareCommitsWithBasehead,
        {
          owner: tagInfo.owner,
          repo: tagInfo.repo,
          basehead: `${previousReleaseRef}...${currentSha}`,
          per_page: 100,
        },
      )) {
        commits.push(...response.data.commits);
      }
      core.info(
        `Successfully retrieved ${commits.length.toString()} commits between ${previousReleaseRef} and ${currentSha}`,
      );
    } catch (_err) {
      // istanbul ignore next
      core.warning(`Could not find any commits between ${previousReleaseRef} and ${currentSha}`);
    }

    if (resp?.commits) {
      commits = resp.commits;
    }
    core.debug(
      `Currently ${commits.length.toString()} number of commits between ${previousReleaseRef} and ${currentSha}`,
    );

    core.endGroup();
    return commits;
  }

  /**
   * Generates a changelog based on a set of commits.
   * @param client - The API client to use.
   * @param owner - The owner of the repository.
   * @param repo - The name of the repository.
   * @param commits - The commits that have been made.
   * @param withAuthors - If enabled, render the names of commit authors, instead of the commit hash.
   * @param mergeSimilar - If enabled, similar changes will be grouped in the log.
   * @returns The generated changelog.
   */
  async getChangelog(
    client: InstanceType<typeof GitHub>,
    owner: string,
    repo: string,
    commits: CommitsSinceRelease,
    withAuthors: boolean,
    mergeSimilar: boolean,
  ): Promise<string> {
    const parsedCommits: Array<ParsedCommit> = [];
    core.startGroup("Generating changelog");

    for (const commit of commits) {
      core.debug(`Processing commit: ${JSON.stringify(commit)}`);
      core.debug(`Searching for pull requests associated with commit ${commit.sha}`);
      const pulls = await client.rest.repos.listPullRequestsAssociatedWithCommit({
        owner: owner,
        repo: repo,
        commit_sha: commit.sha,
      });
      if (pulls.data.length) {
        core.info(
          `Found ${pulls.data.length.toString()} pull request(s) associated with commit ${commit.sha}`,
        );
      }

      const clOptions = getChangelogOptions();
      const parsedCommitMsg: Exclude<Commit, "type"> & {
        type?: ConventionalCommitTypes | string | null;
      } = new CommitParser(clOptions).parse(commit.commit.message);

      // istanbul ignore next
      if (parsedCommitMsg.merge) {
        core.debug(`Ignoring merge commit: ${parsedCommitMsg.merge}`);
        continue;
      }

      const expandedCommitMsg: ParsedCommit = {
        sha: commit.sha,
        type: parsedCommitMsg.type as ConventionalCommitTypes,
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
          commit: commit,
          pullRequests: [],
          breakingChange: false,
        },
      };

      expandedCommitMsg.extra.pullRequests = pulls.data.map(pr => {
        return {
          number: pr.number,
          url: pr.html_url,
        };
      });

      expandedCommitMsg.extra.breakingChange = isBreakingChange({
        body: parsedCommitMsg.body ?? "",
        footer: parsedCommitMsg.footer ?? "",
      });

      core.debug(`Parsed commit: ${JSON.stringify(parsedCommitMsg)}`);

      parsedCommits.push(expandedCommitMsg);
      core.info(`Adding commit "${mustExist(parsedCommitMsg.header)}" to the changelog`);
    }

    const changelog = generateChangelogFromParsedCommits(parsedCommits, withAuthors, mergeSimilar);
    core.debug("Changelog:");
    core.debug(changelog);

    core.endGroup();
    return changelog;
  }
}
