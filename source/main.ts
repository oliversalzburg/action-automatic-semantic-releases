import core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { redirectErrorsToConsole } from "@oliversalzburg/js-utils/errors/console.js";
import { AutomaticReleases } from "./AutomaticReleases.js";
import { getAndValidateArgs, octokitLogger } from "./utils.js";

const isMainModule = import.meta.url.endsWith(process.argv[1]);

/**
 * Execute the action.
 */
export const main = async (): Promise<void> => {
  try {
    const token = core.getInput("repo-token", { required: true });
    const args = getAndValidateArgs(core);
    const automaticReleases = new AutomaticReleases(
      {
        context,
        core,
        octokit: getOctokit(token, {
          log: {
            debug: (...logArgs) => {
              core.debug(octokitLogger(...logArgs));
            },
            info: (...logArgs) => {
              core.debug(octokitLogger(...logArgs));
            },
            warn: (...logArgs) => {
              core.warning(octokitLogger(...logArgs));
            },
            error: (...logArgs) => {
              core.error(octokitLogger(...logArgs));
            },
          },
        }),
      },
      args,
    );

    await automaticReleases.main();
  } catch (error) {
    core.setFailed((error as Error).message);
    throw error;
  }
};

if (isMainModule) {
  main().catch(redirectErrorsToConsole(console));
}
