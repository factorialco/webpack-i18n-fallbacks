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

class I18nPlugin implements WebpackPluginInstance {
  master: string
  path: string
  supportedLocales: Array<string>
  fallbacks?: Record<string, string>
  basePath?: string

  constructor (options: Options) {
    this.master = options.master
    this.path = options.path
    this.supportedLocales = options.supportedLocales
    this.fallbacks = options.fallbacks || {}
    this.basePath = options.basePath || ''
  }

  apply (compiler: Compiler) {
    compiler.hooks.emit.tapPromise(
      'WebpackI18nFallbacks',
      compilation => {
        return new Promise((resolve, reject) => {
          console.log(`Initializing I18n... master: '${this.master}'`)
          console.log('Supported locales: ', this.supportedLocales)
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

              console.log(`Locale fallbacks for ${locale} ->`, fallbackChain)

              // We merge in reverse order to keep the specified priority of fallbacks
              mergedObject = fallbackChain.reverse().reduce((memo, fallbackLocale) => {
                try {
                  const fallbackFilepath = `${this.path}/${fallbackLocale}.json`
                  const data = JSON.parse(fs.readFileSync(fallbackFilepath, 'utf8'))

                  memo = merge(memo, data)

                  return memo
                } catch (e) {
                  reject(e)
                }
              }, {})
            } else {
              const masterFilepath = `${this.path}/${this.master}.json`

              mergedObject = JSON.parse(fs.readFileSync(masterFilepath, 'utf8'))
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
