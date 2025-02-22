import * as core from "@actions/core";
import { type GitHub } from "@actions/github/lib/utils.js";
import { GetResponseDataTypeFromEndpointMethod } from "@octokit/types";
import { mustExist } from "@oliversalzburg/js-utils/data/nil.js";
import { Commit, CommitMeta, CommitParser } from "conventional-commits-parser";
import semverLt from "semver/functions/lt.js";
import semverRcompare from "semver/functions/rcompare.js";
import semverValid from "semver/functions/valid.js";
import {
  ActionParameters,
  CommitsSinceRelease,
  ConventionalCommitTypes,
  NewGitHubRelease,
  ParsedCommit,
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
 * @returns The validated arguments for the action.
 */
export const getAndValidateArgs = (): ActionParameters => {
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
};

/**
 * Renders a changelog entry for a given commit.
 * @param parsedCommit - The commit for which to generate the changelog entry.
 * @param withAuthors - Should author names be rendered?
 * @returns The formatted changelog entry.
 */
export const getFormattedChangelogEntry = (
  parsedCommit: ParsedCommit,
  withAuthors: boolean,
): string => {
  let entry = "";

  const url = parsedCommit.extra.commit.html_url;
  const author = parsedCommit.extra.commit.commit.author?.name;

  let prString = parsedCommit.extra.pullRequests.reduce((acc, pr) => {
    // e.g. #1
    // e.g. #1,#2
    // e.g. ''
    if (acc) {
      acc += ",";
    }
    return `${acc}[#${pr.number.toString()}](${pr.url})`;
  }, "");
  if (prString !== "") {
    prString = " " + prString;
  }

  const scopeStr = parsedCommit.scope ? `**${parsedCommit.scope}**: ` : "";
  entry = `- ${scopeStr}${parsedCommit.subject !== "" ? parsedCommit.subject : parsedCommit.header}${prString} (${withAuthors && author ? `[${author}](${url})` : parsedCommit.extra.commit.sha})`;

  return entry;
};

const toGroupable = (header: string) => header.replaceAll(/[a-fA-F0-9]{7,}|\d+/g, "x");

const mergeSimilarCommits = (
  commits: Array<ParsedCommit>,
  withAuthors: boolean,
  onMerge: (commits: Array<ParsedCommit>) => string,
) => {
  const clBlock = [];
  let lastCommitMessage: undefined | string;
  let groupedCommitsCache;
  for (const commit of commits.sort((a, b) => a.header.localeCompare(b.header))) {
    if (lastCommitMessage === toGroupable(commit.header)) {
      groupedCommitsCache = groupedCommitsCache ? [...groupedCommitsCache, commit] : [commit];
      continue;
    }

    if (groupedCommitsCache && 0 < groupedCommitsCache.length) {
      clBlock.push(onMerge(groupedCommitsCache));
      groupedCommitsCache = undefined;
    }

    const message = getFormattedChangelogEntry(commit, withAuthors);
    clBlock.push(message);

    lastCommitMessage = toGroupable(commit.header);
  }

  // Ensure cache is flushed at the end of the list, in case the last item had merges.
  if (groupedCommitsCache && 0 < groupedCommitsCache.length) {
    clBlock.push(onMerge(groupedCommitsCache));
    groupedCommitsCache = undefined;
  }

  return clBlock;
};

const countChanges = (totalCount: number, mergedCount: number) => {
  if (mergedCount === 0) {
    return totalCount.toString();
  }

  return `${totalCount - mergedCount}/+${mergedCount} unlisted`;
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

  // Regular conventional commits
  for (const key of Object.keys(ConventionalCommitTypes) as Array<
    keyof typeof ConventionalCommitTypes
  >) {
    const commits = commitsWithoutDeps
      .filter(val => val.type === (key as ConventionalCommitTypes))
      .sort((a, b) => a.header.localeCompare(b.header));
    let mergedCount = 0;

    const block = mergeSimilar
      ? mergeSimilarCommits(commits, withAuthors, groupedCommitsCache => {
          mergedCount += groupedCommitsCache.length;
          return `<sup>${groupedCommitsCache.length.toString()} similar commit${groupedCommitsCache.length !== 1 ? "s" : ""} not listed: ${groupedCommitsCache.map(commit => commit.sha).join(", ")}</sup>`;
        })
      : commits.map(commit => getFormattedChangelogEntry(commit, withAuthors));

    if (block.length) {
      changelog += `\n\n## ${ConventionalCommitTypes[key]} (${countChanges(commits.length, mergedCount)})\n`;
      changelog += block.join("\n").trim();
    }
  }

  // Dependency Changes
  if (commitsDeps.length) {
    changelog += `\n\n## Dependency Changes\n`;

    for (const key of Object.keys(ConventionalCommitTypes) as Array<
      keyof typeof ConventionalCommitTypes
    >) {
      const commits = commitsDeps
        .filter(val => val.type === (key as ConventionalCommitTypes))
        .sort((a, b) => a.header.localeCompare(b.header));
      let mergedCount = 0;

      const block = mergeSimilar
        ? mergeSimilarCommits(commits, withAuthors, groupedCommitsCache => {
            mergedCount += groupedCommitsCache.length;
            return `<sup>${groupedCommitsCache.length.toString()} similar commit${groupedCommitsCache.length !== 1 ? "s" : ""} not listed: ${groupedCommitsCache.map(commit => commit.sha).join(", ")}</sup>`;
          })
        : commits.map(commit => getFormattedChangelogEntry(commit, withAuthors));

      if (block.length) {
        changelog += `\n<details>\n`;
        changelog += `<summary>${ConventionalCommitTypes[key]} (${countChanges(commits.length, mergedCount)})</summary>\n\n`;
        changelog += block.join("\n").trim();
        changelog += `\n</details>\n`;
      }
    }
  }

  // Commits
  const commits = commitsWithoutDeps.filter(
    val => !Object.keys(ConventionalCommitTypes).includes(val.type),
  );
  let mergedCount = 0;

  const block = mergeSimilar
    ? mergeSimilarCommits(commits, withAuthors, groupedCommitsCache => {
        mergedCount += groupedCommitsCache.length;
        return `<sup>${groupedCommitsCache.length.toString()} similar commit${groupedCommitsCache.length !== 1 ? "s" : ""} not listed: ${groupedCommitsCache.map(commit => commit.sha).join(", ")}</sup>`;
      })
    : commits.map(commit => getFormattedChangelogEntry(commit, withAuthors));

  if (block.length) {
    changelog += `\n\n## Commits without convention (${countChanges(commits.length, mergedCount)})\n`;
    changelog += block.join("\n").trim();
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

/**
 * Find the tag for the previous release, if any.
 * @param client - The API client to use.
 * @param currentReleaseTag - The current release tag.
 * @param tagInfo - Information about the tag.
 * @returns The previous release tag.
 */
export const searchForPreviousReleaseTag = async (
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
 * @param client - The API client to use.
 * @param tagInfo - Information about the tag reference.
 * @param currentSha - The current commit SHA.
 * @returns The commits since the last release.
 */
export const getCommitsSinceRelease = async (
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
};

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
export const getChangelog = async (
  client: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  commits: CommitsSinceRelease,
  withAuthors: boolean,
  mergeSimilar: boolean,
): Promise<string> => {
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
};

/**
 * Create a release tag.
 * @param client - The API client to use.
 * @param refInfo - The information for the tag to create.
 */
export const createReleaseTag = async (
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
 * @param client - The API client to use.
 * @param releaseInfo - Information about the release.
 */
export const deletePreviousGitHubRelease = async (
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
 * @param client - The API client to use.
 * @param releaseInfo - Information about the release.
 * @returns The response from the GitHub API.
 */
export const generateNewGitHubRelease = async (
  client: InstanceType<typeof GitHub>,
  releaseInfo: ReleaseInfoFull,
): Promise<NewGitHubRelease> => {
  core.startGroup(`Generating new GitHub release for the "${releaseInfo.tag_name}" tag`);

  core.info("Creating new release");
  const resp = await client.rest.repos.createRelease(releaseInfo);
  core.endGroup();
  return resp.data;
};
