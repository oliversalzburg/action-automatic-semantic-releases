import { GitHub } from "@actions/github/lib/utils.js";
import { isNil, mustExist } from "@oliversalzburg/js-utils/data/nil.js";
import { Commit, CommitMeta, CommitParser, ParserOptions } from "conventional-commits-parser";
import {
  Changelog,
  CommitsSinceRelease,
  ConventionalCommitType,
  ConventionalCommitTypes,
  CoreType,
  ParsedCommit,
} from "./types.js";

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

const countChanges = (totalCount: number, mergedCount: number) => {
  if (mergedCount === 0) {
    return totalCount.toString();
  }

  return `${totalCount - mergedCount}/+${mergedCount} unlisted`;
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

/**
 * Generates a changelog for a given set of commits.
 * @param parsedCommits - The commit for which to generate the changelog.
 * @param withAuthors - If enabled, render the names of commit authors, instead of the commit hash.
 * @param mergeSimilar - If enabled, similar changes will be groups in the changelog.
 * @returns The final changelog.
 */
export const renderChangelogFromParsedCommits = (
  parsedCommits: Array<ParsedCommit>,
  withAuthors: boolean,
  mergeSimilar: boolean,
): string => {
  let changelogText = "";

  const commitsWithoutDeps = parsedCommits.filter(commit => commit.scope !== "deps");
  const commitsDeps = parsedCommits.filter(commit => commit.scope === "deps");

  // Breaking Changes
  const breakingChanges = parsedCommits
    .filter(val => val.extra.breakingChange)
    .sort((a, b) => a.header.localeCompare(b.header))
    .map(val => getFormattedChangelogEntry(val, withAuthors));
  if (breakingChanges.length) {
    changelogText += "## Breaking Changes\n";
    changelogText += breakingChanges.join("\n").trim();
  }

  // Regular conventional commits
  for (const key of Object.keys(ConventionalCommitTypes) as Array<ConventionalCommitType>) {
    const commits = commitsWithoutDeps
      .filter(val => val.type === key)
      .sort((a, b) => a.header.localeCompare(b.header));
    let mergedCount = 0;

    const block = mergeSimilar
      ? mergeSimilarCommits(commits, withAuthors, groupedCommitsCache => {
          mergedCount += groupedCommitsCache.length;
          return `<sup>${groupedCommitsCache.length.toString()} similar commit${groupedCommitsCache.length !== 1 ? "s" : ""} not listed: ${groupedCommitsCache.map(commit => commit.sha).join(", ")}</sup>`;
        })
      : commits.map(commit => getFormattedChangelogEntry(commit, withAuthors));

    if (block.length) {
      changelogText += `\n\n## ${ConventionalCommitTypes[key]} (${countChanges(commits.length, mergedCount)})\n`;
      changelogText += block.join("\n").trim();
    }
  }

  // Dependency Changes
  if (commitsDeps.length) {
    changelogText += `\n\n## Dependency Changes\n`;

    for (const key of Object.keys(ConventionalCommitTypes) as Array<ConventionalCommitType>) {
      const commits = commitsDeps
        .filter(val => val.type === key)
        .sort((a, b) => a.header.localeCompare(b.header));
      let mergedCount = 0;

      const block = mergeSimilar
        ? mergeSimilarCommits(commits, withAuthors, groupedCommitsCache => {
            mergedCount += groupedCommitsCache.length;
            return `<sup>${groupedCommitsCache.length.toString()} similar commit${groupedCommitsCache.length !== 1 ? "s" : ""} not listed: ${groupedCommitsCache.map(commit => commit.sha).join(", ")}</sup>`;
          })
        : commits.map(commit => getFormattedChangelogEntry(commit, withAuthors));

      if (block.length) {
        changelogText += `\n<details>\n`;
        changelogText += `<summary>${ConventionalCommitTypes[key]} (${countChanges(commits.length, mergedCount)})</summary>\n\n`;
        changelogText += block.join("\n").trim();
        changelogText += `\n</details>\n`;
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
    changelogText += `\n\n## Commits without convention (${countChanges(commits.length, mergedCount)})\n`;
    changelogText += block.join("\n").trim();
  }

  return changelogText.trim();
};

/**
 * Generates a changelog for a given set of commits.
 * @param changelog - Previously generated changelog metadata.
 * @param withAuthors - If enabled, render the names of commit authors, instead of the commit hash.
 * @param mergeSimilar - If enabled, similar changes will be groups in the changelog.
 * @returns The final changelog.
 */
export const renderChangelogFromChangelog = (
  changelog: Partial<Changelog>,
  withAuthors: boolean,
  mergeSimilar: boolean,
): string => {
  let changelogText = "";

  // Breaking Changes
  const breakingChanges =
    changelog.breakingChanges
      ?.sort((a, b) => a.header.localeCompare(b.header))
      .map(val => getFormattedChangelogEntry(val, withAuthors)) ?? [];
  if (breakingChanges.length) {
    changelogText += "## Breaking Changes\n";
    changelogText += breakingChanges.join("\n").trim();
  }

  // Regular conventional commits
  for (const key of Object.keys(ConventionalCommitTypes) as Array<ConventionalCommitType>) {
    const commits = (changelog[key] ?? []).sort((a, b) => a.header.localeCompare(b.header));
    let mergedCount = 0;

    const block = mergeSimilar
      ? mergeSimilarCommits(commits, withAuthors, groupedCommitsCache => {
          mergedCount += groupedCommitsCache.length;
          return `<sup>${groupedCommitsCache.length.toString()} similar commit${groupedCommitsCache.length !== 1 ? "s" : ""} not listed: ${groupedCommitsCache.map(commit => commit.sha).join(", ")}</sup>`;
        })
      : commits.map(commit => getFormattedChangelogEntry(commit, withAuthors));

    if (block.length) {
      changelogText += `\n\n## ${ConventionalCommitTypes[key]} (${countChanges(commits.length, mergedCount)})\n`;
      changelogText += block.join("\n").trim();
    }
  }

  // Dependency Changes
  if (!isNil(changelog.deps)) {
    const dependencyChangesTotal = Object.values(changelog.deps).reduce(
      (commitsTotal: number, commits: Array<ParsedCommit>) => commitsTotal + commits.length,
      0,
    );
    if (0 < dependencyChangesTotal) {
      changelogText += `\n\n## Dependency Changes\n`;

      for (const key of Object.keys(ConventionalCommitTypes) as Array<ConventionalCommitType>) {
        const commits = changelog.deps[key].sort((a, b) => a.header.localeCompare(b.header));
        let mergedCount = 0;

        const block = mergeSimilar
          ? mergeSimilarCommits(commits, withAuthors, groupedCommitsCache => {
              mergedCount += groupedCommitsCache.length;
              return `<sup>${groupedCommitsCache.length.toString()} similar commit${groupedCommitsCache.length !== 1 ? "s" : ""} not listed: ${groupedCommitsCache.map(commit => commit.sha).join(", ")}</sup>`;
            })
          : commits.map(commit => getFormattedChangelogEntry(commit, withAuthors));

        if (block.length) {
          changelogText += `\n<details>\n`;
          changelogText += `<summary>${ConventionalCommitTypes[key]} (${countChanges(commits.length, mergedCount)})</summary>\n\n`;
          changelogText += block.join("\n").trim();
          changelogText += `\n</details>\n`;
        }
      }
    }
  }

  // Commits
  const commits = changelog.unconventional ?? [];
  let mergedCount = 0;

  const block = mergeSimilar
    ? mergeSimilarCommits(commits, withAuthors, groupedCommitsCache => {
        mergedCount += groupedCommitsCache.length;
        return `<sup>${groupedCommitsCache.length.toString()} similar commit${groupedCommitsCache.length !== 1 ? "s" : ""} not listed: ${groupedCommitsCache.map(commit => commit.sha).join(", ")}</sup>`;
      })
    : commits.map(commit => getFormattedChangelogEntry(commit, withAuthors));

  if (block.length) {
    changelogText += `\n\n## Commits without convention (${countChanges(commits.length, mergedCount)})\n`;
    changelogText += block.join("\n").trim();
  }

  return changelogText.trim();
};

/**
 * Generates a changelog for a given set of commits.
 * @param parsedCommits - The commit for which to generate the changelog.
 * @returns The changelog metadata.
 */
export const generateChangelogMetadataFromParsedCommits = (
  parsedCommits: Array<ParsedCommit>,
): Changelog => {
  const changelog: Partial<Changelog> = {};

  changelog.commits = [...parsedCommits];

  const commitsWithoutDeps = parsedCommits.filter(commit => commit.scope !== "deps");
  const commitsDeps = parsedCommits.filter(commit => commit.scope === "deps");

  // Breaking Changes
  changelog.breakingChanges = parsedCommits.filter(val => val.extra.breakingChange);

  // Regular conventional commits
  for (const key of Object.keys(ConventionalCommitTypes) as Array<ConventionalCommitType>) {
    const commits = commitsWithoutDeps.filter(val => val.type === key);
    changelog[key] = commits;
  }

  // Dependency Changes
  for (const key of Object.keys(ConventionalCommitTypes) as Array<ConventionalCommitType>) {
    const commits = commitsDeps.filter(val => val.type === key);
    if (!isNil(changelog.deps)) {
      changelog.deps[key] = commits;
      continue;
    }
    changelog.deps = { [key]: commits } as Changelog["deps"];
  }

  // Commits
  const commits = commitsWithoutDeps.filter(
    val => !Object.keys(ConventionalCommitTypes).includes(val.type),
  );
  changelog.unconventional = commits;

  return changelog as Changelog;
};

/**
 * Retrieve the default changelog options.
 * @param core - GitHub core to use.
 * @returns The default changelog options.
 */
export const getChangelogOptions = (core: CoreType): ParserOptions => {
  const defaultOpts: ParserOptions = {
    breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
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
 * Determine whether the given commit is a breaking change.
 * @param commit - The commit metadata.
 * @returns Whether the commit signifies a breaking change.
 */
export const isBreakingChange = (commit: CommitMeta): boolean => {
  const re = /^BREAKING\s+CHANGES?:\s+/;
  return re.test(commit.body || "") || re.test(commit.footer || "");
};

/**
 * Generates a changelog based on a set of commits.
 * @param core - GitHub core to use.
 * @param client - The API client to use.
 * @param owner - The owner of the repository.
 * @param repo - The name of the repository.
 * @param commits - The commits that have been made.
 * @returns The generated changelog metadata.
 */
export const getChangelog = async (
  core: CoreType,
  client: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  commits: CommitsSinceRelease,
): Promise<Changelog> => {
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

    const clOptions = getChangelogOptions(core);
    const parsedCommitMsg: Exclude<Commit, "type"> & {
      type?: string | null;
    } = new CommitParser(clOptions).parse(commit.commit.message);

    // istanbul ignore next
    if (parsedCommitMsg.merge) {
      core.debug(`Ignoring merge commit: ${parsedCommitMsg.merge}`);
      continue;
    }

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

  const changelogMeta = generateChangelogMetadataFromParsedCommits(parsedCommits);
  core.endGroup();

  return changelogMeta;
};

/**
 * Renders a changelog based on previously generated metadata.
 * @param core - GitHub core to use.
 * @param changelog - Metadata to render.
 * @param withAuthors - If enabled, render the names of commit authors, instead of the commit hash.
 * @param mergeSimilar - If enabled, similar changes will be grouped in the log.
 * @returns The rendered changelog.
 */
export const renderChangelog = (
  core: CoreType,
  changelog: Changelog,
  withAuthors: boolean,
  mergeSimilar: boolean,
): string => {
  core.startGroup("Rendering changelog");

  const changelogText = renderChangelogFromChangelog(changelog, withAuthors, mergeSimilar);
  core.debug("Changelog:");
  core.debug(changelogText);

  core.endGroup();
  return changelogText;
};
