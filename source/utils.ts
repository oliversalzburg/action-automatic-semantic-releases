import { type GitHub } from "@actions/github/lib/utils.js";
import { GetResponseDataTypeFromEndpointMethod } from "@octokit/types";
import { mustExist } from "@oliversalzburg/js-utils/data/nil.js";
import semverLt from "semver/functions/lt.js";
import semverRcompare from "semver/functions/rcompare.js";
import semverValid from "semver/functions/valid.js";
import {
  ActionParameters,
  CommitsSinceRelease,
  CoreType,
  NewGitHubRelease,
  RefInfo,
  ReleaseInfo,
  ReleaseInfoFull,
  TagInfo,
  TagRefInfo,
} from "./types.js";

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
 * Validates the given arguments for the action and returns them.
 * @param core - GitHub core to use.
 * @returns The validated arguments for the action.
 */
export const getAndValidateArgs = (core: CoreType): ActionParameters => {
  const args = {
    automaticReleaseTag: core.getInput("automatic_release_tag", {
      required: false,
    }),
    bodyPrefix: core.getInput("body_prefix", { required: false }),
    bodySuffix: core.getInput("body_suffix", { required: false }),
    changelogArtifact: core.getInput("changelog_artifact", { required: false }),
    draftRelease: core.getBooleanInput("draft", { required: false }),
    dryRun: core.getBooleanInput("dry_run", { required: false }),
    files: [] as Array<string>,
    mergeSimilar: core.getBooleanInput("merge_similar", { required: false }),
    preRelease: core.getBooleanInput("prerelease", { required: false }),
    publish: core.getBooleanInput("publish", { required: false }),
    rootVersion: core.getInput("title", { required: false }),
    title: core.getInput("title", { required: false }),
    withAuthors: core.getBooleanInput("with_authors", { required: false }),
  };

  const inputFilesStr = core.getInput("files", { required: false });
  if (inputFilesStr) {
    args.files = inputFilesStr.split(/\r?\n/);
  }

  return args;
};

/**
 * Retrieve the name of a tag from its git reference.
 * @param core - GitHub core to use.
 * @param inputRef - The git reference.
 * @returns The name of the tag.
 */
export const parseGitTag = (core: CoreType, inputRef: string): string => {
  const re = /^(refs\/)?tags\/(.*)$/;
  const resMatch = inputRef.match(re);
  if (!resMatch?.[2]) {
    core.debug(`Input "${inputRef}" does not appear to be a tag`);
    return "";
  }
  return resMatch[2];
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

/**
 * Find the tag for the previous release, if any.
 * @param core - GitHub core to use.
 * @param client - The API client to use.
 * @param currentReleaseTag - The current release tag.
 * @param tagInfo - Information about the tag.
 * @returns The previous release tag.
 */
export const searchForPreviousReleaseTag = async (
  core: CoreType,
  client: InstanceType<typeof GitHub>,
  currentReleaseTag: string,
  tagInfo: TagInfo,
): Promise<string> => {
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
};

/**
 * Determine the commits that have been pushed to the repo since the last release.
 * @param core - GitHub core to use.
 * @param client - The API client to use.
 * @param tagInfo - Information about the tag reference.
 * @param currentSha - The current commit SHA.
 * @returns The commits since the last release.
 */
export const getCommitsSinceRelease = async (
  core: CoreType,
  client: InstanceType<typeof GitHub>,
  tagInfo: TagRefInfo,
  currentSha: string,
): Promise<CommitsSinceRelease> => {
  core.startGroup("Retrieving commit history");

  core.info("Determining state of the previous release");
  let previousReleaseRef = "" as string;
  core.info(`Searching for SHA corresponding to previous "${tagInfo.ref}" release tag`);
  try {
    await client.rest.git.getRef(tagInfo);
    previousReleaseRef = parseGitTag(core, tagInfo.ref);
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
};

/**
 * Create a release tag.
 * @param core - GitHub core to use.
 * @param client - The API client to use.
 * @param refInfo - The information for the tag to create.
 */
export const createReleaseTag = async (
  core: CoreType,
  client: InstanceType<typeof GitHub>,
  refInfo: RefInfo,
): Promise<void> => {
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
};

/**
 * Delete the previous release.
 * @param core - GitHub core to use.
 * @param client - The API client to use.
 * @param releaseInfo - Information about the release.
 */
export const deletePreviousGitHubRelease = async (
  core: CoreType,
  client: InstanceType<typeof GitHub>,
  releaseInfo: ReleaseInfo,
) => {
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
      `Could not find release associated with tag "${releaseInfo.tag}" (${(err as Error).message})`,
    );
  }
  core.endGroup();
};

/**
 * Create a new GitHub release.
 * @param core - GitHub core to use.
 * @param client - The API client to use.
 * @param releaseInfo - Information about the release.
 * @returns The response from the GitHub API.
 */
export const generateNewGitHubRelease = async (
  core: CoreType,
  client: InstanceType<typeof GitHub>,
  releaseInfo: ReleaseInfoFull,
): Promise<NewGitHubRelease> => {
  core.startGroup(`Generating new GitHub release for the "${releaseInfo.tag_name}" tag`);

  core.info("Creating new release");
  const resp = await client.rest.repos.createRelease(releaseInfo);
  core.endGroup();
  return resp.data;
};
