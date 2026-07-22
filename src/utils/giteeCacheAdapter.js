/**
 * 将 GiteeFS (ZenFS Backend) 适配为 zen-fs-cache 的 CacheableFileSystem 接口。
 *
 * GiteeFS 是 @zenfs/core 的 Backend 子类，提供 read/write/stat/readdir 等方法。
 * CachedFileSystem 需要 readFile/writeFile/readdir/stat 等方法。
 * 此适配器桥接两者。
 */
export class GiteeCacheAdapter {
  constructor(giteeFs) {
    this._giteeFs = giteeFs
    this._revision = 0
  }

  /** 写操作后递增版本号，让缓存知道需要重新验证 */
  _bumpRevision() {
    this._revision++
  }

  // --- getRevision: 返回文件的 blob SHA，用于缓存重新验证 ---
  // zen-fs-cache 在 readFile/readdir/stat 后检查 revision
  // 返回 SHA 变化说明远端文件已修改，缓存应失效
  async getRevision(path) {
    const sha = this._giteeFs.getFileSha(path)
    if (sha !== undefined) return sha
    // 降级到全局递增版本号
    return this._revision
  }

  // --- readFile: stat 获取大小，分配 buffer，读取内容 ---
  async readFile(path) {
    const st = await this._giteeFs.stat(path)
    if (st.size === 0) return new Uint8Array(0)
    const buffer = new Uint8Array(st.size)
    await this._giteeFs.read(path, buffer, 0, st.size)
    return buffer
  }

  // --- writeFile ---
  async writeFile(path, data) {
    const bytes = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : new Uint8Array(data)
    await this._giteeFs.write(path, bytes, 0)
    this._bumpRevision()
  }

  // --- readdir ---
  async readdir(path) {
    return this._giteeFs.readdir(path)
  }

  // --- stat ---
  async stat(path) {
    return this._giteeFs.stat(path)
  }

  // --- exists ---
  async exists(path) {
    try {
      await this._giteeFs.stat(path)
      return true
    } catch {
      return false
    }
  }

  // --- mkdir: Gitee 隐式创建目录 ---
  async mkdir() {
    // Gitee 不需要显式创建目录
  }

  // --- unlink ---
  async unlink(path) {
    await this._giteeFs.remove(path)
    this._bumpRevision()
  }

  // --- rmdir: Gitee 不支持 ---
  async rmdir() {
    // Gitee API 不支持直接删除目录
  }

  // --- rename: 读取 + 写入 + 删除 ---
  async rename(oldPath, newPath) {
    const data = await this.readFile(oldPath)
    await this.writeFile(newPath, data)
    await this._giteeFs.remove(oldPath)
    this._bumpRevision()
  }

  // --- read (byte-level, 直接委托) ---
  async read(path, buffer, start, end) {
    if (typeof this._giteeFs.read === 'function') {
      return this._giteeFs.read(path, buffer, start, end)
    }
    const data = await this.readFile(path)
    buffer.set(data.slice(start, end), 0)
  }

  // --- write (byte-level, 直接委托) ---
  async write(path, buffer, offset) {
    if (typeof this._giteeFs.write === 'function') {
      return this._giteeFs.write(path, buffer, offset)
    }
    let existing
    try {
      existing = await this.readFile(path)
    } catch {
      existing = new Uint8Array(0)
    }
    const newSize = Math.max(existing.length, offset + buffer.length)
    const merged = new Uint8Array(newSize)
    merged.set(existing)
    merged.set(buffer, offset)
    await this.writeFile(path, merged)
  }
}