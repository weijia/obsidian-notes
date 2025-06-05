import { createClient } from 'webdav'

let client = null

export const initWebDAV = (config) => {
  client = createClient(config.url, {
    username: config.username,
    password: config.password,
  })
  return client
}

export const getDirectoryContents = async (path = '/') => {
  if (!client) throw new Error('WebDAV client not initialized')

  const contents = await client.getDirectoryContents(path)
  return contents.map((item) => ({
    ...item,
    children: item.type === 'directory' ? [] : null,
  }))
}

export const loadFile = async (path) => {
  if (!client) throw new Error('WebDAV client not initialized')
  return await client.getFileContents(path, { format: 'text' })
}
