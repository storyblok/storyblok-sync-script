<p align="center">
  <h1 align="center">Storyblok Sync Script</h1>
  <p align="center">A simple sync script for syncing schemas, roles, folders and stories.</p>
</p>

## Installation

Make sure you've node `>= 5.11.0` installed.

```
$ npm i
```

## Options

* `source`: The space id of the sync source
* `target`: The space id of the sync target
* `api`: The api endpoint (default is https://api.storyblok.com/v1)
* `command`: The command to execute. Can be syncStories, syncFolders, syncRoles or syncComponents
* `token`: Your oauth token from the my account section of Storyblok

## Commands

### Syncing schema definitions

```
$ node index.js --token YOUR_OAUTH_TOKEN --command syncComponents --source 67992 --target 67993
```

### Syncing folders

```
$ node index.js --token YOUR_OAUTH_TOKEN --command syncFolders --source 67992 --target 67993
```

### Syncing stories/content

```
$ node index.js --token YOUR_OAUTH_TOKEN --command syncStories --source 67992 --target 67993
```

### Syncing user roles

```
$ node index.js --token YOUR_OAUTH_TOKEN --command syncRoles --source 67992 --target 67993
```

