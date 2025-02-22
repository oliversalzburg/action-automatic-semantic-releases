import { AutomaticReleasesOptions, CommitsSinceRelease } from "./types.js";
import { uploadReleaseArtifacts } from "./uploadReleaseArtifacts.js";
import {
  createReleaseTag,
  deletePreviousGitHubRelease,
  generateNewGitHubRelease,
  getAndValidateArgs,
  getChangelog,
  getCommitsSinceRelease,
  parseGitTag,
  searchForPreviousReleaseTag,
} from "./utils.js";

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

    const args = getAndValidateArgs();

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
      : await searchForPreviousReleaseTag(octokit, releaseTag, {
          owner: context.repo.owner,
          repo: context.repo.repo,
        });
    core.endGroup();

    const commitsSinceRelease: CommitsSinceRelease = await getCommitsSinceRelease(
      octokit,
      {
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: `tags/${previousReleaseTag}`,
      },
      context.sha,
    );

    const changelog = await getChangelog(
      octokit,
      context.repo.owner,
      context.repo.repo,
      commitsSinceRelease,
      args.withAuthors,
      args.mergeSimilar,
    );

    if (args.automaticReleaseTag && !args.dryRun) {
      await createReleaseTag(octokit, {
        owner: context.repo.owner,
        ref: `refs/tags/${args.automaticReleaseTag}`,
        repo: context.repo.repo,
        sha: context.sha,
      });

      await deletePreviousGitHubRelease(octokit, {
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
    const release = await generateNewGitHubRelease(octokit, {
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
}
