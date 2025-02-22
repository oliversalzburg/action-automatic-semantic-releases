# Automatic Semantic Releases Action

[![Pre-Release](https://github.com/oliversalzburg/action-automatic-semantic-releases/actions/workflows/pre-release.yml/badge.svg)](https://github.com/oliversalzburg/action-automatic-semantic-releases/actions/workflows/pre-release.yml)

> :information_source: This action is a fork of <https://github.com/marvinpinto/action-automatic-releases>.

## Usage

The easiest type of GitHub Release is to just release whenever you push a versioned tag.

Maintaining the `automatic_release_tag` on the repo and creating releases requires write permissions to `contents`.

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
          repo_token: ${{ secrets.GITHUB_TOKEN }}
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
          automatic_release_tag: next
          draft: false
          files: |
            output/*
          prerelease: true
          repo_token: ${{ secrets.GITHUB_TOKEN }}
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
          automatic_release_tag: nightly
          draft: false
          files: |
            output/*
          prerelease: true
          repo_token: ${{ secrets.GITHUB_TOKEN }}
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
          automatic_release_tag: next
          draft: false
          files: |
            output/*
          prerelease: true
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          title: Snapshot Build v${{ env.RELEASE_VERSION }}
```

## Inputs

<!-- AUTO-DOC-INPUT:START - Do not remove or modify this section -->

| INPUT                                                                                           | TYPE   | REQUIRED | DEFAULT   | DESCRIPTION                                                                                                       |
| ----------------------------------------------------------------------------------------------- | ------ | -------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| <a name="input_automatic_release_tag"></a>[automatic_release_tag](#input_automatic_release_tag) | string | false    |           | git tag (for automatic releases).                                                                                 |
| <a name="input_body_prefix"></a>[body_prefix](#input_body_prefix)                               | string | false    |           | Text to prepend before the <br>changelog in the release body.                                                     |
| <a name="input_body_suffix"></a>[body_suffix](#input_body_suffix)                               | string | false    |           | Text to append after the <br>changelog in the release body.                                                       |
| <a name="input_changelog_artifact"></a>[changelog_artifact](#input_changelog_artifact)          | string | false    |           | Name of a file to <br>save the changelog metadata into. <br>Will be attached to the <br>workflow run.             |
| <a name="input_draft"></a>[draft](#input_draft)                                                 | string | false    | `"false"` | Should this release be marked <br>as a draft?                                                                     |
| <a name="input_dry_run"></a>[dry_run](#input_dry_run)                                           | string | false    | `"false"` | If set to "true", no <br>tags will be moved. If <br>you also don't want an <br>actual release, disable `publish`. |
| <a name="input_files"></a>[files](#input_files)                                                 | string | false    |           | Assets to upload to the <br>release.                                                                              |
| <a name="input_merge_similar"></a>[merge_similar](#input_merge_similar)                         | string | false    | `"true"`  | Should similar changes be consolidated <br>to take up less space <br>in the changelog?                            |
| <a name="input_prerelease"></a>[prerelease](#input_prerelease)                                  | string | false    | `"true"`  | Should this release be marked <br>as a pre-release?                                                               |
| <a name="input_publish"></a>[publish](#input_publish)                                           | string | false    | `"true"`  | Should we actually publish a <br>GitHub release, or just do <br>other work?                                       |
| <a name="input_repo_token"></a>[repo_token](#input_repo_token)                                  | string | true     |           | GitHub secret token.                                                                                              |
| <a name="input_title"></a>[title](#input_title)                                                 | string | false    |           | Release title (for automatic releases).                                                                           |
| <a name="input_with_authors"></a>[with_authors](#input_with_authors)                            | string | false    | `"true"`  | If set to "true", render <br>the names of commit authors, <br>instead of the commit hash.                         |

<!-- AUTO-DOC-INPUT:END -->

## Release Process

```shell
npm version patch --message "chore: Version bump %s"
```
