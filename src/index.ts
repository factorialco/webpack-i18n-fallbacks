import merge from 'lodash/merge'
import fs from 'fs'
import { Compiler, WebpackPluginInstance } from 'webpack'

export type Options = {
  master: string
  path: string
  supportedLocales: Array<string>
  fallbacks?: Record<string, string>
  basePath?: string
}

interface Assets {
  [key: string]: {
    source: () => string | Buffer,
    size: () => number
  }
}

class FileCache {
  path: string
  contents: Record<string, any>
  stats: Record<string, any>

  constructor (path: string) {
    this.path = path
    this.contents = {}
    this.stats = {}
  }

  cached (locale: string): boolean {
    const filepath = `${this.path}/${locale}.json`

    const stats = fs.statSync(filepath)

    return this.stats[locale]?.toString() === stats.mtime.toString()
  }

  retrieve (locale: string): Record<string, any> {
    const filepath = `${this.path}/${locale}.json`

    if (this.contents[locale] && this.cached(locale)) {
      return this.contents[locale] // Note: should we cloneDeep?
    }

    this.contents[locale] = JSON.parse(fs.readFileSync(filepath, 'utf8'))
    this.stats[locale] = fs.statSync(filepath).mtime

    return this.contents[locale] // Note: should we cloneDeep?
  }
}

class I18nPlugin implements WebpackPluginInstance {
  master: string
  path: string
  supportedLocales: Array<string>
  fallbacks?: Record<string, string>
  basePath?: string
  initialized: boolean
  fileCache: FileCache

  constructor (options: Options) {
    this.master = options.master
    this.path = options.path
    this.supportedLocales = options.supportedLocales
    this.fallbacks = options.fallbacks || {}
    this.basePath = options.basePath || ''
    this.initialized = false
    this.fileCache = new FileCache(this.path)
  }

  apply (compiler: Compiler): void {
    compiler.hooks.emit.tapPromise(
      'WebpackI18nFallbacks',
      compilation => {
        return new Promise((resolve, reject) => {
          if (!this.initialized) {
            console.log(`Initializing I18n... master: '${this.master}'`)
            console.log('Supported locales: ', this.supportedLocales)
          }

          this.initialized = true

          console.log(`Merging locales with their fallbacks...`)

          this.supportedLocales.forEach(locale => {
            compilation.fileDependencies.add(`${this.path}/${locale}.json`)

            let mergedObject: Record<string, any>

            // Build fallback chain for non master loales
            if (locale !== this.master) {
              let currentFallbackLocale = locale
              let fallbackChain = [locale]

              while (currentFallbackLocale !== this.master) {
                currentFallbackLocale = this.fallbacks[currentFallbackLocale]
                fallbackChain.push(currentFallbackLocale)
              }

              const cachedChain = fallbackChain.reduce((memo, locale: string) => memo && this.fileCache.cached(locale), true)

              if (cachedChain) {
                console.log(`Using cached version for ${locale}!`)
                return
              }

              console.log(`Locale fallbacks for ${locale} ->`, fallbackChain)

              // We merge in reverse order to keep the specified priority of fallbacks
              mergedObject = fallbackChain.reverse().reduce((memo, fallbackLocale) => {
                try {
                  const data = this.fileCache.retrieve(fallbackLocale)

                  memo = merge(memo, data)

                  return memo
                } catch (e) {
                  reject(e)
                }
              }, {})
            } else {
              mergedObject = this.fileCache.retrieve(this.master)
            }

            const filepath = `${this.basePath}translations/${locale}.json`
            const content = JSON.stringify(mergedObject)
            const assets = compilation.assets as Assets

            assets[filepath] = {
              source: () => { return Buffer.from(content) },
              size: () => { return Buffer.byteLength(content) }
            }
          })

          resolve(null)
        })
      }
    )
  }
}

export default I18nPlugin
