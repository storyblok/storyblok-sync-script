const StoryblokClient = require('storyblok-js-client')

const Sync = {
  targetComponents: [],
  sourceComponents: [],

  init(options) {
    this.sourceSpaceId = options.source
    this.targetSpaceId = options.target
    this.client = new StoryblokClient({
      oauthToken: options.token
    }, options.api)
  },

  async syncStories(){
    var targetFolders = await this.client.getAll(`spaces/${this.targetSpaceId}/stories`, {
      folder_only: 1,
      sort_by: 'slug:asc'
    })

    var folderMapping = {}

    for (var i = 0; i < targetFolders.length; i++) {
      var folder = targetFolders[i]
      folderMapping[folder.full_slug] = folder.id
    }

    var all = await this.client.getAll(`spaces/${this.sourceSpaceId}/stories`, {
      story_only: 1
    })

    for (var i = 0; i < all.length; i++) {
      console.log('starting update ' + all[i].full_slug)

      var storyResult = await this.client.get('spaces/' + this.sourceSpaceId + '/stories/' + all[i].id)
      var sourceStory = storyResult.data.story
      var slugs = sourceStory.full_slug.split('/')
      var folderId = 0

      if (slugs.length > 1) {
        slugs.pop()
        var folderSlug = slugs.join('/')

        if (folderMapping[folderSlug]) {
          folderId = folderMapping[folderSlug]
        } else {
          console.log('the folder does not exist ' + folderSlug)
          continue;
        }
      }

      sourceStory.parent_id = folderId

      try {
        var existingStory = await this.client.get('spaces/' + this.targetSpaceId + '/stories', {with_slug: all[i].full_slug})
        var payload = {
          story: sourceStory,
          force_update: '1'
        }
        if (sourceStory.published) {
          payload['publish'] = '1'
        }

        if (existingStory.data.stories.length == 1) {
          var updateResult = await this.client.put('spaces/' + this.targetSpaceId + '/stories/' + existingStory.data.stories[0].id, payload)
          console.log('updated ' + existingStory.data.stories[0].full_slug)
        } else {
          var updateResult = await this.client.post('spaces/' + this.targetSpaceId + '/stories', payload)
          console.log('created ' + sourceStory.full_slug)
        }
      } catch(e) {
        console.log(e)
      }
    }

    return all
  },

  async syncFolders() {
    let sourceFolders = await this.client.getAll(`spaces/${this.sourceSpaceId}/stories`, {
      folder_only: 1,
      sort_by: 'slug:asc'
    })
    let syncedFolders = {}

    for (var i = 0; i < sourceFolders.length; i++) {
      let folder = sourceFolders[i]
      let folderId = folder.id
      delete folder.id
      delete folder.created_at

      if (folder.parent_id) {
        // Parent child resolving
        if (!syncedFolders[folderId]) {
          let folderSlug = folder.full_slug.split('/')
          let parentFolderSlug = folderSlug.splice(0, folderSlug.length - 1).join('/')

          let existingFolders = await this.client.get(`spaces/${this.targetSpaceId}/stories`, {
              with_slug: parentFolderSlug
          })

          if (existingFolders.data.stories.length) {
            folder.parent_id = existingFolders.data.stories[0].id
          } else {
            folder.parent_id = 0
          }
        } else {
          folder.parent_id = syncedFolders[folderId]
        }
      }

      try {
        let newFolder = await this.client.post(`spaces/${this.targetSpaceId}/stories`, {
          story: folder
        })

        syncedFolders[folderId] = newFolder.data.story.id
        console.log(`Folder ${newFolder.data.story.name} created`)
      } catch(e) {
        console.log(`Folder ${folder.name} already exists`)
      }
    }
  },

  async syncRoles() {
    let existingFolders = await this.client.getAll(`spaces/${this.targetSpaceId}/stories`, {
      folder_only: 1,
      sort_by: 'slug:asc'
    })

    let roles = await this.client.get(`spaces/${this.sourceSpaceId}/space_roles`)
    let existingRoles = await this.client.get(`spaces/${this.targetSpaceId}/space_roles`)

    for (var i = 0; i < roles.data.space_roles.length; i++) {
      let space_role = roles.data.space_roles[i]
      delete space_role.id
      delete space_role.created_at

      space_role.allowed_paths = []

      space_role.resolved_allowed_paths.forEach((path) => {
        let folders = existingFolders.filter((story) => {
          return story.full_slug + '/' == path
        })

        if (folders.length) {
          space_role.allowed_paths.push(folders[0].id)
        }
      })

      let existingRole = existingRoles.data.space_roles.filter((role) => {
        return role.role == space_role.role
      })
      if (existingRole.length) {
        await this.client.put(`spaces/${this.targetSpaceId}/space_roles/${existingRole[0].id}`, {
          space_role: space_role
        })
      } else {
        await this.client.post(`spaces/${this.targetSpaceId}/space_roles`, {
          space_role: space_role
        })
      }
      console.log(`Role ${space_role.role} synced`)
    }
  },

  async syncComponents() {
    this.targetComponents = await this.client.get(`spaces/${this.targetSpaceId}/components`)
    this.sourceComponents = await this.client.get(`spaces/${this.sourceSpaceId}/components`)

    for (var i = 0; i < this.sourceComponents.data.components.length; i++) {
      let component = this.sourceComponents.data.components[i]

      delete component.id
      delete component.created_at

      // Create new component on target space
      try {
        await this.client.post(`spaces/${this.targetSpaceId}/components`, {
          component: component
        })
        console.log(`Component ${component.name} synced`)
      } catch(e) {
        if (e.response.status == 422) {
          await this.client.put(`spaces/${this.targetSpaceId}/components/${this.getTargetComponentId(component.name)}`, {
            component: component
          })
          console.log(`Component ${component.name} synced`)
        } else {
          console.log(`Component ${component.name} sync failed`)
        }
      }
    }
  },

  getTargetComponentId(name) {
    let comps = this.targetComponents.data.components.filter((comp) => {
      return comp.name == name
    })

    return comps[0].id
  }
}

exports.handler = async function (event, context) {
  console.log(`Executing command ${event.options.command}`)
  Sync.init(event.options)
  await Sync[event.options.command]()

  return {
    statusCode: '200',
    body: JSON.stringify({success: 'Synced'})
  }
}