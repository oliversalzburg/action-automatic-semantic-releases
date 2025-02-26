# Automatic Semantic Releases Action

[![Pre-Release](https://github.com/oliversalzburg/action-automatic-semantic-releases/actions/workflows/pre-release.yml/badge.svg)](https://github.com/oliversalzburg/action-automatic-semantic-releases/actions/workflows/pre-release.yml)

> :information_source: This action is a fork of <https://github.com/marvinpinto/action-automatic-releases>.

## Usage

The easiest type of GitHub Release is to just release whenever you push a versioned tag.

Maintaining the `automatic-release-tag` on the repo and creating releases requires write permissions to `contents`.

### Tagged Build (Release on Tag Push)

```yml
name: Publish Release

on:
  push:
    tags:
      - "v*"

jobs:
  tagged-release:
    runs-on: ubuntu-22.04
    permissions:
      contents: write
      pull-requests: read

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: your build process
      - uses: oliversalzburg/action-automatic-semantic-releases@v0.0.5
        with:
          # Create only as draft, so we can add a description on the web UI.
          draft: true
          files: |
            output/*
          prerelease: false
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          title: ${{ github.ref_name }}
```

### Version Management

This action assumes that _only_ tagged builds also have a correlating change in the version number that is persisted into the code base. This means that you'll likely only see versions like `1.33.7` in your manifest in the code base, while there are published _releases_ that are derived from that version. You commonly see versions like `3.13.3-dev.7` or `3.1.3-37e57` that could designate such a derived version.

Snapshot releases, like development or nightly builds, all have to be produced from the same version number in the code base. To prevent snapshot releases to conflict with tagged builds with the same version number, a unique version number needs to be generated for snapshot releases.

Due to the complexity of version number management in various kinds of projects, this task is left to the integrator of this action. Most likely, you'd want to generate the version number before your own build anyway, to make it available as part of the artifact labeling process.

[The script that is used in the examples below](./examples/release-version.cjs) can be used as a starting point for your own project.

### Development Build (Release on Push)

While excessive, you can also create a release on every single push to the repository.

```yml
name: Publish Push

on:
  push:
    branches: [main]

env:
  DEV_BUILD: true

jobs:
  pre-release:
    runs-on: ubuntu-22.04
    permissions:
      contents: write
      pull-requests: read

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: echo "RELEASE_VERSION=$(node release-version.cjs)" >> $GITHUB_ENV
      - run: your build process
      - uses: oliversalzburg/action-automatic-semantic-releases@v0.0.5
        with:
          automatic-release-tag: next
          draft: false
          files: |
            output/*
          prerelease: true
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          title: Development Build v${{ env.RELEASE_VERSION }}
```

### Nightly Build (Release on Schedule)

A common release type is to release once per day, if there were any changes since in the last 24 hours.

This template illustrates this release type.

```yml
name: Publish Nightly

on:
  schedule:
    - cron: "12 7 * * *"

env:
  NIGHTLY_BUILD: true

jobs:
  check_date:
    runs-on: ubuntu-22.04
    name: Check latest commit
    outputs:
      should_run: ${{ steps.should_run.outputs.should_run }}
    steps:
      - uses: actions/checkout@v4
      - id: should_run
        continue-on-error: true
        if: ${{ github.event_name == 'schedule' }}
        run: test -z $(git rev-list  --after="24 hours"  ${{ github.sha }}) && echo "name=should_run::false" >> $GITHUB_OUTPUT

  nightly:
    needs: check_date
    if: ${{ needs.check_date.outputs.should_run != 'false' }}
    runs-on: ubuntu-22.04
    permissions:
      contents: write
      pull-requests: read

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: echo "RELEASE_VERSION=$(node release-version.cjs)" >> $GITHUB_ENV
      - run: your build process
      - uses: oliversalzburg/action-automatic-semantic-releases@v0.0.5
        with:
          automatic-release-tag: nightly
          draft: false
          files: |
            output/*
          prerelease: true
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          title: Nightly Build v${{ env.RELEASE_VERSION }}
```

## Examples

### Serial Snapshot Build

This example is highly specific to JavaScript module projects. It assumes a registry of published artifacts with valid semantic version numbers, where the next published snapshot should have a version number following the existing series.

> :information_source: This process was inspired by the release pipelines of <https://github.com/mikro-orm/mikro-orm>.

```yml
jobs:
  snapshot:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          registry-url: https://registry.npmjs.org
      - run: echo "RELEASE_VERSION=$(node manifest-version.cjs --canary=patch)" >> $GITHUB_ENV
      - env:
          # This registry access token requires write access to the scope used in the manifest.
          # A token that is limited to the package scope is not sufficient to publish a completely new module.
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          npm --no-git-tag-version --ignore-scripts version ${RELEASE_VERSION}
          npm publish --access=public --provenance --tag=next
      - uses: oliversalzburg/action-automatic-semantic-releases@v0.0.5
        with:
          automatic-release-tag: next
          draft: false
          files: |
            output/*
          prerelease: true
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          title: Snapshot Build v${{ env.RELEASE_VERSION }}
```

## Inputs

<!-- AUTO-DOC-INPUT:START - Do not remove or modify this section -->
```yaml
- uses: oliversalzburg/action-automatic-semantic-releases@v0
  id: action-automatic-semantic-releases
  with:
    # git tag (for automatic releases).
    # Type: string
    automatic-release-tag: ''

    # Text to prepend before the 
    # changelog in the release body. 
    # Type: string
    body-prefix: ''

    # Text to append after the 
    # changelog in the release body. 
    # Type: string
    body-suffix: ''

    # Name of a file to 
    # save the changelog metadata into. 
    # Will be attached to the 
    # workflow run. 
    # Type: string
    changelog-artifact: ''

    # Should this release be marked 
    # as a draft? 
    # Type: boolean
    # Default: "false"
    draft: ''

    # If set to "true", no 
    # tags will be moved. If 
    # you also don't want an 
    # actual release, disable `publish`. 
    # Type: boolean
    # Default: "false"
    dry-run: ''

    # Assets to upload to the 
    # release. 
    # Type: string
    files: ''

    # Should similar changes be consolidated 
    # to take up less space 
    # in the changelog? 
    # Type: boolean
    # Default: "true"
    merge-similar: ''

    # Should this release be marked 
    # as a pre-release? 
    # Type: boolean
    # Default: "true"
    prerelease: ''

    # Should we actually publish a 
    # GitHub release, or just do 
    # other work? 
    # Type: boolean
    # Default: "true"
    publish: ''

    # GitHub secret token.
    # Type: string
    repo-token: ''

    # Provide the current version of 
    # your project to determine the 
    # release version automatically. 
    # Type: string
    root-version: ''

    # Release title (for automatic releases).
    # Type: string
    title: ''

    # If set to "true", render 
    # the names of commit authors, 
    # instead of the commit hash. 
    # Type: boolean
    # Default: "true"
    with-authors: ''

```
<!-- AUTO-DOC-INPUT:END -->

## Outputs

<!-- AUTO-DOC-OUTPUT:START - Do not remove or modify this section -->

|                                                   OUTPUT                                                   |  TYPE  |                                       DESCRIPTION                                        |
|------------------------------------------------------------------------------------------------------------|--------|------------------------------------------------------------------------------------------|
|    <a name="output_automatic-releases-tag"></a>[automatic-releases-tag](#output_automatic-releases-tag)    | string |                     The release tag this action <br>just processed.                      |
|                 <a name="output_commits-total"></a>[commits-total](#output_commits-total)                  | string |                     Total amount of commits since <br>last release.                      |
|              <a name="output_lifecycle-total"></a>[lifecycle-total](#output_lifecycle-total)               | string |          Total amount of commits that <br>fall into the "lifecycle" category.            |
|                    <a name="output_major-total"></a>[major-total](#output_major-total)                     | string |       Total amount of commits that <br>fall into the "major change" <br>category.        |
|                    <a name="output_minor-total"></a>[minor-total](#output_minor-total)                     | string |       Total amount of commits that <br>fall into the "minor change" <br>category.        |
|                    <a name="output_patch-total"></a>[patch-total](#output_patch-total)                     | string |       Total amount of commits that <br>fall into the "patch change" <br>category.        |
|       <a name="output_unconventional-total"></a>[unconventional-total](#output_unconventional-total)       | string |                     Total amount of commits without <br>convention.                      |
|                      <a name="output_upload-url"></a>[upload-url](#output_upload-url)                      | string |               The URL for uploading additional <br>assets to the release.                |
|              <a name="output_version-current"></a>[version-current](#output_version-current)               | string |                             Current version in the manifest.                             |
|                    <a name="output_version-dev"></a>[version-dev](#output_version-dev)                     | string |             Version number to use for <br>a transient development release.               |
|       <a name="output_version-dev-extended"></a>[version-dev-extended](#output_version-dev-extended)       | string | Version number to use for <br>a transient development release, including <br>extension.  |
|          <a name="output_version-extensions"></a>[version-extensions](#output_version-extensions)          | string |             Extension that was found on <br>your current manifest version.               |
|                 <a name="output_version-major"></a>[version-major](#output_version-major)                  | string |                       Version number to use for <br>a major bump.                        |
|                 <a name="output_version-minor"></a>[version-minor](#output_version-minor)                  | string |                       Version number to use for <br>a minor bump.                        |
|              <a name="output_version-nightly"></a>[version-nightly](#output_version-nightly)               | string |               Version number to use for <br>a transient nightly release.                 |
| <a name="output_version-nightly-extended"></a>[version-nightly-extended](#output_version-nightly-extended) | string |  Version number to use for <br>a transient nightly release, including <br>extensions.    |
|                 <a name="output_version-patch"></a>[version-patch](#output_version-patch)                  | string |                       Version number to use for <br>a patch bump.                        |
|                   <a name="output_version-root"></a>[version-root](#output_version-root)                   | string |                  Current manifest version stripped of <br>extensions.                    |

<!-- AUTO-DOC-OUTPUT:END -->

## Release Process

```shell
npm version patch --message "chore: Version bump %s"
```
